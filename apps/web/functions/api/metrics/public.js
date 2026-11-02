import {assetJson,json,bad} from '../../_lib/metric-utils.js';
const excluded=new Set(['MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED','OFFICIAL_SOURCE_READ_FAILED','OFFICIAL_TITLE_CHANGED','INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID']);
export async function onRequestGet({request,env}){
 try{
  const [feed,audit]=await Promise.all([assetJson(env,request,'/data/jobs.json'),assetJson(env,request,'/data/job-sync-status.json')]);
  const items=feed.jobs,rows=audit.jobs,summary=audit.summary;
  if(!Array.isArray(items)||!Array.isArray(rows)||!summary||feed.total!==items.length||summary.indexed_as_of!==feed.updated||summary.total_indexed_jobs!==feed.total||rows.length!==items.length)throw Error('SOURCE_MISMATCH');
  const stamp=Date.parse(feed.updated),auditStamp=Date.parse(summary.checked_at);
  if(!Number.isFinite(stamp)||!Number.isFinite(auditStamp))throw Error('SOURCE_TIME_INVALID');
  const age=Date.now()-stamp,auditAge=Date.now()-auditStamp;
  const stale=age>86400000||auditAge>86400000||age< -300000||auditAge< -300000;
  const ids=new Set(items.map(x=>x.id)),byId=new Map(rows.map(x=>[x.job_id,x]));
  if(ids.size!==items.length||byId.size!==items.length||[...ids].some(id=>!byId.has(id)))throw Error('AUDIT_ID_MISMATCH');
  const displayable=items.filter(x=>!excluded.has(byId.get(x.id).status));
  const complete=displayable.filter(x=>byId.get(x.id).full_original_jd_verified===true&&byId.get(x.id).requirements_evidence===true);
  const boards=Number.isSafeInteger(summary.official_ats_boards_checked)?summary.official_ats_boards_checked:null;
  const failures=Number.isSafeInteger(summary.official_ats_board_failures)?summary.official_ats_board_failures:null;
  return json({kind:'HHBA_CLOUDFLARE_PUBLIC_METRICS_V1',source:'同一批次的 Cloudflare 岗位快照和官方 JD 审计',sourceTime:feed.updated,auditCheckedAt:summary.checked_at,quality:stale?'stale':failures===null||failures>0?'partial':'current',counts:{
   indexedJobs:stale?null:items.length,displayableJobs:stale?null:displayable.length,
   auditedJobRequirements:stale?null:complete.length,checkedAtsSources:stale?null:boards,
   failedAtsSources:failures,distinctIndexedCompanies:stale?null:new Set(displayable.map(x=>x.company?.trim().toLowerCase()).filter(Boolean)).size
  },definitions:{displayableJobs:'按官网审计排除撤下、失效或重复来源后的可展示岗位记录，不代表招聘方保证持续在招',checkedAtsSources:'已核对的 ATS 来源，不代表入驻或付费企业',auditedJobRequirements:'官方完整 JD 和任职要求均已核验的岗位数'}})
 }catch(e){console.warn('HHBA_METRICS_PUBLIC_SOURCE_ERROR',e?.message||'unknown');return bad('PUBLIC_RECRUITMENT_SNAPSHOT_UNAVAILABLE')}
}
