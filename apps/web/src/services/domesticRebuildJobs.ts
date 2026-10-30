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
import csairJobs from '../data/domesticCsairVerifiedPositions20261029.json';
import sftechJobs from '../data/domesticSfTechCampusRoles20261029.json';
import neteaseJobs from '../data/domesticNeteaseCampusRoleDirections20261029.json';
import hypergryphJobs from '../data/domesticHypergryph2027Roles20261029.json';
import ankerJobs from '../data/domesticAnker2027OfficialRoles20261030.json';
import laifenJobs from '../data/domesticLaifenSourcedRoles20261030.json';
import shkpJobs from '../data/domesticShkp2026SourcedRoles20261030.json';
import boyuJobs from '../data/domesticBoyu2026OfficialSchoolRoles20261030.json';
import type {LiveJob,LiveFilters,LivePage} from './liveRecruitment';
import {employerProfiles,employerProfileByRoute,profileAliasesForJob} from './employerProfiles';

export const DOMESTIC_REBUILD_APPROVED_COMPANIES=['施耐德电气','毕马威','华域视觉科技（上海）有限公司','华安证券','广发证券','中信证券','辉瑞','中国南方航空','顺丰','网易游戏','鹰角网络','安克创新','徕芬科技','新鸿基地产','万科泊寓'] as const;
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
 majorNames:job.majors,majorUnrestricted:job.majorsRequirement.startsWith('不限专业'),responsibilitiesSummary:job.responsibilities,
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

export const csairV2Records=csairJobs.jobs.map(job=>({
 id:'cn-v2-csair-'+job.id,
 company:'中国南方航空',companyZh:'中国南方航空',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'csair-official-list',source:'china-southern',
 url:job.sourceUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:job.type,
 observedAt:job.date,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'南航招聘官网公开列表：具体任职要求及申请状态未核对',
 majorNames:job.majors,responsibilitiesSummary:job.summary,
 requirementsSummary:job.requirements,
 evidenceUrl:job.sourceUrl,employerRoute:'/companies/autumn/cn-autumn-004'
} satisfies LiveJob & {majorNames:string[];evidenceUrl:string;employerRoute:string}));

export const sftechV2Records=sftechJobs.jobs.map(job=>({
 id:'cn-v2-sftech-'+job.id,
 company:'顺丰科技有限公司',companyZh:'顺丰科技',
 title:job.title,titleZh:job.title,
 location:job.city,locationZh:job.city+'（公告汇总，单岗地点未核实）',
 platform:'sftech-2027-campus-list',source:'sf-tech',
 url:job.sourceUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:'CAMPUS',
 observedAt:job.evidencePublicationDate,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'2027届校园招聘 · 单岗专业与岗位状态待官方核对',
 majorNames:job.majors,editorialRelatedMajors:job.editorialRelatedMajors,responsibilitiesSummary:job.summary,
 requirementsSummary:job.requirements,
 positionOrg:'顺丰科技有限公司',evidenceUrl:job.evidenceUrl,
 employerRoute:'/companies/autumn/cn-autumn-005'
} satisfies LiveJob & {majorNames:string[];evidenceUrl:string;positionOrg:string;employerRoute:string}));

export const neteaseV2Records=neteaseJobs.jobs.map(job=>({
 id:'cn-v2-netease-'+job.id,
 company:'网易游戏（互娱）',companyZh:'网易游戏',
 title:job.title,titleZh:job.title,
 location:job.location,locationZh:job.location,
 platform:'netease-interactive-2027-direction',source:'netease-interactive',
 url:job.sourceUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:'CAMPUS',
 observedAt:job.publishedOn,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'2027届网易互娱校招 · 独立官方职位页面暂未核实',
 majorNames:job.majors,editorialRelatedMajors:job.editorialRelatedMajors,responsibilitiesSummary:job.summary,
 requirementsSummary:job.requirements,
 positionOrg:job.company,evidenceUrl:job.titleEvidenceUrl,
 employerRoute:'/companies/autumn/cn-autumn-006'
} satisfies LiveJob & {majorNames:string[];positionOrg:string;evidenceUrl:string;employerRoute:string}));

export const hypergryphV2Records=hypergryphJobs.jobs.map(job=>({
 id:'cn-v2-hypergryph-'+job.id,
 company:'上海鹰角网络科技有限公司',companyZh:'鹰角网络',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city+'（公告项目城市，逐岗待核实）',
 platform:'hypergryph-2027-campus-reported',source:'hypergryph',
 url:job.officialListUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:'CAMPUS',
 observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'2027届秋招岗位名称公开提及 · 独立职位链接和专业资格待官方核实',
 majorNames:job.majors,editorialRelatedMajors:job.editorialRelatedMajors,
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirements,
 positionOrg:job.company,evidenceUrl:job.evidenceUrl,
 employerRoute:'/companies/autumn/cn-autumn-007'
} satisfies LiveJob & {majorNames:string[];editorialRelatedMajors:string[];positionOrg:string;evidenceUrl:string;employerRoute:string}));

export const ankerV2Records=ankerJobs.jobs.map(job=>({
 id:'cn-v2-anker-'+job.id,
 company:'安克创新科技股份有限公司',companyZh:'安克创新',
 title:job.title,titleZh:job.title,location:job.city,locationZh:job.city,
 platform:'anker-2027-campus-official',source:'anker-innovations',
 url:job.individualUrl||job.officialListUrl,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:'CAMPUS',
 observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:job.individualPermalinkVerified?'已核对官方独立职位详情，是否仍可申请以官网为准':'已核对官方职位列表；逐岗资格和开放状态需官网核验',
 majorNames:job.majors,editorialRelatedMajors:job.editorialRelatedMajors,
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirements,
 positionOrg:job.company,evidenceUrl:job.individualUrl||job.evidenceUrl,
 employerRoute:'/companies/autumn/cn-autumn-008'
} satisfies LiveJob & {majorNames:string[];editorialRelatedMajors:string[];positionOrg:string;evidenceUrl:string;employerRoute:string}));

export const laifenV2Records=laifenJobs.jobs.map(job=>({
 id:'cn-v2-laifen-'+job.id,
 company:'深圳术叶创新科技有限公司',companyZh:'徕芬科技',title:job.title,titleZh:job.title,
 location:job.city,locationZh:job.city,platform:'laifen-sourced-archived',source:'laifen',
 url:job.sourceUrl,domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:job.recruitmentType,observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:job.cohort,experienceLabel:job.recordKind==='archived_named_role_2026'?'2026年历史岗位 · 现已过期或状态未知':'2027届公开线索 · 未获取官方逐岗链接',
 majorNames:job.majors,editorialRelatedMajors:job.editorialRelatedMajors,
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirements,positionOrg:laifenJobs.company,
 evidenceUrl:job.evidenceUrl,employerRoute:'/companies/autumn/cn-autumn-009'
} satisfies LiveJob & {majorNames:string[];editorialRelatedMajors:string[];evidenceUrl:string;employerRoute:string}));

export const shkpV2Records=shkpJobs.jobs.map(job=>({
 id:'cn-v2-shkp-'+job.id,company:'新鸿基地产',companyZh:'新鸿基地产',
 title:job.title,titleZh:job.title,location:'香港',locationZh:'香港',
 platform:'shkp-official-detail',source:'sun-hung-kai-properties',
 url:job.officialJobUrl,domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:'SOCIAL',observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:'按官方逐岗详情页核验',experienceLabel:'历史公开职位页面 · 实时投递状态待核实',
 majorNames:job.majorNames,editorialRelatedMajors:job.editorialRelatedMajors,
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirements,
 evidenceUrl:job.titleEvidenceUrl,employerRoute:'/companies/autumn/cn-autumn-010'
} satisfies LiveJob & {majorNames:string[];editorialRelatedMajors:string[];evidenceUrl:string;employerRoute:string}));

export const boyuV2Records=boyuJobs.jobs.map(job=>({
 id:'cn-v2-boyu-'+job.id,company:'万科泊寓',companyZh:'万科泊寓',title:job.title,titleZh:job.title,
 location:job.city,locationZh:job.city,platform:'boyu-tjcu-source',source:'boyu-tianjin',
 url:job.url,domestic:true,remote:null,recordKind:'DOMESTIC_REBUILT',
 recruitmentType:job.type,observedAt:'2026-09-11',currentApplicationVerified:false,
 educationLabel:job.education,experienceLabel:'学校招聘公开记录 · 当前开放状态未核验',
 majorNames:job.majors,editorialRelatedMajors:job.related,majorUnrestricted:job.title==='万寓生',
 responsibilitiesSummary:job.summary,requirementsSummary:job.requirements,
 evidenceUrl:job.url,positionOrg:boyuJobs.employer,employerRoute:'/companies/autumn/cn-autumn-011'
} satisfies LiveJob & {majorNames:string[];editorialRelatedMajors:string[];evidenceUrl:string;positionOrg:string;employerRoute:string}));
const legacyDomesticV2Records=[...schneiderV2Records,...kpmgV2Records,...huayuV2Records,...huaanV2Records,...guangfaV2Records,...citicsV2Records,...pfizerV2Records,...csairV2Records,...sftechV2Records,...neteaseV2Records,...hypergryphV2Records,...ankerV2Records,...laifenV2Records,...shkpV2Records,...boyuV2Records];
export const profileV2Records=employerProfiles.flatMap(profile=>profile.jobs.map(job=>({
 id:'cn-v2-profile-'+profile.id+'-'+job.id,
 company:profile.name,companyZh:profile.name,title:job.title,titleZh:job.title,
 location:job.city,locationZh:job.city,url:job.url,
 platform:'hhba-employer-profile',source:profile.id,domestic:true,remote:null,
 recordKind:'DOMESTIC_REBUILT',recruitmentType:job.recruitmentType,
 observedAt:job.observedOn,currentApplicationVerified:false,
 educationLabel:job.educationLabel,experienceLabel:'来源已存档 · 当前投递状态未确认',
 majorNames:job.majorNames,editorialRelatedMajors:job.editorialRelatedMajors,
 majorUnrestricted:job.majorUnrestricted,responsibilitiesSummary:job.summary,
 requirementsSummary:job.requirements,positionOrg:job.recruitmentSubject,
 evidenceUrl:job.evidenceUrl,employerRoute:'/companies/autumn/'+profile.id
} satisfies LiveJob & {employerRoute:string;positionOrg:string;evidenceUrl:string})));
export const domesticV2Records=[...legacyDomesticV2Records,...profileV2Records];

export function domesticV2ById(id:string):LiveJob|undefined{
 return domesticV2Records.find(job=>job.id===id);
}
export function filterDomesticRebuildJobs(jobs:LiveJob[],f:LiveFilters):LiveJob[]{
 const q=f.q.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return jobs.filter(job=>{
  if(f.country==='global')return false;
  if(f.company){
   const term=f.company.normalize('NFKC').toLowerCase().trim();
   const profile=employerProfiles.find(p=>[p.name,p.englishName,...p.aliases].some(x=>x.normalize('NFKC').toLowerCase().includes(term)));
   if(profile&&job.employerRoute!=='/companies/autumn/'+profile.id)return false;
  }
  if(f.company&&['万科泊寓','泊寓','port apartment','port'].some(alias=>alias.includes(f.company.trim().toLowerCase())||f.company.trim().toLowerCase().includes(alias))&&job.company!=='万科泊寓')return false;
  if(f.company&&['新鸿基地产','新鴻基地產','shkp','sun hung kai properties'].some(alias=>alias.includes(f.company.trim().toLowerCase())||f.company.trim().toLowerCase().includes(alias))&&job.company!=='新鸿基地产')return false;
  if(f.company&&['徕芬科技','徕芬','laifen'].some(alias=>alias.includes(f.company.trim().toLowerCase())||f.company.trim().toLowerCase().includes(alias))&&job.company!=='深圳术叶创新科技有限公司')return false;
  if(f.company&&['安克创新','anker innovations','anker'].some(alias=>alias.includes(f.company.trim().toLocaleLowerCase())||f.company.trim().toLocaleLowerCase().includes(alias))&&job.company!=='安克创新科技股份有限公司')return false;
  if(f.company&&!(['施耐德电气','毕马威','华域视觉科技（上海）有限公司','华域视觉','schneider electric','kpmg','hasco vision','华安证券','huaan securities','广发证券','gf securities','中信证券','citic securities','辉瑞','pfizer','中国南方航空','南航','china southern','顺丰','顺丰科技','sf express','sf technology','网易游戏','网易互娱','netease games','netease','鹰角网络','hypergryph','安克创新','anker innovations','anker','徕芬科技','徕芬','laifen','新鸿基地产','新鴻基地產','shkp','sun hung kai properties','万科泊寓','泊寓','port apartment','port'].some(x=>x.toLowerCase().includes(f.company.toLowerCase()))||employerProfiles.some(p=>[p.name,p.englishName,...p.aliases].some(x=>x.toLowerCase().includes(f.company.toLowerCase())))))return false;
  if(f.location_country&&f.location_country.toUpperCase()!=='CN')return false;
  if(f.city&&!job.locationZh?.includes(f.city)&&!(f.city==='shanghai'&&job.locationZh==='上海')&&!(f.city==='beijing'&&job.locationZh==='北京')&&!(f.city==='guangzhou'&&job.locationZh==='广州'))return false;
  if(f.remote)return false;
  if(f.recruitment_type){
   const type=f.recruitment_type==='REGULAR'?'SOCIAL':f.recruitment_type;
   if(type!==job.recruitmentType)return false;
  }
  if(f.education&&!['UNRESTRICTED_OR_UNREPORTED'].includes(f.education))return false;
  if(f.experience&&f.experience!=='unreported')return false;
  const text=[job.company,job.companyZh,...profileAliasesForJob(job),job.platform==='anker-2027-campus-official'?'Anker Innovations Anker 安克创新':'',job.platform==='laifen-sourced-archived'?'Laifen 徕芬科技 徕芬':'' ,job.platform==='shkp-official-detail'?'Sun Hung Kai Properties SHKP 新鸿基地产 新鴻基地產':'' ,job.platform==='boyu-tjcu-source'?'Port Apartment PORT 泊寓 万科泊寓':'' ,job.titleZh,job.locationZh,job.responsibilitiesSummary,job.requirementsSummary,
   ...(job.majorNames||[]),...(job.editorialRelatedMajors||[])].join(' ').normalize('NFKC').toLocaleLowerCase();
  return q.every(term=>text.includes(term));
 });
}
export function assertDomesticRebuildIntegrity(){
 if(schneiderV2Records.length!==12||kpmgV2Records.length!==6||huayuV2Records.length!==16||huaanV2Records.length!==10||guangfaV2Records.length!==10||citicsV2Records.length!==5||pfizerV2Records.length!==4||csairV2Records.length!==6||sftechV2Records.length!==17||neteaseV2Records.length!==14||hypergryphV2Records.length!==20||ankerV2Records.length!==24||laifenV2Records.length!==6||shkpV2Records.length!==8||boyuV2Records.length!==2||domesticV2Records.length!==160+profileV2Records.length)
  throw Error('REBUILT_COMPANY_JOB_COUNT_CHANGED');
 const ids=new Set<string>(),urls=new Set<string>();
 for(const job of domesticV2Records){
  if(ids.has(job.id)||(!['huayu-official-campus','huaan-securities-official','guangfa-securities-official','citics-branch-campus-official','csair-official-list','sftech-2027-campus-list','netease-interactive-2027-direction','hypergryph-2027-campus-reported','anker-2027-campus-official','laifen-sourced-archived','shkp-official-detail','boyu-tjcu-source','hhba-employer-profile'].includes(job.platform)&&urls.has(job.url))||
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
      job.url==='https://careers.citics.com/campus/branch'||
      job.platform==='pfizer-official'&&/^cn-v2-pfizer-[0-9]{7}$/.test(job.id)&&
      job.url==='https://www.pfizer.com/about/careers/job/'+job.id.replace('cn-v2-pfizer-','')+'?langcode=en'||
      job.platform==='csair-official-list'&&/^cn-v2-csair-[a-z-]{6,100}$/.test(job.id)&&
      job.url==='https://job.csair.cn/global'||
      job.platform==='sftech-2027-campus-list'&&/^cn-v2-sftech-[a-z0-9-]{5,100}$/.test(job.id)&&
      job.url==='https://campus.sf-express.com/#/homePage'||
      job.platform==='netease-interactive-2027-direction'&&/^cn-v2-netease-[a-z-]{4,100}$/.test(job.id)&&
      job.url==='https://campus.game.163.com/'||
      job.platform==='hypergryph-2027-campus-reported'&&/^cn-v2-hypergryph-[a-z0-9-]{5,100}$/.test(job.id)&&
      job.url==='https://career.hypergryph.com/'||
      job.platform==='hhba-employer-profile'&&/^cn-v2-profile-cn-autumn-[0-9]{3}-[a-z0-9-]{3,70}$/.test(job.id)&&
      employerProfileByRoute.get(job.employerRoute||'')?.jobs.some(row=>
        job.id==='cn-v2-profile-'+job.source+'-'+row.id&&job.url===row.url)||
      job.platform==='boyu-tjcu-source'&&/^cn-v2-boyu-[a-z0-9-]{5,100}$/.test(job.id)&&
      ['https://career.tjcu.edu.cn/correcruit/content/id/12292.html','https://career.tjcu.edu.cn/correcruit/content/id/9565.html'].includes(job.url)||
      job.platform==='shkp-official-detail'&&/^cn-v2-shkp-[a-z0-9-]{5,100}$/.test(job.id)&&
      /^https:\/\/www\.shkp\.com\/en-US\/work-with-us\/job-vacancies\/[a-z-]+\/[a-z0-9-]+$/.test(job.url)||
      job.platform==='laifen-sourced-archived'&&/^cn-v2-laifen-[a-z0-9-]{5,100}$/.test(job.id)&&
      ['https://app.mokahr.com/campus-recruitment/laifen/146139?locale=zh-CN','https://app.mokahr.com/social-recruitment/laifen/146138'].includes(job.url)||
      job.platform==='anker-2027-campus-official'&&/^cn-v2-anker-[a-z0-9-]{5,100}$/.test(job.id)&&
      (job.url.startsWith('https://career.anker.com.cn/universities/recruitment/jobPosts/?direction=')&&
       ['algorithm','software_embedded','hardware_dev','marketing_brand','channel_customer','finance_investment'].some(d=>job.url==='https://career.anker.com.cn/universities/recruitment/jobPosts/?direction='+d+'&from=campus')||
       ['https://career.anker.com.cn/jobDetail/?jobId=7671180235925244214&websiteId=6962795203808217351',
        'https://career.anker.com.cn/larkJobDetail/?jobId=7670845024406849818&websiteId=6962795203808217351'].includes(job.url)))||
    !job.titleZh||!job.locationZh||!job.responsibilitiesSummary)
   throw Error('DOMESTIC_REBUILD_SOURCE_INVALID '+job.id);
  ids.add(job.id);urls.add(job.url);
 }
 return true;
}
