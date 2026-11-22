/**
 * Mainland job evidence research. Search is discovery, not verified employer JD.
 * Never use candidate resumes in search queries, invent links, bypass blocked
 * websites, or persist resume text with public evidence.
 */
import {isMainlandEmployerJobUrl} from './match-employer-source.js';
import {normalizeMatchScore,sortByMatchScore} from './match-job-quality.js';

export const DOMESTIC_EVIDENCE_PIPELINE='HHBA_MAINLAND_EVIDENCE_RESEARCH_V1';
const BASE='https://api.deepseek.com',MAX_JOBS=10,CONCURRENCY=4;
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
async function providerSearch(key,job,{fetcher=fetch,signal=null,searchTimeoutMs=8000}={}){
 const timeout=AbortSignal.timeout(searchTimeoutMs);
 const sig=signal?AbortSignal.any([signal,timeout]):timeout;
 const r=await fetcher(BASE+'/v1/tools/search',{
  method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({query:researchQuery(job),count:12,need_content:false})
 });
 if(!r.ok)throw Error('EVIDENCE_SEARCH_UNAVAILABLE');
 const json=await r.json();return Array.isArray(json?.results)?json.results.slice(0,12):[];
}
function modelText(json){
 return (json?.output||[]).filter(x=>x?.type==='message').flatMap(x=>
  (x.content||[]).filter(y=>y?.type==='output_text').map(y=>y.text||'')).join('');
}
/**
 * One model research pass for ALL selected vacancies: independent analyses,
 * score evidence, résumé facts and application advice. Direction-fit scores
 * are explicitly preliminary when JD duties/qualifications are unavailable.
 */
async function scorePartialEvidence(key,resume,jobs,{fetcher=fetch,signal=null,modelTimeoutMs=56000}={}){
 const candidates=jobs.filter(j=>j.evidence_status!=='VERIFIED_FULL_JD');
 if(!candidates.length)return jobs;
 const dataset=candidates.map(job=>({id:job.id,company:job.company,title:job.title,
  location:job.location,evidence_level:job.evidence_status,
  source_excerpt:String(job.evidence_excerpt||'').slice(0,1400),
  original_search_summary:String(job.research_anchor?.summary||'').slice(0,600),
  source_urls:(job.evidence_sources||[]).slice(0,3).map(x=>x.url),
  prior_role_reason:clean(job.recommendation_reason,420)}));
 const instructions=[
  '你是 HHBA 中国大陆求职岗位研究员。每个岗位必须独立分析，严禁套用相同推荐理由。',
  '只根据脱敏简历中实际写明的经历/成绩与给定公开资料作判断。严禁编造 JD、学历、经验、证书、工作职责、招聘状态或公司身份。',
  '分别输出四个具体中文内容：resume_evidence 说明简历里明确的相关经历、能力或成果；role_relation 解释这些经历与已知岗位方向/来源内容的关系；unknowns 说明尚未核实的硬性要求或真实差距，不要把未知当成不符合；next_step 给出具体核实和投递建议。',
  '每一项需要具体、有信息量，不能写通用客套话。若职位正文缺失，可分析岗位名称与真实简历的方向关联，但不能声称企业要求某能力。',
  'PARTIAL_SOURCE 有公开职责或要求，可对照其文字生成0-100的 AI 初步适配分；SEARCH_SNIPPET_ONLY 只能评价岗位方向与简历的初步关联，不得表示已满足任职要求，分数必须用方向参考分解释；INSUFFICIENT_EVIDENCE 一律返回 match_score:null。',
  '打分依据 score_basis 要至少40字，明确至少一项用户简历事实和本次已知的岗位信息，指出未核实的条件。证据不足必须返回null；不能为了凑分而虚构。',
  '对每个岗位还要提供 evidence_gaps（仍缺少的具体公开职责或任职资格证据）和 next_research_questions（可以通过企业公开信息进一步核实的问题）。只能围绕真实岗位发问，不编造JD。',
  '所有岗位必须使用已有id，禁止新增岗位、链接或来源，禁止把方向分冒充完整JD匹配分，禁止承诺录用。',
  '严格输出 JSON 对象：{"jobs":[{"id":"原id","match_score":82,"score_basis":"具体评分依据","resume_evidence":"简历里的真实依据","role_relation":"与已知岗位的关系","unknowns":"需要核实的条件","next_step":"实际行动建议"}]}'
 ].join('\n');
 // At most four jobs per model request. A malformed answer for one group
 // must not erase the explanations from nine other real employer listings.
 const batches=[];for(let i=0;i<dataset.length;i+=4)batches.push(dataset.slice(i,i+4));
 const answers=await Promise.all(batches.map(async batch=>{
  try{
   const timeout=AbortSignal.timeout(modelTimeoutMs);
   const sig=signal?AbortSignal.any([signal,timeout]):timeout;
   const r=await fetcher(BASE+'/responses',{method:'POST',redirect:'manual',signal:sig,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'max'},
     text:{format:{type:'json_object'}},max_output_tokens:18000,stream:false,
     instructions,input:'脱敏简历：\n'+String(resume||'').slice(0,10000)+
      '\n逐岗位公开资料（不代表已核验完整JD）：\n'+JSON.stringify(batch)})
   });
   if(!r.ok)throw Error('EVIDENCE_MODEL_UNAVAILABLE');
   const parsed=JSON.parse(modelText(await r.json()));
   const permitted=new Set(batch.map(x=>x.id));
   return (Array.isArray(parsed?.jobs)?parsed.jobs:[])
    .filter(x=>x&&typeof x.id==='string'&&permitted.has(x.id));
  }catch{return []}
 }));
 const byId=new Map(answers.flat().map(row=>[row.id,row]));
 return jobs.map(job=>{
  if(job.evidence_status==='VERIFIED_FULL_JD')return job;
  const row=byId.get(job.id);
  if(!row)return job;
  const sections=[
   ['相关经历',row.resume_evidence],['岗位关联',row.role_relation],
   ['待核实条件',row.unknowns],['投递建议',row.next_step]
  ].map(([label,value])=>({label,value:clean(value,480)}));
  const complete=sections.every(x=>x.value.length>=16);
  const reason=complete?sections.map(x=>x.label+'：'+x.value).join('\n'):
   job.recommendation_reason;
  const basis=clean(row.score_basis,420);
  const eligible=job.evidence_status==='PARTIAL_SOURCE'||
   job.evidence_status==='SEARCH_SNIPPET_ONLY';
  const grounded=/(?:简历|经历|经验|技能|能力|曾|负责)/.test(basis)&&
   /(岗位|职位|方向|职责|要求|工作)/.test(basis);
  const value=eligible&&grounded?normalizeMatchScore(row.match_score,
   basis.length>=40?basis:''):null;
  // For a snippet-only candidate, this is a career-DIRECTION score,
  // not a claim that the employer's JD requirements were verified.
  const scoreStatus=value===null?undefined:job.evidence_status==='PARTIAL_SOURCE'?
   'AI_PARTIAL_SOURCE_SCORED':'AI_DIRECTION_REFERENCE_SCORED';
  return {...job,recommendation_reason:reason,
   evidence_gaps:Array.isArray(row.evidence_gaps)?
    row.evidence_gaps.filter(x=>typeof x==='string').slice(0,5).map(x=>clean(x,180)):[],
   next_research_questions:Array.isArray(row.next_research_questions)?
    row.next_research_questions.filter(x=>typeof x==='string').slice(0,5).map(x=>clean(x,180)):[],
   ...(value!==null?{match_score:value,reference_score:value,score_basis:basis,
    evidence_score_status:scoreStatus}:{}),
   evidence_reason_status:complete?'AI_INDIVIDUAL_ANALYSIS':'FALLBACK'};
 });
}
export async function researchDomesticJobEvidence(key,resume,matches,options={},deps={}){
 const jobs=Array.isArray(matches)?matches.slice(0,MAX_JOBS):[];
 if(options.enabled===false)return {matches:jobs.map(j=>assessDomesticEvidence(j)),
  diagnostic:{mode:'disabled',researched:0,partial:0,scored:0}};
 const research=deps.search||providerSearch,score=deps.score||scorePartialEvidence;
 const out=new Array(jobs.length);let cursor=0,reads=0,failures=0;
 const work=async()=>{
  while(cursor<jobs.length){
   const i=cursor++,job=jobs[i];
   if(job.jd_source_status==='VERIFIED_JD'){out[i]=assessDomesticEvidence(job);continue;}
   let hits=[];
   try{hits=await research(key,job,options);reads++;}catch{failures++;}
   out[i]=assessDomesticEvidence(job,hits);
  }
 };
 await Promise.all(Array.from({length:Math.min(CONCURRENCY,jobs.length)},()=>work()));
 let result=out;
 if(options.score!==false){
  if(options.onProgress)options.onProgress('scoring');
  try{result=await score(key,resume,out,options);}catch{/* retain source-qualified preliminary reasons; never invent scores */}
 }
 return {matches:sortByMatchScore(result),diagnostic:{
  mode:DOMESTIC_EVIDENCE_PIPELINE,researched:reads,search_failures:failures,
  partial:result.filter(j=>j.evidence_status==='PARTIAL_SOURCE').length,
  snippet_only:result.filter(j=>j.evidence_status==='SEARCH_SNIPPET_ONLY').length,
  insufficient:result.filter(j=>j.evidence_status==='INSUFFICIENT_EVIDENCE').length,
  scored:result.filter(j=>j.evidence_score_status==='AI_PARTIAL_SOURCE_SCORED'||
   j.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED').length,
  verified:result.filter(j=>j.evidence_status==='VERIFIED_FULL_JD').length
 }};
}
