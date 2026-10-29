/**
 * HHBA 国内岗位重新制作 V2 —— 单一批准索引，独立于历史国内岗位快照。
 * 一家公司完成职位证据、图片与卡片验收后才进入 approvedCompanies。
 * 绝不从只有招聘官网的企业自动生成岗位。
 */
import schneider from '../data/domesticSchneiderDetailedDossier20261029.json';
import type {LiveJob,LiveFilters,LivePage} from './liveRecruitment';

export const DOMESTIC_REBUILD_APPROVED_COMPANIES=['施耐德电气'] as const;
export const DOMESTIC_REBUILD_VERSION='2026-10-29-v2';
export const domesticV2Records=schneider.jobs.map(job=>({
 id:'cn-v2-schneider-'+job.id,
 company:'施耐德电气',
 companyZh:'施耐德电气',
 title:job.title,
 titleZh:job.title,
 location:job.city,
 locationZh:job.city,
 platform:'schneider-official',
 source:'schneider-electric',
 url:job.url,
 domestic:true,
 remote:null,
 recordKind:'DOMESTIC_REBUILT',
 recruitmentType:job.type.includes('实习')?'INTERNSHIP':'SOCIAL',
 observedAt:schneider.verifiedOn,
 currentApplicationVerified:false,
 educationLabel:undefined,
 experienceLabel:job.experience,
 majorNames:schneider.majors.filter(m=>job.majorSlugs.includes(m.id)).map(m=>m.name),
 responsibilitiesSummary:job.summary,
 requirementsSummary:job.experience,
 employerRoute:'/companies/autumn/cn-autumn-002'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export function domesticV2ById(id:string):LiveJob|undefined{
 return domesticV2Records.find(job=>job.id===id);
}
export function filterDomesticRebuildJobs(jobs:LiveJob[],f:LiveFilters):LiveJob[]{
 const q=f.q.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return jobs.filter(job=>{
  if(f.country==='global')return false;
  if(f.company&&!('施耐德电气'.includes(f.company)||f.company.toLowerCase().includes('schneider')))return false;
  if(f.location_country&&f.location_country.toUpperCase()!=='CN')return false;
  if(f.city&&!job.locationZh?.includes(f.city)&&!(f.city==='shanghai'&&job.locationZh==='上海')&&!(f.city==='beijing'&&job.locationZh==='北京')&&!(f.city==='guangzhou'&&job.locationZh==='广州'))return false;
  if(f.remote)return false;
  if(f.recruitment_type){
   const type=f.recruitment_type==='REGULAR'?'SOCIAL':f.recruitment_type;
   if(type!==job.recruitmentType)return false;
  }
  if(f.education&&!['UNRESTRICTED_OR_UNREPORTED'].includes(f.education))return false;
  if(f.experience&&f.experience!=='unreported')return false;
  const text=[job.company,job.titleZh,job.locationZh,job.responsibilitiesSummary,job.requirementsSummary,
   ...(job.majorNames||[])].join(' ').normalize('NFKC').toLocaleLowerCase();
  return q.every(term=>text.includes(term));
 });
}
export function assertDomesticRebuildIntegrity(){
 if(domesticV2Records.length!==12)throw Error('SCHNEIDER_SOURCE_RECORD_COUNT_CHANGED');
 const ids=new Set<string>(),urls=new Set<string>();
 for(const job of domesticV2Records){
  if(ids.has(job.id)||urls.has(job.url)||!/^cn-v2-schneider-[0-9]{6}$/.test(job.id)||
    !/^https:\/\/careers\.se\.com\/jobs\/[0-9]{6}\?lang=zh-(?:CN|cn)$/.test(job.url)||
    !job.titleZh||!job.locationZh||!job.responsibilitiesSummary)
   throw Error('DOMESTIC_REBUILD_SOURCE_INVALID '+job.id);
  ids.add(job.id);urls.add(job.url);
 }
 return true;
}
