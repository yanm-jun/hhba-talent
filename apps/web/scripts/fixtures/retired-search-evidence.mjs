// Historical pure search evidence fixtures; no provider transport, not used by V4.
import {safeJobDetailLink,decodeSearchText} from './retired-native-parser.mjs';
import {isMainlandJobLocation,findMainlandCity} from '../../functions/_lib/mainland-job-location.js';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from '../../functions/_lib/match-job-quality.js';
import {supplementalQueries,mergeCandidateHits,combineRecommended} from '../../functions/_lib/match-search-growth.js';
import {recruitmentSourceKind,isEmployerDirectedSource,isMainlandEmployerJobUrl,sourceDisplay,sortEmployerFirst,employerLookupQuery,corroboratesEmployerPosting,sourceCounts,isDirectEmployerSourceHit} from '../../functions/_lib/match-employer-source.js';

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
 const u=new URL(hit.url),path=u.pathname;
 if(/\/(?:search|list|index|job-?list|position-?list|jobs|positions)(?:\.html?)?\/?$/i.test(path)&&
  ![...u.searchParams.keys()].some(k=>/(?:post.?id|job.?id|position.?id)/i.test(k)))return false;
 const specificPath=/\/(?:job|jobs|position|positions|job-detail)\/(?:details\/)?[a-z\d-]{3,}(?:\/|$)/i.test(path)&&
  !/\/(?:search|list|index|all-jobs)(?:\/|$)/i.test(path);
 const idQuery=[...u.searchParams.entries()].some(([k,v])=>
  /^(?:post.?id|job.?id|position.?id|jobunionid|requisitionid)$/i.test(k)&&v.length>=4);
 const detailPage=/(?:^|\/)(?:jobdesc|jobdetail|job-detail|positiondetail|position-detail|jobdetails|position-details|detail)(?:\.html?)?\/?$/i.test(path);
 return specificPath||(idQuery&&detailPage);
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
 const city=String(raw||'').match(/(?:^|\r?\n)[ \t]*(?:#{1,6}[ \t]*|\*\*)?(?:所在地|工作地点|工作城市|工作地址|办公地点|岗位地点|职位地点|Work Location|Job Location)(?:\*\*)?[ \t]*(?:[：:][ \t]*|(?:\r?\n[ \t]*)+)([^\r\n，。；;]{2,48})(?=\r?\n|[，。；;]|$)/i)?.[1]?.trim();
 return city&&isMainlandJobLocation(city)?city:englishPostingDetails(hit,raw)?.city||null;
}

export function indexedJobWorkCity(hit){
 const body=[hit?.summary,hit?.snippet,hit?.content].filter(Boolean).join(' ');
 const match=body.match(/(?:工作地点|工作城市|工作地址|办公地点|办公城市|岗位地点|岗位城市|职位地点)[：:\s]{0,4}([^，。；;\n]{2,40})/i);
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
  const content=clean(hit.content||'',2500);
  const employerLabel=content.match(/(?:招聘单位|用人单位|公司名称|企业名称)[：:\s]{0,3}([\u4e00-\u9fffA-Za-z0-9·（）()&]{2,55}?)(?=\s*(?:工作地点|工作地址|岗位名称|职位名称|岗位职责|任职要求|\s{2}|[，。；;]|$))/)?.[1]?.trim()||'';
  // A source's branded site name is helpful, but a generic "职位详情"
  // site label must not make a real JD with explicit "招聘单位" disappear.
  const siteCompany=site.replace(/,?\s+(?:incorporated|inc\.?|corporation|corp\.?|limited|ltd\.?)$/i,'')
   .replace(/(?:官方招聘|招聘官网|招聘平台|招聘网站|人才招聘|招聘|官网|careers?|jobs?)$/gi,'')
   .replace(/(?:有限责任公司|股份有限公司|有限公司|公司)$/,'').trim();
  const company=siteCompany.length>=2&&!/^(?:职位详情|岗位详情|岗位信息|职位信息|招聘信息|企业|中国|人才|官网)$/i.test(siteCompany)?
   siteCompany:employerLabel.replace(/(?:有限责任公司|股份有限公司|有限公司|公司)$/,'').trim();
  if(company.length<2||/(?:招聘网|求职网|人才市场|招聘平台|岗位合集)/.test(company))continue;
  const heading=clean(hit.title,150);
  const workCity=indexedJobWorkCity(hit);
  if(!workCity)continue;
  // Some *actual employer* search results have the generic HTML <title>
  // "职位详情"; the indexed description contains the REAL specific role.
  // Do not mistake a generic page title for proof that no role exists.
  const generic=/^(?:职位详情|岗位详情|招聘详情|职位信息|岗位信息|job details?|position details?)$/i.test(heading);
  const summary=clean(hit.summary||hit.snippet,280).replace(/^#+\s*/,'');
  const roleEvidence=clean([summary,hit.content].filter(Boolean).join(' '),2700);
  let after=heading.includes(company)?
   heading.slice(heading.indexOf(company)+company.length):'';
  if(!after&&generic){
   const explicit=summary.match(/^(.{2,50}?)(?:社招|校招|社会招聘|校园招聘)(?:[\s\-—·]|$)/);
   if(explicit)after=explicit[1];
   if(!after){
    const labeled=roleEvidence.match(/(?:职位名称|岗位名称|招聘岗位|招聘职位)[：:\s]{0,3}([\u4e00-\u9fffA-Za-z0-9·+\-/ ]{2,42}?)(?=\s*(?:工作地点|工作地址|工作城市|岗位职责|任职要求|招聘人数|学历|经验|，|。|；|$))/);
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

