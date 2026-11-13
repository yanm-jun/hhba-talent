// Full synthetic request: Cloudflare Pages route, real-auth contract, D1 privacy caches,
// source-audited official jobs, free-only AI, and subsequent zero-inference reuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/match-native/[[path]].js';
const origin='https://hhba.example';
const resumeId='12345678-1234-4123-8123-123456789012';
function harness({stale=false}={}){
 const iso=new Date().toISOString();
 const earlier='2020-01-01T00:00:00.000Z';
 const phone='13800000000',jobs=[{
  id:'ashby-acme-a1b2c3d4',company:'Acme Data',title:'Data Analyst',
  location:'Shanghai, China',url:'https://jobs.ashbyhq.com/acme/a1b2c3d4',
  source:'acme',platform:'ashby',remote:false
 }];
 const snapshot={updated:stale?earlier:iso,jobs,total:1};
 const audit={summary:{
  kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',
  indexed_as_of:snapshot.updated,checked_at:iso
 },jobs:[{job_id:jobs[0].id,platform:'ashby',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
  full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'synthetic-jd-hash'}]};
 const facets={indexed_as_of:snapshot.updated,verified_at:iso,
  jobs:[{id:jobs[0].id,original_source_hash:'synthetic-jd-hash',
   countryCode:'CN',skills:['python'],education:null,experienceMinYears:0}]};
 const assets={'/data/jobs.json':snapshot,'/data/job-sync-status.json':audit,'/data/job-search-facets.json':facets};
 const profileCache=new Map(),recommendCache=new Map(),requests=[],budget=[];
 const used={ai:0,asset:0};
 const db={prepare(sql){
  return {async all(){
   if(sql.includes('sqlite_master'))return {results:['hhba_candidate_resume_profiles','hhba_free_ai_provider_calls','hhba_candidate_free_match_cache'].map(name=>({name}))};
   throw Error('Unexpected unbound D1 all: '+sql);
  },bind(...a){return {
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {phone,revoked:0,expires_at:new Date(Date.now()+600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone,role:'candidate'};
    if(sql.startsWith('SELECT id,sha256 FROM hhba_candidate_resumes'))return a[0]===resumeId&&a[1]===phone?{id:resumeId,sha256:'a'.repeat(64)}:null;
    if(sql.startsWith('SELECT state,result_json,file_sha256'))return recommendCache.get(a[0])||null;
    if(sql.startsWith('SELECT file_sha256,schema_version'))return profileCache.get(a[0])||null;
    throw Error('Unexpected D1 first: '+sql);
   },
   async all(){
    if(sql.includes('sqlite_master'))return {results:['hhba_candidate_resume_profiles','hhba_free_ai_provider_calls','hhba_candidate_free_match_cache'].map(name=>({name}))};
    throw Error('Unexpected D1 all: '+sql);
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_free_match_cache')){
     if(recommendCache.has(a[0]))return {success:true,meta:{changes:0}};
     recommendCache.set(a[0],{phone:a[1],resume_id:a[2],file_sha256:a[3],snapshot_version:a[4],
      state:'RUNNING',result_json:null,attempt_id:a[5],lease_until:a[6],expires_at:a[7]});
     return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE hhba_candidate_free_match_cache SET state=')){
     const row=recommendCache.get(a[1]);
     if(!row||row.phone!==a[2]||row.attempt_id!==a[3])return {success:true,meta:{changes:0}};
     row.state='READY';row.result_json=a[0];return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM hhba_candidate_free_match_cache')){
     const row=recommendCache.get(a[0]);
     if(row?.attempt_id===a[2]&&row.state==='RUNNING')recommendCache.delete(a[0]);
     return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE hhba_candidate_free_match_cache SET state')){
     throw Error('Unexpected cache update');
    }
    if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_resume_profiles')){
     if(profileCache.has(a[0]))return {success:true,meta:{changes:0}};
     profileCache.set(a[0],{phone:a[1],file_sha256:a[2],schema_version:a[3],
      state:'RUNNING',profile_json:null,attempt_id:a[4],lease_until:a[5]});
     return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO hhba_resume_profile_ai_calls')){
     requests.push(a[0]);return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO hhba_free_ai_provider_calls')){
     const v=budget.filter(x=>x.provider===a[3]).reduce((sum,x)=>sum+x.units,0);
     if(v+a[4]>7200)return {success:true,meta:{changes:0}};
     budget.push({provider:a[3],units:a[4]});return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE hhba_candidate_resume_profiles SET state='READY'")){
     const row=profileCache.get(a[2]);
     if(!row||row.phone!==a[3]||row.attempt_id!==a[4])return {success:true,meta:{changes:0}};
     row.state='READY';row.profile_json=a[0];return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM hhba_candidate_resume_profiles')){
     profileCache.delete(a[0]);return {success:true,meta:{changes:1}};
    }
    throw Error('Unexpected D1 run: '+sql);
   }
  }}}}};
 const env={
  HHBA_ZERO_PAID_AI_ENFORCED:'1',HHBA_FREE_MATCH_ENABLED:'1',
  HHBA_FREE_RESUME_PARSE_ENABLED:'1',
  HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'synthetic-test-pepper-at-least-24-chars',
  HHBA_PNVS_AUTH_DB:db,
  ASSETS:{async fetch(r){
   used.asset++;
   const content=assets[new URL(r.url).pathname];
   return content?Response.json(content):new Response('missing',{status:404});
  }},
  AI:{async run(model,payload){
   assert.equal(model,'@cf/zai-org/glm-4.7-flash');
   used.ai++;
   assert.ok(payload.messages.length>=2);
   if(payload.messages[0].content.includes('简历结构化信息提取器')){
    assert.doesNotMatch(payload.messages[1].content,/13812345678/);
    return {response:JSON.stringify({
     education:'BACHELOR',education_evidence:'学历本科',
     experience_years:3,experience_evidence:'3年工作经验',
     skills:[{name:'Python',evidence:'Python数据处理'}],
     target_roles:['Data Analyst'],
     highlights:['负责Python数据处理及销售数据分析项目管理工作']
    })};
   }
   return {choices:[{message:{content:JSON.stringify({
    ranked:[{id:'fake-invented-company'},{id:'ashby-acme-a1b2c3d4'}]
   })}}]};
  }}
 };
 const cv='学历本科，3年工作经验，技能Python数据处理，求职方向Data Analyst。负责Python数据处理及销售数据分析项目管理工作。电话13812345678。';
 function req({text=cv,id=resumeId,consent=true,role='Data Analyst',originHeader=origin}={}){
  return new Request(origin+'/api/match-native/resume',{method:'POST',headers:{
   'Origin':originHeader,'Authorization':'Bearer test-session',
   'Content-Type':'application/json','Accept':'application/json'
  },body:JSON.stringify({resume_id:id,text,consent,options:{
   country:'CN',remote_only:false,role_hint:role,limit:10
  }})});
 }
 return {env,req,used,profileCache,recommendCache,budget,requests};
}
test('first authenticated resume parses once + free ranks once; subsequent saved match calls ZERO AI',async()=>{
 const h=harness();
 const health=await onRequest({request:new Request(origin+'/api/match-native/status'),env:h.env});
 assert.equal(health.status,200);
 assert.equal((await health.json()).enabled,true);
 const first=await onRequest({request:h.req(),env:h.env});
 assert.equal(first.status,200);
 const body=await first.json();
 assert.equal(body.status,'COMPLETE');
 assert.equal(body.resume_profile_source,'NEW');
 assert.equal(body.matches.length,1);
 assert.equal(body.matches[0].id,'ashby-acme-a1b2c3d4');
 assert.equal(h.used.ai,2);
 assert.equal(h.budget.length,2);
 assert.equal(h.profileCache.size,1);
 assert.equal(h.recommendCache.size,1);
 assert.doesNotMatch(JSON.stringify(h.profileCache.values().next().value),/13812345678/);
 const second=await onRequest({request:h.req({text:''}),env:h.env});
 assert.equal(second.status,200);
 const repeat=await second.json();
 assert.equal(repeat.recommendation_cache_source,'CACHED');
 assert.equal(h.used.ai,2);
 assert.equal(h.budget.length,2);
});
test('unauthorized source, invalid consent and stale job audit reject before any free AI',async()=>{
 const h=harness();
 const badOrigin=await onRequest({request:h.req({originHeader:'https://evil.example'}),env:h.env});
 assert.equal(badOrigin.status,403);
 const noConsent=await onRequest({request:h.req({consent:false}),env:h.env});
 assert.equal(noConsent.status,400);
 const wrongResume=await onRequest({request:h.req({id:'99999999-9999-4999-8999-999999999999'}),env:h.env});
 assert.equal(wrongResume.status,404);
 assert.equal(h.used.ai,0);
 const expired=harness({stale:true});
 const r=await onRequest({request:expired.req(),env:expired.env});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'OFFICIAL_JOB_INDEX_UNAVAILABLE');
 assert.equal(expired.used.ai,0);
});
