import {metricDb,isoDay} from './metric-utils.js';
export const STAGE_EFFORT=Object.freeze({format:'medium',identity:'medium',jd_extract:'medium',jd_coverage:'medium',jd_search:'medium',jd_reference:'medium',profile:'medium',discovery:'medium',score:'medium',rank:'medium',report:'medium',resume_ocr:'medium',resume_optimization:'medium',resume_reassess:'medium',probe:null,other:'medium'});
export function usageStage(stage){return Object.hasOwn(STAGE_EFFORT,stage)?stage:'other'}
export function stageEffort(provider,stage){
 // Normal GPT-6 business calls use medium, even if an old global high override remains.
 // Capability probes and other models preserve their explicit configuration.
 return (/^gpt-6(?:\.|-)/i.test(provider.model||'')?STAGE_EFFORT[usageStage(stage)]:null)||provider.reasoningEffort||null;
}
const integer=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function usageCounts(usage){
 const input=integer(usage?.input_tokens),output=integer(usage?.output_tokens),total=integer(usage?.total_tokens);
 const reasoning=integer(usage?.output_tokens_details?.reasoning_tokens),cached=integer(usage?.input_tokens_details?.cached_tokens);
 return {input,output,total,reasoning,cached,known:input!==null&&output!==null&&total!==null};
}
export async function recordAiUsage(db,{model,stage,effort,status,usage}){
 if(!db)return;
 try{
  const u=usageCounts(usage);
  const safeModel=typeof model==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(model)?model:'unknown';
  const safeEffort=['low','medium','high','xhigh','max','minimal','none'].includes(effort)?effort:'provider_default';
  const safeStatus=['completed','incomplete','failed','stream_rejected'].includes(status)?status:'failed';
  await db.prepare(`INSERT INTO hhba_ai_usage_daily(day,model,stage,effort,status,calls,usage_calls,input_tokens,output_tokens,total_tokens,reasoning_tokens,cached_tokens,reasoning_known_calls,cache_known_calls)
   VALUES(?,?,?,?,?,1,?,?,?,?,?,?,?,?)
   ON CONFLICT(day,model,stage,effort,status) DO UPDATE SET
   calls=calls+1,usage_calls=usage_calls+excluded.usage_calls,input_tokens=input_tokens+excluded.input_tokens,
   output_tokens=output_tokens+excluded.output_tokens,total_tokens=total_tokens+excluded.total_tokens,
   reasoning_tokens=reasoning_tokens+excluded.reasoning_tokens,cached_tokens=cached_tokens+excluded.cached_tokens,
   reasoning_known_calls=reasoning_known_calls+excluded.reasoning_known_calls,cache_known_calls=cache_known_calls+excluded.cache_known_calls`)
   .bind(isoDay(),safeModel,usageStage(stage),safeEffort,safeStatus,Number(u.known),u.input??0,u.output??0,u.total??0,u.reasoning??0,u.cached??0,Number(u.reasoning!==null),Number(u.cached!==null)).run();
 }catch{console.warn('HHBA_AI_USAGE_PERSIST_FAILED')}
}
export async function readAiUsage(env,since,until){
 const db=metricDb(env);if(!db)return {quality:'unavailable'};
 try{
  const r=await db.prepare('SELECT * FROM hhba_ai_usage_daily WHERE day>=? AND day<=? ORDER BY day,stage,model,effort,status').bind(since,until).all();
  const rows=r.results||[];
  return {quality:rows.length?'collected':'no_records',rows,scope:'OBSERVED_OPENAI_RESPONSES_ONLY_NOT_BILLING'};
 }catch{return {quality:'unavailable'}}
}

export function logV4Usage(provider,usage,elapsed,status){
 const number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
 // Never log prompts, queries, URLs, user identifiers, keys or response text.
 console.info('HHBA_V4_MODEL_USAGE',JSON.stringify({provider:'openai',model:provider.model,status,elapsed_ms:elapsed,
  input_tokens:number(usage?.input_tokens),output_tokens:number(usage?.output_tokens),total_tokens:number(usage?.total_tokens),reasoning_tokens:number(usage?.output_tokens_details?.reasoning_tokens),cached_tokens:number(usage?.input_tokens_details?.cached_tokens)}));
}

// Phase-local accounting: model responses return immediately; the owning
// invocation flushes aggregate counters before it closes. No prompts or outputs.
export function createAiUsageBuffer(db){
 const rows=new Map();
 const add=({model,stage,effort,status,usage})=>{
  if(!db)return;
  const u=usageCounts(usage),day=isoDay();
  const safeModel=typeof model==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(model)?model:'unknown';
  const safeEffort=['low','medium','high','xhigh','max','minimal','none'].includes(effort)?effort:'provider_default';
  const safeStatus=['completed','incomplete','failed','stream_rejected'].includes(status)?status:'failed';
  const keys=[day,safeModel,usageStage(stage),safeEffort,safeStatus],key=JSON.stringify(keys);
  const values=[1,Number(u.known),u.input??0,u.output??0,u.total??0,u.reasoning??0,u.cached??0,Number(u.reasoning!==null),Number(u.cached!==null)];
  const prior=rows.get(key);if(prior)for(let i=0;i<values.length;i++)prior.values[i]+=values[i];else rows.set(key,{keys,values});
 };
 let active=null;
 const flush=async()=>{
  if(active)await active;
  if(!rows.size)return;
  const pending=[...rows.values()];rows.clear();
  const work=(async()=>{
   for(const {keys,values} of pending){
    try{await db.prepare(`INSERT INTO hhba_ai_usage_daily(day,model,stage,effort,status,calls,usage_calls,input_tokens,output_tokens,total_tokens,reasoning_tokens,cached_tokens,reasoning_known_calls,cache_known_calls)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(day,model,stage,effort,status) DO UPDATE SET
     calls=calls+excluded.calls,usage_calls=usage_calls+excluded.usage_calls,input_tokens=input_tokens+excluded.input_tokens,
     output_tokens=output_tokens+excluded.output_tokens,total_tokens=total_tokens+excluded.total_tokens,
     reasoning_tokens=reasoning_tokens+excluded.reasoning_tokens,cached_tokens=cached_tokens+excluded.cached_tokens,
     reasoning_known_calls=reasoning_known_calls+excluded.reasoning_known_calls,cache_known_calls=cache_known_calls+excluded.cache_known_calls`).bind(...keys,...values).run();}
    catch{console.warn('HHBA_AI_USAGE_PERSIST_FAILED');}
   }
  })();
  active=work;try{await work;}finally{if(active===work)active=null;}
 };
 return {add,flush};
}
