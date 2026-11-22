// HHBA Search-first job matching. No employer ATS API, no web search inside the model.
// 1) DeepSeek Search returns specific public job URLs
// 2) optional DeepSeek Fetch enriches weak snippets
// 3) DeepSeek V4 Pro selects/justifies linked candidates, never invents links.
import {safeJobDetailLink,decodeSearchText} from './deepseek-native-match.js';
import {isMainlandJobLocation,findMainlandCity} from './mainland-job-location.js';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from './match-job-quality.js';
import {supplementalQueries,mergeCandidateHits,combineRecommended} from './match-search-growth.js';
import {planAutonomousMainlandSearch,normalizeAutonomousQueries} from './autonomous-mainland-search.js';
import {recruitmentSourceKind,isEmployerDirectedSource,isMainlandEmployerJobUrl,sourceDisplay,sortEmployerFirst,employerLookupQuery,corroboratesEmployerPosting,sourceCounts,isDirectEmployerSourceHit} from './match-employer-source.js';

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
 return uniq.map(x=>(x+' 招聘 职位 工作地点 中国大陆 企业官网 官方招聘').slice(0,128));
}
export function normalizeHits(searchResponses,max=28){
 const byUrl=new Map();
 for(const result of searchResponses){
  for(const hit of result?.results||[]){
   const url=safeJobDetailLink(hit?.url);
   if(!url||!isMainlandEmployerJobUrl(url))continue;
   const title=clean(hit?.title,160),summary=clean(hit?.summary||hit?.snippet,900);
   const snippet=clean(hit?.snippet,300);
   if(!title||!roleEvidence.test(title+' '+summary+' '+url))continue;
   if(foreign.test(title)&&!/(?:中国|上海|北京|深圳|广州|成都|杭州)/.test(title))continue;
   const key=url.replace(/[?&](?:utm_[^=&]+|from|source)=[^&]*/gi,'').replace(/[?&]$/,'');
   const prev=byUrl.get(key);
   const row={id:'j'+(byUrl.size+1),title,url,summary,snippet,
    source:clean(hit?.site_name||hit?.source,80),date:hit?.date||null,content:'',
    recruitment_source_kind:recruitmentSourceKind(url),
    availability:classifyJobAvailability({summary,snippet})};
   if(!isDirectEmployerSourceHit(row))continue;
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
// A single upstream timeout or 5xx must not erase an otherwise useful
// search direction. Retry only transient failures within the ORIGINAL
// per-query time window; never retry invalid requests, rate limits or auth.
const RETRYABLE_SEARCH_ERRORS=new Set([
 'AI_SEARCH_TIMEOUT','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_UNAVAILABLE'
]);
export async function searchPublicJobs(key,text,roleHint,{
 fetcher=fetch,signal=null,onProgress=()=>{},queryTimeoutMs=14000,
 queriesOverride=null,maxHits=28,allowEmpty=false
}={}){
 const start=Date.now(),queries=queriesOverride||searchQueries(text,roleHint),errors=[];
 let retryAttempts=0,retryRecovered=0;
 onProgress('searching');
 const responses=await Promise.all(queries.map(async query=>{
  const queryStart=Date.now(),payload={query,count:20,need_content:false};
  const call=async timeout=>{
   const data=await providerJson(fetcher,key,'/v1/tools/search',payload,timeout,signal);
   if(!Array.isArray(data?.results))throw codeError('AI_SEARCH_RESPONSE_INVALID');
   return data;
  };
  try{
   // Leave a small recovery window when the first call consumes its timeout.
   const first=queryTimeoutMs>=6500?Math.floor(queryTimeoutMs*.70):queryTimeoutMs;
   try{return await call(first)}
   catch(error){
    const remaining=queryTimeoutMs-(Date.now()-queryStart);
    if(signal?.aborted||!RETRYABLE_SEARCH_ERRORS.has(error?.code)||remaining<2200)throw error;
    retryAttempts++;
    const response=await call(remaining);
    retryRecovered++;
    return response;
   }
  }catch(e){errors.push(e.code||'AI_PROVIDER_UNAVAILABLE');return {results:[]};}
 }));
 const hits=normalizeHits(responses,maxHits);
 // The Agent may use rejected THIRD-PARTY job titles only as research clues:
 // find the named employer's OWN hiring page, never use the original URL.
 // No raw snippets, phone numbers, or CV text cross this boundary.
 const rejected_title_hints=[...new Set(responses.flatMap(r=>r.results||[])
  .filter(h=>!isDirectEmployerSourceHit({url:h?.url,source:h?.site_name||h?.source}))
  .map(h=>clean(h?.title,90))
  .filter(t=>t.length>=4&&t.length<=90))].slice(0,8);
 const fatal=['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
  'AI_PROVIDER_RATE_LIMITED','AI_SEARCH_API_REJECTED']
  .find(code=>errors.includes(code));
 // A healthy empty Search result must not hide parallel API auth/quota failure.
 if(!hits.length&&(fatal||!allowEmpty||errors.length===queries.length))
  throw codeError(fatal||(errors.length===queries.length?'AI_SEARCH_UNAVAILABLE':'AI_SEARCH_NO_DETAIL_JOBS'));
 return {hits,diagnostic:{search_ms:Date.now()-start,queries:queries.length,
  successful_searches:queries.length-errors.length,raw_results:responses.reduce((a,x)=>a+x.results.length,0),
  candidate_links:hits.length,search_failures:errors.length,
  provider_error_codes:[...new Set(errors)].slice(0,6),
  retry_attempts:retryAttempts,retry_recovered:retryRecovered,
  rejected_links:responses.reduce((a,x)=>a+x.results.length,0)-hits.length,
  rejected_title_hints}};
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
   const raw=typeof d?.content==='string'?d.content.slice(0,80000):'';
   const siteCity=structuredPostingWorkCity(hit,raw);
   // Preserve explicit work-city evidence near the front of the bounded excerpt.
   // Employer pages often put Location/Site after the entire job description.
   const content=clean((siteCity?'工作地点：'+siteCity+'。 ':'')+raw,2600);
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
 return {hits:eligible,closed_hits:checked.filter(hit=>hit.availability?.status==='CLOSED_LISTED'),
  fetches:success,fetch_ms:Date.now()-start,
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
/**
 * Only use a work city from Search text if the employer's indexed excerpt
 * explicitly labels it as the work location. Never infer the user's city
 * or reinterpret a company HQ as the posting's job location.
 */
// Accept only employer-shaped, specific vacancy pages, not catalogue or search pages.
function singlePostingDetail(hit){
 if(!isDirectEmployerSourceHit(hit))return false;
 const path=new URL(hit.url).pathname;
 return /\/(?:job|jobs|position|positions|job-detail)\/(?:details\/)?(?=[a-z\d-]*\d)[a-z\d-]+(?:\/|$)/i.test(path);
}

function englishPostingDetails(hit,raw=hit?.content){
 if(!singlePostingDetail(hit))return null;
 // Explicit employer title template: the location field, not a territory
 // embedded in the role name, is the structured location. Require country.
 const title=String(hit.title||'').match(/^(.{2,100}?)\s+job in\s+([^,|]{2,40}),\s*(?:([^,|]{2,40}),\s*)?China\s*\|\s*[^|]{0,70}jobs?\s+at\s+[^|]{2,60}$/i);
 const body=String(raw||'');
 const field=(label)=>body.match(new RegExp('(?:^|\\n)\\s*(?:#{1,6}\\s*|\\*\\*)?'+label+'(?:\\*\\*)?[ \\t]*(?::[ \\t]*|(?:\\r?\\n[ \\t]*)+)([^\\r\\n]{2,90})(?=\\r?\\n|$)','i'))?.[1].trim()||'';
 const location=field('(?:Work Location|Job Location|Location)');
 const site=field('Site');
 const mainlandCountry=/^(?:China|中国|中国大陆|Mainland China)$/i;
 const locationParts=location.split(/\s*[,，]\s*/);
 const mainlandRegion=/^(?:Anhui|Beijing|Chongqing|Fujian|Gansu|Guangdong|Guangxi|Guizhou|Hainan|Hebei|Heilongjiang|Henan|Hubei|Hunan|Inner Mongolia|Jiangsu|Jiangxi|Jilin|Liaoning|Ningxia|Qinghai|Shaanxi|Shandong|Shanghai|Shanxi|Sichuan|Tianjin|Tibet|Xinjiang|Yunnan|Zhejiang|(?:安徽|福建|甘肃|广东|广西|贵州|海南|河北|黑龙江|河南|湖北|湖南|内蒙古|江苏|江西|吉林|辽宁|宁夏|青海|陕西|山东|山西|四川|西藏|新疆|云南|浙江)(?:省|自治区)?)$/i;
 const explicitCountry=mainlandCountry.test(locationParts.at(-1)||'')&&
  locationParts.length<=3&&(locationParts.length!==3||mainlandRegion.test(locationParts[1]));
 if(title?.[3]&&!mainlandRegion.test(title[3].trim()))return null;
 const city=explicitCountry?(locationParts.length>1?locationParts[0]:site):
  (!location&&title?title[2].trim():'');
 if(!city||!isMainlandJobLocation(city))return null;
 // A contradiction between the page's direct location field and title is
 // not enough evidence to show either city as a verified recommendation.
 if(title&&findMainlandCity(title[2])!==findMainlandCity(city))return null;
 return {city,title:title?.[1].trim()||''};
}

function structuredPostingWorkCity(hit,raw=hit?.content){
 if(!singlePostingDetail(hit))return null;
 const city=String(raw||'').match(/(?:^|\r?\n)[ \t]*(?:#{1,6}[ \t]*|\*\*)?(?:所在地|工作地点|工作城市|办公地点|岗位地点)(?:\*\*)?[ \t]*(?:[：:][ \t]*|(?:\r?\n[ \t]*)+)([^\r\n，。；;]{2,48})(?=\r?\n|[，。；;]|$)/)?.[1]?.trim();
 return city&&isMainlandJobLocation(city)?city:englishPostingDetails(hit,raw)?.city||null;
}

export function indexedJobWorkCity(hit){
 const body=[hit?.summary,hit?.snippet,hit?.content].filter(Boolean).join(' ');
 const match=body.match(/(?:工作地点|工作城市|办公地点|办公城市|岗位地点|岗位城市)[：:\s]{0,4}([^，。；;\n]{2,40})/i);
 if(!match)return structuredPostingWorkCity(hit);
 const candidate=String(match[1]).split(/(?:\s{2,}|要求|待遇|学历|职责|任职|岗位|职位|部门|工作经验|更新时间|招聘人数)/)[0].trim();
 return isMainlandJobLocation(candidate)?candidate:
  (findMainlandCity(candidate)&&!/(?:香港|澳门|台湾|海外|境外|国外)/.test(candidate)?
   findMainlandCity(candidate):null);
}
export function selectedJobs(text,hits,limit=10){
 const byId=new Map(hits.map(h=>[h.id,h])),found=[],seen=new Set();
 for(const row of closedRows(text)){
  const evidence=byId.get(String(row?.id||row?.candidate_id||''));
  if(!evidence)continue;
  const reportedLocation=clean(row.location,140);
  const location=isMainlandJobLocation(reportedLocation)?reportedLocation:
   indexedJobWorkCity(evidence)||'';
  const reason=clean(row.reason,1400),
   title=clean(row.title,110),company=clean(row.company,100);
  if(!isMainlandJobLocation(location)||!reason||!company||!title||foreign.test(title))continue;
  if(!isRecommendationEligible(evidence)||evidence.content&&
   !isRecommendationEligible({...evidence,availability:classifyJobAvailability(
    {content:evidence.content},{fetched:true})}))continue;
  // Defense in depth: never let model output or an alternate code path leak a job-board link.
  const verifiedKind=recruitmentSourceKind(evidence.url);
  if(!isDirectEmployerSourceHit(evidence))continue;
  const signature=(company+'|'+title).toLowerCase().replace(/\s/g,'');
  if(seen.has(signature)||seen.has(evidence.url))continue;
  seen.add(signature);seen.add(evidence.url);
  const url=evidence.url; // CRITICAL: source URL comes from Search, NEVER model text.
  // Keep the AI's reported numeric reference score when there is real
  // candidate-to-role evidence in its explanation. Shortlist mode sometimes
  // omits score_basis even while returning a sufficiently specific reason.
  // Never create a numeric score if the model gave none.
  const primaryBasis=clean(row.score_basis,240);
  const fallbackBasis=reason.length>=45&&/(简历|经历|工作经验|负责|技能|曾经|曾在)/.test(reason)?
   reason.slice(0,220):'';
  const scoreBasis=primaryBasis.length>=14?primaryBasis:fallbackBasis;
  const match_score=normalizeMatchScore(row.match_score??row.score,scoreBasis);
  const recruitment_source_kind=recruitmentSourceKind(url);
  found.push({id:'search-'+evidence.id,company,title,title_zh:title,location,
   recruitment_source_kind,recruitment_source_note:sourceDisplay(recruitment_source_kind),
   match_score,score_basis:match_score===null?'':scoreBasis,
   availability_status:evidence.availability?.status||'UNKNOWN',
   availability_note:evidence.availability?.evidence||'投递状态待确认',
   availability_checked_at:evidence.availability?.checked_at||null,
   official_url:url,platform:'deepseek-search',source:new URL(url).hostname,
   source_type:'站外招聘职位',source_status:'MODEL_SEARCH_REPORTED',
   application_status:'NEEDS_OFFICIAL_CONFIRMATION',remote:false,reference_score:match_score??0,
   matched:[reason],recommendation_reason:reason,not_evidenced:[],
   needs_verification:['根据岗位原始网页核对最新招聘状态与硬性任职条件。'],
   requirements_basis:clean(row.job_basis||evidence.summary,220),
   // Actual independently retrieved source evidence, NOT the model-generated JD summary.
   research_anchor:{url:evidence.url,title:evidence.title,site_name:evidence.source,
    summary:clean(evidence.summary,700),snippet:clean(evidence.snippet,250),
    content:clean(evidence.content,800)},
   evidence_status:'RESEARCH_PENDING',
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
/**
 * A shortlist model can produce zero valid jobs despite a nonempty, linked
 * Search result. One bounded repair pass asks for only source-backed city,
 * company, title and reason; the normal selectedJobs validator is reused.
 */
export async function recoverSearchGroundedShortlist(key,resume,hits,limit,{
 fetcher=fetch,signal=null,recoveryTimeoutMs=28000
}={}){
 if(!hits.length)return [];
 const timeout=AbortSignal.timeout(recoveryTimeoutMs);
 const merged=signal?AbortSignal.any([signal,timeout]):timeout;
 const input=hits.slice(0,20).map(hit=>({
  id:hit.id,original_title:hit.title,source_site:hit.source,
  original_excerpt:String(hit.content||hit.summary||hit.snippet||'').slice(0,850),
  explicit_work_city:indexedJobWorkCity(hit)
 }));
 try{
  const response=await fetcher(BASE+'/responses',{
   method:'POST',redirect:'manual',signal:merged,
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'high'},
    text:{format:{type:'json_object'}},max_output_tokens:9500,stream:false,
    instructions:[
     '你是中国大陆招聘公开岗位信息校对员。上轮岗位初选未返回有效列表，请根据下面已有的具体职位网页摘要再次识别。',
     '只输出实际给出的候选id。公司名、岗位名、地点必须有网页摘要证据；尤其工作城市必须是职位工作城市，不可把企业总部所在地当作工作地点。',
     '如果明确的职位地点和公司名称没有公开证据，不要选择该条。允许只返回1个真实岗位；不要为了凑数虚构职位。',
     '简历依据必须来自给定的脱敏简历。理由50-120字，承认不确定的要求，不承诺录用。',
     '返回JSON：{"jobs":[{"id":"候选id","company":"原网页中的企业","title":"原网页中的岗位","location":"有证据的大陆工作城市","reason":"来自简历的具体岗位方向分析","match_score":null,"score_basis":"","job_basis":""}]}'
    ].join('\n'),
    input:'脱敏简历：\n'+String(resume||'').slice(0,6500)+'\n可核对的企业招聘网页候选：\n'+JSON.stringify(input)})
  });
  if(!response.ok)return [];
  const data=await response.json();
  const raw=outputFromResponse(data);
  const selected=selectedJobs(raw,hits,limit);
  // In repair mode, require independent Search text to corroborate the
  // company's name and actual role. A response id alone proves nothing.
  return selected.filter(job=>{
   const source=hits.find(hit=>hit.url===job.official_url);
   return source&&corroboratesEmployerPosting(job,source);
  });
 }catch{return []}
}

/**
 * Search-source-only recovery for a shortlist model timeout.
 * IMPORTANT: these are NOT scored matches. A preview is allowed only when
 * company, specific role and explicit mainland work city are independently
 * visible in the Search item, and the URL is an employer-source candidate.
 * Domestic evidence scoring must still examine the public source separately.
 */
export function sourceOnlyJobPreviews(hits,limit=10){
 const out=[],urls=new Set();
 for(const hit of hits){
  if(out.length>=limit)break;
  if(!isDirectEmployerSourceHit(hit)||!isRecommendationEligible(hit)||urls.has(hit.url))continue;
  // Check the fetched text itself, not only potentially stale Search metadata.
  if(hit.content&&!isRecommendationEligible({...hit,availability:
   classifyJobAvailability({content:hit.content},{fetched:true})}))continue;
  const site=clean(hit.source,90);
  const company=site.replace(/,?\s+(?:incorporated|inc\.?|corporation|corp\.?|limited|ltd\.?)$/i,'').replace(/(?:官方招聘|招聘官网|招聘平台|招聘网站|人才招聘|招聘|官网|careers?|jobs?)$/gi,'')
   .replace(/(?:有限责任公司|股份有限公司|有限公司|公司)$/,'').trim();
  if(company.length<2||/(?:招聘网|求职网|人才市场|招聘平台|岗位合集)/.test(company))continue;
  const heading=clean(hit.title,150);
  const workCity=indexedJobWorkCity(hit);
  if(!workCity)continue;
  // Some *actual employer* search results have the generic HTML <title>
  // "职位详情"; the indexed description contains the REAL specific role.
  // Do not mistake a generic page title for proof that no role exists.
  const generic=/^(?:职位详情|岗位详情|招聘详情|职位信息|岗位信息|job details?|position details?)$/i.test(heading);
  const summary=clean(hit.summary||hit.snippet,280).replace(/^#+\s*/,'');
  let after=heading.includes(company)?
   heading.slice(heading.indexOf(company)+company.length):'';
  if(!after&&generic){
   const explicit=summary.match(/^(.{2,50}?)(?:社招|校招|社会招聘|校园招聘)(?:[\s\-—·]|$)/);
   if(explicit)after=explicit[1];
   if(!after){
    const labeled=summary.match(/(?:职位名称|岗位名称|招聘岗位|招聘职位)[：:\s]{0,3}([\u4e00-\u9fffA-Za-z0-9·+\-/ ]{2,42}?)(?=\s*(?:工作地点|工作城市|岗位职责|任职要求|招聘人数|学历|经验|，|。|；|$))/);
    if(labeled)after=labeled[1].trim();
   }
  }
  // Many employer job detail pages use just the position as <title>.
  // The source must explicitly label itself a company's recruitment site.
  if(!after&&!generic&&/(?:官方招聘|招聘官网|人才招聘|招聘|careers?|talent)/i.test(site))
   after=heading;
  // An employer brand plus a specific requisition and job-detail text can
  // corroborate a plain role title even when its brand lacks a "careers" suffix.
  const englishDetail=englishPostingDetails(hit);
  if(englishDetail?.title)after=englishDetail.title;
  if(!after&&!generic&&singlePostingDetail(hit)&&
   /(?:Job Description|About the Role|岗位职责|职位描述)/i.test(hit.content||'')&&
   /(?:\bjob id\b|\breq[- ]?\d+\b)/i.test(hit.content||''))
   after=heading;
  if(!after)continue;
  after=after.replace(/^(?:股份有限公司|有限责任公司|有限公司|集团公司|集团|公司)?[\s·|／/，,:：—–-]*/,'')
   .replace(/(?:202[4-9]\s*年?)|(?:社招|校招|社会招聘|校园招聘|公开招聘|岗位招聘|职位招聘|招聘职位|招聘岗位|立即申请|招聘)/g,' ')
   .replace(workCity,' ')
   .replace(/(?:[·|／/，,:：—–-]\s*)+(?:\d+)?$/,'').trim()
   .replace(/^[\s·|／/，,:：—–-]+|[\s·|／/，,:：—–-]+$/g,'').trim();
  const title=after.replace(/(?:岗位|职位)$/,'').trim();
  if(title.length<2||title.length>54||/^(?:岗位|职位|职位列表|招聘详情|点击查看)$/.test(title))continue;
  if(!corroboratesEmployerPosting({company,title,location:workCity},hit))continue;
  const reason='这条岗位信息来自真实公开招聘搜索结果，网页显示岗位为“'+title+
   '”，工作地点为'+workCity+'。本轮岗位个性化分析尚未得到足够的模型回复，暂不提供适配分；请查看原招聘页面核对职位职责、任职要求和是否仍开放申请。';
  urls.add(hit.url);
  out.push({
   id:'search-'+hit.id,company,title,title_zh:title,location:workCity,
   recruitment_source_kind:recruitmentSourceKind(hit.url),
   recruitment_source_note:sourceDisplay(recruitmentSourceKind(hit.url)),
   match_score:null,reference_score:0,score_basis:'',
   availability_status:hit.availability?.status||'UNKNOWN',
   availability_note:hit.availability?.evidence||'投递状态待确认',
   official_url:hit.url,platform:'deepseek-search',
   source:new URL(hit.url).hostname,source_type:'站外招聘职位',
   source_status:'SOURCE_SEARCH_PREVIEW',
   application_status:'NEEDS_OFFICIAL_CONFIRMATION',
   recommendation_reason:reason,matched:[reason],
   not_evidenced:[],needs_verification:['需核对岗位详情和个人任职条件。'],
   requirements_basis:clean(hit.summary||hit.snippet,220),
   evidence_status:'SEARCH_SNIPPET_ONLY',evidence_reason_status:'FALLBACK',
   research_anchor:{url:hit.url,title:hit.title,site_name:hit.source,
    summary:clean(hit.summary,700),snippet:clean(hit.snippet,250),
    content:clean(hit.content,800)},remote:false
  });
 }
 return out;
}

export async function reasonAboutJobs(key,resume,hits,limit,{
 fetcher=fetch,signal=null,onProgress=()=>{},onPartial=()=>{},modelTimeoutMs=37000,shortlistOnly=false
}={}){
 const start=Date.now();onProgress('writing');
 const cards=hits.slice(0,32).map(h=>({
  id:h.id,title:h.title,url:h.url,description:(h.content||h.summary||h.snippet).slice(0,800),
  explicit_work_city:indexedJobWorkCity(h),
  recruitment_source:h.recruitment_source_kind||recruitmentSourceKind(h.url),
  availability:h.availability?.status||'UNKNOWN',
  availability_note:h.availability?.evidence||'投递状态待确认'
 }));
 const instructions=[
  '你是 HHBA 求职匹配助手。你只能从提供的真实网页搜索候选中推荐职位，绝不能添加新的网页、编造候选 ID。',
  '严格禁止推荐第三方招聘平台，例如BOSS直聘、智联招聘、前程无忧、猎聘、拉勾等；这些即使匹配分很高也不能作为兜底。只能使用企业自有招聘站具体岗位页或企业专属招聘系统候选职位页；企业来源没有证据时不能冒充已核验官方职位。',
  '认真阅读脱敏简历和每条候选职位的摘要。选择实际工作城市位于中国大陆且能合理匹配的最多'+limit+'条不同企业、不同岗位。',
  '若搜索结果没有明确工作地点或职位内容，只能不选该条。不要猜城市、公司或岗位硬性要求；不可虚构学历或经历。',
  '优先选择网页有明确招聘开放证据的岗位；UNKNOWN不能写成可投递，CLOSED_LISTED和POSSIBLY_CLOSED不得推荐。尽可能返回十个真实职位，不为凑数捏造。',
  '为每条岗位给出0～100整数的「简历适配分」match_score，依据已有简历和招聘内容评估岗位方向、工作经验、技能与城市偏好，不代表录用概率。分数需有独立的score_basis（至少30字）解释具体加分与不足；证据不充分时match_score填null、score_basis为空。',
  shortlistOnly?'先快速生成岗位名单。每个候选先完整输出 match_score 与独立 score_basis（至少30字，写出具体简历依据和职位要求），不得省略；无法判断则明确写 null。理由只需简洁但必须具体，详细分析由下一阶段继续完成；不要为固定字数牺牲重要信息。请优先列满符合条件的候选。':'每个为什么推荐的理由写120～180字，结合简历的真实经历成果与职位内容、岗位职责映射、必要的差距提示；避免套话，不能保证录用。',
  '输出 JSON 对象，结构：{"jobs":[{"id":"候选id，如j1","company":"岗位原网页中企业","title":"岗位","location":"中国大陆实际工作城市","match_score":85,"score_basis":"岗位与简历实际技能或职责吻合的证据，至少25字","reason":"初步推荐理由，后续补充详细说明","job_basis":"网页明确的岗位职责要点","salary":""}]}。',
  '优先把最有把握的一条完整对象尽早输出，后续逐条补齐。不得在JSON以外输出文字。'
 ].join('\n');
 const payload={
  model:'deepseek-v4-pro',reasoning:{effort:'high'},
  text:{format:{type:'json_object'}},max_output_tokens:shortlistOnly?12000:16000,stream:true,
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
 fetcher=fetch,signal=null,onPartial=()=>{},onProgress=()=>{},detailTimeoutMs=52000
}={}){
 if(!matches.length)return {matches,expanded:0,detail_ms:0,detail_failures:0};
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
   '对每条候选独立撰写充分、具体且可核对的推荐理由：简历中的真实相关经历和成果、与此职位明确职责的对应、可能的经验差距、投递建议。不要限制在固定字数内，信息多时可以写得更详细。',
   '不要输出URL、额外岗位或成功率预测。没有具体职责证据时明确说明不确定。输出JSON：{"jobs":[{"id":"原有id","reason":"具体理由"}]}。'
  ].join('\n');
  try{
   const timeout=AbortSignal.timeout(detailTimeoutMs);
   const combined=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await fetcher(BASE+'/responses',{method:'POST',redirect:'manual',signal:combined,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'max'},
     text:{format:{type:'json_object'}},max_output_tokens:18000,stream:false,
     instructions:prompt,input:'脱敏简历：\n'+String(resume).slice(0,7000)+
      '\n已选真实岗位：\n'+JSON.stringify(description)})
   });
   if(!response.ok)throw codeError('AI_MATCH_REASON_UNAVAILABLE');
   const data=await response.json(),raw=outputFromResponse(data);
   let source;
   try{source=JSON.parse(raw)}catch{source={jobs:closedRows(raw)}}
   const updates=new Map((source?.jobs||[]).filter(v=>v&&typeof v.id==='string'&&typeof v.reason==='string')
    .map(v=>[v.id,clean(v.reason,1400)]));
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
 const search=await searchPublicJobs(key,resume,roleHint,{...opts,allowEmpty:true});
 const enriched=await enrichCandidateDetails(key,search.hits,opts);
 let pool=enriched.hits;
 let visible=[],firstModelMs=0,secondModelMs=0,firstRows=0,secondRows=0;
 let additionalQueries=0,additionalCandidates=0,additionalFiltered=0,additionalFetches=0;
 let supplementalFailed=0,supplementSearchMs=0;

 const show=jobs=>{visible=jobs;onPartial(jobs);};
 // Short first pass: return the ranked shortlist, scoring and brief explanations
 // before any further search or the full prose pass.
 // A model output with zero eligible rows must NOT abort the entire search.
 // Continue with the independent source-grounded recovery + supplemental Search.
 let first={matches:[],model_ms:0,provider_rows:0};
 if(pool.length){
  try{
   first=await reasonAboutJobs(key,resume,pool,limit,{
    ...opts,shortlistOnly:true,modelTimeoutMs:opts.modelTimeoutMs??44000,
    onProgress,onPartial:show
   });
  }catch(error){
   if(error?.code!=='AI_MATCH_NO_VALID_JOBS')throw error;
   console.warn('HHBA_MATCH_SHORTLIST_EMPTY',JSON.stringify({
    candidates:pool.length,phase:'first-pass',recovery:'started'
   }));
   onProgress('writing');
   const recovered=await recoverSearchGroundedShortlist(key,resume,pool,limit,opts);
   first={matches:recovered,model_ms:0,provider_rows:0};
  }
 }
 firstModelMs=first.model_ms;firstRows=first.provider_rows;
 visible=combineRecommended(visible,first.matches,limit);
 if(visible.length)show(visible);
 // The model, not a fixed hand-written industry/role table, chooses the
 // next search directions. Static queries are a fallback only. The output
 // card limit (user's requested result count) does NOT cap AI exploration.
 let agentQueries=0,agentPlanningStatus='not_needed';
 if(visible.length<limit&&opts.supplementalLimit!==0){
  const used=searchQueries(resume,roleHint);
  let autonomous=[];
  if(opts.autonomousPlanning!==false){
   onProgress('planning');
   try{
    const plan=await planAutonomousMainlandSearch(key,resume,roleHint,opts);
    autonomous=normalizeAutonomousQueries(plan.queries,used);
    agentQueries=autonomous.length;
    agentPlanningStatus=autonomous.length?'completed':'no_queries';
   }catch(error){
    agentPlanningStatus='provider_unavailable';
    console.warn('HHBA_AGENT_SEARCH_PLAN_UNAVAILABLE',String(error?.message||'UNKNOWN').slice(0,60));
   }
  }else agentPlanningStatus='disabled_by_test_or_option';
  const fallback=supplementalQueries(resume,roleHint,used);
  const queries=normalizeAutonomousQueries([...autonomous,...fallback],used)
   .slice(0,Number.isInteger(opts.supplementalLimit)?opts.supplementalLimit:undefined);
  if(queries.length){
   additionalQueries=queries.length;
   try{
    const supplemental=await searchPublicJobs(key,resume,roleHint,{
     ...opts,queriesOverride:queries,maxHits:Math.max(28,queries.length*7),allowEmpty:true,queryTimeoutMs:opts.supplementalTimeoutMs??11000
    });
    supplementSearchMs=supplemental.diagnostic.search_ms;
    additionalCandidates=supplemental.hits.length;
    additionalFiltered=supplemental.diagnostic.rejected_links;
    const earlier=new Set(pool.map(h=>h.url));
    const combined=mergeCandidateHits(pool,supplemental.hits,Math.max(48,queries.length*7));
    const fresh=combined.filter(h=>!earlier.has(h.url));
    // Only four extra Fetch calls, all parallel. Keep the initial searchable list.
    const checked=await enrichCandidateDetails(key,fresh,{...opts,maxFetch:4,fetchTimeoutMs:2400});
    additionalFetches=checked.fetches;pool=mergeCandidateHits(pool,checked.hits,Math.max(48,queries.length*7));
    const unselected=pool.filter(h=>!visible.some(j=>j.official_url===h.url));
    if(unselected.length){
     let extra;
     try{
      extra=await reasonAboutJobs(key,resume,unselected,limit-visible.length,{
       ...opts,shortlistOnly:true,modelTimeoutMs:opts.supplementalModelTimeoutMs??42000,
       onProgress,onPartial:jobs=>show(combineRecommended(visible,jobs,limit))
      });
     }catch(error){
      if(error?.code!=='AI_MATCH_NO_VALID_JOBS')throw error;
      const recovered=await recoverSearchGroundedShortlist(key,resume,
       unselected,limit-visible.length,opts);
      extra={matches:recovered,model_ms:0,provider_rows:0};
     }
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
 visible=visible.filter(j=>isMainlandEmployerJobUrl(j.official_url));
 const beforeSource=sourceCounts(visible);
 const prefer={matches:visible,hits:pool,lookups:0,replaced:0,lookup_ms:0};
 if(!visible.length){
  console.warn('HHBA_MATCH_ALL_SHORTLISTS_EMPTY',JSON.stringify({
   candidate_links:pool.length,primary_candidates:search.diagnostic.candidate_links,
   primary_filtered:search.diagnostic.rejected_links,
   supplement_candidates:additionalCandidates
  }));
  throw codeError('AI_EMPLOYER_JOBS_NOT_FOUND');
 }
 const detail=opts.expandDetailed===false?{matches:visible,expanded:0,detail_ms:0,detail_failures:0}:
  await expandDetailedReasons(key,resume,visible,pool,{...opts,onProgress,onPartial:show});
 visible=detail.matches;
 return {matches:visible,incomplete:visible.length<limit||detail.detail_failures>0,diagnostic:{
  model:'deepseek-v4-pro',searches:search.diagnostic.successful_searches+additionalQueries,
  page_reads:enriched.fetches+additionalFetches,
  provider_items:search.diagnostic.raw_results,
  visible_jobs:visible.length,
  discarded:Math.max(0,search.diagnostic.candidate_links-visible.length),
  elapsed_ms:Date.now()-start,search_ms:search.diagnostic.search_ms,
  fetch_ms:enriched.fetch_ms,model_ms:firstModelMs+secondModelMs+detail.detail_ms,
  candidate_links:search.diagnostic.candidate_links,excluded_closed:enriched.excluded_closed,
  checked_pages:enriched.fetches+additionalFetches,mode:'search-first-staged',
  primary_raw_hits:search.diagnostic.raw_results,
  primary_filtered_links:search.diagnostic.rejected_links,
  primary_candidates:search.diagnostic.candidate_links,
  initial_eligible:enriched.hits.length,
  initial_closed:enriched.excluded_closed,
  third_party_results_shown:0,
  initial_model_rows:firstRows,initial_visible:first.matches.length,
  supplement_queries:additionalQueries,agent_planned_queries:agentQueries,
  agent_planning_status:agentPlanningStatus,supplement_search_ms:supplementSearchMs,
  supplement_failed:supplementalFailed,supplement_found:additionalCandidates,
  supplement_filtered_links:additionalFiltered,supplement_model_rows:secondRows,
  final_shortlisted:visible.length,details_expanded:detail.expanded,
  details_failed_batches:detail.detail_failures,detail_ms:detail.detail_ms,
  source_before:beforeSource,source_after:sourceCounts(visible),
  employer_lookups:prefer.lookups,employer_replacements:prefer.replaced,employer_lookup_ms:prefer.lookup_ms
 }};
}
