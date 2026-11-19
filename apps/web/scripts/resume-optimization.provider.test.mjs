import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProvider,parseSuggestions,generateSuggestions} from '../functions/_lib/resume-ai-provider.js';

test('provider selection uses server-only configuration',()=>{
 const env={HHBA_AI_DEFAULT_PROVIDER:'openai',HHBA_AI_OPENAI_API_KEY:'placeholder',
  HHBA_AI_OPENAI_MODEL:'configured-model'};
 const result=selectProvider(env);
 assert.equal(result.name,'openai');
 assert.equal(result.protocol,'openai');
 assert.equal(result.model,'configured-model');
 assert.throws(()=>selectProvider({HHBA_AI_DEFAULT_PROVIDER:'unknown'}),/UNSUPPORTED/);
 assert.throws(()=>selectProvider({HHBA_AI_DEFAULT_PROVIDER:'openai'}),/NOT_CONFIGURED/);
});
test('AI response validates block references and suggestion shape',()=>{
 const suggestion={id:'a',blockId:'experience-0',action:'replace',
  original:'已有经历',proposed:'经过润色的已有经历',
  rationale:'表达更清晰',jobRequirement:'门店运营',
  evidenceStatus:'needs_user_confirmation'};
 assert.equal(parseSuggestions({suggestions:[suggestion]},['experience-0']).length,1);
 assert.throws(()=>parseSuggestions({suggestions:[{...suggestion,blockId:'not-owned'}]},['experience-0']));
 assert.throws(()=>parseSuggestions({suggestions:[{...suggestion,action:'invent'}]},['experience-0']));
});

test('existing HHBA DeepSeek server secret works with current Flash JSON mode',async()=>{
 const env={HHBA_MATCH_DEEPSEEK_KEY:'backend-only-test-key'};
 const provider=selectProvider(env);
 assert.equal(provider.name,'deepseek');
 assert.equal(provider.model,'deepseek-flash');
 assert.equal(provider.key,'backend-only-test-key');
 const prior=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async(url,options)=>{
  requests++;
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(options.headers.authorization,'Bearer backend-only-test-key');
  assert.equal(options.redirect,'manual');
  const sent=JSON.parse(options.body);
  assert.equal(sent.model,'deepseek-flash');
  assert.deepEqual(sent.response_format,{type:'json_object'});
  assert.deepEqual(sent.thinking,{type:'disabled'});
  return Response.json({choices:[{message:{content:JSON.stringify({
   suggestions:[{id:'tip',blockId:'experience-0',action:'replace',original:'负责门店运营',
    proposed:'负责区域门店运营',rationale:'表达更精准',
    jobRequirement:'区域门店管理',evidenceStatus:'needs_user_confirmation'}]
  })}}]});
 };
 try{
  const result=await generateSuggestions({env,
   blocks:[{id:'experience-0',section:'experience',text:'负责门店运营'}],
   job:{title:'区域督导',requirements:'区域门店管理'}});
  assert.equal(result.provider,'deepseek');
  assert.equal(result.suggestions.length,1);
  assert.equal(result.suggestions[0].proposed,'负责区域门店运营');
  assert.equal(requests,1);
 }finally{globalThis.fetch=prior;}
});

test('DeepSeek HTTP failures are safely classified without exposing upstream body',async()=>{
 const env={HHBA_MATCH_DEEPSEEK_KEY:'fake-secret-for-tests'};
 const blocks=[{id:'experience-0',section:'experience',text:'负责门店实际运营'}];
 const job={title:'门店督导',requirements:'运营和客户管理'};
 const cases=[
  [400,'AI_PROVIDER_REQUEST_REJECTED'],
  [401,'AI_PROVIDER_KEY_REJECTED'],
  [402,'AI_PROVIDER_BALANCE_INSUFFICIENT'],
  [429,'AI_PROVIDER_RATE_LIMITED'],
  [302,'AI_PROVIDER_UNEXPECTED_REDIRECT'],
  [503,'AI_PROVIDER_UPSTREAM_ERROR']
 ];
 const prior=globalThis.fetch;
 try{
  for(const [status,code] of cases){
   globalThis.fetch=async()=>new Response('confidential-user-data-must-not-leak',{status});
   await assert.rejects(()=>generateSuggestions({env,blocks,job}),e=>{
    assert.equal(e.message,code);
    assert.doesNotMatch(e.message,/confidential-user-data/);
    return true;
   });
  }
 }finally{globalThis.fetch=prior;}
});


test('non-HTTP model failures identify the exact safe output validation stage',async()=>{
 const env={HHBA_MATCH_DEEPSEEK_KEY:'synthetic-test-key'};
 const blocks=[{id:'source-0',section:'summary',text:'参与门店工作'}];
 const job={title:'门店运营',requirements:'日常工作与沟通'};
 const cases=[
  [{choices:[{finish_reason:'length',message:{content:'{"suggestions":['}}]},'AI_PROVIDER_RESPONSE_TRUNCATED'],
  [{choices:[{finish_reason:'stop',message:{content:'    '}}]},'AI_PROVIDER_RESPONSE_EMPTY'],
  [{choices:[{finish_reason:'stop',message:{content:'some prose instead of json'}}]},'AI_PROVIDER_RESPONSE_JSON_INVALID'],
  [{choices:[{finish_reason:'stop',message:{content:'{"notSuggestions":[]}'}}]},'AI_PROVIDER_SUGGESTION_SCHEMA_INVALID']
 ];
 const original=globalThis.fetch;
 try{
  for(const [mock,expected] of cases){
   globalThis.fetch=async()=>Response.json(mock);
   await assert.rejects(()=>generateSuggestions({env,blocks,job}),e=>e.message===expected);
  }
 }finally{globalThis.fetch=original;}
});


test('slightly incomplete model suggestions are normalized without inventing factual claims',()=>{
 const safe=parseSuggestions({suggestions:[
  {block_id:'source-0',action:'replace',proposed:'参与门店真实日常运营',evidenceStatus:'verified'},
  {blockId:'source-0',action:'replace',proposed:'不应重复覆盖'},
  {blockId:'source-1',action:'request_evidence',proposed:null,jobRequirement:'客户沟通'}
 ]},['source-0','source-1']);
 assert.equal(safe.length,2);
 assert.equal(safe[0].blockId,'source-0');
 assert.equal(safe[0].proposed,'参与门店真实日常运营');
 assert.equal(safe[0].evidenceStatus,'needs_user_confirmation');
 assert.match(safe[1].proposed,/补充你真实参与/);
 assert.ok(safe.every(x=>x.id&&x.original&&x.rationale&&x.jobRequirement));
 assert.throws(()=>parseSuggestions({suggestions:[{blockId:'not-owned',action:'replace',proposed:'无效'}]},['source-0']),/INVALID/);
});


test('DeepSeek JSON variants map safely without accepting invented paragraph references',()=>{
 const sourceOnly=['qa-source'];
 const variants=[
  {recommendations:[{type:'rewrite',optimizedText:'负责真实的日常运营记录',reason:'增强表述'}]},
  {result:{suggestions:[{action:'revise',suggestedText:'负责实际的客户沟通'}]}},
  {suggestions:[{operation:'add',after:'实际参与工作记录整理'}]}
 ];
 for(const item of variants){
  const normalized=parseSuggestions(item,sourceOnly);
  assert.equal(normalized.length,1);
  assert.equal(normalized[0].blockId,'qa-source');
  assert.equal(normalized[0].evidenceStatus,'needs_user_confirmation');
 }
 assert.throws(()=>parseSuggestions({suggestions:[
  {blockId:'wrong-id',action:'replace',proposed:'不能猜测所在段落'}
 ]},['source-0','source-1']),/INVALID/);
});
test('DeepSeek request gives the model an exact but nonauthoritative JSON format example',async()=>{
 const env={HHBA_MATCH_DEEPSEEK_KEY:'safe-test-key'};
 const old=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{
  const prompt=JSON.parse(JSON.parse(options.body).messages[1].content);
  assert.equal(prompt.output_format_example.suggestions[0].blockId,'source-0');
  assert.equal(prompt.output_format_example.suggestions[0].proposed,'参与真实的日常运营');
  assert.match(prompt.instructions,/不要复制示例建议内容/);
  return Response.json({choices:[{finish_reason:'stop',message:{content:'{"suggestions":[]}'}}]});
 };
 try{
  const result=await generateSuggestions({env,blocks:[{id:'source-0',section:'summary',
   text:'参与真实的日常运营'}],job:{title:'运营助理',requirements:'客户沟通'}});
  assert.deepEqual(result.suggestions,[]);
 }finally{globalThis.fetch=old;}
});


test('generated AI advice always references actual current paragraph, never model-paraphrased original',async()=>{
 const original='真实参与区域门店的客户邀约、到店跟进及日常运营记录';
 const env={HHBA_MATCH_DEEPSEEK_KEY:'fake-secret-for-tests'};
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
  suggestions:[{id:'s1',blockId:'experience-0',action:'replace',
   original:'错误的 AI 摘录',proposed:'参与客户邀约及日常运营记录',
   rationale:'更贴近岗位要求',jobRequirement:'客户管理',evidenceStatus:'needs_user_confirmation'}]
 })}}]});
 try{
  const result=await generateSuggestions({env,
   blocks:[{id:'experience-0',section:'experience',text:original}],
   job:{title:'区域督导',requirements:'客户管理'}});
  assert.equal(result.suggestions.length,1);
  assert.equal(result.suggestions[0].original,original);
  assert.equal(result.suggestions[0].proposed,'参与客户邀约及日常运营记录');
 }finally{globalThis.fetch=prior;}
});
