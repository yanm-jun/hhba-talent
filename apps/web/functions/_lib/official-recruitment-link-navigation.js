// HHBA lightweight official-recruitment navigation (Preview-only pilot).
// Search results are UNTRUSTED leads, never job requirements or availability.
// Only a fetched employer-owned career page, or its exact ATS board backlink,
// may sponsor an outbound recommendation. No resume text leaves the match API.
import {sanitizedJobIntent} from './domestic-search-fetch.js';
import {publicCorporatePage,publicJobLink,companyLinkFromPage} from './deepseek-official-job-agent.js';
import {emptyV8CostMeter,observeV8ModelUsage,buildV8CostReport} from './deepseek-discovery-billing.js';

export const LINK_DISCOVERY_VERSION='HHBA_OFFICIAL_LINK_NAVIGATION_V1';
export const LINK_DISCOVERY_LIMITS=Object.freeze({model:0,search:3,fetch:6,results:10});
const CLOSED=/(?:职位已关闭|岗位已下线|不再招聘|停止招聘|暂停招聘|招聘已结束|no longer accepting applications|job is closed)/i;
const DIRECTORY=/(?:求职招聘平台|招聘信息网|招聘网站|人才招聘网|找工作|附近工作|海量职位|求职招聘|简历模板|全职招聘平台|招聘聚合|职位聚合|招聘资讯)/i;
const RECRUIT=/(?:招聘|加入我们|人才招聘|职位|岗位|社会招聘|校园招聘|career|careers|join us|join our team|recruitment|jobs|positions)/i;
const FOREIGN=/(?:香港|澳门|澳門|台湾|臺灣|日本|新加坡|海外岗位|境外工作|hong\s*kong|macau|taiwan|tokyo|singapore|japan|remote outside china|united states)/i;
const text=(v,n=170)=>typeof v==='string'?v.slice(0,n).replace(/[\u0000-\u001f]+/g,' ').trim():'';
const ROOT_JOB=/\/(?:careers?|jobs?|joinus|join-us|recruit(?:ment)?|positions?|talent)(?:\/|$)/i;

function brand(page,site){
 const title=text(page?.title,160),body=String(page?.content||'').slice(0,25000);
 if(!title||body.length<160)return null;
 const shortTitle=title.split(/[|｜]/).map(x=>x.trim());
 const heads=body.split('\n').slice(0,14).map(x=>x.replace(/^#+\s*/, '').trim());
 const candidates=[...shortTitle,...heads].map(x=>x.replace(
  /(?:\s*[-—·]\s*)?(?:社会招聘|校园招聘|人才招聘|招聘官网|官方网站|加入我们|公司官网|企业官网|招聘|careers?|jobs?|home|首页)$/i,'').trim())
  .filter(x=>x.length>=2&&x.length<=48&&
   /^[\p{Script=Han}\p{Script=Latin}\d（）()&·.\- \s]+$/u.test(x)&&
   !DIRECTORY.test(x)&&!FOREIGN.test(x));
 if(!candidates.length)return null;
 const recruitment=RECRUIT.test(title+' '+body.slice(0,7000));
 if(!recruitment||DIRECTORY.test(title))return null;
 // Domain-specific careers landing is preferred. A generic corporate home
 // needs a clear "careers / recruitment" passage before being an entry.
 if(site.url.endsWith('/')&&!/^(?:careers?|jobs?|hr|zhaopin|recruit|join)\./i.test(site.host)&&
   !/(?:加入我们|招聘|人才招聘|社会招聘|岗位招聘|careers?|join our team)/i.test(body.slice(0,4000)))return null;
 // Never claim independently verified employer legal identity from search.
 // The fetched page's masthead is only evidence of a self-branded site.
 const cleaned=candidates[0];
 if(/^(?:招聘|社会招聘|人才招聘|校园招聘|职位列表|加入我们|welcome|careers?|jobs?)$/i.test(cleaned))return null;
 return {name:cleaned,content:body,site_url:site.url,host:site.host,domain:site.domain};
}
function titleRelated(value,role){
 const raw=text(value,180).toLowerCase().replace(/\s+/g,'');
 const target=role.toLowerCase().replace(/\s+/g,'');
 const short=target.replace(/(?:工程师|专员|经理|师|助理)$/u,'');
 return raw.includes(target)||short.length>=3&&raw.includes(short);
}
function queryPlan(role){
 return [
  role+' 中国大陆 社会招聘 企业官方招聘官网',
  role+' 企业招聘 岗位详情 官方网站',
  role+' 官方招聘入口 加入我们 中国'
 ];
}
async function provider(key,path,payload,fetcher,timeout=17000){
 let response;
 try{response=await fetcher('https://api.deepseek.com/v1/tools/'+path,{
  method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(timeout),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,Accept:'application/json'},
  body:JSON.stringify(payload)})}
 catch{return null}
 if(!response.ok||response.status>=300&&response.status<400)return null;
 const declared=Number(response.headers?.get?.('content-length')||0);
 if(declared>450000)return null;
 try{
  const d=await response.json();
  if(JSON.stringify(d).length>450000)return null;
  return d;
 }catch{return null}
}
function companyPageScore(site,metadata){
 const h=site.host;
 const path=new URL(site.url).pathname;
 const careerHost=/^(?:careers?|jobs|hr|zhaopin|recruit|join)\./i.test(h);
 const careerPath=ROOT_JOB.test(path);
 return (careerHost?9:0)+(careerPath?5:0)+
  (RECRUIT.test(text(metadata?.title,150))?2:0)+
  (site.url.endsWith('/')?1:0);
}
function validOfficialLink(url,kind){
 return kind==='JOB_DETAIL'?publicJobLink(url):publicCorporatePage(url);
}
export async function discoverOfficialRecruitmentLinks(role,key,{
 fetcher=fetch,now=new Date(),limit=10
}={}){
 const intent=[...new Set((Array.isArray(role)?role:[role]).map(sanitizedJobIntent).filter(Boolean))][0];
 const desired=Math.max(1,Math.min(10,Number.isInteger(limit)?limit:10));
 const usage={model:0,search:0,fetch:0},meter=emptyV8CostMeter();
 const empty=(status)=>({
  kind:LINK_DISCOVERY_VERSION,status,quality_status:'NO_VERIFIED_OFFICIAL_LINKS',
  opportunities:[],usage,limit:LINK_DISCOVERY_LIMITS,
  accounting:buildV8CostReport(usage,meter),
  stats:{searched_links:0,verified_sources:0,job_direct:0,career_entries:0}
 });
 if(!intent||typeof key!=='string'||key.length<16)return empty('NOT_READY');
 const searches=queryPlan(intent),sites=new Map(),jobs=new Map(),errors=[];
 // No extra model calls. Search queries contain ONLY the normalized occupation.
 for(const query of searches){
  usage.search++;
  const result=await provider(key,'search',{query,count:12,need_content:false},fetcher);
  if(!result||!Array.isArray(result.results)){errors.push('SEARCH_UNAVAILABLE');continue}
  if(result.results.length)meter.billable_search++;
  for(const row of result.results.slice(0,12)){
   if(!row||typeof row.url!=='string')continue;
   const corporate=publicCorporatePage(row.url);
   if(corporate&&!FOREIGN.test(text(row.title,160)+' '+text(row.snippet,400))){
    const meta={title:text(row.title,160),snippet:text(row.snippet,400)};
    if(!sites.has(corporate.url))sites.set(corporate.url,{...corporate,meta});
   }
   const job=publicJobLink(row.url);
   if(job&&titleRelated(row.title,intent)&&
    !FOREIGN.test(text(row.title,160)+' '+text(row.snippet,400))&&
    !CLOSED.test(text(row.title,160)+' '+text(row.snippet,400))){
    jobs.set(job.url,{...job,title_hint:text(row.title,160)});
   }
  }
 }
 const candidates=[...sites.values()].sort((a,b)=>companyPageScore(b,b.meta)-companyPageScore(a,a.meta));
 // Discovery may contain job detail links but not its source homepage. Those
 // are only routing hints; the independent first-party career source MUST be fetched.
 for(const job of jobs.values()){
  for(const path of ['/', '/careers']){
   const url='https://'+job.hostname+path,site=publicCorporatePage(url);
   if(site&&!sites.has(site.url)&&sites.size<65&&job.domain!== 'feishu.cn'&&job.domain!=='hotjob.cn'){
    sites.set(site.url,{...site,meta:{title:job.title_hint}});
   }
  }
 }
 const ranked=[...sites.values()].sort((a,b)=>companyPageScore(b,b.meta)-companyPageScore(a,a.meta));
 const trusted=[],seenHost=new Set();
 for(const site of ranked){
  if(trusted.length>=6||usage.fetch>=LINK_DISCOVERY_LIMITS.fetch)break;
  // Diversify among employers rather than spending entire budget on one firm.
  if(seenHost.has(site.domain))continue;
  seenHost.add(site.domain);
  usage.fetch++;
  const response=await provider(key,'fetch',{url:site.url},fetcher,17000);
  if(!response||typeof response.content!=='string')continue;
  if(response.content.length)meter.billable_fetch++;
  const found=brand(response,site);
  if(!found)continue;
  trusted.push(found);
 }
 const options=[];
 for(const site of trusted){
  // A first-party job URL need not have a fully parsed JD; name and role
  // are SEARCH HINTS only. City, eligibility, deadline and open status remain
  // unknown. Never feed navigation opportunities into hard-gate job ranking.
  const firstParty=[...jobs.values()].filter(job=>job.domain===site.domain&&
   job.domain!=='feishu.cn'&&job.domain!=='hotjob.cn');
  for(const job of firstParty.slice(0,2)){
   if(!validOfficialLink(job.url,'JOB_DETAIL'))continue;
   options.push({
    kind:'JOB_DETAIL',url:job.url,company:site.name,
    title:job.title_hint||'相关岗位详情',role:intent,
    source_evidence:'FIRST_PARTY_CAREERS_PAGE_READ',
    source_url:site.site_url,workplace:'以企业官网为准',
    qualification_status:'NOT_CHECKED',hiring_status:'UNCONFIRMED',
    label:'具体岗位链接（待官网确认）'
   });
  }
  // Shared ATS may be shown only if the employer's fetched site
  // explicitly links to THAT company's exact vacancy or named tenant board.
  for(const job of jobs.values()){
   if(job.domain!=='feishu.cn'&&job.domain!=='hotjob.cn')continue;
   const backlink=companyLinkFromPage(site.content,job.url);
   if(!backlink)continue;
   options.push({
    kind:'JOB_DETAIL',url:job.url,company:site.name,
    title:job.title_hint||'相关岗位详情',role:intent,
    source_evidence:backlink.method,source_url:site.site_url,
    workplace:'以企业官网为准',qualification_status:'NOT_CHECKED',
    hiring_status:'UNCONFIRMED',label:'企业招聘系统职位链接（待确认）'
   });
  }
  options.push({
   kind:'CAREERS_ENTRY',url:site.site_url,company:site.name,
   title:'官方招聘入口',role:intent,
   source_evidence:'FIRST_PARTY_CAREERS_PAGE_READ',
   source_url:site.site_url,workplace:'中国大陆岗位需在官网筛选',
   qualification_status:'NOT_CHECKED',hiring_status:'UNCONFIRMED',
   label:'企业招聘入口（岗位待自行筛选）'
  });
 }
 // Per employer: direct job first, generic hiring landing only as fallback.
 // Prefer diversity and avoid repetitive URLs and company duplicates.
 options.sort((a,b)=>(a.kind==='JOB_DETAIL'?-1:1)-(b.kind==='JOB_DETAIL'?-1:1));
 const output=[],usedCompany=new Set(),usedUrls=new Set();
 for(const item of options){
  if(output.length>=desired)break;
  if(!validOfficialLink(item.url,item.kind)||usedUrls.has(item.url))continue;
  const identity=item.company+'|'+new URL(item.source_url).hostname;
  if(usedCompany.has(identity))continue;
  usedCompany.add(identity);usedUrls.add(item.url);output.push(item);
 }
 return {
  kind:LINK_DISCOVERY_VERSION,
  status:errors.length?'PARTIAL':'COMPLETE',
  quality_status:output.length?'VERIFIED_SOURCE_LINKS':'NO_VERIFIED_OFFICIAL_LINKS',
  opportunities:output,usage,limit:LINK_DISCOVERY_LIMITS,
  accounting:buildV8CostReport(usage,meter,{uncertain_provider_failure:errors.length>0}),
  stats:{searched_links:sites.size+jobs.size,verified_sources:trusted.length,
   job_direct:output.filter(x=>x.kind==='JOB_DETAIL').length,
   career_entries:output.filter(x=>x.kind==='CAREERS_ENTRY').length},
  disclaimer:'公开招聘链接导航，不保证特定岗位目前开放、中国大陆工作地或申请资格。请在企业官方页面核实。'
 };
}
