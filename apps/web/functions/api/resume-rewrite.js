// Preview-first whole-resume AI writer. Candidate-only, explicit third-party
// consent, never stores source documents or model responses in D1/R2.
// No artificial 5-suggestion/3-per-day product cap. External abuse controls
// and authenticated access remain mandatory before any production rollout.
import {generateTailoredResume,REWRITE_KIND,completeJson,validateAuthoring,numberTokens,redacted} from '../_lib/resume-rewrite-provider.js';
import {selectProvider} from '../_lib/resume-ai-provider.js';
import {hydrateVerifiedJobRequirements} from '../_lib/job-jd-archive.js';
import {runResumeEditorialAgent} from '../_lib/resume-rewrite-agent.js';
import {issueCheckpoint} from '../_lib/resume-rewrite-checkpoint.js';
import {responseJson as json,rejectJson as reject,rewriteActive as active,
 rewriteOriginOK as originOK,rewriteRequestJson as boundedJson,
 candidateIdentity,rewriteContinuationActive} from '../_lib/resume-rewrite-http.js';
export async function onRequestGet({env}){
 let configured=false;
 try{
  const {selectProvider}=await import('../_lib/resume-ai-provider.js');
  selectProvider(env,'resume_rewrite');configured=true;
 }catch{}
 return json({ok:true,kind:REWRITE_KIND,enabled:active(env)&&configured,
  configured,mode:env?.HHBA_RESUME_AGENT_ENABLED==='0'?'full_document_draft':'model_directed_editorial_agent',
  autonomy_enabled:env?.HHBA_RESUME_AGENT_ENABLED!=='0',
  continuation_enabled:rewriteContinuationActive(env),
  requires_user_approval:true});
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return reject('ORIGIN_REQUIRED',403);
 if(!active(env))return reject('RESUME_REWRITE_NOT_ENABLED',503);
 let account;
 try{account=await candidateIdentity(request,env);}
 catch(e){return reject(e?.message==='FORBIDDEN'?'FORBIDDEN':'SESSION_INVALID',
  e?.message==='FORBIDDEN'?403:401);}
 let body;
 try{body=await boundedJson(request,env);}
 catch(e){return reject(e?.message==='AI_REQUEST_SEGMENT_REQUIRED'?'AI_REQUEST_SEGMENT_REQUIRED':'INVALID_REQUEST',e?.message==='AI_REQUEST_SEGMENT_REQUIRED'?413:400);}
 if(body?.consent_ai!==true)return reject('AI_CONSENT_REQUIRED',400);
 let trustedJob;
 try{trustedJob=await hydrateVerifiedJobRequirements(env,body.job);}
 catch(e){return reject(String(e?.message||'JD_VERSION_NOT_AVAILABLE'),409)}
 try{
  // All requests remain explicit-consent, candidate-only and local to this
  // draft. The model may choose further editorial tools, not privileged I/O.
  const signal=env?.HHBA_MATCH_V4_READY==='1'?request.signal:AbortSignal.timeout(150000);
  if(env?.HHBA_MATCH_V4_READY==='1'&&env?.HHBA_RESUME_AGENT_ENABLED!=='0'&&!rewriteContinuationActive(env))return reject('AI_CHECKPOINT_NOT_CONFIGURED',503);
  const base=await generateTailoredResume({
   env,blocks:body.blocks,job:trustedJob,signal
  });
  if(env?.HHBA_RESUME_AGENT_ENABLED==='0')return json(base);
  const author=selectProvider(env,'resume_rewrite');
  let reviewer;
  try{reviewer=selectProvider(env,'resume_reviewer');}
  catch(e){if(e.message!=='AI_PROVIDER_NOT_CONFIGURED')throw e;reviewer=author;}
  try{
   // Signed continuation enables one model-selected tool per HTTP request.
   // Without the secret keep the established bounded legacy mode.
   const resumable=rewriteContinuationActive(env);
   const agentEnv=resumable?{...env,HHBA_RESUME_AGENT_MAX_PASSES:'1'}:env;
   const autonomous=await runResumeEditorialAgent({
    draft:base,blocks:body.blocks,job:trustedJob,env:agentEnv,
    provider:author,reviewer,
    completeJson,validateAuthoring,numberTokens,redacted,signal
   });
   if(resumable&&autonomous.autonomy?.needs_more_work){
    const token=await issueCheckpoint({env,account,blocks:body.blocks,
     job:trustedJob,draft:autonomous});
    return json({...autonomous,continuation:{enabled:true,checkpoint:token}});
   }
   return json(autonomous);
  }catch(e){
   // The independent initial writer+reviewer may already have produced a
   // trustworthy draft. Keep it, but never claim the autonomous passes ran.
   // No private resume, prompt or provider payload enters logs.
   const code=typeof e?.message==='string'&&e.message.startsWith('AI_PROVIDER_')?
    e.message:'AI_AGENT_REVIEW_UNAVAILABLE';
   console.warn('HHBA_AI_AGENT_REVIEW_INCOMPLETE',code);
   const recoverable={...base,autonomy:{enabled:true,rounds:0,stop_reason:'execution_round_guard',needs_more_work:true,tools_used:[]}};
   if(env?.HHBA_MATCH_V4_READY==='1'&&rewriteContinuationActive(env)&&['AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_JSON_INVALID','AI_PROVIDER_RESPONSE_TRUNCATED','AI_PROVIDER_STREAM_INTERRUPTED'].includes(code)){
    const checkpoint=await issueCheckpoint({env,account,blocks:body.blocks,job:trustedJob,draft:recoverable});
    return json({...recoverable,continuation:{enabled:true,checkpoint}});
   }
   return json({...recoverable,autonomy:{...recoverable.autonomy,stop_reason:'tool_unavailable'}});
  }
 }catch(e){
  const allowed=new Set(['INVALID_REWRITE_INPUT','AI_PROVIDER_NOT_CONFIGURED',
   'AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_RATE_LIMITED',
   'AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
   'AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_UPSTREAM_ERROR',
   'AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK_ERROR',
   'AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY',
   'AI_PROVIDER_RESPONSE_JSON_INVALID','AI_PROVIDER_RESPONSE_TRUNCATED',
   'AI_PROVIDER_RESPONSE_HTTP_INVALID','AI_PROVIDER_UNEXPECTED_REDIRECT','AI_PROVIDER_STREAM_INTERRUPTED','AI_PROVIDER_CONTEXT_EXCEEDED']);
  const code=allowed.has(e?.message)?e.message:'AI_RESUME_REWRITE_FAILED';
  // Never log resume text, provider payloads, credentials or private names.
  console.warn('HHBA_FULL_REWRITE_FAILED',code);
  return reject(code,code==='INVALID_REWRITE_INPUT'?400:
   code==='AI_PROVIDER_RATE_LIMITED'?429:code==='AI_PROVIDER_NOT_CONFIGURED'?503:502);
 }
}
