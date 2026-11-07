import type {ApplicationRecord} from './applyCredits';
import type {LiveJob} from './liveRecruitment';

// A record absence is NEVER evidence the applicant did not apply elsewhere.
export type ApplicationDisplayState='confirmed'|'pending'|'manual'|'possible'|'unrecorded';
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase();
const canonical=(raw:string)=>{
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:')return null;
  const qs=new URLSearchParams();
  for(const [k,v] of u.searchParams)if(['gh_jid','jobid','job_id','positionid','reqid'].includes(k.toLowerCase())
   &&/^[A-Za-z0-9_-]{1,110}$/.test(v))qs.set(k.toLowerCase(),v);
  return u.origin+u.pathname+(qs.size?'?'+qs.toString():'');
 }catch{return null}
};
export function jobApplicationDisplay(job:LiveJob,applications:ApplicationRecord[]):ApplicationDisplayState{
 const companies=[job.company,job.companyZh||''].filter(Boolean).map(norm);
 const roles=[job.title,job.titleZh||''].filter(Boolean).map(norm);
 const link=canonical(job.url);
 let possible=false;
 for(const row of applications){
  if(!companies.includes(norm(row.company))||!roles.includes(norm(row.position)))continue;
  const recordUrl=canonical(row.applicationUrl);
  if(link&&recordUrl===link)return row.status;
  try{
   if(link&&recordUrl&&new URL(recordUrl).hostname===new URL(link).hostname)
    possible=true;
  }catch{}
 }
 return possible?'possible':'unrecorded';
}
export const applicationDisplayLabel=(status:ApplicationDisplayState,lang:'zh'|'en'='zh')=>{
 const cn:Record<ApplicationDisplayState,string>={
  confirmed:'页面显示已投递',pending:'投递待确认',manual:'本人标记已投递',
  possible:'可能有投递记录',unrecorded:'未记录投递'
 };
 const en:Record<ApplicationDisplayState,string>={
  confirmed:'Success notice recorded',pending:'Awaiting confirmation',manual:'Self-reported applied',
  possible:'Possibly recorded',unrecorded:'No application recorded'
 };
 return (lang==='en'?en:cn)[status];
};
