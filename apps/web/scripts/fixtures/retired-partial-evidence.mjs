// Historical partial-evidence fixtures; no model or search calls.
import {isMainlandEmployerJobUrl} from '../../functions/_lib/match-employer-source.js';
import {normalizeMatchScore,sortByMatchScore} from '../../functions/_lib/match-job-quality.js';

export const DOMESTIC_EVIDENCE_PIPELINE='HHBA_MAINLAND_EVIDENCE_RESEARCH_V1';
const clean=(v,max=800)=>String(v||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const compact=v=>clean(v,1600).normalize('NFKC').toLowerCase().replace(/[\s,，.。:：\-()（）/\\]+/g,'');
const hasDuty=/(?:岗位职责|工作职责|工作内容|职位描述|主要职责|工作任务|负责|职责包括)/;
const hasRequirements=/(?:任职要求|任职资格|岗位要求|职位要求|资格要求|应聘条件|学历要求|工作经验|经验要求|必备技能|招聘要求)/;
const banned=/(\.|^)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workdayjobs\.com)$/i;

function researchQuery(job){
 const sanitize=x=>clean(x,65).replace(/[<>"'{}|\\]/g,' ').replace(/https?:\/\/\S+/gi,'').trim();
 return [sanitize(job.company),sanitize(job.title_zh||job.title),sanitize(job.location),
  '中国大陆 企业官网 官方招聘 岗位职责 任职要求'].join(' ').slice(0,128);
}
function sameJob(job,hit){
 const heading=compact([hit.title,hit.site_name].join(' '));
 const s=compact([hit.title,hit.site_name,hit.summary,hit.snippet].join(' '));
 // Chinese legal-name qualifiers and multiple work cities are common.
 const shortCompany=String(job.company||'')
  .replace(/[（(](?:中国|大陆|北京|上海|广州|深圳|杭州|苏州|成都|南京|济南)[）)]/g,'');
 const company=compact(shortCompany)
  .replace(/(?:有限责任公司|股份有限公司|有限公司|集团公司|集团|公司)$/,'');
 const title=compact(job.title_zh||job.title).replace(/(?:岗位|职位|招聘)$/,'');
 const roles=String(job.title_zh||job.title||'').split(/[\/、,，（）()]/)
  .map(x=>compact(x).replace(/(?:岗位|职位|招聘)$/,''))
  .filter(x=>x.length>=3);
 const roleMatch=s.includes(title)||title.length>=5&&s.includes(title.slice(0,5))||
  roles.some(role=>s.includes(role)||role.length>=5&&
   (s.includes(role.slice(0,5))||s.includes(role.slice(-3))));
 const cities=String(job.location||'').split(/[\/、,，;；|\s]+/)
  .map(city=>compact(city).replace(/(市|省|区|县|中国大陆)/g,''))
  .filter(city=>city.length>=2&&city.length<=14);
 const citiesMatch=!cities.length||cities.some(city=>
  /^(?:全国|多地|各地|可选)/.test(city)||s.includes(city)||s.includes(city.slice(0,2)));
 const companyMatch=heading.includes(company)||
  company.length>=4&&heading.includes(company.slice(0,4))||
  company.length>=3&&heading.includes(company.slice(0,3));
 return company.length>=3&&title.length>=2&&companyMatch&&roleMatch&&citiesMatch;
}
function safeEvidenceUrl(value,job){
 if(typeof value!=='string'||value.length>1300)return null;
 try{
  const u=new URL(value),origin=new URL(job.official_url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||banned.test(u.hostname))return null;
  if(isMainlandEmployerJobUrl(u.href))return {url:u.href,kind:'EMPLOYER_PAGE_CANDIDATE'};
  // WeChat public articles are possible hints, NEVER verified corporate JDs.
  if(u.hostname==='mp.weixin.qq.com'&&u.pathname==='/s'&&u.searchParams.has('__biz'))
   return {url:u.href,kind:'PUBLIC_ANNOUNCEMENT_CANDIDATE'};
  if(u.hostname===origin.hostname&&/(招聘|岗位|职位|recruit|career|job)/i.test(u.pathname))
   return {url:u.href,kind:'EMPLOYER_PAGE_CANDIDATE'};
 }catch{}
 return null;
}
function toSource(hit,job){
 if(!hit||typeof hit!=='object')return null;
 const source=safeEvidenceUrl(hit.url,job);
 if(!source||!sameJob(job,hit))return null;
 const excerpt=clean(hit.content||hit.summary||hit.snippet,850);
 return excerpt.length>=32?{...source,excerpt}:null;
}
export function assessDomesticEvidence(job,searchHits=[]){
 if(job?.jd_source_status==='VERIFIED_JD')
  return {...job,evidence_status:'VERIFIED_FULL_JD'};
 const initial=job?.research_anchor?.url===job?.official_url?
  toSource(job.research_anchor,job):null;
 const sources=[],seen=new Set();
 for(const entry of [initial,...searchHits.map(h=>toSource(h,job))]){
  if(!entry||seen.has(entry.url))continue;
  seen.add(entry.url);sources.push(entry);
  if(sources.length===4)break;
 }
 const content=sources.filter(s=>s.kind==='EMPLOYER_PAGE_CANDIDATE')
  .map(s=>s.excerpt).join('\n').slice(0,1400);
 // Search snippets rarely contain both formal section headings. An employer
 // listing with a job-specific duty OR qualification is still useful partial
 // evidence; the label never claims a complete JD.
 const tier=content.length>=55&&(hasDuty.test(content)||hasRequirements.test(content))?
  'PARTIAL_SOURCE':sources.length?'SEARCH_SNIPPET_ONLY':'INSUFFICIENT_EVIDENCE';
 const previousReason=clean(job.recommendation_reason,750);
 const usefulPrevious=previousReason.length>=75&&/(?:简历|经历|经验|能力|技能|工作)/.test(previousReason);
 const fallbackReason=usefulPrevious?previousReason+
  '\n核实建议：以上仅为根据已检索资料作出的初步分析，岗位最新硬性条件请以企业发布内容为准。':
  '当前仅能确认岗位方向与搜索入口，尚缺乏可交叉核对的任职要求。请先核对企业招聘页的具体职责与资格，再决定是否投递。';
 return {...job,evidence_status:tier,
  evidence_sources:sources.map(({url,kind})=>({url,kind})),
  evidence_checked_at:new Date().toISOString(),evidence_excerpt:content,
  // Employer ownership and complete JD remain unverified.
  requirements_basis:content||'暂无可核对的岗位职责与任职要求',
  match_score:null,reference_score:0,score_basis:'',
  recommendation_reason:fallbackReason,
  needs_verification:tier==='PARTIAL_SOURCE'?
   ['仅有企业招聘页候选的部分公开证据，并非已核验完整 JD；请在官网确认最新岗位与投递状态。']:
   ['缺少足够的岗位职责或任职资格证据，不能可靠打分；请打开企业招聘页面核对。']
 };
}
export function compactResearchResumeEvidence(resume,profile){
 const facts=Array.isArray(profile?.facts)?profile.facts:[];
 const quotes=[...new Set(facts.map(f=>typeof f?.quote==='string'?f.quote.trim():'')
  .filter(q=>q.length>=8&&q.length<=360))];
 if(quotes.length<3)return String(resume||'').slice(0,10000);
 const summary=quotes.map((q,i)=>'CV-'+(i+1)+' '+q).join('\n');
 return summary.length>=80?summary.slice(0,8500):String(resume||'').slice(0,10000);
}
