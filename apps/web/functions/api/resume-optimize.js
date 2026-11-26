// Candidate-only, opt-in, server-side AI resume suggestion route.
// No API key, resume content or session token is stored in D1 or response logs.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {generateSuggestions,selectProvider} from '../_lib/resume-ai-provider.js';
import {hydrateVerifiedJobRequirements} from '../_lib/job-jd-archive.js';
import {preparePriorMatchAnalysis} from '../_lib/resume-match-analysis-handoff.js';
import {auditTargetedResumeSuggestions} from '../_lib/resume-rewrite-provider.js';
import {optimizeResumeDocument,reserveResumeOptimizationTask} from '../_lib/resume-optimization-task.js';

const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status)=>send({ok:false,error:code},status);
const V4_TRANSPORT_BYTES=16*1024*1024,MAX_BLOCKS=12;
// Preserve the existing secret for account-scoped duplicate-task leases.
// No legacy daily allowance or attempt ledger is consulted.
const quotaPepper=env=>typeof env?.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER==='string'&&
 env.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER.length>=24?
 env.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER:env?.HHBA_MATCH_LIMIT_PEPPER;
function active(env){
 return (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  env?.HHBA_RESUME_OPTIMIZATION_ENABLED==='1'&&env?.HHBA_MATCH_V4_READY==='1'&&
  typeof quotaPepper(env)==='string'&&quotaPepper(env).length>=24&&
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
async function taskReady(db){
 try{
  const row=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_optimization_tasks'").first();
  return row?.name==='hhba_resume_optimization_tasks';
 }catch{return false;}
}
function sameOrigin(request){
 const url=new URL(request.url);
 return request.headers.get('Origin')===url.origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function readSmallJson(request){
 // Bound transport memory, not the model's research or response length.
 const MAX_BODY=V4_TRANSPORT_BYTES;
 const declared=request.headers.get('Content-Length');
 if(!request.body||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw Error('OPTIMIZATION_PAYLOAD_TOO_LARGE');
 const reader=request.body.getReader();let bytes=0;const chunks=[];
 try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;
  if(bytes>MAX_BODY){await reader.cancel();throw Error('OPTIMIZATION_PAYLOAD_TOO_LARGE');}chunks.push(x.value);}
 }finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{throw Error('INVALID_REQUEST');}
}
function valid(body){
 if(!body||Array.isArray(body)||typeof body!=='object'||body.consent_ai!==true||
  !Array.isArray(body.blocks)||body.blocks.length<1)return false;
 if(!body.job||typeof body.job!=='object'||typeof body.job.title!=='string'||
  !body.job.title.trim()||typeof body.job.requirements!=='string')return false;
 const reference=body.job.reference_jd_kind==='AI_GENERATED_REFERENCE'&&!body.job.jd_version_id&&!body.job.jd_sha256&&typeof body.job.official_url==='string'&&typeof body.job.reference_jd_basis==='string'&&body.job.reference_jd_basis.trim()&&body.job.requirements.trim();
 const doc=body.full_document;
 if(doc===undefined&&body.blocks.length>MAX_BLOCKS)return false;
 if(doc!==undefined&&(!doc||Array.isArray(doc)||typeof doc!=='object'||
  (!reference&&(!/^jd_[a-f0-9]{32}$/.test(body.job.jd_version_id||'')||!/^[a-f0-9]{64}$/.test(body.job.jd_sha256||'')))||
  typeof doc.text!=='string'||
  (doc.feedback!==undefined&&typeof doc.feedback!=='string')||
  (doc.wanted!==undefined&&(!Array.isArray(doc.wanted)||!doc.wanted.length||
   doc.wanted.length>body.blocks.length))))return false;
 if(doc?.review_feedback!==undefined&&(!doc.review_feedback||Array.isArray(doc.review_feedback)||typeof doc.review_feedback!=='object'||Object.values(doc.review_feedback).some(value=>typeof value!=='string')))return false;
 const ids=new Set();
 const blocksValid=body.blocks.every(b=>{
  if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(b.id)||
   typeof b.text!=='string'||!b.text.trim()||(!doc&&b.text.length>1600)||ids.has(b.id))return false;
  ids.add(b.id);return ['experience','skills','summary','education','projects'].includes(b.section);
 });
 return blocksValid&&(!doc?.wanted||doc.wanted.every(id=>ids.has(id)))&&(!doc?.review_feedback||Object.keys(doc.review_feedback).every(id=>ids.has(id)));
}
function redact(text){
 return text.replace(/[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi,'[邮箱已脱敏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[电话已脱敏]')
  .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[证件号已脱敏]');
}
export async function onRequestGet({env}){
 let configured=false;
 try{selectProvider(env);configured=true;}catch{}
 return send({kind:'HHBA_RESUME_OPTIMIZATION_V1',enabled:active(env)&&configured,
  full_document_enabled:active(env)&&configured&&await taskReady(env.HHBA_PNVS_AUTH_DB),
  configured,per_account_daily_limit:null,global_daily_limit:null,
  per_account_daily_attempt_limit:null,global_daily_attempt_limit:null});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!active(env))return fail('RESUME_OPTIMIZATION_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 try{selectProvider(env);}catch{return fail('AI_PROVIDER_NOT_CONFIGURED',503);}
 let session;
 try{session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let input;
 try{input=await readSmallJson(request);}catch(error){return error?.message==='OPTIMIZATION_PAYLOAD_TOO_LARGE'?fail('OPTIMIZATION_PAYLOAD_TOO_LARGE',413):fail('INVALID_REQUEST',400);}
 if(!valid(input))return fail('INVALID_OPTIMIZATION_INPUT',400);
 let trustedJob;
 try{
  if(input.job.reference_jd_kind==='AI_GENERATED_REFERENCE'&&!input.job.jd_version_id&&!input.job.jd_sha256){
   const url=new URL(input.job.official_url);if(url.protocol!=='https:'||url.username||url.password||url.port||!input.job.requirements.trim()||typeof input.job.reference_jd_basis!=='string'||!input.job.reference_jd_basis.trim())throw Error('JD_INVALID_JOB');
   // Client-supplied reference is user-directed context only, never official evidence.
   trustedJob={title:input.job.title,official_url:url.href,requirements:'以下是AI生成或用户提供的职业方向参考，不是企业实际招聘条件。不得将推断作为硬性资格或新增个人事实。\n参考依据：'+input.job.reference_jd_basis+'\n参考JD：\n'+input.job.requirements,source_status:'AI_REFERENCE_JD'};
  }else trustedJob=await hydrateVerifiedJobRequirements(env,input.job);
 }
 catch(e){
  const code=String(e?.message||'JD_VERSION_NOT_AVAILABLE');
  return fail(code,code==='JD_VERIFIED_VERSION_REQUIRED'||code==='JD_JOB_IDENTITY_MISMATCH'?422:409);
 }
 const hash=await sha256Hex(quotaPepper(env)+':resume-opt:'+session.phone);
 let lease,renewTimer;
 try{
  if(input.full_document){
   if(!await taskReady(db))return fail('RESUME_OPTIMIZATION_TASK_DB_NOT_READY',503);
   lease=await reserveResumeOptimizationTask(db,hash,{
    jd:trustedJob.jd_version_id||await sha256Hex(JSON.stringify([trustedJob.official_url,trustedJob.requirements])),blocks:input.blocks,text:input.full_document.text
   },{unrestricted:true});
   if(lease?.duplicate)return fail('RESUME_OPTIMIZATION_IN_PROGRESS',409);
   if(!lease)return fail('RESUME_OPTIMIZATION_QUEUED',409);
   if(lease.renew)renewTimer=setInterval(()=>{void lease.renew().catch(()=>{});},60000);
  }
 }catch{return fail('RESUME_OPTIMIZATION_DB_NOT_READY',503);}
 // Mask common contact identifiers before third-party processing.
 const blocks=input.blocks.map(b=>({id:b.id,section:b.section,text:redact(b.text),...(b.paragraphEditable===true?{paragraphEditable:true}:{}),...(Number.isSafeInteger(b.occurrence)&&Number.isSafeInteger(b.occurrenceCount)&&b.wordContext?{occurrence:b.occurrence,occurrenceCount:b.occurrenceCount,wordContext:{paragraph:b.wordContext.paragraph,previous:redact(String(b.wordContext.previous||'')),next:redact(String(b.wordContext.next||''))}}:{})}));
 const priorAnalysis=preparePriorMatchAnalysis(input.job.prior_match_analysis,trustedJob,redact);
 const job={title:redact(trustedJob.title),requirements:redact(trustedJob.requirements),
  ...(priorAnalysis?{prior_match_analysis:priorAnalysis}:{}),
  verified:['VERIFIED_OFFICIAL_JD','VERIFIED_PUBLIC_JD'].includes(trustedJob.source_status)};
 try{
  const signal=request.signal;
  const whole=input.full_document?await optimizeResumeDocument({
   env,blocks,context:redact(input.full_document.text),job,signal,wanted:input.full_document.wanted,
   feedback:input.full_document.feedback?redact(input.full_document.feedback):undefined,
   reviewFeedback:Object.fromEntries(Object.entries(input.full_document.review_feedback||{}).map(([id,value])=>[id,redact(value)]))
  }):null;
  const result=whole||await generateSuggestions({env,blocks,job,signal});
  const checked=job.verified&&!whole?await auditTargetedResumeSuggestions({
   env,blocks,job,suggestions:result.suggestions,signal
  }):result.suggestions;
  const originalById=new Map(input.blocks.map(b=>[b.id,b.text]));
  const suggestions=checked.filter(s=>originalById.has(s.blockId)).map(s=>({
   ...s,original:originalById.get(s.blockId),
   // AI is never authoritative evidence of a new fact. User must explicitly accept.
   evidenceStatus:'needs_user_confirmation'
  }));
  // Operational diagnostics only: never log resume text, prompts, job URLs or identity.
  if(whole)console.info('HHBA_RESUME_OPTIMIZATION_PROGRESS',JSON.stringify({
   requested:input.full_document.wanted?.length??blocks.length,
   pending:whole.pendingIds.length,suggestions:suggestions.length,
   pause_reason:whole.pauseReason||null
  }));
  return send({ok:true,kind:'HHBA_RESUME_OPTIMIZATION_V1',provider:result.provider,suggestions,
   ...(whole?{pending_block_ids:whole.pendingIds,...(Object.keys(whole.reviewFeedback||{}).length?{review_feedback:whole.reviewFeedback}:{}),...(whole.pauseReason?{pause_reason:whole.pauseReason}:{})}:{}),
   jd_version_id:trustedJob.jd_version_id||null,jd_source_status:trustedJob.source_status,
   disclaimer:'建议仅用于优化表达，用户须逐条核实；不会修改原始简历或自动提高岗位匹配分。'});
 }catch(error){
  const allowed=new Set(['AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED',
   'AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
   'AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_REQUEST_REJECTED',
   'AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_UNEXPECTED_REDIRECT','AI_PROVIDER_NETWORK_ERROR',
   'AI_PROVIDER_TIMEOUT','AI_PROVIDER_RESPONSE_INVALID',
   'AI_PROVIDER_RESPONSE_HTTP_INVALID','AI_PROVIDER_RESPONSE_TRUNCATED',
   'AI_PROVIDER_RESPONSE_EMPTY','AI_PROVIDER_RESPONSE_JSON_INVALID',
   'AI_PROVIDER_SUGGESTION_SCHEMA_INVALID']);
  const code=allowed.has(error?.message)?error.message:'AI_OPTIMIZATION_UNAVAILABLE';
  console.warn('HHBA_RESUME_OPTIMIZATION_FAILED',code);
  return fail(code,code==='AI_PROVIDER_RATE_LIMITED'?429:
   code==='AI_PROVIDER_NOT_CONFIGURED'?503:502);
 }finally{
  if(renewTimer)clearInterval(renewTimer);
  if(lease)await lease.release().catch(()=>console.warn('HHBA_RESUME_OPTIMIZATION_LEASE_RELEASE_FAILED'));
 }
}
