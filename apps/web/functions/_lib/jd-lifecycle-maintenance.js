/**
 * Daily, bounded JD housekeeping. Runs only under a separately deployed Cron
 * Worker with existing public JD D1/R2 and read-only auth history D1 bindings.
 *
 * No prompt, CV, phone or email enters this module. No model API is called.
 * R2 deletion is a SEPARATE, explicitly enabled feature; default is dry-run.
 */
import {safeJDSourceLocator,saveVerifiedJobJd} from './job-jd-archive.js';
import {directOfficialJobEvidence} from './official-job-evidence.js';
import {fetchPublicAtsJd} from './public-ats-jd.js';
import {jdLifecycleReady,recordJdPostingCheck,noteJdSourceFailure,readJdPostingState}
 from './jd-posting-lifecycle.js';

export const JD_MAINTENANCE_KIND='HHBA_JD_LIFECYCLE_CRON_V1';
export const JD_CLOSED_RETENTION_DAYS=30;
export const JD_SUPERSEDED_RETENTION_DAYS=90;
const DAY=24*60*60*1000;
const MAX_RECHECK=12,MAX_GC=8;
const TABLES=['hhba_job_jd_versions','hhba_job_ats_jd_versions'];
const KEY=/^official-jds\/v1\/[a-f0-9]{32}\/[a-f0-9]{64}\.json$/;
const safeDate=date=>Number.isFinite(Date.parse(date||''));
const iso=date=>new Date(date).toISOString();

async function recordHistoryDependency(env,id){
 // If history DB is missing, inaccessible, or the query fails, caller MUST
 // abandon deletion; the absence of an available history is not evidence
 // that a JD version is unreferenced.
 if(!env.HHBA_PNVS_AUTH_DB?.prepare)throw Error('JD_HISTORY_PROTECTION_UNAVAILABLE');
 const present=await env.HHBA_PNVS_AUTH_DB.prepare(
  "SELECT 1 AS pinned FROM hhba_ai_match_history AS h, json_each(h.jobs_json) AS j "+
  "WHERE json_extract(j.value,'$.jd_version_id') = ? LIMIT 1"
 ).bind(id).first();
 return Boolean(present);
}
export async function verifyJdMaintenanceSource(env,state,{now=new Date(),deps={}}={}){
 const locator=safeJDSourceLocator(state.canonical_url);
 if(!locator||locator.url!==state.canonical_url||
  (locator.kind?'PUBLIC_EMPLOYER_ATS_V1':'DIRECT_EMPLOYER_HTML_V1')!==state.proof_method)
  throw Error('JD_UNTRUSTED_LIFECYCLE_SOURCE');
 const fetchJd=locator.kind?(deps.fetchAts||fetchPublicAtsJd):
  (deps.fetchDirect||directOfficialJobEvidence);
 const save=deps.save||saveVerifiedJobJd;
 try{
  const source=await fetchJd(locator.url);
  if(!source?.full_jd||source.canonical_url!==locator.url)
   throw Error('JD_CANNOT_VERIFY_CURRENT_POSTING');
  const saved=await save(env,source,{now});
  if(!saved)throw Error('JD_VALIDATION_SAVE_FAILED');
  return {status:'ACTIVE',reactivated:state.status==='CLOSED'};
 }catch(error){
  // Saving failure must not be misinterpreted as an employer's 404.
  await noteJdSourceFailure(env,locator.url,error,now);
  const next=await readJdPostingState(env,locator.url);
  return {status:next?.status||'RECHECK',reactivated:false};
 }
}
async function findRetentionCandidates(db,now){
 const closedBefore=iso(new Date(now.getTime()-JD_CLOSED_RETENTION_DAYS*DAY));
 const supersededBefore=iso(new Date(now.getTime()-JD_SUPERSEDED_RETENTION_DAYS*DAY));
 const out=[];
 for(const table of TABLES){
  const rows=await db.prepare(
   'SELECT v.id,v.canonical_url,v.object_key,v.jd_sha256,v.last_verified_at,'+
   's.status,s.closed_at,s.last_checked_at FROM '+table+' AS v '+
   'JOIN hhba_jd_posting_lifecycle AS s ON s.canonical_url=v.canonical_url '+
   'WHERE ((s.status=\'CLOSED\' AND s.closed_at<=?) OR '+
   '(v.last_verified_at<=? AND EXISTS (SELECT 1 FROM '+table+
   ' newer WHERE newer.canonical_url=v.canonical_url '+
   'AND newer.last_verified_at>v.last_verified_at))) '+
   'ORDER BY v.last_verified_at ASC LIMIT ?'
  ).bind(closedBefore,supersededBefore,MAX_GC).all();
  out.push(...(rows?.results||[]).map(row=>({...row,table})));
 }
 return out.sort((a,b)=>a.last_verified_at.localeCompare(b.last_verified_at)).slice(0,MAX_GC);
}
function eligibleStill(row,state,now){
 if(!state||state.status!==row.status||
  !safeDate(row.last_verified_at)||state.canonical_url!==row.canonical_url)return false;
 if(state.status==='CLOSED'){
  return safeDate(state.closed_at)&&state.closed_at===row.closed_at&&
   Date.parse(state.closed_at)<=now.getTime()-JD_CLOSED_RETENTION_DAYS*DAY;
 }
 // Non-closed, older JD version is removable ONLY if an independently
 // verified newer row exists (checked by the SQL candidate selection).
 return Date.parse(row.last_verified_at)<=now.getTime()-JD_SUPERSEDED_RETENTION_DAYS*DAY;
}
const RETRY_PREFIX='R2_PENDING:';
async function isAnyJdIndexPresent(db,id,key){
 for(const table of TABLES){
  const found=await db.prepare('SELECT id FROM '+table+' WHERE id=? AND object_key=?')
   .bind(id,key).first();
  if(found)return true;
 }
 return false;
}
async function finishPendingR2Delete(env,entry,now){
 const db=env.HHBA_JOB_JD_DB,bucket=env.HHBA_JOB_JD_R2;
 const id=entry.jd_version_id,key=String(entry.reason||'').slice(RETRY_PREFIX.length);
 if(!/^jd_[a-f0-9]{32}$/.test(id)||!KEY.test(key)||
  !entry.reason?.startsWith(RETRY_PREFIX))return false;
 // If D1 still points at the object, it MUST NEVER be deleted by recovery.
 if(await isAnyJdIndexPresent(db,id,key)){
  // A crash before the conditional index DELETE did not detach the object.
  // Cancel this abandoned marker; the ordinary retention scan can recheck
  // the whole 30/90-day criteria before scheduling another purge.
  await db.prepare('DELETE FROM hhba_jd_retention_audit WHERE event_id=? AND event_type=?')
   .bind(entry.event_id,'SKIPPED_ERROR').run();
  return false;
 }
 if(await recordHistoryDependency(env,id))return false;
 const obj=await bucket.head(key);
 if(obj){
  const savedHash=key.slice(key.lastIndexOf('/')+1,-5);
  const actualHash=obj.customMetadata?.jd_sha256;
  if(actualHash&&actualHash!==savedHash)return false;
  await bucket.delete(key);
 }
 const finished=await db.prepare('INSERT INTO hhba_jd_retention_audit('+
  'event_id,jd_version_id,event_type,event_at,reason) VALUES(?,?,?,?,?)'
 ).bind(crypto.randomUUID(),id,'PURGED',iso(now),'R2_RETRY_COMPLETED').run();
 if(finished?.success!==true)throw Error('JD_RETENTION_AUDIT_FAILED');
 await db.prepare('DELETE FROM hhba_jd_retention_audit WHERE event_id=? AND event_type=?')
  .bind(entry.event_id,'SKIPPED_ERROR').run();
 return true;
}
export async function retryPendingJdObjectDeletes(env,{now=new Date(),dryRun=true}={}){
 const result={pending:0,retried:0,skipped:0};
 if(dryRun||env?.HHBA_JD_RETENTION_DELETE_ENABLED!=='1')return result;
 const db=env.HHBA_JOB_JD_DB;
 if(!db?.prepare||!env?.HHBA_JOB_JD_R2?.delete||!env?.HHBA_PNVS_AUTH_DB?.prepare)
  return result;
 // A previous crash may have happened after D1 index deletion but before R2.
 const list=await db.prepare(
  "SELECT event_id,jd_version_id,reason FROM hhba_jd_retention_audit "+
  "WHERE event_type='SKIPPED_ERROR' AND reason LIKE 'R2_PENDING:%' "+
  "ORDER BY event_at ASC LIMIT 4"
 ).all();
 const rows=list?.results||[];
 result.pending=rows.length;
 for(const row of rows){
  try{
   if(await finishPendingR2Delete(env,row,now))result.retried++;
   else result.skipped++;
  }catch{result.skipped++}
 }
 return result;
}
export async function runJdRetentionSweep(env,{now=new Date(),dryRun=true,deps={}}={}){
 const result={eligible:0,dry_run:dryRun,pinned:0,skipped:0,purged:0,blocked:0};
 const db=env?.HHBA_JOB_JD_DB,bucket=env?.HHBA_JOB_JD_R2;
 if(!db?.prepare||!bucket?.head||!bucket?.delete){
  result.blocked++;return result;
 }
 if(!env.HHBA_PNVS_AUTH_DB?.prepare){
  result.blocked++;return result;
 }
 // This read-only query must work before any object is considered for purge.
 try{await recordHistoryDependency(env,'jd_00000000000000000000000000000000')}
 catch{result.blocked++;return result}
 // Cleanup of interrupted *index-first* deletes is idempotent and always
 // checks both D1 tables and saved user histories before touching R2.
 const retry=await retryPendingJdObjectDeletes(env,{now,dryRun});
 result.retry_pending=retry.pending;result.retry_completed=retry.retried;
 const candidates=deps.candidates||await findRetentionCandidates(db,now);
 result.eligible=candidates.length;
 for(const row of candidates){
  try{
   const loc=safeJDSourceLocator(row.canonical_url);
   if(!loc||loc.url!==row.canonical_url||!KEY.test(row.object_key)||
    !/^[a-f0-9]{64}$/.test(row.jd_sha256)||
    !row.object_key.endsWith('/'+row.jd_sha256+'.json')||
    !/^jd_[a-f0-9]{32}$/.test(row.id)||!TABLES.includes(row.table)){
    result.skipped++;continue;
   }
   if(await recordHistoryDependency(env,row.id)){
    result.pinned++;continue;
   }
   const state=await readJdPostingState(env,row.canonical_url);
   if(!eligibleStill(row,state,now)){result.skipped++;continue}
   if(dryRun)continue;
   if(env?.HHBA_JD_RETENTION_DELETE_ENABLED!=='1'){
    result.blocked++;continue;
   }
   // The object is private and hash-addressed. No delete without a valid,
   // still-linked index and a checked authentic history dependency.
   const present=await bucket.head(row.object_key);
   if(present){
    const hash=present.customMetadata?.jd_sha256;
    if(hash&&hash!==row.jd_sha256){result.skipped++;continue}
   }
   // Re-read the D1 index before the destructive phase; if another worker
   // has refreshed the same version, the cleanup candidate is obsolete.
   const current=await db.prepare(
    'SELECT id,canonical_url,object_key,jd_sha256,last_verified_at FROM '+
    row.table+' WHERE id=?'
   ).bind(row.id).first();
   if(!current||current.canonical_url!==row.canonical_url||
    current.object_key!==row.object_key||current.jd_sha256!==row.jd_sha256||
    current.last_verified_at!==row.last_verified_at){
    result.skipped++;continue;
   }
   // Record a recoverable pending R2 deletion BEFORE the index removal.
   // If the Worker is interrupted after D1 DELETE, the next Cron run can
   // finish removing orphan bytes without deleting a still-indexed object.
   const pendingId=crypto.randomUUID();
   const pending=await db.prepare('INSERT INTO hhba_jd_retention_audit('+
    'event_id,jd_version_id,event_type,event_at,reason) VALUES(?,?,?,?,?)'
   ).bind(pendingId,row.id,'SKIPPED_ERROR',iso(now),RETRY_PREFIX+row.object_key).run();
   if(pending?.success!==true||pending?.meta?.changes!==1){
    result.blocked++;continue;
   }
   // IMPORTANT: D1 index MUST be removed before R2 bytes. Previously a
   // failed D1 DELETE left an indexed JD pointing to already-deleted R2.
   // Use optimistic concurrency on the exact version and recheck state
   // INSIDE the same D1 statement; never delete a recently refreshed row.
   const deleted=await db.prepare(
    'DELETE FROM '+row.table+
    ' WHERE id=? AND canonical_url=? AND object_key=? AND jd_sha256=? AND last_verified_at=? '+
    'AND EXISTS(SELECT 1 FROM hhba_jd_posting_lifecycle AS s '+
    'WHERE s.canonical_url=? AND s.status=? AND '+
    '(s.status<>\'CLOSED\' OR s.closed_at=?))'
   ).bind(row.id,row.canonical_url,row.object_key,row.jd_sha256,
    row.last_verified_at,row.canonical_url,row.status,row.closed_at).run();
   if(deleted?.success!==true||deleted?.meta?.changes!==1){
    // The original D1 record was NOT removed. Never touch its private R2.
    await db.prepare('DELETE FROM hhba_jd_retention_audit WHERE event_id=?')
     .bind(pendingId).run();
    result.skipped++;continue;
   }
   // A transient R2 failure can leave unreferenced bytes (space), but
   // must NEVER leave a valid index pointing at missing JD content.
   let r2ok=true;
   if(present)try{await bucket.delete(row.object_key)}
   catch{r2ok=false}
   if(!r2ok){
    // Pending audit survives and the next Cron safely retries the orphan.
    result.blocked++;continue;
   }
   const audit=await db.prepare('INSERT INTO hhba_jd_retention_audit('+
    'event_id,jd_version_id,event_type,event_at,reason) VALUES(?,?,?,?,?)'
   ).bind(crypto.randomUUID(),row.id,'PURGED',iso(now),
    state.status==='CLOSED'?'CLOSED_30D_UNREFERENCED':'SUPERSEDED_90D_UNREFERENCED').run();
   if(audit?.success!==true){result.blocked++;continue}
   await db.prepare('DELETE FROM hhba_jd_retention_audit WHERE event_id=?')
    .bind(pendingId).run();
   result.purged++;
  }catch{
   // Never infer unreferenced when authentication DB or Cloudflare fails.
   result.skipped++;
  }
 }
 return result;
}
export async function runJdLifecycleMaintenance(env,{now=new Date(),deps={}}={}){
 if(env?.HHBA_JD_MAINTENANCE_ENABLED!=='1')return {
  kind:JD_MAINTENANCE_KIND,enabled:false,checked:0,retention:null};
 if(!await jdLifecycleReady(env))throw Error('JD_LIFECYCLE_SCHEMA_NOT_READY');
 const db=env.HHBA_JOB_JD_DB;
 const due=await db.prepare(
  'SELECT canonical_url,proof_method,status FROM hhba_jd_posting_lifecycle '+
  'WHERE next_check_at<=? ORDER BY next_check_at ASC LIMIT ?'
 ).bind(iso(now),MAX_RECHECK).all();
 const rows=due?.results||[];
 const statuses={ACTIVE:0,RECHECK:0,CLOSED:0},reopened={count:0};
 // Small and bounded: respect free Workers/R2/D1 and official API limits.
 let next=0;
 await Promise.all(Array.from({length:Math.min(2,rows.length)},async()=>{
  while(next<rows.length){
   const row=rows[next++];
   try{
    const checked=await verifyJdMaintenanceSource(env,row,{now,deps});
    if(statuses[checked.status]!==undefined)statuses[checked.status]++;
    if(checked.reactivated)reopened.count++;
   }catch{statuses.RECHECK++}
  }
 }));
 const retention=await runJdRetentionSweep(env,{
  now,dryRun:env?.HHBA_JD_RETENTION_DELETE_ENABLED!=='1',deps
 });
 return {kind:JD_MAINTENANCE_KIND,enabled:true,checked:rows.length,
  statuses,reopened:reopened.count,retention};
}
