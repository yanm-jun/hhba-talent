/**
 * HHBA V1 Stage 1: classification drafts and conservative identity candidates.
 * PURE FUNCTIONS ONLY: no database, no DeepSeek call, no credentials, no resume bytes.
 *
 * A model/search result can suggest a company or a tag, but ONLY a separate,
 * evidence-backed review pipeline may mark a recruitment source as trusted.
 */
import {classifyOccupation} from './match-ranking.js';
import {recruitmentSourceKind} from './match-employer-source.js';

export const DUAL_CLASSIFICATION_VERSION='HHBA_DUAL_CLASSIFICATION_V1_STAGE1';
const short=(x,max=1500)=>typeof x==='string'?x.normalize('NFKC').trim().slice(0,max):'';
const unique=a=>[...new Set(a.filter(Boolean))];
const listed=(v,max=10)=>Array.isArray(v)?v.slice(0,max):[];
const domainPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const nameKey=n=>short(n,160).toLowerCase().replace(/[\s·・（）()\[\]【】,，.。\-_—–]+/g,'');

const INDUSTRIES=[
 ['semiconductors',/(?:半导体|集成电路|芯片|晶圆|存储器|功率器件|pmic|mcu)/i],
 ['automotive',/(?:汽车|新能源车|智能驾驶|车载|整车|车规|自动驾驶)/i],
 ['software-internet',/(?:软件|互联网|云计算|saas|信息技术|数字平台|人工智能|ai平台)/i],
 ['finance',/(?:金融|银行|证券|保险|支付清算|财富管理)/i],
 ['healthcare',/(?:医疗|医药|生物医药|医疗器械|制药)/i],
 ['industrial-manufacturing',/(?:制造|机械设备|工业自动化|智能制造|数控|工业机器人)/i],
 ['energy',/(?:能源|电力|光伏|储能|风电|氢能|发电)/i],
 ['education',/(?:教育|教学|培训|教育科技)/i],
 ['media-content',/(?:传媒|影视|视频制作|媒体|广告创意|内容制作)/i],
 ['logistics',/(?:物流|快递|供应链|货运|仓储)/i],
 ['consumer-retail',/(?:消费品|零售|电商|连锁商业|食品饮料)/i],
 ['games',/(?:游戏研发|电子游戏|手游|网络游戏)/i]
];
const BUSINESSES=[
 ['ai-data',/(?:人工智能|机器学习|数据分析|数据科学|大模型|算法平台|智能分析)/i],
 ['hardware-rd',/(?:芯片设计|硬件研发|电路设计|嵌入式|电源管理|传感器)/i],
 ['automotive-electronics',/(?:汽车电子|车规|智能座舱|车载|辅助驾驶)/i],
 ['enterprise-services',/(?:企业服务|to\s?b|b2b|saas|企业软件)/i],
 ['industrial-control',/(?:工业控制|工业自动化|马达驱动|工业机器人)/i],
 ['consumer-products',/(?:消费电子|消费产品|零售|电商|智能手机)/i],
 ['digital-marketing',/(?:数字营销|广告投放|品牌传播|内容运营)/i],
 ['research',/(?:技术研究|研发中心|科学研究|实验室|研究院)/i],
 ['financial-services',/(?:金融服务|信贷|投资管理|保险服务|支付结算)/i],
 ['education-services',/(?:教育服务|课程研发|教学服务|在线教育)/i]
];
function classify(text,rules){
 return rules.filter(([,re])=>re.test(text)).map(([tag])=>tag);
}
function businessText(data){
 return listed(data?.business,16).map(x=>{
  if(typeof x==='string')return short(x,250);
  return [x?.title,x?.description,x?.tags,...listed(x?.details,8)].map(v=>short(v,250)).join(' ');
 }).join(' ').slice(0,6000);
}

/** Takes public employer editorial data only. Its output is NOT a verified company. */
export function classifyEmployerDraft(data={}){
 const industry=short(data?.industry,1200),overview=short(data?.overview,1800);
 const detail=businessText(data);
 const base=[industry,overview,detail].join(' ');
 const industryTags=classify(base,INDUSTRIES);
 const businessTags=classify(base,BUSINESSES);
 return {
  taxonomy_version:DUAL_CLASSIFICATION_VERSION,
  industry_tags:industryTags,
  business_tags:businessTags,
  review_status:'PROPOSED',
  evidence_fields:[
   ...(industry?['industry']:[]),
   ...(overview?['overview']:[]),
   ...(detail?['business']:[])
  ],
  // Empty tags mean a review is needed, not that the company has no industries.
  needs_human_review:true
 };
}

/** URL shape screening is not ownership proof, ATS tenant authorization or open-job proof. */
export function recruitmentSourceCandidate(raw){
 let url;
 try{url=new URL(raw);}catch{return {status:'REJECTED',reason:'INVALID_URL'};}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||
   !domainPattern.test(url.hostname)||url.hostname.endsWith('.local'))
  return {status:'REJECTED',reason:'UNSAFE_URL'};
 const type=recruitmentSourceKind(url.href);
 if(type==='THIRD_PARTY_BOARD')return {status:'REJECTED',reason:'THIRD_PARTY_BOARD'};
 // Keep case-sensitive ATS job IDs and query parameters intact; strip only common tracking.
 const tracking=new Set(['from','source','ref','spm','fbclid','gclid']);
 for(const key of [...url.searchParams.keys()]){
  if(key.toLowerCase().startsWith('utm_')||tracking.has(key.toLowerCase()))url.searchParams.delete(key);
 }
 return {status:'REVIEW_REQUIRED',reason:'OWNERSHIP_AND_JOB_STATUS_NOT_VERIFIED',
  source_kind:type,hostname:url.hostname,canonical_url:url.href};
}

/**
 * Exact reviewed identity keys are distinct from a brand name/parent group.
 * Even a strong match is REVIEW_REQUIRED. No automatic merging by substring.
 */
export function compareEmployerIdentity(candidate={},existing={}){
 const candidateId=short(candidate?.id,180),existingId=short(existing?.id,180);
 if(candidateId&&candidateId===existingId)return {result:'SAME_RECORD',auto_merge:false};
 const legalA=nameKey(candidate?.legalName),legalB=nameKey(existing?.legalName);
 const domainA=short(candidate?.reviewedOfficialHost,253).toLowerCase();
 const domainB=short(existing?.reviewedOfficialHost,253).toLowerCase();
 if(legalA&&legalB&&legalA===legalB&&domainA&&domainA===domainB&&domainPattern.test(domainA))
  return {result:'POSSIBLE_SAME_LEGAL_ENTITY',auto_merge:false};
 const aliasesA=unique([candidate?.name,...listed(candidate?.aliases,10)].map(nameKey));
 const aliasesB=unique([existing?.name,...listed(existing?.aliases,10)].map(nameKey));
 if(aliasesA.some(x=>x&&aliasesB.includes(x)))
  return {result:'NAME_COLLISION_REVIEW',auto_merge:false};
 return {result:'NO_EXACT_IDENTITY_EVIDENCE',auto_merge:false};
}

/**
 * Consume only an already validated profile (verifiedProfile / later V6-V7).
 * No raw resume, contact info, phone, user ID, or model response is persisted.
 * Stated interests are NOT represented as demonstrated skills/experience.
 */
export function classifyValidatedTalentProfile(profile={}){
 const intents=unique(listed(profile?.career_intents,6).concat(listed(profile?.target_roles,6))
  .filter(x=>typeof x==='string').map(x=>short(x,90)));
 const experience=listed(profile?.experiences,12).map(x=>short(x?.role,90)).filter(Boolean);
 const demonstrated=unique(listed(profile?.demonstrated_roles,12)
  .concat(experience).filter(x=>typeof x==='string').map(x=>short(x,90)));
 const skills=unique(listed(profile?.skills,30).map(x=>
  typeof x==='string'?short(x,60):short(x?.name,60)));
 const intentTags=unique(intents.map(classifyOccupation));
 const demonstratedTags=unique(demonstrated.map(classifyOccupation));
 const skillTopics=unique(skills.flatMap(x=>[
  /(?:python|java|go|javascript|typescript|react|vue|前端|后端|开发)/i.test(x)?'software':null,
  /(?:sql|数据分析|pandas|excel|power\s?bi|tableau)/i.test(x)?'data':null,
  /(?:figma|ps|photoshop|视觉|设计|剪辑|pr|premiere)/i.test(x)?'creative':null,
  /(?:销售|营销|客户管理|运营|crm)/i.test(x)?'business':null
 ]));
 return {
  taxonomy_version:DUAL_CLASSIFICATION_VERSION,
  career_intent_tags:intentTags,
  demonstrated_role_tags:demonstratedTags,
  skill_topic_tags:skillTopics,
  // Major must be extracted with supporting resume text or confirmed by user.
  major_status:'REQUIRES_EVIDENCE_OR_USER_CONFIRMATION',
  profile_status:'CLASSIFICATION_DRAFT',
  missing_information:unique([
   ...(profile?.education?[]:['education']),
   ...(profile?.major_evidence_verified===true?[]:['major'])
  ])
 };
}
