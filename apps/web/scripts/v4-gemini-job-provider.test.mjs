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

test('parallel research merges private stage notes without replacing completed evidence',async()=>{
 const {mergePipelineCheckpoint}=await import('../functions/_lib/v4-research-pipeline.js');
 const original={researchNotes:['shared']},discovery={phase:'research',rows:[],researchNotes:['shared','search']},verification={researchNotes:['shared','score']};
 const next=mergePipelineCheckpoint(original,discovery,verification,[]);
 assert.deepEqual(next.researchNotes,['shared','search','score']);
});
test('authorized checkpoint renewal extends only unfinished matching generation',async()=>{
 const {saveMatchTask,readMatchTask}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 const objects=new Map(),env={HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',HHBA_MATCH_V4_CHECKPOINT_SECRET:'test-only-checkpoint-secret-long-enough',HHBA_PRIVATE_RESUMES:{async put(k,v){objects.set(k,v)},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}:null}}};
 const id='a'.repeat(64),hour=3600000;
 await saveMatchTask(env,id,{generation:2,checkpoint:{phase:'research'}},0);
 assert.ok(await readMatchTask(env,id,20*hour,{renewGeneration:1}));
 assert.ok(await readMatchTask(env,id,21*hour,{renewGeneration:2}));
 assert.ok(await readMatchTask(env,id,24*hour));
 await saveMatchTask(env,id,{generation:2,result:{status:'COMPLETE'}},0);
 await readMatchTask(env,id,21*hour,{renewGeneration:2});
 assert.equal(await readMatchTask(env,id,24*hour),null);
});

test('V4 rewrite does not reject a long real proposal solely because of length',async()=>{
 const {validateAuthoring}=await import('../functions/_lib/resume-rewrite-provider.js');
 const block={text:'真实区域运营经历'},proposal=block.text.repeat(2000);
 assert.equal(validateAuthoring(block,proposal,[block.text],new Set()),'INVALID_REWRITE_TEXT');
 assert.equal(validateAuthoring(block,proposal,[block.text],new Set(),{v4:true}),null);
 assert.equal(validateAuthoring(block,proposal,['不存在的事实'],new Set(),{v4:true}),'SOURCE_QUOTE_NOT_FOUND');
});
test('incomplete parallel branch retains JD cache but never marks unscored candidate processed',async()=>{
 const {mergePipelineCheckpoint,pendingVerification,candidateRevision}=await import('../functions/_lib/v4-research-pipeline.js');
 const job={company:'示例企业',title:'运营经理',location:'上海'},u='https://careers.other-motors.cn/recruitment/positions/9988';
 const original={rows:[[u,job]]},discovery={...original,phase:'research'},verification={...original,phase:'verification',verificationReads:[[u,{revision:candidateRevision(job),jd:{full_jd:'真实原文'}}]]};
 const next=mergePipelineCheckpoint(original,discovery,verification,[[u,job]],{verificationIncomplete:true});
 assert.deepEqual(pendingVerification(next),[[u,job]]);assert.equal(next.verificationReads.length,1);
});
test('alias review needs independent same requisition evidence across URLs',async()=>{
 const {validAliasIdentity}=await import('../functions/_lib/simple-match-v4.js');
 const value={same_job:true,reason:'双语岗位',shared_requisition_id:'REQ12345',original_identity_quote:'中文运营 REQ12345',target_identity_quote:'Operations REQ12345'};
 assert.equal(validAliasIdentity(value,'中文运营 REQ12345','Operations REQ12345',false),true);
 assert.equal(validAliasIdentity(value,'中文运营 REQ54321','Operations REQ12345',false),false);
 assert.equal(validAliasIdentity({...value,same_job:false},'中文运营 REQ12345','Operations REQ12345',false),false);
});

test('resume optimization retries provider throttling without discarding accepted edits',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 let calls=0;const waits=[];
 const error=Object.assign(Error('limited'),{code:'AI_PROVIDER_RATE_LIMITED',retryAfterMs:5000});
 const result=await continueDocumentOptimization({blockIds:['a','b'],request:async pending=>{
  calls++;if(calls===1)throw error;
  if(calls===2)return {suggestions:[{blockId:'a'}],pending:['b'],pauseError:error};
  assert.deepEqual(pending,['b']);return {suggestions:[{blockId:'b'}],pending:[]};
 },wait:async(_signal,ms)=>waits.push(ms)});
 assert.deepEqual(result.map(x=>x.blockId),['a','b']);assert.deepEqual(waits,[5000,5000]);
});
test('reassessment stage pages both resume versions when context is rejected',async()=>{
 const {v4StageResearchCall}=await import('../functions/_lib/v4-research-tools.js');
 const before='前'.repeat(50000),after='后'.repeat(50000),jd='要求'.repeat(25000);let first=true,seen=new Set();
 const result=await v4StageResearchCall(async payload=>{
  const v=JSON.parse(payload.input);
  if(first){first=false;throw Object.assign(Error('context'),{code:'AI_PROVIDER_CONTEXT_TOO_LARGE'});}
  assert.ok(v.before_resume.length<before.length);assert.ok(v.after_resume.length<after.length);
  for(const p of v.research_tool_results||[])if(p.type==='text_page')seen.add(p.collection);
  return {status:'completed',data:{before:{score:80},after:{score:81}}};
 },{instructions:'compare',input:JSON.stringify({before_resume:before,after_resume:after,job:{full_jd:jd}})},{parse:r=>r.data,resume:before,document:after,jd});
 assert.equal(result.data.after.score,81);assert.deepEqual([...seen].sort(),['document','jd','resume']);
});

test('consented V4 page OCR passes a page image rather than invalid split PDF bytes',async()=>{
 const {recognizeV4Resume,V4_OCR_CONSENT}=await import('../functions/_lib/v4-resume-ocr.js');
 const bytes=new Uint8Array(32);bytes[0]=255;bytes[1]=216;bytes[30]=255;bytes[31]=217;
 const request=new Request('https://hhba.work/api/match-v4/ocr',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-HHBA-OCR-Consent':V4_OCR_CONSENT,'X-HHBA-Resume-Format':'page-jpeg'},body:bytes});
 const result=await recognizeV4Resume(request,{baseUrl:'https://relay.example/v1',key:'synthetic-key',model:'synthetic'},async(_url,opt)=>{
  const payload=JSON.parse(opt.body);
  assert.equal(payload.input[0].content[0].type,'input_image');
  assert.match(payload.input[0].content[0].image_url,/^data:image\/jpeg;base64,/);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'本页真实文字'}]}]});
 });
 assert.equal(result.text,'本页真实文字');assert.equal(result.partial,false);
});

test('operator Gemini probe is disabled without a configured secret',async()=>{
 const {onRequest}=await import('../functions/api/match-v4-provider-probe.js');
 const response=await onRequest({request:new Request('https://hhba.work/api/match-v4-provider-probe?phase=basic'),env:{}});
 assert.equal(response.status,404);
});
test('basic probe cannot report stream support from a buffered JSON fallback',async()=>{
 const {runGeminiProbe}=await import('../functions/api/match-v4-provider-probe.js');
 const fetcher=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]});
 const provider=v4JobProvider(env);
 assert.equal((await runGeminiProbe(provider,'basic',{fetcher})).ok,true);
 assert.equal((await runGeminiProbe(provider,'stream',{fetcher})).ok,false);
});
test('real search acceptance rejects ungrounded candidate claims',async()=>{
 const {runGeminiProbe}=await import('../functions/api/match-v4-provider-probe.js');
 const fetcher=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"jobs":[{"company":"Example","title":"Operations","location":"Shanghai","url":"https://careers.example.com/jobs/123"}]}'}]}}]});
 const result=await runGeminiProbe(v4JobProvider(env),'search',{fetcher});
 assert.equal(result.ok,false);assert.equal(result.grounded,false);
});

test('explicit URL Context incompatibility preserves Gemini search and independent verification',async()=>{
 const provider=v4JobProvider({...env,GEMINI_URL_CONTEXT:'1',GEMINI_STREAM:'1'});
 const calls=[];
 const result=await v4Call(async(url,opt)=>{
  const tools=JSON.parse(opt.body).tools;calls.push(tools);
  if(tools.some(x=>x.url_context))return Response.json({error:{message:'URL Context cannot be combined with Google Search on this relay'}},{status:400});
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"jobs":[]}'}]},groundingMetadata:{webSearchQueries:['public positions']}}]});
 },provider,{input:'public synthetic job search',tools:[{type:'web_search'}],tool_choice:'required',publicUrlContext:true});
 assert.deepEqual(calls,[[{google_search:{}},{url_context:{}}],[{google_search:{}}]]);
 assert.equal(result.status,'completed');assert.ok(result.output.some(x=>x.type==='web_search_call'));
});
test('Gemini context rejection is surfaced for adaptive paging rather than disabling optional tools',async()=>{
 const provider=v4JobProvider({...env,GEMINI_URL_CONTEXT:'1',GEMINI_STREAM:'1'});let calls=0;
 await assert.rejects(v4Call(async()=>{calls++;return Response.json({error:{message:'input context length exceeded'}},{status:400});},provider,{input:'synthetic',tools:[{type:'web_search'}],publicUrlContext:true}),{code:'AI_PROVIDER_CONTEXT_TOO_LARGE'});
 assert.equal(calls,1);
});

test('long research notes remain fully readable with adaptive character cursors and escaped Unicode',async()=>{
 const {v4NotesMemoryPage,v4RunResearchAction}=await import('../functions/_lib/v4-research-tools.js');
 const notes=['引文"\\🙂'.repeat(2000),'后一份岗位研究'];
 const exact=notes.join('\n\n');
 let cursor=0,rebuilt='',pages=0;
 do{
  const budget=pages%2?256:511;
  const p=await v4RunResearchAction({type:'memory',collection:'notes',cursor},{collections:{notes},budget});
  assert.equal(p.ok,true);assert.equal(p.unit,'characters');assert.ok(JSON.stringify(p.items).length<=budget);
  rebuilt+=p.items.join('');cursor=p.next_cursor;pages++;
 }while(cursor!==null);
 assert.equal(rebuilt,exact);assert.ok(pages>1);
 assert.equal(v4NotesMemoryPage(notes,exact.length,256,{rotate:true}).cursor,0);
});

test('unavailable background scheduling returns fallback without losing authorized task identity',async()=>{
 const {tryScheduleBackgroundMatch}=await import('../functions/_lib/v4-background-match.js');
 const data=new Map(),env={HHBA_V4_BACKGROUND_ENABLED:'1',HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',HHBA_MATCH_V4_CHECKPOINT_SECRET:'synthetic-checkpoint-secret-long-enough',HHBA_PRIVATE_RESUMES:{async put(k,v){data.set(k,v)},async get(k){const v=data.get(k);return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}:null}},HHBA_MATCH_BACKGROUND:{async fetch(){return Response.json({ok:false},{status:409})}}};
 const session={phone:'synthetic-account',token_hash:'synthetic-session'},task={id:'00000000-0000-4000-8000-000000000001',generation:0};
 assert.equal(await tryScheduleBackgroundMatch(env,new Request('https://hhba.work/api/match-v4/resume'),session,task),false);
 env.HHBA_MATCH_BACKGROUND.fetch=async()=>Response.json({ok:true});
 assert.equal(await tryScheduleBackgroundMatch(env,new Request('https://hhba.work/api/match-v4/resume'),session,task),true);
 assert.equal(data.size,1);
});

test('public employer HTML exposes resource hints, allows only exact declared external assets and separately reads data',async()=>{
 const {v4ReadPublicJobDocument,v4RenderPublicJobDocument}=await import('../functions/_lib/v4-open-job-evidence.js');
 const {v4RunResearchAction,v4RememberPublicResult}=await import('../functions/_lib/v4-research-tools.js');
 const url='https://careers.employer.cn/jobs/42',script='https://cdn.employer.cn/app.js?v=1',api='https://api.employer.cn/jobs/42.json';
 const html='<html><head><script src="'+script+'"></script><link rel="preload" as="fetch" href="'+api+'"></head><body><div data-endpoint="'+api+'">运营职位</div><iframe src="http://127.0.0.1/private"></iframe><script src="https://localhost/app.js"></script></body></html>';
 const fetcher=async(u)=>u===url?new Response(html,{headers:{'content-type':'text/html'}}):u===api?Response.json({title:'运营职位',description:'公开岗位职责'}):(()=>{throw Error('unexpected URL '+u)})();
 const doc=await v4ReadPublicJobDocument(url,{fetcher});
 assert.deepEqual(doc.resource_hints,[{url:script,kind:'script'},{url:api,kind:'data'}]);
 let opts;
 const browser={async quickAction(type,value){assert.equal(type,'content');opts=value;return new Response('<html><body>公开岗位职责</body></html>',{headers:{'content-type':'text/html'}})}};
 const rendered=await v4RenderPublicJobDocument(url,{browser,resourceHints:doc.resource_hints});
 assert.equal(rendered.rendered,true);
 assert.ok(opts.allowRequestPattern.some(p=>new RegExp(p).test(script)));
 assert.ok(!opts.allowRequestPattern.some(p=>new RegExp(p).test('https://cdn.employer.cn/unrelated.js')));
 assert.ok(!opts.allowRequestPattern.some(p=>new RegExp(p).test(api)));
 const knownUrls=new Set([url]),ledger=[];
 const page=await v4RunResearchAction({type:'read_page',url},{collections:{},knownUrls,fetcher,browser,ledger});
 assert.equal(page.ok,true);v4RememberPublicResult(ledger,page);
 assert.ok(knownUrls.has(api));assert.deepEqual(ledger[0].resource_hints,doc.resource_hints);
 const data=await v4RunResearchAction({type:'read_page',url:api},{collections:{},knownUrls,fetcher,browser,ledger});
 assert.equal(data.ok,true);assert.match(data.text,/公开岗位职责/);
 assert.equal(data.verified,undefined);
});

test('script-only employer shell independently discovers exact cross-origin API before rendering',async()=>{
 const {v4ReadPublicJobDocument,v4PreparePublicBrowserResources,v4RenderPublicJobDocument}=await import('../functions/_lib/v4-open-job-evidence.js');
 const url='https://careers.employer.cn/jobs/42',script='https://cdn.employer.cn/app.js',api='https://api.employer.cn/jobs/42.json';
 const denied='https://api.employer.cn/api/delete/42',other='https://api.employer.cn/jobs/99.json';
 const calls=[],ledger=[];
 const fetcher=async(u,o)=>{calls.push(u);assert.equal(o.method,'GET');assert.equal(o.headers.Authorization,undefined);
  if(u===url)return new Response('<script src="'+script+'"></script>',{headers:{'content-type':'text/html'}});
  if(u===script)return new Response('fetch("'+api+'"); fetch("'+denied+'");',{headers:{'content-type':'application/javascript'}});
  if(u===api)return Response.json({title:'运营岗位',description:'实际公开职责'});
  throw Error('unexpected '+u);
 };
 const parent=await v4ReadPublicJobDocument(url,{fetcher});
 const plan=await v4PreparePublicBrowserResources(url,{fetcher,resourceHints:parent.resource_hints,ledger,onDocument:r=>ledger.push(r)});
 assert.deepEqual(calls,[url,script,api]);assert.deepEqual(plan.publicDataUrls,[api]);
 assert.equal(ledger.find(r=>r.url===script).script_source,true);
 let opts;
 const browser={async quickAction(type,value){opts=value;return new Response('<h1>运营岗位</h1><p>实际公开职责</p>',{headers:{'content-type':'text/html'}})}};
 const rendered=await v4RenderPublicJobDocument(url,{browser,...plan});
 assert.match(rendered.plain,/实际公开职责/);
 for(const allowed of [script,api])assert.ok(opts.allowRequestPattern.some(p=>new RegExp(p).test(allowed)));
 for(const blocked of [other,denied,'https://localhost/private','https://api.employer.cn/jobs/42.json?other=1'])assert.ok(!opts.allowRequestPattern.some(p=>new RegExp(p).test(blocked)));
});
test('public iframe admission requires successful exact public response; redirects are not wildcard authority',async()=>{
 const {v4PreparePublicBrowserResources}=await import('../functions/_lib/v4-open-job-evidence.js');
 const parent='https://careers.employer.cn/jobs/1',frame='https://recruit.employer.cn/job/1',redirect='https://api.employer.cn/job/1',bad='https://api.employer.cn/auth/token';
 const seen=[];
 const plan=await v4PreparePublicBrowserResources(parent,{resourceHints:[{url:frame,kind:'frame'},{url:redirect,kind:'data'},{url:bad,kind:'data'}],fetcher:async u=>{
  seen.push(u);
  if(u===frame)return new Response('<h1>招聘岗位</h1>',{headers:{'content-type':'text/html'}});
  if(u===redirect)return new Response(null,{status:302,headers:{location:'https://localhost/private'}});
  throw Error('unexpected '+u);
 }});
 assert.deepEqual(seen,[frame,redirect]);assert.deepEqual(plan.publicDataUrls,[frame]);
});
test('linked structured JSON JD survives browser CORS failure without replacing original application link',async()=>{
 const {v4ReadPublicJobDocument,v4ReadDeclaredStructuredJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const url='https://careers.employer.cn/jobs/42',api='https://api.employer.cn/jobs/42.json';
 const parent={canonical_url:url,company:'测试企业',title:'渠道运营',location:'上海',source_confirmed:true,independently_read:true,vacancy_confirmed:true,full_jd:''};
 let posting={'@type':'JobPosting',url,title:parent.title,hiringOrganization:{name:parent.company},jobLocation:{address:{addressLocality:'上海'}},description:'负责区域经销商运营管理与客户服务。',qualifications:'具有渠道运营经验，具备沟通协调能力。'};
 const fetcher=async u=>u===url?new Response('<div data-api="'+api+'">岗位详情</div>',{headers:{'content-type':'text/html'}}):Response.json(posting);
 const doc=await v4ReadPublicJobDocument(url,{fetcher});
 const result=await v4ReadDeclaredStructuredJob(parent,doc,{fetcher});
 assert.equal(result.canonical_url,url);assert.equal(result.jd_source_url,api);assert.match(result.full_jd,/区域经销商运营/);
 assert.equal(await v4ReadDeclaredStructuredJob({...parent,source_confirmed:false},doc,{fetcher}),null);
 posting={...posting,url:'https://careers.employer.cn/jobs/99'};
 assert.equal(await v4ReadDeclaredStructuredJob(parent,doc,{fetcher}),null);
});
