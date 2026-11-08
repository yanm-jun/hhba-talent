// HHBA candidate recommendation fusion V1.
// Only audited HHBA matches and independently fetched official job details may
// be ranked. No model-generated employer/job facts or acceptance probabilities.
import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {scoreCandidateFit} from './match-ranking.js';
import {extractSkillRequirements} from './job-skill-evidence.js';

export const FUSION_VERSION='HHBA_DOMESTIC_MATCH_FUSION_V1';
const MAX_RESULTS=10;
const MAX_EVIDENCE_AGE_MS=24*60*60*1000;
const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macau|macao|taiwan|taipei|日本|美国|新加坡|singapore|united states|tokyo)/i;
const MAINLAND_CITY=/(?:北京|上海|天津|重庆|深圳|广州|杭州|南京|苏州|成都|武汉|西安|青岛|宁波|无锡|合肥|郑州|长沙|厦门|福州|济南|大连|沈阳|哈尔滨|长春|石家庄|昆明|贵阳|南宁|海口|珠海|佛山|东莞|烟台|潍坊|临沂|济宁|菏泽|聊城|威海|泰安|德州|枣庄|滨州|日照|东营|常州|南通|嘉兴|绍兴|金华|温州|台州|太原|徐州|扬州|保定|唐山|廊坊|兰州|西宁|银川|乌鲁木齐|呼和浩特|包头|柳州|桂林|洛阳|开封|南昌|九江|中山|惠州|beijing|shanghai|shenzhen|guangzhou|hangzhou|chengdu|nanjing|suzhou|wuhan|xian)/i;
const DEGREE_RANK={HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5};
const ROLE_CLUSTERS=[
 ['软件','开发','工程师','software','developer','engineer','backend','后端','python','java','golang','前端','frontend'],
 ['数据','分析','data','analytics','analyst','sql','bi','数据工程'],
 ['设计','视觉','ui','ux','designer','design','平面','交互'],
 ['产品','product','pm','产品经理'],
 ['销售','sales','商务','bd','市场拓展','account executive'],
 ['运营','operations','operation','内容运营','营销','marketing','growth'],
 ['财务','金融','finance','financial','财务分析'],
 ['人力','招聘','hr','human resources','recruiting']
];
const flat=(s)=>String(s||'').trim().toLowerCase().replace(/[\s\-_.()（）【】[\]]+/g,'');
function textSafe(value,max=260){
 return typeof value==='string'?value.slice(0,max):'';
}
export function isMainlandWorkCity(value){
 const city=textSafe(value,100);
 return !!city&&!OUTSIDE.test(city)&&MAINLAND_CITY.test(city);
}
function canonicalRoleKey(job){
 const city=textSafe(job.location,50);
 let title=flat(job.title);
 if(city)title=title.replace(flat(city),'');
 return flat(job.company)+'|'+title;
}
function compatibleRole(title,targets){
 const name=flat(title);
 let best=0;
 for(const role of targets){
  const target=flat(role);
  if(target.length<2)continue;
  if(name.includes(target)||target.includes(name)&&name.length>=4){best=Math.max(best,30);continue;}
  let shared=0;
  for(const aliases of ROLE_CLUSTERS){
   if(aliases.some(x=>target.includes(flat(x)))&&aliases.some(x=>name.includes(flat(x)))){
    shared=Math.max(shared,aliases.some(x=>flat(x).length>=3&&target.includes(flat(x))&&name.includes(flat(x)))?24:18);
   }
  }
  best=Math.max(best,shared);
 }
 return best;
}
function degreeMinRequirement(text){
 const s=textSafe(text,1200);
 if(/(?:博士|phd)(?:学历|学位|研究生)?(?:及以上|以上|或以上|至少)/i.test(s))return 5;
 if(/(?:硕士|master)(?:学历|学位|研究生)?(?:及以上|以上|或以上|至少)/i.test(s))return 4;
 if(/(?:本科|学士|bachelor)(?:学历|学位)?(?:及以上|以上|或以上|至少)/i.test(s))return 3;
 if(/(?:大专|专科)(?:学历|学位)?(?:及以上|以上|或以上|至少)/i.test(s))return 2;
 return null;
}
function experienceMinRequirement(text){
 const s=textSafe(text,1200);
 // Explicit requirements only. Match variants such as 7年以上工作经验,
 // 至少7年、7-10年工作经验 and 7+ years experience.
 const matches=[
  // E.g. "5年以上工业行业销售经验" / "1年以上数据产品相关经验".
  ...s.matchAll(/(\d{1,2})\s*年(?:以上|及以上|或以上|起)\s*[^。；;\n]{0,32}?(?:经验|经历)/g),
  ...s.matchAll(/(?:至少|不少于|最低(?:要求)?|须有|要求)?\s*(\d{1,2})\s*(?:[-~至]\s*\d{1,2})?\s*年\s*(?:以上|及以上|或以上|起)?\s*(?:(?:相关|实际|全职|工作|行业|项目|岗位|开发|管理|软件|数据)\s*){0,3}(?:经验|经历)/g),
  ...s.matchAll(/(?:工作|相关|从业|行业|项目|开发)\s*(?:经验|年限)?[：:\s]*(?:至少|不少于|最低(?:要求)?)?[：:\s]*(\d{1,2})\s*年(?:以上|及以上)?/g),
  ...s.matchAll(/(\d{1,2})\s*\+?\s*years?\s*(?:of\s*)?(?:work|professional|relevant|industry)?\s*experience/gi)
 ].map(m=>Number(m[1])).filter(n=>n>=1&&n<=40);
 return matches.length?Math.max(...matches):null;
}
function referencedExternal(entry,now){
 if(!entry||entry.source_type!=='站外官方招聘'||
   entry.source_status!=='OFFICIAL_DETAIL_FETCHED'||
   entry.application_status!=='NEEDS_OFFICIAL_CONFIRMATION')return null;
 const baiduLogin=entry.company==='百度'&&entry.official_domain==='talent.baidu.com'&&
  entry.application_method==='OFFICIAL_DETAIL_LOGIN_REQUIRED'&&entry.has_application_cta===false;
 if(entry.has_application_cta!==true&&!baiduLogin)return null;
 const u=safeOfficialJobLocator(entry.official_url);
 if(!u||u.company!==entry.company||u.id!==entry.id)return null;
 if(!isMainlandWorkCity(entry.location))return null;
 if(!entry.evidence||entry.evidence.location!==entry.location||
  typeof entry.evidence.title!=='string'||entry.evidence.title.trim()!==entry.title.trim()||
  typeof entry.evidence.requirement!=='string'||entry.evidence.requirement.trim().length<25)return null;
 const timestamp=Date.parse(entry.checked_at||'');
 if(!Number.isFinite(timestamp)||timestamp>now+5*60*1000||now-timestamp>MAX_EVIDENCE_AGE_MS)return null;
 return {official_url:u.url,ageHours:Math.max(0,(now-timestamp)/3600000)};
}
function safeProfile(profile){
 return {
  skills:(Array.isArray(profile?.skills)?profile.skills:[]).slice(0,12)
   .map(x=>textSafe(x?.name,48)).filter(x=>x.length>=2),
  target_roles:(Array.isArray(profile?.target_roles)?profile.target_roles:[]).slice(0,6)
   .map(x=>textSafe(x,70)).filter(x=>x.length>=2),
  education:DEGREE_RANK[profile?.education]?profile.education:null,
  experience_years:Number.isFinite(profile?.experience_years)&&profile.experience_years>=0&&
   profile.experience_years<=50?profile.experience_years:null
 };
}
function externalToMatch(entry,profile,options,now){
 const proof=referencedExternal(entry,now);
 if(!proof)return null;
 const requirements=entry.evidence.requirement;
 const degree=degreeMinRequirement(requirements);
 const experience=experienceMinRequirement(requirements);
 if(degree!==null&&(!profile.education||DEGREE_RANK[profile.education]<degree))return null;
 if(experience!==null&&(profile.experience_years===null||profile.experience_years<experience))return null;
 const targets=[textSafe(options?.role_hint,80),...profile.target_roles].filter(Boolean);
 const rolePoints=compatibleRole(entry.title,targets);
 const haveSkill=profile.skills.filter(x=>flat(requirements).includes(flat(x))||
  flat(entry.title).includes(flat(x)));
 if(rolePoints===0&&haveSkill.length===0)return null;
 // Relevance score is a conservative ranking reference, NEVER chance of hire.
 const skillPoints=Math.min(25,haveSkill.length*8);
 const requirementPoints=degree===null?10:profile.education?15:7;
 const experiencePoints=experience===null?6:profile.experience_years===null?3:10;
 const score=Math.min(90,15+rolePoints+skillPoints+requirementPoints+experiencePoints+8+5);
 const matched=[];
 if(rolePoints)matched.push('岗位名称与目标职业方向相关（以官网岗位职责为准）');
 for(const skill of haveSkill.slice(0,4))matched.push('简历已识别技能与官方任职要求相关：'+skill);
 const gaps=[];
 if(degree!==null&&profile.education===null)gaps.push('岗位存在学历门槛，但简历没有可确认的学历证据');
 if(experience!==null&&profile.experience_years===null)gaps.push('岗位存在经验年限要求，简历尚未证明');
 return {
  id:'external-'+entry.id.replace(/[^a-zA-Z0-9_-]/g,'-'),company:entry.company,title:entry.title,
  title_zh:entry.title,location:entry.location,official_url:proof.official_url,
  platform:'official-domestic',source:entry.official_domain,remote:false,
  source_type:'站外官方招聘',reference_score:score,
  ...(()=>{const skills=extractSkillRequirements(requirements);return {
   required_skills:skills.required,preferred_skills:skills.preferred,
   unclassified_skills:skills.unclassified};})(),
  min_experience_years:experience,
  minimum_education:Object.keys(DEGREE_RANK).find(k=>DEGREE_RANK[k]===degree)||null,
  salary:typeof entry.evidence.salary==='string'&&entry.evidence.salary.length<=60?entry.evidence.salary:null,
  experience_requirement:experience===null?'经验未注明':experience+'年以上',
  matched,not_evidenced:gaps,
  needs_verification:[
   entry.application_method==='OFFICIAL_DETAIL_LOGIN_REQUIRED'?
    '企业官方招聘详情可打开，但该网页未展示直接申请按钮；可能需要先登录，是否可投递尚待官网确认':
    '企业官网详情与任职要求已抓取；网页出现申请入口，但当前是否仍接受申请必须到官网确认',
   '抓取时间：'+entry.checked_at+'；公开岗位信息可能变化'
  ],
  requirements_basis:'站外企业官方详情页面原文，非 AI 猜测职位；没有确认实时开放',
  application_status:'NEEDS_OFFICIAL_CONFIRMATION',checked_at:entry.checked_at,
  candidate_evidence:{role:entry.evidence.title,requirement:requirements.slice(0,260)},
  rankEvidence:rolePoints+haveSkill.length*8,
  sourceDate:proof.ageHours
 };
}
function internalToMatch(entry){
 if(!entry||entry.source_type!=='HHBA站内岗位'||!isMainlandWorkCity(entry.location))return null;
 if(typeof entry.official_url!=='string'||!entry.official_url.startsWith('https://'))return null;
 if(!Number.isFinite(entry.reference_score)||entry.reference_score<0||entry.reference_score>100)return null;
 return {...entry,rankEvidence:Math.max(0,Math.round(entry.reference_score)),sourceDate:0};
}
export function fuseDomesticJobRecommendations(inside=[],outside=[],rawProfile={},options={},now=Date.now()){
 const when=now instanceof Date?now.getTime():Number(now);
 if(!Number.isFinite(when))throw Error('MATCH_FUSION_INVALID_TIME');
 const profile=safeProfile(rawProfile);
 const internal=(Array.isArray(inside)?inside:[]).slice(0,1200)
  .map(internalToMatch).filter(Boolean);
 const external=(Array.isArray(outside)?outside:[]).slice(0,25)
  .map(j=>externalToMatch(j,profile,options,when)).filter(Boolean);
 // Source-neutral V2 score applies ONLY after the official-source checks above.
 // Hard experience, education and China Mainland location gates take priority.
 const scored=[...internal,...external].map(job=>{
  const fit=scoreCandidateFit(profile,job,options);
  if(!fit.eligible)return null;
  return {...job,reference_score:fit.score,score_breakdown:fit.breakdown,
   ranking_version:fit.ranking_version,rankEvidence:fit.score};
 }).filter(Boolean);
 const ranked=scored.sort((a,b)=>b.reference_score-a.reference_score||
  b.rankEvidence-a.rankEvidence||a.id.localeCompare(b.id));
 const unique=[],uniqueKeys=new Set();
 for(const job of ranked){
  const k=canonicalRoleKey(job);
  if(uniqueKeys.has(k))continue;
  uniqueKeys.add(k);unique.push(job);
 }
 const max=Math.max(1,Math.min(MAX_RESULTS,Number(options?.limit)||MAX_RESULTS));
 const chosen=[],chosenIds=new Set(),companyCounts=new Map();
 function add(job){
  chosen.push(job);chosenIds.add(job.id);
  const c=flat(job.company);companyCounts.set(c,(companyCounts.get(c)||0)+1);
 }
 // Up to two roles per employer, then relax if otherwise the user gets fewer
 // suitable options. Always prioritize a genuinely better match over source.
 for(const job of unique){
  if(chosen.length>=max)break;
  if((companyCounts.get(flat(job.company))||0)>=2)continue;
  add(job);
 }
 if(chosen.length<max)for(const job of unique){
  if(chosen.length>=max)break;
  if(!chosenIds.has(job.id))add(job);
 }
 return {
  kind:FUSION_VERSION,scope:'CN_MAINLAND_ONLY',
  matches:chosen.map(({rankEvidence,sourceDate,...j})=>j),
  counts:{
   internal_eligible:internal.length,external_reviewed:Array.isArray(outside)?outside.length:0,
   external_eligible:external.length,distinct_verified_sources:unique.length,
   selected_internal:chosen.filter(x=>x.source_type==='HHBA站内岗位').length,
   selected_external:chosen.filter(x=>x.source_type==='站外官方招聘').length
  },
  disclaimer:'仅基于官方招聘源和简历证据的相关性参考，非录用概率；站外岗位开放状态需到企业官网确认。'
 };
}
