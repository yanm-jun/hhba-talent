// V4: verify evidence on any public HTTPS employer page; no company or job-path whitelist.
// Read-only public HTML only. Never treat a search snippet as an independently verified job.
import {htmlToText as legacyHtmlToText} from './official-job-evidence.js';
import {sha256Hex} from './real-auth.js';
const LOCAL=/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|nip\.io|sslip\.io|localtest\.me)$/i;
const CLOSED=/(?:职位已关闭|岗位已下线|停止招聘|不再接受申请|职位已过期|招聘已结束|position (?:closed|expired)|job (?:closed|expired))/i;
const GENERIC=/^(?:招聘|岗位详情|职位详情|职业机会|人才招聘|职位|招聘信息|job details|jobs|careers|recruitment|job opening)$/i;
const htmlToText=html=>legacyHtmlToText(html,{unbounded:true});
// Only use actual source text. Section labels are optional display metadata,
// not a requirement for a structured employer JobPosting to be accepted.
export function v4SourceSections(plain){
 if(typeof plain!=='string'||!plain.trim())return null;
 const lines=plain.split('\n').map(x=>x.trim()).filter(Boolean);
 const full_jd=lines.join('\n');
 return {full_jd,sections:lines.map((text,i)=>({id:'JD-'+String(i+1).padStart(3,'0'),kind:'other',text})),content_status:'VERIFIED_SECTIONS'};
}
const trim=s=>typeof s==='string'?s.trim():'';
export function v4PublicJobUrl(value){
 if(typeof value!=='string')return null;
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
  if(s.length>=2&&!GENERIC.test(s))return s;
 }
 return '';
}
function postings(html){
 const found=[];
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const root=JSON.parse(m[1]);
   const pending=[root];
   while(pending.length){
    const v=pending.pop();
    if(!v||typeof v!=='object')continue;
    if(Array.isArray(v)){for(const x of v)pending.push(x);continue}
    const t=v['@type'],a=Array.isArray(t)?t:[t];
    if(a.some(x=>typeof x==='string'&&/(?:^|\/)JobPosting$/i.test(x)))found.push(v);
    if(v['@graph'])pending.push(v['@graph']);
    if(v.mainEntity)pending.push(v.mainEntity);
   }
  }catch{}
 }
 return found;
}
function companyOf(j){
 const o=j.hiringOrganization;
 if(typeof o==='string')return {name:o,url:''};
 return {name:trim(o?.name),url:trim(o?.url)||trim(o?.sameAs)};
}
export function relatedDomains(jobUrl,companyUrl){
 if(!companyUrl)return true;
 try{
  const a=new URL(jobUrl).hostname.replace(/^www\./,'');
  const b=new URL(companyUrl).hostname.replace(/^www\./,'');
  return a===b||a.endsWith('.'+b)||b.endsWith('.'+a);
 }catch{return false}
}
function postedLocation(j){
 const places=Array.isArray(j.jobLocation)?j.jobLocation:[j.jobLocation];
 const values=[];
 for(const place of places){
  const a=place?.address||place;
  if(typeof a==='string'){if(a.trim())values.push(a.trim());continue;}
  if(!a)continue;
  const country=typeof a.addressCountry==='string'?a.addressCountry:a.addressCountry?.name;
  if(country&&!/^(CN|CHN|中国|中国大陆|中华人民共和国|China|Mainland China)$/i.test(country.trim()))continue;
  const parts=[a.addressRegion,a.addressLocality,a.streetAddress].filter(x=>typeof x==='string'&&x.trim());
  if(parts.length)values.push([...new Set(parts)].join(' '));
 }
 return [...new Set(values)].join(' / ')||null;
}
function htmlLocation(plain){
 const m=plain.match(/(?:工作地点|工作城市|办公地点|工作地区|工作区域|Work Location|Location)\s*[：:\s]\s*([^\n]+)/i);
 return m?m[1].trim():null;
}
// Follow public HTTPS same-organization redirects without forwarding credentials.
async function fetchPublicPage(canonical,fetcher,signal){
 const visited=new Set();let current=canonical;
 for(;;){
  if(visited.has(current))throw Error('V4_PAGE_REDIRECT_LOOP');
  visited.add(current);
  const response=await fetcher(current,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:'text/html,text/plain;q=0.9'},signal});
  if(![301,302,303,307,308].includes(response.status))return {response,resolved:current};
  const location=response.headers.get('Location');
  await response.body?.cancel().catch(()=>{});
  let next;try{next=v4PublicJobUrl(new URL(location,current).href)}catch{}
  if(!location||!next||!relatedDomains(canonical,next))throw Error('V4_PAGE_REDIRECT_UNVERIFIED');
  current=next;
 }
}
const normalizedPlace=s=>trim(s).normalize('NFKC').replace(/[\s,，、/]/g,'').toLowerCase();
const matchesPlace=(a,b)=>{const x=normalizedPlace(a),y=normalizedPlace(b);return Boolean(x&&y&&(x.includes(y)||y.includes(x)));};
async function limitedRead(r){
 if(r.status===429||r.status>=500)throw Object.assign(Error('V4_PAGE_TEMPORARILY_UNAVAILABLE'),{code:'V4_PAGE_TEMPORARILY_UNAVAILABLE'});
 if(r.status!==200)throw Error('V4_PAGE_UNAVAILABLE');
 const ct=(r.headers.get('content-type')||'').toLowerCase();
 if(!ct.includes('text/html')&&!ct.includes('text/plain'))throw Error('V4_PAGE_NOT_HTML');
 // Resource-safety guard for untrusted remote pages, not a search or result quota.
 // A page that exceeds it remains an unverified AI lead.
 const max=8*1024*1024,cl=Number(r.headers.get('content-length')||0);
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
export async function v4ReadPublicPage(url,{fetcher=fetch,signal}={}){
 const canonical=v4PublicJobUrl(url);if(!canonical)throw Error('V4_UNSAFE_URL');
 const {response,resolved}=await fetchPublicPage(canonical,fetcher,signal);
 const html=await limitedRead(response),plain=htmlToText(html,{unbounded:true});
 return {canonical,resolved,html,plain};
}
export async function v4ReadEmployerJob(url,{fetcher=fetch,signal,now=new Date(),expectedTitle,expectedLocation,allowUnstructured=false}={}){
 const canonical=v4PublicJobUrl(url);
 if(!canonical)throw Error('V4_UNSAFE_URL');
 const {response:r,resolved}=await fetchPublicPage(canonical,fetcher,signal);
 const html=await limitedRead(r),plain=htmlToText(html,{unbounded:true});
 const expected=typeof expectedTitle==='string'&&!/待核实/.test(expectedTitle)?expectedTitle.normalize('NFKC').replace(/\s+/g,'').toLowerCase():'';
 const all=postings(html);
 const isClosed=j=>CLOSED.test(trim(j.description))||Boolean(j.validThrough&&Number.isFinite(Date.parse(j.validThrough))&&Date.parse(j.validThrough)<now.getTime());
 const titled=all.filter(j=>!expected||trim(j.title).normalize('NFKC').replace(/\s+/g,'').toLowerCase()===expected);
 const expectedPlace=typeof expectedLocation==='string'&&!/待核实|全国|不限/.test(expectedLocation)?expectedLocation:'';
 const scoped=expectedPlace?titled.filter(j=>matchesPlace(postedLocation(j)||htmlLocation(plain),expectedPlace)):titled;
 if((titled.length&&titled.every(isClosed))||(!all.length&&CLOSED.test(plain)&&!allowUnstructured))throw Error('V4_JOB_CLOSED');
 const open=scoped.filter(j=>!isClosed(j));
 // Never guess which of multiple identical titles is meant. The unstructured
 // research path can resolve location and identity from actual source evidence.
 for(const j of (open.length===1&&!(all.length===1&&CLOSED.test(plain))?open:[])){
  const org=companyOf(j),title=trim(j.title);
  const city=postedLocation(j)||htmlLocation(plain),desc=htmlToText(trim(j.description),{unbounded:true});
  if(expected&&title.normalize('NFKC').replace(/\s+/g,'').toLowerCase()!==expected)continue;
  if(!org.name||GENERIC.test(org.name)||!title||GENERIC.test(title)||!city||!desc.trim())continue;
  if(j.validThrough&&Number.isFinite(Date.parse(j.validThrough))&&Date.parse(j.validThrough)<now.getTime())continue;
  // A multinational's official careers host may differ from its corporate website.
  // Do not discard real JD content merely because the domains differ.
  const sections=v4SourceSections(desc);
  if(!sections)continue;
  const requirements=sections.full_jd;
  return {id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
   canonical_url:canonical,resolved_url:resolved,company:org.name,title,
   location:city,requirements,full_jd:sections.full_jd,
   checked_at:now.toISOString(),proof_method:'V4_STRUCTURED_JOBPOSTING',
   source_confirmed:!!org.url&&relatedDomains(resolved,org.url),application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
 }
 // Chinese employer career sites often serve normal HTML without JSON-LD.
 const sections=v4SourceSections(plain),title=pageTitle(html);
 const company=meta(html,'property','og:site_name')||meta(html,'name','application-name');
 const city=htmlLocation(plain);
 const requirements=sections?.full_jd||'';
 if(allowUnstructured&&plain.trim())return {canonical_url:canonical,resolved_url:resolved,company,title,location:city,source_text:plain,source_confirmed:false,proof_method:'V4_EMPLOYER_HTML_JOB',checked_at:now.toISOString()};
 if(!title||!company||GENERIC.test(company)||!city||!sections)
  throw Error('V4_JOB_DETAILS_NOT_VERIFIED');
 return {id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
  canonical_url:canonical,resolved_url:resolved,company,title,location:city,
  requirements,full_jd:sections.full_jd,
  checked_at:now.toISOString(),proof_method:'V4_EMPLOYER_HTML_JOB',
  source_confirmed:false,application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
}
