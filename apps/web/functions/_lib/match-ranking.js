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
import {extractSkillRequirements} from './job-skill-evidence.js';
import {isMainlandJobLocation} from './mainland-job-location.js';
export const RANKING_VERSION='HHBA_MATCH_RANKING_V2';
export const DEFAULT_RANKING_WEIGHTS=Object.freeze({
 role:30,skills:30,experience:20,education:10,location:10
});
const DIMENSIONS=Object.keys(DEFAULT_RANKING_WEIGHTS);
const DEGREE_RANK=Object.freeze({HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5});
// Match the *occupation* before matching labels such as "engineer" or "开发".
const OCCUPATIONS=[
 ['qa',/(?:测试开发|自动化测试|软件测试|测试工程师|质量保障|质量测试|sdet|quality assurance|qa engineer|test engineer)/i],
 ['devops',/(?:运维|平台运维|devops|site reliability|\bsre\b|系统管理员)/i],
 ['cybersecurity',/(?:安全工程师|网络安全|信息安全|security engineer|cyber security)/i],
 ['frontend',/(?:前端|front[\s-]?end|react开发|vue开发)/i],
 ['backend',/(?:后端|back[\s-]?end|python\s*(?:开发|工程师)|java\s*(?:开发|工程师)|golang\s*(?:开发|工程师)|服务端)/i],
 ['fullstack',/(?:全栈|full[\s-]?stack)/i],
 ['data-engineer',/(?:数据工程|数据开发|大数据开发|数据仓库|etl开发|data engineer|data developer)/i],
 ['data-scientist',/(?:数据科学|机器学习工程师|深度学习工程师|算法工程师|data scientist|machine learning engineer)/i],
 ['data-analyst',/(?:数据分析|商业分析|业务分析|business analyst|data analyst|business intelligence analyst|\bbi分析)/i],
 ['film-editing',/(?:影视剪辑|视频剪辑|视频编辑|剪辑师|后期制作|video editor|film editor|post.production)/i],
 ['film-directing',/(?:影视编导|影视导演|短视频编导|视频导演|电影导演|导演助理|film director|video director)/i],
 ['dance-education',/(?:舞蹈教师|舞蹈老师|舞蹈教学|dance teacher|dance instructor)/i],
 ['dance-performance',/(?:舞蹈演员|舞者|dancer|dance performer)/i],
 ['dance-choreography',/(?:舞蹈编导|舞蹈编排|编舞|choreograph)/i],
 ['mechanical',/(?:机械设计|机械工程师|机械研发|机械结构设计|mechanical engineer|mechanical design)/i],
 ['electrical',/(?:电气工程师|电气设计|电气自动化|电气工程|电气控制|electrical engineer)/i],
 ['automotive-engineering',/(?:汽车工程师|车辆工程师|整车研发|汽车研发|automotive engineer)/i],
 ['industrial-design',/(?:工业设计|工业设计师|industrial designer)/i],
 ['civil',/(?:土木工程|土建工程|建筑工程师|施工工程师|civil engineer|construction engineer)/i],
 ['architecture',/(?:建筑设计|建筑师|建筑规划|architectural designer|building architect)/i],
 ['supply-chain',/(?:供应链|采购专员|采购经理|采购管理|supply chain|procurement)/i],
 ['logistics',/(?:物流管理|物流专员|仓储运营|logistics|warehouse operations)/i],
 ['international-trade',/(?:外贸业务|外贸销售|国际贸易|进出口业务|export sales|international trade)/i],
 ['translation',/(?:翻译|笔译|口译|translator|interpreter)/i],
 ['legal',/(?:法务|法律顾问|律师|legal counsel|legal specialist|lawyer)/i],
 ['nursing',/(?:护士|护理师|护理专员|registered nurse|\bnurse\b)/i],
 ['clinical',/(?:医生|临床医学|临床医师|physician|clinical doctor)/i],
 ['medical-lab',/(?:医学检验|医学检测|检验技师|medical laboratory)/i],
 ['accounting',/(?:会计|出纳|账务|accountant|bookkeeper)/i],
 ['auditing',/(?:审计|auditor|audit associate)/i],
 ['marketing',/(?:市场营销|品牌营销|市场推广|数字营销|marketing specialist|marketing manager|brand marketing)/i],
 ['customer-support',/(?:客户服务|客服专员|客服经理|售后服务|售后支持|customer support|customer service)/i],
 ['administration',/(?:行政专员|行政助理|行政管理|办公室主任|office administrator)/i],
 ['food-science',/(?:食品研发|食品质量|食品工程|食品检测|food technologist)/i],
 ['chemical',/(?:化工工艺|化工工程师|化学工程师|材料工程师|chemical engineer|materials engineer)/i],
 ['product',/(?:产品经理|产品专员|product manager|product owner)/i],
 ['ux',/(?:交互设计|用户体验设计|ux designer|ui\/ux|product designer)/i],
 ['graphic-design',/(?:视觉设计|平面设计|品牌设计|graphic designer|visual designer)/i],
 ['operations',/(?:运营|内容策划|新媒体|growth operations|operations specialist)/i],
 ['sales',/(?:销售|客户经理|商务拓展|sales|business development|account executive)/i],
 ['finance',/(?:财务|会计|审计|金融分析|accountant|finance|audit)/i],
 ['hr',/(?:人力资源|人事|招聘专员|human resources|recruiter)/i],
 ['education',/(?:教师|教研|教育培训|teacher|tutor)/i],
 ['software',/(?:软件开发|研发工程师|软件工程师|程序员|开发工程师|software engineer|software developer|software development engineer)/i]
];
const TRANSFERABLE=new Map([
 ['backend|software',.88],['frontend|software',.86],
 ['backend|fullstack',.7],['frontend|fullstack',.7],
 ['data-analyst|data-scientist',.5],['data-engineer|data-scientist',.45],
 ['backend|data-engineer',.35],['data-engineer|software',.3],
 ['film-directing|film-editing',.42],['dance-choreography|dance-performance',.38],
 ['dance-choreography|dance-education',.32],['logistics|supply-chain',.4],
 ['marketing|operations',.35],['civil|architecture',.25],
 ['industrial-design|mechanical',.25]
]);
export function classifyOccupation(title){
 const value=typeof title==='string'?title.slice(0,140):'';
 return OCCUPATIONS.find(([,re])=>re.test(value))?.[0]||null;
}
export function classifySeniority(title){
 const name=String(title||'').toLowerCase();
 if(/(?:实习|intern(?:ship)?)/i.test(name))return 'intern';
 if(/(?:首席|总监|副总裁|director|vp\b|head of|chief)/i.test(name))return 'director';
 if(/(?:负责人|组长|主管|技术负责人|\blead\b|team leader)/i.test(name))return 'lead';
 if(/(?:高级|资深|专家|\bsenior\b|\bstaff\b|\bprincipal\b)/i.test(name))return 'senior';
 if(/(?:初级|助理|应届|校招|\bjunior\b|graduate|entry[\s-]?level)/i.test(name))return 'junior';
 return 'unspecified';
}
function levelFitness(title,years){
 const level=classifySeniority(title);
 if(years===null)return level==='unspecified'?1:.78;
 if(level==='intern')return years>=2?.35:.85;
 if(level==='junior')return years>=8?.5:years>=5?.72:1;
 if(level==='senior')return years<2?.55:years<4?.82:1;
 if(level==='lead')return years<3?.55:years<6?.75:1;
 if(level==='director')return years<5?.4:years<9?.7:1;
 return 1;
}
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\s\-_.()（）【】[\]]+/g,'').trim();
const int=v=>Number.isInteger(v)&&v>=0&&v<=50?v:null;
const tenuredYears=v=>Number.isFinite(v)&&v>=0&&v<=50?v:null;
export function inferOfficialSkills(requirements){
 const groups=extractSkillRequirements(requirements);
 return [...new Set([...groups.required,...groups.preferred,...groups.unclassified])].slice(0,20);
}

export function isMainlandWorkCity(location){return isMainlandJobLocation(location);}
function roleAffinity(title,roles){
 const t=norm(title),kind=classifyOccupation(title);
 if(!t||!roles.length)return 0;
 let best=0;
 for(const role of roles){
  const r=norm(role),wanted=classifyOccupation(role);
  if(r.length<2)continue;
  // Never let a shared "engineer / 开发 / Python" substring turn QA into
  // a backend-development match (or data analytics into software engineering).
  if(kind&&wanted&&kind!==wanted){
   const key=[kind,wanted].sort().join('|');
   best=Math.max(best,TRANSFERABLE.get(key)||0);
   continue;
  }
  if(t===r){best=Math.max(best,1);continue;}
  if((r.length>=4&&t.includes(r))||(t.length>=4&&r.includes(t))){
   best=Math.max(best,.92);continue;
  }
  if(kind&&wanted&&kind===wanted){best=Math.max(best,.85);continue;}
  // Unknown headings may have genuine shared title words. Avoid short
  // generic "开发 / 工程师 / 经理" substrings as a relevance signal.
  if(!kind&&!wanted&&r.length>=5&&t.includes(r))best=Math.max(best,.5);
 }
 return best;
}
function minDegree(value){
 if(typeof value!=='string'||!value.trim()||value==='UNRESTRICTED')return null;
 return Object.hasOwn(DEGREE_RANK,value)?value:null;
}
export function evaluateJobEligibility(profile={},job={}){
 if(!isMainlandWorkCity(job.location))return {eligible:false,reason:'NOT_MAINLAND_JOB'};
 const years=tenuredYears(profile.experience_years),minYears=int(job.min_experience_years);
 if(minYears!==null&&minYears>0&&(years===null||years<minYears))
  return {eligible:false,reason:'EXPERIENCE_NOT_MET'};
 const education=minDegree(job.minimum_education);
 if(education&&(!DEGREE_RANK[profile.education]||DEGREE_RANK[profile.education]<DEGREE_RANK[education]))
  return {eligible:false,reason:'DEGREE_NOT_MET'};
 // High-confidence mandatory skills from verified JD clauses are a gate.
 // An absent resume mention means unproven, not proof of incompetence.
 const mandatory=Array.isArray(job.mandatory_skills)?job.mandatory_skills:[];
 const proven=new Set((Array.isArray(profile.skills)?profile.skills:[])
  .map(s=>norm(typeof s==='string'?s:s?.name)).filter(Boolean));
 if(mandatory.some(s=>typeof s==='string'&&!proven.has(norm(s))))
  return {eligible:false,reason:'MANDATORY_SKILL_NOT_EVIDENCED'};
 return {eligible:true,reason:null};
}
// The fourth argument is SERVER-SUPPLIED after a human-approved experiment.
// Never forward browser options as a weight policy.
function approvedPolicy(policy){
 if(!policy||policy.status!=='APPROVED'||typeof policy.version!=='string'||
  !/^hhba-ranking-v[2-9][0-9-]{0,30}$/.test(policy.version))return null;
 const input=policy.weights;
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).length!==DIMENSIONS.length)return null;
 if(DIMENSIONS.some(k=>!Number.isInteger(input[k])||
  Math.abs(input[k]-DEFAULT_RANKING_WEIGHTS[k])>3))return null;
 if(DIMENSIONS.reduce((sum,k)=>sum+input[k],0)!==100)return null;
 return {weights:Object.fromEntries(DIMENSIONS.map(k=>[k,input[k]])),version:policy.version};
}
export function scoreCandidateFit(profile={},job={},options={},serverApprovedPolicy=null){
 const gate=evaluateJobEligibility(profile,job);
 if(!gate.eligible)return {eligible:false,reason:gate.reason,score:null,breakdown:null};
 const roles=[typeof options.role_hint==='string'?options.role_hint:'',
  ...(Array.isArray(profile.target_roles)?profile.target_roles:[])]
  .filter(x=>typeof x==='string'&&x.length>=2).slice(0,7);
 const affinity=roleAffinity(job.title,roles);
 const occupation=classifyOccupation(job.title);
 const desired=roles.map(classifyOccupation).filter(Boolean);
 // Explicitly different occupations are not rescued by a generic skill.
 if(occupation&&desired.length&&affinity===0)
  return {eligible:false,reason:'ROLE_DIRECTION_MISMATCH',score:null,breakdown:null};
 const cleanTags=values=>[...new Set((Array.isArray(values)?values:[])
  .filter(x=>typeof x==='string'&&x.length<60).map(norm).filter(Boolean))].slice(0,20);
 const wanted=cleanTags(job.required_skills);
 const preferred=cleanTags(job.preferred_skills).filter(x=>!wanted.includes(x));
 const unclassified=cleanTags(job.unclassified_skills)
  .filter(x=>!wanted.includes(x)&&!preferred.includes(x));
 const have=[...new Set((Array.isArray(profile.skills)?profile.skills:[])
  .map(x=>typeof x==='string'?x:x?.name)
  .filter(x=>typeof x==='string'&&x.length<=60).map(norm).filter(Boolean))];
 const hit=xs=>xs.filter(x=>have.includes(x)).length;
 const matchedSkills=wanted.filter(x=>have.includes(x));
 const matchedPreferred=hit(preferred),matchedUnknown=hit(unclassified);
 if(affinity===0&&matchedSkills.length+matchedPreferred+matchedUnknown===0)
  return {eligible:false,reason:'NO_MATCH_EVIDENCE',score:null,breakdown:null};
 const approved=approvedPolicy(serverApprovedPolicy);
 const weights=approved?.weights||DEFAULT_RANKING_WEIGHTS;
 const minYears=int(job.min_experience_years),years=tenuredYears(profile.experience_years);
 const levelFactor=levelFitness(job.title,years);
 const role=Math.round(weights.role*affinity*levelFactor);
 // Cross-source calibration: an ATS job with unclassified, same-JD-hash
 // skill labels should not lose ~19 points versus identical fully documented
 // requirements. Classification certainty belongs in evidence_quality, NOT
 // hidden source bonuses/penalties or a fabricated mandatory gate.
 // Explicit must-haves are still filtered by evaluateJobEligibility.
 const coreMax=preferred.length?Math.round(weights.skills*.8):weights.skills;
 const corePoints=wanted.length?
  Math.round(coreMax*matchedSkills.length/wanted.length):0;
 const preferredPoints=preferred.length?
  Math.round((weights.skills-coreMax)*matchedPreferred/preferred.length):0;
 const unclassifiedPoints=unclassified.length?
  Math.round(weights.skills*.84*matchedUnknown/unclassified.length):0;
 const skills=wanted.length?
  Math.min(weights.skills,corePoints+preferredPoints+
   (unclassified.length?Math.min(3,Math.round(unclassifiedPoints*.1)):0)):
  unclassified.length?Math.min(weights.skills,unclassifiedPoints+preferredPoints):
  preferred.length?Math.round(weights.skills*.30*matchedPreferred/preferred.length):
  Math.round(weights.skills*8/30);
 const skillEvidence=wanted.length?'CLASSIFIED_REQUIREMENTS':
  unclassified.length?'UNCLASSIFIED_JD_SKILLS':
  preferred.length?'PREFERRED_ONLY':'NOT_DISCLOSED';

 const experience=minYears===null||minYears===0?Math.round(weights.experience*11/20):
  Math.round(weights.experience*Math.min(1,(16+Math.max(0,years-minYears))/20));
 const degree=minDegree(job.minimum_education);
 const education=degree?weights.education:Math.round(weights.education*.6);
 const cityPref=(Array.isArray(options.preferred_cities)?options.preferred_cities:[])
  .filter(x=>typeof x==='string'&&x.length>=2&&x.length<40);
 const location=cityPref.length&&
  !cityPref.some(city=>norm(job.location).includes(norm(city)))?
  Math.round(weights.location*.6):weights.location;
 const breakdown={role,skills,experience,education,location};
 const rawScore=Object.values(breakdown).reduce((a,b)=>a+b,0);
 // Skill-only candidates with no occupation evidence may be exploratory,
 // but should never outrank a directly relevant role on generic tools alone.
 const score=affinity===0?Math.min(rawScore,55):rawScore;
 return {eligible:true,reason:null,score,breakdown,score_adjustment:score-rawScore,
  score_cap_applied:score<rawScore,
  role_affinity:affinity,seniority_alignment:levelFactor,
  skill_evidence_status:skillEvidence,
  evidence_quality:{
   skills:skillEvidence,
   experience:minYears===null?'NOT_DISCLOSED':'OFFICIAL_REQUIREMENT',
   education:degree===null?'NOT_DISCLOSED':'OFFICIAL_REQUIREMENT'
  },
  matched_required_skills:wanted.filter(s=>have.includes(s)),
  matched_preferred_skills:preferred.filter(s=>have.includes(s)),
  matched_unclassified_skills:unclassified.filter(s=>have.includes(s)),
  matched_skill_count:matchedSkills.length+matchedPreferred+matchedUnknown,
  required_skill_count:wanted.length,
  preferred_skill_count:preferred.length,matched_preferred_skill_count:matchedPreferred,
  unclassified_skill_count:unclassified.length,ranking_version:RANKING_VERSION,
  weight_policy_version:approved?.version||'baseline'};
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
