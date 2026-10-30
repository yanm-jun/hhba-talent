import type {LiveJob} from './liveRecruitment';

export type EmployerPhoto={path:string;caption:string;note:string;alt:string};
export type EmployerService={title:string;description:string;tags:string;details:string[]};
export type EmployerJob={
 id:string;title:string;city:string;url:string;evidenceUrl:string;observedOn:string;
 recruitmentType:'CAMPUS'|'SOCIAL'|'INTERNSHIP';recruitmentSubject:string;
 summary:string;requirements:string;majorNames:string[];editorialRelatedMajors:string[];
 majorUnrestricted:boolean;educationLabel:string;currentOpenVerified:false;
};
export type EmployerProfile={
 schemaVersion:1;id:string;name:string;englishName:string;aliases:string[];
 industry:string;subtitle:string;overview:string;lastReviewed:string;sources:string[];
 media:{logo:string;photos:[EmployerPhoto,EmployerPhoto]};
 recruitment:{url:string;label:string;status:'archived_source'|'official_portal'|'unconfirmed';subject:string;note:string};
 majorIntro:string;preferredMajors:string[];photoNote:string;business:EmployerService[];jobs:EmployerJob[];
};
/* Vite eagerly includes every approved profile JSON in this directory.
   Adding the next company only adds data/images; no route or index edits. */
const modules=import.meta.glob('../data/employerProfiles/*.json',{eager:true,import:'default'}) as Record<string,EmployerProfile>;
export const employerProfiles=Object.entries(modules).sort(([a],[b])=>a.localeCompare(b))
 .map(([file,profile])=>{
  if(!/^cn-autumn-\d{3}$/.test(profile?.id||'')||!file.endsWith('/'+profile.id+'.json')||profile.schemaVersion!==1)
   throw Error('Invalid employer factory identity: '+file);
  return profile;
 });
export const employerProfileById=new Map(employerProfiles.map(p=>[p.id,p]));
export const employerProfileByRoute=new Map(employerProfiles.map(p=>['/companies/autumn/'+p.id,p]));
export const profileJobById=new Map(employerProfiles.flatMap(p=>p.jobs.map(j=>['cn-v2-profile-'+p.id+'-'+j.id,{profile:p,job:j}] as const)));
export function employerProfileFor(input:{name?:string;route?:string}){
 const routed=input.route?employerProfileByRoute.get(input.route):undefined;
 if(routed)return routed;
 const name=(input.name||'').normalize('NFKC').trim().toLocaleLowerCase();
 return employerProfiles.find(p=>[p.name,p.englishName,...p.aliases].some(x=>x.normalize('NFKC').trim().toLocaleLowerCase()===name));
}
/* Data-only job links are pinned to a reviewed JSON record and its audited
   HTTPS URL; they cannot be overridden by runtime query parameters. */
export function allowedEmployerProfileJobLink(id:string,url:string):boolean{
 const record=profileJobById.get(id);
 if(!record||record.job.url!==url||record.job.currentOpenVerified!==false)return false;
 try{
  const u=new URL(url),e=new URL(record.job.evidenceUrl);
  return u.protocol==='https:'&&e.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
   u.hostname.toLowerCase()===new URL(record.profile.recruitment.url).hostname.toLowerCase();
 }catch{return false}
}
export function profileAliasesForJob(job:Pick<LiveJob,'employerRoute'>):string[]{
 return employerProfileByRoute.get(job.employerRoute||'')?.aliases||[];
}
