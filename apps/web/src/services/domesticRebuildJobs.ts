/**
 * HHBA 国内岗位重新制作 V2 —— 单一批准索引，独立于历史国内岗位快照。
 * 一家公司完成职位证据、图片与卡片验收后才进入 approvedCompanies。
 * 绝不从只有招聘官网的企业自动生成岗位。
 */
import schneider from '../data/domesticSchneiderDetailedDossier20261029.json';
import kpmgJobs from '../data/domesticKpmgConcreteJobs20261029.json';
import huayuJobs from '../data/domesticHuayuVisionRoles20261029.json';
import huaanJobs from '../data/domesticHuaanSecuritiesRoles20261029.json';
import guangfaJobs from '../data/domesticGuangfaSecuritiesRoles20261029.json';
import citicsJobs from '../data/domesticCiticsSecuritiesRoles20261029.json';
import pfizerJobs from '../data/domesticPfizerOfficialJobs20261029.json';
import type {LiveJob,LiveFilters,LivePage} from './liveRecruitment';

export const DOMESTIC_REBUILD_APPROVED_COMPANIES=['施耐德电气','毕马威','华域视觉科技（上海）有限公司','华安证券','广发证券','中信证券','辉瑞'] as const;
export const DOMESTIC_REBUILD_VERSION='2026-10-29-v2';
const schneiderV2Records=schneider.jobs.map(job=>({
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

export const kpmgV2Records=kpmgJobs.jobs.map(job=>({
 id:'cn-v2-kpmg-'+job.id,
 company:'毕马威',companyZh:'毕马威',title:job.title,titleZh:job.title,
 location:job.city,locationZh:job.city,
 platform:'kpmg-moka-official',source:'kpmg',url:job.url,
 domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:job.recruitmentType,observedAt:job.publishedOn,
 currentApplicationVerified:false,
 experienceLabel:'历史招聘记录 · 当前岗位状态未核实',
 majorNames:job.majors,
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirement,
 employerRoute:'/companies/autumn/cn-autumn-001'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export const huayuV2Records=huayuJobs.jobs.map(job=>({
 id:'cn-v2-huayu-'+job.id,
 company:'华域视觉科技（上海）有限公司',companyZh:'华域视觉',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'huayu-official-campus',source:'huayu-vision',url:job.sourceUrl,
 domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:'CAMPUS',observedAt:job.observedOn,
 currentApplicationVerified:false,
 educationLabel:undefined,experienceLabel:undefined,
 majorNames:job.majors,responsibilitiesSummary:job.summary,
 requirementsSummary:job.requirement,
 employerRoute:'/companies/domestic/rel-huayu-004'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export const huaanV2Records=huaanJobs.jobs.map(job=>({
 id:'cn-v2-huaan-'+job.id,company:'华安证券',companyZh:'华安证券',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'huaan-securities-official',source:'huaan-securities',url:job.officialListingUrl,
 domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:'SOCIAL',observedAt:huaanJobs.announcementDate,
 currentApplicationVerified:false,experienceLabel:'历史公开招聘（2026年7月至9月截止）',
 majorNames:job.majors,responsibilitiesSummary:job.summary,requirementsSummary:job.requirement,
 employerRoute:'/companies/domestic/a-600909'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export const guangfaV2Records=guangfaJobs.jobs.map(job=>({
 id:'cn-v2-guangfa-'+job.id,company:'广发证券',companyZh:'广发证券',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'guangfa-securities-official',source:'guangfa-securities',url:job.officialListingUrl,
 domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:'CAMPUS',observedAt:guangfaJobs.announcementPublished,
 currentApplicationVerified:false,experienceLabel:'2027届秋招历史公告，2026-09-30已截止',
 majorNames:job.majors,responsibilitiesSummary:job.summary,requirementsSummary:job.requirement,
 employerRoute:'/companies/domestic/a-000776'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export const citicsV2Records=citicsJobs.jobs.map(job=>({
 id:'cn-v2-citics-'+job.id,company:'中信证券',companyZh:'中信证券',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'citics-branch-campus-official',source:'citics-securities',
 url:job.officialListingUrl,
 domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:'CAMPUS',observedAt:job.publishedOn,
 currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'2027届校招 · 官网申请状态尚未核实',
 majorNames:job.majors,responsibilitiesSummary:job.responsibilities,
 requirementsSummary:job.requirements,
 positionOrg:job.office,evidenceUrl:job.sourceUrl,
 employerRoute:'/companies/domestic/a-600030'
} satisfies LiveJob & {majorNames:string[];employerRoute:string;positionOrg:string;evidenceUrl:string}));

export const pfizerV2Records=pfizerJobs.jobs.map(job=>({
 id:'cn-v2-pfizer-'+job.id.replace('cn-autumn-pfizer-',''),
 company:'辉瑞',companyZh:'辉瑞',
 title:job.title,titleZh:job.title,location:job.cities[0],locationZh:job.cities[0],
 platform:'pfizer-official',source:'pfizer',
 url:job.sourceUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:'SOCIAL',
 observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'职位是否仍在招请进入辉瑞官网核对',
 majorNames:job.majors,
 responsibilitiesSummary:job.responsibilities,requirementsSummary:job.requirements,
 employerRoute:'/companies/autumn/cn-autumn-003'
} satisfies LiveJob & {majorNames:string[];employerRoute:string}));

export const domesticV2Records=[...schneiderV2Records,...kpmgV2Records,...huayuV2Records,...huaanV2Records,...guangfaV2Records,...citicsV2Records,...pfizerV2Records];

export function domesticV2ById(id:string):LiveJob|undefined{
 return domesticV2Records.find(job=>job.id===id);
}
export function filterDomesticRebuildJobs(jobs:LiveJob[],f:LiveFilters):LiveJob[]{
 const q=f.q.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return jobs.filter(job=>{
  if(f.country==='global')return false;
  if(f.company&&!(['施耐德电气','毕马威','华域视觉科技（上海）有限公司','华域视觉','schneider electric','kpmg','hasco vision','华安证券','huaan securities','广发证券','gf securities','中信证券','citic securities','辉瑞','pfizer'].some(x=>x.toLowerCase().includes(f.company.toLowerCase()))))return false;
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
 if(schneiderV2Records.length!==12||kpmgV2Records.length!==6||huayuV2Records.length!==16||huaanV2Records.length!==10||guangfaV2Records.length!==10||citicsV2Records.length!==5||pfizerV2Records.length!==4||domesticV2Records.length!==63)
  throw Error('REBUILT_COMPANY_JOB_COUNT_CHANGED');
 const ids=new Set<string>(),urls=new Set<string>();
 for(const job of domesticV2Records){
  if(ids.has(job.id)||(!['huayu-official-campus','huaan-securities-official','guangfa-securities-official','citics-branch-campus-official'].includes(job.platform)&&urls.has(job.url))||
    !(job.platform==='schneider-official'&&/^cn-v2-schneider-[0-9]{6}$/.test(job.id)&&
      /^https:\/\/careers\.se\.com\/jobs\/[0-9]{6}\?lang=zh-(?:CN|cn)$/.test(job.url)||
      job.platform==='kpmg-moka-official'&&/^cn-v2-kpmg-[0-9a-f-]{36}$/.test(job.id)&&
      /^https:\/\/app\.mokahr\.com\/(?:social-recruitment|m\/campus-recruitment)\/kpmg\/(?:68240|76195)#\/job\/[0-9a-f-]{36}$/.test(job.url)||
      job.platform==='huayu-official-campus'&&/^cn-v2-huayu-[a-z-]{5,80}$/.test(job.id)&&
      job.url==='https://hascovision.zhiye.com/campus/jobs'||
      job.platform==='huaan-securities-official'&&/^cn-v2-huaan-[a-z-]{5,75}$/.test(job.id)&&
      job.url==='https://hahr.hazq.com:8083/eip4ha-hyapp/recruitment'||
      job.platform==='guangfa-securities-official'&&/^cn-v2-guangfa-[a-z-]{5,80}$/.test(job.id)&&
      job.url==='https://job.gf.com.cn/'||
      job.platform==='citics-branch-campus-official'&&/^cn-v2-citics-[a-z-]{5,85}$/.test(job.id)&&
      job.url==='https://careers.citics.com/campus/branch')||
      job.platform==='pfizer-official'&&/^cn-v2-pfizer-[0-9]{7}$/.test(job.id)&&
      job.url==='https://www.pfizer.com/about/careers/job/'+job.id.replace('cn-v2-pfizer-','')+'?langcode=en'||
    !job.titleZh||!job.locationZh||!job.responsibilitiesSummary)
   throw Error('DOMESTIC_REBUILD_SOURCE_INVALID '+job.id);
  ids.add(job.id);urls.add(job.url);
 }
 return true;
}
