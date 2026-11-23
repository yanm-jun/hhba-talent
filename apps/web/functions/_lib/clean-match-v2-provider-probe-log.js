/**
 * Preview-only structured provider health logging.
 * No key, raw HTTP body, prompt, résumé, source URL or user identifier.
 * A transient D1 logging failure must not change the provider's verdict.
 */
const STAGES=new Set(['basic_responses','structured_json','web_search_sources','completed']);
const KINDS=new Set(['CANDIDATE_PREFLIGHT','OPERATOR_PREFLIGHT']);
const safeStatus=value=>Number.isInteger(value)&&value>=400&&value<=599?value:null;
const safeDuration=value=>Number.isFinite(value)&&value>=0?
 Math.min(600000,Math.trunc(value)):0;
const safeSourceCount=value=>Number.isFinite(value)&&value>=0?
 Math.min(1000,Math.trunc(value)):0;
export function sanitizeProviderProbe(input={}){
 const success=input.outcome==='READY';
 return {
  kind:KINDS.has(input.kind)?input.kind:'CANDIDATE_PREFLIGHT',
  outcome:success?'READY':'FAILED',
  stage:success?'completed':STAGES.has(input.stage)?input.stage:'unknown',
  error_code:!success&&typeof input.error_code==='string'&&
   /^AI_[A-Z0-9_]{3,65}$/.test(input.error_code)?input.error_code:null,
  upstream_status:success?null:safeStatus(input.upstream_status),
  duration_ms:safeDuration(input.duration_ms),
  sources_returned:success?safeSourceCount(input.sources_returned):0
 };
}
export async function recordProviderProbe(db,input){
 if(!db?.prepare)throw new Error('PROBE_DB_UNAVAILABLE');
 const p=sanitizeProviderProbe(input);
 const id=crypto.randomUUID();
 await db.prepare(
  'INSERT INTO hhba_match_v2_provider_probes '+
  '(id,tested_at,kind,outcome,stage,error_code,upstream_status,duration_ms,sources_returned) '+
  'VALUES(?,?,?,?,?,?,?,?,?)'
 ).bind(id,new Date().toISOString(),p.kind,p.outcome,p.stage,p.error_code,
  p.upstream_status,p.duration_ms,p.sources_returned).run();
 return id;
}
export async function readRecentProviderProbes(db,limit=20){
 if(!db?.prepare)throw new Error('PROBE_DB_UNAVAILABLE');
 const n=Number.isInteger(limit)?Math.max(1,Math.min(50,limit)):20;
 const rows=await db.prepare(
  'SELECT id,tested_at,kind,outcome,stage,error_code,upstream_status,duration_ms,sources_returned '+
  'FROM hhba_match_v2_provider_probes ORDER BY tested_at DESC LIMIT ?'
 ).bind(n).all();
 return (rows?.results||[]).map(row=>({
  id:String(row.id||'').slice(0,40),
  tested_at:String(row.tested_at||'').slice(0,30),
  ...sanitizeProviderProbe(row)
 }));
}
