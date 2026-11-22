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
 const s=compact([hit.title,hit.site_name,hit.summary,hit.snippet].join(' '));
 const company=compact(job.company).replace(/(?:有限责任公司|股份有限公司|有限公司|集团公司|集团|公司)$/,'');
 const title=compact(job.title_zh||job.title).replace(/(?:岗位|职位|招聘)$/,'');
 const city=compact(job.location).replace(/(市|省|区|县|中国大陆)/g,'').slice(0,5);
 return company.length>=2&&title.length>=2&&
  (s.includes(company)||company.length>=5&&s.includes(company.slice(0,5)))&&
  (s.includes(title)||title.length>=5&&s.includes(title.slice(0,5)))&&
  (city.length<2||s.includes(city));
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
 return excerpt.length>=55?{...source,excerpt}:null;
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
 const tier=content.length>=130&&hasDuty.test(content)&&hasRequirements.test(content)?
  'PARTIAL_SOURCE':sources.length?'SEARCH_SNIPPET_ONLY':'INSUFFICIENT_EVIDENCE';
 return {...job,evidence_status:tier,
  evidence_sources:sources.map(({url,kind})=>({url,kind})),
  evidence_checked_at:new Date().toISOString(),evidence_excerpt:content,
  // Employer ownership and complete JD remain unverified.
  requirements_basis:content||'暂无可核对的岗位职责与任职要求',
  match_score:null,reference_score:0,score_basis:'',
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
async function scorePartialEvidence(key,resume,jobs,{fetcher=fetch,signal=null,modelTimeoutMs=22000}={}){
 const eligible=jobs.filter(j=>j.evidence_status==='PARTIAL_SOURCE');
 if(!eligible.length)return jobs;
 const dataset=eligible.map(job=>({id:job.id,company:job.company,title:job.title,
  location:job.location,partial_evidence:job.evidence_excerpt.slice(0,1150),
  source_urls:job.evidence_sources.slice(0,3).map(s=>s.url)}));
 const instructions=[
  '你是 HHBA 中国大陆岗位证据分析 Agent，只根据真实简历和本次检索到的公开岗位部分信息做初步适配评估。',
  '这些资料不是已核验完整 JD，不能编造学历、经验、资质、职责、招聘状态、企业官方认证、来源或录用概率。',
  '如证据充分则输出0至100整数和不少于30字的具体score_basis，明确对应的简历事实和岗位公开证据；不足则match_score=null。',
  '只返回输入中的id，不加新岗位，不提供或修改链接。严格JSON：{"jobs":[{"id":"原id","match_score":null,"score_basis":"对比有依据的岗位要求与简历内容"}]}'
 ].join('\n');
 const timeout=AbortSignal.timeout(modelTimeoutMs),sig=signal?AbortSignal.any([signal,timeout]):timeout;
 const r=await fetcher(BASE+'/responses',{method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'none'},
   text:{format:{type:'json_object'}},max_output_tokens:2900,stream:false,
   instructions,input:'脱敏简历：\n'+String(resume||'').slice(0,9000)+'\n候选岗位的公开证据：\n'+JSON.stringify(dataset)})
 });
 if(!r.ok)throw Error('EVIDENCE_MODEL_UNAVAILABLE');
 let parsed;try{parsed=JSON.parse(modelText(await r.json()))}catch{throw Error('EVIDENCE_MODEL_INVALID')}
 const byId=new Map((Array.isArray(parsed?.jobs)?parsed.jobs:[])
  .filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 return jobs.map(job=>{
  if(job.evidence_status!=='PARTIAL_SOURCE')return job;
  const row=byId.get(job.id),basis=clean(row?.score_basis,360);
  const score=normalizeMatchScore(row?.match_score,basis.length>=30?basis:'');
  if(score===null)return job;
  return {...job,match_score:score,reference_score:score,score_basis:basis,
   evidence_score_status:'AI_PARTIAL_SOURCE_SCORED'};
 });
}
export async function researchDomesticJobEvidence(key,resume,matches,options={},deps={}){
 const jobs=Array.isArray(matches)?matches.slice(0,MAX_JOBS):[];
 if(options.enabled===false)return {matches:jobs,diagnostic:{mode:'disabled',researched:0,partial:0,scored:0}};
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
 try{result=await score(key,resume,out,options);}catch{/* never restore ungrounded scores */}
 return {matches:sortByMatchScore(result),diagnostic:{
  mode:DOMESTIC_EVIDENCE_PIPELINE,researched:reads,search_failures:failures,
  partial:result.filter(j=>j.evidence_status==='PARTIAL_SOURCE').length,
  snippet_only:result.filter(j=>j.evidence_status==='SEARCH_SNIPPET_ONLY').length,
  insufficient:result.filter(j=>j.evidence_status==='INSUFFICIENT_EVIDENCE').length,
  scored:result.filter(j=>j.evidence_score_status==='AI_PARTIAL_SOURCE_SCORED').length,
  verified:result.filter(j=>j.evidence_status==='VERIFIED_FULL_JD').length
 }};
}
