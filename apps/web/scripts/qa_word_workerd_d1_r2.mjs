import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createResumeDocx} from '../src/services/resumeDocx.ts';
import {editOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';

// The Pages Functions module is bundled unchanged and runs in local workerd.
// Unlike in-memory API fakes, database, R2 conditional writes and session
// auth are real Miniflare emulators. All users, documents and keys are synthetic.
const root=mkdtempSync(join(resolve('.'),'.qa-word-workerd-'));
const out=join(root,'private-word-worker.mjs');
const origin='https://hhba-workerd-qa.invalid';
const id='11111111-2222-4333-8444-555555555555';
const owner='18800001111';
const other='18800002222';
const token='hhba-local-synthetic-token';
const key='candidate/synthetic/word.docx';
const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const docx=new Uint8Array(createResumeDocx({
 details:{fullName:'测试用户',headline:'虚构岗位项目',phone:'',email:'',location:'',summary:''},
 experiences:[],education:[],skills:[],sourceParagraphs:[]
}));
const sha=data=>createHash('sha256').update(data).digest('hex');
const dbSha=sha(docx);
let mf;
function request(action='status',{job,method='GET',body,auth=true,originOverride}={}){
 const qs=new URLSearchParams({action,resume_id:id});
 if(job!==undefined)qs.set('job_id',job);
 return mf.dispatchFetch(origin+'/api/resume-word?'+qs.toString(),{
  method,headers:{
   ...(auth?{Authorization:'Bearer '+token}:{}),
   ...(method==='POST'?{'Content-Type':'application/json',Origin:originOverride||origin}:{})
  },
  ...(body?{body:JSON.stringify(body)}:{})
 });
}
async function expectResponse(resp,code,label){
 const text=await resp.clone().text();
 assert.equal(resp.status,code,label+' => '+text.slice(0,240));
 return code===200?JSON.parse(text):null;
}
async function originalDownload(job,action='source-docx'){
 const response=await request(action,{job});
 assert.equal(response.status,200,await response.clone().text());
 return new Uint8Array(await response.arrayBuffer());
}
async function edit(job,oldText,newText,expected=0){
 const source=await originalDownload(job);
 const edited=await editOriginalDocxStrict(source,[{original:oldText,text:newText}],{allowExpansion:true});
 const start=performance.now();
 const res=await request('edit',{job,method:'POST',body:{
  action:'edit',resume_id:id,job_id:job,original:oldText,text:newText,
  client_docx_sha256:sha(edited),expected_revision:expected,
  confirmed_real:true,consent_word_processing:true
 }});
 const result=await expectResponse(res,200,'save job '+job);
 assert.equal(result.layout_verified,false);
 assert.equal(result.pdf_available,false);
 assert.deepEqual(await originalDownload(job,'download'),edited);
 return {elapsedMs:Math.round(performance.now()-start),result,edited};
}
try{
 await build({entryPoints:[resolve('scripts/qa_word_workerd_entry.mjs')],outfile:out,
  bundle:true,platform:'neutral',format:'esm',target:'es2022',logLevel:'warning'});
 mf=new Miniflare({
  modules:true,scriptPath:out,compatibilityDate:'2026-08-06',
  d1Databases:{HHBA_PNVS_AUTH_DB:'local-word-d1'},
  r2Buckets:['HHBA_PRIVATE_RESUMES'],
  bindings:{
   HHBA_WORD_RENDER_ENABLED:'0',HHBA_WORD_DOCX_ONLY_ENABLED:'1',
   HHBA_AUTH_ROLLOUT:'preview',HHBA_MATCH_LIMIT_PEPPER:'synthetic-pepper-only-'+'p'.repeat(35)
  }
 });
 const db=await mf.getD1Database('HHBA_PNVS_AUTH_DB');
 const bucket=await mf.getR2Bucket('HHBA_PRIVATE_RESUMES');
 // Mirror the actual Cloudflare Preview D1 SQL constraints rather than using
 // permissive fake tables. An earlier real Preview QA fixture was rejected by
 // storage_consent_version's CHECK despite passing this local test.
 await db.exec(`CREATE TABLE hhba_auth_users (
  phone TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'candidate' CHECK (role IN ('candidate')),
  created_at TEXT NOT NULL, last_login_at TEXT,
  failed_pw_attempts INTEGER NOT NULL DEFAULT 0, pw_locked_until TEXT
 )`);
 await db.exec(`CREATE TABLE hhba_auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  last_seen_at TEXT, revoked INTEGER NOT NULL DEFAULT 0
 )`);
 await db.exec(`CREATE TABLE hhba_candidate_resumes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN
   ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 3145728),
  sha256 TEXT NOT NULL,
  storage_consent_version TEXT NOT NULL CHECK(storage_consent_version='private-resume-storage-v1'),
  storage_consent_at TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(phone,sha256)
 )`);
 await db.exec('CREATE TABLE hhba_resume_word_attempts (request_id TEXT PRIMARY KEY,day_utc TEXT,account_hash TEXT,action TEXT,created_at TEXT)');
 const now=new Date(),date=now.toISOString();
 await db.prepare('INSERT INTO hhba_auth_users(phone,role,created_at) VALUES(?,?,?)')
  .bind(owner,'candidate',date).run();
 await db.prepare('INSERT INTO hhba_auth_users(phone,role,created_at) VALUES(?,?,?)')
  .bind(other,'candidate',date).run();
 await db.prepare('INSERT INTO hhba_auth_sessions(token_hash,phone,created_at,expires_at) VALUES(?,?,?,?)')
  .bind(sha(Buffer.from(token)),owner,date,new Date(now.getTime()+3600_000).toISOString()).run();
 const insertResume='INSERT INTO hhba_candidate_resumes('+
  'id,phone,storage_key,filename,media_type,size_bytes,sha256,'+
  'storage_consent_version,storage_consent_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)';
 await assert.rejects(db.prepare(insertResume).bind(
  'ffffffff-2222-4333-8444-555555555555',owner,'candidate/synthetic/invalid.docx',
  'synthetic.docx',mime,docx.length,dbSha,'QA_ONLY',date,date).run(),
  /CHECK constraint/i,
  'QA fixtures must honor the REAL Preview storage consent constraint');
 await db.prepare(insertResume).bind(
  id,owner,key,'synthetic.docx',mime,docx.length,dbSha,
  'private-resume-storage-v1',date,date).run();
 await bucket.put(key,docx,{httpMetadata:{contentType:mime}});

 const status=await expectResponse(await request('status'),200,'capabilities');
 assert.equal(status.docx_only_enabled,true);
 assert.equal(status.renderer_enabled,false);
 assert.equal((await request('inspect',{auth:false})).status,401,'login required');
 assert.equal((await request('source-docx',{auth:false})).status,401,'private source not public');
 assert.deepEqual(await originalDownload('role-A'),docx);

 const a=await edit('role-A','测试用户','岗位甲真实经历',0);
 const b=await edit('role-B','测试用户','岗位乙真实经历',0);
 assert.notDeepEqual(a.edited,b.edited,'different jobs have different DOCX bytes');
 const inspectA=await expectResponse(await request('inspect',{job:'role-A'}),200,'inspect A');
 const inspectB=await expectResponse(await request('inspect',{job:'role-B'}),200,'inspect B');
 assert.equal(inspectA.revision,1);
 assert.equal(inspectB.revision,1);
 assert.equal(inspectA.layout_verified,false);
 assert.equal((await request('download-pdf',{job:'role-A'})).status,422,
  'unverified Word must not produce PDF');
 const bad=await request('edit',{job:'role-A',method:'POST',body:{
  action:'edit',resume_id:id,job_id:'role-A',
  original:'岗位甲真实经历',text:'违规伪造',
  client_docx_sha256:'f'.repeat(64),expected_revision:1,
  confirmed_real:true,consent_word_processing:true
 }});
 assert.equal(bad.status,409,'mismatched browser hash must be rejected');
 const spoof=await request('edit',{job:'role-A',method:'POST',originOverride:'https://evil.invalid',body:{
  action:'undo',resume_id:id,job_id:'role-A',expected_revision:1,
  confirmed_real:true,consent_word_processing:true
 }});
 assert.equal(spoof.status,403,'cross-origin mutation forbidden');
 const undo=await request('undo',{job:'role-A',method:'POST',body:{
  action:'undo',resume_id:id,job_id:'role-A',expected_revision:1,
  confirmed_real:true,consent_word_processing:true
 }});
 await expectResponse(undo,200,'A undo');
 assert.deepEqual(await originalDownload('role-A'),docx,'A undo restores original');
 assert.deepEqual(await originalDownload('role-B'),b.edited,'A undo leaves B unchanged');
 const redo=await request('redo',{job:'role-A',method:'POST',body:{
  action:'redo',resume_id:id,job_id:'role-A',expected_revision:0,
  confirmed_real:true,consent_word_processing:true
 }});
 await expectResponse(redo,200,'A redo');
 assert.deepEqual(await originalDownload('role-A'),a.edited);
 assert.deepEqual(new Uint8Array(await (await bucket.get(key)).arrayBuffer()),docx,
  'real R2 source remains byte-identical');

 const row=await db.prepare("SELECT COUNT(*) AS n FROM hhba_resume_word_attempts WHERE action='export'").first();
 assert.equal(row.n,3,'two successful edits plus one rejected hash attempt consume quota');
 const list=await bucket.list({prefix:key+'.hhba-word-preserved-v1-'+dbSha});
 assert.ok(list.objects.some(x=>x.key.includes('.job-')),'job-scoped private manifests written');
 console.log('HHBA_LOCAL_WORKERD_R2_D1_PASS',JSON.stringify({
  sourceBytes:docx.length,jobASaveMs:a.elapsedMs,jobBSaveMs:b.elapsedMs,
  d1QuotaRows:row.n,r2ObjectCount:list.objects.length,runMode:'local workerd (NOT remote Cloudflare)'
 }));
}finally{
 if(mf)await mf.dispose();
 rmSync(root,{recursive:true,force:true});
}
