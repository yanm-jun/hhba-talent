/**
 * One authenticated continuation of HHBA's model-driven resume editor.
 * A signed checkpoint binds an immutable candidate + source + draft;
 * the model chooses the next editorial tool. Each request performs only
 * one decision (and, if elected, one independently audited rewrite).
 * No Cloudflare containers, queues, paid plans or persistent D1 writes.
 */
import {responseJson as json,rejectJson as reject,rewriteActive,
 rewriteOriginOK,rewriteRequestJson,candidateIdentity,rewriteContinuationActive}
 from '../_lib/resume-rewrite-http.js';
import {REWRITE_KIND,completeJson,validateAuthoring,numberTokens,redacted}
 from '../_lib/resume-rewrite-provider.js';
import {selectProvider} from '../_lib/resume-ai-provider.js';
import {hydrateVerifiedJobRequirements} from '../_lib/job-jd-archive.js';
import {runResumeEditorialAgent} from '../_lib/resume-rewrite-agent.js';
import {issueCheckpoint,verifyCheckpoint,publicDraft}
 from '../_lib/resume-rewrite-checkpoint.js';

const allowedSections=new Set(['summary','experience','skills','education','projects']);
function validContinuation(body){
 if(!body||body.consent_ai!==true||
  !Array.isArray(body.blocks)||body.blocks.length<1||
  body.blocks.length>512||!body.job||typeof body.job!=='object'||
  typeof body.job.title!=='string'||!body.job.title.trim()||
  body.job.title.length>180||
  typeof body.job.requirements!=='string'||body.job.requirements.length>250000)
  return false;
 const ids=new Set();
 if(!body.blocks.every(b=>b&&typeof b.id==='string'&&
  /^[a-zA-Z0-9_-]{1,64}$/.test(b.id)&&!ids.has(b.id)&&
  (ids.add(b.id),true)&&allowedSections.has(b.section)&&
  typeof b.text==='string'&&b.text.trim()&&b.text.length<=8000))
  return false;
 const draft=body.draft;
 if(!draft||draft.ok!==true||draft.kind!==REWRITE_KIND||
  !Array.isArray(draft.blocks)||draft.blocks.length!==ids.size||
  !Array.isArray(draft.questions)||!Array.isArray(draft.warnings)||
  draft.autonomy?.enabled!==true||draft.autonomy?.needs_more_work!==true||
  draft.autonomy?.stop_reason!=='execution_round_guard'||
  !Array.isArray(draft.autonomy.tools_used)||
  draft.coverage?.analyzed_blocks!==ids.size)
  return false;
 const byId=new Map(body.blocks.map(b=>[b.id,b]));
 const used=new Set();
 return draft.blocks.every(block=>{
  const original=byId.get(block?.blockId);
  if(!original||used.has(block.blockId))return false;
  used.add(block.blockId);
  return block.original===original.text&&block.section===original.section&&
   typeof block.proposed==='string'&&block.proposed.length<=36000&&
   ['needs_user_confirmation','kept_original'].includes(block.status);
 });
}
export async function onRequestPost({request,env}){
 if(!rewriteOriginOK(request))return reject('ORIGIN_REQUIRED',403);
 if(!rewriteContinuationActive(env))
  return reject('RESUME_REWRITE_NOT_ENABLED',503);
 let account;
 try{account=await candidateIdentity(request,env);}
 catch(e){return reject(e?.message==='FORBIDDEN'?'FORBIDDEN':'SESSION_INVALID',
  e?.message==='FORBIDDEN'?403:401);}
 let body;
 try{body=await rewriteRequestJson(request);}
 catch{return reject('INVALID_REQUEST',400);}
 if(body?.consent_ai!==true)return reject('AI_CONSENT_REQUIRED',400);
 if(!validContinuation(body))return reject('INVALID_REWRITE_INPUT',400);
 let trustedJob;
 try{trustedJob=await hydrateVerifiedJobRequirements(env,body.job);}
 catch(e){return reject(String(e?.message||'JD_VERSION_NOT_AVAILABLE'),409)}
 try{
  await verifyCheckpoint({env,account,blocks:body.blocks,
   job:trustedJob,draft:body.draft,token:body.checkpoint});
 }catch(e){
  const code=e?.message==='AI_CHECKPOINT_EXPIRED'?
   'AI_CHECKPOINT_EXPIRED':e?.message==='AI_CHECKPOINT_NOT_CONFIGURED'?
   'AI_CHECKPOINT_NOT_CONFIGURED':'AI_CHECKPOINT_INVALID';
  return reject(code,code==='AI_CHECKPOINT_NOT_CONFIGURED'?503:409);
 }
 try{
  const author=selectProvider(env,'resume_rewrite');
  let reviewer;
  try{reviewer=selectProvider(env,'resume_reviewer');}
  catch(e){if(e.message!=='AI_PROVIDER_NOT_CONFIGURED')throw e;reviewer=author;}
  const result=await runResumeEditorialAgent({
   draft:publicDraft(body.draft),blocks:body.blocks,job:trustedJob,
   env:{...env,HHBA_RESUME_AGENT_MAX_PASSES:'1'},
   provider:author,reviewer,completeJson,validateAuthoring,numberTokens,
   redacted,signal:env?.HHBA_MATCH_V4_READY==='1'?request.signal:AbortSignal.timeout(150000)
  });
  if(result.autonomy?.needs_more_work){
   const token=await issueCheckpoint({
    env,account,blocks:body.blocks,job:trustedJob,draft:result
   });
   return json({...result,continuation:{enabled:true,checkpoint:token}});
  }
  return json({...result,continuation:{enabled:false}});
 }catch(e){
  const code=typeof e?.message==='string'&&
   /^(AI_PROVIDER_|AI_CHECKPOINT_)/.test(e.message)?
   e.message:'AI_AGENT_CONTINUATION_FAILED';
  // The client retains its last fact-checked draft; never log sensitive data.
  console.warn('HHBA_RESUME_AGENT_STEP_ERROR',code);
  return reject(code,code==='AI_PROVIDER_RATE_LIMITED'?429:502);
 }
}
