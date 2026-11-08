// Pure helpers for the HHBA Cloudflare resume-matching service.
// Never turn a model guess or stale employer posting into a verified job.
import {deriveDocumentedWorkTenure} from './resume-tenure.js';
import {scoreCandidateFit} from './match-ranking.js';
export const MAX_TEXT_LENGTH=20000;
export function redactForModel(value){
 if(typeof value!=='string')return '';
 return value.slice(0,MAX_TEXT_LENGTH)
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[邮箱已隐藏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[手机号已隐藏]')
  .replace(/(?<![0-9A-Za-z])\d{17}[0-9Xx](?![0-9A-Za-z])/g,'[身份证号已隐藏]')
  .replace(/\b(?:https?:\/\/)[^\s<>]{3,200}/gi,'[个人网址已隐藏]')
  .replace(/(?:微信号|微信|QQ号|QQ)\s*[:：]\s*[A-Za-z0-9_-]{5,32}/gi,'[即时通讯账号已隐藏]')
  .trim();
}
export function verifiedProfile(raw,text,now=new Date()){
 if(!raw||typeof raw!=='object')throw Error('AI_PROFILE_INCOMPLETE');
 const original=String(text||'');
 const asEvidence=(value)=>{
  if(typeof value!=='string')return null;
  const part=value.trim();
  return part.length>=2&&part.length<=240&&original.toLowerCase().includes(part.toLowerCase())?part:null;
 };
 const degreeEvidence=asEvidence(raw.education_evidence);
 // A real snippet alone is not evidence for an *arbitrary* degree level.
 const degrees={
  HIGH_SCHOOL:/(?:高中|high[\s-]?school)/i,
  ASSOCIATE:/(?:大专|专科|associate(?:'s)?(?:\s+degree)?)/i,
  BACHELOR:/(?:本科|学士|bachelor(?:'s)?|B\.?\s?Sc\.?\b|B\.?\s?A\.?\b)/i,
  MASTER:/(?:硕士|master(?:'s)?|M\.?\s?Sc\.?\b|\bMBA\b)/i,
  PHD:/(?:博士|Ph\.?\s?D\.?\b|doctorate)/i,
 };
 const education=degreeEvidence&&typeof raw.education==='string'&&
  degrees[raw.education]?.test(degreeEvidence)?raw.education:null;
 const yearEvidence=asEvidence(raw.experience_evidence);
 // Require explicit years-of-work evidence; dates alone cannot substantiate tenure.
 const stated=yearEvidence&&
  !/(?:实习|兼职|项目经历|项目经验|在校|internship|part[ -]?time)/i.test(yearEvidence)?
  yearEvidence.match(/(?:工作经验|全职工作|实际工作|工作)\s*(\d+(?:\.\d+)?)\s*年|(\d+(?:\.\d+)?)\s*年(?:工作经验|全职工作|实际工作|工作)/):null;
 const confirmed=stated?Number(stated[1]||stated[2]):null;
 const statedYears=confirmed!==null&&Number.isFinite(raw.experience_years)&&
  raw.experience_years===confirmed&&confirmed>=0&&confirmed<=50?confirmed:null;
 // Fallback only to clear employment timelines, not projects, education or internships.
 // The model cannot supply or extend these dates: they come from the resume text.
 const documented=statedYears===null?deriveDocumentedWorkTenure(original,now):null;
 const years=statedYears??documented?.years??null;
 const yearsEvidence=statedYears!==null?yearEvidence:documented?.evidence??null;
 const skills=[],seen=new Set();
 for(const value of Array.isArray(raw.skills)?raw.skills.slice(0,20):[]){
  const name=typeof value?.name==='string'?value.name.trim().slice(0,60):'';
  const evidence=asEvidence(value?.evidence);
  if(!name||!evidence||seen.has(name.toLowerCase())||!evidence.toLowerCase().includes(name.toLowerCase()))continue;
  skills.push({name,evidence});seen.add(name.toLowerCase());
 }
 const roles=[...new Set((Array.isArray(raw.target_roles)?raw.target_roles:[]).filter(x=>typeof x==='string'&&x.trim().length>=2&&x.length<=70).map(x=>x.trim()).filter(x=>original.toLowerCase().includes(x.toLowerCase())))].slice(0,6);
 return {education,education_evidence:education?degreeEvidence:null,
  experience_years:years,experience_evidence:years===null?null:yearsEvidence,
  skills,target_roles:roles,warnings:[]};
}
function safeJobLink(j){
 if(!j||typeof j!=='object'||!['ashby','greenhouse','lever'].includes(j.platform))return false;
 if(typeof j.id!=='string'||!/^[A-Za-z0-9_-]{5,180}$/.test(j.id)||typeof j.url!=='string')return false;
 if(typeof j.title!=='string'||j.title.length<2||j.title.length>220||typeof j.company!=='string'||!j.company.trim())return false;
 try{
  const u=new URL(j.url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
  if(typeof j.source!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(j.source))return false;
  const prefix=j.platform+'-'+j.source+'-';
  if(!j.id.startsWith(prefix))return false;
  const nativeId=j.id.slice(prefix.length),segments=u.pathname.split('/').filter(Boolean);
  if(!nativeId||nativeId.length>110)return false;
  if(j.platform==='ashby')return u.hostname==='jobs.ashbyhq.com'&&
   segments[0]===j.source&&segments[1]===nativeId;
  if(j.platform==='lever')return (u.hostname==='jobs.lever.co'||u.hostname.endsWith('.lever.co'))&&
   segments[0]===j.source&&segments[1]===nativeId;
  if(j.platform==='greenhouse'){
   const official=u.hostname==='boards.greenhouse.io'||
    u.hostname==='job-boards.greenhouse.io'||u.hostname==='boards.eu.greenhouse.io'||
    u.hostname.endsWith('.greenhouse.io')||u.hostname.endsWith('.greenhouse.com');
   return official&&(segments.includes(nativeId)||[...u.searchParams.values()].includes(nativeId));
  }
  return false;
 }catch{return false}
}
// Country label alone is not proof of Mainland China employment.
const excludedChineseRegions=/(香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macao|macau|taiwan|taipei|kaohsiung)/i;
const mainlandCities=/(北京|上海|天津|重庆|深圳|广州|杭州|南京|苏州|成都|武汉|西安|青岛|宁波|无锡|合肥|郑州|长沙|厦门|福州|济南|大连|沈阳|哈尔滨|长春|石家庄|昆明|贵阳|南宁|海口|珠海|佛山|东莞|烟台|潍坊|临沂|济宁|菏泽|聊城|威海|泰安|德州|枣庄|滨州|日照|东营|beijing|shanghai|tianjin|chongqing|shenzhen|guangzhou|hangzhou|nanjing|suzhou|chengdu|wuhan|xian|qingdao|ningbo|wuxi|hefei|zhengzhou|changsha|xiamen|fuzhou|jinan|dalian|shenyang|harbin|changchun|shijiazhuang|kunming|guiyang|nanning|haikou|zhuhai|foshan|dongguan)/i;
export function isVerifiedMainlandLocation(job,fact){
 if(!job||!fact||String(fact.countryCode||'').toUpperCase()!=='CN')return false;
 const location=String(job.location||'');
 return !excludedChineseRegions.test(location)&&mainlandCities.test(location);
}
export function countVerifiedMainlandJobs(snapshot,audit,facets){
 if(!Array.isArray(snapshot?.jobs)||!Array.isArray(audit?.jobs)||!Array.isArray(facets?.jobs))return 0;
 const proofs=new Map(audit.jobs.filter(x=>x?.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'&&
  x.full_original_jd_verified===true&&x.requirements_evidence===true&&typeof x.jd_sha256==='string').map(x=>[x.job_id,x]));
 const facts=new Map(facets.jobs.filter(x=>x?.id).map(x=>[x.id,x]));
 return snapshot.jobs.filter(j=>{
  const p=proofs.get(j.id),f=facts.get(j.id);
  return p&&p.platform===j.platform&&f&&f.original_source_hash===p.jd_sha256&&
   isVerifiedMainlandLocation(j,f)&&safeJobLink(j);
 }).length;
}

const aliases=[
 ['销售','sales','account executive','business development','商务','客户经理'],
 ['设计','designer','design','ux','ui','视觉','平面','艺术'],
 ['软件','software','developer','engineer','工程师','开发'],
 ['产品','product','产品经理','产品运营'],
 ['数据','data','analytics','analyst','分析'],
 ['运营','operations','operation','市场','marketing','growth'],
 ['金融','finance','financial','bank','财务'],
 ['人力','human resources','recruiting','talent','招聘'],
 ['教育','education','training','teacher','教学']
];
function aliasesOf(t){
 const words=[t.toLowerCase().trim()];
 for(const group of aliases){
  if(group.some(x=>words[0].includes(x.toLowerCase())))words.push(...group.map(x=>x.toLowerCase()));
 }
 return words.filter(Boolean);
}
export function selectAuditedMatches(snapshot,audit,facets,profile,opts={},now=Date.now()){
 if(!snapshot||!Array.isArray(snapshot.jobs)||!Number.isFinite(Date.parse(snapshot.updated))||
    !audit||audit.summary?.indexed_as_of!==snapshot.updated||
    !Array.isArray(audit.jobs)||audit.jobs.length!==snapshot.jobs.length||
    facets?.indexed_as_of!==snapshot.updated||!Array.isArray(facets?.jobs)||
    audit.summary?.kind!=='HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1')
   throw Error('OFFICIAL_JOB_INDEX_UNAVAILABLE');
 for(const t of [snapshot.updated,audit.summary.checked_at,facets.verified_at]){
  const age=now-Date.parse(t||'');
  if(!Number.isFinite(age)||age< -300000||age>24*3600000)throw Error('OFFICIAL_JOB_INDEX_UNAVAILABLE');
 }
 const verified=new Map(audit.jobs.filter(x=>x?.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'&&
  x.full_original_jd_verified===true&&x.requirements_evidence===true&&typeof x.jd_sha256==='string')
  .map(x=>[x.job_id,x]));
 const facts=new Map(facets.jobs.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 const candidatePool=Number.isInteger(opts.candidate_pool_limit)&&
  opts.candidate_pool_limit>=10&&opts.candidate_pool_limit<=1200;
 const query=[String(opts.role_hint||'').slice(0,80),...profile.target_roles].filter(Boolean);
 const skillList=profile.skills.map(s=>s.name.toLowerCase());
 const filtered=[];
 for(const j of snapshot.jobs){
  const proof=verified.get(j.id),f=facts.get(j.id);
  if(!proof||proof.platform!==j.platform||!f||f.original_source_hash!==proof.jd_sha256||
     !safeJobLink(j)||!isVerifiedMainlandLocation(j,f))continue;
  // Work-location and eligibility gates must run BEFORE relevance scoring.
  // Facet values are sourced from the same hash-verified official JD snapshot.
  if(opts.remote_only&&j.remote!==true)continue;
  if(Number.isFinite(f.experienceMinYears)&&f.experienceMinYears>0&&
     (!Number.isFinite(profile.experience_years)||profile.experience_years<f.experienceMinYears))continue;
  const degreeLevels={HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5};
  const minDegree=degreeLevels[String(f.education||'').toUpperCase()];
  if(minDegree&&(!degreeLevels[profile.education]||degreeLevels[profile.education]<minDegree))continue;
  const title=j.title.toLowerCase();
  const tags=Array.isArray(f.skills)?f.skills.filter(x=>typeof x==='string').map(x=>x.toLowerCase()):[];
  const roleMatches=query.flatMap(x=>aliasesOf(x)).filter(x=>x.length>=2&&title.includes(x));
  const skillMatches=skillList.filter(s=>tags.includes(s)||title.includes(s));
  // V2 pool must not be prematurely filtered by legacy keyword aliases.
  if(!candidatePool&&roleMatches.length===0&&skillMatches.length===0)continue;
  const matched=[],notEvidenced=[],needs=[];
  if(roleMatches.length)matched.push('岗位名称与目标方向存在文字关联，具体职责仍需核对');
  for(const item of skillMatches.slice(0,4))matched.push('简历有原文依据的技能：'+item);
  for(const req of tags.filter(s=>!skillList.includes(s)).slice(0,4))
   notEvidenced.push('公开职位要求提到 '+req+'，简历没有对应的可核验证据');
  if(f.education&&f.education!=='UNRESTRICTED')
   needs.push('岗位学历要求为公开文字保守提取，需核实是否符合：'+f.education);
  if(Number.isFinite(f.experienceMinYears))
   needs.push('岗位经验年限线索：'+f.experienceMinYears+' 年，仍以官网原文为准');
  needs.push('中国大陆岗位来自官方 ATS 审核快照；是否仍接受申请需到官网确认');
  const score=Math.min(85,35+Math.min(30,roleMatches.length*6)+Math.min(20,skillMatches.length*5));
  filtered.push({id:j.id,company:j.company,title:j.title,title_zh:null,location:j.location||'',
   official_url:j.url,platform:j.platform,source:j.source||'',remote:j.remote===true,
   reference_score:score,matched,not_evidenced:notEvidenced,needs_verification:needs,
   requirements_basis:'与同版官方 JD 审核和搜索特征一致；未对录用概率作预测',
   source_type:'HHBA站内岗位',
   // Same-JD-hash verified facets only. The ranking module never invents gates.
   // Legacy ATS facets list skills but do NOT mark them must-have.
   // Absence from resume is not proof that a mandatory JD gate failed.
   required_skills:[],preferred_skills:[],unclassified_skills:tags,
   min_experience_years:Number.isFinite(f.experienceMinYears)?f.experienceMinYears:null,
   minimum_education:typeof f.education==='string'?f.education:null,
   salary:typeof j.salary==='string'&&j.salary.length<=60?j.salary:
    typeof f.salary==='string'&&f.salary.length<=60?f.salary:null,
   experience_requirement:Number.isFinite(f.experienceMinYears)&&f.experienceMinYears>=0?
    (f.experienceMinYears===0?'经验不限':f.experienceMinYears+'年以上'):'经验未注明',
   rankEvidence:roleMatches.length+skillMatches.length});
 }
 if(candidatePool){
  // All verified jobs pass the V2 semantic gate before any Top-N cutoff.
  // This removes legacy keyword ranking and company/city dedup bias.
  const eligible=filtered.map(job=>{
   const fit=scoreCandidateFit(profile,job,opts);
   if(!fit.eligible)return null;
   const matched=[...job.matched];
   if(fit.breakdown.role>0&&!matched.some(x=>x.includes('岗位名称')))
    matched.push('职位名称与目标岗位方向属于相关职业类别（详情仍以官方职位要求为准）');
   return {...job,reference_score:fit.score,rankEvidence:fit.score,matched};
  }).filter(Boolean);
  eligible.sort((a,b)=>b.reference_score-a.reference_score||a.id.localeCompare(b.id));
  return {matches:eligible.slice(0,opts.candidate_pool_limit).map(({rankEvidence,...job})=>job),
   matched_official_jobs:eligible.length};
 }
 filtered.sort((a,b)=>b.reference_score-a.reference_score||b.rankEvidence-a.rankEvidence||a.id.localeCompare(b.id));
 // A vacancy in multiple cities should not crowd out different companies or roles.
 // Identity is company + title, not URL; only the highest relevant variant survives.
 const unique=[],seenRoles=new Set();
 for(const item of filtered){
  const key=item.company.trim().toLowerCase()+'|'+item.title.trim().toLowerCase();
  if(seenRoles.has(key))continue;
  seenRoles.add(key);unique.push(item);
 }
 // The API still returns Top 10; internal server code may request a wider,
 // source-verified candidate pool for a fair cross-source V2 reranking.
 const limit=Math.min(10,Math.max(1,Number(opts.limit)||10)),selected=[],picked=new Set();
 const byCompany=new Map();
 const add=(item)=>{
  selected.push(item);picked.add(item.id);
  const company=item.company.trim().toLowerCase();
  byCompany.set(company,(byCompany.get(company)||0)+1);
 };
 // First pass prioritizes distinct employers; second pass fills remaining
 // positions with other verified roles if the search has a small employer pool.
 for(const item of unique){
  if(selected.length>=limit)break;
  if((byCompany.get(item.company.trim().toLowerCase())||0)>=2)continue;
  add(item);
 }
 if(selected.length<limit)for(const item of unique){
  if(selected.length>=limit)break;
  if(!picked.has(item.id))add(item);
 }
 return {matches:selected.map(({rankEvidence,...j})=>j),matched_official_jobs:unique.length};
}
