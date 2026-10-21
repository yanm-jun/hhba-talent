/** Phase 2: metrics derived ONLY from the same public Pages recruitment feed and its official audit. */
const validDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const SAFE_STATUS=new Set(['OFFICIAL_JD_AND_REQUIREMENTS_FOUND','OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED','DOMESTIC_CHANNEL_ONLY','DOMESTIC_DETAIL_READER_REQUIRED']);
const EXCLUDED=new Set(['MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED','OFFICIAL_SOURCE_READ_FAILED','OFFICIAL_TITLE_CHANGED','INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID']);
export function buildPhase2Overview(feed,audit,now=new Date()){
 if(!feed||!audit||!Array.isArray(feed.jobs)||!Array.isArray(audit.jobs)||!whole(feed.total)||feed.total!==feed.jobs.length||feed.failures!==0||!validDate(feed.updated))
  throw Error('INVALID_RECRUITMENT_FEED');
 const summary=audit.summary;
 if(summary?.kind!=='HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1'||summary.indexed_as_of!==feed.updated||!whole(summary.total_indexed_jobs)||summary.total_indexed_jobs!==feed.total||!validDate(summary.checked_at)||audit.jobs.length!==feed.total)
  throw Error('AUDIT_SNAPSHOT_MISMATCH');
 const age=now.getTime()-Date.parse(feed.updated),auditAge=now.getTime()-Date.parse(summary.checked_at);
 if(!Number.isFinite(age)||age< -300000||auditAge< -300000)throw Error('INVALID_SOURCE_TIME');
 const stale=age>86400000||auditAge>86400000;
 const ids=new Set(),rows=new Map();
 for(const job of feed.jobs){
  if(!job||typeof job.id!=='string'||ids.has(job.id)||typeof job.company!=='string'||!job.company.trim())throw Error('INVALID_OR_DUPLICATE_JOB');
  ids.add(job.id);
 }
 for(const item of audit.jobs){
  if(!item||typeof item.job_id!=='string'||!ids.has(item.job_id)||rows.has(item.job_id)||typeof item.status!=='string')throw Error('INVALID_AUDIT_RECORD');
  rows.set(item.job_id,item);
 }
 if(rows.size!==ids.size)throw Error('AUDIT_COVERAGE_MISMATCH');
 const jobs=feed.jobs.filter(j=>!EXCLUDED.has(rows.get(j.id).status));
 const companies=new Set(jobs.map(j=>j.company.trim().toLocaleLowerCase('en')));
 const complete=jobs.filter(j=>rows.get(j.id).full_original_jd_verified===true && rows.get(j.id).requirements_evidence===true).length;
 const uncertain=jobs.filter(j=>!SAFE_STATUS.has(rows.get(j.id).status)).length;
 const checked=whole(summary.official_ats_boards_checked)?summary.official_ats_boards_checked:null;
 const failed=whole(summary.official_ats_board_failures)?summary.official_ats_board_failures:null;
 const status=stale?'stale':failed===null||checked===null||failed>0||uncertain>0?'partial':'current';
 // Investor-facing figures withheld when the source is stale. Partial audits retain usable
 // counts with clear quality labeling; never call them 'open jobs' or 'employer partnerships'.
 return {
  kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2',source:'与 HHBA Pages 招聘主站同批次的公开岗位及官网 JD 审计',
  sourceType:'PUBLIC_PAGES_FEED_AND_OFFICIAL_JD_AUDIT',quality:status,
  asOf:feed.updated,observedAt:now.toISOString(),auditCheckedAt:summary.checked_at,
  counts:{indexedJobs:stale?null:feed.total,displayableJobs:stale?null:jobs.length,
   auditedJobRequirements:stale?null:complete,distinctIndexedCompanies:stale?null:companies.size,
   checkedAtsSources:stale?null:checked,failedAtsSources:failed,
   unclassifiedOrUnverifiedJobs:stale?null:uncertain},
  definitions:{
   indexedJobs:'本次公开来源索引记录总数，不等于正在招聘岗位或用户投递数',
   displayableJobs:'剔除官网审计明确失败状态后仍可在列表展示的记录，不保证目前可申请',
   auditedJobRequirements:'官网原文任职要求可读且本次核验通过的职位记录，不代表获得转载授权',
   distinctIndexedCompanies:'索引公司名称标准化去重，仅为收录主体数，非付费客户或招聘合作企业',
   checkedAtsSources:'JD 审计处理的海外 ATS 来源数，不等于企业数',
   failedAtsSources:'官网 JD 审计请求失败的 ATS 来源数',
   unclassifiedOrUnverifiedJobs:'未归入可解释审计状态的记录数，不当作有效岗位'
  },
  future:{totalRegisteredUsers:null,activeUsers30d:null,applyOutboundClicks:null,revenueCny:null,retention30d:null,trafficSeries:null}
 };
}
