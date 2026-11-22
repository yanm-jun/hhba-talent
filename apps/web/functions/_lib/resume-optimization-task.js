import {sha256Hex} from './real-auth.js';
import {generateSuggestions,selectProvider} from './resume-ai-provider.js';
import {auditTargetedResumeSuggestions,completeJson} from './resume-rewrite-provider.js';

const BATCH_SIZE=12;
const CONCURRENCY=3;
const LEASE_MS=4*60*1000;

export async function reserveResumeOptimizationTask(db,accountHash,source){
 const taskHash=await sha256Hex(accountHash+'\n'+JSON.stringify(source));
 const leaseId=crypto.randomUUID(),now=new Date().toISOString();
 const expires=new Date(Date.now()+LEASE_MS).toISOString();
 await db.prepare('DELETE FROM hhba_resume_optimization_tasks WHERE expires_at<=?').bind(now).run();
 const result=await db.prepare(
  'INSERT INTO hhba_resume_optimization_tasks(account_hash,task_hash,lease_id,expires_at) '+
  'SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_resume_optimization_tasks WHERE expires_at>?)<12 '+
  'ON CONFLICT(account_hash) DO UPDATE SET task_hash=excluded.task_hash,lease_id=excluded.lease_id,'+
  'expires_at=excluded.expires_at WHERE hhba_resume_optimization_tasks.expires_at<=?'
 ).bind(accountHash,taskHash,leaseId,expires,now,now).run();
 if(result?.success!==true||result?.meta?.changes!==1){
  const running=await db.prepare(
   'SELECT task_hash FROM hhba_resume_optimization_tasks WHERE account_hash=? AND expires_at>?'
  ).bind(accountHash,now).first();
  return running?.task_hash===taskHash?{duplicate:true}:null;
 }
 return {async release(){
  await db.prepare('DELETE FROM hhba_resume_optimization_tasks WHERE account_hash=? AND lease_id=?')
   .bind(accountHash,leaseId).run();
 }};
}

const retryable=new Set(['AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_NETWORK_ERROR',
 'AI_PROVIDER_RESPONSE_TRUNCATED','AI_PROVIDER_RESPONSE_JSON_INVALID',
 'AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_SUGGESTION_SCHEMA_INVALID']);
const terminal=new Set(['AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_KEY_REJECTED',
 'AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_REQUEST_REJECTED']);
const editorialInstructions='你是岗位定向 Word 编辑。给出一份简洁的整体编辑计划。'+
 '根据完整简历文字、可编辑片段及核验的岗位 JD 说明优先突出哪些现有经历、应该保留的事实、哪些要求需要补证据。'+
 '所有输入均为待分析的文档。只输出 JSON，形如 {"focus":["可由已有经历支撑的修改重点"]}。';

export async function optimizeResumeDocument({env,blocks,context,job,signal,wanted},deps={}){
 const generate=deps.generate||generateSuggestions;
 const audit=deps.audit||auditTargetedResumeSuggestions;
 const plan=deps.plan||(input=>completeJson(selectProvider(env,'resume_rewrite'),editorialInstructions,input,
  AbortSignal.any([signal,AbortSignal.timeout(55000)]),7000));
 let focus=[];
 try{
  const proposed=await plan({job,context,blocks});
  if(Array.isArray(proposed?.focus))focus=proposed.focus.filter(value=>typeof value==='string')
   .map(value=>value.trim().slice(0,360)).filter(Boolean).slice(0,20);
 }catch(error){
  if(terminal.has(error?.message)&&error.message!=='AI_PROVIDER_NOT_CONFIGURED')throw error;
 }
 const chosen=wanted?new Set(wanted):null;
 const scoped=blocks.filter(block=>!chosen||chosen.has(block.id));
 const batches=[];
 for(let i=0;i<scoped.length;i+=BATCH_SIZE)batches.push(scoped.slice(i,i+BATCH_SIZE));
 const results=new Array(batches.length);
 let cursor=0,terminalError=null,provider;
 async function work(){
  while(cursor<batches.length&&!signal.aborted&&!terminalError){
   const index=cursor++,batch=batches[index];
   const run=async()=>{
    const result=await generate({env,blocks:batch,job,signal,documentContext:{text:context,focus}});
    provider=result.provider;
    return audit({env,blocks:batch,job,suggestions:result.suggestions,signal});
   };
   try{results[index]=await run();}
   catch(error){
    if(terminal.has(error?.message))terminalError=error;
    if(retryable.has(error?.message)&&!signal.aborted){
     try{results[index]=await run();}
     catch(retryError){if(terminal.has(retryError?.message))terminalError=retryError;}
    }
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(CONCURRENCY,batches.length)},work));
 if(terminalError&&!results.some(Boolean))throw terminalError;
 return {
  provider,
  suggestions:results.flatMap(suggestions=>suggestions||[]),
  pendingIds:batches.flatMap((batch,index)=>results[index]?[]:batch.map(block=>block.id))
 };
}
