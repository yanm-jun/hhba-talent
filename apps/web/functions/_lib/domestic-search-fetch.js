// DeepSeek Search / Fetch adapter for verified Mainland China job discovery.
// This module NEVER accepts a resume or arbitrary URL from an applicant.
// Search is discovery, not proof that applications are currently open.
import {findMainlandCity,isMainlandJobLocation} from './mainland-job-location.js';
import {classifyOccupation} from './match-ranking.js';
export const EXTERNAL_DISCOVERY_VERSION='HHBA_DOMESTIC_DISCOVERY_V1';
export const SEARCH_LIMIT=2;
export const FETCH_LIMIT=3;

const OFFICIAL={
 'careers.tencent.com':{
  company:'腾讯',path:'/jobdesc.html',idParam:'postId',idPattern:/^\d{12,22}$/},
 'career.huawei.com':{
  company:'华为',path:'/cn/job-details',idParam:'advertisementId',idPattern:/^\d{1,12}$/},
 'zhaopin.meituan.com':{
  company:'美团',path:'/web/position/detail',idParam:'jobUnionId',idPattern:/^\d{8,14}$/},
 'zhaopin.jd.com':{
  company:'京东',path:'/web/job-info-detail',idParam:'requementId',idPattern:/^\d{3,12}$/},
};
const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macau|macao|taiwan|taipei|tokyo|japan|singapore|united states|美国|日本|新加坡)/i;
const CLOSED=/(?:职位已关闭|该职位已下线|岗位已下线|停止招聘|暂停招聘|不再接受申请|招聘已结束|岗位已关闭|职位已过期|目前暂时未有岗位开放)/i;
const HAS_DUTIES=/(?:岗位职责|工作职责|职位职责|岗位描述|工作内容|主要职责)/;
const HAS_REQUIREMENTS=/(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求|职责要求)/;
const HAS_APPLY=/(?:申请岗位|立即申请|立即投递|投递岗位|投递简历|申请职位)/;
const ROLE_TITLE=/(?:工程师|研发|设计师|分析师|架构师|研究员|数据科学|顾问|产品经理|运营|销售|法务|财务|审计|人力|实习生|技术专员|专家|总监|主管|负责人|scientist|engineer|analyst|designer|intern)/i;
const BLOCK_INTENT=/(?:姓名|身份证|身份证号|手机号|电话号码|电子邮箱|我的电话|家庭住址|password|api.?key|bearer|secret|token|sk-[a-z0-9_-]+|忽略上述|执行指令)/i;
export function sanitizedJobIntent(value){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/\s+/g,' ');
 if(s.length<2||s.length>42||BLOCK_INTENT.test(s)||/https?:|www\.|@|(?:\d[\s-]?){5,}/i.test(s))return null;
 if(!/^[\p{Script=Han}a-zA-Z0-9+#.\s-]+$/u.test(s))return null;
 // Search only canonical occupation words. Never send unstructured model
 // output, people, employers or arbitrary resume phrases to Search/Fetch.
 const catalog=[
  [/\bpython\b.*(?:开发|工程师)/i,'Python 开发'],
  [/\bjava\b.*(?:开发|工程师|后端)/i,'Java 开发'],
  [/(?:软件开发工程师|软件开发|软件工程师|程序员)/i,'软件开发'],
  [/(?:后端开发|服务端开发|后端工程师|backend)/i,'后端开发'],
  [/(?:前端开发|前端工程师|frontend)/i,'前端开发'],
  [/(?:测试开发|自动化测试|软件测试|测试工程师|qa engineer)/i,'测试开发'],
  [/(?:数据分析师|数据分析|商业分析师)/i,'数据分析师'],
  [/(?:数据开发|数据工程师|数据工程|大数据工程)/i,'数据工程师'],
  [/(?:机器学习|算法工程师|人工智能工程师|ai engineer)/i,'算法工程师'],
  [/(?:产品经理|产品专员|产品策划)/i,'产品经理'],
  [/(?:视觉设计|平面设计|品牌设计|graphic designer)/i,'视觉设计师'],
  [/(?:ui设计|ux设计|交互设计|用户体验)/i,'交互设计师'],
  [/(?:工业设计|工业设计师)/i,'工业设计师'],
  [/(?:机械设计|机械工程师|机械结构设计)/i,'机械设计工程师'],
  [/(?:汽车工程师|车辆工程|整车研发|汽车研发)/i,'汽车研发工程师'],
  [/(?:电气工程|自动化工程师)/i,'电气工程师'],
  [/(?:建筑设计|建筑师|建筑规划)/i,'建筑设计师'],
  [/(?:土木工程|建筑工程|施工管理)/i,'土木工程师'],
  [/(?:内容运营|新媒体运营|内容策划)/i,'内容运营'],
  [/(?:用户运营|社群运营)/i,'用户运营'],
  [/(?:市场营销|品牌营销|市场推广)/i,'市场营销'],
  [/(?:销售顾问|销售经理|汽车销售|销售代表|商务拓展|客户经理)/i,'销售顾问'],
  [/(?:审计师|审计专员|财务审计|审计)/i,'审计专员'],
  [/(?:财务分析|财务规划)/i,'财务分析师'],
  [/(?:会计师|会计|出纳)/i,'财务会计'],
  [/(?:人力资源|人事专员|招聘专员|人力招聘)/i,'人力资源'],
  [/(?:行政管理|行政专员|行政助理)/i,'行政专员'],
  [/(?:法务|法律顾问|律师)/i,'法务专员'],
  [/(?:舞蹈教师|舞蹈老师|舞蹈教学)/i,'舞蹈教师'],
  [/(?:教师|老师|教研|教育培训)/i,'教师'],
  [/(?:医学检验|检验技师|医学检测)/i,'医学检验技师'],
  [/(?:护士|护理师|护理专业)/i,'护士'],
  [/(?:医生|临床医师|临床医学)/i,'医生'],
  [/(?:供应链|采购专员|采购经理|采购管理)/i,'供应链管理'],
  [/(?:物流管理|物流专员|仓储运营)/i,'物流专员'],
  [/(?:影视制作|视频剪辑|视频编辑|后期制作|剪辑师)/i,'影视剪辑师'],
  [/(?:影视编导|影视导演|视频导演|短视频编导|电影导演)/i,'影视编导'],
  [/(?:舞蹈演员|职业舞者|舞台舞者)/i,'舞蹈演员'],
  [/(?:舞蹈编导|舞蹈编排|编舞)/i,'舞蹈编导'],
  [/(?:翻译|笔译|口译)/i,'翻译'],
  [/(?:外贸业务|国际贸易|进出口业务|外贸销售)/i,'外贸业务'],
  [/(?:客服专员|客户服务|售后服务)/i,'客服专员'],
  [/(?:软件运维|系统运维|devops|运维工程师)/i,'运维工程师'],
  [/(?:网络安全|信息安全|安全工程师)/i,'网络安全工程师'],
  [/(?:食品工程|食品研发|食品检测|食品质量)/i,'食品工程师'],
  [/(?:化工工艺|化学工程师|化工工程师|材料工程师)/i,'化工工程师'],
  [/(?:客服专员|客户服务|售后服务)/i,'客服专员']
 ];
 return catalog.find(([rule])=>rule.test(s))?.[1]||null;
}
export function buildOfficialQueries(role,expanded=false){
 // Up to three evidence-backed Chinese job directions share the SAME fixed
 // provider request budget; no resume text, personal info or arbitrary URLs.
 const intents=[...new Set((Array.isArray(role)?role:[role])
  .map(sanitizedJobIntent).filter(Boolean))].slice(0,3);
 if(!intents.length)return [];
 const clean=intents[0];
 const base=[
  clean+' 招聘 site:careers.tencent.com OR site:zhaopin.meituan.com',
  clean+' 招聘 site:career.huawei.com'
 ];
 if(expanded){
  // Same four-search budget as before; Baidu adds a fifth independently
  // authenticated employer, not a model-invented "all China" job directory.
  base[1]=(intents[1]||clean)+' 招聘 site:career.huawei.com OR site:talent.baidu.com/jobs/detail/SOCIAL/';
  base.push(
   (intents[2]||clean)+' 工作地点 中国 职位 site:jobs.bytedance.com/experienced/position/',
   clean+' 工作地点 中国 岗位 site:zhaopin.jd.com/web/job-info-detail'
  );
 }
 return base.map(q=>q.slice(0,128));
}
export function safeOfficialJobLocator(input){
 if(typeof input!=='string'||input.length>1000)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  // Verified ByteDance China job details, not its global recruiting portal.
  if(u.hostname==='jobs.bytedance.com'){
   const id=u.pathname.match(/^\/experienced\/position\/([0-9]{13,22})\/detail$/)?.[1];
   if(!id||u.searchParams.size!==0)return null;
   return {id:'jobs.bytedance.com:'+id,company:'字节跳动',domain:u.hostname,
    url:'https://jobs.bytedance.com/experienced/position/'+id+'/detail'};
  }
  // Baidu social recruitment: an exact, independent official vacancy detail.
  if(u.hostname==='talent.baidu.com'){
   const id=u.pathname.match(/^\/jobs\/detail\/SOCIAL\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1];
   if(!id||u.searchParams.size!==0)return null;
   return {id:'talent.baidu.com:'+id.toLowerCase(),company:'百度',domain:u.hostname,
    url:'https://talent.baidu.com/jobs/detail/SOCIAL/'+id.toLowerCase()};
  }
  const source=OFFICIAL[u.hostname];
  if(!source||u.pathname!==source.path||!u.searchParams.has(source.idParam))return null;
  const meituanExtra=u.hostname==='zhaopin.meituan.com'&&u.searchParams.size===2&&
   u.searchParams.has('highlightType')&&['social','campus'].includes(u.searchParams.get('highlightType'));
  if(u.searchParams.size!==1&&!meituanExtra)return null;
  const id=u.searchParams.get(source.idParam);
  if(!source.idPattern.test(id))return null;
  return {id:u.hostname+':'+id,company:source.company,domain:u.hostname,
   url:'https://'+u.hostname+source.path+'?'+source.idParam+'='+id};
 }catch{return null}
}
export function extractOfficialJob(searchResult,document,now=new Date()){
 const source=safeOfficialJobLocator(searchResult?.url);
 if(!source||!document||typeof document.content!=='string')return null;
 const content=document.content.replace(/\r/g,'').replace(/\u0000/g,'').slice(0,100000);
 if(content.length<170||!HAS_DUTIES.test(content)||!HAS_REQUIREMENTS.test(content)||CLOSED.test(content))return null;
 // Refuse contradictory foreign and mainland location signals in the job heading.
 if(OUTSIDE.test(content.slice(0,350)))return null;
 const lines=content.split('\n').map(t=>t.replace(/^\s*#{1,6}\s*/,'').trim()).filter(Boolean);
 // Require a position-specific title in the fetched official page, not a
 // search snippet. An indexed listing or generic landing page is insufficient.
 const titleLine=lines.find(t=>t.length>=4&&t.length<=115&&ROLE_TITLE.test(t)&&
  !/^(?:职位详情|招聘|社会招聘|岗位详情|职位|官网|搜索|当前位置|岗位职责|岗位要求|任职要求)(?:\s|$|[|｜])/i.test(t));
 if(!titleLine)return null;
 const title=titleLine.split(/[\n|｜]/)[0].trim().slice(0,86);
 if(!title||title.length<4||OUTSIDE.test(title))return null;
 // A Mainland city must be evidenced on the fetched page, preferably next
 // to the official "work location" label, otherwise at the document heading.
 const locationSection=content.match(/(?:工作地点|工作城市|工作地|办公地点)[：:\s]*([^\n]{0,65})/);
 const labelled=locationSection?.[1]||'';
 // When official details omit a labelled city, inspect only the heading
 // and metadata lines BEFORE job duties, not the entire JD body (which can
 // mention other cities or overseas clients unrelated to work location).
 const dutiesAt=lines.findIndex(t=>HAS_DUTIES.test(t));
 const headerLines=lines.slice(0,dutiesAt<0?4:Math.min(dutiesAt,8));
 const city=labelled.trim()?findMainlandCity(labelled):
  headerLines.map(findMainlandCity).find(Boolean)||null;
 if(!city)return null;
 const rq=content.match(/(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求|职责要求)[：:\s]*([\s\S]{24,6000})/);
 const experienceLabel=(content.match(/(?:工作经验|经验要求|工作年限|经验年限)[：:\s]*([^\n]{1,80})/)||[])[1]||'';
 const requirement=((rq?.[1]||'').split(/(?:岗位职责|工作地点|申请岗位|事业群介绍|立即投递|相关职位)/)[0]+
  (experienceLabel?' 工作经验：'+experienceLabel:''))
  .replace(/[\s#*-]+/g,' ').trim().slice(0,5500);
 if(requirement.length<25)return null;
 // A successful fetch is not a guarantee that applications remain open.
 // Do not set is_open=true, "verified open", or make a hiring probability claim.
 const nowIso=now instanceof Date?now.toISOString():new Date(now).toISOString();
 return {
  id:source.id,source_type:'站外官方招聘',company:source.company,title,
  location:city,official_url:source.url,official_domain:source.domain,
  source_status:'OFFICIAL_DETAIL_FETCHED',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
  // Baidu SOCIAL details can be readable without a visible submit button;
  // never label that as "apply open". The link opens the exact official JD,
  // and applying may require a separate logged-in action.
  has_application_cta:HAS_APPLY.test(content),checked_at:nowIso,
  application_method:source.domain==='talent.baidu.com'&&!HAS_APPLY.test(content)&&
   /(?:登录|登录\/注册|sign in)/i.test(content)?
   'OFFICIAL_DETAIL_LOGIN_REQUIRED':'DIRECT_CTA_UNVERIFIED',
  evidence:{title:titleLine.slice(0,115),location:city,requirement,
   salary:(content.match(/(?:月薪|薪资范围|薪资待遇|薪酬)[：:\s]*([\d.]+\s*[-~至]\s*[\d.]+\s*(?:[kK]|万|千|元)(?:\s*\/月)?)/)||[])[1]||null},
 };
}
async function readBoundedJson(response,maxBytes){
 if(!response.body||!(response.headers.get('content-type')||'').toLowerCase().includes('json'))
  throw Error('SEARCH_RESPONSE_INVALID');
 const declared=response.headers.get('Content-Length');
 if(declared&&Number(declared)>maxBytes)throw Error('SEARCH_RESPONSE_INVALID');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{
  while(true){
   const part=await reader.read();
   if(part.done)break;
   length+=part.value.byteLength;
   if(length>maxBytes){await reader.cancel();throw Error('SEARCH_RESPONSE_INVALID');}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock();}
 const all=new Uint8Array(length);let start=0;
 for(const chunk of chunks){all.set(chunk,start);start+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}
 catch{throw Error('SEARCH_RESPONSE_INVALID');}
}
export class ExternalSearchError extends Error{
 constructor(code){super(code);this.code=code;this.name='ExternalSearchError';}
}
async function providerPost(url,key,payload,maxBytes,fetcher){
 let response;
 try{
  response=await fetcher(url,{
   method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(16000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(payload)
  });
 }catch(e){
  throw new ExternalSearchError(e?.name==='TimeoutError'?'SEARCH_PROVIDER_TIMEOUT':'SEARCH_PROVIDER_NETWORK');
 }
 if(response.status>=300&&response.status<400)throw new ExternalSearchError('SEARCH_PROVIDER_REDIRECT_BLOCKED');
 if(url.endsWith('/fetch')&&(response.status===403||response.status===404))
  throw new ExternalSearchError('SEARCH_FETCH_NOT_AVAILABLE');
 if(response.status===401||response.status===403)throw new ExternalSearchError('SEARCH_PROVIDER_KEY_REJECTED');
 if(response.status===402)throw new ExternalSearchError('SEARCH_PROVIDER_BALANCE_INSUFFICIENT');
 if(response.status===429)throw new ExternalSearchError('SEARCH_PROVIDER_RATE_LIMIT');
 if(!response.ok)throw new ExternalSearchError('SEARCH_PROVIDER_ERROR');
 try{return await readBoundedJson(response,maxBytes);}
 catch{throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');}
}
/** Search titles are untrusted discovery hints, never official JD evidence. */
export function prioritizeOfficialSearchCandidates(rows,role,maxFetch){
 const roles=(Array.isArray(role)?role:[role]).map(sanitizedJobIntent).filter(Boolean);
 const kinds=new Set(roles.map(classifyOccupation).filter(Boolean));
 const scored=[];
 for(const [index,row] of (Array.isArray(rows)?rows:[]).entries()){
  const locator=safeOfficialJobLocator(row?.url);
  if(!locator)continue;
  const snippet=typeof row?.title==='string'?row.title.slice(0,140):'';
  const kind=classifyOccupation(snippet);
  const normalized=snippet.toLowerCase().replace(/\s+/g,'');
  const exact=roles.some(r=>r.length>=4&&normalized.includes(r.toLowerCase().replace(/\s+/g,'')));
  const relevance=exact?3:kind&&kinds.has(kind)?2:!kind?1:0;
  scored.push({...row,url:locator.url,company:locator.company,relevance,index});
 }
 scored.sort((a,b)=>b.relevance-a.relevance||a.index-b.index);
 const candidates=[],selected=new Set(),byEmployer=new Map();
 const limit=Math.min(8,Math.max(1,Math.trunc(maxFetch)||1));
 const add=(row)=>{
  if(!row||selected.has(row.url)||candidates.length>=limit)return false;
  candidates.push(row);selected.add(row.url);
  byEmployer.set(row.company,(byEmployer.get(row.company)||0)+1);
  return true;
 };
 // Reserve one official Fetch opportunity per distinct supported intent
 // where such a listing exists. Search-result titles are untrusted hints only,
 // and must still pass exact official JD verification after Fetch.
 for(const kind of kinds){
  if(candidates.length>=limit)break;
  const candidate=scored.find(row=>classifyOccupation(row.title)===kind&&
   !selected.has(row.url)&&(byEmployer.get(row.company)||0)<2);
  add(candidate);
 }
 for(const row of scored){
  if(candidates.length>=limit)break;
  if(selected.has(row.url)||(byEmployer.get(row.company)||0)>=2)continue;
  add(row);
 }
 if(candidates.length<limit)for(const row of scored){
  if(selected.has(row.url))continue;
  candidates.push(row);selected.add(row.url);
  if(candidates.length>=limit)break;
 }
 return candidates.map(({relevance,index,company,...row})=>row);
}
export async function discoverExternalOfficialJobs(role,key,{fetcher=fetch,now=new Date(),expanded=false}={}){
 const queries=buildOfficialQueries(role,expanded);
 const maxSearch=expanded?4:SEARCH_LIMIT,maxFetch=expanded?8:FETCH_LIMIT;
 if(!queries.length)throw new ExternalSearchError('INVALID_SEARCH_INTENT');
 if(typeof key!=='string'||key.length<16)throw new ExternalSearchError('SEARCH_NOT_ENABLED');
 const possible=new Map(),usage={search:0,fetch:0};
 // Parallelize the expanded, one-click discovery so the user does not wait for
 // twelve sequential provider timeouts; the legacy small pilot stays unchanged.
 const searchOne=(query)=>providerPost('https://api.deepseek.com/v1/tools/search',key,
  {query,count:expanded?12:6,need_content:false},250000,fetcher);
 const searchResults=expanded?await Promise.all(queries.slice(0,maxSearch).map(searchOne)):null;
 for(let i=0;i<Math.min(maxSearch,queries.length);i++){
  const response=expanded?searchResults[i]:await searchOne(queries[i]);
  if(!Array.isArray(response?.results))throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');
  if(response.results.length)usage.search++;
  for(const item of response.results.slice(0,expanded?12:6)){
   const loc=safeOfficialJobLocator(item?.url);
   if(loc&&!possible.has(loc.id))possible.set(loc.id,{...item,url:loc.url});
  }
 }
 const jobs=[];
 const candidates=expanded?
  prioritizeOfficialSearchCandidates([...possible.values()],role,maxFetch):
  [...possible.values()].slice(0,maxFetch);
 const fetchOne=async(candidate)=>{
  let fetched;
  try{
   fetched=await providerPost('https://api.deepseek.com/v1/tools/fetch',key,
    {url:candidate.url},500000,fetcher);
  }catch(e){
   if(e instanceof ExternalSearchError&&e.code==='SEARCH_FETCH_NOT_AVAILABLE')return null;
   throw e;
  }
  if(typeof fetched?.content!=='string')throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');
  if(fetched.content)usage.fetch++;
  return extractOfficialJob(candidate,fetched,now);
 };
 if(expanded){
  // Eight independent official pages at most, each bounded to 16 seconds.
  const fetched=await Promise.allSettled(candidates.map(fetchOne));
  for(const row of fetched){
   if(row.status==='fulfilled'&&row.value)jobs.push(row.value);
   else if(row.status==='rejected')
    console.warn('HHBA_MATCH_OFFICIAL_DETAIL_FAILED');
  }
 }else{
  for(const candidate of candidates){
   const job=await fetchOne(candidate);
   if(job)jobs.push(job);
  }
 }
 // A company can have many SEO/city copies of the same role: prefer unique
 // employer+position without fabricating a vacancy to reach Top10.
 const unique=new Map();
 for(const job of jobs){
  const signature=job.company.toLowerCase()+'|'+job.title.toLowerCase();
  if(!unique.has(signature))unique.set(signature,job);
 }
 return {kind:EXTERNAL_DISCOVERY_VERSION,scope:'CN_MAINLAND_ONLY',
  candidates:[...unique.values()].slice(0,maxFetch),
  candidate_count:unique.size,usage,max_search_requests:maxSearch,max_fetch_requests:maxFetch,
  disclaimer:'仅核验企业官方网站的岗位详情，不保证仍可投递；不代表录用概率。'};
}
