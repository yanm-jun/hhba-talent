/**
 * Public vacancy state is separate from immutable JD versions.
 * No AI judgement or failed network fetch can declare a job closed:
 * only the exact allowlisted detail endpoint returning 404/410 twice,
 * 6h+ apart and within 7 days, moves it to CLOSED.
 */
import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {safePublicAtsJobLocator,ATS_JD_PROOF} from './public-ats-jd.js';

export const JD_STATE_VERSION='HHBA_JD_POSTING_LIFECYCLE_V1';
export const JD_RECHECK_MS=6*60*60*1000;
const DAY=24*60*60*1000,WINDOW=7*DAY;
const TABLE='hhba_jd_posting_lifecycle';
const directProof='DIRECT_EMPLOYER_HTML_V1';
const locatorFor=url=>safeOfficialJobLocator(url)||safePublicAtsJobLocator(url);
const proofFor=loc=>loc?.kind?ATS_JD_PROOF:directProof;
const plus=(now,delta)=>new Date(now.getTime()+delta).toISOString();
const iso=now=>new Date(now).toISOString();

export function jdLifecycleRequired(env){
 return env?.HHBA_JOB_JD_LIFECYCLE_ENABLED==='1'||env?.HHBA_AUTH_ROLLOUT==='preview';
}
export async function jdLifecycleReady(env){
 if(!env?.HHBA_JOB_JD_DB?.prepare)return false;
 try{
  const data=await env.HHBA_JOB_JD_DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hhba_jd_posting_lifecycle','hhba_jd_retention_audit')"
  ).all();
  const names=new Set((data?.results||[]).map(x=>x.name));
  return names.has(TABLE)&&names.has('hhba_jd_retention_audit');
 }catch{return false}
}
export async function readJdPostingState(env,url){
 const loc=locatorFor(url);
 if(!loc||!env?.HHBA_JOB_JD_DB?.prepare)return null;
 try{
  return await env.HHBA_JOB_JD_DB.prepare(
   'SELECT * FROM '+TABLE+' WHERE canonical_url=?'
  ).bind(loc.url).first();
 }catch(error){
  if(jdLifecycleRequired(env))throw error;
  return null; // old databases without migration remain compatible
 }
}
export function isClosedPosting(state){return state?.status==='CLOSED'}
export function isUsablePosting(state){
 return !state||state.status==='ACTIVE';
}
function closureEvidence(error){
 return error?.httpStatus===404||error?.httpStatus===410;
}
export function classificationForCheck(old,error,now=new Date()){
 const t=new Date(now),checked=iso(t);
 const keep=old?.status==='CLOSED';
 if(!error)return {
  status:'ACTIVE',last_active_at:checked,first_gone_at:null,last_gone_at:null,
  gone_count:0,closed_at:null,uncertain_count:0,last_reason:'SOURCE_VERIFIED',
  next_check_at:plus(t,DAY)
 };
 if(keep)return {
  status:'CLOSED',last_active_at:old.last_active_at||null,
  first_gone_at:old.first_gone_at||null,last_gone_at:closureEvidence(error)?checked:old.last_gone_at,
  gone_count:old.gone_count||2,closed_at:old.closed_at,
  uncertain_count:(old.uncertain_count||0)+(closureEvidence(error)?0:1),
  last_reason:closureEvidence(error)?'HTTP_CONFIRMED_CLOSED':'RECHECK_INCONCLUSIVE',
  next_check_at:plus(t,7*DAY)
 };
 if(closureEvidence(error)){
  const firstMs=Date.parse(old?.first_gone_at||'');
  const withinWindow=Number.isFinite(firstMs)&&t.getTime()-firstMs>=0&&
   t.getTime()-firstMs<=WINDOW;
  const previousMs=Date.parse(old?.last_gone_at||'');
  const independent=withinWindow&&Number.isFinite(previousMs)&&
   t.getTime()-previousMs>=JD_RECHECK_MS;
  const gone=independent?Math.min(20,(old?.gone_count||0)+1):1;
  const closed=gone>=2;
  return {status:closed?'CLOSED':'RECHECK',last_active_at:old?.last_active_at||null,
   first_gone_at:independent?old.first_gone_at:checked,last_gone_at:checked,
   gone_count:gone,closed_at:closed?checked:null,
   uncertain_count:old?.uncertain_count||0,
   last_reason:closed?'HTTP_CONFIRMED_CLOSED':'HTTP_GONE_NEEDS_CONFIRMATION',
   next_check_at:plus(t,closed?7*DAY:JD_RECHECK_MS)};
 }
 return {status:'RECHECK',last_active_at:old?.last_active_at||null,
  first_gone_at:null,last_gone_at:null,gone_count:0,closed_at:null,
  uncertain_count:Math.min(10000,(old?.uncertain_count||0)+1),
  last_reason:'CHECK_UNCERTAIN',
  next_check_at:plus(t,12*60*60*1000)};
}
export async function recordJdPostingCheck(env,url,{error=null,now=new Date()}={}){
 const loc=locatorFor(url);
 if(!loc||!env?.HHBA_JOB_JD_DB?.prepare)throw Error('JD_STATE_BAD_SOURCE');
 if(!await jdLifecycleReady(env)){
  if(jdLifecycleRequired(env))throw Error('JD_LIFECYCLE_SCHEMA_NOT_READY');
  return null;
 }
 const old=await readJdPostingState(env,loc.url);
 const v=classificationForCheck(old,error,now),checked=iso(now);
 const sql='INSERT INTO '+TABLE+'(canonical_url,proof_method,status,last_active_at,last_checked_at,'+
  'next_check_at,first_gone_at,last_gone_at,gone_count,closed_at,uncertain_count,'+
  'last_reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(canonical_url) '+
  'DO UPDATE SET status=excluded.status,last_active_at=excluded.last_active_at,'+
  'last_checked_at=excluded.last_checked_at,next_check_at=excluded.next_check_at,'+
  'first_gone_at=excluded.first_gone_at,last_gone_at=excluded.last_gone_at,'+
  'gone_count=excluded.gone_count,closed_at=excluded.closed_at,'+
  'uncertain_count=excluded.uncertain_count,last_reason=excluded.last_reason,'+
  'updated_at=excluded.updated_at WHERE '+TABLE+'.proof_method=excluded.proof_method';
 const result=await env.HHBA_JOB_JD_DB.prepare(sql).bind(
  loc.url,proofFor(loc),v.status,v.last_active_at,checked,v.next_check_at,
  v.first_gone_at,v.last_gone_at,v.gone_count,v.closed_at,v.uncertain_count,
  v.last_reason,checked
 ).run();
 if(result?.success!==true||result?.meta?.changes!==1)
  throw Error('JD_LIFECYCLE_WRITE_FAILED');
 return {...v,canonical_url:loc.url,proof_method:proofFor(loc),last_checked_at:checked};
}
export async function noteJdSourceFailure(env,url,error,now=new Date()){
 // Caller must supply the ORIGINAL HTTP status on the exact allowlisted
 // endpoint. Arbitrary errors / 403 / 429 / 5xx never assert closure.
 return recordJdPostingCheck(env,url,{error,now});
}
