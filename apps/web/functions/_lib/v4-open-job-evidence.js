// V4: verify evidence on any public HTTPS employer page; no company or job-path whitelist.
// Read-only public HTML only. Never treat a search snippet as an independently verified job.
import {htmlToText,extractOfficialJdSections} from './official-job-evidence.js';
import {findMainlandCity} from './mainland-job-location.js';
import {sha256Hex} from './real-auth.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';
import {readConditionalJd,canReuseConditionalJd,writeConditionalJd} from './v4-public-jd-cache.js';
import {structuredJdParts,looksTruncatedJd} from './v4-jd-completeness.js';
const LOCAL=/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|nip\.io|sslip\.io|localtest\.me)$/i;
const CLOSED=/(?:职位已关闭|岗位已下线|停止招聘|不再接受申请|职位已过期|招聘已结束|position (?:closed|expired)|job (?:closed|expired))/i;
const GENERIC=/^(?:招聘|岗位详情|职位详情|职业机会|人才招聘|职位|招聘信息|job details|jobs|careers|recruitment|job opening)$/i;
const trim=s=>typeof s==='string'?s.trim():'';
const responseIsJson=r=>/json/i.test(r.headers.get('content-type')||'');
export function v4PublicJobUrl(value){
 if(typeof value!=='string'||!value.trim())return null;
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
  const s=v.trim();
  if(s.length>=2&&!GENERIC.test(s))return s;
 }
 return '';
}
function postings(html){
 const found=[];
 const documents=[...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 if(/^[\s]*[\[{]/.test(html))documents.push(html);
 for(const document of documents){
  try{
   const root=JSON.parse(document);
   const stack=[root];
   while(stack.length){
    const v=stack.pop();if(!v||typeof v!=='object')continue;
    const t=v['@type'],types=Array.isArray(t)?t:[t];
    if(types.some(x=>typeof x==='string'&&/(?:^|\/)JobPosting$/i.test(x)))found.push(v);
    for(const child of Object.values(v))if(child&&typeof child==='object')stack.push(child);
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
async function limitedRead(r,{allowJson=false,allowScript=false,maxBytes=2*1024*1024}={}){
 if(!r.ok||r.status===206)throw Error('V4_PAGE_UNAVAILABLE');
 const ct=(r.headers.get('content-type')||'').toLowerCase();
 if(!ct.includes('text/html')&&!ct.includes('text/plain')&&!(allowJson&&ct.includes('json'))&&!(allowScript&&/(?:javascript|ecmascript)/i.test(ct)))throw Error('V4_PAGE_NOT_HTML');
 const max=maxBytes,cl=Number(r.headers.get('content-length')||0);
 if(cl>max||!r.body){await r.body?.cancel().catch(()=>{});throw Error('V4_PAGE_TOO_LARGE');}
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
// An independently opened employer page may authorize a separate recruitment
// host. Require the actual link and employer identity on the referring page,
// never trust an ATS hostname or the model's assertion on its own.
export async function v4EmployerAuthorization(jobUrl,company,proofUrl,{fetcher=fetch,signal}={}){
 const target=v4PublicJobUrl(jobUrl),chain=(Array.isArray(proofUrl)?proofUrl:[proofUrl]).map(v4PublicJobUrl);
 if(!target||!chain.length||!company||chain.some(u=>!u||u===target||isCommercialRecruitmentBoard(u))||new Set(chain).size!==chain.length||isCommercialRecruitmentBoard(target))return false;
 const normalize=v=>String(v||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const identity=normalize(company);
 if(identity.length<2)return false;
 try{
  for(let i=0;i<chain.length;i++){
   const proof=chain[i],next=chain[i+1]||target;
   const r=await fetcher(proof,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:'text/html,text/plain;q=0.9'},signal});
   const html=await limitedRead(r);
   const site=meta(html,'property','og:site_name')||meta(html,'name','application-name');
   if(isCommercialRecruitmentBoard(proof,{site_name:site}))return false;
   // Each step must be an actual public link, starting at a page bearing employer identity.
   if(i===0&&![site,meta(html,'name','author'),tag(html,'title')].map(normalize).some(v=>v.includes(identity)))return false;
   let linked=false;
   for(const a of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)){
    let resolved;try{resolved=v4PublicJobUrl(new URL((a[1]||a[2]).replace(/&amp;/gi,'&'),proof).href)}catch{continue}
    if(resolved===next){linked=true;break;}
   }
   if(!linked)return false;
  }
  return true;
 }catch(e){if(signal?.aborted)throw e;return false;}
}
export async function v4ReadEmployerJob(url,{fetcher=fetch,signal,now=new Date(),expected,cacheBucket,onCache=()=>{}}={}){
 let canonical=v4PublicJobUrl(url);
 if(!canonical)throw Error('V4_UNSAFE_URL');
 if(isCommercialRecruitmentBoard(canonical))throw Error('V4_COMMERCIAL_BOARD_EXCLUDED');
 // No separate HHBA wall-clock deadline. Retry transient page errors.
 // Keep the public-HTTPS and response-size checks; never follow redirects blindly.
 const initial=canonical;
 const cached=await readConditionalJd(cacheBucket,initial,expected,now.getTime());
 let html,response;
 for(const retry of [false,true]){
  if(signal?.aborted)throw signal.reason;
  const timeout=signal;
  try{
   let r;const visited=new Set();
   for(;;){
    if(visited.has(canonical))throw Error('V4_REPEATED_REDIRECT');visited.add(canonical);
    const conditional=!retry&&canonical===initial&&cached;
    const headers={Accept:'text/html,application/json,text/plain;q=0.9',...(conditional?{'If-None-Match':cached.etag}:{})};
    r=await fetcher(canonical,{method:'GET',redirect:'manual',cache:'no-store',headers,...(timeout?{signal:timeout}:{})});
    if(r.status===304){
     if(conditional&&canReuseConditionalJd(cached,r,canonical,now.getTime())){onCache('JD_PUBLIC_CONDITIONAL_HIT');return {...cached.jd,checked_at:now.toISOString()};}
     // Do not trust an unsolicited or mismatching 304. Read the actual page.
     r=await fetcher(canonical,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:headers.Accept},...(timeout?{signal:timeout}:{})});
    }
    if(![301,302,303,307,308].includes(r.status))break;
    const location=r.headers.get('location');await r.body?.cancel().catch(()=>{});
    const next=location?v4PublicJobUrl(new URL(location,canonical).href):null;
    if(!next||isCommercialRecruitmentBoard(next))throw Error('V4_UNSAFE_REDIRECT');canonical=next;
   }
   if([408,425,429,500,502,503,504].includes(r.status)){await r.body?.cancel().catch(()=>{});throw Error('V4_TRANSIENT_PAGE_ERROR');}
   // A larger, bounded transport budget is for real page bytes, never model output.
   // Larger documents still remain addressable through the window reader.
   response=r;html=await limitedRead(r,{allowJson:true,maxBytes:16*1024*1024});break;
  }catch(e){
   if(signal?.aborted||retry||(!['AbortError','TimeoutError','TypeError'].includes(e?.name)&&e?.message!=='V4_TRANSIENT_PAGE_ERROR'))throw e;
  }
 }
 const siteName=meta(html,'property','og:site_name')||meta(html,'name','application-name');
 if(isCommercialRecruitmentBoard(canonical,{site_name:siteName}))throw Error('V4_COMMERCIAL_BOARD_EXCLUDED');
 const plain=htmlToText(html,{maxChars:Infinity});
 const all=postings(html);
 const titleText=pageTitle(html),explicitClosed=CLOSED.test(titleText)||CLOSED.test(plain.trim())&&plain.trim().length<80;
 const compact=x=>trim(x).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
 const expectedTitle=compact(expected?.title||expected?.role);
 let candidates=all;
 if(all.length>1){const exact=all.filter(j=>{try{return !!j.url&&v4PublicJobUrl(new URL(j.url,canonical).href)===canonical}catch{return false}});
  candidates=exact.length===1?exact:all.filter(j=>expectedTitle&&compact(j.title)===expectedTitle);
  if(candidates.length!==1)throw Error('V4_JOB_DETAILS_AMBIGUOUS');
 }
 if(explicitClosed&&!candidates.length)throw Error('V4_JOB_CLOSED');
 for(const j of candidates){
  const org=companyOf(j),title=trim(j.title);
  const city=postedLocation(j)||htmlLocation(plain),description=htmlToText(trim(j.description),{maxChars:Infinity});
  const desc=structuredJdParts(j,value=>htmlToText(value,{maxChars:Infinity})).join('\n');
  if(!org.name||GENERIC.test(org.name)||!title||GENERIC.test(title)||!city)continue;
  if(explicitClosed||j.validThrough&&Number.isFinite(Date.parse(j.validThrough))&&Date.parse(j.validThrough)<now.getTime())throw Error('V4_JOB_CLOSED');
  // A multinational's official careers host may differ from its corporate website.
  // Do not discard real JD content merely because the domains differ.
  const sections=extractOfficialJdSections(desc,{full:true});
  const requirements=sections?.sections?.filter(x=>x.kind==='requirements').map(x=>x.text).join('\n')||'';
  // JobPosting itself identifies the published description; no required heading vocabulary.
  const incomplete=!desc.trim()||looksTruncatedJd(description)||looksTruncatedJd(desc);
  const jd={id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
   canonical_url:canonical,company:org.name,title,
   location:city,requirements:incomplete?'':requirements||desc,full_jd:incomplete?'':desc,
   vacancy_confirmed:!!org.url&&relatedDomains(canonical,org.url),...(incomplete?{partial_jd:desc,jd_incomplete:true}:{}),
   checked_at:now.toISOString(),proof_method:'V4_STRUCTURED_JOBPOSTING',
   source_confirmed:!!org.url&&relatedDomains(canonical,org.url),independently_read:true,application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
  if(!incomplete&&canonical===initial&&await writeConditionalJd(cacheBucket,initial,expected,response,jd,j.validThrough,now.getTime()))onCache('JD_PUBLIC_CONDITIONAL_STORED');
  return jd;
 }
 // Chinese employer career sites often serve normal HTML without JSON-LD.
 const sections=extractOfficialJdSections(plain,{full:true}),title=pageTitle(html);
 const company=meta(html,'property','og:site_name')||meta(html,'name','application-name');
 const city=htmlLocation(plain);
 const requirements=sections?.sections?.filter(x=>x.kind==='requirements').map(x=>x.text).join('\n')||'';
 if(!title||!company||GENERIC.test(company)||!city)
  throw Error('V4_JOB_DETAILS_NOT_VERIFIED');
 const incomplete=!sections||!requirements.trim()||looksTruncatedJd(sections?.full_jd);
 return {id:'v4-employer-'+(await sha256Hex(canonical)).slice(0,32),
  canonical_url:canonical,company,title,location:city,
  requirements:incomplete?'':requirements,full_jd:incomplete?'':sections.full_jd,
  ...(incomplete?{partial_jd:sections?.full_jd||'',jd_incomplete:true}:{}),
  checked_at:now.toISOString(),proof_method:'V4_EMPLOYER_HTML_JOB',
  source_confirmed:false,independently_read:true,application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
}

/** Independently read an unusual official document for AI-assisted extraction.
 * Bounded bytes protect the Worker; unavailable documents are research leads,
 * not proof of a closed vacancy. Never send a CV to employer pages.
 */
// Hints come from independently read public HTML; they are not ownership proof.
// Read source code as inert text, never execute it in the Worker. Only literal
// recruitment/API paths are hints; templates, secrets and arbitrary hosts are
// not synthesized. Relative browser fetch paths resolve against the document.
export function v4ScriptResourceHints(source,documentUrl,scriptUrl=documentUrl){
 const out=new Map();
 const add=(raw,kind,base)=>{
  const value=raw.replace(/\\\//g,'/').replace(/\\u002[fF]/g,'/').replace(/&amp;/gi,'&');
  if(!/^(?:https:\/\/|\/\/|\/|\.\.?\/)/i.test(value)||/[{}<>\s\\]/.test(value))return;
  let url;try{url=v4PublicJobUrl(new URL(value,base).href)}catch{return;}
  if(!url||isCommercialRecruitmentBoard(url))return;
  const u=new URL(url);
  if(kind==='data'&&!/(?:\/(?:api|graphql|recruit(?:ment)?|career[s]?|job[s]?|position[s]?|vacanc(?:y|ies)|opening[s]?)(?:[\/_.-]|$)|\.json$)/i.test(u.pathname))return;
  if(kind==='script'&&!/\.(?:m?js)$/i.test(u.pathname))return;
  out.set(url,{url,kind});
 };
 for(const m of source.matchAll(/["']((?:https:\/\/|https:\\\/\\\/|\/\/|\/|\.\.?\/)[^"'<>\\\r\n]*(?:\\\/[^"'<>\\\r\n]*)*)["']/gi))add(m[1],'data',documentUrl);
 for(const m of source.matchAll(/(?:\bimport\s*\(|\bfrom\s*|\bimport\s*)["']([^"'\r\n]+)["']/g))add(m[1],'script',scriptUrl);
 return [...out.values()];
}
export function v4PublicResourceHints(html,base,{includeScriptHints=true}={}){
 const target=v4PublicJobUrl(base);if(!target)return [];
 const out=new Map();
 const add=(value,kind)=>{
  if(!value)return;
  let url;try{url=v4PublicJobUrl(new URL(value.replace(/&amp;/gi,'&'),target).href);}catch{return;}
  if(!url||isCommercialRecruitmentBoard(url)||url===target)return;
  if(!out.has(url)||kind==='script'||kind==='style')out.set(url,{url,kind});
 };
 const attr=(tag,name)=>new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i').exec(tag)?.slice(1).find(x=>x!==undefined);
 for(const m of html.matchAll(/<(script|link|iframe|a|div|section)\b[^>]*>/gi)){
  const tag=m[0],name=m[1].toLowerCase();
  if(name==='script')add(attr(tag,'src'),'script');
  if(name==='link'){
   const rel=(attr(tag,'rel')||'').toLowerCase(),as=(attr(tag,'as')||'').toLowerCase();
   if(rel==='stylesheet')add(attr(tag,'href'),'style');
   else if(rel==='modulepreload'||rel==='preload'&&as==='script')add(attr(tag,'href'),'script');
   else if(rel==='preload'&&as==='fetch')add(attr(tag,'href'),'data');
  }
  if(name==='iframe')add(attr(tag,'src'),'frame');
  for(const key of ['data-url','data-api','data-endpoint','data-src'])add(attr(tag,key),'data');
  if(name==='a'){
   const href=attr(tag,'href');if(href&&/(?:job|career|recruit|vacanc|position|\.json(?:[?#]|$)|招聘|职位)/i.test(href))add(href,'link');
  }
 }
 if(includeScriptHints)for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))for(const h of v4ScriptResourceHints(m[1],target))if(!out.has(h.url)&&h.url!==target)out.set(h.url,h);
 return [...out.values()];
}
export async function v4ReadPublicJobDocument(url,{fetcher=fetch,signal,maxBytes=2*1024*1024,scriptSource=false,documentUrl=url}={}){
 let current=v4PublicJobUrl(url);const seen=new Set();
 while(current&&!seen.has(current)&&!isCommercialRecruitmentBoard(current)){
  if(signal?.aborted)throw signal.reason;
  seen.add(current);
  const r=await fetcher(current,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:scriptSource?'application/javascript,text/javascript,text/plain,application/json':'text/html,application/json,text/plain'},signal});
  if([301,302,303,307,308].includes(r.status)){
   const next=r.headers.get('location');await r.body?.cancel().catch(()=>{});
   if(!next)throw Error('V4_REDIRECT_MISSING');
   current=v4PublicJobUrl(new URL(next,current).href);continue;
  }
  const raw=await limitedRead(r,{allowJson:true,allowScript:scriptSource,maxBytes});
  if(scriptSource&&/(?:javascript|ecmascript|text\/plain)/i.test(r.headers.get('content-type')||''))return {url:current,plain:raw,site:'',title:'',resource_hints:v4ScriptResourceHints(raw,documentUrl,current),script_source:true};
  const site=meta(raw,'property','og:site_name')||meta(raw,'name','application-name');
  if(isCommercialRecruitmentBoard(current,{site_name:site}))throw Error('V4_COMMERCIAL_BOARD_EXCLUDED');
  const plain=(responseIsJson(r)?raw:htmlToText(raw,{maxChars:Infinity})).trim();
  if(CLOSED.test(pageTitle(raw))||(plain.length<80&&CLOSED.test(plain)))throw Error('V4_JOB_CLOSED');
  return {url:current,plain,site,title:pageTitle(raw),resource_hints:responseIsJson(r)?[]:v4PublicResourceHints(raw,current),declared_resource_hints:responseIsJson(r)?[]:v4PublicResourceHints(raw,current,{includeScriptHints:false}),document_kind:responseIsJson(r)?'json':'html'};
 }
 throw Error('V4_UNSAFE_OR_REPEATED_REDIRECT');
}


/** Read-only dynamic-page fallback. No account, CV, cookie, authorization or
 * arbitrary script is passed to the browser. Restrict browser traffic to the
 * requested public origin; exact declared script/style and independently read
 * public data/frame URLs may also load. No blanket access to other origins. */
// Walk only declared script dependencies already read as inert source. Do not
// inherit unrelated candidate URLs or wildcard origins from the evidence ledger.
function publicReadResourceUrl(value){
 const url=v4PublicJobUrl(value);
 if(!url||isCommercialRecruitmentBoard(url))return null;
 const u=new URL(url);
 if(/(?:^|[\/_-])(?:login|logout|signin|signout|delete|remove|update|submit|apply|checkout|oauth|auth|token)(?:[\/_-]|$)/i.test(u.pathname)||[...u.searchParams.keys()].some(k=>/token|secret|password|signature|authorization|api[_-]?key/i.test(k)))return null;
 return url;
}
export function v4BrowserResourcePlan(url,resourceHints=[],ledger=[]){
 const target=v4PublicJobUrl(url),hints=new Map(),queue=[...resourceHints,...ledger.filter(r=>r.url===target&&!r.script_source).flatMap(r=>r.resource_hints||[])];
 while(queue.length){
  const h=queue.shift(),u=v4PublicJobUrl(h?.url);
  if(!u||u===target||isCommercialRecruitmentBoard(u)||hints.has(u))continue;
  hints.set(u,{url:u,kind:h.kind});
  if(h.kind==='script')for(const r of ledger)if(r.url===u&&r.script_source===true)queue.push(...(r.resource_hints||[]));
 }
 const publicDataUrls=[...hints.values()].filter(h=>['data','frame'].includes(h.kind)&&publicReadResourceUrl(h.url)&&ledger.some(r=>r.url===h.url&&r.type==='read_page'&&r.mode==='static'&&!r.script_source&&r.offset===0&&r.next_offset===null&&r.text?.trim())).map(h=>h.url);
 return {resourceHints:[...hints.values()],publicDataUrls};
}
// Automatic independent GET for declared public data/frame resources. Browser
// admission needs the same exact URL and a successful public document read;
// redirected or oversized results remain research leads, not allowed origins.
export async function v4PreparePublicBrowserResources(url,{fetcher=fetch,signal,resourceHints=[],ledger=[],onDocument=()=>{}}={}){
 let initial=v4BrowserResourcePlan(url,resourceHints,ledger);
 const records=[...ledger];
 // If the HTML exposes only JS, inspect the next independently declared
 // unread script in this browser pass. Further script dependencies remain
 // addressable by the agent's existing read_page/window tools and later passes.
 if(!initial.resourceHints.some(h=>['data','frame'].includes(h.kind))){
  const hint=initial.resourceHints.find(h=>h.kind==='script'&&publicReadResourceUrl(h.url)&&!records.some(r=>r.url===h.url&&r.script_source));
  if(hint)try{
   const doc=await v4ReadPublicJobDocument(hint.url,{fetcher,signal,scriptSource:true,documentUrl:url});
   if(doc.url===hint.url&&doc.script_source){
    const record={type:'read_page',ok:true,mode:'static',url:doc.url,offset:0,next_offset:null,text:doc.plain,script_source:true,document_url:url,resource_hints:doc.resource_hints||[]};
    records.push(record);onDocument(record);
    initial=v4BrowserResourcePlan(url,resourceHints,records);
   }
  }catch(e){if(signal?.aborted)throw e;}
 }
 for(const hint of initial.resourceHints){
  if(signal?.aborted)throw signal.reason;
  if(!['data','frame'].includes(hint.kind)||initial.publicDataUrls.includes(hint.url))continue;
  if(!publicReadResourceUrl(hint.url))continue;
  try{
   const doc=await v4ReadPublicJobDocument(hint.url,{fetcher,signal});
   if(doc.url!==hint.url||!doc.plain.trim())continue;
   const record={type:'read_page',ok:true,mode:'static',url:doc.url,offset:0,next_offset:null,text:doc.plain,resource_hints:doc.resource_hints||[]};
   records.push(record);onDocument(record);
  }catch(e){if(signal?.aborted)throw e;}
 }
 return v4BrowserResourcePlan(url,initial.resourceHints,records);
}
// Read a separately hosted JSON JD even when browser CORS prevents the
// employer application from rendering it. Ownership is inherited only from an
// already independently confirmed vacancy and its fresh exact HTML declaration.
// Require the structured posting itself to point to that same landing URL.
export async function v4ReadDeclaredStructuredJob(parent,document,{fetcher=fetch,signal,onDocument=()=>{}}={}){
 const target=v4PublicJobUrl(parent?.canonical_url);
 if(!target||parent.source_confirmed!==true||parent.independently_read!==true||parent.vacancy_confirmed!==true||document?.url!==target||document.document_kind!=='html')return null;
 const identity=v=>trim(v).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 for(const hint of document.declared_resource_hints||[]){
  if(signal?.aborted)throw signal.reason;
  if(hint.kind!=='data'||!publicReadResourceUrl(hint.url)||hint.url===target)continue;
  try{
   const doc=await v4ReadPublicJobDocument(hint.url,{fetcher,signal,maxBytes:16*1024*1024});
   if(doc.url!==hint.url||doc.document_kind!=='json')continue;
   onDocument({type:'read_page',ok:true,mode:'static',url:doc.url,text:doc.plain,offset:0,next_offset:null,resource_hints:[]});
   const all=postings(doc.plain);
   const matches=all.filter(j=>{
    const company=companyOf(j).name,city=postedLocation(j);
    let landing;try{landing=v4PublicJobUrl(new URL(j.url,target).href)}catch{}
    return typeof j.url==='string'&&landing===target&&!!city&&city===parent.location&&identity(company)===identity(parent.company)&&identity(j.title)===identity(parent.title);
   });
   if(matches.length!==1)continue;
   const posting=matches[0];
   if(posting.validThrough&&Number.isFinite(Date.parse(posting.validThrough))&&Date.parse(posting.validThrough)<Date.now())continue;
   const desc=structuredJdParts(posting,v=>htmlToText(v,{maxChars:Infinity})).join('\n');
   if(!desc.trim()||looksTruncatedJd(desc)||looksTruncatedJd(htmlToText(trim(posting.description),{maxChars:Infinity})))continue;
   const sections=extractOfficialJdSections(desc,{full:true});
   return {...parent,id:'v4-employer-'+(await sha256Hex(target)).slice(0,32),canonical_url:target,jd_source_url:doc.url,full_jd:desc,requirements:sections?.sections?.filter(x=>x.kind==='requirements').map(x=>x.text).join('\n')||desc,jd_incomplete:false,partial_jd:undefined,checked_at:new Date().toISOString(),proof_method:'V4_EMPLOYER_HTML_JOB'};
  }catch(e){if(signal?.aborted)throw e;}
 }
 return null;
}
export async function v4RenderPublicJobDocument(url,{browser,signal,resourceHints=[],publicDataUrls=[]}={}){
 const target=v4PublicJobUrl(url);
 if(!target||isCommercialRecruitmentBoard(target))throw Error('V4_UNSAFE_URL');
 if(typeof browser?.quickAction!=='function')throw Error('V4_BROWSER_UNAVAILABLE');
 if(signal?.aborted)throw signal.reason;
 const host=new URL(target).hostname.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
 const independentlyRead=new Set(publicDataUrls.map(v4PublicJobUrl).filter(Boolean));
 const exactAssets=resourceHints.filter(h=>(['script','style'].includes(h?.kind)||['data','frame'].includes(h?.kind)&&publicReadResourceUrl(h.url)&&independentlyRead.has(v4PublicJobUrl(h.url)))&&v4PublicJobUrl(h.url)&&!isCommercialRecruitmentBoard(h.url)).map(h=>'^'+h.url.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')+'$');
 const response=await browser.quickAction('content',{
  url:target,allowRequestPattern:['^https://'+host+'(?::443)?(?:/|$)',...new Set(exactAssets)],
  rejectResourceTypes:['image','media','font'],
  gotoOptions:{waitUntil:'networkidle2'}
 });
 if(signal?.aborted)throw signal.reason;
 if(response.status===429)throw Error('V4_BROWSER_QUOTA_OR_RATE_LIMIT');
 const raw=await limitedRead(response,{allowJson:true,maxBytes:16*1024*1024});
 let html=raw;
 if((response.headers.get('content-type')||'').includes('json')){
  let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('V4_BROWSER_RESPONSE_INVALID')}
  if(parsed?.success===false||typeof parsed?.result!=='string')throw Error('V4_BROWSER_RESPONSE_INVALID');
  html=parsed.result;
 }
 if(!html.trim())throw Error('V4_BROWSER_EMPTY');
 const site=meta(html,'property','og:site_name')||meta(html,'name','application-name'),title=pageTitle(html);
 if(isCommercialRecruitmentBoard(target,{site_name:site}))throw Error('V4_COMMERCIAL_BOARD_EXCLUDED');
 const plain=htmlToText(html,{maxChars:Infinity}).trim();
 if(CLOSED.test(title)||(plain.length<80&&CLOSED.test(plain)))throw Error('V4_JOB_CLOSED');
 return {url:target,plain,site,title,rendered:true,resource_hints:[...new Map([...resourceHints,...v4PublicResourceHints(html,target)].map(h=>[h.url,h])).values()]};
}


// Read a bounded byte window from a large public document, not a truncated
// substitute for a verified complete JD. Each next_offset is addressable.
// The full response is streamed; only the requested window is retained.
export async function v4ReadPublicJobDocumentWindow(url,{fetcher=fetch,signal,offset=0,maxBytes=256*1024,scriptSource=false,documentUrl=url}={}){
 let current=v4PublicJobUrl(url);
 if(!Number.isSafeInteger(offset)||offset<0)offset=0;
 const seen=new Set(),windowBytes=Number.isSafeInteger(maxBytes)&&maxBytes>0?Math.min(256*1024,maxBytes):256*1024;
 while(current&&!seen.has(current)&&!isCommercialRecruitmentBoard(current)){
  seen.add(current);
  if(signal?.aborted)throw signal.reason;
  const r=await fetcher(current,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:'text/html,application/json,text/plain'},signal});
  if([301,302,303,307,308].includes(r.status)){
   const next=r.headers.get('location');await r.body?.cancel().catch(()=>{});
   current=next?v4PublicJobUrl(new URL(next,current).href):null;continue;
  }
  if(!r.ok||r.status===206||!r.body)throw Error('V4_PAGE_UNAVAILABLE');
  const ct=(r.headers.get('content-type')||'').toLowerCase();
  if(!/text\/(html|plain)|json/.test(ct)&&!(scriptSource&&/javascript|ecmascript/i.test(ct)))throw Error('V4_PAGE_NOT_HTML');
  const reader=r.body.getReader(),out=new Uint8Array(windowBytes);let position=0,written=0,hasMore=false;
  try{
   for(;;){
    if(signal?.aborted)throw signal.reason;
    const {done,value}=await reader.read();if(done)break;
    const end=position+value.byteLength;
    if(end>offset&&written<windowBytes){
     const start=Math.max(0,offset-position),n=Math.min(value.byteLength-start,windowBytes-written);
     if(n>0){out.set(value.subarray(start,start+n),written);written+=n;}
    }
    position=end;
    if(position>offset+windowBytes){hasMore=true;break;}
   }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const raw=new TextDecoder().decode(out.subarray(0,written));
  // Include actual visible text and JSON text; do not mark a window as complete JD.
  return {url:current,offset,next_offset:hasMore?offset+written:null,unit:'bytes',text:scriptSource||ct.includes('json')?raw:htmlToText(raw,{maxChars:Infinity}),complete_document:false,...(scriptSource?{script_source:true,resource_hints:v4ScriptResourceHints(raw,documentUrl,current)}:{})};
 }
 throw Error('V4_UNSAFE_OR_REPEATED_REDIRECT');
}
