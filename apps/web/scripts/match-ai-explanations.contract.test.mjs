import test from 'node:test';
import assert from 'node:assert/strict';
import {attachGroundedRecommendationReasons,explainRecommendedJobsWithDeepSeek}
 from '../functions/_lib/match-ai-explanations.js';
import {sanitizedJobIntent} from '../functions/_lib/domestic-search-fetch.js';

const resume='我在 HHBA 项目负责 AI Agent 任务流程设计、产品原型与测试验收，并建立了任务管理后台。';
const job={
 id:'real-001',company:'示例公司',title:'AI产品经理',location:'济南',
 candidate_evidence:{requirement:'岗位职责：参与 AI Agent 产品原型设计、需求梳理和版本验收。'},
 matched:['岗位名称与简历的求职方向存在明确或可迁移的职业关联']
};
const reason={id:job.id,resume_quote:'AI Agent 任务流程设计',
 job_quote:'AI Agent 产品原型设计',
 reason:'你在 HHBA 项目参与了 AI Agent 任务流程设计，和这个岗位的 Agent 产品原型工作紧密相关，可以重点介绍你的任务流程与测试验收实践。'};

test('AI 产品类简历方向被识别为岗位搜索意图',()=>{
 assert.equal(sanitizedJobIntent('AI 产品'),'AI 产品经理');
 assert.equal(sanitizedJobIntent('AI Agent 产品经理'),'AI 产品经理');
 assert.equal(sanitizedJobIntent('产品经理'),'产品经理');
 assert.equal(sanitizedJobIntent('user@example.com'),null);
});
test('matched reason must quote both actual resume and supplied job evidence',()=>{
 const result=attachGroundedRecommendationReasons([job],{reasons:[reason]},resume);
 assert.equal(result[0].recommendation_reason,reason.reason);
 assert.equal(result[0].id,job.id);
 const invented=attachGroundedRecommendationReasons([job],{reasons:[{
  ...reason,resume_quote:'曾独立训练大型语言模型'
 }]},resume);
 assert.notEqual(invented[0].recommendation_reason,reason.reason);
 const fabricatedJD=attachGroundedRecommendationReasons([job],{reasons:[{
  ...reason,job_quote:'十年高级算法研发经验'
 }]},resume);
 assert.notEqual(fabricatedJD[0].recommendation_reason,reason.reason);
 const promise=attachGroundedRecommendationReasons([job],{reasons:[{
  ...reason,reason:'你一定录用！'
 }]},resume);
 assert.notEqual(promise[0].recommendation_reason,'你一定录用！');
});
test('DeepSeek reason generation is one server-only batch and safely falls back',async()=>{
 let called=0;
 const fake=async(url,request)=>{
  called++;
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(request.method,'POST');
  const body=JSON.parse(request.body);
  assert.equal(body.messages[1].role,'user');
  assert.equal(body.messages[1].content.includes('示例公司'),true);
  assert.equal(body.messages[1].content.includes('HHBA'),true);
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reasons:[reason]})}}]}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 };
 const result=await explainRecommendedJobsWithDeepSeek('demo-key-more-than-16-chars',resume,[job],{fetcher:fake});
 assert.equal(called,1);
 assert.equal(result[0].recommendation_reason,reason.reason);
 const failure=await explainRecommendedJobsWithDeepSeek('demo-key-more-than-16-chars',resume,[job],{
  fetcher:async()=>{throw Error('network error');}
 });
 assert.equal(failure.length,1);
 assert.ok(failure[0].recommendation_reason.length>0);
});
test('Top 10 UI exposes each safe official link independently of detail navigation',async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../src/components/CandidateMatchResultDialog.tsx',import.meta.url),'utf8');
 assert.match(src,/recommendation_reason/);
 assert.match(src,/href=\{link\}/);
 assert.match(src,/直接查看招聘岗位/);
 assert.match(src,/data-hhba-recruitment-outbound/);
 assert.match(src,/onClick=\{onOpen\}/);
 const backend=await readFile(new URL('../functions/api/match/[[path]].js',import.meta.url),'utf8');
 assert.match(backend,/explainRecommendedJobsWithDeepSeek/);
 assert.match(backend,/matches:explained/);
});
