import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-reassess.js';
const origin='https://preview.hhba.example',id='greenhouse-acme-123';
function setup({active=true,role='candidate',hasTable=true,validIndex=true}={}){
 const date=new Date().toISOString(),ledger=[],assets=[];
 const job={id,platform:'greenhouse',source:'acme',company:'示例企业',
  title:'软件工程师',location:'上海',url:'https://boards.greenhouse.io/acme/jobs/123'};
 const snapshots={
  '/data/jobs.json':{updated:date,jobs:[job]},
  '/data/job-sync-status.json':{summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',
   indexed_as_of:date,checked_at:date},jobs:[{job_id:id,platform:'greenhouse',
    status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',full_original_jd_verified:true,
    requirements_evidence:true,jd_sha256:'hash123'}]},
  '/data/job-search-facets.json':{indexed_as_of:date,verified_at:date,
   jobs:[{id,countryCode:'CN',original_source_hash:validIndex?'hash123':'bad',
    skills:['Python','SQL'],experienceMinYears:0,education:'UNRESTRICTED'}]}
 };
 const db={prepare(sql){return{
  async first(){
   if(sql.includes('sqlite_master'))return hasTable?{name:'hhba_resume_reassess_requests'}:null;
   throw Error('unbound first');
  },
  bind(...args){return{
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {
     phone:'account-1',revoked:0,expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone:'account-1',role};
    throw Error('bound first');
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT INTO hhba_resume_reassess_requests')){
     if(ledger.length>=12)return {success:true,meta:{changes:0}};
     ledger.push(args);return {success:true,meta:{changes:1}};
    }
    throw Error('unknown run');
   }
  }}
 }}};
 const env={
  HHBA_RESUME_REASSESS_ENABLED:active?'1':'0',
  HHBA_AUTH_ROLLOUT:'preview',
  HHBA_MATCH_LIMIT_PEPPER:'pepper-for-testing-at-least-24-characters',
  HHBA_PNVS_AUTH_DB:db,
  ASSETS:{fetch:async req=>{
   const path=new URL(req.url).pathname;assets.push(path);
   return Response.json(snapshots[path]||{}, {headers:{'Content-Type':'application/json'}});
  }}
 };
 const body={
  job_id:id,consent_reassessment:true,confirm_real:true,
  profile:{education:'BACHELOR',experience_years:2,
   target_roles:['软件工程师'],skills:[]},
  before_blocks:[{id:'exp-1',section:'experience',text:'负责软件开发工作'}],
  after_blocks:[{id:'exp-1',section:'experience',text:'使用 Python 开发软件'}]
 };
 function request(data=body,from=origin,auth=true){
  return new Request(origin+'/api/resume-reassess',{method:'POST',headers:{
   Origin:from,...(auth?{Authorization:'Bearer synthetic'}:{})
  },body:JSON.stringify(data)});
 }
 return {env,body,request,ledger,assets};
}
test('feature is off unless explicitly enabled and schema migrated',async()=>{
 const inactive=setup({active:false});
 assert.equal((await (await onRequestGet({env:inactive.env})).json()).enabled,false);
 assert.equal((await onRequestPost({env:inactive.env,request:inactive.request()})).status,503);
 const noTable=setup({hasTable:false});
 assert.equal((await (await onRequestGet({env:noTable.env})).json()).enabled,false);
 assert.equal((await onRequestPost({env:noTable.env,request:noTable.request()})).status,503);
});
test('reject cross-origin, unauthorized role and unconfirmed evidence before any index fetch',async()=>{
 const h=setup();
 assert.equal((await onRequestPost({env:h.env,request:h.request(h.body,'https://other.example')})).status,403);
 assert.equal((await onRequestPost({env:h.env,request:h.request(h.body,origin,false)})).status,401);
 assert.equal((await onRequestPost({env:h.env,request:h.request({...h.body,confirm_real:false})})).status,400);
 assert.equal(h.assets.length,0);assert.equal(h.ledger.length,0);
 const other=setup({role:'employer'});
 assert.equal((await onRequestPost({env:other.env,request:other.request()})).status,403);
});
test('verified JD supports independent before/after V2 scores with no provider key',async()=>{
 const h=setup();
 const response=await onRequestPost({env:h.env,request:h.request()});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.supported,true);
 assert.equal(data.ranking_version,'HHBA_MATCH_RANKING_V2');
 assert.ok(data.updated_score>data.original_score);
 assert.equal(h.assets.length,3);
 assert.equal(h.ledger.length,1);
 assert.equal(h.ledger[0].join(' ').includes('Python'),false);
});
test('unverified job hash returns unsupported rather than made-up scores',async()=>{
 const h=setup({validIndex:false});
 const response=await onRequestPost({env:h.env,request:h.request()});
 assert.equal(response.status,422);
 const data=await response.json();
 assert.equal(data.error,'AUDITED_JOB_NOT_AVAILABLE');
 assert.equal('updated_score' in data,false);
});
