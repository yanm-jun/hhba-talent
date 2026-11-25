import {metricDb} from './metric-utils.js';
export async function readAiUsage(env,since,until){
 const db=metricDb(env);if(!db)return {quality:'unavailable'};
 try{
  const r=await db.prepare('SELECT * FROM hhba_ai_usage_daily WHERE day>=? AND day<=? ORDER BY day,stage,model,effort,status').bind(since,until).all();
  const rows=r.results||[];
  return {quality:rows.length?'collected':'no_records',rows,scope:'OBSERVED_OPENAI_RESPONSES_ONLY_NOT_BILLING'};
 }catch{return {quality:'unavailable'}}
}
