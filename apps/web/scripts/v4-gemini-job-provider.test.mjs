import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Provider,v4JobProvider,v4Call,v4OutputText,v4ToolSources} from '../functions/_lib/simple-match-v4.js';
const env={HHBA_AGENT_RELAY_API_KEY:'synthetic-openai-key-not-real',HHBA_V4_JOB_PROVIDER:'gemini',GEMINI_API_KEY:'synthetic-gemini-key-not-real',GEMINI_MODEL:'gemini-test',GOOGLE_GEMINI_BASE_URL:'https://relay.example'};
test('job-only Gemini opt-in never changes resume provider or silently falls back',()=>{
 assert.equal(v4JobProvider(env).kind,'gemini');
 assert.equal(v4Provider(env).key,env.HHBA_AGENT_RELAY_API_KEY);
 assert.equal(v4JobProvider({...env,GEMINI_API_KEY:''}),null);
 assert.equal(v4JobProvider({...env,GOOGLE_GEMINI_BASE_URL:'http://relay.example'}),null);
 assert.equal(v4JobProvider({...env,HHBA_V4_JOB_PROVIDER:'openai'}).key,env.HHBA_AGENT_RELAY_API_KEY);
});
test('native grounding maps to V4 response; no OpenAI credential, no model effort or output cap',async()=>{
 const answer=await v4Call(async(url,opt)=>{
  assert.equal(url,'https://relay.example/v1beta/models/gemini-test:generateContent');
  assert.equal(opt.headers['x-goog-api-key'],env.GEMINI_API_KEY);
  assert.equal(opt.headers.authorization,undefined);
  assert.equal(opt.redirect,'manual');
  const b=JSON.parse(opt.body);
  assert.deepEqual(b.tools,[{google_search:{}}]);
  assert.equal(b.generationConfig,undefined);
  assert.equal(b.store,false);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private'},{text:'{"jobs":[]}'}]},groundingMetadata:{webSearchQueries:['jobs'],groundingChunks:[{web:{uri:'https://example.org/jobs/123'}}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,totalTokenCount:120}});
 },v4JobProvider(env),{instructions:'synthetic',input:'synthetic',tools:[{type:'web_search'}],tool_choice:'required'});
 assert.equal(v4OutputText(answer),'{"jobs":[]}');
 assert.deepEqual(v4ToolSources(answer),['https://example.org/jobs/123']);
 assert.equal(answer.usage.total_tokens,120);
});
test('required search cannot claim success with no grounding',async()=>{
 await assert.rejects(v4Call(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"jobs":[]}'}]}}]}),v4JobProvider(env),{input:'synthetic',tools:[{type:'web_search'}],tool_choice:'required'}),{code:'AI_PROVIDER_RESPONSE_INVALID'});
});
test('ordinary non-search calls need no grounding; provider rate limit remains retryable',async()=>{
 const result=await v4Call(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"score":90}'}]}}]}),v4JobProvider(env),{input:'synthetic'});
 assert.equal(v4OutputText(result),'{"score":90}');
 await assert.rejects(v4Call(async()=>new Response(null,{status:429}),v4JobProvider(env),{input:'synthetic'}),{code:'AI_PROVIDER_RATE_LIMITED'});
});
