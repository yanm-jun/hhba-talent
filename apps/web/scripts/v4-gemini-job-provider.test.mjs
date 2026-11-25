import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Provider,v4JobProvider,v4Call,v4OutputText,v4ToolSources,v4Match} from '../functions/_lib/simple-match-v4.js';
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
  assert.equal(b.store,undefined);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private'},{text:'{"jobs":[]}'}]},groundingMetadata:{webSearchQueries:['jobs'],groundingChunks:[{web:{uri:'https://careers.other-motors.cn/recruitment/positions/9988'}}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,totalTokenCount:120}});
 },v4JobProvider(env),{instructions:'synthetic',input:'synthetic',tools:[{type:'web_search'}],tool_choice:'required'});
 assert.equal(v4OutputText(answer),'{"jobs":[]}');
 assert.deepEqual(v4ToolSources(answer),['https://careers.other-motors.cn/recruitment/positions/9988']);
 assert.equal(answer.usage.total_tokens,120);
 assert.deepEqual(answer.output[0].action.queries,['jobs']);
});
test('required search cannot claim success with no grounding',async()=>{
 const reply=await v4Call(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"jobs":[]}'}]}}]}),v4JobProvider(env),{input:'synthetic',tools:[{type:'web_search'}],tool_choice:'required'});
 assert.equal(reply.status,'incomplete');assert.equal(reply.output.some(x=>x.type==='web_search_call'),false);assert.equal(v4OutputText(reply),'{"jobs":[]}');
});
test('ordinary non-search calls need no grounding; provider rate limit remains retryable',async()=>{
 const result=await v4Call(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"score":90}'}]}}]}),v4JobProvider(env),{input:'synthetic'});
 assert.equal(v4OutputText(result),'{"score":90}');
 await assert.rejects(v4Call(async()=>new Response(null,{status:429}),v4JobProvider(env),{input:'synthetic'}),{code:'AI_PROVIDER_RATE_LIMITED'});
});

test('actual V4 first phase uses OpenAI, following discovery uses Gemini',async()=>{
 const calls=[];
 const resume='我负责汽车经销商渠道运营和门店销售流程管理。负责销售人员培训和运营数据分析。';
 const fetcher=async(url,opt)=>{
  calls.push(url);
  if(url.endsWith('/responses'))return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({profile:{roles:['渠道运营'],facts:[{kind:'work',quote:'汽车经销商渠道运营'}]}})}]}]});
  // Stop after observing the real discovery request, without external network.
  throw Object.assign(Error('synthetic network stop'),{name:'NetworkError'});
 };
 const first=await v4Match(fetcher,v4JobProvider(env),resume,'全国',{env,officialOnly:true,curated:true,stepMode:true});
 assert.equal(first.status,'CONTINUE');
 assert.equal(first.checkpoint.phase,'research');
 assert.equal(calls.length,1);
 assert.match(calls[0],/\/responses$/);
 assert.equal(first.checkpoint.profile.facts[0].quote,'汽车经销商渠道运营');
 try{await v4Match(fetcher,v4JobProvider(env),resume,'全国',{env,officialOnly:true,curated:true,stepMode:true,checkpoint:first.checkpoint});}catch{}
 assert.ok(calls.slice(1).some(u=>u==='https://relay.example/v1beta/models/gemini-test:generateContent'));
 assert.ok(calls.slice(1).every(u=>!u.endsWith('/responses')));
});

test('native SSE combines text fragments and actual query metadata without thought leakage',async()=>{
 const events=[{candidates:[{content:{parts:[{thought:true,text:'SECRET THOUGHT'},{text:'{"jobs":'}]}}]},{candidates:[{content:{parts:[{text:'[]}'}]},groundingMetadata:{webSearchQueries:['alternate search'],groundingChunks:[{web:{uri:'https://careers.other-motors.cn/recruitment/positions/9988'}}]},finishReason:'STOP'}],usageMetadata:{totalTokenCount:70}}];
 const result=await v4Call(async(url,opt)=>{assert.match(url,/:streamGenerateContent\?alt=sse$/);assert.equal(opt.headers.accept,'text/event-stream');return new Response(events.map(v=>'data: '+JSON.stringify(v)+'\r\n\r\n').join(''),{headers:{'content-type':'text/event-stream'}})},v4JobProvider({...env,GEMINI_STREAM:'1'}),{input:'synthetic',tools:[{type:'web_search'}],tool_choice:'required'});
 assert.equal(v4OutputText(result),'{"jobs":[]}');assert.equal(result.status,'completed');assert.deepEqual(result.output[0].action.queries,['alternate search']);assert.equal(result.usage.total_tokens,70);
});
test('URL Context is opt-in and restricted to public job-source requests',async()=>{
 const provider=v4JobProvider({...env,GEMINI_URL_CONTEXT:'1'});
 for(const use of [false,true])await v4Call(async(_url,opt)=>{
  assert.deepEqual(JSON.parse(opt.body).tools,use?[{google_search:{}},{url_context:{}}]:[{google_search:{}}]);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]});
 },provider,{input:'synthetic',tools:[{type:'web_search'}],publicUrlContext:use});
});

test('explicit new public lead and redirected landing are independently read and registered, not automatically verified',async()=>{
 const {v4RunResearchAction}=await import('../functions/_lib/v4-research-tools.js');
 const first='https://vertexaisearch.cloud.google.com/grounding-api-redirect/synthetic';
 const final='https://careers.other-motors.cn/recruitment/positions/9988';
 const knownUrls=new Set(),calls=[];
 const fetcher=async(url,opt)=>{calls.push(url);assert.equal(opt.redirect,'manual');assert.equal(opt.headers?.authorization,undefined);return url===first?new Response(null,{status:302,headers:{location:final}}):new Response('<html><h1>公开招聘</h1>岗位要求</html>',{headers:{'content-type':'text/html'}})};
 assert.equal((await v4RunResearchAction({type:'read_page',url:first},{collections:{},knownUrls,fetcher})).ok,false);
 const got=await v4RunResearchAction({type:'read_page',url:first,discover:true},{collections:{},knownUrls,fetcher});
 assert.equal(got.ok,true);assert.equal(got.url,final);assert.ok(knownUrls.has(final));assert.equal(got.verified,undefined);
 assert.deepEqual(calls,[first,final]);
 assert.equal((await v4RunResearchAction({type:'read_page',url:'https://127.0.0.1/admin',discover:true},{collections:{},knownUrls,fetcher})).ok,false);
});
test('interrupted Gemini stream retains partial research rather than falsely completing or discarding it',async()=>{
 const chunk='data: '+JSON.stringify({candidates:[{content:{parts:[{text:'{"jobs":[]}'}]},groundingMetadata:{webSearchQueries:['jobs']}}]})+'\n\n';
 const result=await v4Call(async()=>new Response(chunk+'data: broken\n\n',{headers:{'content-type':'text/event-stream'}}),v4JobProvider({...env,GEMINI_STREAM:'1'}),{input:'synthetic',tools:[{type:'web_search'}]});
 assert.equal(result.status,'incomplete');assert.equal(v4OutputText(result),'{"jobs":[]}');assert.deepEqual(result.output[0].action.queries,['jobs']);
});
