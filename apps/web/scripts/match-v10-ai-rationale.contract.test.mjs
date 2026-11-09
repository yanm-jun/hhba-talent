import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichMatchReasonsWithAI} from '../functions/_lib/match-rationale-ai.js';

const key='dev-mock-only-not-a-real-key';
const quote='参与产业政策研究和政府项目申报，负责跨部门材料协调和政府调研事项跟进。';
const profile={
 work_evidence:[quote],
 target_roles:['政府事务专员'],
 skills:[{name:'政策研究',evidence:'政策研究'}],
 phone:'13800000000',email:'private@example.com',
 raw_resume:'用户简历原始全文，绝不应再次发送'
};
const matches=[{
 id:'job-1',company:'示例单位',title:'政府事务专员',location:'杭州',
 official_url:'https://jobs.ashbyhq.com/example/jobs/job-1',
 reference_score:83,
 why_recommended:{summary:'简历已记录政策相关实践',
  evidence:['简历已记录政策相关实践'],to_check:['岗位状态待官网确认']}
}];
test('AI makes a concrete sentence from an exact work excerpt without sending full CV or PII',async()=>{
 let sent=0;
 const fetcher=async(url,opts)=>{
  sent++;
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(opts.headers.Authorization,'Bearer '+key);
  const payload=JSON.parse(opts.body);
  const onlyData=JSON.stringify(payload.messages[1].content);
  assert.ok(onlyData.includes(quote));
  assert.ok(!onlyData.includes('13800000000'));
  assert.ok(!onlyData.includes('private@example.com'));
  assert.ok(!onlyData.includes('简历原始全文'));
  assert.ok(!onlyData.includes('用户姓名'));
  return Response.json({choices:[{message:{content:JSON.stringify({items:[{
   id:'job-1',selected_index:0,
   connection:'这段政策调研与申报推进实践，能够帮助理解政府事务岗位中的政策跟进与部门协同场景。'
  }]})}}]});
 };
 const result=await enrichMatchReasonsWithAI(matches,profile,key,{fetcher});
 assert.equal(sent,1);
 assert.equal(result[0].reference_score,83);
 assert.equal(result[0].official_url,matches[0].official_url);
 assert.equal(result[0].why_recommended.source,'AI_WITH_VERBATIM_RESUME_EVIDENCE');
 assert.match(result[0].why_recommended.summary,/产业政策研究和政府项目申报/);
 assert.match(result[0].why_recommended.summary,/政策跟进与部门协同/);
});
test('invented leadership or fake numerical achievements cannot overwrite validated reasons',async()=>{
 const fetcher=async()=>Response.json({choices:[{message:{content:JSON.stringify({items:[{
  id:'job-1',selected_index:0,
  connection:'你独立主导了超过200个项目，保证录用成功率。'
 }]})}}]});
 const result=await enrichMatchReasonsWithAI(matches,profile,key,{fetcher});
 assert.deepEqual(result,matches);
});
test('unrelated job has no quoted evidence and never generates a fabricated AI match',async()=>{
 let calls=0;
 const unrelated=[{...matches[0],id:'not-related',title:'高级软件开发工程师'}];
 const output=await enrichMatchReasonsWithAI(unrelated,profile,key,{
  fetcher:async()=>{calls++;throw Error('unexpected')}
 });
 assert.equal(calls,0);
 assert.deepEqual(output,unrelated);
});
test('rate limit/provider failures and malformed response preserve the deterministic explanation',async()=>{
 const failed=await enrichMatchReasonsWithAI(matches,profile,key,{
  fetcher:async()=>Response.json({error:'limited'},{status:429})
 });
 assert.deepEqual(failed,matches);
 const malformed=await enrichMatchReasonsWithAI(matches,profile,key,{
  fetcher:async()=>Response.json({choices:[{message:{content:'no json'}}]})
 });
 assert.deepEqual(malformed,matches);
});
