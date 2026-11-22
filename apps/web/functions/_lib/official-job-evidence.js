// Strictly narrow direct-HTML verification of a publicly available official job JD.
// Do not trust a model-provided search excerpt as a verified employer document.
// No resumes, candidate identities, provider data or secrets are ever cached.
import {safeOfficialJobLocator,extractOfficialJob} from './domestic-search-fetch.js';
import {extractSkillRequirements} from './job-skill-evidence.js';
import {degreeMinRequirement,experienceMinRequirement} from './domestic-match-fusion.js';
import {sha256Hex} from './real-auth.js';
import {isMainlandJobLocation} from './mainland-job-location.js';

export const OFFICIAL_EVIDENCE_VERSION='DIRECT_EMPLOYER_HTML_V1';
export const MEITUAN_DETAIL_SOURCE='MEITUAN_PUBLIC_JOB_DETAIL_V1';
export const TENCENT_DETAIL_SOURCE='TENCENT_PUBLIC_JOB_DETAIL_V1';
const FRESH_MS=24*60*60*1000;
const MAX_RESPONSE=220000;
const DEGREE=['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'];
const canon=raw=>safeOfficialJobLocator(raw);
const xmlEntities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function htmlToText(html){
 const stripped=html
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|svg|noscript|template|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<\s*br\s*\/?>/gi,'\n')
  .replace(/<\/?(?:h[1-6]|p|div|section|article|li|tr|table|ul|ol|header|footer|main)\b[^>]*>/gi,'\n')
  .replace(/<[^>]{0,2000}>/g,' ')
  .replace(/&(#x[\da-f]{1,7}|#\d{1,8}|amp|lt|gt|quot|apos|nbsp);/gi,(m,entity)=>{
   if(entity.startsWith('#')){
    const hex=entity[1].toLowerCase()==='x',num=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
    return num>0&&num<=0x10ffff&&(num<0xd800||num>0xdfff)?String.fromCodePoint(num):' ';
   }
   return xmlEntities[entity.toLowerCase()]||' ';
  });
 return stripped.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n')
  .replace(/\n{3,}/g,'\n\n').slice(0,100000);
}
/**
 * Preserve employer-published JD paragraphs and section boundaries, not a
 * model-written summary. Never claim that a truncated page is complete.
 * HTML/text extraction is still best effort; only source-backed sections
 * pass into the shared archive.
 */
export function extractOfficialJdSections(plain){
 if(typeof plain!=='string'||plain.length<80)return null;
 // Literal headings from public ATS posts, not LLM-guessed section labels.
 const duty=/^(?:岗位职责|工作职责|职位职责|主要职责|工作内容|岗位描述|职位描述|responsibilities|what you(?:'|’)ll do|what you will do|the role|about the role|your impact|key responsibilities|job responsibilities|duties)[：:\s]*/i;
 const req=/^(?:岗位基本要求|岗位要求|任职要求|任职资格|职位要求|资格要求|应聘要求|职责要求|requirements|qualifications|what we(?:'|’)re looking for|what you bring|who you are|skills and experience|your qualifications|basic qualifications|minimum qualifications)[：:\s]*/i;
 const footer=/^(?:立即申请|立即投递|投递简历|申请职位|相关职位|推荐岗位|更多职位|企业简介|友情链接|隐私政策|联系我们)\s*$/;
 const lines=plain.split('\n').map(x=>x.replace(/[\t\u0000]+/g,' ')
  .replace(/ +/g,' ').trim()).filter(Boolean);
 const start=lines.findIndex(x=>duty.test(x));
 if(start<0||!lines.slice(start+1).some(x=>req.test(x)))return null;
 const blocks=[];let kind='other',seenDuty=false,seenReq=false;
 for(const line of lines.slice(start)){
  if(footer.test(line))break;
  if(duty.test(line)){kind='responsibilities';seenDuty=true;}
  else if(req.test(line)){kind='requirements';seenReq=true;}
  if(kind==='other')continue;
  if(line.length<3||line.length>4000)continue;
  // Guard against scraping navigation/footer rather than a single vacancy.
  if(blocks.length>=120)break;
  blocks.push({id:'JD-'+String(blocks.length+1).padStart(3,'0'),kind,text:line});
 }
 if(!seenDuty||!seenReq||blocks.length<4)return null;
 const full_jd=blocks.map(b=>b.text).join('\n');
 if(full_jd.length<80||full_jd.length>24000)return null;
 return {full_jd,sections:blocks,content_status:'VERIFIED_SECTIONS'};
}

async function readLimited(response){
 const declared=response.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_RESPONSE))throw Error('OFFICIAL_PAGE_TOO_LARGE');
 if(!response.body)throw Error('OFFICIAL_PAGE_EMPTY');
 const reader=response.body.getReader(),chunks=[];let n=0;
 try{for(;;){const part=await reader.read();if(part.done)break;
  n+=part.value.byteLength;if(n>MAX_RESPONSE){await reader.cancel();throw Error('OFFICIAL_PAGE_TOO_LARGE');}
  chunks.push(part.value);
 }}finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('OFFICIAL_PAGE_DECODE_FAILED');}
}
async function publicEmployerDetail(locator,{title,location,duties,requirements,workYear},method,now){
 if(typeof title!=='string'||title.trim().length<2||title.trim().length>86||
  typeof location!=='string'||location.length>100||!isMainlandJobLocation(location)||
  typeof duties!=='string'||typeof requirements!=='string'||!duties.trim()||!requirements.trim())
  throw Error('OFFICIAL_JD_NOT_VERIFIED');
 title=title.trim();
 const experience=typeof workYear==='string'&&workYear.trim()?'工作经验：'+workYear.trim():'';
 const sections=extractOfficialJdSections(
  ['岗位职责',htmlToText(duties),'任职要求',htmlToText(requirements),experience].filter(Boolean).join('\n'));
 if(!sections)throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const qualifications=sections.sections.filter(section=>section.kind==='requirements')
  .map(section=>section.text).join('\n');
 const id='verified-official-'+(await sha256Hex(locator.url)).slice(0,32);
 const jdHash=await sha256Hex([locator.url,title,location,qualifications].join('\n'));
 return {id,canonical_url:locator.url,company:locator.company,title,location,
  requirements:qualifications,jd_hash:jdHash,checked_at:new Date(now).toISOString(),
  proof_method:OFFICIAL_EVIDENCE_VERSION,retrieval_method:method,...sections};
}
async function meituanOfficialJobEvidence(locator,{fetcher,now,signal}){
 const jobUnionId=new URL(locator.url).searchParams.get('jobUnionId');
 // The public vacancy page makes this same read-only request. Its HTML
 // response is a JS shell, so the official duties are in the JSON response.
 const response=await fetcher('https://zhaopin.meituan.com/api/official/job/getJobDetail',{
  method:'POST',redirect:'manual',cache:'no-store',signal,
  headers:{Accept:'application/json','Content-Type':'application/json'},
  body:JSON.stringify({jobUnionId,jobShareType:'1'})
 });
 if(response.status!==200||!response.headers.get('Content-Type')?.includes('application/json'))
  throw Error('OFFICIAL_PAGE_UNAVAILABLE');
 const result=JSON.parse(await readLimited(response));
 const job=result?.data;
 if(result?.status!==1||job?.jobUnionId!==jobUnionId||job?.jobStatus!=='000')
  throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const cities=Array.isArray(job.cityList)?job.cityList.map(city=>city?.name):[];
 if(!cities.length||!cities.every(city=>typeof city==='string'&&isMainlandJobLocation(city)))
  throw Error('OFFICIAL_JD_NOT_VERIFIED');
 return publicEmployerDetail(locator,{title:job.name,location:[...new Set(cities)].join('、'),
  duties:job.jobDuty,requirements:job.jobRequirement,workYear:job.workYear},MEITUAN_DETAIL_SOURCE,now);
}
async function tencentOfficialJobEvidence(locator,{fetcher,now,signal}){
 const postId=new URL(locator.url).searchParams.get('postId');
 const query=new URLSearchParams({timestamp:String(Date.now()),postId,language:'zh-cn'});
 const response=await fetcher('https://careers.tencent.com/tencentcareer/api/post/ByPostId?'+query,{
  method:'GET',redirect:'manual',cache:'no-store',signal,headers:{Accept:'application/json'}
 });
 if(response.status!==200||!response.headers.get('Content-Type')?.includes('application/json'))
  throw Error('OFFICIAL_PAGE_UNAVAILABLE');
 const result=JSON.parse(await readLimited(response)),job=result?.Data;
 if(result?.Code!==200||job?.PostId!==postId)throw Error('OFFICIAL_JD_NOT_VERIFIED');
 return publicEmployerDetail(locator,{title:job.RecruitPostName,location:job.LocationName,
  duties:job.Responsibility,requirements:job.Requirement,workYear:job.RequireWorkYearsName},TENCENT_DETAIL_SOURCE,now);
}
export async function directOfficialJobEvidence(url,{fetcher=fetch,now=new Date(),signal}={}){
 const locator=canon(url);
 if(!locator)throw Error('OFFICIAL_URL_NOT_SUPPORTED');
 const timeout=AbortSignal.timeout(12000);
 const mergedSignal=signal?AbortSignal.any([signal,timeout]):timeout;
 if(locator.domain==='zhaopin.meituan.com')
  return meituanOfficialJobEvidence(locator,{fetcher,now,signal:mergedSignal});
 const response=await fetcher(locator.url,{
  method:'GET',redirect:'manual',cache:'no-store',signal:mergedSignal,
  headers:{Accept:'text/html,text/plain;q=0.9','User-Agent':'HHBA-JobEvidence/1.0'}
 });
 if(response.status!==200){
  const error=new Error('OFFICIAL_PAGE_UNAVAILABLE');
  // Only exact URL 404/410, not timeouts/403/bot blocks, can contribute
  // to a repeated and time-spaced closure confirmation.
  if(response.status===404||response.status===410)error.httpStatus=response.status;
  throw error;
 }
 const type=(response.headers.get('Content-Type')||'').toLowerCase();
 if(!type.includes('text/html')&&!type.includes('text/plain'))throw Error('OFFICIAL_PAGE_UNREADABLE');
 const raw=await readLimited(response);
 const plain=type.includes('text/html')?htmlToText(raw):raw;
 const item=extractOfficialJob({url:locator.url},{content:plain},now);
 // The Tencent detail page may only contain its rendering shell. The
 // employer's public API binds the returned content to the same exact ID.
 if(locator.domain==='careers.tencent.com'&&(!item||!extractOfficialJdSections(plain)))
  return tencentOfficialJobEvidence(locator,{fetcher,now,signal:mergedSignal});
 if(!item||item.official_url!==locator.url||item.company!==locator.company||
  item.source_status!=='OFFICIAL_DETAIL_FETCHED')throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const requirements=item.evidence?.requirement;
 const fullJD=extractOfficialJdSections(plain);
 if(typeof requirements!=='string'||requirements.length<25)throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const checked_at=new Date(now).toISOString();
 const id='verified-official-'+(await sha256Hex(locator.url)).slice(0,32);
 const jd_hash=await sha256Hex([locator.url,item.title,item.location,requirements].join('\n'));
 return {id,canonical_url:locator.url,company:item.company,title:item.title,
  location:item.location,requirements,jd_hash,proof_method:OFFICIAL_EVIDENCE_VERSION,checked_at,
  ...(fullJD||{})};
}
export async function validatedCachedOfficialJob(row,now=Date.now()){
 if(!row||typeof row!=='object'||row.proof_method!==OFFICIAL_EVIDENCE_VERSION)return null;
 const locator=canon(row.canonical_url);
 if(!locator||locator.url!==row.canonical_url||locator.company!==row.company)return null;
 const age=now-Date.parse(row.checked_at||'');
 if(!Number.isFinite(age)||age < -300000||age>FRESH_MS)return null;
 if(!row.title||typeof row.title!=='string'||row.title.length>86||
  typeof row.location!=='string'||row.location.length>80||
  typeof row.requirements!=='string'||row.requirements.length<25||row.requirements.length>5500)return null;
 const expectedId='verified-official-'+(await sha256Hex(locator.url)).slice(0,32);
 if(expectedId!==row.id)return null;
 const expectedHash=await sha256Hex([locator.url,row.title,row.location,row.requirements].join('\n'));
 if(expectedHash!==row.jd_hash)return null;
 const skills=extractSkillRequirements(row.requirements);
 const minYears=experienceMinRequirement(row.requirements);
 const rank=degreeMinRequirement(row.requirements);
 return {id:row.id,title:row.title,company:row.company,location:row.location,
  platform:'verified-official-html',official_url:row.canonical_url,
  required_skills:skills.required,mandatory_skills:skills.mandatory,
  preferred_skills:skills.preferred,unclassified_skills:skills.unclassified,
  min_experience_years:minYears,minimum_education:rank===null?null:DEGREE[rank-1],
  proof_hash:row.jd_hash,updated_at:row.checked_at,
  source_label:'由 HHBA 服务端直接读取受支持企业招聘官网的岗位详情',
  application_status:'NOT_REALTIME_CONFIRMED'};
}
