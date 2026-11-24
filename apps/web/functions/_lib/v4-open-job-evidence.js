// V4: verify evidence on any public HTTPS employer page; no company or job-path whitelist.
// Read-only public HTML only. Never treat a search snippet as an independently verified job.
import {htmlToText,extractOfficialJdSections} from './official-job-evidence.js';
import {findMainlandCity} from './mainland-job-location.js';
import {sha256Hex} from './real-auth.js';
const LOCAL=/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|nip\.io|sslip\.io|localtest\.me)$/i;
const CLOSED=/(?:职位已关闭|岗位已下线|停止招聘|不再接受申请|职位已过期|招聘已结束|position (?:closed|expired)|job (?:closed|expired))/i;
const GENERIC=/^(?:招聘|岗位详情|职位详情|职业机会|人才招聘|职位|招聘信息|job details|jobs|careers|recruitment|job opening)$/i;
const trim=s=>typeof s==='string'?s.trim():'';
export function v4PublicJobUrl(value){
 if(typeof value!=='string'||value.length>2000)return null;
 try{
  const u=new URL(value.trim()),h=u.hostname.replace(/\.$/,'').toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return null;
  if(!h.includes('.')||h.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||LOCAL.test(h))return null;
  if(/(?:^|\.)example\.(?:com|net|org)$/.test(h))return null;
  u.hash='';
  return u.href;
 }catch{return null}
}
function meta(html,attr,key){
 for(const t of html.match(/<meta\b[^>]*>/gi)||[]){
  if(!new RegExp('\\b'+attr+'\\s*=\\s*["\x27]'+key+'["\x27]','i').test(t))continue;
  const m=t.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if(m)return htmlToText(m[1]||m[2]).trim();
 }
 return '';
}
function tag(html,name){
 const m=new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)<\\/'+name+'>','i').exec(html);
 return m?htmlToText(m[1]).trim():'';
}
function pageTitle(html){
 for(const v of [tag(html,'h1'),meta(html,'property','og:title'),tag(html,'title')]){
  const s=v.split(/\s+[|｜]\s+| - | — /)[0].trim();
  if(s.length>=2&&s.length<=86&&!GENERIC.test(s))return s;
 }
 return '';
}
function postings(html){
 const found=[];
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  if(m[1].length>100000)continue;
  try{
   const root=JSON.parse(m[1]);
   const visit=(v,depth)=>{
    if(!v||depth>7||typeof v!=='object')return;
    if(Array.isArray(v)){v.forEach(x=>visit(x,depth+1));return}
    const t=v['@type'],a=Array.isArray(t)?t:[t];
    if(a.some(x=>typeof x==='string'&&/(?:^|\/)JobPosting$/i.test(x)))found.push(v);
    if(v['@graph'])visit(v['@graph'],depth+1);
    if(v.mainEntity)visit(v.mainEntity,depth+1);
   };
   visit(root,0);
  }catch{}
 }
 return found;
}
function companyOf(j){
 const o=j.hiringOrganization;
 if(typeof o==='string')return {name:o,url:''};
 return {name:trim(o?.name),url:trim(o?.url)||trim(o?.sameAs)};
}
function relatedDomains(jobUrl,companyUrl){
 if(!companyUrl)return true;
 try{
  const a=new URL(jobUrl).hostname.replace(/^www\./,'');
  const b=new URL(companyUrl).hostname.replace(/^www\./,'');
  return a===b||a.endsWith('.'+b)||b.endsWith('.'+a);
 }catch{return false}
}
function postedLocation(j){
 const places=Array.isArray(j.jobLocation)?j.jobLocation:[j.jobLocation];
 for(const place of places){
  const a=place?.address||place;
  for(const v of [a?.addressLocality,a?.addressRegion,a?.streetAddress]){
   if(typeof v==='string'){const city=findMainlandCity(v);if(city)return city}
  }
 }
 return null;
}
function htmlLocation(plain){
 const m=plain.match(/(?:工作地点|工作城市|办公地点|工作地区|工作区域|Work Location|Location)\s*[：:\s]\s*([^\n]{2,80})/i);
 return m?findMainlandCity(m[1]):null;
}
async function limitedRead(r){
 if(r.status!==200)throw Error('V4_PAGE_UNAVAILABLE');
 const ct=(r.headers.get('content-type')||'').toLowerCase();
 if(!ct.includes('text/html')&&!ct.includes('text/plain'))throw Error('V4_PAGE_NOT_HTML');
 const max=550000,cl=Number(r.headers.get('content-length')||0);
 if(cl>max||!r.body)throw Error('V4_PAGE_TOO_LARGE');
 const reader=r.body.getReader(),chunks=[];let len=0;
 try{for(;;){
  const chunk=await reader.read();if(chunk.done)break;
  len+=chunk.value.byteLength;
  if(len>max){await reader.cancel();throw Error('V4_PAGE_TOO_LARGE')}
  chunks.push(chunk.value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(len);let i=0;
 for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length}
 return new TextDecoder().decode(bytes);
}
export async function v4ReadEmployerJob(url,{fetcher=fetch,signal,now=new Date()}={}){
 const canonical=v4PublicJobUrl(url);
 if(!canonical)throw Error('V4_UNSAFE_URL');
 const timeout=AbortSignal.timeout(12000);
 const r=await fetcher(canonical,{method:'GET',redirect:'manual',cache:'no-store',
  headers:{Accept:'text/html,text/plain;q=0.9'},signal:signal?AbortSignal.any([signal,timeout]):timeout});
 const html=await limitedRead(r),plain=htmlToText(html);
 if(CLOSED.test(plain.slice(0,12000)))throw Error('V4_JOB_CLOSED');
 for(const j of postings(html)){
  const org=companyOf(j),title=trim(j.title);
  const city=postedLocation(j)||htmlLocation(plain),desc=htmlToText(trim(j.description));
  if(!org.name||GENERIC.test(org.name)||!title||GENERIC.test(title)||!city||desc.length<90)continue;
  if(j.validThrough&&Number.isFinite(Date.parse(j.validThrough))&&Date.parse(j.validThrough)<now.getTime())continue;
  // A multinational's official careers host may differ from its corporate website.
  // Do not discard real JD content merely because the domains differ.
  const sections=extractOfficialJdSections(desc);
  const requirements=sections?.sections?.filter(x=>x.kind==='requirements').map(x=>x.text).join('\n')||'';
  if(!sections||requirements.length<18)continue;
  return {id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
   canonical_url:canonical,company:org.name.slice(0,100),title:title.slice(0,86),
   location:city,requirements:requirements.slice(0,5500),full_jd:sections.full_jd,
   checked_at:now.toISOString(),proof_method:'V4_STRUCTURED_JOBPOSTING',
   source_confirmed:!!org.url&&relatedDomains(canonical,org.url),application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
 }
 // Chinese employer career sites often serve normal HTML without JSON-LD.
 const sections=extractOfficialJdSections(plain),title=pageTitle(html);
 const company=meta(html,'property','og:site_name')||meta(html,'name','application-name');
 const city=htmlLocation(plain);
 const requirements=sections?.sections?.filter(x=>x.kind==='requirements').map(x=>x.text).join('\n')||'';
 if(!title||!company||GENERIC.test(company)||!city||!sections||requirements.length<18)
  throw Error('V4_JOB_DETAILS_NOT_VERIFIED');
 return {id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
  canonical_url:canonical,company:company.slice(0,100),title,location:city,
  requirements:requirements.slice(0,5500),full_jd:sections.full_jd,
  checked_at:now.toISOString(),proof_method:'V4_EMPLOYER_HTML_JOB',
  source_confirmed:false,application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
}
