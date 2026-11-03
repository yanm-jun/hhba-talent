import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/api/resumes/[[path]].js';
import {validateResumeBytes,normalizeResumeName,ResumeValidationError} from '../functions/_lib/private-resume-validation.js';

const URL_BASE='https://hhba.work/api/resumes',PHONE_A='13800138000',PHONE_B='13900139000';
const token=phone=>'test-resume-'+phone;
const sha=s=>createHash('sha256').update(s).digest('hex');
const PDF=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n');
const docxMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function createDocx(names=['[Content_Types].xml','word/document.xml']){
 const locals=[],centrals=[];let offset=0;
 for(const name of names){
  const filename=Buffer.from(name,'utf8'),data=Buffer.from('<xml>safe content</xml>');
  const local=Buffer.alloc(30+filename.length+data.length);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(filename.length,26);filename.copy(local,30);data.copy(local,30+filename.length);
  const central=Buffer.alloc(46+filename.length);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
  central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  filename.copy(central,46);locals.push(local);centrals.push(central);offset+=local.length;
 }
 const centralBytes=Buffer.concat(centrals),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);
 end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,centralBytes,end]);
}
function fixture(){
 const users=new Map([[PHONE_A,{phone:PHONE_A,role:'candidate'}],[PHONE_B,{phone:PHONE_B,role:'candidate'}]]);
 const sessions=new Map([...users.keys()].map(p=>[sha(token(p)),{
  phone:p,revoked:0,expires_at:new Date(Date.now()+3600000).toISOString()
 }]));
 const resumes=new Map(),events=[];
 const objects=new Map();
 const bucket={
  async put(key,bytes){objects.set(key,Buffer.from(bytes));},
  async get(key){const bytes=objects.get(key);return bytes?{body:new Blob([bytes]).stream()}:null;},
  async delete(key){objects.delete(key);}
 };
 const db={prepare(sql){return {bind(...args){return {
  async first(){
   if(sql.startsWith('SELECT * FROM hhba_auth_sessions'))return sessions.get(args[0])||null;
   if(sql.startsWith('SELECT * FROM hhba_auth_users'))return users.get(args[0])||null;
   if(sql.includes('SELECT COUNT(*) AS n FROM hhba_candidate_resumes'))return {n:[...resumes.values()].filter(r=>r.phone===args[0]).length};
   if(sql.includes('SELECT COUNT(*) AS n FROM hhba_candidate_resume_upload_events'))return {n:events.filter(e=>e.phone===args[0]&&e.created_at>=args[1]).length};
   if(sql.startsWith('SELECT id FROM hhba_candidate_resumes WHERE phone=? AND sha256=?'))return [...resumes.values()].find(r=>r.phone===args[0]&&r.sha256===args[1])||null;
   if(sql.includes('SELECT id,filename,media_type,size_bytes,storage_key FROM hhba_candidate_resumes'))return [...resumes.values()].find(r=>r.phone===args[0]&&r.id===args[1])||null;
   throw Error('Unexpected SELECT '+sql);
  },
  async all(){
   if(!sql.includes('FROM hhba_candidate_resumes WHERE phone='))throw Error('Unexpected list '+sql);
   return {results:[...resumes.values()].filter(r=>r.phone===args[0]).sort((a,b)=>b.created_at.localeCompare(a.created_at))};
  },
  async run(){
   if(sql.startsWith('UPDATE hhba_auth_sessions SET last_seen_at='))return {success:true,meta:{changes:1}};
   if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_resumes')){
    const [id,phone,key,filename,mime,size,hash,consent,consentAt,createdAt,,limit]=args;
    if([...resumes.values()].filter(r=>r.phone===phone).length>=limit||
      [...resumes.values()].some(r=>r.phone===phone&&r.sha256===hash))
      return {success:true,meta:{changes:0}};
    resumes.set(id,{id,phone,storage_key:key,filename,media_type:mime,size_bytes:size,
      sha256:hash,storage_consent_version:consent,storage_consent_at:consentAt,created_at:createdAt});
    return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('INSERT INTO hhba_candidate_resume_upload_events')){
    events.push({phone:args[0],created_at:args[1]});return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('DELETE FROM hhba_candidate_resumes')){
    const row=resumes.get(args[1]);
    if(row?.phone===args[0])resumes.delete(args[1]);
    return {success:true,meta:{changes:row?.phone===args[0]?1:0}};
   }
   throw Error('Unexpected RUN '+sql);
  }
 };}}}};
 return {db,bucket,objects,resumes,events};
}
async function invoke(f,path,phone,method='GET',body=null,opts={}){
 const headers={
  ...(phone?{Authorization:'Bearer '+token(phone)}:{}),
  ...(method!=='GET'?{Origin:opts.origin||'https://hhba.work'}:{}),
  ...(body?{'Content-Type':opts.mime||'application/pdf',
   'X-HHBA-Resume-Name':encodeURIComponent(opts.filename||'我的简历.pdf'),
   'X-HHBA-Storage-Consent':opts.consent===false?'': 'private-resume-storage-v1'}:{})
 };
 const response=await onRequest({request:new Request(URL_BASE+path,{
  method,headers,body:body||undefined,
 }),env:{HHBA_PNVS_AUTH_DB:f.db,...(opts.noR2?{}:{HHBA_PRIVATE_RESUMES:f.bucket})}});
 const type=response.headers.get('Content-Type')||'';
 const payload=type.includes('json')?await response.json():null;
 return {response,payload};
}
test('anonymous, forged and missing-storage calls fail closed',async()=>{
 const f=fixture();
 assert.equal((await invoke(f,'',null)).response.status,401);
 assert.equal((await invoke(f,'','bad-session')).response.status,401);
 const r=await invoke(f,'',PHONE_A,'GET',null,{noR2:true});
 assert.equal(r.response.status,503);
 assert.equal(r.payload.error,'PRIVATE_STORAGE_NOT_ENABLED');
 assert.equal(f.objects.size,0);
});
test('private PDF upload and attachment download are bound to the verified owner',async()=>{
 const f=fixture();
 const a=await invoke(f,'',PHONE_A,'POST',PDF);
 assert.equal(a.response.status,201);
 assert.equal(a.payload.item.size,PDF.length);
 assert.equal(a.payload.item.name,'我的简历.pdf');
 assert.equal(f.objects.size,1);
 const key=[...f.objects.keys()][0];
 assert.doesNotMatch(key,/13800138000/);
 assert.equal(f.resumes.values().next().value.sha256,sha(PDF));
 const id=a.payload.item.id;
 const view=await invoke(f,'',PHONE_A);
 assert.equal(view.payload.items.length,1);
 assert.equal(view.payload.items[0].id,id);
 assert.equal((await invoke(f,'',PHONE_B)).payload.items.length,0);
 assert.equal((await invoke(f,'/'+id+'/download',PHONE_B)).response.status,404);
 const down=await invoke(f,'/'+id+'/download',PHONE_A);
 assert.equal(down.response.status,200);
 assert.equal(down.response.headers.get('Content-Type'),'application/octet-stream');
 assert.match(down.response.headers.get('Content-Disposition'),/^attachment;/);
 assert.equal(down.response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(Buffer.from(await down.response.arrayBuffer()).toString(),PDF.toString());
 assert.equal((await invoke(f,'/'+id,PHONE_B,'DELETE')).response.status,404);
 assert.equal(f.objects.size,1);
 assert.equal((await invoke(f,'/'+id,PHONE_A,'DELETE')).response.status,200);
 assert.equal(f.objects.size,0);
 assert.equal((await invoke(f,'',PHONE_A)).payload.items.length,0);
});
test('explicit storage consent, same-origin and actual file format are required',async()=>{
 const f=fixture();
 assert.equal((await invoke(f,'',PHONE_A,'POST',PDF,{consent:false})).payload.error,'STORAGE_CONSENT_REQUIRED');
 assert.equal((await invoke(f,'',PHONE_A,'POST',PDF,{origin:'https://evil.example'})).response.status,403);
 assert.equal((await invoke(f,'',PHONE_A,'POST',PDF,{filename:'../../secret.pdf'})).response.status,400);
 assert.equal((await invoke(f,'',PHONE_A,'POST',Buffer.alloc(48,5))).response.status,400);
 assert.equal((await invoke(f,'',PHONE_A,'POST',PDF,{mime:docxMime})).response.status,415);
 assert.equal((await invoke(f,'',PHONE_A,'POST',Buffer.alloc(3*1024*1024+1,5))).response.status,413);
 assert.equal(f.objects.size,0);
 assert.equal(f.resumes.size,0);
});
test('valid document container passes; macros and zip bombs are rejected',()=>{
 const docx=createDocx();
 assert.deepEqual(validateResumeBytes(new Uint8Array(docx),'sample.docx'),{
  mime:docxMime,ext:'docx',size:docx.length
 });
 for(const names of [
  ['[Content_Types].xml','word/document.xml','word/vbaProject.bin'],
  ['[Content_Types].xml','word/document.xml','word/activeX/a.xml'],
  ['[Content_Types].xml','word/document.xml','../../escape.xml']
 ]){
  assert.throws(()=>validateResumeBytes(new Uint8Array(createDocx(names)),'sample.docx'),
   e=>e instanceof ResumeValidationError&&e.code==='UNSAFE_DOCX_CONTENT');
 }
 assert.throws(()=>validateResumeBytes(new Uint8Array(Buffer.alloc(150,0)),'fake.docx'),
  e=>e.code==='INVALID_DOCX_CONTAINER');
 assert.equal(normalizeResumeName(encodeURIComponent('个人简历.docx')),'个人简历.docx');
});
test('duplicate and quota protection cannot be bypassed by changing file names',async()=>{
 const f=fixture();
 assert.equal((await invoke(f,'',PHONE_A,'POST',PDF)).response.status,201);
 const duplicate=await invoke(f,'',PHONE_A,'POST',PDF,{filename:'other.pdf'});
 assert.equal(duplicate.response.status,409);
 assert.equal(f.objects.size,1);
 for(let i=0;i<2;i++){
  const unique=Buffer.from(PDF.toString().replace('startxref','startxref'+i));
  assert.equal((await invoke(f,'',PHONE_A,'POST',unique,{filename:'more'+i+'.pdf'})).response.status,201);
 }
 const another=Buffer.from(PDF.toString().replace('startxref','startxref3'));
 assert.equal((await invoke(f,'',PHONE_A,'POST',another,{filename:'four.pdf'})).response.status,409);
 assert.equal(f.objects.size,3);
 assert.equal((await invoke(f,'',PHONE_B)).payload.items.length,0);
});
test('daily upload ledger persists after file removal',async()=>{
 const f=fixture();
 for(let i=0;i<15;i++)f.events.push({phone:PHONE_A,created_at:new Date().toISOString()});
 const r=await invoke(f,'',PHONE_A,'POST',PDF);
 assert.equal(r.response.status,429);
 assert.equal(r.payload.error,'UPLOAD_RATE_LIMITED');
 assert.equal(f.objects.size,0);
});
test('UI never publishes resume objects or automatically invokes DeepSeek',()=>{
 const api=readFileSync(new URL('../src/services/privateResumes.ts',import.meta.url),'utf8');
 const vault=readFileSync(new URL('../src/components/PrivateResumeVault.tsx',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/PersonalCenterPage.tsx',import.meta.url),'utf8');
 assert.match(api,/Authorization:'Bearer '/);
 assert.match(api,/private-resume-storage-v1/);
 assert.match(vault,/checked=\{consent\}/);
 assert.match(vault,/!file\|\|!consent\|\|busy/);
 assert.match(vault,/上传不等于授权 DeepSeek 分析/);
 assert.match(vault,/Cloudflare R2 亚太区（APAC）/);
 assert.match(vault,/中国大陆境外/);
 assert.match(page,/current==='resume'&&<PrivateResumeVault\/>/);
 assert.doesNotMatch(api,/DeepSeek|matchResume|externalApi/);
 const schema=readFileSync(new URL('../d1/0007_private_resumes.sql',import.meta.url),'utf8');
 assert.match(schema,/REFERENCES hhba_auth_users\(phone\)/);
 assert.match(schema,/UNIQUE\(phone,sha256\)/);
 assert.doesNotMatch(schema,/\bDROP\b|\bDELETE FROM hhba_auth_users/i);
});
