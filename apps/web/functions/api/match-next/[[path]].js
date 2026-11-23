/**
 * HHBA Clean Match V2 — entirely separate authenticated Cloudflare backend.
 *
 * Preserves existing candidate identity, resume ownership, explicit consent,
 * OCR and private match history. Old deepsearch/hybrid/ATS/checkpoint logic
 * is not imported and cannot influence this endpoint.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {recognizeResumeFile} from '../../_lib/resume-ocr.js';
import {recognizeMatchResume} from '../../_lib/resume-jd-match-agent.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {runCleanJobMatch,rankCleanMatchResults,MATCH_V2} from '../../_lib/clean-match-v2.js';
import {archiveCleanMatchJobs} from '../../_lib/clean-match-v2-jd-bridge.js';
import {checkCleanMatchProvider} from '../../_lib/clean-match-v2-provider-check.js';

const KIND='HHBA_NATIVE_WEB_MATCH_V1';
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
 typeof env?.HHBA_MATCH_DEEPSEEK_KEY==='string'&&
 env.HHBA_MATCH_DEEPSEEK_KEY.length>=16&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
const enabled=env=>providerConfigured(env)&&env?.HHBA_MATCH_CLEAN_V2_ENABLED==='1';
// CF_PAGES_BRANCH is guaranteed as a Pages BUILD variable, not a runtime
// binding. Bind prelaunch permission to preview-only env config AND the exact
// Cloudflare preview hostname. Never grant preflight on the hhba.work domain.
const previewPreflight=(env,request)=>{
 if(!providerConfigured(env)||env?.HHBA_PREVIEW_AI_DIAG_ENABLED!=='1'||
  env?.CF_PAGES_BRANCH==='main')return false;
 try{
  const host=new URL(request.url).hostname.toLowerCase();
  return host.endsWith('.hhba-talent.pages.dev')&&host!=='hhba-talent.pages.dev';
 }catch{return false}
};
const mayCheckProvider=(env,request)=>enabled(env)||previewPreflight(env,request);
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
  privacy:'仅在本次授权下向 DeepSeek 发送脱敏简历文字，不公开或保存简历原文。',
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
 const profile=await recognizeMatchResume(env.HHBA_MATCH_DEEPSEEK_KEY,
  redacted,input.options.role_hint,{signal,onFallback:()=>onActivity({
   stage:'parsing',message:'正在补充核对简历证据，避免误判经历。'})});
 const resumeMs=Date.now()-started;
 onProgress('planning');
 onActivity({stage:'planning',message:'识别到 '+(profile.facts?.length||0)+
  ' 条简历原文证据，将开始新的企业岗位研究流程。'});
 const discovery=await runCleanJobMatch(env.HHBA_MATCH_DEEPSEEK_KEY,
  redacted,profile,input.options.role_hint,input.options.limit,{
   signal,onProgress,onActivity,onPartial,
   excludeUrls:input.options.exclude_urls||[]
  });
 // This is a new, independent official-JD archive bridge, NOT the retired
 // search Agent. It can unlock the unchanged, evidence-gated Word optimizer.
 const jdStart=Date.now();
 const archived=await archiveCleanMatchJobs(env,env.HHBA_MATCH_DEEPSEEK_KEY,
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
   const probe=await checkCleanMatchProvider(env.HHBA_MATCH_DEEPSEEK_KEY,
    {signal:request.signal});
   return json({...probe,engine:MATCH_V2});
  }catch(e){
   const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
   console.warn('HHBA_MATCH_V2_PROVIDER_CHECK_FAILED',JSON.stringify({code}));
   return fail(code,code==='AI_PROVIDER_RATE_LIMITED'?429:502);
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
  const input={options:{country:'CN',remote_only:false,
   role_hint:'汽车区域督导 销售运营',limit:10,exclude_urls:[]},
   resume_id:null};
  return streamMatch(env,session,input,redactForModel(ACCEPTANCE_RESUME),
   {persistHistory:false});
 }
 if(tail==='/ocr'){
  try{return json({ok:true,...await recognizeResumeFile(request,env.HHBA_MATCH_DEEPSEEK_KEY)})}
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
