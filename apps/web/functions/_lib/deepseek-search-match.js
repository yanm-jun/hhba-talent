// HHBA Search-first job matching. No employer ATS API, no web search inside the model.
// 1) DeepSeek Search returns specific public job URLs
// 2) optional DeepSeek Fetch enriches weak snippets
// 3) DeepSeek V4 Pro selects/justifies linked candidates, never invents links.
import {safeJobDetailLink,decodeSearchText} from './deepseek-native-match.js';
import {isMainlandJobLocation} from './mainland-job-location.js';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from './match-job-quality.js';

const BASE='https://api.deepseek.com';
const foreign=/(?:香港|澳门|澳門|台湾|臺灣|日本|东京|大阪|新加坡|美国|英国|越南|海外|境外|驻外|overseas|hong kong|tokyo|singapore|remote overseas)/i;
const roleEvidence=/(?:招聘|岗位|职位|校园招聘|社会招聘|社招|工作地点|岗位职责|任职要求|申请职位|立即申请|job|career|position|apply|vacancy)/i;
const clean=(s,max=1200)=>decodeSearchText(typeof s==='string'?s:'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const codeError=(code)=>Object.assign(new Error(code),{code});
export function searchQueries(resume,roleHint=''){
 const text=String(resume||'').slice(0,13000),hint=clean(roleHint,40).replace(/[|"'<>]/g,' ');
 const categories=[];
 if(hint)categories.push(hint);
 if(/(?:agent|rag|大模型|人工智能|AI产品|产品经理|智能体|工作流|prompt)/i.test(text))
  categories.push('AI产品经理 Agent 应用','大模型应用 产品运营');
 if(/(?:经销商|4S店|DCC|销售漏斗|区域督导|名爵|汽车销售|门店运营)/i.test(text))
  categories.push('汽车渠道运营 品牌督导','区域运营 销售管理');
 if(/(?:人才政策|招聘平台|用户增长|产品规划|需求分析|商业化|项目管理)/i.test(text))
  categories.push('互联网产品运营 项目运营');
 if(/(?:视觉设计|交互设计|UX|UI设计|数字导视|设计作品)/i.test(text))
  categories.push('用户体验设计 视觉设计');
 if(/(?:Python|SQL|数据分析|算法工程)/i.test(text))
  categories.push('数据分析 产品分析');
 if(!categories.length)categories.push('项目运营 产品助理','市场运营');
 const uniq=[...new Set(categories)].slice(0,4);
 return uniq.map(x=>(x+' 招聘 职位 工作地点 中国大陆').slice(0,128));
}
export function normalizeHits(searchResponses,max=28){
 const byUrl=new Map();
 for(const result of searchResponses){
  for(const hit of result?.results||[]){
   const url=safeJobDetailLink(hit?.url);
   if(!url)continue;
   const title=clean(hit?.title,160),summary=clean(hit?.summary||hit?.snippet,900);
   const snippet=clean(hit?.snippet,300);
   if(!title||!roleEvidence.test(title+' '+summary+' '+url))continue;
   if(foreign.test(title)&&!/(?:中国|上海|北京|深圳|广州|成都|杭州)/.test(title))continue;
   const key=url.replace(/[?&](?:utm_[^=&]+|from|source)=[^&]*/gi,'').replace(/[?&]$/,'');
   const prev=byUrl.get(key);
   const row={id:'j'+(byUrl.size+1),title,url,summary,snippet,
    source:clean(hit?.site_name,80),date:hit?.date||null,content:'',
    availability:classifyJobAvailability({summary,snippet})};
   if(!prev||summary.length>prev.summary.length)byUrl.set(key,{...row,id:prev?.id||row.id});
  }
 }
 return [...byUrl.values()].slice(0,max).map((item,i)=>({...item,id:'j'+(i+1)}));
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
 fetcher=fetch,signal=null,onProgress=()=>{},queryTimeoutMs=14000
}={}){
 const start=Date.now(),queries=searchQueries(text,roleHint),errors=[];
 onProgress('searching');
 const responses=await Promise.all(queries.map(async query=>{
  try{
   const data=await providerJson(fetcher,key,'/v1/tools/search',
    {query,count:20,need_content:false},queryTimeoutMs,signal);
   if(!Array.isArray(data?.results))throw codeError('AI_SEARCH_RESPONSE_INVALID');
   return data;
  }catch(e){errors.push(e.code||'AI_PROVIDER_UNAVAILABLE');return {results:[]};}
 }));
 const hits=normalizeHits(responses,28);
 if(!hits.length)throw codeError(errors.includes('AI_PROVIDER_KEY_REJECTED')?'AI_PROVIDER_KEY_REJECTED':
  errors.includes('AI_PROVIDER_BALANCE_INSUFFICIENT')?'AI_PROVIDER_BALANCE_INSUFFICIENT':
  errors.includes('AI_PROVIDER_RATE_LIMITED')?'AI_PROVIDER_RATE_LIMITED':
  errors.includes('AI_SEARCH_API_REJECTED')?'AI_SEARCH_API_REJECTED':
  errors.length===queries.length?'AI_SEARCH_UNAVAILABLE':'AI_SEARCH_NO_DETAIL_JOBS');
 return {hits,diagnostic:{search_ms:Date.now()-start,queries:queries.length,
  successful_searches:queries.length-errors.length,raw_results:responses.reduce((a,x)=>a+x.results.length,0),
  candidate_links:hits.length,search_failures:errors.length}};
}
export async function enrichCandidateDetails(key,hits,{
 fetcher=fetch,signal=null,onProgress=()=>{},maxFetch=8,fetchTimeoutMs=3200
}={}){
 // Eight bounded parallel Fetch calls. Prioritize any Search result explicitly
 // suggesting closure; then earliest candidates the model is most likely to rank.
 // Do not make unknown Search snippets appear "confirmed open".
 const suspicious=hits.filter(h=>h.availability?.status==='POSSIBLY_CLOSED');
 const short=hits.filter(h=>h.summary.length<130);
 const needs=[...new Set([...suspicious,...short,...hits].map(h=>h.id))]
  .map(id=>hits.find(h=>h.id===id)).filter(Boolean).slice(0,maxFetch);
 if(!needs.length)return {hits,fetches:0,fetch_ms:0,excluded_closed:0};
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
 return {hits:eligible,fetches:success,fetch_ms:Date.now()-start,
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
  const signature=(company+'|'+title).toLowerCase().replace(/\s/g,'');
  if(seen.has(signature)||seen.has(evidence.url))continue;
  seen.add(signature);seen.add(evidence.url);
  const url=evidence.url; // CRITICAL: source URL comes from Search, NEVER model text.
  const match_score=normalizeMatchScore(row.match_score??row.score,row.score_basis);
  found.push({id:'search-'+evidence.id,company,title,title_zh:title,location,
   match_score,score_basis:match_score===null?'':clean(row.score_basis,240),
   availability_status:evidence.availability?.status||'UNKNOWN',
   availability_note:evidence.availability?.evidence||'投递状态待确认',
   availability_checked_at:evidence.availability?.checked_at||null,
   official_url:url,platform:'deepseek-search',source:new URL(url).hostname,
   source_type:'站外官方招聘',source_status:'MODEL_SEARCH_REPORTED',
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
 fetcher=fetch,signal=null,onProgress=()=>{},onPartial=()=>{},modelTimeoutMs=37000
}={}){
 const start=Date.now();onProgress('writing');
 const cards=hits.slice(0,24).map(h=>({
  id:h.id,title:h.title,url:h.url,description:(h.content||h.summary||h.snippet).slice(0,800),
  availability:h.availability?.status||'UNKNOWN',
  availability_note:h.availability?.evidence||'投递状态待确认'
 }));
 const instructions=[
  '你是 HHBA 求职匹配助手。你只能从提供的真实网页搜索候选中推荐职位，绝不能添加新的网页、编造候选 ID。',
  '认真阅读脱敏简历和每条候选职位的摘要。选择实际工作城市位于中国大陆且能合理匹配的最多'+limit+'条不同企业、不同岗位。',
  '若搜索结果没有明确工作地点或职位内容，只能不选该条。不要猜城市、公司或岗位硬性要求；不可虚构学历或经历。',
  '优先选择网页有明确招聘开放证据的岗位；UNKNOWN不能写成可投递，CLOSED_LISTED和POSSIBLY_CLOSED不得推荐。尽可能返回十个真实职位，不为凑数捏造。',
  '为每条岗位给出0～100整数的「简历适配分」match_score，依据已有简历和招聘内容评估岗位方向、工作经验、技能与城市偏好，不代表录用概率。分数需有独立的score_basis（至少30字）解释具体加分与不足；证据不充分时match_score填null、score_basis为空。',
  '每个为什么推荐的理由写120～180字，结合简历的真实经历成果与职位内容、岗位职责映射、必要的差距提示；避免套话，不能保证录用。',
  '输出 JSON 对象，结构：{"jobs":[{"id":"候选id，如j1","company":"岗位原网页中企业","title":"岗位","location":"中国大陆实际工作城市","match_score":85,"score_basis":"根据真实经历和明确职位要求的简明评分解释","reason":"120-180字的真实解释","job_basis":"网页明确的岗位职责要点","salary":""}]}。',
  '优先把最有把握的一条完整对象尽早输出，后续逐条补齐。不得在JSON以外输出文字。'
 ].join('\n');
 const payload={
  model:'deepseek-v4-pro',reasoning:{effort:'none'},
  text:{format:{type:'json_object'}},max_output_tokens:5600,stream:true,
  instructions,
  input:'脱敏简历：\n'+String(resume).slice(0,10000)+'\n可选真实职位：\n'+JSON.stringify(cards)
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
 const matches=finalJobs.length?finalJobs:partial;
 if(!matches.length)throw codeError('AI_MATCH_NO_VALID_JOBS');
 return {matches,incomplete:final?.status!=='completed'||matches.length<limit,
  model_ms:Date.now()-start};
}
export async function runSearchFirstMatch(key,resume,roleHint,limit=10,opts={}){
 const start=Date.now(),onProgress=opts.onProgress||(()=>{}),onPartial=opts.onPartial||(()=>{});
 const search=await searchPublicJobs(key,resume,roleHint,opts);
 const enriched=await enrichCandidateDetails(key,search.hits,opts);
 const ranked=await reasonAboutJobs(key,resume,enriched.hits,limit,{...opts,onProgress,onPartial});
 return {matches:ranked.matches,incomplete:ranked.incomplete,
  diagnostic:{model:'deepseek-v4-pro',searches:search.diagnostic.successful_searches,
   page_reads:enriched.fetches,provider_items:search.diagnostic.raw_results,
   visible_jobs:ranked.matches.length,discarded:search.diagnostic.candidate_links-ranked.matches.length,
   elapsed_ms:Date.now()-start,search_ms:search.diagnostic.search_ms,
   fetch_ms:enriched.fetch_ms,model_ms:ranked.model_ms,
   candidate_links:search.diagnostic.candidate_links,
   excluded_closed:enriched.excluded_closed,checked_pages:enriched.fetches,mode:'search-first'}};
}
