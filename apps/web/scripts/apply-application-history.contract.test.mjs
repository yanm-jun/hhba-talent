import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {normalizeJobUrl,validateApplication,saveApplication,listApplications,deleteApplication} from '../functions/_lib/apply-application-history.js';
import {onRequest} from '../functions/api/apply/[[path]].js';
import {sha256Hex} from '../functions/_lib/real-auth.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const PHONE='13900001111',OTHER='13900002222';
const SITE_TOKEN='test-web-session-token';
const EXT_TOKEN='hhbaext_'+'d'.repeat(64);
const EDGE_ID='abcdefghijklmnopabcdefghijklmnop';
const DOMAIN='https://hhba-test.invalid';
const BASE={company:'示例集团',position:'校招产品实习生',applicationUrl:'https://jobs.example.org/roles/123?gh_jid=5678&auth=never-share#secret',status:'pending',evidenceKind:'none'};
function fakeDb(){
 const rows=new Map(),users=new Map([[PHONE,{phone:PHONE,role:'candidate'}],[OTHER,{phone:OTHER,role:'candidate'}]]);
 const sessions=new Map(),extensions=new Map();
 let walletTouched=false;
 return {rows,users,sessions,extensions,get walletTouched(){return walletTouched},db:{prepare(sql){
  let args=[];
  const q={bind(...values){args=values;return q},async first(){
   if(sql.startsWith('SELECT * FROM hhba_auth_sessions'))return sessions.get(args[0])||null;
   if(sql.startsWith('SELECT * FROM hhba_auth_users'))return users.get(args[0])||null;
   if(sql.startsWith('SELECT phone,extension_id,expires_at,revoked_at'))return extensions.get(args[0])||null;
   if(sql.startsWith('SELECT id,status FROM hhba_candidate_applications'))return rows.get(args[0]+'|'+args[1])||null;
   if(sql.startsWith('SELECT COUNT(*) AS n FROM hhba_candidate_applications'))return {n:[...rows.values()].filter(r=>r.phone===args[0]).length};
   if(sql.startsWith('SELECT id,company,position,application_url AS applicationUrl'))return [...rows.values()].find(r=>r.phone===args[0]&&r.job_key===args[1])||null;
   throw Error('Unhandled first '+sql);
  },async all(){
   if(sql.startsWith('SELECT id,company,position,application_url AS applicationUrl')){
    return {results:[...rows.values()].filter(r=>r.phone===args[0]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};
   }
   throw Error('Unhandled all '+sql);
  },async run(){
   if(sql.startsWith('UPDATE hhba_auth_sessions SET last_seen_at')||sql.startsWith('UPDATE hhba_apply_extension_sessions SET last_seen_at'))return {success:true,meta:{changes:1}};
   if(sql.startsWith('INSERT INTO hhba_candidate_applications')){
    const [id,phone,job_key,company,position,applicationUrl,status,source,evidenceKind,recordedAt,updatedAt]=args;
    const old=rows.get(phone+'|'+job_key);
    const preserve=old?.status==='confirmed';
    const rec={id:old?.id||id,phone,job_key,company,position,applicationUrl,
     status:preserve?'confirmed':status,source:preserve?old.source:source,
     evidenceKind:preserve?old.evidenceKind:evidenceKind,
     recordedAt:old?.recordedAt||recordedAt,updatedAt};
    rows.set(phone+'|'+job_key,rec);return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('DELETE FROM hhba_candidate_applications')){
    const key=[...rows.keys()].find(k=>rows.get(k).phone===args[0]&&rows.get(k).id===args[1]);
    if(key)rows.delete(key);
    return {success:true,meta:{changes:key?1:0}};
   }
   if(/hhba_apply_orders|hhba_apply_tasks/.test(sql)){walletTouched=true;throw Error('Applications must not touch payment');}
   throw Error('Unhandled run '+sql);
  }};
  return q;
 }}};
}
test('canonical URL drops query secrets, keeps only job identifiers, blocks fake or internal URLs',()=>{
 assert.equal(normalizeJobUrl(BASE.applicationUrl),'https://jobs.example.org/roles/123?gh_jid=5678');
 for(const bad of ['http://jobs.example.org','https://localhost/jobs','https://127.0.0.1/jobs','https://jobs.example.org:8443/apply',
  'javascript:alert(1)','https://attacker:secret@jobs.example.org/','https://intranet.local/jobs']){
  assert.equal(normalizeJobUrl(bad),null,bad);
 }
});
test('cannot forge verified state from website/manual or without visible success evidence',()=>{
 assert.equal(validateApplication({...BASE,status:'confirmed',evidenceKind:'success_notice'}),null);
 assert.equal(validateApplication({...BASE,status:'confirmed',evidenceKind:'none'},{extension:true}),null);
 assert.equal(validateApplication({...BASE,status:'manual',evidenceKind:'self_report'},{extension:true}),null);
 assert.equal(validateApplication({...BASE,status:'manual',evidenceKind:'self_report'}).source,'manual');
 assert.equal(validateApplication({...BASE,status:'confirmed',evidenceKind:'success_notice'},{extension:true}).source,'edge');
});
test('save, dedupe, never downgrade confirmed, account isolation, delete and no credit writes',async()=>{
 const f=fakeDb(),db=f.db;
 let a=await saveApplication(db,PHONE,BASE,true);
 assert.equal(a.ok,true);
 const first=a.record.id;
 a=await saveApplication(db,PHONE,{...BASE,status:'confirmed',evidenceKind:'success_notice'},true);
 assert.equal(a.record.id,first);assert.equal(a.record.status,'confirmed');
 a=await saveApplication(db,PHONE,BASE,true);
 assert.equal(a.record.status,'confirmed');
 assert.equal(a.record.applicationUrl,'https://jobs.example.org/roles/123?gh_jid=5678');
 assert.equal((await listApplications(db,OTHER)).items.length,0);
 assert.equal((await deleteApplication(db,OTHER,first)).deleted,false);
 assert.equal((await listApplications(db,PHONE)).items.length,1);
 assert.equal((await deleteApplication(db,PHONE,first)).deleted,true);
 assert.equal((await listApplications(db,PHONE)).items.length,0);
 assert.equal(f.walletTouched,false);
});
function req(path,method,token='',origin=DOMAIN,body){
 return new Request(DOMAIN+'/api/apply'+path,{method,
  headers:{Origin:origin,'Sec-Fetch-Site':path.startsWith('/extension/')?'cross-site':'same-origin',
   ...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
}
async function response(env,path,method,token,origin,body){
 const r=await onRequest({env,request:req(path,method,token,origin,body)});
 return {status:r.status,body:await r.json()};
}
test('actual Pages handler enforces website session, exact extension Origin and device token',async()=>{
 const f=fakeDb();
 f.sessions.set(await sha256Hex(SITE_TOKEN),{phone:PHONE,expires_at:new Date(Date.now()+3600000).toISOString(),revoked:0});
 f.extensions.set(await sha256Hex(EXT_TOKEN),{phone:PHONE,extension_id:EDGE_ID,expires_at:new Date(Date.now()+3600000).toISOString(),revoked_at:null});
 const env={HHBA_PNVS_AUTH_DB:f.db,HHBA_APPLY_PAIRING_ENABLED:'1',HHBA_APPLY_EXTENSION_ID:EDGE_ID,HHBA_APPLY_PAIRING_PEPPER:'x'.repeat(40)};
 let r=await response(env,'/applications','GET','',DOMAIN);
 assert.equal(r.status,401);
 r=await response(env,'/applications','POST',SITE_TOKEN,'https://evil.invalid',{...BASE,status:'manual',evidenceKind:'self_report'});
 assert.equal(r.status,403);
 r=await response(env,'/extension/applications/save','POST',EXT_TOKEN,'chrome-extension://'+'a'.repeat(32),{...BASE,status:'confirmed',evidenceKind:'success_notice'});
 assert.equal(r.status,403);
 r=await response(env,'/extension/applications/save','POST',SITE_TOKEN,'chrome-extension://'+EDGE_ID,{...BASE,status:'confirmed',evidenceKind:'success_notice'});
 assert.equal(r.status,401);
 r=await response(env,'/extension/applications/save','POST',EXT_TOKEN,'chrome-extension://'+EDGE_ID,{...BASE,status:'confirmed',evidenceKind:'success_notice'});
 assert.equal(r.status,200,JSON.stringify(r.body));
 const id=r.body.record.id;
 r=await response(env,'/applications','GET',SITE_TOKEN,DOMAIN);
 assert.equal(r.body.items.length,1);
 assert.equal(r.body.items[0].status,'confirmed');
 r=await response(env,'/extension/applications/list','POST',EXT_TOKEN,'chrome-extension://'+EDGE_ID);
 assert.equal(r.body.items.length,1);
 r=await response(env,'/applications/delete','POST',SITE_TOKEN,DOMAIN,{id});
 assert.equal(r.status,200);assert.equal(r.body.deleted,true);
 r=await response(env,'/applications','GET',SITE_TOKEN,DOMAIN);
 assert.equal(r.body.items.length,0);
 assert.equal(f.walletTouched,false);
});
