import type { LiveJob } from './liveRecruitment';

export type JobAuditEntry = {
  job_id:string;
  platform:string;
  company:string;
  status:string;
  full_original_jd_verified:boolean;
  requirements_evidence:boolean;
  responsibilities_evidence:boolean;
  chinese_full_jd_verified:boolean;
  jd_sha256?:string;
  jd_characters?:number;
  official_checked_at?:string;
  source_error?:string;
};
export type JobAuditSummary = {
 kind:string;
 indexed_as_of:string;
 checked_at:string;
 total_indexed_jobs:number;
 verified_full_original_jd_and_requirements:number;
 verified_complete_chinese_jd:number;
 blocked_and_incomplete:number;
 statuses:Record<string,number>;
 claim:string;
};
type AuditReport = {summary:JobAuditSummary; jobs:JobAuditEntry[]};
let auditPromise:Promise<AuditReport>|null=null;
const pagesSite=import.meta.env.BASE_URL==='/hhba-talent/' || import.meta.env.VITE_HHBA_VERIFIED_SNAPSHOT==='1';
export async function loadPublicJobAudit():Promise<AuditReport|null>{
 if(!pagesSite)return null;
 if(!auditPromise){
  auditPromise=fetch(import.meta.env.BASE_URL+'data/job-sync-status.json',{
   credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}
  }).then(async reply=>{
   if(!reply.ok)throw Error('SYNC_REPORT_NOT_PUBLISHED');
   const raw=await reply.json();
   if(raw?.summary?.kind!=='HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1'||
      !Array.isArray(raw.jobs)||raw.jobs.length!==raw.summary.total_indexed_jobs)
     throw Error('SYNC_REPORT_INVALID');
   return raw as AuditReport;
  }).catch(e=>{auditPromise=null;throw e});
 }
 return auditPromise;
}
export function auditForJob(report:AuditReport|null,job:LiveJob,indexUpdated:string){
 if(!report || report.summary.indexed_as_of!==indexUpdated)return null;
 const row=report.jobs.find(r=>r.job_id===job.id);
 if(!row||row.platform!==job.platform)return null;
 return row;
}
export function describeAudit(status:string,lang:'zh'|'en'){
 const labels:Record<string,[string,string]>={
  OFFICIAL_JD_AND_REQUIREMENTS_FOUND:['官网发现职责与任职要求','Original JD and requirements identified'],
  OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED:['已发现职位描述，任职要求待核对','Original JD found; requirements unclassified'],
  DOMESTIC_CHANNEL_ONLY:['仅有招聘频道，岗位直达与要求待补','Only a recruitment channel; job details unresolved'],
  DOMESTIC_DETAIL_READER_REQUIRED:['国内岗位详情与技能要求待接入','Domestic details and requirements not synced'],
  OFFICIAL_TITLE_CHANGED:['官网职位名称发生变化，待复核','Official title changed; review required'],
  MISSING_FROM_OFFICIAL_BOARD:['该岗位不在本次官方职位列表中','Not found in latest official listings'],
  OFFICIAL_SOURCE_READ_FAILED:['官方数据源暂时无法核验','Official source temporarily unavailable'],
  OFFICIAL_JD_MISSING_OR_TRUNCATED:['岗位原文缺失或不完整','Official description missing or incomplete'],
  OFFICIAL_URL_CHANGED:['官方职位链接发生变化','Official job link changed']
 };
 return (labels[status] || ['职位详细信息待核验','Job detail verification pending'])[lang==='zh'?0:1];
}


export type OverseasJdProgress = {
 kind:'HHBA_OVERSEAS_JD_SYNC_V1';
 enabled:true;
 persistent:true;
 total_current:number;
 complete:number;
 translated_parts:number;
 expected_parts:number;
 states:Record<string,number>;
 checked_at:string;
 translationBudgetRemaining:number;
 translation_quality?:string;
};
export async function loadOverseasJdProgress():Promise<OverseasJdProgress|null>{
 try{
  const response=await fetch(import.meta.env.VITE_HHBA_VERIFIED_SNAPSHOT==='1'?'/api/jd-sync/status':'https://hhba-web-production-024c.up.railway.app/api/jd-sync/status',{
   method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)return null;
  const status=await response.json() as Partial<OverseasJdProgress>;
  if(status.kind!=='HHBA_OVERSEAS_JD_SYNC_V1'||status.enabled!==true||status.persistent!==true||
   !Number.isInteger(status.total_current)||status.total_current!<1||
   !Number.isInteger(status.complete)||status.complete!<0||status.complete!>status.total_current!||
   !Number.isInteger(status.translated_parts)||status.translated_parts!<0||
   typeof status.checked_at!=='string'||!Number.isFinite(Date.parse(status.checked_at)))return null;
  if(Date.now()-Date.parse(status.checked_at)>10*60_000||Date.parse(status.checked_at)>Date.now()+5*60_000)return null;
  return status as OverseasJdProgress;
 }catch{return null;}
}
