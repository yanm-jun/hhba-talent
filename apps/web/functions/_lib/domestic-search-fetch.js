// DeepSeek Search / Fetch adapter for verified Mainland China job discovery.
// This module NEVER accepts a resume or arbitrary URL from an applicant.
// Search is discovery, not proof that applications are currently open.
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
};
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
const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|hong[\s-]?kong|macau|macao|taiwan|taipei|tokyo|japan|singapore|united states|美国|日本|新加坡)/i;
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
export function buildOfficialQueries(role,expanded=false){
 const clean=sanitizedJobIntent(role);
 if(!clean)return [];
 const base=[
  clean+' 招聘 site:careers.tencent.com OR site:zhaopin.meituan.com',
  clean+' 招聘 site:career.huawei.com'
 ];
 if(expanded)base.push(
  clean+' 工作地点 中国 职位 site:jobs.bytedance.com/experienced/position/',
  clean+' 中国 招聘 site:careers.tencent.com OR site:jobs.bytedance.com'
 );
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
 const header=content.slice(0,280);
 const city=(!OUTSIDE.test(labelled)&&labelled.match(CITY_PATTERN)?.[0])||
  (!OUTSIDE.test(header)&&header.match(CITY_PATTERN)?.[0]);
 if(!city)return null;
 const rq=content.match(/(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求)[：:\s]*([\s\S]{24,900})/);
 const experienceLabel=(content.match(/(?:工作经验|经验要求|工作年限|经验年限)[：:\s]*([^\n]{1,80})/)||[])[1]||'';
 const requirement=((rq?.[1]||'').split(/(?:岗位职责|工作地点|申请岗位|事业群介绍|立即投递|相关职位)/)[0]+
  (experienceLabel?' 工作经验：'+experienceLabel:''))
  .replace(/[\s#*-]+/g,' ').trim().slice(0,1000);
 if(requirement.length<25)return null;
 // A successful fetch is not a guarantee that applications remain open.
 // Do not set is_open=true, "verified open", or make a hiring probability claim.
 const nowIso=now instanceof Date?now.toISOString():new Date(now).toISOString();
 return {
  id:source.id,source_type:'站外官方招聘',company:source.company,title,
  location:city,official_url:source.url,official_domain:source.domain,
  source_status:'OFFICIAL_DETAIL_FETCHED',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
  has_application_cta:HAS_APPLY.test(content),checked_at:nowIso,
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
export async function discoverExternalOfficialJobs(role,key,{fetcher=fetch,now=new Date(),expanded=false}={}){
 const queries=buildOfficialQueries(role,expanded);
 const maxSearch=expanded?4:SEARCH_LIMIT,maxFetch=expanded?8:FETCH_LIMIT;
 if(!queries.length)throw new ExternalSearchError('INVALID_SEARCH_INTENT');
 if(typeof key!=='string'||key.length<16)throw new ExternalSearchError('SEARCH_NOT_ENABLED');
 const possible=new Map(),usage={search:0,fetch:0};
 // Parallelize the expanded, one-click discovery so the user does not wait for
 // twelve sequential provider timeouts; the legacy small pilot stays unchanged.
 const searchOne=(query)=>providerPost('https://api.deepseek.com/v1/tools/search',key,
  {query,count:6,need_content:false},250000,fetcher);
 const searchResults=expanded?await Promise.all(queries.slice(0,maxSearch).map(searchOne)):null;
 for(let i=0;i<Math.min(maxSearch,queries.length);i++){
  const response=expanded?searchResults[i]:await searchOne(queries[i]);
  if(!Array.isArray(response?.results))throw new ExternalSearchError('SEARCH_RESPONSE_INVALID');
  if(response.results.length)usage.search++;
  for(const item of response.results.slice(0,6)){
   const loc=safeOfficialJobLocator(item?.url);
   if(loc&&!possible.has(loc.id))possible.set(loc.id,{...item,url:loc.url});
  }
 }
 const jobs=[];
 const candidates=[...possible.values()].slice(0,maxFetch);
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
