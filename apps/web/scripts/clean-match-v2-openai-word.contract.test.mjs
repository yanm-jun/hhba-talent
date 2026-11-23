import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProvider,generateSuggestions} from '../functions/_lib/resume-ai-provider.js';
import {matchV2Runtime} from '../functions/_lib/clean-match-v2-runtime.js';
import {onRequest as matchNextRoute} from '../functions/api/match-next/[[path]].js';
import {completeJson,auditTargetedResumeSuggestions,generateTailoredResume}
 from '../functions/_lib/resume-rewrite-provider.js';
import {optimizeResumeDocument} from '../functions/_lib/resume-optimization-task.js';
const KEY='synthetic-openai-word-token-not-real';
const CV='负责销售渠道管理和销售数据复盘，参与门店运营监督。';
const JD='岗位职责：负责销售渠道管理和销售数据复盘；任职要求：熟悉销售数据分析。';
const blocks=[{id:'exp-1',section:'experience',text:CV}];
const job={title:'渠道运营专员',requirements:JD,verified:true};
const wordEnv={
 HHBA_AUTH_ROLLOUT:'preview',HHBA_PREVIEW_AI_DIAG_ENABLED:'1',
 HHBA_MATCH_OPENAI_WORD_V2_ENABLED:'1',
 HHBA_MATCH_OPENAI_API_KEY:KEY,HHBA_MATCH_OPENAI_MODEL:'gpt-6.2-astra',
 HHBA_MATCH_DEEPSEEK_KEY:'synthetic-deepseek-key-not-used'
};
const response=obj=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(obj)}]}
]});
function fakeOpenAIFetch(calls=[]){
 const original=globalThis.fetch;
 globalThis.fetch=async (url,options={})=>{
  const request=JSON.parse(options.body||'{}');
  calls.push({url,options,request});
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(request.model,'gpt-6.2-astra');
  assert.equal(request.store,false);
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Authorization,'Bearer '+KEY);
  if(request.instructions.includes('专业简历撰写者'))return response({
   rewrites:[{blockId:'exp-1',text:'负责销售渠道管理和销售数据复盘，参与门店运营监督。',
    sourceQuotes:[CV],rationale:'突出真实销售渠道和复盘经验',jobRequirements:['负责销售渠道管理和销售数据复盘']}],questions:[]
  });
  if(request.instructions.includes('专业简历事实审查员')||
   request.instructions.includes('独立的 HHBA 简历事实审查员'))
   return response({checks:[{blockId:'exp-1',safe:true,concern:''}]});
  if(request.instructions.includes('岗位定向简历内容架构师'))
   return response({focus:['渠道运营'],recommended_order:['exp-1'],questions:[]});
  if(request.instructions.includes('岗位定向 Word 编辑'))
   return response({focus:['渠道管理和销售数据复盘']});
  if(request.instructions.includes('HHBA简历优化助手'))
   return response({suggestions:[{
    blockId:'exp-1',action:'replace',original:CV,
    proposed:'负责销售渠道管理和销售数据复盘，参与门店运营监督。',
    jobRequirement:'负责销售渠道管理和销售数据复盘',
    rationale:'突出渠道运营实绩',evidenceStatus:'needs_user_confirmation'
   }]});
  throw Error('unexpected Word prompt');
 };
 return {restore(){globalThis.fetch=original},calls};
}
test('preview V2 forces official OpenAI only, with no silent DeepSeek fallback',()=>{
 const p=selectProvider(wordEnv,'resume_optimization');
 assert.equal(p.name,'openai');
 assert.equal(p.model,'gpt-6.2-astra');
 assert.equal(p.key,KEY);
 assert.equal(p.v2Responses,true);
 assert.equal(selectProvider(wordEnv,'resume_rewrite').name,'openai');
 assert.equal(selectProvider(wordEnv,'resume_reviewer').name,'openai');
 assert.throws(()=>selectProvider({...wordEnv,HHBA_MATCH_OPENAI_API_KEY:undefined},
  'resume_optimization'),/AI_PROVIDER_NOT_CONFIGURED/);
 const production={...wordEnv,HHBA_AUTH_ROLLOUT:'production'};
 assert.equal(selectProvider(production,'resume_optimization').name,'deepseek',
  'production settings are unchanged by a preview-only flag');
});
test('Word suggestions and independent factual audit use official Responses',async()=>{
 const mock=fakeOpenAIFetch();
 try{
  const result=await generateSuggestions({env:wordEnv,blocks,job,signal:AbortSignal.timeout(10000)});
  assert.equal(result.provider,'openai');
  assert.equal(result.suggestions.length,1);
  assert.equal(result.suggestions[0].original,CV);
  const verified=await auditTargetedResumeSuggestions({env:wordEnv,blocks,job,
   suggestions:result.suggestions,signal:AbortSignal.timeout(10000)});
  assert.equal(verified.length,1);
  assert.ok(mock.calls.length>=2);
  assert.ok(mock.calls.every(call=>!call.request.tools));
 }finally{mock.restore()}
});
test('Whole-document Word optimizer plan, suggestions and independent audit never call DeepSeek',async()=>{
 const mock=fakeOpenAIFetch();
 try{
  const result=await optimizeResumeDocument({env:wordEnv,blocks,context:CV,job,
   signal:AbortSignal.timeout(10000)});
  assert.equal(result.provider,'openai');
  assert.equal(result.suggestions.length,1);
  assert.deepEqual(result.pendingIds,[]);
  assert.ok(mock.calls.length>=3);
  assert.ok(mock.calls.every(x=>x.url==='https://api.openai.com/v1/responses'));
 }finally{mock.restore()}
});
test('Whole-resume writer and independent reviewer use Responses with draft safety gates',async()=>{
 const mock=fakeOpenAIFetch();
 try{
  const result=await generateTailoredResume({env:wordEnv,blocks,job,
   signal:AbortSignal.timeout(10000)});
  assert.equal(result.provider,'openai');
  assert.equal(result.reviewer,'openai');
  assert.equal(result.coverage.source_blocks,1);
  assert.equal(result.blocks[0].status,'needs_user_confirmation');
  assert.ok(mock.calls.length>=3);
 }finally{mock.restore()}
});
test('OpenAI JSON transport does not swallow missing evidence as a valid rewrite',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>response({checks:[{blockId:'exp-1',safe:false,concern:'缺少事实'}]});
 try{
  const got=await completeJson({name:'openai',key:KEY,model:'gpt-6.2-astra',v2Responses:true},
   '审核事实', {blocks},AbortSignal.timeout(10000),2000);
  assert.equal(got.checks[0].safe,false);
 }finally{globalThis.fetch=previous}
});

test('preview V2 Word author and reviewer inherit the approved relay without altering production',async()=>{
 const env={...wordEnv,HHBA_MATCH_OPENAI_BASE_URL:'https://api-c.reqtoken.com/v1',
  HHBA_MATCH_OPENAI_MODEL:'gpt-6.2-sol'};
 const provider=selectProvider(env,'resume_rewrite');
 assert.equal(provider.baseUrl,'https://api-c.reqtoken.com/v1');
 assert.equal(provider.model,'gpt-6.2-sol');
 assert.equal(selectProvider(env,'resume_reviewer').baseUrl,provider.baseUrl);
 const previous=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(url,'https://api-c.reqtoken.com/v1/responses');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'gpt-6.2-sol');
  assert.equal(body.store,false);
  assert.equal(opts.headers.Authorization,'Bearer '+KEY);
  return response({focus:['真实渠道运营工作']});
 };
 try{
  const result=await completeJson(provider,'岗位定向 Word 编辑',{job,blocks},
   AbortSignal.timeout(10000),3000);
  assert.equal(result.focus[0],'真实渠道运营工作');
  assert.equal(calls.length,1);
 }finally{globalThis.fetch=previous}
});

test('compact V2 preview config enables matching and Word without extra cloud variables',async()=>{
 const env={
  HHBA_AUTH_ROLLOUT:'preview',
  HHBA_PREVIEW_AI_DIAG_ENABLED:'1',
  HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_OPENAI_API_KEY:KEY,
  HHBA_PNVS_AUTH_DB:{prepare(){return {}}},
  HHBA_MATCH_V2_RUNTIME:JSON.stringify({
   baseUrl:'https://api-c.reqtoken.com/v1',
   model:'gpt-6.2-sol',matchEnabled:true,wordEnabled:true
  })
 };
 const config=matchV2Runtime(env);
 assert.equal(config.matchEnabled,true);
 assert.equal(config.wordEnabled,true);
 assert.equal(config.model,'gpt-6.2-sol');
 assert.equal(config.baseUrl,'https://api-c.reqtoken.com/v1');
 const writer=selectProvider(env,'resume_rewrite');
 assert.equal(writer.v2Responses,true);
 assert.equal(writer.baseUrl,'https://api-c.reqtoken.com/v1');
 assert.equal(writer.model,'gpt-6.2-sol');
 const response=await matchNextRoute({env,request:new Request(
  'https://compact-preview.hhba-talent.pages.dev/api/match-next/status'
 )});
 const status=await response.json();
 assert.equal(status.enabled,true);
 assert.equal(status.preflight_available,true);
});
test('compact V2 flags cannot enable production, and bad JSON fails closed',()=>{
 const compact=JSON.stringify({matchEnabled:true,wordEnabled:true,
  model:'gpt-6.2-sol',baseUrl:'https://api-c.reqtoken.com/v1'});
 const prod={HHBA_AUTH_ROLLOUT:'production',HHBA_MATCH_V2_RUNTIME:compact,
  HHBA_MATCH_OPENAI_API_KEY:KEY};
 assert.equal(matchV2Runtime(prod).matchEnabled,false);
 assert.equal(matchV2Runtime(prod).wordEnabled,false);
 assert.equal(selectProvider(prod,'resume_rewrite').name,'deepseek');
 assert.equal(matchV2Runtime({HHBA_AUTH_ROLLOUT:'preview',
  HHBA_PREVIEW_AI_DIAG_ENABLED:'1',HHBA_MATCH_V2_RUNTIME:'{bad-json'}).matchEnabled,false);
 // Explicit previous env variables retain backward compatibility.
 assert.equal(matchV2Runtime({HHBA_MATCH_OPENAI_MODEL:'older-model',
  HHBA_MATCH_V2_RUNTIME:compact}).model,'older-model');
});
