import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAccountResearchCheckpoint,sanitizePublicResearchCheckpoint,resumeFingerprint}
 from '../functions/_lib/ai-research-checkpoint.js';
import {runAgentOwnedMainlandMatch}
 from '../functions/_lib/ai-owned-job-research.js';

const valid={id:'j1',url:'https://careers.xinghai-cn.com/jobs/channels-2026',
 title:'星海汽车有限公司 渠道督导 上海 招聘',source:'星海汽车有限公司',
 summary:'工作地点上海，负责门店培训和经营改善。联系人13800138000，邮箱 test@job.cn',
 availability:{status:'UNKNOWN'}};
test('checkpoint persists only public URL/role/snippet, drops hidden applicant data and invalid hosts',()=>{
 const state=sanitizePublicResearchCheckpoint({pool:[valid,{
  ...valid,id:'j2',url:'https://www.zhipin.com/job_detail/1'
 }],usedQueries:['星海汽车有限公司 上海 渠道督导 官方招聘'],history:[
  {type:'search',private_resume:'简历全文不应存储',queries:['private CV'],found:1}
 ],resumeText:'我的姓名和手机号',credentials:'secret'});
 assert.equal(state.pool.length,1);
 assert.equal(state.pool[0].url,valid.url);
 assert.ok(!JSON.stringify(state).includes('13800138000'));
 assert.ok(!JSON.stringify(state).includes('test@job.cn'));
 assert.ok(!JSON.stringify(state).includes('简历全文不应存储'));
 assert.ok(!JSON.stringify(state).includes('secret'));
 assert.equal(state.history[0].type,'search');
});
test('account-specific HMAC avoids raw CV hashes and prevents cross-owner checkpoint reuse',async()=>{
 const secret='synthetic-service-secret-with-enough-length';
 const a=await resumeFingerprint(secret,'phone-a','redacted CV','');
 const b=await resumeFingerprint(secret,'phone-b','redacted CV','');
 const c=await resumeFingerprint(secret,'phone-a','different CV','');
 assert.match(a,/^[0-9a-f]{64}$/);
 assert.notEqual(a,b);assert.notEqual(a,c);
 assert.equal(a,await resumeFingerprint(secret,'phone-a','redacted CV',''));
});
test('D1 checkpoint load/save/clear is user-scoped and survives a simulated reconnect',async()=>{
 const rows=new Map(),sql=[];
 const db={prepare(statement){
  return {bind(...params){
   return {
    async run(){
     sql.push(statement);
     if(statement.startsWith('DELETE')&&params.length===1){
      return {success:true,meta:{changes:0}};
     }
     if(statement.startsWith('DELETE')){
      rows.delete(params[0]);return {success:true,meta:{changes:1}};
     }
     if(statement.startsWith('INSERT')){
      rows.set(params[0],{phone:params[1],state_json:params[2],
       expires_at:params[4]});
      return {success:true,meta:{changes:1}};
     }
     throw Error('unexpected D1 write');
    },
    async first(){
     const row=rows.get(params[0]);
     return row&&row.phone===params[1]&&row.expires_at>params[2]?
      {state_json:row.state_json}:null;
    }
   }
  }};
 }};
 const secret='synthetic-service-secret-with-enough-length';
 const owner=await createAccountResearchCheckpoint(db,'owner','redacted CV','',
  secret);
 const other=await createAccountResearchCheckpoint(db,'other','redacted CV','',
  secret);
 assert.equal(await owner.load(),null);
 assert.equal(await owner.save({pool:[valid],usedQueries:['星海 渠道督导 上海 招聘'],
  history:[{type:'search',found:1}]}),true);
 assert.equal((await owner.load()).pool.length,1);
 assert.equal(await other.load(),null);
 await owner.clear();
 assert.equal(await owner.load(),null);
 assert.ok(sql.some(q=>q.includes('ON CONFLICT')));
});
test('Agent resumes public evidence, but replans when the old shortlist is insufficient',async()=>{
 let planned=false,searched=false,selected=[];
 const state=sanitizePublicResearchCheckpoint({pool:[valid],
  usedQueries:['星海汽车有限公司 上海 渠道督导 官方招聘'],
  history:[{type:'search',found:1}],shortlistIds:['j1']});
 const result=await runAgentOwnedMainlandMatch('synthetic','resume','',10,{
  expandDetailed:false,checkpoint:{load:async()=>state,save:async()=>true}
 },{
  plan:async()=>{planned=true;return {queries:['星海汽车 官网招聘 2026 新岗位']};},
  search:async()=>{searched=true;return {hits:[],diagnostic:{successful_searches:1,raw_results:5}};},
  decide:async()=>({actions:[{type:'finish'}],shortlist_ids:['j1']}),
  select:async(k,cv,items)=>{
   selected=items;
   return {matches:[{
    id:'search-j1',company:'星海汽车有限公司',title:'渠道督导',location:'上海',
    official_url:items[0].url,match_score:80,
    recommendation_reason:'根据公开来源和简历的具体岗位分析，企业任职细节需再核对。'
   }]};
  }
 });
 assert.equal(planned,true);
 assert.equal(searched,true);
 assert.equal(result.diagnostic.checkpoint_restored,true);
 assert.equal(result.diagnostic.provider_items,5);
 assert.equal(selected[0].url,valid.url);
 assert.equal(result.matches[0].official_url,valid.url);
});
test('failed Fetch never becomes CLOSED_LISTED without independent closure evidence',async()=>{
 const result=await runAgentOwnedMainlandMatch('synthetic','resume','',10,{
  expandDetailed:false
 },{
  plan:async()=>({queries:['星海汽车 渠道督导 上海 招聘']}),
  search:async()=>({hits:[valid],diagnostic:{successful_searches:1,raw_results:1}}),
  decide:(()=>{let n=0;return async()=>++n===1?
   {actions:[{type:'fetch',candidate_ids:['j1']}]}:
   {actions:[{type:'finish'}]}})(),
  fetchDetails:async()=>({hits:[],fetches:0}),
  select:async(k,cv,items)=>{
   assert.notEqual(items[0]?.availability?.status,'CLOSED_LISTED');
   return {matches:[{id:'search-j1',company:'星海汽车有限公司',title:'渠道督导',
    location:'上海',official_url:valid.url,match_score:null}]};
  }
 });
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,valid.url);
});
test('migration and authenticated API integrate the checkpoint without saving CV text',()=>{
 const sql=readFileSync(new URL('../d1/0030_ai_research_checkpoints.sql',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_ai_research_checkpoints/);
 assert.match(sql,/REFERENCES hhba_auth_users\(phone\)/);
 assert.ok(!/resume_text|resume_json|raw_cv/i.test(sql));
 assert.match(route,/checkpointForCandidate\(env,candidate,redacted,options\.role_hint\)/);
 assert.match(route,/iterateScoredJobEvidence/);
 assert.match(route,/checkpoint\?\.clear\(\)/);
});
