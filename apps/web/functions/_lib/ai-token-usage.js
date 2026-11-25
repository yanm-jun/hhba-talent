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
