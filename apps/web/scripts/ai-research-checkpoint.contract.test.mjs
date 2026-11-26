import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAccountResearchCheckpoint,sanitizePublicResearchCheckpoint,resumeFingerprint}
 from '../functions/_lib/ai-research-checkpoint.js';

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
test('legacy migration remains non-destructive and V4 uses the encrypted task checkpoint',()=>{
 const sql=readFileSync(new URL('../d1/0030_ai_research_checkpoints.sql',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_ai_research_checkpoints/);
 assert.match(sql,/REFERENCES hhba_auth_users\(phone\)/);
 assert.ok(!/resume_text|resume_json|raw_cv/i.test(sql));
 assert.match(route,/storeMatchCheckpoint\(env,result\.checkpoint\)/);
 assert.match(route,/claimAiCheckpoint/);
 assert.match(route,/saveMatchTask\(env,input\.taskKey/);
});

test('public source-clue titles survive a safe checkpoint, but failed page reads are retryable',()=>{
 const state=sanitizePublicResearchCheckpoint({pool:[{...valid,fetch_attempted:true}],
  history:[{type:'search',found:1,rejected_title_hints:[
   '美团招聘区域督导经理','https://board.invalid/jobs/1',
   'person@example.com','联系13800138000','汽车渠道督导招聘'
  ]}]});
 assert.equal(state.pool[0].fetch_attempted,false);
 assert.ok(state.history[0].rejected_title_hints.includes('美团招聘区域督导经理'));
 assert.ok(state.history[0].rejected_title_hints.includes('汽车渠道督导招聘'));
 assert.ok(!JSON.stringify(state).includes('board.invalid'));
 assert.ok(!JSON.stringify(state).includes('13800138000'));
 assert.ok(!JSON.stringify(state).includes('person@example.com'));
});
