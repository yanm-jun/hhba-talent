/**
 * Preview-only synthetic job matching QA audit. Never persists candidate CV,
 * prompt, page contents, specific job URLs, provider keys or user identifiers.
 * All records reside only in the already isolated Pages preview D1 binding.
 */
const stageToken=s=>/^[a-z_]{2,45}$/.test(String(s))?s:'unknown';
const safeNumber=n=>Number.isFinite(n)&&n>=0?Math.min(1e9,Math.trunc(n)):0;
const counterKeys=[
 'searches','search_failures','search_raw_results','search_empty_queries',
 'candidate_links','fetch_attempted','fetch_failures','page_reads',
 'city_evidence_count','extracted_jobs','visible_jobs','model_failures','model_pages_attempted',
 'source_batches','recovery_queries','recovery_candidates','elapsed_ms'
];
const countObject=v=>Object.fromEntries(Object.entries(v||{}).filter(([k,val])=>
 /^[a-z_]{2,45}$/.test(k)&&typeof val==='number').map(([k,val])=>[k,safeNumber(val)]));
export function redactQaDiagnostic(d={}){
 const out=Object.fromEntries(counterKeys.map(k=>[k,safeNumber(d?.[k])]));
 out.jd_verified=safeNumber(d?.jd_verification?.verified);
 out.jd_attempted=safeNumber(d?.jd_verification?.attempted);
 out.rejection_counts=countObject(d?.extraction_page_rejections);
 out.source_rejections=countObject(d?.search_rejection_counts);
 out.error_codes=[...(d?.provider_error_codes||[]),...(d?.fetch_error_codes||[]),
  d?.score_provider_error,d?.planning_error].filter(x=>
  typeof x==='string'&&/^[A-Z][A-Z0-9_]{2,70}$/.test(x)).slice(0,16);
 return out;
}
export async function authorizeOperatorQa(db,token){
 if(typeof token!=='string'||token.length<40||token.length>160||!db?.prepare)return false;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const row=await db.prepare(
  'SELECT enabled FROM hhba_match_qa_tokens WHERE token_hash=?').bind(hash).first();
 return row?.enabled===1;
}
export async function startQaRun(db,id){
 await db.prepare(
  'INSERT INTO hhba_match_qa_runs(id,scenario,started_at,status,stage) VALUES(?,?,?, ?,?)'
 ).bind(id,'automotive_operations_v1',new Date().toISOString(),'RUNNING','preparing').run();
}
export async function appendQaStage(db,runId,seq,stage,counts={}){
 const safe=countObject(counts);
 await db.prepare(
  'INSERT INTO hhba_match_qa_events(id,run_id,seq,at,stage,counts_json) VALUES(?,?,?,?,?,?)'
 ).bind(crypto.randomUUID(),runId,seq,new Date().toISOString(),stageToken(stage),
  JSON.stringify(safe)).run();
 await db.prepare('UPDATE hhba_match_qa_runs SET stage=? WHERE id=?')
  .bind(stageToken(stage),runId).run();
}
export async function finishQaRun(db,runId,status,d,elapsed){
 const summary=redactQaDiagnostic(d);
 const safeStatus=['COMPLETED_TARGET','COMPLETED_PARTIAL','COMPLETED_ZERO','FAILED']
  .includes(status)?status:'FAILED';
 await db.prepare(
  'UPDATE hhba_match_qa_runs SET finished_at=?,status=?,stage=?,counts_json=?,error_codes_json=?,duration_ms=? WHERE id=?'
 ).bind(new Date().toISOString(),safeStatus,stageToken(d?.stage||'failed'),
  JSON.stringify(summary),JSON.stringify(summary.error_codes),
  safeNumber(elapsed),runId).run();
}
export async function getQaRun(db,runId){
 const row=await db.prepare(
  'SELECT id,scenario,started_at,finished_at,status,stage,counts_json,error_codes_json,duration_ms FROM hhba_match_qa_runs WHERE id=?'
 ).bind(runId).first();
 if(!row)return null;
 const events=await db.prepare(
  'SELECT seq,at,stage,counts_json FROM hhba_match_qa_events WHERE run_id=? ORDER BY seq ASC LIMIT 100'
 ).bind(runId).all();
 const parse=v=>{try{return JSON.parse(v||'{}')}catch{return {}}};
 return {id:row.id,scenario:row.scenario,started_at:row.started_at,
  finished_at:row.finished_at,status:row.status,stage:row.stage,
  counts:parse(row.counts_json),duration_ms:row.duration_ms,
  events:(events?.results||[]).map(x=>({seq:x.seq,at:x.at,
   stage:x.stage,counts:parse(x.counts_json)}))};
}
