/**
 * HHBA Clean Match V2 — entirely separate authenticated Cloudflare backend.
 *
 * Preserves existing candidate identity, resume ownership, explicit consent,
 * OCR and private match history. Old deepsearch/hybrid/ATS/checkpoint logic
 * is not imported and cannot influence this endpoint.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {recognizeOpenAIResumeFile} from '../../_lib/resume-ocr-openai-v2.js';
import {recognizeMatchResume} from '../../_lib/resume-jd-match-openai-v2.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {runCleanJobMatch,rankCleanMatchResults,MATCH_V2,findEmployerSources,readEmployerPages,extractJobs,officialDetailRecoveryQueries} from '../../_lib/clean-match-v2.js';
import {archiveCleanMatchJobs} from '../../_lib/clean-match-v2-jd-bridge.js';
import {checkCleanMatchProvider} from '../../_lib/clean-match-v2-provider-check.js';
import {matchV2Runtime} from '../../_lib/clean-match-v2-runtime.js';
import {authorizeOperatorQa,startQaRun,appendQaStage,finishQaRun,getQaRun,
 redactQaDiagnostic} from '../../_lib/clean-match-v2-qa-log.js';

const KIND='HHBA_OPENAI_MATCH_V2';
const openAIProvider=env=>({key:env?.HHBA_MATCH_OPENAI_API_KEY||env?.HHBA_AI_OPENAI_API_KEY,
 model:matchV2Runtime(env).model,
 baseUrl:matchV2Runtime(env).baseUrl});
// An entirely synthetic, intentionally fabricated candidate, never the
// signed-in person's uploaded résumé, private document, or stored profile.
const ACCEPTANCE_SCENARIO='automotive_operations_v1';
const ACCEPTANCE_RESUME=[
 '测试样本（虚构人物，不代表任何真实求职者）',
 '求职意向城市：上海、苏州',
 '求职方向：汽车区域督导、销售运营、渠道运营',
 '工作经历：负责汽车区域门店运营监督、渠道培训及销售漏斗复盘',
 '项目经历：组织过线下品牌活动，使用表格记录线索、邀约、到店、试驾和订单，',
 '协助团队定期复盘销售转化，整理并追踪门店整改事项。',
 '技能：Excel 基础数据统计、渠道沟通、销售活动组织。'
].join('\n');
const headers={'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(code,status=502)=>json({ok:false,error:code},status);
// A real provider preflight must be possible before flipping the public
// matching launch gate. It remains candidate-authenticated, explicit opt-in,
// and preview-only until the complete workflow passes live acceptance.
const providerConfigured=env=>
 env?.HHBA_MATCH_SERVICE_ENABLED==='1'&&
 typeof openAIProvider(env).key==='string'&&
 openAIProvider(env).key.length>=16&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
const enabled=env=>providerConfigured(env)&&matchV2Runtime(env).matchEnabled;
// CF_PAGES_BRANCH is guaranteed as a Pages BUILD variable, not a runtime
// binding. Bind prelaunch permission to preview-only env config AND the exact
// Cloudflare preview hostname. Never grant preflight on the hhba.work domain.
const previewPreflight=(env,request)=>{
 if(!providerConfigured(env)||!matchV2Runtime(env).diagEnabled||
  env?.CF_PAGES_BRANCH==='main')return false;
 try{
  const host=new URL(request.url).hostname.toLowerCase();
  return host.endsWith('.hhba-talent.pages.dev')&&host!=='hhba-talent.pages.dev';
 }catch{return false}
};
const mayCheckProvider=(env,request)=>enabled(env)||previewPreflight(env,request);
// Owner-authorized operator diagnostics use a separate 256-bit bearer token
// whose SHA-256 digest lives in *preview-only* isolated D1. This is NOT a
// forged candidate session. The QA route accepts only the fixed synthetic CV.
async function operatorGate(env,request){
 if(!previewPreflight(env,request))return false;
 try{return await authorizeOperatorQa(env.HHBA_PNVS_AUTH_DB,
   request.headers.get('X-HHBA-QA-Token'))}catch{return false}
}
async function operatorQaRun(env,request){
 let payload;
 try{const raw=await request.text();if(raw.length>160)throw Error('too long');
  payload=JSON.parse(raw)}catch{return fail('INVALID_SYNTHETIC_CHECK_REQUEST',400)}
 if(payload?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
 if(payload.scenario!==ACCEPTANCE_SCENARIO||
  (payload.mode!==undefined&&!['focused','full'].includes(payload.mode))||
  (payload.request_id!==undefined&&
   (typeof payload.request_id!=='string'||!/^[0-9a-f-]{36}$/i.test(payload.request_id)))||
  Object.keys(payload).some(k=>!['consent','scenario','mode','request_id'].includes(k)))
  return fail('INVALID_SYNTHETIC_CHECK_REQUEST',400);
 const db=env.HHBA_PNVS_AUTH_DB,runId=payload.request_id||crypto.randomUUID(),
  started=Date.now(),mode=payload.mode||'full';
 // The same caller request_id may never trigger a second paid QA run.
 try{await startQaRun(db,runId)}
 catch{
  try{const row=await db.prepare('SELECT id FROM hhba_match_qa_runs WHERE id=?')
   .bind(runId).first();
   if(row?.id===runId)return json({run_id:runId,status:'ALREADY_STARTED'},409);
  }catch{}
  return fail('MATCH_QA_LOG_NOT_READY',503);
 }
 let lastStage='preparing',seq=0,chain=Promise.resolve();
 const enqueue=(stage,counts={})=>{
  lastStage=stage;
  if(seq>=90)return;
  const n=++seq;
  chain=chain.then(()=>appendQaStage(db,runId,n,stage,counts))
   .catch(()=>{}); // A stage-log failure cannot falsely claim full success.
 };
 enqueue('preparing');
 // A bounded operator-only stage diagnostic, not user-facing 10-job matching.
 // Search official employer JD domains, Fetch up to four pages and extract
 // source-grounded vacancies; fits the remote browser's 120s maximum.
 if(mode==='focused'){
  try{
   const plan={roles:['区域督导','渠道运营','销售运营'],cities:['上海','苏州']};
   plan.queries=officialDetailRecoveryQueries(plan);
   enqueue('searching',{queries:plan.queries.length});
   const search=await findEmployerSources(fetch,openAIProvider(env),plan,request.signal);
   const d={stage:'reading',searches:search.queries-search.failures,
    search_failures:search.failures,search_raw_results:search.raw_results,
    search_empty_queries:search.empty_queries,candidate_links:search.sources.length,
    search_rejection_counts:search.rejection_counts,provider_error_codes:search.error_codes,
    fetch_attempted:0,fetch_failures:0,page_reads:0,
    city_evidence_count:0,model_failures:0,model_pages_attempted:0,extracted_jobs:0,visible_jobs:0,
    extraction_page_rejections:{}};
   enqueue('reading',{searches:d.searches,
    search_raw_results:d.search_raw_results,candidate_links:d.candidate_links});
   const read=await readEmployerPages(fetch,openAIProvider(env),
    search.sources.slice(0,4),request.signal,{targetSuccesses:4});
   d.fetch_attempted=read.attempts;d.fetch_failures=read.failures;
   d.page_reads=read.pages.length;d.fetch_error_codes=read.error_codes;
   enqueue('researching',{fetch_attempted:d.fetch_attempted,page_reads:d.page_reads,
    fetch_failures:d.fetch_failures});
   const extracted=read.pages.length?
    await extractJobs(fetch,openAIProvider(env),read.pages,request.signal):
    {jobs:[],model_failures:0,city_evidence:0,page_rejections:{}};
   d.city_evidence_count=extracted.city_evidence;
   d.model_failures=extracted.model_failures;
   d.model_pages_attempted=extracted.model_pages_attempted||0;
   d.extraction_page_rejections=extracted.page_rejections;
   d.extracted_jobs=extracted.jobs.length;d.visible_jobs=extracted.jobs.length;
   d.stage='complete';
   enqueue('complete',{extracted_jobs:d.extracted_jobs,
    city_evidence_count:d.city_evidence_count,model_failures:d.model_failures});
   await chain;
   const status=extracted.jobs.length?'COMPLETED_PARTIAL':'COMPLETED_ZERO';
   await finishQaRun(db,runId,status,d,Date.now()-started);
   return json({run_id:runId,mode:'focused',status,
    note:'只验证企业链接、最多4个真实网页与原文JD提取；不代表10条岗位和匹配评分验收成功',
    summary:redactQaDiagnostic(d),
    matches:extracted.jobs.map(x=>({company:x.company,title:x.title,
     location:x.location,official_url:x.url,jd_source_status:'PARTIAL_SOURCE'}))});
  }catch(e){
   await chain;
   const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
   try{await finishQaRun(db,runId,'FAILED',{stage:lastStage,
    provider_error_codes:[code]},Date.now()-started)}catch{}
   return json({run_id:runId,mode:'focused',status:'FAILED',error:code},502);
  }
 }
 const options={country:'CN',remote_only:false,role_hint:'汽车区域督导 销售运营',
  limit:10,exclude_urls:[]};
 try{
  const result=await workflow(env,null,{options,resume_id:null},
   redactForModel(ACCEPTANCE_RESUME),{signal:request.signal,
    onProgress:stage=>enqueue(stage),
    onActivity:x=>enqueue(x.stage,x),
    onPartial:jobs=>enqueue('partial',{visible_jobs:jobs?.length||0}),
    persistHistory:false});
  await chain;
  const found=result.matches.length,verified=result.matched_official_jobs;
  const status=found>=10&&verified>0?'COMPLETED_TARGET':
   found?'COMPLETED_PARTIAL':'COMPLETED_ZERO';
  await finishQaRun(db,runId,status,result.native_search,Date.now()-started);
  return json({run_id:runId,status,summary:redactQaDiagnostic(result.native_search),
   matches:result.matches.map(x=>({company:x.company,title:x.title,
    location:x.location,official_url:x.official_url,match_score:x.match_score,
    jd_source_status:x.jd_source_status||'UNVERIFIED'}))});
 }catch(e){
  await chain;
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
  try{await finishQaRun(db,runId,'FAILED',{stage:lastStage,
    provider_error_codes:[code]},Date.now()-started)}catch{}
  return json({run_id:runId,status:'FAILED',error:code},502);
 }
}

async function candidateSession(env,request){
 const session=await sessionOfBearer(env.HHBA_PNVS_AUTH_DB,request,Date.now());
 if(!session)return null;
 const user=await getUserByPhone(env.HHBA_PNVS_AUTH_DB,session.phone);
 return user?.role==='candidate'?session:null;
}
function publicResult(profile,matches,diagnostic,target){
 const verified=matches.filter(x=>x.jd_source_status==='VERIFIED_JD').length;
 return {status:'COMPLETE',profile,matches,
  matched_official_jobs:verified,
  employer_source_candidates:matches.length-verified,
  native_search:diagnostic,source:'中国大陆企业招聘原文',
  scoring:'有真实 JD 和简历证据时提供参考分；未充分核实的岗位不虚构匹配分，绝非录用概率。',
  privacy:'仅在本次授权下向已配置的 AI 服务（可能经第三方中转站）发送脱敏简历文字；HHBA 不公开简历原文。',
  disclaimer:matches.length<target?
   '本轮已找到 '+matches.length+' 条有具体职位证据的候选，尚未达到目标 '+target+
    ' 条。职位开放状态及最新要求仍需点击企业来源核实。':
   '结果来自本轮真实检索和网页读取，招聘状态以企业官方公告为准。',
  can_continue:false};
}
async function workflow(env,session,input,redacted,{signal,onProgress,onActivity,onPartial,persistHistory=true}){
 const started=Date.now();
 onProgress('parsing');
 onActivity({stage:'parsing',message:'开始理解简历中的真实工作经历及职业能力。'});
 const profile=await recognizeMatchResume(openAIProvider(env),
  redacted,input.options.role_hint,{signal,onFallback:()=>onActivity({
   stage:'parsing',message:'正在补充核对简历证据，避免误判经历。'})});
 const resumeMs=Date.now()-started;
 onProgress('planning');
 onActivity({stage:'planning',message:'识别到 '+(profile.facts?.length||0)+
  ' 条简历原文证据，将开始新的企业岗位研究流程。'});
 const discovery=await runCleanJobMatch(openAIProvider(env),
  redacted,profile,input.options.role_hint,input.options.limit,{
   signal,onProgress,onActivity,onPartial,
   excludeUrls:input.options.exclude_urls||[]
  });
 // This is a new, independent official-JD archive bridge, NOT the retired
 // search Agent. It can unlock the unchanged, evidence-gated Word optimizer.
 const jdStart=Date.now();
 const archived=await archiveCleanMatchJobs(env,openAIProvider(env),
  profile,discovery.matches,{signal,onActivity,onPartial});
 const matches=rankCleanMatchResults(archived.matches);
 const diagnostic={...discovery.diagnostic,visible_jobs:matches.length,
  jd_verification:archived.diagnostic};
 const result=publicResult(profile,matches,{
  ...diagnostic,phase_latency_ms:{resume_recognition:resumeMs,
   discovery:discovery.diagnostic.elapsed_ms,
   jd_finish_wait:Date.now()-jdStart,evidence_research:0,total:Date.now()-started}
 },input.options.limit);
 // Synthetic acceptance MUST NOT write to the candidate's match history.
 if(!persistHistory){
  result.history_id=null;result.history_status='EMPTY';
  result.new_job_count=0;result.improved_job_count=0;
  result.preview_synthetic=true;
 }else{
  // Only server-confirmed source jobs can create candidate history.
  try{
   const saved=await saveMatchHistory(env.HHBA_PNVS_AUTH_DB,session.phone,
    input.resume_id||null,input.options.role_hint,matches);
   result.history_id=saved?.id||null;
   result.history_status=saved?'SAVED':'EMPTY';
   result.new_job_count=saved?.new_job_count||0;
   result.improved_job_count=saved?.improved_job_count||0;
  }catch{
   result.history_id=null;result.history_status='UNAVAILABLE';
   result.new_job_count=0;result.improved_job_count=0;
  }
 }
 return result;
}
function streamMatch(env,session,input,redacted,{persistHistory=true}={}){
 const encoder=new TextEncoder(),abort=new AbortController();
 let closed=false,phase='preparing';
 const body=new ReadableStream({
  start(controller){
   const send=(kind,value)=>{
    if(closed)return;
    try{controller.enqueue(encoder.encode('event: '+kind+
     '\ndata: '+JSON.stringify(value)+'\n\n'))}catch{closed=true}
   };
   send('progress',{stage:'preparing'});
   const start=Date.now();
   const heartbeat=setInterval(()=>{if(!closed)send('heartbeat',{
    stage:phase,elapsed_ms:Date.now()-start})},12000);
   const progress=stage=>{phase=stage;send('progress',{stage})};
   void (async()=>{
    try{
     const result=await workflow(env,session,input,redacted,{
      signal:abort.signal,onProgress:progress,persistHistory,
      onActivity:x=>send('activity',x),
      onPartial:matches=>send('partial',{matches})
     });
     if(!abort.signal.aborted){
      console.info('HHBA_MATCH_V2_RESULT',JSON.stringify(result.native_search));
      send('complete',result);
     }
    }catch(e){
     const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
     console.warn('HHBA_MATCH_V2_ERROR',JSON.stringify({
      code,phase,elapsed_ms:Date.now()-start
     }));
     send('failure',{error:code,phase,elapsed_ms:Date.now()-start});
    }finally{
     clearInterval(heartbeat);
     if(!closed){closed=true;try{controller.close()}catch{}}
    }
   })();
  },
  cancel(){closed=true;abort.abort()}
 });
 return new Response(body,{status:200,headers:{
  'Content-Type':'text/event-stream; charset=utf-8',
  'Cache-Control':'private, no-store, no-transform','X-Content-Type-Options':'nosniff',
  'X-Accel-Buffering':'no','Referrer-Policy':'no-referrer'
 }});
}
export async function onRequest({request,env}){
 const url=new URL(request.url);
 const tail=url.pathname.slice('/api/match-next'.length).replace(/\/$/,'')||'/';
 if(tail==='/status'&&request.method==='GET')
  return json({kind:KIND,engine:MATCH_V2,enabled:enabled(env),
   preflight_available:mayCheckProvider(env,request),
   synthetic_check_available:previewPreflight(env,request),scope:'CN_MAINLAND_ONLY',formats:['pdf','docx'],mode:'EVIDENCE_FIRST_V2'});
 if(tail==='/operator-run'||tail==='/operator-log'){
  if(!await operatorGate(env,request))return fail('NOT_FOUND',404);
  if(tail==='/operator-run'){
   if(request.method!=='POST')return fail('NOT_FOUND',404);
   if(request.headers.get('Origin')!==url.origin||
    request.headers.get('Sec-Fetch-Site')==='cross-site')
    return fail('ORIGIN_REQUIRED',403);
   return operatorQaRun(env,request);
  }
  if(request.method!=='GET')return fail('NOT_FOUND',404);
  const id=url.searchParams.get('id');
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))return fail('INVALID_QA_RUN',400);
  try{const run=await getQaRun(env.HHBA_PNVS_AUTH_DB,id);
   return run?json(run):fail('QA_RUN_NOT_FOUND',404)}
  catch{return fail('MATCH_QA_LOG_NOT_READY',503)}
 }
 if(!['/resume','/ocr','/provider-check','/synthetic-check'].includes(tail))
  return fail('NOT_FOUND',404);
 if(tail==='/synthetic-check'){
  if(!previewPreflight(env,request))return fail('MATCH_SYNTHETIC_NOT_ENABLED',503);
 }else if(tail==='/provider-check'){
  if(!mayCheckProvider(env,request))return fail('MATCH_PREFLIGHT_NOT_ENABLED',503);
 }else if(!enabled(env))return fail('MATCH_NOT_ENABLED',503);
 if(tail==='/provider-check'&&request.method!=='GET')return fail('NOT_FOUND',404);
 if(tail==='/synthetic-check'&&request.method!=='POST')return fail('NOT_FOUND',404);
 if(tail!=='/provider-check'&&request.method!=='POST')return fail('NOT_FOUND',404);
 if(tail!=='/provider-check'&&(request.headers.get('Origin')!==url.origin||
  request.headers.get('Sec-Fetch-Site')==='cross-site'))return fail('ORIGIN_REQUIRED',403);
 let session;
 try{session=await candidateSession(env,request)}catch{}
 if(!session)return fail('SESSION_INVALID',401);
 if(tail==='/provider-check'){
  try{
   const probe=await checkCleanMatchProvider(openAIProvider(env),
    {signal:request.signal});
   return json({...probe,engine:MATCH_V2});
  }catch(e){
   const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
   const stage=['basic_responses','structured_json','web_search_sources'].includes(e?.probeStage)?
    e.probeStage:'unknown';
   const upstream_status=Number.isInteger(e?.upstreamStatus)&&
    e.upstreamStatus>=400&&e.upstreamStatus<=599?e.upstreamStatus:null;
   // No upstream message/body/secret/profile appears in logs or UI.
   const diagnostic={code,stage,upstream_status};
   console.warn('HHBA_MATCH_V2_PROVIDER_CHECK_FAILED',JSON.stringify(diagnostic));
   return json({ok:false,error:code,stage,upstream_status},
    code==='AI_PROVIDER_RATE_LIMITED'?429:502);
  }
 }
 if(tail==='/synthetic-check'){
  // Requires the same-origin, signed-in candidate session, explicit consent,
  // and a fixed server-side sample. No user-supplied résumé or prompt accepted.
  let sampleRequest;
  try{
   const raw=await request.text();
   if(raw.length>160)throw Error('invalid');
   sampleRequest=JSON.parse(raw);
  }catch{return fail('INVALID_SYNTHETIC_CHECK_REQUEST',400)}
  if(sampleRequest?.consent!==true)
   return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
  if(sampleRequest?.scenario!==ACCEPTANCE_SCENARIO||
   Object.keys(sampleRequest).some(k=>!['consent','scenario'].includes(k)))
   return fail('INVALID_SYNTHETIC_CHECK_REQUEST',400);
  // No per-day or per-account QA cap: repeated authorized preview runs are
  // needed for diagnosing real Search/Fetch/JD failures. Still require login,
  // same-origin consent, a fixed server-side synthetic résumé and preview-only
  // hostname; no match history or real candidate résumé is used.
  const input={options:{country:'CN',remote_only:false,
   role_hint:'汽车区域督导 销售运营',limit:10,exclude_urls:[]},
   resume_id:null};
  return streamMatch(env,session,input,redactForModel(ACCEPTANCE_RESUME),
   {persistHistory:false});
 }
 if(tail==='/ocr'){
  try{return json({ok:true,...await recognizeOpenAIResumeFile(request,openAIProvider(env))})}
  catch(e){return fail(e?.code||'OCR_SERVICE_UNAVAILABLE',e?.status||502)}
 }
 let input;
 try{
  const raw=await request.text();
  if(raw.length>65000)throw Error('oversize');
  input=JSON.parse(raw);
 }catch{return fail('INVALID_RESUME_TEXT',400)}
 if(input?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
 const options=input.options;
 if(typeof input?.text!=='string'||input.text.length>20000||
  input.text.replace(/\s/g,'').length<30||!options||
  options.country!=='CN'||options.remote_only!==false||
  typeof options.role_hint!=='string'||options.role_hint.length>80||
  !Number.isInteger(options.limit)||options.limit<1||options.limit>10)
  return fail('INVALID_RESUME_TEXT',400);
 if(options.exclude_urls!==undefined&&(!Array.isArray(options.exclude_urls)||
  options.exclude_urls.length>50||options.exclude_urls.some(x=>
   typeof x!=='string'||x.length>1200||!x.startsWith('https://'))))
  return fail('INVALID_RESUME_TEXT',400);
 if(input.resume_id){
  if(typeof input.resume_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.resume_id))
   return fail('RESUME_NOT_FOUND',404);
  try{
   const owned=await env.HHBA_PNVS_AUTH_DB.prepare(
    'SELECT id FROM hhba_candidate_resumes WHERE phone=? AND id=?')
    .bind(session.phone,input.resume_id).first();
   if(!owned)return fail('RESUME_NOT_FOUND',404);
  }catch{return fail('MATCH_HISTORY_DB_UNAVAILABLE',503)}
 }
 const redacted=redactForModel(input.text);
 if(redacted.replace(/\s/g,'').length<30)return fail('INVALID_RESUME_TEXT',400);
 if(request.headers.get('Accept')?.includes('text/event-stream'))
  return streamMatch(env,session,input,redacted);
 try{
  const result=await workflow(env,session,input,redacted,{
   signal:request.signal,onProgress:()=>{},onActivity:()=>{},onPartial:()=>{}});
  console.info('HHBA_MATCH_V2_RESULT',JSON.stringify(result.native_search));
  return json(result);
 }catch(e){
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
  console.warn('HHBA_MATCH_V2_ERROR',JSON.stringify({code}));
  return fail(code,code==='AI_PROFILE_INCOMPLETE'?422:502);
 }
}
