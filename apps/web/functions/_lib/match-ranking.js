/**
 * HHBA Match Ranking V2 — deterministic, inspectable, provider-independent.
 * Input jobs must already have authenticated official job provenance; this
 * module is NOT a search engine or a substitute for source verification.
 * Scoring is relevance (0–100 points), never an interview/hiring probability.
 *
 * Default weight contract:
 * role 30, skills 30, experience 20, education 10, location 10.
 * Feedback-based weights can only be proposed offline from aggregates;
 * the online scorer always uses the fixed, audited baseline for now.
 */
export const RANKING_VERSION='HHBA_MATCH_RANKING_V2';
export const DEFAULT_RANKING_WEIGHTS=Object.freeze({
 role:30,skills:30,experience:20,education:10,location:10
});
const DIMENSIONS=Object.keys(DEFAULT_RANKING_WEIGHTS);
const DEGREE_RANK=Object.freeze({HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5});
const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macau|macao|taiwan|taipei|kaohsiung|美国|日本|新加坡|国外|海外|united states|singapore|japan|tokyo|london|san[\s-]?francisco|new[\s-]?york|united kingdom|境外)/i;
const MAINLAND_CITY=/(?:北京|上海|天津|重庆|深圳|广州|杭州|南京|苏州|成都|武汉|西安|青岛|宁波|无锡|合肥|郑州|长沙|厦门|福州|济南|大连|沈阳|哈尔滨|长春|石家庄|昆明|贵阳|南宁|海口|珠海|佛山|东莞|烟台|潍坊|临沂|济宁|菏泽|聊城|威海|泰安|德州|枣庄|滨州|日照|东营|常州|南通|嘉兴|绍兴|金华|温州|台州|太原|徐州|扬州|保定|唐山|廊坊|兰州|西宁|银川|乌鲁木齐|呼和浩特|包头|柳州|桂林|洛阳|开封|南昌|九江|中山|惠州|beijing|shanghai|tianjin|chongqing|shenzhen|guangzhou|hangzhou|chengdu|nanjing|suzhou|wuhan|xian|qingdao|ningbo|jinan|wuxi|hefei|zhengzhou|changsha|xiamen)/i;
const ROLE_FAMILIES=[
 ['软件','软件开发','开发工程师','程序员','软件工程师','python开发','java开发','后端','前端','全栈','software developer','software engineer','backend','frontend','fullstack'],
 ['数据','数据分析','数据工程','数据科学','商业分析','business analyst','data analyst','data engineer','data scientist','business intelligence'],
 ['产品','产品经理','product manager','product owner'],
 ['设计','视觉','平面','交互','ui设计','ux设计','designer','graphic design','product design'],
 ['运营','新媒体','内容运营','用户运营','operations','marketing','growth'],
 ['销售','商务','客户经理','销售顾问','sales','account executive','business development'],
 ['财务','会计','审计','金融','accountant','finance','audit'],
 ['教育','教师','教研','teacher','education'],
 ['测试','质量保障','自动化测试','qa','sdet','test engineer'],
 ['招聘','人力','人事','hr','recruiting','human resources']
];
// Only explicit skill names in official JD text can contribute skill evidence.
const SKILLS=[
 'Python','SQL','JavaScript','TypeScript','React','Vue','Node.js','Java','C++','C#','Go',
 'Git','pandas','Excel','Power BI','Tableau','Linux','Docker','Kubernetes','AWS',
 '机器学习','深度学习','数据分析','用户研究','Figma','Photoshop','Illustrator','剪辑',
 '项目管理','沟通能力','财务分析','市场营销'
];
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\s\-_.()（）【】[\]]+/g,'').trim();
const int=v=>Number.isInteger(v)&&v>=0&&v<=50?v:null;
function skillPresent(text,skill){
 const s=String(text||'').normalize('NFKC');
 const label=String(skill||'');
 if(!label)return false;
 // Strict ASCII boundaries prevent Java matching JavaScript and Go matching Google.
 if(/^[A-Za-z][A-Za-z0-9 ]*$/.test(label))
  return new RegExp('(^|[^A-Za-z0-9])'+label.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+'(?=$|[^A-Za-z0-9])','i').test(s);
 return s.toLowerCase().includes(label.toLowerCase());
}
export function inferOfficialSkills(requirements){
 if(typeof requirements!=='string'||requirements.length<25)return [];
 return SKILLS.filter(s=>skillPresent(requirements.slice(0,2400),s)).slice(0,20);
}
export function isMainlandWorkCity(location){
 const city=typeof location==='string'?location.slice(0,120):'';
 return !!city&&!OUTSIDE.test(city)&&MAINLAND_CITY.test(city);
}
function roleAffinity(title,roles){
 const t=norm(title);
 if(!t||!roles.length)return 0;
 let best=0;
 for(const role of roles){
  const r=norm(role);
  if(r.length<2)continue;
  if(t===r)best=Math.max(best,1);
  else if((r.length>=4&&t.includes(r))||(t.length>=4&&r.includes(t)))best=Math.max(best,.92);
  else if(ROLE_FAMILIES.some(g=>g.some(alias=>r.includes(norm(alias)))&&g.some(alias=>t.includes(norm(alias)))))
   best=Math.max(best,.72);
 }
 return best;
}
function minDegree(value){
 if(typeof value!=='string'||!value.trim()||value==='UNRESTRICTED')return null;
 return Object.hasOwn(DEGREE_RANK,value)?value:null;
}
export function evaluateJobEligibility(profile={},job={}){
 if(!isMainlandWorkCity(job.location))return {eligible:false,reason:'NOT_MAINLAND_JOB'};
 const years=int(profile.experience_years),minYears=int(job.min_experience_years);
 if(minYears!==null&&minYears>0&&(years===null||years<minYears))
  return {eligible:false,reason:'EXPERIENCE_NOT_MET'};
 const education=minDegree(job.minimum_education);
 if(education&&(!DEGREE_RANK[profile.education]||DEGREE_RANK[profile.education]<DEGREE_RANK[education]))
  return {eligible:false,reason:'DEGREE_NOT_MET'};
 return {eligible:true,reason:null};
}
export function scoreCandidateFit(profile={},job={},options={}){
 const gate=evaluateJobEligibility(profile,job);
 if(!gate.eligible)return {eligible:false,reason:gate.reason,score:null,breakdown:null};
 const roles=[typeof options.role_hint==='string'?options.role_hint:'',
  ...(Array.isArray(profile.target_roles)?profile.target_roles:[])]
  .filter(x=>typeof x==='string'&&x.length>=2).slice(0,7);
 const affinity=roleAffinity(job.title,roles);
 const wanted=[...new Set((Array.isArray(job.required_skills)?job.required_skills:[])
  .filter(x=>typeof x==='string'&&x.length<60).map(x=>x.trim()).filter(Boolean).map(x=>norm(x)))].slice(0,20);
 const have=[...new Set((Array.isArray(profile.skills)?profile.skills:[])
  .map(x=>typeof x==='string'?x:x?.name).filter(x=>typeof x==='string'&&x.length<=60).map(x=>norm(x)).filter(Boolean))];
 const matchedSkills=wanted.filter(x=>have.includes(x));
 if(affinity===0&&matchedSkills.length===0)
  return {eligible:false,reason:'NO_MATCH_EVIDENCE',score:null,breakdown:null};
 const role=Math.round(DEFAULT_RANKING_WEIGHTS.role*affinity);
 // Missing official requirement tags are unknown, not proof of perfect coverage.
 const skills=wanted.length?
  Math.round(DEFAULT_RANKING_WEIGHTS.skills*matchedSkills.length/wanted.length):
  Math.min(8,DEFAULT_RANKING_WEIGHTS.skills);
 const minYears=int(job.min_experience_years),years=int(profile.experience_years);
 const experience=minYears===null||minYears===0?11:
  Math.min(DEFAULT_RANKING_WEIGHTS.experience,16+Math.max(0,years-minYears));
 const degree=minDegree(job.minimum_education);
 const education=degree?DEFAULT_RANKING_WEIGHTS.education:6;
 const cityPref=(Array.isArray(options.preferred_cities)?options.preferred_cities:[])
  .filter(x=>typeof x==='string'&&x.length>=2&&x.length<40);
 const location=cityPref.length&&
  !cityPref.some(city=>norm(job.location).includes(norm(city)))?6:DEFAULT_RANKING_WEIGHTS.location;
 const breakdown={role,skills,experience,education,location};
 const score=Object.values(breakdown).reduce((a,b)=>a+b,0);
 return {eligible:true,reason:null,score,breakdown,matched_skill_count:matchedSkills.length,
  required_skill_count:wanted.length,ranking_version:RANKING_VERSION};
}
/**
 * Future offline-learning hook: proposed weights from aggregate experiment
 * lifts, NOT from raw events, resumes, account IDs or individual tracking.
 * Not called on any live request. Human/quality review is mandatory; the
 * production scorer above always uses DEFAULT_RANKING_WEIGHTS.
 */
export function proposeFeedbackWeightUpdate(aggregate={}){
 const baseline={...DEFAULT_RANKING_WEIGHTS};
 if(!Number.isInteger(aggregate.distinct_users)||aggregate.distinct_users<200||
  !Number.isInteger(aggregate.verified_outcomes)||aggregate.verified_outcomes<500||
  !aggregate.comparative_lifts||typeof aggregate.comparative_lifts!=='object')
  return {status:'INSUFFICIENT_EVIDENCE',weights:baseline,requires_review:true};
 const lifts=aggregate.comparative_lifts;
 if(DIMENSIONS.some(d=>!Number.isFinite(lifts[d])||Math.abs(lifts[d])>.5))
  return {status:'INVALID_AGGREGATE',weights:baseline,requires_review:true};
 // Max 3-point shift per dimension, 100-point total. Controlled exploration;
 // popularity cannot override the eligibility gate.
 const provisional=DIMENSIONS.map(d=>({
  key:d,amount:Math.max(DEFAULT_RANKING_WEIGHTS[d]-3,
   Math.min(DEFAULT_RANKING_WEIGHTS[d]+3,DEFAULT_RANKING_WEIGHTS[d]+Math.round(lifts[d]*6)))
 }));
 let delta=100-provisional.reduce((n,x)=>n+x.amount,0);
 while(delta!==0){
  let moved=false;
  for(const row of provisional){
   const bound=DEFAULT_RANKING_WEIGHTS[row.key]+(delta>0?3:-3);
   if(delta>0&&row.amount<bound){row.amount++;delta--;moved=true;}
   else if(delta<0&&row.amount>bound){row.amount--;delta++;moved=true;}
   if(delta===0)break;
  }
  if(!moved)break;
 }
 return {status:'PROPOSAL_ONLY',weights:Object.fromEntries(provisional.map(x=>[x.key,x.amount])),
  requires_review:true,auto_activated:false};
}
