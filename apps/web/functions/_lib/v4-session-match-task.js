// An encrypted, session-bound pointer to the current authorized research.
// No original file, bearer token, or resume text is stored in browser storage.
import {matchTaskKey,readMatchTask,saveMatchTask} from './v4-match-checkpoint-storage.js';
import {leaseMatchTask} from './ai-checkpoint-claim.js';
import {sessionValid} from './real-auth.js';
import {bindPaidMatchOrder,assertPaidMatchOrder,closePaidMatchBinding} from './v4-match-payment.js';

const SESSION_SLOT='00000000-0000-0000-0000-000000000000';
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export const taskError=(code,status=409)=>Object.assign(Error(code),{code,status});
export const sessionTaskSlot=(env,session)=>matchTaskKey(env,session.phone,SESSION_SLOT,{scope:'active-session-v1',session_hash:session.token_hash});
export const researchTaskKey=(env,session,task)=>matchTaskKey(env,session.phone,task.id,{text:task.text,role:task.role,excludeUrls:task.excludeUrls,resume_id:task.resume_id,policy:'curated-500-50-research-v5'});
export async function getSessionTask(env,session){
 const task=await readMatchTask(env,await sessionTaskSlot(env,session));
 return task?.id&&!task.closed?task:null;
}
const cancelKey=(env,session,id)=>matchTaskKey(env,session.phone,id,{scope:'cancelled-session-task-v1',session_hash:session.token_hash});
export async function updateSessionTask(env,session,action,input){
 if(!validId(input.id))throw taskError('AI_CHECKPOINT_INVALID',400);
 const slot=await sessionTaskSlot(env,session);
 const lease=await leaseMatchTask(env.HHBA_PNVS_AUTH_DB,slot);
 if(!lease)throw taskError('AI_TASK_IN_PROGRESS');
 try{
  const current=await getSessionTask(env,session);
  if(action==='start'){
   // Concurrent tabs attach to the existing task. They never replace its CV.
   if(current){await assertPaidMatchOrder(env,session,current);return current;}
   if(await readMatchTask(env,await cancelKey(env,session,input.id)))throw taskError('AI_AGENT_CANCELLED');
   const task={...input,generation:0,started_at:Date.now(),renewed_at:Date.now()};
   await bindPaidMatchOrder(env,session,task);
   await saveMatchTask(env,slot,task);
   return task;
  }
  if(action==='cancel'){
   // Explicit cancellation also fences a start that has not arrived yet.
   await saveMatchTask(env,await cancelKey(env,session,input.id),{cancelled:true});
   if(current?.id===input.id){await closePaidMatchBinding(env,session,current);await saveMatchTask(env,slot,{closed:true});}
   return null;
  }
  if(!current||current.id!==input.id||current.generation!==input.generation){
   if(action==='close')return null; // late close cannot affect a newer task
   throw taskError('AI_CHECKPOINT_INVALID');
  }
  if(action==='close'){
   // An encrypted tombstone does not contain the input CV. Late workers
   // cannot recreate the session slot; only an explicit start can do so.
   await closePaidMatchBinding(env,session,current);
   await saveMatchTask(env,slot,{closed:true});
   return null;
  }
  if(action==='continue'){
   await assertPaidMatchOrder(env,session,current);
   const saved=await readMatchTask(env,await researchTaskKey(env,session,current));
   if(saved?.generation!==current.generation||saved?.result?.status!=='COMPLETE'||!saved.result.can_continue||!saved.checkpoint)throw taskError('AI_CHECKPOINT_INVALID');
   const next={...current,generation:current.generation+1,renewed_at:Date.now()};
   await saveMatchTask(env,slot,next);
   return next;
  }
  throw taskError('INVALID_REQUEST',400);
 }finally{await lease.release();}
}
export async function assertSessionTaskActive(env,session,id,generation){
 // Read-only session check: a revoked/expired session stops server work even
 // if a browser cannot deliver a cancellation request.
 const row=await env.HHBA_PNVS_AUTH_DB.prepare('SELECT * FROM hhba_auth_sessions WHERE token_hash=?').bind(session.token_hash).first();
 if(!sessionValid(row,Date.now())||row.phone!==session.phone)throw taskError('AI_AGENT_CANCELLED',401);
 const task=await getSessionTask(env,session);
 if(!task||task.id!==id||task.generation!==generation)throw taskError('AI_AGENT_CANCELLED');
 await assertPaidMatchOrder(env,session,task);
 return task;
}

// Refresh only a still-authorized active slot under the same lease as cancel/close.
// Login validity and abandoned/completed record expiry are never extended blindly.
export async function renewActiveSessionTask(env,session,id,generation,now=Date.now()){
 const active=await assertSessionTaskActive(env,session,id,generation);
 if(now-(active.renewed_at||active.started_at||0)<3600000)return active;
 const slot=await sessionTaskSlot(env,session),lease=await leaseMatchTask(env.HHBA_PNVS_AUTH_DB,slot);
 if(!lease)return active;
 try{
  const current=await assertSessionTaskActive(env,session,id,generation);
  if(now-(current.renewed_at||current.started_at||0)<3600000)return current;
  const refreshed={...current,renewed_at:now};
  await saveMatchTask(env,slot,refreshed,now);
  return refreshed;
 }finally{await lease.release();}
}
