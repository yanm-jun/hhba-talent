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

test('Gemini context transport grows with actual omitted memory and learns rejection ceiling',async()=>{
 const {v4ContextState,v4ContextFeedback,v4RotatingMemoryPage}=await import('../functions/_lib/v4-research-tools.js');
 let state=v4ContextState(null);assert.equal(state.budget,90000);
 state=v4ContextFeedback(state,{more:true});assert.equal(state.budget,135000);
 state=v4ContextFeedback(state,{rejected:true});assert.equal(state.budget,67500);assert.equal(state.rejectedAt,135000);
 state=v4ContextFeedback(state,{more:true});assert.ok(state.budget>67500&&state.budget<135000);
 const items=Array.from({length:20},(_,i)=>({i,text:'x'.repeat(80)}));let cursor=0,all=[];
 do{const page=v4RotatingMemoryPage(items,cursor,256);all.push(...page.items);cursor=page.next_cursor;}while(cursor!==null);
 assert.deepEqual(all,items);assert.equal(v4RotatingMemoryPage(items,20,256).cursor,0);
});
test('adaptive concurrency respects hosting transport headroom and actual observed latency',async()=>{
 const {nextDiscoveryWidth}=await import('../functions/_lib/v4-parallel-discovery.js');
 assert.equal(nextDiscoveryWidth(3,[],{maxConnections:4,elapsed:100,previousElapsed:100}),4);
 assert.equal(nextDiscoveryWidth(4,[],{maxConnections:4,elapsed:1000,previousElapsed:100}),3);
 assert.equal(nextDiscoveryWidth(4,['AI_PROVIDER_RATE_LIMITED'],{maxConnections:4}),2);
});

test('large public page automatically falls back to addressable windows, never claims complete document',async()=>{
 const {v4RunResearchAction}=await import('../functions/_lib/v4-research-tools.js');
 const url='https://careers.other-motors.cn/recruitment/positions/9988',html='<html>'+('x'.repeat(2*1024*1024))+'</html>';
 const result=await v4RunResearchAction({type:'read_page',url,discover:true},{collections:{},knownUrls:new Set(),fetcher:async()=>new Response(html,{headers:{'content-type':'text/html','content-length':String(html.length)}})});
 assert.equal(result.ok,true);assert.equal(result.mode,'window');assert.equal(result.fallback_from,'static');assert.equal(result.complete_document,false);assert.ok(result.next_offset>0);
});
test('Gemini context capability probe exposes only model limits and synthetic token count',async()=>{
 const {inspectGeminiContextCapabilities}=await import('../functions/_lib/v4-gemini-job-provider.js');
 const provider=v4JobProvider(env),calls=[];
 const got=await inspectGeminiContextCapabilities(async(url,opt)=>{calls.push(url);assert.equal(opt.redirect,'manual');assert.equal(opt.headers['x-goog-api-key'],env.GEMINI_API_KEY);
 return url.endsWith(':countTokens')?Response.json({totalTokens:8}):Response.json({inputTokenLimit:1000000,outputTokenLimit:64000,supportedGenerationMethods:['generateContent','countTokens','createCachedContent']});},provider);
 assert.equal(got.input_token_limit,1000000);assert.equal(got.output_token_limit,64000);assert.equal(got.count_tokens,true);assert.equal(got.cached_content_advertised,true);assert.equal(calls.length,2);
});

test('large employer page retains exact structured JD after >2 MiB unrelated markup',async()=>{
 const {v4ReadEmployerJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const url='https://careers.other-motors.cn/recruitment/positions/9988';
 const description='<p>岗位职责：负责渠道运营。</p><p>任职要求：具有运营经验。</p>';
 const posting={'@type':'JobPosting',title:'渠道运营经理',hiringOrganization:{name:'示例汽车企业',url:'https://careers.other-motors.cn'},jobLocation:{address:{addressLocality:'上海'}},description};
 const html='<html><!--'+('x'.repeat(2*1024*1024))+'--><script type="application/ld+json">'+JSON.stringify(posting)+'</script></html>';
 const result=await v4ReadEmployerJob(url,{fetcher:async()=>new Response(html,{headers:{'content-type':'text/html','content-length':String(html.length)}})});
 assert.equal(result.source_confirmed,true);assert.match(result.full_jd,/负责渠道运营/);assert.match(result.full_jd,/具有运营经验/);
});
test('V4 legacy rewrite accepts long source blocks and JD without removing structural validation',async()=>{
 const {validRewriteInputs}=await import('../functions/_lib/resume-rewrite-provider.js');
 const blocks=Array.from({length:513},(_,i)=>({id:'b'+i,text:i===0?'原始经历'.repeat(2100):'真实经历',section:'experience'}));
 const job={title:'岗位',requirements:'岗位要求'.repeat(65000)};
 assert.equal(validRewriteInputs(blocks,job),false);
 assert.equal(validRewriteInputs(blocks,job,{v4:true}),true);
 assert.equal(validRewriteInputs([...blocks,blocks[0]],job,{v4:true}),false);
});

test('Gemini global ranking must include every eligible job once, without fabricated URLs',async()=>{
 const {validateGeminiGlobalOrder,applyGeminiGlobalOrder}=await import('../functions/_lib/v4-curated-reports.js');
 const jobs=[{official_url:'https://a.cn/job/1',match_score:96},{official_url:'https://b.cn/job/2',match_score:88}];
 const order=jobs.map(j=>j.official_url).reverse();
 assert.deepEqual(validateGeminiGlobalOrder({ordered_urls:order},jobs),order);
 assert.deepEqual(applyGeminiGlobalOrder(jobs,order).map(j=>j.official_url),order);
 assert.equal(validateGeminiGlobalOrder({ordered_urls:[order[0],order[0]]},jobs),null);
 assert.equal(validateGeminiGlobalOrder({ordered_urls:[order[0]]},jobs),null);
});
test('V4 independent public archive keeps a long nonstandard JD with exact hash and no fixed headings',async()=>{
 const {saveV4PublicJobJd}=await import('../functions/_lib/job-jd-archive.js');
 const data=new Map(),env={HHBA_JOB_JD_DB:{prepare(){}},HHBA_JOB_JD_R2:{async put(k,v){data.set(k,v)},async get(k){return data.has(k)?{text:async()=>data.get(k)}:null}}};
 const full_jd='负责区域运营。熟悉渠道业务。'.repeat(20000);
 const saved=await saveV4PublicJobJd(env,{proof_method:'V4_STRUCTURED_JOBPOSTING',source_confirmed:true,independently_read:true,canonical_url:'https://careers.other-motors.cn/recruitment/positions/9988',company:'示例企业',title:'运营经理',location:'上海',full_jd});
 assert.ok(saved);assert.equal(saved.full_jd,full_jd);assert.equal(saved.sections.map(x=>x.text).join('\n'),full_jd);
});

test('incremental Gemini rank keeps completed positions and accepts only real pending IDs',async()=>{
 const {mergeGeminiRankProgress}=await import('../functions/_lib/v4-curated-reports.js');
 assert.deepEqual(mergeGeminiRankProgress({ordered_ids:['j2','j1']},['j1'],['j1','j2','j3']),['j2','j1']);
 assert.deepEqual(mergeGeminiRankProgress({insertions:[{id:'j3',after_id:'j2'}]},['j2','j1'],['j1','j2','j3']),['j2','j3','j1']);
 assert.equal(mergeGeminiRankProgress({ordered_ids:['j2']},['j1'],['j1','j2']),null);
 assert.equal(mergeGeminiRankProgress({insertions:[{id:'invented',after_id:null}]},['j1'],['j1','j2']),null);
 assert.equal(mergeGeminiRankProgress({ordered_ids:['j1','j1']},['j1'],['j1','j2']),null);
});
test('trusted www host can schedule the same authorized background workflow',async()=>{
 const {backgroundEnabled}=await import('../functions/_lib/v4-background-match.js');
 const env={HHBA_V4_BACKGROUND_ENABLED:'1',HHBA_MATCH_BACKGROUND:{fetch(){}}};
 assert.equal(backgroundEnabled(env,new Request('https://www.hhba.work/api/match-v4/resume')),true);
 assert.equal(backgroundEnabled(env,new Request('https://hhba.work/api/match-v4/resume')),true);
 assert.equal(backgroundEnabled(env,new Request('https://other.example/api/match-v4/resume')),false);
});

test('ranking carries unchanged URLs across pool revisions and remaps snapshot IDs',async()=>{
 const {carryGeminiRankProgress}=await import('../functions/_lib/v4-curated-reports.js');
 assert.deepEqual(carryGeminiRankProgress(['b','a','c'],[['a','old'],['b','same'],['c','old']],[{id:'j1',url:'a'},{id:'j2',url:'b'},{id:'j3',url:'d'}],[['a','new'],['b','same'],['d','new']]),['j2']);
});
test('recover complete candidate objects from interrupted Gemini JSON without inventing unfinished jobs',async()=>{
 const {recoverV4PartialJobs}=await import('../functions/_lib/simple-match-v4.js');
 const first={url:'https://careers.other-motors.cn/recruitment/positions/9988',company:'示例企业',title:'运营经理',location:'上海',reason:'含有括号 { 与 } 的文本'};
 const raw='{"jobs":['+JSON.stringify(first)+',{"url":"https://careers.other-motors.cn/recruitment/positions/9999"';
 assert.deepEqual(recoverV4PartialJobs(raw),[first]);
 assert.deepEqual(recoverV4PartialJobs('{"profile":{}}'),[]);
});
