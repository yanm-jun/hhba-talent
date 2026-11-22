// HHBA search-first experience: DeepSeek Search -> optional Fetch -> V4 Pro ranking.
// No ATS API, no company whitelist, no invented job links.
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {runSearchFirstMatch} from '../../_lib/deepseek-search-match.js';
import {runAgentOwnedMainlandMatch} from '../../_lib/ai-owned-job-research.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {enrichSearchMatchesWithJD,matchJdEnrichmentEnabled} from '../../_lib/match-jd-enrichment.js';
import {researchDomesticJobEvidence} from '../../_lib/domestic-job-research.js';
import {createAccountResearchCheckpoint} from '../../_lib/ai-research-checkpoint.js';
import {jobResearchQuality} from '../../_lib/agent-quality-metrics.js';
import {checkMatchProviderCapabilities} from '../../_lib/match-provider-preflight.js';
import {recognizeMatchResume,compareMatchResumeToJd} from '../../_lib/resume-jd-match-agent.js';
import {parseJobAnswer,wasWebSearched,partialJobMatchesFromText} from '../../_lib/deepseek-native-match.js';

const KIND='HHBA_NATIVE_WEB_MATCH_V1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status)=>json({ok:false,error:code},status);
const enabled=env=>env.HHBA_MATCH_SERVICE_ENABLED==='1'&&
 typeof env.HHBA_MATCH_DEEPSEEK_KEY==='string'&&env.HHBA_MATCH_DEEPSEEK_KEY.length>=16&&
 typeof env.HHBA_PNVS_AUTH_DB?.prepare==='function';
const prompt=[
 '你是 HHBA 求职助手。自己使用 web_search 联网检索实际招聘岗位、判断适合程度、推荐并解释。',
 '只找中国大陆工作地点（不含港澳台/海外/中外混合工作），允许外资公司在华招聘。',
 '按简历目标城市、方向、经历优先搜索，也考虑合理转岗。本轮只需按用户指定数量找不同企业和职位；不足如实输出。',
 '必须是公开搜索得到的单个招聘职位详情/投递 HTTPS URL，不能猜链接或用列表主页代替。',
 '每条写针对简历真实项目/工作经历的简明推荐理由；岗位是否在招以实际页面为准。不泄露简历隐私。',
 '自主联网搜索、必要时阅读详情。优先选择有明确职位详情网址和实际国内工作城市的职位，不要为凑数量编造链接或任职要求。',
 '先输出有充分依据的岗位。每条「为什么推荐」写成约120至180个汉字的具体分析，至少说明：①简历中哪段具体经历、成果或技能能证明能力；②这些能力如何对应搜索到的岗位职责；③如有转岗或经验差距，指出真实的注意事项。不能只写「很匹配」「经验对口」的套话，不能杜撰经历、岗位要求或录用把握。',
 '对每条岗位，结合求职者简历里实际存在的工作成果、职业技能和你搜索到的该岗位职责、资格要求，提供 0—100 的整数 match_score（AI 参考适配分，绝非录用概率）。分数应区分岗位，不得为好看一律给高分。经验/学历/证书明显不符应扣分，并在 score_basis 具体解释已证实的优势和差距。若没有足够的职位要求可核对，match_score 用 null，score_basis 解释缺少什么证据；绝不猜测分数。',
 '尽快完成，不要冗长说明。只返回 JSON，无 markdown：',
 '{"jobs":[{"company":"公司","title":"岗位","location":"实际工作城市","salary":"有则写薪资否则空","reason":"简历依据及匹配理由","match_score":78,"score_basis":"对照简历和岗位的关键条件，说明优势及差距；无法可靠判断时用 null","job_basis":"检索到的职位要求依据","url":"具体职位详情链接"}]}'
].join('\n');
function providerError(status){
 if(status===401||status===403)return 'AI_PROVIDER_KEY_REJECTED';
 if(status===402)return 'AI_PROVIDER_BALANCE_INSUFFICIENT';
 if(status===429)return 'AI_PROVIDER_RATE_LIMITED';
 if([400,404,422].includes(status))return 'AI_PROVIDER_REQUEST_REJECTED';
 return 'AI_PROVIDER_UNAVAILABLE';
}
async function candidateSession(env,request){
 const db=env.HHBA_PNVS_AUTH_DB;
 const session=await sessionOfBearer(db,request,Date.now());
 if(!session)return null;
 const user=await getUserByPhone(db,session.phone);
 return user?.role==='candidate'?session:null;
}
// DeepSeek Responses emits semantic SSE rather than a single blocking JSON body.
// We listen to search progress and only trust its terminal response.completed event.
async function readProviderEvents(response,onProgress=()=>{},onPartial=()=>{},limit=10){
 const ct=(response.headers.get('content-type')||'').toLowerCase();
 if(!ct.includes('text/event-stream'))return await response.json();
 if(!response.body)throw Error('AI_PROVIDER_RESPONSE_INVALID');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',completed=null,receivedSearch=false,streamedText='',partialCount=0;
 const eventOf=chunk=>{
  if(!chunk.trim())return;
  const lines=chunk.split('\n');
  const event=lines.find(x=>x.startsWith('event:'))?.slice(6).trim()||'';
  const raw=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
  if(!raw)return;
  let obj;try{obj=JSON.parse(raw)}catch{return}
  const type=obj.type||event;
  if(type==='response.created')onProgress('connected');
  if(type==='response.web_search_call.in_progress'||
     type==='response.web_search_call.searching'){
   receivedSearch=true;onProgress('searching');
  }
  if(type==='response.web_search_call.completed'){
   receivedSearch=true;onProgress('writing');
  }
  if(type==='response.output_item.done'&&obj.item?.type==='web_search_call'&&obj.item.status==='completed'){
   receivedSearch=true;onProgress('writing');
  }
  if(type==='response.output_text.delta'&&typeof obj.delta==='string'){
   if(streamedText.length<50000)streamedText+=obj.delta;
   if(receivedSearch&&streamedText.length<50000&&obj.delta.includes('}')){
    const matches=partialJobMatchesFromText(streamedText,limit);
    if(matches.length>partialCount){
     partialCount=matches.length;
     onPartial(matches);
    }
   }
  }
  if(type==='response.output_text.done'&&receivedSearch&&typeof obj.text==='string'){
   const matches=partialJobMatchesFromText(obj.text,limit);
   if(matches.length>partialCount){partialCount=matches.length;onPartial(matches);}
  }
  if(type==='response.completed')completed=obj.response;
  if(type==='response.failed'||type==='response.incomplete'){
   const e=new Error('AI_PROVIDER_INCOMPLETE');e.code=e.message;throw e;
  }
 };
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   if(buffer.length>3_000_000)throw Error('AI_PROVIDER_RESPONSE_INVALID');
   let idx;
   while((idx=buffer.indexOf('\n\n'))>=0){
    eventOf(buffer.slice(0,idx));buffer=buffer.slice(idx+2);
   }
  }
  if(buffer.trim())eventOf(buffer);
 }finally{reader.releaseLock();}
 if(!completed){
  const err=new Error('AI_PROVIDER_RESPONSE_INVALID');err.code=err.message;throw err;
 }
 if(receivedSearch)onProgress('writing');
 return completed;
}
function nativeResponsePayload(result,limit){
 return {
  status:'COMPLETE',
  profile:result.profile,
  matches:result.matches,
  // Search and domain heuristics cannot independently verify official hiring ownership.
  matched_official_jobs:result.matches.filter(job=>job.jd_source_status==='VERIFIED_JD').length,
  employer_source_candidates:result.matches.filter(job=>
   job.recruitment_source_kind==='EMPLOYER_DOMAIN_CANDIDATE'||
   job.recruitment_source_kind==='EMPLOYER_ATS').length,
  native_search:result.diagnostic,
  source:'中国大陆企业招聘页面',
  scoring:'匹配分依据核验后的完整岗位 JD 和简历证据。',
  privacy:'本次授权仅向 DeepSeek 发送脱敏简历文字，不存储原始简历。',
  disclaimer:(result.matches.length<limit?`本轮找到 ${result.matches.length} 个符合展示条件的岗位，目标为 ${limit} 个。`:'')+'招聘状态和任职要求以企业公告为准。证据不足的岗位暂不评分。'
 };
}

// The live Search-first model owns the job list. Only server-completed
// matches may create durable personal history; clients cannot submit fake jobs.
async function verifiedJdPass(env,result,resume,options,progress){
 if(!matchJdEnrichmentEnabled(env))return result;
 progress('reading');
 try{
  const checked=await enrichSearchMatchesWithJD(env,result.matches,resume,{...options,domesticOnly:true});
  return {...result,matches:checked.matches,
   diagnostic:{...result.diagnostic,jd_verification:checked.diagnostic}};
 }catch{
  // JD indexing failures must not destroy a completed, still-provisional Search.
  return {...result,diagnostic:{...result.diagnostic,
   jd_verification:{mode:'failed',eligible:0,verified:0,scored:0,failed:0}}};
 }
}

// The model directs the search and investigation by default.
// The previous source-grounded flow is kept for provider failure recovery.
async function runCandidateResearch(env,key,resume,roleHint,limit,options={}){
 if(env?.HHBA_AI_OWNED_RESEARCH_ENABLED==='0')
  return runSearchFirstMatch(key,resume,roleHint,limit,options);
 try{
  // Candidate discovery is preliminary. The full-JD Agent writes the comparisons.
  return await runAgentOwnedMainlandMatch(key,resume,roleHint,limit,{...options,expandDetailed:false});
 }catch(error){
  if(options.signal?.aborted||error?.code==='AI_MATCH_CANCELLED')throw error;
  // "No verified source" is a valid evidence conclusion, not a model
  // failure. Never override an intentional Agent conclusion with a fixed
  // keyword fallback that might accidentally recommend weaker sources.
  if(['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
   'AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_REQUEST_REJECTED',
   'AI_EMPLOYER_JOBS_NOT_FOUND',
   'AI_SEARCH_API_REJECTED','AI_SEARCH_UNAVAILABLE',
   'AI_SEARCH_RESPONSE_INVALID'].includes(error?.code))throw error;
  console.warn('HHBA_AI_RESEARCH_RECOVERY',JSON.stringify({
   reason:String(error?.code||'AGENT_UNAVAILABLE').slice(0,70),mode:'legacy-fallback'
  }));
  const fallback=await runSearchFirstMatch(key,resume,roleHint,limit,options);
  return {...fallback,diagnostic:{...fallback.diagnostic,
   agent_fallback:true,agent_error:String(error?.code||'AGENT_UNAVAILABLE').slice(0,70)}};
 }
}
async function domesticResearchPass(env,key,result,options,progress){
 progress('researching');
 const checked=await researchDomesticJobEvidence(key,'',result.matches,{
  ...options,score:false,enabled:env?.HHBA_DOMESTIC_EVIDENCE_RESEARCH_ENABLED!=='0'
 });
 const final=checked.matches.map(job=>job.jd_source_status==='VERIFIED_JD'?job:{...job,
  match_score:null,reference_score:0,score_basis:'',matched:[],not_evidenced:[],
  recommendation_reason:'已找到企业招聘入口，完整岗位 JD 尚待核验。'});
 const diagnostic={...result.diagnostic,domestic_evidence:checked.diagnostic,
  visible_jobs:final.length};
 return {...result,matches:final,diagnostic:{
  ...diagnostic,quality:jobResearchQuality(final,diagnostic)
 }};
}
async function checkpointForCandidate(env,candidate,resume,roleHint){
 if(env?.HHBA_AI_OWNED_RESEARCH_ENABLED==='0'||
  env?.HHBA_AGENT_CHECKPOINT_ENABLED==='0')return null;
 try{return await createAccountResearchCheckpoint(
  env.HHBA_PNVS_AUTH_DB,candidate.phone,resume,roleHint,
  env.HHBA_RESEARCH_CHECKPOINT_SECRET||env.HHBA_MATCH_DEEPSEEK_KEY
 )}catch{return null}
}
function provisionalPartial(jobs){
 // No numerical score until official JD or independently researched evidence.
 return jobs.map(job=>job.jd_source_status==='VERIFIED_JD'?job:
  {...job,match_score:null,reference_score:0,score_basis:'',matched:[],not_evidenced:[],
   recommendation_reason:'已找到企业招聘入口，正在核对岗位 JD。'});
}

async function matchResumeWorkflow(env,candidate,resume,options,{
 signal,onProgress=()=>{},onActivity=()=>{},onPartial=()=>{}
}={}){
 const key=env.HHBA_MATCH_DEEPSEEK_KEY;
 onProgress('parsing');
 const profile=await recognizeMatchResume(key,resume,options.role_hint,{signal});
 const checkpoint=await checkpointForCandidate(env,candidate,resume,options.role_hint);
 const researchOptions={signal,checkpoint,resumeProfile:profile,onProgress,onActivity,
  autonomousPlanning:env?.HHBA_AUTONOMOUS_SEARCH_ENABLED!=='0',
  onPartial:jobs=>onPartial(provisionalPartial(jobs))};
 const result=await runCandidateResearch(env,key,resume,options.role_hint,options.limit,researchOptions);
 const verified=await verifiedJdPass(env,result,resume,{
  ...options,signal,onVerified:jobs=>onPartial(provisionalPartial(jobs)),compareEvidence:jd=>{
   onProgress('scoring');
   return compareMatchResumeToJd(key,profile,jd,{signal});
  }
 },onProgress);
 onPartial(provisionalPartial(verified.matches));
 const researched=await domesticResearchPass(env,key,verified,{signal},onProgress);
 return {result:{...researched,profile},checkpoint};
}

async function withSavedHistory(env,session,input,result){
 const response=nativeResponsePayload(result,input.options.limit);
 try{
  const item=await saveMatchHistory(env.HHBA_PNVS_AUTH_DB,session.phone,
   input.resume_id??null,input.options.role_hint,result.matches);
  response.history_id=item?.id||null;
  response.history_status=item?'SAVED':'EMPTY';
  response.new_job_count=item?.new_job_count||0;
  response.improved_job_count=item?.improved_job_count||0;
 }catch(e){
  // Recommendation display must not disappear when a migration is pending.
  response.history_id=null;response.history_status='UNAVAILABLE';
  response.new_job_count=0;response.improved_job_count=0;
  console.warn('HHBA_MATCH_HISTORY_SAVE_UNAVAILABLE',e?.name||'Error');
 }
 return response;
}

export async function runNativeJobMatch(key,text,roleHint,limit=10,{fetcher=fetch,onProgress=()=>{},onPartial=()=>{},direction='direct',signal=null}={}){
 const start=Date.now();
 const body={
  model:'deepseek-v4-pro',
  reasoning:{effort:'high'},
  tools:[{type:'web_search'}],
  tool_choice:'required',
  text:{format:{type:'json_object'}},
  max_output_tokens:12000,
  stream:true,
  instructions:prompt,
  input:'请自行联网搜索真实职位，再给出推荐，不用先让我确认。\n'+
   '本轮只找 '+limit+' 个职位，避免复制同类岗位。'+(direction==='adjacent'?
   '优先发掘简历能力可迁移的相邻职位，和直接原岗位不同，但必须说明转岗逻辑。':'优先推荐与简历工作经历和求职目标最直接对应的职位。')+'\n'+
   '目标岗位补充：'+String(roleHint||'').slice(0,80)+'\n\n求职者简历（已遮盖联系方式）：\n'+text.slice(0,9000)
 };
 let response;
 try{
  response=await fetcher('https://api.deepseek.com/responses',{
   method:'POST',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(65000)]):AbortSignal.timeout(65000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(body)
  });
 }catch(e){
  const err=new Error(e?.name==='TimeoutError'||e?.name==='AbortError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
  err.code=err.message;throw err;
 }
 if(!response.ok){
  const err=new Error(providerError(response.status));err.code=err.message;throw err;
 }
 let data;
 try{data=await readProviderEvents(response,onProgress,onPartial,limit);}catch(e){
  if(e?.name==='TimeoutError'||e?.name==='AbortError'){
   const err=new Error('AI_PROVIDER_TIMEOUT');err.code=err.message;throw err;
  }
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_RESPONSE_INVALID';
  const err=new Error(code);err.code=code;throw err;
 }
 if(data?.status!=='completed'){
  const e=new Error('AI_PROVIDER_RESPONSE_INVALID');e.code=e.message;throw e;
 }
 if(!wasWebSearched(data)){
  const e=new Error('AI_WEB_SEARCH_NOT_USED');e.code=e.message;throw e;
 }
 let parsed;
 try{parsed=parseJobAnswer(data,limit);}catch{
  const e=new Error('AI_PROVIDER_RESPONSE_INVALID');e.code=e.message;throw e;
 }
 // Diagnostics contain counts and duration only; no resume or provider payload.
 return {matches:parsed.matches,diagnostic:{
  model:'deepseek-v4-pro',searches:Number(data.usage?.server_tool_use?.tool_search||0),
  page_reads:Number(data.usage?.server_tool_use?.tool_fetch||0),
  provider_items:parsed.received,visible_jobs:parsed.matches.length,
  discarded:parsed.rejected,elapsed_ms:Date.now()-start
 }};
}
// Two independent DeepSeek web searches run concurrently. Each model stays
// autonomous: the server only merges, deduplicates and enforces existing
// Mainland/HTTPS safety checks, without maintaining its own external job index.
export function combineNativeBatches(groups,limit=10){
 const seen=new Set(),jobs=[];
 for(const group of groups){
  for(const job of group||[]){
   const key=(job.company+'|'+(job.title_zh||job.title)).toLowerCase().replace(/\s+/g,'');
   const url=job.official_url;
   if(seen.has(key)||seen.has(url))continue;
   seen.add(key);seen.add(url);
   jobs.push({...job,id:'native-batch-'+jobs.length+'-'+new URL(url).hostname.replace(/[^a-z0-9]/ig,'-')});
   if(jobs.length>=limit)return jobs;
  }
 }
 return jobs;
}
// Return early when ten genuine Mainland posting objects have streamed,
// or finish with verified partial results at the UX deadline. Never wait for
// a stalled second provider call after the user's valid jobs are available.
export async function runNativeDualMatch(key,text,roleHint,limit=10,{
 fetcher=fetch,onProgress=()=>{},onPartial=()=>{},timeBudgetMs=42000
}={}){
 const start=Date.now();
 const counts=limit<=5?[limit]:[Math.min(6,Math.ceil(limit/2)+1),Math.min(6,Math.ceil(limit/2)+1)];
 const directions=counts.length===1?['direct']:['direct','adjacent'];
 const snapshots=counts.map(()=>[]),lastResults=counts.map(()=>null),controller=new AbortController();
 let emitted='',resolveEnough,settledCount=0;
 const enough=new Promise(resolve=>{resolveEnough=resolve;});
 const emit=()=>{
  if(controller.signal.aborted)return;
  const combined=combineNativeBatches(snapshots,limit);
  const signature=combined.map(x=>x.company+'|'+x.title+'|'+x.recommendation_reason).join('^');
  if(signature!==emitted&&combined.length){
   emitted=signature;onPartial(combined);
  }
  if(combined.length>=limit)resolveEnough();
 };
 const tasks=counts.map((count,index)=>runNativeJobMatch(key,text,roleHint,count,{
  fetcher,direction:directions[index],signal:controller.signal,
  onProgress:stage=>{if(!controller.signal.aborted)onProgress(stage);},
  onPartial:partial=>{
   if(!controller.signal.aborted){snapshots[index]=partial;emit();}
  }
 }).then(result=>{
  if(!controller.signal.aborted){lastResults[index]=result;snapshots[index]=result.matches;emit();}
  return result;
 }).finally(()=>{settledCount++;}));
 const allSettled=Promise.allSettled(tasks);
 let timer;
 const deadline=new Promise(resolve=>{
  timer=setTimeout(()=>resolve({kind:'deadline'}),Math.min(60000,Math.max(50,timeBudgetMs)));
 });
 const completed=allSettled.then(outcomes=>({kind:'settled',outcomes}));
 const winner=await Promise.race([completed,deadline,enough.then(()=>({kind:'enough'}))]);
 clearTimeout(timer);
 const early=winner.kind!=='settled';
 // Cancels the costly DeepSeek search still running in the losing branch.
 // allSettled absorbs the resulting rejections, preventing unhandled errors.
 if(early)controller.abort();
 const combined=combineNativeBatches(snapshots,limit);
 const results=winner.kind==='settled'?winner.outcomes:[];
 const success=results.filter(x=>x.status==='fulfilled');
 const errors=results.filter(x=>x.status==='rejected');
 if(!combined.length&&!success.length){
  if(winner.kind==='deadline'){
   const err=new Error('AI_PROVIDER_SLOW');err.code=err.message;throw err;
  }
  throw errors[0]?.reason||new Error('AI_PROVIDER_UNAVAILABLE');
 }
 const interrupted=winner.kind==='deadline'||(winner.kind==='enough'&&settledCount<counts.length);
 const incomplete=(combined.length<limit)&&(interrupted||errors.length>0);
 return {matches:combined,incomplete,diagnostic:{
  model:'deepseek-v4-pro',searches:lastResults.reduce((n,x)=>n+(x?.diagnostic?.searches||0),0),
  page_reads:lastResults.reduce((n,x)=>n+(x?.diagnostic?.page_reads||0),0),
  provider_items:lastResults.reduce((n,x)=>n+(x?.diagnostic?.provider_items||0),0),
  visible_jobs:combined.length,discarded:lastResults.reduce((n,x)=>n+(x?.diagnostic?.discarded||0),0),
  elapsed_ms:Date.now()-start,parallel_requests:counts.length,
  failed_requests:errors.length,finished_early:early,deadline_reached:winner.kind==='deadline'
 }};
}

export async function onRequest({request,env}){
 const url=new URL(request.url);
 const tail=url.pathname.slice('/api/match-native'.length).replace(/\/$/,'')||'/';
 if(tail==='/status'&&request.method==='GET')
  return json({kind:KIND,enabled:enabled(env),scope:'CN_MAINLAND_ONLY',mode:'SEARCH_FIRST_V1',formats:['pdf','docx']});
 if(!enabled(env))return fail('MATCH_NOT_ENABLED',503);
 if(tail==='/provider-check'&&request.method==='GET'){
  try{
   if(!(await candidateSession(env,request)))return fail('SESSION_INVALID',401);
   const result=await checkMatchProviderCapabilities(env.HHBA_MATCH_DEEPSEEK_KEY);
   return json({ok:true,status:'READY',capabilities:result.capabilities});
  }catch(error){
   const code=typeof error?.code==='string'?error.code:'AI_PROVIDER_UNAVAILABLE';
   return fail(code,502);
  }
 }
 if(tail!=='/resume'||request.method!=='POST')return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  return fail('ORIGIN_REQUIRED',403);
 let candidate;
 try{candidate=await candidateSession(env,request);if(!candidate)return fail('SESSION_INVALID',401);}
 catch{return fail('SESSION_INVALID',401);}
 let input;
 try{
  const raw=await request.text();
  if(raw.length>65000)throw Error('too large');
  input=JSON.parse(raw);
 }catch{return fail('INVALID_RESUME_TEXT',400);}
 if(input?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
 const options=input?.options;
 if(typeof input?.text!=='string'||input.text.length>20000||
    input.text.replace(/\s/g,'').length<30||!options||
    options.country!=='CN'||options.remote_only!==false||
    typeof options.role_hint!=='string'||options.role_hint.length>80||
    !Number.isInteger(options.limit)||options.limit<1||options.limit>10)
  return fail('INVALID_RESUME_TEXT',400);
 if(input.resume_id!==null&&input.resume_id!==undefined&&input.resume_id!==''){
  if(typeof input.resume_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.resume_id))
   return fail('RESUME_NOT_FOUND',404);
  try{
   const own=await env.HHBA_PNVS_AUTH_DB.prepare(
    'SELECT id FROM hhba_candidate_resumes WHERE phone=? AND id=?'
   ).bind(candidate.phone,input.resume_id).first();
   if(!own)return fail('RESUME_NOT_FOUND',404);
  }catch{return fail('MATCH_HISTORY_DB_UNAVAILABLE',503);}
 }
 const redacted=redactForModel(input.text);
 if(redacted.replace(/\s/g,'').length<30)return fail('INVALID_RESUME_TEXT',400);
 // Same-origin, authorized one-shot call. No raw resume stored in HHBA database.
 const streaming=request.headers.get('Accept')?.includes('text/event-stream');
 if(streaming){
  const encoder=new TextEncoder();
  let ended=false;
  const abort=new AbortController();
  const readable=new ReadableStream({
   start(controller){
    const send=(type,data)=>{
     if(ended)return;
     try{controller.enqueue(encoder.encode('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n'))}
     catch{ended=true;}
    };
    send('progress',{stage:'preparing'});
    // The stream starts immediately; do not make ReadableStream.start await
    // the full DeepSeek model/search result before the browser can read.
    void (async()=>{
     const started=Date.now();
     let phase='preparing';
     const reportProgress=stage=>{phase=stage;send('progress',{stage});};
     const heartbeat=setInterval(()=>{
      if(!ended)send('heartbeat',{stage:phase,elapsed_ms:Date.now()-started});
     },12000);
     try{
      const {result,checkpoint}=await matchResumeWorkflow(env,candidate,redacted,options,{
       signal:abort.signal,onProgress:reportProgress,onActivity:detail=>{
        if(detail&&typeof detail==='object')
         send('activity',detail);
       },onPartial:matches=>send('partial',{matches})});
      if(abort.signal.aborted)return;
      console.info('HHBA_MATCH_NATIVE_RESULT',JSON.stringify(result.diagnostic));
      send('complete',await withSavedHistory(env,candidate,input,result));
      await checkpoint?.clear();
     }catch(e){
      const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
      const diagnostics=code==='AI_EMPLOYER_JOBS_NOT_FOUND'&&e?.diagnostic?
       e.diagnostic:undefined;
      console.warn('HHBA_MATCH_NATIVE_ERROR',JSON.stringify({
       code,phase,elapsed_ms:Date.now()-started,
       ...(diagnostics?{diagnostic:diagnostics}:{})
      }));
      send('failure',{error:code,phase,elapsed_ms:Date.now()-started,
       ...(diagnostics?{diagnostic:diagnostics}:{})});
     }finally{
      clearInterval(heartbeat);
      if(!ended){ended=true;try{controller.close()}catch{}}
     }
    })();
   },
   cancel(){ended=true;abort.abort();}
  });
  return new Response(readable,{status:200,headers:{
   'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private, no-store, no-transform',
   'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no',
   'Referrer-Policy':'no-referrer'
  }});
 }

 try{
  const {result,checkpoint}=await matchResumeWorkflow(env,candidate,redacted,options,{signal:request.signal});
  console.info('HHBA_MATCH_NATIVE_RESULT',JSON.stringify(result.diagnostic));
  const payload=await withSavedHistory(env,candidate,input,result);
  await checkpoint?.clear();
  return json(payload);
 }catch(e){
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
  console.warn('HHBA_MATCH_NATIVE_ERROR',JSON.stringify({code,...(code==='AI_EMPLOYER_JOBS_NOT_FOUND'&&e?.diagnostic?{diagnostic:e.diagnostic}:{})}));
  return fail(code,code==='AI_PROFILE_INCOMPLETE'?422:code==='AI_PROVIDER_RATE_LIMITED'?429:502);
 }
}
