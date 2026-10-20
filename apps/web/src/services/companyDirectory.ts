import type { LiveJob, LivePage } from './liveRecruitment';
import { cleanLocaleText, officialStatus, safeOfficialJobUrl } from './liveRecruitment';
import { verifiedBrandKey } from '../components/EmployerBrandLogo';

export type EmployerIdentity={
  platform:string;source:string;company:string;
};
const companyIdPattern=/^[A-Za-z0-9_-]{12,600}$/;
const platformPattern=/^[A-Za-z0-9_-]{2,80}$/;
const sourcePattern=/^[A-Za-z0-9_-]{1,110}$/;

// A job board is a source identity, not proof of a wider corporate-group relationship.
// Keep employers on separate ATS sources until a human reviews a legal-entity merge.
export function employerIdentity(job:Pick<LiveJob,'company'|'platform'|'source'>):EmployerIdentity|null{
 const company=cleanLocaleText(job.company);
 const platform=job.platform||'',source=job.source||'';
 if(!company||company.length>120||!platformPattern.test(platform)||!sourcePattern.test(source))
   return null;
 return {platform,source,company};
}
export function identityKey(identity:EmployerIdentity):string{
 return JSON.stringify([identity.platform,identity.source,identity.company]);
}
export function encodeEmployerIdentity(identity:EmployerIdentity):string{
 const bytes=new TextEncoder().encode(identityKey(identity));
 if(bytes.length>420)return '';
 let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeEmployerIdentity(key:string):EmployerIdentity|null{
 if(!companyIdPattern.test(key))return null;
 try{
  const binary=atob(key.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!Array.isArray(parsed)||parsed.length!==3||parsed.some(x=>typeof x!=='string'))return null;
  const [platform,source,company]=parsed;
  const validated=employerIdentity({platform,source,company});
  // Reject multiple URL encodings for one identity (including harmless whitespace).
  if(!validated||encodeEmployerIdentity(validated)!==key)return null;
  return validated;
 }catch{return null}
}
export function employerIdentityMatches(job:LiveJob,identity:EmployerIdentity){
 const real=employerIdentity(job);
 return !!real&&identityKey(real)===identityKey(identity);
}
export function companyPageRouteForJob(job:LiveJob):string|null{
 if(!safeOfficialJobUrl(job))return null;
 const brand=verifiedBrandKey(job);
 if(brand)return '/companies/'+brand;
 const identity=employerIdentity(job);
 const key=identity&&encodeEmployerIdentity(identity);
 return key?'/companies/id/'+key:null;
}
export function discoverEmployerJobs(snapshot:LivePage,auditIds:ReadonlySet<string>,
 identity:EmployerIdentity):LiveJob[]{
 return snapshot.jobs.filter(job=>
   employerIdentityMatches(job,identity)&&auditIds.has(job.id)&&
   officialStatus(job,snapshot.updated)==='recent'&&!!safeOfficialJobUrl(job));
}
export function approvedEmployerJobIds(audit:{
 summary:{indexed_as_of:string};jobs:Array<{job_id:string;status:string}>
 }|null,updated:string):Set<string>|null{
 if(!audit||audit.summary.indexed_as_of!==updated)return null;
 return new Set(audit.jobs.filter(row=>
   row.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND').map(row=>row.job_id));
}
export type EmployerDirectoryRecord={
 id:string;identity:EmployerIdentity;jobCount:number;sampleJobId:string;lastIndexed:string;
 editorialStatus:'NEEDS_REVIEW'|'VERIFIED';
};
export function companyDirectoryFromSnapshot(snapshot:LivePage,auditIds:ReadonlySet<string>){
 const records=new Map<string,EmployerDirectoryRecord>();
 for(const job of snapshot.jobs){
   if(!auditIds.has(job.id)||officialStatus(job,snapshot.updated)!=='recent'||!safeOfficialJobUrl(job))continue;
   const identity=employerIdentity(job);
   if(!identity)continue;
   const key=encodeEmployerIdentity(identity);
   if(!key)continue;
   const current=records.get(key);
   if(current){current.jobCount+=1;continue}
   records.set(key,{id:key,identity,jobCount:1,sampleJobId:job.id,
     lastIndexed:snapshot.updated,editorialStatus:'NEEDS_REVIEW'});
 }
 return [...records.values()].sort((a,b)=>b.jobCount-a.jobCount||
   a.identity.company.localeCompare(b.identity.company));
}
