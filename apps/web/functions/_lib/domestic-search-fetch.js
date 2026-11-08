// DeepSeek Search / Fetch adapter for verified Mainland China job discovery.
// This module NEVER accepts a resume or arbitrary URL from an applicant.
// Search is discovery, not proof that applications are currently open.
export const EXTERNAL_DISCOVERY_VERSION='HHBA_DOMESTIC_DISCOVERY_V1';
export const SEARCH_LIMIT=5;
export const FETCH_LIMIT=10;
export const MAX_SEARCH_FETCH_COST_CNY=0.075;
export const CACHE_TTL_MS=24*60*60*1000;

const OFFICIAL={
 'careers.tencent.com':{
  company:'腾讯',path:'/jobdesc.html',idParam:'postId',idPattern:/^\d{12,22}$/},
 'career.huawei.com':{
  company:'华为',path:'/cn/job-details',idParam:'advertisementId',idPattern:/^\d{1,12}$/},
 'zhaopin.meituan.com':{
  company:'美团',path:'/web/position/detail',idParam:'jobUnionId',idPattern:/^\d{8,14}$/},
};
// Dynamic ATS tenants: not a fixed employer list. Host controls are strict,
// and company identity remains "ATS tenant only" until separately certified.
const ATS=[
 {domain:'jobs.ashbyhq.com',provider:'ashby',path:/^\/([a-z0-9][a-z0-9-]{1,55})\/([a-f0-9]{8}-[a-f0-9-]{27,40})\/?$/i},
 {domain:'jobs.lever.co',provider:'lever',path:/^\/([a-z0-9][a-z0-9-]{1,55})\/([a-f0-9]{8}-[a-f0-9-]{27,40})\/?$/i},
 {domain:'job-boards.greenhouse.io',provider:'greenhouse',path:/^\/([a-z0-9][a-z0-9-]{1,55})\/jobs\/(\d{5,14})\/?$/i},
 {domain:'boards.greenhouse.io',provider:'greenhouse',path:/^\/([a-z0-9][a-z0-9-]{1,55})\/jobs\/(\d{5,14})\/?$/i},
 {domain:'jobs.smartrecruiters.com',provider:'smartrecruiters',path:/^\/([a-z0-9][a-z0-9-]{1,55})\/(\d{7,16}(?:-[a-z0-9-]{2,90})?)\/?$/i}
];
const RESERVED_TENANTS=new Set(['login','signin','register','company','jobs','job','careers','candidate','app','privacy','admin','test','example']);
const ENGLISH_CITY={
 beijing:'北京',shanghai:'上海',shenzhen:'深圳',guangzhou:'广州',hangzhou:'杭州',
 chengdu:'成都',wuhan:'武汉',nanjing:'南京',suzhou:'苏州',xian:'西安',
 'xi\'an':'西安',qingdao:'青岛',ningbo:'宁波',tianjin:'天津',chongqing:'重庆',
 xiamen:'厦门',fuzhou:'福州',hefei:'合肥',changsha:'长沙',kunming:'昆明',
 dalian:'大连',jinan:'济南',zhengzhou:'郑州',wuxi:'无锡',dongguan:'东莞',
 zhuhai:'珠海',foshan:'佛山',nanning:'南宁',haikou:'海口'
};
const ENGLISH_CITY_PATTERN=new RegExp(
 '\\b('+Object.keys(ENGLISH_CITY).sort((a,b)=>b.length-a.length).join('|')+')\\b','i');
const ENG_DUTIES=/(?:responsibilities|what you['’]ll do|job description|about the role)/i;
const ENG_REQUIREMENTS=/(?:qualifications|requirements|what you['’]ll need|what we['’]re looking for)/i;
const ENG_APPLY=/(?:apply for this job|apply now|submit application|apply to this job)/i;
const ENG_CLOSED=/(?:no longer accepting applications|this job is closed|position has been filled|job is no longer available)/i;
function mainlandCity(text){
 const str=String(text||'').slice(0,100);
 if(OUTSIDE.test(str))return null;
 const c=str.match(CITY_PATTERN)?.[0];
 if(c)return c;
 const english=str.match(ENGLISH_CITY_PATTERN)?.[0]?.toLowerCase();
 return english?ENGLISH_CITY[english]:null;
}
function tenantConfirmed(content,tenant){
 const expected=tenant.toLowerCase().replace(/[^a-z0-9]/g,'');
 return expected.length>=3&&content.slice(0,2600).toLowerCase().replace(/[^a-z0-9]/g,'').includes(expected);
}

const CITY_NAMES=[
 '北京','上海','天津','重庆','深圳','广州','杭州','南京','苏州','成都','武汉','西安',
 '青岛','宁波','无锡','合肥','郑州','长沙','厦门','福州','济南','大连','沈阳','哈尔滨',
 '长春','石家庄','昆明','贵阳','南宁','海口','珠海','佛山','东莞','烟台','潍坊','临沂',
 '济宁','菏泽','聊城','威海','泰安','德州','枣庄','滨州','日照','东营','常州','南通',
 '嘉兴','绍兴','金华','温州','台州','太原','徐州','扬州','保定','唐山','廊坊','兰州',
 '西宁','银川','乌鲁木齐','呼和浩特','包头','柳州','桂林','洛阳','开封','南昌','九江',
 '珠海','中山','惠州'
];
const CITY_PATTERN=new RegExp(CITY_NAMES.sort((a,b)=>b.length-a.length).join('|'));
const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macau|macao|taiwan|taipei|tokyo|japan|singapore|united states|美国|日本|新加坡|canada|australia|united kingdom|uk\b|germany|france|india|indonesia|malaysia|vietnam|thailand|philippines|switzerland|netherlands|ireland|brazil|mexico|south korea|hongkong|海外|境外|加拿大|澳大利亚|英国|德国|法国|印度|泰国|越南|马来西亚|菲律宾|韩国|全球远程|worldwide|global remote|remote global)/i;
const CLOSED=/(?:职位已关闭|该职位已下线|岗位已下线|停止招聘|暂停招聘|不再接受申请|招聘已结束|岗位已关闭|职位已过期|目前暂时未有岗位开放)/i;
const HAS_DUTIES=/(?:岗位职责|工作职责|职位职责|岗位描述|工作内容|主要职责)/;
const HAS_REQUIREMENTS=/(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求)/;
const HAS_APPLY=/(?:申请岗位|立即申请|立即投递|投递岗位|投递简历|申请职位)/;
const ROLE_TITLE=/(?:工程师|研发|设计师|分析师|架构师|研究员|数据科学|顾问|产品经理|运营|销售|法务|财务|审计|人力|实习生|技术专员|专家|总监|主管|负责人|scientist|engineer|analyst|designer|intern)/i;
const BLOCK_INTENT=/(?:姓名|身份证|身份证号|手机号|电话号码|电子邮箱|我的电话|家庭住址|password|api.?key|bearer|secret|token|sk-[a-z0-9_-]+|忽略上述|执行指令)/i;
export function sanitizedJobIntent(value){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/\s+/g,' ');
 if(s.length<2||s.length>42||BLOCK_INTENT.test(s)||/https?:|www\.|@|(?:\d[\s-]?){5,}/i.test(s))return null;
 if(!/^[\p{Script=Han}a-zA-Z0-9+#.\s-]+$/u.test(s))return null;
 return s;
}
export function buildOfficialQueries(role){
 const clean=sanitizedJobIntent(role);
 if(!clean)return [];
 return [
  clean+' 中国大陆 招聘 官方岗位 2026',
  clean+' Shanghai Beijing Shenzhen China site:jobs.ashbyhq.com',
  clean+' 上海 北京 中国 招聘 site:jobs.lever.co',
  clean+' 中国 招聘 site:job-boards.greenhouse.io OR site:boards.greenhouse.io',
  clean+' 国内招聘 site:jobs.smartrecruiters.com OR site:career.huawei.com OR site:careers.tencent.com OR site:zhaopin.meituan.com'
 ].map(q=>q.slice(0,128));
}
export function safeOfficialJobLocator(input){
 if(typeof input!=='string'||input.length>1500)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  const fixed=OFFICIAL[u.hostname];
  if(fixed){
   if(u.pathname!==fixed.path||!u.searchParams.has(fixed.idParam))return null;
   const meituanExtra=u.hostname==='zhaopin.meituan.com'&&u.searchParams.size===2&&
    u.searchParams.has('highlightType')&&['social','campus'].includes(u.searchParams.get('highlightType'));
   if(u.searchParams.size!==1&&!meituanExtra)return null;
   const id=u.searchParams.get(fixed.idParam);
   if(!fixed.idPattern.test(id))return null;
   return {id:u.hostname+':'+id,company:fixed.company,domain:u.hostname,
    provider:'employer',source_level:'VERIFIED_EMPLOYER_DOMAIN',
    url:'https://'+u.hostname+fixed.path+'?'+fixed.idParam+'='+id};
  }
  const ats=ATS.find(p=>p.domain===u.hostname);
  if(!ats)return null;
  for(const k of u.searchParams.keys())
   if(!['utm_source','utm_medium','gh_src','lever-source','source'].includes(k))return null;
  if(u.searchParams.size>3)return null;
  const m=u.pathname.match(ats.path);
  if(!m)return null;
  const tenant=m[1].toLowerCase(),id=m[2].toLowerCase();
  if(RESERVED_TENANTS.has(tenant))return null;
  const url='https://'+u.hostname+u.pathname.replace(/\/$/,'');
  return {id:u.hostname+':'+tenant+':'+id,company:tenant,domain:u.hostname,
   tenant,provider:ats.provider,source_level:'VERIFIED_ATS_TENANT_ONLY',url};
 }catch{return null;}
}
export function extractOfficialJob(searchResult,document,now=new Date()){
 const source=safeOfficialJobLocator(searchResult?.url);
 if(!source||!document||typeof document.content!=='string')return null;
 const content=document.content.replace(/\r/g,'').replace(/\u0000/g,'').slice(0,100000);
 if(content.length<170||!(HAS_DUTIES.test(content)||ENG_DUTIES.test(content))||
  !(HAS_REQUIREMENTS.test(content)||ENG_REQUIREMENTS.test(content))||
  CLOSED.test(content)||ENG_CLOSED.test(content))return null;
 if(OUTSIDE.test(content.slice(0,350)))return null;
 const lines=content.split('\n').map(x=>x.replace(/^\s*#{1,6}\s*/,'').trim()).filter(Boolean);
 const titleLine=lines.find(x=>x.length>=4&&x.length<=115&&ROLE_TITLE.test(x)&&
  !/^(?:职位详情|招聘|社会招聘|岗位详情|职位|官网|搜索|当前位置|岗位职责|岗位要求|任职要求)(?:\s|$|[|｜])/i.test(x));
 if(!titleLine)return null;
 const title=titleLine.split(/[\n|｜]/)[0].trim().slice(0,86);
 if(!title||OUTSIDE.test(title))return null;
 const labelled=content.match(/(?:工作地点|工作城市|工作地|办公地点|Location|Work location|Office location)[：:\s]*([^\n]{0,100})/i)?.[1]||'';
 const city=mainlandCity(labelled)||mainlandCity(content.slice(0,300));
 if(!city)return null;
 const rq=content.match(/(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求|Qualifications|Requirements|What you['’]ll need|What we['’]re looking for)[：:\s]*([\s\S]{24,1400})/i);
 const requirement=(rq?.[1]||'').split(/(?:岗位职责|工作地点|申请岗位|立即投递|相关职位|Responsibilities|Apply now|Apply for this)/i)[0]
  .replace(/[\s#*-]+/g,' ').trim().slice(0,350);
 if(requirement.length<25)return null;
 const hasApplicationCta=HAS_APPLY.test(content)||ENG_APPLY.test(content);
 if(!hasApplicationCta)return null;
 // A real ATS tenant is not independent legal company verification.
 // Tenant must occur in the fetched document; source tier remains transparent.
 if(source.tenant&&!tenantConfirmed(content,source.tenant))return null;
 const checked=now instanceof Date?now.toISOString():new Date(now).toISOString();
 return {id:source.id,source_type:'站外官方招聘',company:source.company,title,
  location:city,official_url:source.url,official_domain:source.domain,
  source_level:source.source_level,source_provider:source.provider,
  source_status:'OFFICIAL_DETAIL_FETCHED',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
  has_application_cta:hasApplicationCta,checked_at:checked,
  evidence:{title:titleLine.slice(0,115),location:city,requirement,
   tenant_verified:!!source.tenant,company_identity:source.company}};
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
// Keep Cloudflare's external connections bounded; parallel work never
// bypasses the per-request quota. Results retain search ranking order.
async function mapBounded(items,concurrency,worker){
 const out=new Array(items.length);let cursor=0;
 async function run(){
  while(cursor<items.length){
   const i=cursor++;
   out[i]=await worker(items[i]);
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},run));
 return out;
}

export async function discoverExternalOfficialJobs(role,key,{fetcher=fetch,now=new Date()}={}){
 const queries=buildOfficialQueries(role);
 if(!queries.length)throw new ExternalSearchError('INVALID_SEARCH_INTENT');
 if(typeof key!=='string'||key.length<16)throw new ExternalSearchError('SEARCH_NOT_ENABLED');
 const possible=new Map(),usage={search:0,fetch:0},attempts={search:0,fetch:0};
 const discovered=await mapBounded(queries.slice(0,SEARCH_LIMIT),2,async query=>{
  attempts.search++;
  return providerPost('https://api.deepseek.com/v1/tools/search',key,
   {query,count:15},250000,fetcher);
 });
 for(const response of discovered){
  if(!Array.isArray(response?.results))throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');
  if(response.results.length)usage.search++;
  for(const item of response.results.slice(0,15)){
   const loc=safeOfficialJobLocator(item?.url);
   if(loc&&!possible.has(loc.id))possible.set(loc.id,{url:loc.url,source:loc});
  }
 }
 // Diversity-first Fetch budget: one official ATS tenant at a time, then
 // revisit tenants, rather than wasting ten requests on one employer.
 const groups=new Map();
 for(const item of possible.values()){
  const key=item.source.tenant||item.source.company;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 const scheduled=[],queues=[...groups.values()];
 for(let round=0;round<FETCH_LIMIT&&scheduled.length<FETCH_LIMIT;round++){
  for(const group of queues){
   if(group[round])scheduled.push(group[round]);
   if(scheduled.length>=FETCH_LIMIT)break;
  }
 }
 const jobs=[];
 const fetched=await mapBounded(scheduled.slice(0,FETCH_LIMIT),3,async candidate=>{
  attempts.fetch++;
  try{
   const document=await providerPost('https://api.deepseek.com/v1/tools/fetch',key,
    {url:candidate.url},500000,fetcher);
   return {candidate,document};
  }catch(e){
   if(e instanceof ExternalSearchError&&e.code==='SEARCH_FETCH_NOT_AVAILABLE')return null;
   throw e;
  }
 });
 for(const item of fetched){
  if(!item)continue;
  if(typeof item.document?.content!=='string')throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');
  if(item.document.content)usage.fetch++;
  const job=extractOfficialJob(item.candidate,item.document,now);
  if(job)jobs.push(job);
 }
 const unique=new Map();
 for(const job of jobs){
  const k=job.company.toLowerCase()+'|'+job.title.toLowerCase().replace(/\s+/g,'');
  if(!unique.has(k))unique.set(k,job);
 }
 return {kind:EXTERNAL_DISCOVERY_VERSION,scope:'CN_MAINLAND_ONLY',
  candidates:[...unique.values()].slice(0,FETCH_LIMIT),
  candidate_count:unique.size,usage,attempts,
  max_search_requests:SEARCH_LIMIT,max_fetch_requests:FETCH_LIMIT,
  cost_cap_cny:MAX_SEARCH_FETCH_COST_CNY,
  disclaimer:'企业招聘系统中的租户和职位详情不等于独立验证了企业归属或当前招聘状态；投递前务必前往官方招聘页确认。'};
}
