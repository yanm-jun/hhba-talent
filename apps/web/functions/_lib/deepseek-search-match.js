// HHBA Search-first job matching. No employer ATS API, no web search inside the model.
// 1) DeepSeek Search returns specific public job URLs
// 2) optional DeepSeek Fetch enriches weak snippets
// 3) DeepSeek V4 Pro selects/justifies linked candidates, never invents links.
import {safeJobDetailLink,decodeSearchText} from './deepseek-native-match.js';
import {isMainlandJobLocation} from './mainland-job-location.js';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from './match-job-quality.js';
import {supplementalQueries,mergeCandidateHits,combineRecommended} from './match-search-growth.js';
import {recruitmentSourceKind,isEmployerDirectedSource,sourceDisplay,sortEmployerFirst,employerLookupQuery,corroboratesEmployerPosting,sourceCounts} from './match-employer-source.js';
import {buildRoleIntent,buildResumeProfile,buildRoleSearchQueries} from './match-role-intent.js';

const BASE='https://api.deepseek.com';
// One paid match uses the same deep-search tier for every user. These are hard ceilings,
// not a requirement to spend the entire budget if enough eligible jobs were found.
export const DEEP_SEARCH_BUDGET=Object.freeze({
 searchRequests:10,fetchRequests:16,searchResultsPerRequest:50,
 initialSearchRequests:4,initialFetchRequests:8,
 supplementalSearchRequests:6,supplementalFetchRequests:8,
 toolPriceCny:0.005
});
const foreign=/(?:香港|澳门|澳門|台湾|臺灣|日本|东京|大阪|新加坡|美国|英国|越南|海外|境外|驻外|overseas|hong kong|tokyo|singapore|remote overseas)/i;
const roleEvidence=/(?:招聘|岗位|职位|校园招聘|社会招聘|社招|工作地点|岗位职责|任职要求|申请职位|立即申请|job|career|position|apply|vacancy)/i;
const clean=(s,max=1200)=>decodeSearchText(typeof s==='string'?s:'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const codeError=(code)=>Object.assign(new Error(code),{code});
export function searchQueries(resume,roleHint=''){
 // Four complementary queries: direct role, alternate titles, transferable roles,
 // and resume-derived roles. Never send the complete resume to the Search endpoint.
 return buildRoleSearchQueries(roleHint,resume);
}
export function normalizeHits(searchResponses,max=28){
 const byUrl=new Map();
 for(const result of searchResponses){
  for(const hit of result?.results||[]){
   const url=safeJobDetailLink(hit?.url);
   if(!url||!isEmployerDirectedSource(recruitmentSourceKind(url)))continue;
   const title=clean(hit?.title,160),summary=clean(hit?.summary||hit?.snippet,900);
   const snippet=clean(hit?.snippet,300);
   if(!title||!roleEvidence.test(title+' '+summary+' '+url))continue;
   if(foreign.test(title)&&!/(?:中国|上海|北京|深圳|广州|成都|杭州)/.test(title))continue;
   const key=url.replace(/[?&](?:utm_[^=&]+|from|source)=[^&]*/gi,'').replace(/[?&]$/,'');
   const prev=byUrl.get(key);
   const row={id:'j'+(byUrl.size+1),title,url,summary,snippet,
    source:clean(hit?.site_name,80),date:hit?.date||null,content:'',
    recruitment_source_kind:recruitmentSourceKind(url),
    availability:classifyJobAvailability({summary,snippet})};
   if(!prev||summary.length>prev.summary.length)byUrl.set(key,{...row,id:prev?.id||row.id});
  }
 }
 return sortEmployerFirst([...byUrl.values()],max).map((item,i)=>({...item,id:'j'+(i+1)}));
}
async function providerJson(fetcher,key,path,body,timeoutMs,signal){
 const timeout=AbortSignal.timeout(timeoutMs);
 const merged=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;
 try{response=await fetcher(BASE+path,{
  method:'POST',redirect:'manual',signal:merged,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify(body)
 });}catch(e){
  if(e?.name==='AbortError'||e?.name==='TimeoutError')throw codeError('AI_SEARCH_TIMEOUT');
  throw codeError('AI_PROVIDER_NETWORK_ERROR');
 }
 if(!response.ok){
  if(response.status===401||response.status===403)throw codeError('AI_PROVIDER_KEY_REJECTED');
  if(response.status===402)throw codeError('AI_PROVIDER_BALANCE_INSUFFICIENT');
  if(response.status===429)throw codeError('AI_PROVIDER_RATE_LIMITED');
  if(response.status===400||response.status===404||response.status===422)
   throw codeError('AI_SEARCH_API_REJECTED');
  throw codeError('AI_PROVIDER_UNAVAILABLE');
 }
 try{return await response.json();}catch{throw codeError('AI_SEARCH_RESPONSE_INVALID');}
}
export async function searchPublicJobs(key,text,roleHint,{
 fetcher=fetch,signal=null,onProgress=()=>{},queryTimeoutMs=14000,
 queriesOverride=null,maxHits=28,allowEmpty=false
}={}){
 const start=Date.now(),queries=(queriesOverride||searchQueries(text,roleHint))
  .slice(0,DEEP_SEARCH_BUDGET.searchRequests),errors=[];
 onProgress('searching');
 const responses=await Promise.all(queries.map(async query=>{
  try{
   const data=await providerJson(fetcher,key,'/v1/tools/search',
    {query,count:DEEP_SEARCH_BUDGET.searchResultsPerRequest,need_content:false},queryTimeoutMs,signal);
   if(!Array.isArray(data?.results))throw codeError('AI_SEARCH_RESPONSE_INVALID');
   return data;
  }catch(e){errors.push(e.code||'AI_PROVIDER_UNAVAILABLE');return {results:[]};}
 }));
 const hits=normalizeHits(responses,maxHits);
 if(!hits.length&&(!allowEmpty||errors.length===queries.length))throw codeError(errors.includes('AI_PROVIDER_KEY_REJECTED')?'AI_PROVIDER_KEY_REJECTED':
  errors.includes('AI_PROVIDER_BALANCE_INSUFFICIENT')?'AI_PROVIDER_BALANCE_INSUFFICIENT':
  errors.includes('AI_PROVIDER_RATE_LIMITED')?'AI_PROVIDER_RATE_LIMITED':
  errors.includes('AI_SEARCH_API_REJECTED')?'AI_SEARCH_API_REJECTED':
  errors.length===queries.length?'AI_SEARCH_UNAVAILABLE':'AI_SEARCH_NO_DETAIL_JOBS');
 return {hits,diagnostic:{search_ms:Date.now()-start,queries:queries.length,
  successful_searches:responses.filter(x=>x.results?.length>0).length,
  raw_results:responses.reduce((a,x)=>a+x.results.length,0),
  candidate_links:hits.length,search_failures:errors.length,
  rejected_links:responses.reduce((a,x)=>a+x.results.length,0)-hits.length}};
}
export async function enrichCandidateDetails(key,hits,{
 fetcher=fetch,signal=null,onProgress=()=>{},maxFetch=8,fetchTimeoutMs=3200
}={}){
 // Keep a strict request budget even when some requests fail: the provider bills
 // successful calls, but failed attempts must never permit unlimited retries.
 // Prioritize candidates showing possible closure, then short evidence snippets.
 // Do not make unknown Search snippets appear "confirmed open".
 const suspicious=hits.filter(h=>h.availability?.status==='POSSIBLY_CLOSED');
 const short=hits.filter(h=>h.summary.length<130);
 const needs=[...new Set([...suspicious,...short,...hits].map(h=>h.id))]
  .map(id=>hits.find(h=>h.id===id)).filter(Boolean)
  .slice(0,Math.max(0,Math.min(DEEP_SEARCH_BUDGET.fetchRequests,Math.floor(maxFetch)||0)));
 if(!needs.length)return {hits,fetches:0,fetch_attempts:0,fetch_ms:0,excluded_closed:0};
 const start=Date.now();onProgress('reading');
 let success=0;
 const detail=await Promise.all(needs.map(async hit=>{
  try{
   const d=await providerJson(fetcher,key,'/v1/tools/fetch',{url:hit.url},fetchTimeoutMs,signal);
   const content=clean(d?.content,2600);
   if(content.length>80){
    success++;
    return {...hit,content,availability:classifyJobAvailability({content},{fetched:true})};
   }
  }catch{/* Missing Fetch result is unknown, not a negative conclusion. */}
  return hit;
 }));
 const map=new Map(detail.map(hit=>[hit.id,hit]));
 const checked=hits.map(hit=>map.get(hit.id)||hit);
 const eligible=checked.filter(isRecommendationEligible);
 return {hits:eligible,fetches:success,fetch_attempts:needs.length,fetch_ms:Date.now()-start,
  excluded_closed:checked.length-eligible.length};
}
function closedRows(text){
 const ix=text.search(/"jobs"\s*:/),start=ix<0?-1:text.indexOf('[',ix);
 if(start<0||text.length>80000)return [];
 const rows=[];let depth=0,startAt=-1,inString=false,escape=false;
 for(let i=start+1;i<text.length;i++){
  const ch=text[i];
  if(inString){
   if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')inString=false;
   continue;
  }
  if(ch==='"'){inString=true;continue;}
  if(ch==='{'){if(++depth===1)startAt=i;}
  else if(ch==='}'&&depth>0&&--depth===0&&startAt>=0){
   try{rows.push(JSON.parse(text.slice(startAt,i+1)))}catch{}
   startAt=-1;
   if(rows.length>=20)break;
  }
 }
 return rows;
}
export function selectedJobs(text,hits,limit=10){
 const byId=new Map(hits.map(h=>[h.id,h])),found=[],seen=new Set();
 for(const row of closedRows(text)){
  const evidence=byId.get(String(row?.id||row?.candidate_id||''));
  if(!evidence)continue;
  const location=clean(row.location,90),reason=clean(row.reason,650),
   title=clean(row.title,110),company=clean(row.company,100);
  if(!isMainlandJobLocation(location)||!reason||!company||!title||foreign.test(title))continue;
  if(!isRecommendationEligible(evidence))continue;
  // Defense in depth: never let model output or an alternate code path leak a job-board link.
  const verifiedKind=recruitmentSourceKind(evidence.url);
  if(!isEmployerDirectedSource(verifiedKind))continue;
  const signature=(company+'|'+title).toLowerCase().replace(/\s/g,'');
  if(seen.has(signature)||seen.has(evidence.url))continue;
  seen.add(signature);seen.add(evidence.url);
  const url=evidence.url; // CRITICAL: source URL comes from Search, NEVER model text.
  const match_score=normalizeMatchScore(row.match_score??row.score,row.score_basis);
  const recruitment_source_kind=recruitmentSourceKind(url);
  found.push({id:'search-'+evidence.id,company,title,title_zh:title,location,
   recruitment_source_kind,recruitment_source_note:sourceDisplay(recruitment_source_kind),
   match_score,score_basis:match_score===null?'':clean(row.score_basis,240),
   availability_status:evidence.availability?.status||'UNKNOWN',
   availability_note:evidence.availability?.evidence||'投递状态待确认',
   availability_checked_at:evidence.availability?.checked_at||null,
   official_url:url,platform:'deepseek-search',source:new URL(url).hostname,
   source_type:'站外招聘职位',source_status:'MODEL_SEARCH_REPORTED',
   application_status:'NEEDS_OFFICIAL_CONFIRMATION',remote:false,reference_score:0,
   matched:[reason],recommendation_reason:reason,not_evidenced:[],
   needs_verification:['根据岗位原始网页核对最新招聘状态与硬性任职条件。'],
   requirements_basis:clean(row.job_basis||evidence.summary,220),
   salary:clean(row.salary,65)||null,experience_requirement:null,
   checked_at:new Date().toISOString()
  });
  if(found.length>=limit)break;
 }
 return sortByMatchScore(found);
}
function outputFromResponse(data){
 return (data?.output||[]).filter(v=>v?.type==='message').flatMap(v=>
  (v.content||[]).filter(c=>c?.type==='output_text').map(c=>c.text||'')).join('');
}
export async function reasonAboutJobs(key,resume,hits,limit,{
 fetcher=fetch,signal=null,onProgress=()=>{},onPartial=()=>{},modelTimeoutMs=37000,shortlistOnly=false,
 roleHint='',roleIntent=null,resumeProfile=null
}={}){
 const start=Date.now();onProgress('writing');
 const intent=roleIntent||buildRoleIntent(roleHint,resume);
 const profile=resumeProfile||buildResumeProfile(resume,intent);
 const intentContext={primary_direction:intent.primary_direction,direct_roles:intent.direct_roles,
  adjacent_roles:intent.adjacent_roles,resume_related_roles:intent.resume_related_roles,
  industries:intent.industry_terms,constraints:intent.constraints};
 const cards=hits.slice(0,32).map(h=>({
  id:h.id,title:h.title,url:h.url,description:(h.content||h.summary||h.snippet).slice(0,800),
  recruitment_source:h.recruitment_source_kind||recruitmentSourceKind(h.url),
  availability:h.availability?.status||'UNKNOWN',
  availability_note:h.availability?.evidence||'投递状态待确认'
 }));
 const instructions=[
  '你是 HHBA 求职匹配助手。你只能从提供的真实网页搜索候选中推荐职位，绝不能添加新的网页、编造候选 ID。',
  '严格禁止推荐第三方招聘平台，例如BOSS直聘、智联招聘、前程无忧、猎聘、拉勾等；这些即使匹配分很高也不能作为兜底。只能使用企业自有招聘站具体岗位页或企业专属招聘系统候选职位页；企业来源没有证据时不能冒充已核验官方职位。',
  '认真阅读脱敏简历和每条候选职位的摘要。选择实际工作城市位于中国大陆且能合理匹配的最多'+limit+'条不同企业、不同岗位。',
  '用户目标方向与限制条件：'+JSON.stringify(intentContext)+'。直接岗位优先于相邻迁移岗位；相邻岗位必须说明能力迁移逻辑。用户明确提出全国出差时，优先搜索和排序接受跨区域出差的岗位；没有明确提出时不得自行假设。',
  '简历能力线索（只允许作为搜索与匹配证据，不得推断未写明的资历）：'+JSON.stringify(profile.skills)+'。优先将真实工作成果映射到岗位职责，而不是只按关键词相似度排序。',
  '若搜索结果没有明确工作地点或职位内容，只能不选该条。不要猜城市、公司或岗位硬性要求；不可虚构学历或经历。',
  '优先选择网页有明确招聘开放证据的岗位；UNKNOWN不能写成可投递，CLOSED_LISTED和POSSIBLY_CLOSED不得推荐。尽可能返回十个真实职位，不为凑数捏造。',
  '为每条岗位给出0～100整数的「简历适配分」match_score，依据已有简历和招聘内容评估岗位方向、工作经验、技能与城市偏好，不代表录用概率。分数需有独立的score_basis（至少30字）解释具体加分与不足；证据不充分时match_score填null、score_basis为空。',
  shortlistOnly?'先快速生成岗位名单，理由仅写45～70字，详细分析将由下一阶段补充。请优先列满符合条件的候选，避免在首轮输出中消耗太多文字。':'每个为什么推荐的理由写120～180字，结合简历的真实经历成果与职位内容、岗位职责映射、必要的差距提示；避免套话，不能保证录用。',
  '输出 JSON 对象，结构：{"jobs":[{"id":"候选id，如j1","company":"岗位原网页中企业","title":"岗位","location":"中国大陆实际工作城市","match_score":85,"score_basis":"岗位与简历实际技能或职责吻合的证据，至少25字","reason":"初步推荐理由，后续补充详细说明","job_basis":"网页明确的岗位职责要点","salary":""}]}。',
  '优先把最有把握的一条完整对象尽早输出，后续逐条补齐。不得在JSON以外输出文字。'
 ].join('\n');
 const payload={
  model:'deepseek-v4-pro',reasoning:{effort:'none'},
  text:{format:{type:'json_object'}},max_output_tokens:shortlistOnly?3500:5600,stream:true,
  instructions,
  input:'用户求职目标：\n'+JSON.stringify(intentContext)+'\n简历能力线索：\n'+JSON.stringify(profile)+'\n脱敏简历：\n'+String(resume).slice(0,10000)+'\n可选真实职位：\n'+JSON.stringify(cards)
 };
 const timeout=AbortSignal.timeout(modelTimeoutMs),sig=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;
 try{response=await fetcher(BASE+'/responses',{
  method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'text/event-stream'},
  body:JSON.stringify(payload)
 });}catch(e){throw codeError(e?.name==='AbortError'||e?.name==='TimeoutError'?'AI_MATCH_REASON_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');}
 if(!response.ok)throw codeError(response.status===401||response.status===403?'AI_PROVIDER_KEY_REJECTED':
  response.status===402?'AI_PROVIDER_BALANCE_INSUFFICIENT':
  response.status===429?'AI_PROVIDER_RATE_LIMITED':
  [400,404,422].includes(response.status)?'AI_PROVIDER_REQUEST_REJECTED':'AI_PROVIDER_UNAVAILABLE');
 let buf='',text='',final=null,partial=[],lastCount=0;
 if(!response.body)throw codeError('AI_PROVIDER_RESPONSE_INVALID');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 const event=s=>{
  const lines=s.split('\n'),raw=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
  if(!raw||raw==='[DONE]')return;
  let data;try{data=JSON.parse(raw)}catch{return}
  if(data.type==='response.output_text.delta'&&typeof data.delta==='string'){
   text+=data.delta;
   if(data.delta.includes('}')&&text.length<80000){
    const jobs=selectedJobs(text,hits,limit);
    if(jobs.length>lastCount){partial=jobs;lastCount=jobs.length;onPartial(jobs);}
   }
  }
  if(data.type==='response.output_text.done'&&typeof data.text==='string'){
   const jobs=selectedJobs(data.text,hits,limit);
   if(jobs.length>lastCount){partial=jobs;lastCount=jobs.length;onPartial(jobs);}
  }
  if(data.type==='response.completed')final=data.response;
  if(data.type==='response.failed'||data.type==='response.incomplete')
   throw codeError('AI_PROVIDER_RESPONSE_INVALID');
 };
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   buf+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   if(buf.length>200000)throw codeError('AI_PROVIDER_RESPONSE_INVALID');
   let index;
   while((index=buf.indexOf('\n\n'))>=0){
    event(buf.slice(0,index));buf=buf.slice(index+2);
   }
  }
  if(buf.trim())event(buf);
 }catch(e){
  if(e?.name==='TimeoutError'||e?.name==='AbortError'){
   if(!partial.length)throw codeError('AI_MATCH_REASON_TIMEOUT');
  }else if(!partial.length)throw e;
 }finally{try{reader.releaseLock()}catch{}}
 const finalJobs=final?.status==='completed'?selectedJobs(outputFromResponse(final),hits,limit):[];
 const matches=finalJobs.length>=partial.length?finalJobs:partial;
 if(!matches.length)throw codeError('AI_MATCH_NO_VALID_JOBS');
 const providerRows=closedRows(final?.status==='completed'?outputFromResponse(final):text).length;
 return {matches,incomplete:final?.status!=='completed'||matches.length<limit,
  model_ms:Date.now()-start,provider_rows:providerRows,candidates_considered:cards.length};
}
// Find a search-grounded employer job detail for a shortlisted mass-board result.
// A positive source hint is NOT ownership verification. Only replace a link when
// Search independently returns a candidate with company, role and city evidence.
// Never generate company domains, URLs or job IDs from model output.
export async function preferEmployerPostingUrls(key,matches,hits,{
 fetcher=fetch,signal=null,onPartial=()=>{},onProgress=()=>{},
 maxLookups=3,lookupTimeoutMs=6500
}={}){
 const started=Date.now();
 const candidates=matches.filter(job=>(job.recruitment_source_kind||
  recruitmentSourceKind(job.official_url))==='THIRD_PARTY_BOARD').slice(0,maxLookups);
 if(!candidates.length)return {matches,hits,lookups:0,replaced:0,lookup_ms:0};
 onProgress('searching');
 let lookups=0,replaced=0;
 const looked=await Promise.all(candidates.map(async job=>{
  lookups++;
  try{
   const response=await providerJson(fetcher,key,'/v1/tools/search',{
    query:employerLookupQuery(job),count:12,need_content:false
   },lookupTimeoutMs,signal);
   const choices=normalizeHits([response],18).filter(hit=>
    corroboratesEmployerPosting(job,hit)&&isRecommendationEligible(hit)
    &&hit.url!==job.official_url);
   return {job,hit:choices[0]||null};
  }catch{return {job,hit:null};}
 }));
 const claimed=new Set(matches.map(j=>j.official_url)),updates=new Map(),newHits=[];
 for(const {job,hit} of looked){
  if(!hit||claimed.has(hit.url))continue;
  claimed.add(hit.url);
  const kind=hit.recruitment_source_kind;
  updates.set(job.id,{...job,official_url:hit.url,source:new URL(hit.url).hostname,
   source_type:'站外招聘职位',recruitment_source_kind:kind,
   recruitment_source_note:sourceDisplay(kind),
   availability_status:hit.availability?.status||'UNKNOWN',
   availability_note:hit.availability?.evidence||'投递状态待确认',
   availability_checked_at:hit.availability?.checked_at||null,
   needs_verification:['已从搜索结果找到更接近企业招聘站的相同岗位页面；企业是否授权及实际投递状态仍需核对。']});
  newHits.push(hit);replaced++;
 }
 const result=matches.map(job=>updates.get(job.id)||job);
 if(replaced&&!signal?.aborted)onPartial(result);
 return {matches:result,hits:[...hits,...newHits],lookups,replaced,lookup_ms:Date.now()-started};
}
// Expand the shortlist in two small parallel requests. The first-ranked jobs
// were already sent to the browser; slow prose generation never hides them.
export async function expandDetailedReasons(key,resume,matches,hits,{
 fetcher=fetch,signal=null,onPartial=()=>{},onProgress=()=>{},detailTimeoutMs=20000,
 roleHint='',roleIntent=null,resumeProfile=null
}={}){
 if(!matches.length)return {matches,expanded:0,detail_ms:0,detail_failures:0};
 const intent=roleIntent||buildRoleIntent(roleHint,resume);
 const profile=resumeProfile||buildResumeProfile(resume,intent);
 const started=Date.now(),lookup=new Map(hits.map(h=>[h.url,h]));
 const jobs=[...matches],groups=[];
 for(let i=0;i<jobs.length;i+=5)groups.push(jobs.slice(i,i+5));
 let expanded=0,detail_failures=0;
 onProgress('writing');
 await Promise.all(groups.map(async group=>{
  const description=group.map(j=>{
   const hit=lookup.get(j.official_url);
   return {id:j.id,title:j.title,company:j.company,location:j.location,
    score:j.match_score,score_basis:j.score_basis,
    summary:String(hit?.content||hit?.summary||'').slice(0,650),
    initial_reason:String(j.recommendation_reason||'').slice(0,210)};
  });
  const prompt=[
   '你只负责补充 HHBA 已有岗位的推荐理由。岗位公司、职位、城市、分数已经确定，不得更改、增删岗位或编造任职条件。',
   '用户目标方向：'+JSON.stringify({primary:intent.primary_direction,direct:intent.direct_roles,adjacent:intent.adjacent_roles,constraints:intent.constraints})+'。优先尊重直接目标；相邻岗位须解释迁移逻辑。',
   '简历能力线索：'+JSON.stringify(profile.skills)+'。只引用简历实际出现的证据，不推断未出现的资历。',
   '对每条候选撰写120～180字中文具体理由：简历中的真实相关经历和成果、与此职位明确职责的对应、可能的经验差距。',
   '不要输出URL、额外岗位或成功率预测。没有具体职责证据时明确说明不确定。输出JSON：{"jobs":[{"id":"原有id","reason":"具体理由"}]}。'
  ].join('\n');
  try{
   const timeout=AbortSignal.timeout(detailTimeoutMs);
   const combined=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await fetcher(BASE+'/responses',{method:'POST',redirect:'manual',signal:combined,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'none'},
     text:{format:{type:'json_object'}},max_output_tokens:2200,stream:false,
     instructions:prompt,input:'用户目标：\n'+JSON.stringify(intent)+'\n简历能力线索：\n'+JSON.stringify(profile.skills)+
      '\n脱敏简历：\n'+String(resume).slice(0,7000)+'\n已选真实岗位：\n'+JSON.stringify(description)})
   });
   if(!response.ok)throw codeError('AI_MATCH_REASON_UNAVAILABLE');
   const data=await response.json(),raw=outputFromResponse(data);
   let source;
   try{source=JSON.parse(raw)}catch{source={jobs:closedRows(raw)}}
   const updates=new Map((source?.jobs||[]).filter(v=>v&&typeof v.id==='string'&&typeof v.reason==='string')
    .map(v=>[v.id,clean(v.reason,650)]));
   let changed=false;
   for(const job of group){
    const reason=updates.get(job.id);
    if(!reason||reason.length<75)continue;
    const target=jobs.find(x=>x.id===job.id);
    if(!target)continue;
    target.recommendation_reason=reason;target.matched=[reason];
    target.reason_detail_complete=true;expanded++;changed=true;
   }
   if(changed&&!signal?.aborted)onPartial([...jobs]);
  }catch{detail_failures++;}
 }));
 return {matches:jobs,expanded,detail_ms:Date.now()-started,detail_failures};
}
export async function runSearchFirstMatch(key,resume,roleHint,limit=10,opts={}){
 const start=Date.now(),onProgress=opts.onProgress||(()=>{}),onPartial=opts.onPartial||(()=>{});
 const roleIntent=buildRoleIntent(roleHint,resume);
 const resumeProfile=buildResumeProfile(resume,roleIntent);
 const search=await searchPublicJobs(key,resume,roleHint,{...opts,maxHits:64,allowEmpty:true});
 const enriched=await enrichCandidateDetails(key,search.hits,{
  ...opts,maxFetch:Math.min(DEEP_SEARCH_BUDGET.initialFetchRequests,
   opts.maxFetch??DEEP_SEARCH_BUDGET.initialFetchRequests)
 });
 let pool=enriched.hits;
 let visible=[],firstModelMs=0,secondModelMs=0,firstRows=0,secondRows=0;
 let additionalQueries=0,additionalSuccesses=0,additionalCandidates=0,additionalFiltered=0;
 let additionalFetches=0,additionalFetchAttempts=0;
 let supplementalFailed=0,supplementSearchMs=0;

 const show=jobs=>{visible=jobs;onPartial(jobs);};
 // Short first pass: return the ranked shortlist, scoring and brief explanations
 // before any further search or the full prose pass.
 const first=pool.length?await reasonAboutJobs(key,resume,pool,limit,{
  ...opts,roleHint,roleIntent,resumeProfile,shortlistOnly:true,modelTimeoutMs:opts.modelTimeoutMs??26000,
  onProgress,onPartial:show
 }):{matches:[],model_ms:0,provider_rows:0};
 firstModelMs=first.model_ms;firstRows=first.provider_rows;
 visible=combineRecommended(visible,first.matches,limit);
 if(visible.length)show(visible);
 // All paid matching requests use the deep tier. Six extra search directions
 // are allowed only when the validated first shortlist has room. Preserve the
 // first result on screen and never repeat a resume upload or invent links.
 if(visible.length<limit&&opts.supplementalLimit!==0){
  const queries=supplementalQueries(resume,roleHint,searchQueries(resume,roleHint))
   .slice(0,Math.max(0,Math.min(
    DEEP_SEARCH_BUDGET.supplementalSearchRequests,
    DEEP_SEARCH_BUDGET.searchRequests-search.diagnostic.queries,
    opts.supplementalLimit??DEEP_SEARCH_BUDGET.supplementalSearchRequests
   )));
  if(queries.length){
   additionalQueries=queries.length;
   try{
    const supplemental=await searchPublicJobs(key,resume,roleHint,{
     ...opts,queriesOverride:queries,maxHits:48,allowEmpty:true,queryTimeoutMs:opts.supplementalTimeoutMs??9000
    });
    supplemental.diagnostic.queries=Math.min(supplemental.diagnostic.queries,queries.length);
    additionalSuccesses=supplemental.diagnostic.successful_searches;
    supplementSearchMs=supplemental.diagnostic.search_ms;
    additionalCandidates=supplemental.hits.length;
    additionalFiltered=supplemental.diagnostic.rejected_links;
    const earlier=new Set(pool.map(h=>h.url));
    const combined=mergeCandidateHits(pool,supplemental.hits,96);
    const fresh=combined.filter(h=>!earlier.has(h.url));
    // Up to eight additional reads, never exceeding 16 total attempted Fetch calls.
    const checked=await enrichCandidateDetails(key,fresh,{...opts,maxFetch:Math.min(
     DEEP_SEARCH_BUDGET.supplementalFetchRequests,
     DEEP_SEARCH_BUDGET.fetchRequests-enriched.fetch_attempts
    ),fetchTimeoutMs:opts.supplementalFetchTimeoutMs??3200});
    additionalFetches=checked.fetches;
    additionalFetchAttempts=checked.fetch_attempts;
    pool=mergeCandidateHits(pool,checked.hits,96);
    const unselected=pool.filter(h=>!visible.some(j=>j.official_url===h.url));
    if(unselected.length){
     const extra=await reasonAboutJobs(key,resume,unselected,limit-visible.length,{
      ...opts,roleHint,roleIntent,resumeProfile,shortlistOnly:true,modelTimeoutMs:opts.supplementalModelTimeoutMs??18000,
      onProgress,onPartial:jobs=>show(combineRecommended(visible,jobs,limit))
     });
     secondModelMs=extra.model_ms;secondRows=extra.provider_rows;
     visible=combineRecommended(visible,extra.matches,limit);show(visible);
    }
   }catch(e){
    supplementalFailed=1;
    // Initial valid shortlist must survive an optional search error. Log only code.
    console.warn('HHBA_MATCH_SUPPLEMENT_FAILED',String(e?.code||'UNKNOWN'));
   }
  }
 }
 // No public job-board fallback, including transient SSE partial responses.
 // The former replacement stage is unnecessary: job boards never enter the shortlist.
 visible=visible.filter(j=>isEmployerDirectedSource(recruitmentSourceKind(j.official_url)));
 const beforeSource=sourceCounts(visible);
 const prefer={matches:visible,hits:pool,lookups:0,replaced:0,lookup_ms:0};
 if(!visible.length)throw codeError('AI_EMPLOYER_JOBS_NOT_FOUND');
 const detail=opts.expandDetailed===false?{matches:visible,expanded:0,detail_ms:0,detail_failures:0}:
  await expandDetailedReasons(key,resume,visible,pool,{...opts,roleHint,roleIntent,resumeProfile,onProgress,onPartial:show});
 visible=detail.matches;
 const searchAttempts=search.diagnostic.queries+additionalQueries;
 const searchSuccesses=search.diagnostic.successful_searches+additionalSuccesses;
 const fetchAttempts=enriched.fetch_attempts+additionalFetchAttempts;
 const fetchSuccesses=enriched.fetches+additionalFetches;
 return {matches:visible,profile:resumeProfile,incomplete:visible.length<limit||detail.detail_failures>0,diagnostic:{
  model:'deepseek-v4-pro',searches:searchSuccesses,
  page_reads:fetchSuccesses,
  search_attempts:searchAttempts,fetch_attempts:fetchAttempts,
  max_search_requests:DEEP_SEARCH_BUDGET.searchRequests,
  max_fetch_requests:DEEP_SEARCH_BUDGET.fetchRequests,
  estimated_tool_cost_cny:Number(((searchSuccesses+fetchSuccesses)*
   DEEP_SEARCH_BUDGET.toolPriceCny).toFixed(3)),
  tool_cost_ceiling_cny:Number(((DEEP_SEARCH_BUDGET.searchRequests+
   DEEP_SEARCH_BUDGET.fetchRequests)*DEEP_SEARCH_BUDGET.toolPriceCny).toFixed(3)),
  provider_items:search.diagnostic.raw_results,
  visible_jobs:visible.length,
  discarded:Math.max(0,search.diagnostic.candidate_links-visible.length),
  elapsed_ms:Date.now()-start,search_ms:search.diagnostic.search_ms,
  fetch_ms:enriched.fetch_ms,model_ms:firstModelMs+secondModelMs+detail.detail_ms,
  candidate_links:search.diagnostic.candidate_links,excluded_closed:enriched.excluded_closed,
  checked_pages:fetchSuccesses,mode:'deep-search-staged',
  primary_raw_hits:search.diagnostic.raw_results,
  primary_filtered_links:search.diagnostic.rejected_links,
  primary_candidates:search.diagnostic.candidate_links,
  initial_eligible:enriched.hits.length,
  initial_closed:enriched.excluded_closed,
  third_party_results_shown:0,
  initial_model_rows:firstRows,initial_visible:first.matches.length,
    supplement_queries:additionalQueries,supplement_search_ms:supplementSearchMs,
  supplement_failed:supplementalFailed,supplement_found:additionalCandidates,
  supplement_filtered_links:additionalFiltered,supplement_model_rows:secondRows,
  final_shortlisted:visible.length,details_expanded:detail.expanded,
  details_failed_batches:detail.detail_failures,detail_ms:detail.detail_ms,
  source_before:beforeSource,source_after:sourceCounts(visible),
  employer_lookups:prefer.lookups,employer_replacements:prefer.replaced,employer_lookup_ms:prefer.lookup_ms
 }};
}
