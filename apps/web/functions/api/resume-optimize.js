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
const LEGACY_MAX_BODY=2*1024*1024,V4_TRANSPORT_BYTES=16*1024*1024,MAX_BLOCKS=12,MAX_GLOBAL=50,MAX_PERSONAL=3;
const MAX_GLOBAL_ATTEMPTS=120,MAX_PERSONAL_ATTEMPTS=6;
// Separate paid AI optimization quotas from unrelated matching services.
// Preview still supports its existing shared secret until separately migrated.
const quotaPepper=env=>typeof env?.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER==='string'&&
 env.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER.length>=24?
 env.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER:env?.HHBA_MATCH_LIMIT_PEPPER;
function active(env){
 return (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  env?.HHBA_RESUME_OPTIMIZATION_ENABLED==='1'&&
  typeof quotaPepper(env)==='string'&&quotaPepper(env).length>=24&&
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
async function dbReady(db){
 try{
  const result=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hhba_resume_optimization_requests','hhba_resume_optimization_attempts')").all();
  const names=new Set((result?.results||[]).map(r=>r.name));
  return names.has('hhba_resume_optimization_requests')&&
   names.has('hhba_resume_optimization_attempts');
 }catch{return false;}
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
async function readSmallJson(request,env){
 // Bound transport memory, not the model's research or response length.
 const MAX_BODY=env?.HHBA_MATCH_V4_READY==='1'?V4_TRANSPORT_BYTES:LEGACY_MAX_BODY;
 const declared=request.headers.get('Content-Length');
 if(!request.body||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw Error('OPTIMIZATION_PAYLOAD_TOO_LARGE');
 const reader=request.body.getReader();let bytes=0;const chunks=[];
 try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;
  if(bytes>MAX_BODY){await reader.cancel();throw Error('OPTIMIZATION_PAYLOAD_TOO_LARGE');}chunks.push(x.value);}
 }finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{throw Error('INVALID_REQUEST');}
}
function valid(body,env){
 if(!body||Array.isArray(body)||typeof body!=='object'||body.consent_ai!==true||
  !Array.isArray(body.blocks)||body.blocks.length<1)return false;
 if(!body.job||typeof body.job!=='object'||typeof body.job.title!=='string'||
  body.job.title.length<2||body.job.title.length>120||
  typeof body.job.requirements!=='string'||(env?.HHBA_MATCH_V4_READY!=='1'&&body.job.requirements.length>16000))return false;
 const doc=body.full_document;
 if(doc===undefined&&body.blocks.length>MAX_BLOCKS)return false;
 if(doc!==undefined&&(!doc||Array.isArray(doc)||typeof doc!=='object'||
  !/^jd_[a-f0-9]{32}$/.test(body.job.jd_version_id||'')||!/^[a-f0-9]{64}$/.test(body.job.jd_sha256||'')||
  typeof doc.text!=='string'||(env?.HHBA_MATCH_V4_READY!=='1'&&doc.text.length>50000)||
  (doc.feedback!==undefined&&typeof doc.feedback!=='string')||
  (doc.wanted!==undefined&&(!Array.isArray(doc.wanted)||!doc.wanted.length||
   doc.wanted.length>body.blocks.length))))return false;
 if(doc?.review_feedback!==undefined&&(!doc.review_feedback||Array.isArray(doc.review_feedback)||typeof doc.review_feedback!=='object'||Object.values(doc.review_feedback).some(value=>typeof value!=='string')))return false;
 const ids=new Set();
 const blocksValid=body.blocks.every(b=>{
  if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(b.id)||
   typeof b.text!=='string'||!b.text.trim()||((env?.HHBA_MATCH_V4_READY!=='1'||!doc)&&b.text.length>1600)||ids.has(b.id))return false;
  ids.add(b.id);return ['experience','skills','summary','education','projects'].includes(b.section);
 });
 return blocksValid&&(!doc?.wanted||doc.wanted.every(id=>ids.has(id)))&&(!doc?.review_feedback||Object.keys(doc.review_feedback).every(id=>ids.has(id)));
}
function redact(text){
 return text.replace(/[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi,'[邮箱已脱敏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[电话已脱敏]')
  .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[证件号已脱敏]');
}
async function reserveAttempt(db,hash){
 const id=crypto.randomUUID(),time=new Date().toISOString(),day=time.slice(0,10);
 const result=await db.prepare(
  'INSERT INTO hhba_resume_optimization_attempts(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_attempts WHERE day_utc=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_attempts WHERE day_utc=? AND account_hash=?)<?'
 ).bind(id,day,hash,time,day,MAX_GLOBAL_ATTEMPTS,day,hash,MAX_PERSONAL_ATTEMPTS).run();
 return result?.success===true&&result?.meta?.changes===1?id:null;
}
async function reserve(db,hash){
 const id=crypto.randomUUID(),time=new Date().toISOString(),day=time.slice(0,10);
 const row=await db.prepare(
  'INSERT INTO hhba_resume_optimization_requests(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_requests WHERE day_utc=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_requests WHERE day_utc=? AND account_hash=?)<?'
 ).bind(id,day,hash,time,day,MAX_GLOBAL,day,hash,MAX_PERSONAL).run();
 return row?.success===true&&row?.meta?.changes===1?id:null;
}
async function releaseFailedRequest(db,requestId,hash){
 if(!requestId)return;
 await db.prepare('DELETE FROM hhba_resume_optimization_requests WHERE request_id=? AND account_hash=?')
  .bind(requestId,hash).run();
}
export async function onRequestGet({env}){
 let configured=false;
 try{selectProvider(env);configured=true;}catch{}
 return send({kind:'HHBA_RESUME_OPTIMIZATION_V1',enabled:active(env)&&configured&&(env?.HHBA_MATCH_V4_READY==='1'||await dbReady(env.HHBA_PNVS_AUTH_DB)),
  full_document_enabled:active(env)&&configured&&await taskReady(env.HHBA_PNVS_AUTH_DB),
  configured,per_account_daily_limit:env?.HHBA_MATCH_V4_READY==='1'?null:MAX_PERSONAL,global_daily_limit:env?.HHBA_MATCH_V4_READY==='1'?null:MAX_GLOBAL,
  per_account_daily_attempt_limit:env?.HHBA_MATCH_V4_READY==='1'?null:MAX_PERSONAL_ATTEMPTS,global_daily_attempt_limit:env?.HHBA_MATCH_V4_READY==='1'?null:MAX_GLOBAL_ATTEMPTS});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!active(env))return fail('RESUME_OPTIMIZATION_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(env?.HHBA_MATCH_V4_READY!=='1'&&!await dbReady(db))return fail('RESUME_OPTIMIZATION_DB_NOT_READY',503);
 try{selectProvider(env);}catch{return fail('AI_PROVIDER_NOT_CONFIGURED',503);}
 let session;
 try{session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let input;
 try{input=await readSmallJson(request,env);}catch(error){return error?.message==='OPTIMIZATION_PAYLOAD_TOO_LARGE'?fail('OPTIMIZATION_PAYLOAD_TOO_LARGE',413):fail('INVALID_REQUEST',400);}
 if(!valid(input,env))return fail('INVALID_OPTIMIZATION_INPUT',400);
 let trustedJob;
 try{trustedJob=await hydrateVerifiedJobRequirements(env,input.job);}
 catch(e){
  const code=String(e?.message||'JD_VERSION_NOT_AVAILABLE');
  return fail(code,code==='JD_VERIFIED_VERSION_REQUIRED'||code==='JD_JOB_IDENTITY_MISMATCH'?422:409);
 }
 const hash=await sha256Hex(quotaPepper(env)+':resume-opt:'+session.phone);
 let requestId,lease,renewTimer;
 try{
  if(input.full_document){
   if(!await taskReady(db))return fail('RESUME_OPTIMIZATION_TASK_DB_NOT_READY',503);
   lease=await reserveResumeOptimizationTask(db,hash,{
    jd:trustedJob.jd_version_id,blocks:input.blocks,text:input.full_document.text
   },{unrestricted:env?.HHBA_MATCH_V4_READY==='1'});
   if(lease?.duplicate)return fail('RESUME_OPTIMIZATION_IN_PROGRESS',409);
   if(!lease)return fail('RESUME_OPTIMIZATION_QUEUED',409);
   if(lease.renew)renewTimer=setInterval(()=>{void lease.renew().catch(()=>{});},60000);
  }else{
   if(env?.HHBA_MATCH_V4_READY!=='1'){
    if(!await reserveAttempt(db,hash))return fail('RESUME_OPTIMIZATION_ATTEMPT_LIMIT',429);
    requestId=await reserve(db,hash);
    if(!requestId)return fail('RESUME_OPTIMIZATION_LIMIT',429);
   }
  }
 }catch{return fail('RESUME_OPTIMIZATION_DB_NOT_READY',503);}
 // Mask common contact identifiers before third-party processing.
 const blocks=input.blocks.map(b=>({id:b.id,section:b.section,text:redact(b.text),...(b.paragraphEditable===true?{paragraphEditable:true}:{})}));
 const priorAnalysis=env?.HHBA_MATCH_V4_READY==='1'?preparePriorMatchAnalysis(input.job.prior_match_analysis,trustedJob,redact):undefined;
 const job={title:redact(trustedJob.title),requirements:redact(trustedJob.requirements),
  ...(priorAnalysis?{prior_match_analysis:priorAnalysis}:{}),
  verified:['VERIFIED_OFFICIAL_JD','VERIFIED_PUBLIC_JD'].includes(trustedJob.source_status)};
 try{
  const signal=env?.HHBA_MATCH_V4_READY==='1'?request.signal:AbortSignal.any([request.signal,AbortSignal.timeout(input.full_document?180000:90000)]);
  const whole=input.full_document?await optimizeResumeDocument({
   env,blocks,context:redact(input.full_document.text),job,signal,wanted:input.full_document.wanted,
   feedback:env?.HHBA_MATCH_V4_READY==='1'&&input.full_document.feedback?redact(input.full_document.feedback):undefined,
   reviewFeedback:env?.HHBA_MATCH_V4_READY==='1'?Object.fromEntries(Object.entries(input.full_document.review_feedback||{}).map(([id,value])=>[id,redact(value)])):{}
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
  // An empty or fully rejected suggestion set is not a successful optimization.
  // Refund only this request's success allocation; preserve attempt accounting.
  if(suggestions.length===0&&requestId){
   try{await releaseFailedRequest(db,requestId,hash);}
   catch{console.warn('HHBA_RESUME_OPT_EMPTY_REFUND_FAILED');}
  }
  // Operational diagnostics only: never log resume text, prompts, job URLs or identity.
  if(whole&&env?.HHBA_MATCH_V4_READY==='1')console.info('HHBA_RESUME_OPTIMIZATION_PROGRESS',JSON.stringify({
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
  // Failed provider calls restore the *successful* daily allowance, while the
  // separate attempt ledger remains consumed to bound repeated paid retries.
  try{if(requestId)await releaseFailedRequest(db,requestId,hash);}catch{console.warn('HHBA_RESUME_OPT_QUOTA_RELEASE_FAILED');}
  console.warn('HHBA_RESUME_OPTIMIZATION_FAILED',code);
  return fail(code,code==='AI_PROVIDER_RATE_LIMITED'?429:
   code==='AI_PROVIDER_NOT_CONFIGURED'?503:502);
 }finally{
  if(renewTimer)clearInterval(renewTimer);
  if(lease)await lease.release().catch(()=>console.warn('HHBA_RESUME_OPTIMIZATION_LEASE_RELEASE_FAILED'));
 }
}
