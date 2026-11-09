// HHBA minimal live job discovery: public Search -> specific job URLs -> Fetch.
// Search data is untrusted. Neither AI nor Search snippets can claim a job is open.
import {findMainlandCity,isMainlandJobLocation} from './mainland-job-location.js';

const OUTSIDE=/(?:香港|澳门|澳門|台湾|臺灣|东京|大阪|纽约|伦敦|旧金山|硅谷|悉尼|墨尔本|首尔|巴黎|柏林|温哥华|多伦多|曼谷|日本|新加坡|美国|英国|加拿大|澳大利亚|德国|法国|印度|越南|海外|境外|hong[\s-]?kong|macau|taiwan|singapore|tokyo|london|new[\s-]?york|san[\s-]?francisco|sydney|melbourne|seoul|berlin|paris|united states|remote worldwide)/i;
const CLOSED=/(?:职位已关闭|职位已下线|岗位已下线|已停止招聘|停止招聘|招聘已结束|不再接受申请|no longer accepting|position closed)/i;
const NOISE=/(?:新闻|攻略|面经|求职指南|职位列表|岗位列表|招聘信息汇总|薪资报告|招聘会|论坛|百科|校园招聘官网|招聘首页)/i;
const JOB=/((?:ai\s*)?(?:产品经理|产品专员|产品运营|需求分析师|业务分析师|数据分析师|运营(?:经理|专员)?|设计师|研发工程师|软件工程师|工程师|销售(?:经理|顾问)?|客户经理|项目经理|人力资源|市场营销|管培生|实习生|顾问|岗位|职位))|(?:product\s+(?:manager|owner|specialist)|business\s+analyst|data\s+analyst|software\s+engineer|operations\s+(?:manager|specialist)|designer|internship)/i;
const BAD_DOMAIN=/(?:^|\.)(?:so|sogou|zhihu|weibo|douyin|xiaohongshu|bilibili|reddit|youtube|facebook|twitter|x|linkedin|indeed|glassdoor|zhipin|51job|liepin|lagou|jobui|kanzhun|job5156|juejin|csdn|github|medium|wikipedia)\.(?:com|cn|org|net|io)$/i;
const JOB_PATH=/(?:job|jobs|position|career|recruit|talent|campus|hiring|vacanc|advertisement|detail|post|offer|opportunit)/i;
const ID_QUERY=/(?:jobid|job_id|jobcode|postid|positionid|position_id|jobunionid|requementid|advertisementid|id)/i;
const clean=(v,n=180)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):'';
const normalize=s=>clean(s,220).toLowerCase().replace(/\s+/g,'');
function hash(v){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
export function safePublicJobUrl(raw){
 if(typeof raw!=='string'||raw.length>1500)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  const host=u.hostname.toLowerCase();
  if(!host.includes('.')||host.length>150||BAD_DOMAIN.test(host)||
     ['google.com','www.google.com','bing.com','www.bing.com','baidu.com','www.baidu.com','m.baidu.com'].includes(host)||host==='localhost'||
     /(?:^|\.)localhost$/.test(host)||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.endsWith('.local'))return null;
  if(/\/(?:search|list|filter|browse|login|signup|register)(?:\/|$)/i.test(u.pathname)&&
     !/(?:job|position|career)/i.test(u.pathname))return null;
  if(u.pathname==='/'&&!JOB_PATH.test(host))return null;
  const segments=u.pathname.split('/').filter(Boolean);
  const last=segments[segments.length-1]||'';
  const idQuery=[...u.searchParams.entries()].some(([k,v])=>ID_QUERY.test(k)&&v.length>=4);
  const detailPath=segments.length>=2&&JOB_PATH.test(u.pathname)&&
   (last.length>=5&&!/^(?:job|jobs|career|careers|recruit|talent|campus|position|positions|detail|index|list|search|apply)$/i.test(last)||
    segments.some(v=>/^[0-9]{9,}$/.test(v)));
  const atsPath=/(?:^|\.)(?:jobs\.ashbyhq\.com|jobs\.lever\.co|boards\.greenhouse\.io|apply\.workable\.com)$/.test(host)&&
   segments.length>=2&&last.length>=6;
  const detail=idQuery||detailPath||atsPath;
  if(!detail)return null;
  if([...u.searchParams.keys()].some(k=>/(?:password|access_token|auth|session|redirect_uri)/i.test(k)))return null;
  return u.href;
 }catch{return null}
}
function roleTerms(value){
 const s=clean(value,90);
 if(!s||/@|https?:|电话|姓名|身份证|密钥|password|ignore/i.test(s))return [];
 const tests=[
  [/(?:ai|人工智能|智能体|agent).{0,6}(?:产品|运营)|(?:产品|运营).{0,6}(?:ai|人工智能|智能体)/i,'AI产品经理'],
  [/产品经理|产品专员|产品策划|product manager/i,'产品经理'],
  [/设计|ui|ux|视觉/i,'设计师'],
  [/数据分析|business analyst/i,'数据分析师'],
  [/前端|react|vue/i,'前端开发'],
  [/软件|后端|编程|开发工程师|python|java/i,'软件开发'],
  [/运营|增长|渠道/i,'产品运营'],
  [/市场|营销|品牌/i,'市场营销'],
  [/销售|商务|客户经理/i,'销售经理'],
  [/项目管理|项目经理/i,'项目经理'],
  [/人力|招聘专员/i,'人力资源']
 ];
 return [...new Set(tests.filter(([re])=>re.test(s)).map(([,v])=>v))].slice(0,2);
}
export function simpleJobDirections(roleHint,profile,resumeText){
 const out=[];
 const add=v=>{for(const t of roleTerms(v))if(!out.includes(t))out.push(t)};
 add(roleHint);
 for(const v of (Array.isArray(profile?.target_roles)?profile.target_roles:[]).slice(0,6))add(v);
 if(!out.length){
  // Career history may imply a direction even without a formal title.
  const text=clean(resumeText,15000);
  if(/ai.{0,15}(?:agent|产品)|(?:agent|大模型).{0,12}(?:设计|产品)/i.test(text))out.push('AI产品经理');
  if(/(?:产品需求|产品原型|prd|产品规划|需求文档)/i.test(text))out.push('产品经理');
  if(/(?:区域督导|运营|销售线索)/i.test(text))out.push('运营');
  if(/(?:视觉设计|交互设计|ui设计)/i.test(text))out.push('设计师');
  if(/(?:研发|软件开发|代码编写)/i.test(text))out.push('软件开发');
 }
 return out.slice(0,3).length?out.slice(0,3):['运营','产品经理'];
}
export function simpleJobQueries(directions,preferredCities=[]){
 const roles=[...new Set(directions.map(x=>clean(x,32)).filter(Boolean))].slice(0,3);
 const city=preferredCities.filter(x=>typeof x==='string').map(x=>clean(x,12)).slice(0,2).join(' ');
 const queries=[];
 for(const role of roles.slice(0,2)){
  queries.push([role,'招聘',city||'中国大陆','官网','岗位'].filter(Boolean).join(' '));
  queries.push([role,'2026 2027 校招 社招','职位详情','申请'].join(' '));
 }
 if(roles[2])queries.push([roles[2],city||'中国大陆','官方招聘','职位详情'].join(' '));
 return [...new Set(queries)].slice(0,4).map(q=>q.slice(0,128));
}
function candidateFromSearch(item){
 const url=safePublicJobUrl(item?.url);
 if(!url)return null;
 const title=clean(item?.title,180),snippet=clean(item?.summary||item?.snippet,650);
 if(!title||(NOISE.test(title)&&!/(?:产品经理|运营专员|数据分析师|工程师|设计师|销售经理|管培生|intern|product manager)/i.test(title)))return null;
 if(!JOB.test(title+' '+snippet))return null;
 // Search is only a discovery hint, not proof of title, location or vacancy state.
 return {url,search_title:title,summary:snippet};
}
function deriveTitle(text,searchTitle){
 const lines=text.split('\n').map(l=>l.replace(/^[#*\-\s]+/,'').trim()).filter(Boolean).slice(0,95);
 const specific=lines.find(l=>l.length>=4&&l.length<=94&&JOB.test(l)&&
  !/^(?:岗位职责|任职要求|职位要求|工作地点|招聘职位|招聘信息|岗位介绍|工作内容|申请方式)/.test(l));
 const raw=specific||searchTitle.split(/\s*[|｜–—]\s*/)[0];
 return clean(raw.replace(/^(?:职位名称|招聘岗位|岗位名称|职位)[：:\s]*/,'').split(/[|｜]/)[0],95);
}
function companyFrom(pageTitle,searchTitle,hostname){
 const title=clean(pageTitle||searchTitle,170);
 const parts=title.split(/\s*[|｜\-–—]\s*/).map(s=>s.trim()).filter(Boolean);
 const cand=parts.find(s=>s.length>=2&&s.length<=35&&!JOB.test(s)&&!/招聘|求职|查看详情|岗位详情|职位详情/i.test(s));
 if(cand)return cand;
 const host=hostname.replace(/^(?:www|job|jobs|careers?|recruit|zhaopin|talent)\./,'').split('.')[0];
 return clean(host,50)||'招聘企业';
}
const PLACE_LABEL=/(?:工作地点|工作城市|工作地|工作地址|办公地点|办公城市|任职地点|职位地点|工作所在地|base location|work location|location)\s*[：:\-]?\s*([^\n\r|｜]{2,110})/gi;
export function mainlandWorkplaceEvidence(text){
 const input=typeof text==='string'?text.slice(0,14000):'';
 let labeled=false;
 for(const match of input.matchAll(PLACE_LABEL)){
  labeled=true;
  const raw=match[1].split(/[。]/)[0].trim().replace(/\s*(?:岗位职责|任职要求|职位描述|资格要求).*$/,'');
  if(OUTSIDE.test(raw)||/(?:海外|境外|国外|全球|待定|remote worldwide|anywhere)/i.test(raw))
   return {city:null,foreign:true,labeled:true};
  const city=findMainlandCity(raw);
  if(city)return {city,foreign:false,labeled:true};
 }
 return {city:null,foreign:false,labeled};
}
function fetchedEvidence(candidate,page){
 const content=typeof page?.content==='string'?page.content.replace(/\r/g,'').slice(0,60000):'';
 const full=clean(page?.title,150)+'\n'+content;
 const title=deriveTitle(content,clean(page?.title)||candidate.search_title);
 const pageLocation=mainlandWorkplaceEvidence(content);
 const snippetLocation=mainlandWorkplaceEvidence(candidate.summary);
 if(pageLocation.foreign||(pageLocation.labeled&&!pageLocation.city)||snippetLocation.foreign)return null;
 const location=pageLocation.city||(!pageLocation.labeled?snippetLocation.city:null);
 if(!location||!isMainlandJobLocation(location))return null;
 if(CLOSED.test(full.slice(0,15000))||!JOB.test(title)||
    /(?:驻外|赴海外|海外岗位|境外工作)/i.test(title))return null;
 if(!/(?:岗位职责|工作职责|岗位要求|任职要求|工作内容|职位描述|岗位描述|主要职责|responsibilities|qualifications|job description)/i.test(content))return null;
 const lines=content.split('\n').map(l=>l.trim()).filter(Boolean);
 const excerpt=lines.find(l=>l.length>=20&&l.length<=260&&
    /(?:岗位职责|任职要求|工作内容|负责|需求|沟通|协作|设计|能力|经验|管理|产品|分析|开发|运营|学历)/.test(l))
   ||lines.find(l=>l.length>=20&&l.length<=260)||'';
 const company=companyFrom(page?.title,candidate.search_title,new URL(candidate.url).hostname);
 return {company,title,location,requirement:clean(excerpt,260),source_status:'OFFICIAL_DETAIL_FETCHED'};
}
async function post(key,endpoint,payload,fetcher,timeout){
 let r;try{
  r=await fetcher('https://api.deepseek.com/v1/tools/'+endpoint,{
   method:'POST',redirect:'manual',signal:AbortSignal.timeout(timeout),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(payload)
  });
 }catch(e){const error=new Error(e?.name==='TimeoutError'?'SEARCH_TIMEOUT':'SEARCH_NETWORK_ERROR');error.code=error.message;throw error;}
 if(!r.ok){
  const code=r.status===401||r.status===403?'SEARCH_KEY_REJECTED':
   r.status===402?'SEARCH_BALANCE_INSUFFICIENT':
   r.status===429?'SEARCH_RATE_LIMIT':r.status>=500?'SEARCH_PROVIDER_ERROR':'SEARCH_REQUEST_REJECTED';
  const error=new Error(code);error.code=code;throw error;
 }
 try{return await r.json()}catch{const e=new Error('SEARCH_BAD_RESPONSE');e.code=e.message;throw e}
}
export async function discoverSimpleJobs(key,directions,preferredCities=[],{fetcher=fetch,now=new Date()}={}){
 if(typeof key!=='string'||key.length<16)throw new Error('SEARCH_KEY_REJECTED');
 const queries=simpleJobQueries(directions,preferredCities);
 const searches=await Promise.allSettled(queries.map(q=>post(key,'search',{query:q,count:30,need_content:false},fetcher,16000)));
 const raw=[],failures=[];
 searches.forEach(result=>{
  if(result.status==='rejected'){failures.push(result.reason?.code||'SEARCH_PROVIDER_ERROR');return}
  if(!Array.isArray(result.value?.results)){failures.push('SEARCH_BAD_RESPONSE');return}
  raw.push(...result.value.results);
 });
 if(!raw.length&&failures.length===queries.length){
  const e=new Error(failures[0]);e.code=failures[0];throw e;
 }
 const pool=new Map();
 for(const item of raw){
  const candidate=candidateFromSearch(item);
  if(candidate&&!pool.has(candidate.url))pool.set(candidate.url,candidate);
 }
 const candidates=[...pool.values()]
  .filter(item=>!mainlandWorkplaceEvidence(item.summary).foreign)
  .sort((a,b)=>Number(Boolean(mainlandWorkplaceEvidence(b.summary).city))-
                Number(Boolean(mainlandWorkplaceEvidence(a.summary).city)))
  .slice(0,16);
 const fetched=[];
 for(let i=0;i<candidates.length;i+=4){
  const chunk=await Promise.allSettled(candidates.slice(i,i+4).map(row=>
   post(key,'fetch',{url:row.url},fetcher,15000)));
  chunk.forEach((result,j)=>{
   const item=candidates[i+j];
   fetched.push({item,page:result.status==='fulfilled'?result.value:null});
  });
 }
 const jobs=[],seen=new Set();
 for(const {item,page} of fetched){
  const fact=page?fetchedEvidence(item,page):null;
  // Search-only results remain usable ONLY when a concrete Mainland work city
  // is visible; label them unverified, never as a confirmed open vacancy.
  const hint=mainlandWorkplaceEvidence(item.summary);
  const city=hint.foreign?null:hint.city;
  const fallback=city&&
   !/(?:驻外|赴海外|海外岗位|境外工作|work abroad|relocation to)/i.test(item.search_title)?{
   company:companyFrom('',item.search_title,new URL(item.url).hostname),
   title:deriveTitle('',item.search_title),location:city,requirement:'',
   source_status:'SEARCH_RESULT_ONLY'}:null;
  const row=fact||(!page?fallback:null);
  if(!row||!isMainlandJobLocation(row.location)||!JOB.test(row.title)||
   /(?:驻外|赴海外|海外岗位|境外工作)/i.test(row.title))continue;
  const k=[row.company,row.title,row.location].map(normalize).join('|');
  if(seen.has(k))continue;seen.add(k);
  jobs.push({
   id:'external-simple-'+hash(item.url),company:row.company,title:row.title,
   title_zh:row.title,location:row.location,official_url:item.url,
   platform:'web',source:new URL(item.url).hostname,remote:false,
   source_type:'站外官方招聘',source_status:row.source_status,
   application_status:'NEEDS_OFFICIAL_CONFIRMATION',checked_at:now.toISOString(),
   reference_score:50,matched:[],not_evidenced:[],
   needs_verification:[row.source_status==='SEARCH_RESULT_ONLY'?
    '岗位详情未能独立读取，职位信息来自公开搜索，请打开链接核对招聘状态、公司和要求':
    '已读取公开职位网页；是否仍接受申请以招聘网页为准'],
   requirements_basis:row.requirement||row.title,
   candidate_evidence:{role:row.title,requirement:row.requirement||row.title},
   salary:null,experience_requirement:null,required_skills:[],mandatory_skills:[]
  });
  if(jobs.length>=16)break;
 }
 return {jobs,meta:{queries:queries.length,search_results:raw.length,
  detail_links:pool.size,pages_fetched:fetched.filter(x=>x.page).length,
  verified_details:jobs.filter(x=>x.source_status==='OFFICIAL_DETAIL_FETCHED').length,
  candidates:jobs.length,failed_searches:failures.length},
  status:jobs.length?'COMPLETE':failures.length?'PARTIAL':'NO_RESULTS'};
}


export function rankSimpleShortlist(internal,outside,directions,preferredCities=[],limit=10){
 const roles=[...new Set((Array.isArray(directions)?directions:[]).map(normalize).filter(Boolean))];
 const cityPrefs=(Array.isArray(preferredCities)?preferredCities:[]).map(normalize);
 const scored=[...(Array.isArray(internal)?internal:[]),...(Array.isArray(outside)?outside:[])]
  .filter(job=>job&&isMainlandJobLocation(job.location)&&
   !/(?:驻外|赴海外|海外岗位|境外工作)/i.test(job.title||''))
  .map(job=>{
  const title=normalize(job.title),company=normalize(job.company),loc=normalize(job.location);
  const direct=roles.some(r=>title.includes(r)||r.includes(title));
  const related=roles.some(r=>r.includes('产品')&&title.includes('产品')||
   r.includes('运营')&&title.includes('运营')||
   r.includes('销售')&&title.includes('销售')||
   r.includes('设计')&&title.includes('设计')||
   r.includes('开发')&&/研发|开发|软件/.test(title));
  const place=cityPrefs.length&&cityPrefs.some(c=>loc.includes(c));
  const fetched=job.source_status==='OFFICIAL_DETAIL_FETCHED';
  const base=typeof job.reference_score==='number'?Math.min(82,Math.max(42,job.reference_score)):50;
  const score=Math.max(base,50+(direct?24:related?15:0)+(place?9:0)+(fetched?9:0));
  const reason=direct?'职位名称与你的目标岗位方向直接相关':
   related?'与你希望发展的职业方向有联系':'你的简历经历和职位要求仍需要进一步对照';
  return {...job,reference_score:Math.min(96,score),
   matched:(Array.isArray(job.matched)&&job.matched.length?job.matched:[reason])};
 }).sort((a,b)=>b.reference_score-a.reference_score||
  (a.source_status==='OFFICIAL_DETAIL_FETCHED'?-1:1)||
  a.id.localeCompare(b.id));
 const unique=[],seen=new Set(),counts=new Map();
 for(const job of scored){
  const key=[job.company,job.title,job.location].map(normalize).join('|');
  if(seen.has(key))continue;seen.add(key);
  unique.push(job);
 }
 const result=[];
 for(const pass of [true,false]){
  for(const job of unique){
   if(result.length>=limit)break;
   if(result.some(x=>x.id===job.id))continue;
   const company=normalize(job.company);
   if(pass&&(counts.get(company)||0)>=2)continue;
   result.push(job);counts.set(company,(counts.get(company)||0)+1);
  }
 }
 return result;
}
