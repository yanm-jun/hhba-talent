// Exercises real Cloudflare Pages handlers and actual SQLite queries within one
// authenticated session. Only the DeepSeek HTTP transport is mocked. No personal
// information, third-party charges, or external websites are involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as realAuth} from '../functions/api/real-auth/[[path]].js';
import {onRequestPost as optimize,onRequestGet as optimizerStatus} from '../functions/api/resume-optimize.js';
import {onRequest as versions} from '../functions/api/resume-versions.js';
import {createUser,createSession,hashPassword} from '../functions/_lib/real-auth.js';

const ORIGIN='https://synthetic-qa.hhba-talent.pages.dev';
const payload=(obj)=>JSON.stringify(obj);
function createD1(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec(`
  CREATE TABLE hhba_auth_users(
   phone TEXT PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,role TEXT NOT NULL,
   created_at TEXT NOT NULL,last_login_at TEXT,failed_pw_attempts INTEGER NOT NULL DEFAULT 0,
   pw_locked_until TEXT
  );
  CREATE TABLE hhba_auth_sessions(
   token_hash TEXT PRIMARY KEY,phone TEXT NOT NULL REFERENCES hhba_auth_users(phone),
   created_at TEXT NOT NULL,expires_at TEXT NOT NULL,last_seen_at TEXT,revoked INTEGER DEFAULT 0
  );
 `);
 for(const file of ['0020_resume_optimization_usage.sql',
  '0021_targeted_resume_versions.sql','0024_resume_optimization_attempts.sql'])
  sqlite.exec(readFileSync(new URL('../d1/'+file,import.meta.url),'utf8'));
 const d1={prepare(sql){
  const p=sqlite.prepare(sql);
  const statement=(args)=>({
   async first(){return p.get(...args)??null},
   async all(){return {success:true,results:p.all(...args)}},
   async run(){const r=p.run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
  });
  return {...statement([]),bind(...args){return statement(args)}};
 }};
 return {d1,sqlite};
}
function makeRequest(path,{method='GET',body,token,origin=ORIGIN}={}){
 const headers={Origin:origin,'Sec-Fetch-Site':'same-origin'};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 return new Request(ORIGIN+path,{method,headers,
  ...(body!==undefined?{body:payload(body)}:{})});
}
async function invoke(fn,env,path,options={}){
 const res=await fn({env,request:makeRequest(path,options)});
 return {status:res.status,data:await res.json()};
}
test('one real authenticated session: opt-in AI, D1 version save/load/owner isolation/delete, logout',async()=>{
 const {d1,sqlite}=createD1();
 const env={
  HHBA_PNVS_AUTH_DB:d1,HHBA_AUTH_ROLLOUT:'preview',
  HHBA_RESUME_OPTIMIZATION_ENABLED:'1',
  HHBA_RESUME_VERSION_STORAGE_ENABLED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'only-an-isolated-test-pepper-never-for-production-123',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-provider-key-never-published',
  HHBA_AI_DEEPSEEK_MODEL:'deepseek-flash'
 };
 const username='SyntheticQA1',password='SyntheticTest123!';
 const phone='19900000001',otherPhone='19900000002';
 const now=Date.now();
 const originalFetch=globalThis.fetch;
 try{
  await createUser(d1,{phone,username,passwordHash:await hashPassword(password),nowMs:now});
  await createUser(d1,{phone:otherPhone,username:'SyntheticQA2',
   passwordHash:await hashPassword('OtherSynthetic123!'),nowMs:now});
  const notSignedIn=await invoke(versions,env,'/api/resume-versions?job_id=qa-job');
  assert.equal(notSignedIn.status,401,'cloud versions require an authenticated bearer');
  const login=await invoke(realAuth,env,'/api/real-auth/login/password',{
   method:'POST',body:{username,password}
  });
  assert.equal(login.status,200,JSON.stringify({status:login.status,error:login.data.error}));
  assert.equal(login.data.ok,true);
  const token=login.data.token;
  assert.match(token,/^[a-f0-9]{64}$/);
  const me=await invoke(realAuth,env,'/api/real-auth/me',{token});
  assert.equal(me.status,200);
  assert.equal(me.data.ok,true);
  assert.equal(me.data.username,username);
  const health=await optimizerStatus({env});
  assert.equal((await health.json()).enabled,true);

  const text='仅供测试：参与虚构门店的客户沟通、运营记录整理。联系 synthetic.qa@example.invalid；电话 19900000000。';
  const blocks=[{id:'source-0',section:'summary',text}];
  const job={title:'门店运营助理',requirements:'运营记录、沟通与流程配合'};
  const originalInput={consent_ai:true,blocks,job};
  const lackOfConsent=await invoke(optimize,env,'/api/resume-optimize',{method:'POST',token,
   body:{...originalInput,consent_ai:false}});
  assert.equal(lackOfConsent.status,400);
  const externalOrigin=await invoke(optimize,env,'/api/resume-optimize',{
   method:'POST',token,body:originalInput,origin:'https://attacker.invalid'});
  assert.equal(externalOrigin.status,403);
  let requests=0;
  globalThis.fetch=async(url,options)=>{
   requests++;
   assert.equal(url,'https://api.deepseek.com/chat/completions');
   assert.equal(options.headers.authorization,'Bearer synthetic-provider-key-never-published');
   assert.equal(options.redirect,'manual');
   const sent=JSON.parse(options.body);
   const raw=JSON.parse(sent.messages.find(m=>m.role==='user').content);
   assert.equal(raw.blocks.length,1);
   assert.match(raw.blocks[0].text,/\[邮箱已脱敏\]/);
   assert.match(raw.blocks[0].text,/\[电话已脱敏\]/);
   assert.doesNotMatch(raw.blocks[0].text,/synthetic\.qa@example\.invalid|19900000000/);
   return Response.json({choices:[{finish_reason:'stop',message:{content:payload({
    suggestions:[{id:'qa-tip',blockId:'source-0',action:'replace',
     original:'模型提供的非完整原文，不可信',
     proposed:'仅供测试：参与虚构门店的运营记录整理与客户沟通工作。',
     rationale:'提升工作描述清晰度',jobRequirement:'门店运营'}
    ]})}}]});
  };
  const generated=await invoke(optimize,env,'/api/resume-optimize',{
   method:'POST',token,body:originalInput});
  assert.equal(generated.status,200,JSON.stringify({status:generated.status,error:generated.data.error}));
  assert.equal(generated.data.suggestions.length,1);
  const tip=generated.data.suggestions[0];
  assert.equal(tip.original,text,'user original is always authoritative');
  assert.equal(tip.evidenceStatus,'needs_user_confirmation');
  assert.equal(requests,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM hhba_resume_optimization_requests').get().n,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM hhba_resume_optimization_attempts').get().n,1);

  const savedBody={
   job_id:'qa-synthetic-job',job_title:'门店运营助理',company:'虚构测试公司',
   blocks:[{...blocks[0],text:tip.proposed}],
   accepted_ids:[tip.id],confirmed_real:true
  };
  const saved=await invoke(versions,env,'/api/resume-versions',{method:'POST',token,body:savedBody});
  assert.equal(saved.status,201,JSON.stringify({status:saved.status,error:saved.data.error}));
  const itemId=saved.data.id;
  assert.match(itemId,/^[a-f0-9-]{36}$/i);
  const read=await invoke(versions,env,'/api/resume-versions?job_id=qa-synthetic-job',{token});
  assert.equal(read.status,200);
  assert.equal(read.data.items.length,1);
  assert.equal(read.data.items[0].version.blocks[0].text,tip.proposed);
  assert.deepEqual(read.data.items[0].version.acceptedSuggestionIds,[tip.id]);

  const otherToken=await createSession(d1,otherPhone,now);
  const otherRead=await invoke(versions,env,'/api/resume-versions?job_id=qa-synthetic-job',{token:otherToken});
  assert.equal(otherRead.status,200);
  assert.equal(otherRead.data.items.length,0);
  const otherDelete=await invoke(versions,env,'/api/resume-versions?id='+itemId,{method:'DELETE',token:otherToken});
  assert.equal(otherDelete.status,404,'another user must not delete owner records');
  const ownerStillHas=await invoke(versions,env,'/api/resume-versions?job_id=qa-synthetic-job',{token});
  assert.equal(ownerStillHas.data.items.length,1);
  const deleted=await invoke(versions,env,'/api/resume-versions?id='+itemId,{method:'DELETE',token});
  assert.equal(deleted.status,200);
  assert.equal(deleted.data.deleted,true);
  const empty=await invoke(versions,env,'/api/resume-versions?job_id=qa-synthetic-job',{token});
  assert.equal(empty.data.items.length,0);

  // No usable model suggestion is a failed generation but still a paid attempt.
  globalThis.fetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'{"suggestions":[]}'}}]});
  const noChange=await invoke(optimize,env,'/api/resume-optimize',{method:'POST',token,body:originalInput});
  assert.equal(noChange.status,200);
  assert.deepEqual(noChange.data.suggestions,[]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM hhba_resume_optimization_requests').get().n,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM hhba_resume_optimization_attempts').get().n,2);

  const logout=await invoke(realAuth,env,'/api/real-auth/logout',{method:'POST',token,body:{}});
  assert.equal(logout.status,200);
  const afterLogout=await invoke(versions,env,'/api/resume-versions?job_id=qa-synthetic-job',{token});
  assert.equal(afterLogout.status,401);
  console.log('AUTHENTICATED_RESUME_SQLITE_E2E_PASS '+JSON.stringify({
   authenticated:true,ai_redacted:true,real_handlers:true,sqlite_queries:true,
   save_load_delete:true,cross_user_isolated:true,revocation_checked:true,
   successful_quota:1,attempt_quota:2,external_model_called:false
  }));
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
