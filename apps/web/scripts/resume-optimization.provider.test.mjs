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
  assert.equal(options.redirect,'error');
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
