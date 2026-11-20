/**
 * Shared, fail-closed Candidate Agent policy in the existing candidate D1.
 * Imported by the protected admin console AND the candidate matching worker.
 * Never trust client-provided skill/tool names or uploaded "skill" definitions.
 */
export const AGENT_POLICY_ID='default';
export const AGENT_SKILL_IDS=Object.freeze([
  'resume_evidence','official_job_search','fit_scoring','targeted_resume_rewrite'
]);
export const AGENT_SEARCH_REQUIRED=Object.freeze(AGENT_SKILL_IDS.slice(0,3));
const legal=new Set(AGENT_SKILL_IDS);
const safeSkills=value=>Array.isArray(value)&&
  value.length>=1&&value.length<=AGENT_SKILL_IDS.length&&
  value.every(x=>typeof x==='string'&&legal.has(x))&&
  new Set(value).size===value.length;
export function validAgentSkillPolicy(value){
 return value&&typeof value==='object'&&!Array.isArray(value)&&
  typeof value.enabled==='boolean'&&safeSkills(value.skills)&&
  (!value.enabled||AGENT_SEARCH_REQUIRED.every(x=>value.skills.includes(x)));
}
export function validateAgentPolicyChange(value){
 if(!validAgentSkillPolicy(value)||!Number.isSafeInteger(value.expectedRevision)||
   value.expectedRevision<1||value.expectedRevision>1000000||
   Object.keys(value).some(k=>!['enabled','skills','expectedRevision'].includes(k)))
  throw Error('AGENT_POLICY_INVALID');
 return {enabled:value.enabled,skills:[...value.skills],
   expectedRevision:value.expectedRevision};
}
const fallback=reason=>({
  configured:false,enabled:false,revision:null,
  skills:[...AGENT_SKILL_IDS],updated_at:null,reason
});
export function parseAgentPolicyRow(row){
 if(!row)return fallback('NOT_CONFIGURED');
 let ids;
 try{ids=JSON.parse(row.skills_json)}catch{return fallback('CORRUPT_POLICY')}
 const enabled=row.enabled===1;
 if(!validAgentSkillPolicy({enabled,skills:ids})||
   !Number.isSafeInteger(row.revision)||row.revision<1)
   return fallback('CORRUPT_POLICY');
 return {configured:true,enabled,revision:row.revision,
   skills:ids,updated_at:row.updated_at||null,reason:null};
}
export async function readAgentPolicy(db){
 if(typeof db?.prepare!=='function')return fallback('DB_NOT_BOUND');
 try{
  const row=await db.prepare(
    "SELECT enabled,skills_json,revision,updated_at FROM hhba_candidate_agent_policy WHERE id='default' LIMIT 1"
  ).first();
  return parseAgentPolicyRow(row);
 }catch{return fallback('DB_UNAVAILABLE');}
}
export async function changeAgentPolicy(db,value){
 const {enabled,skills,expectedRevision}=validateAgentPolicyChange(value);
 if(typeof db?.batch!=='function')throw Error('AGENT_POLICY_DB_UNAVAILABLE');
 const token=crypto.randomUUID(),time=new Date().toISOString(),JSONskills=JSON.stringify(skills);
 const update=db.prepare(
   "UPDATE hhba_candidate_agent_policy SET enabled=?,skills_json=?,revision=revision+1,updated_at=?,updated_by='owner',request_id=? WHERE id='default' AND revision=?"
 ).bind(enabled?1:0,JSONskills,time,token,expectedRevision);
 // Audit follows only the row modified by THIS request, not a concurrently
 // edited row which happens to carry the expected revision.
 const audit=db.prepare(
   "INSERT INTO hhba_candidate_agent_policy_audit(event_id,revision,enabled,skills_json,actor,created_at) SELECT ?,revision,enabled,skills_json,'owner',? FROM hhba_candidate_agent_policy WHERE id='default' AND request_id=?"
 ).bind(crypto.randomUUID(),time,token);
 let results;
 try{results=await db.batch([update,audit]);}
 catch{throw Error('AGENT_POLICY_DB_UNAVAILABLE');}
 if(Number(results?.[0]?.meta?.changes)!==1)throw Error('AGENT_POLICY_CONFLICT');
 if(Number(results?.[1]?.meta?.changes)!==1)throw Error('AGENT_POLICY_AUDIT_FAILED');
 return {configured:true,enabled,skills,revision:expectedRevision+1,updated_at:time};
}
export async function recordAnonymousAgentRun(db,{status,skills,matchedCount,elapsedMs}){
 if(typeof db?.prepare!=='function'||!['complete','failed'].includes(status))
  return false;
 const count=Math.max(0,Math.min(4,Number.isInteger(skills)?skills:0));
 const matches=Math.max(0,Math.min(10,Number.isInteger(matchedCount)?matchedCount:0));
 const duration=Math.max(0,Math.min(600000,Number.isFinite(elapsedMs)?Math.floor(elapsedMs):0));
 try{
  const result=await db.prepare(
   "INSERT INTO hhba_candidate_agent_runs(run_id,kind,status,skill_count,matched_count,elapsed_ms,created_at) VALUES(?,'matching',?,?,?,?,?)"
  ).bind(crypto.randomUUID(),status,count,matches,duration,new Date().toISOString()).run();
  return result?.success===true;
 }catch{return false;}
}
export async function readAnonymousAgentRunSummary(db){
 if(typeof db?.prepare!=='function')throw Error('AGENT_POLICY_DB_UNAVAILABLE');
 const since=new Date(Date.now()-7*86400000).toISOString();
 const rows=await db.prepare(
   "SELECT status,COUNT(*) AS n,COALESCE(SUM(matched_count),0) AS matches,CAST(AVG(elapsed_ms) AS INTEGER) AS avg_ms FROM hhba_candidate_agent_runs WHERE created_at>=? GROUP BY status"
 ).bind(since).all();
 const recent=await db.prepare(
   "SELECT status,skill_count,matched_count,elapsed_ms,created_at FROM hhba_candidate_agent_runs ORDER BY created_at DESC LIMIT 15"
 ).all();
 return {period:'last_7_days',counters:(rows.results||[]).map(x=>({
   status:x.status,count:Number(x.n)||0,matched_jobs:Number(x.matches)||0,
   average_ms:Number(x.avg_ms)||0
 })),recent:(recent.results||[]).map(x=>({
   status:x.status,skill_count:Number(x.skill_count)||0,
   matched_count:Number(x.matched_count)||0,elapsed_ms:Number(x.elapsed_ms)||0,
   created_at:x.created_at
 }))};
}
