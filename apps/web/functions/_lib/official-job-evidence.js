// Strictly narrow direct-HTML verification of a publicly available official job JD.
// Do not trust a model-provided search excerpt as a verified employer document.
// No resumes, candidate identities, provider data or secrets are ever cached.
import {safeOfficialJobLocator,extractOfficialJob} from './domestic-search-fetch.js';
import {extractSkillRequirements} from './job-skill-evidence.js';
import {degreeMinRequirement,experienceMinRequirement} from './domestic-match-fusion.js';
import {sha256Hex} from './real-auth.js';

export const OFFICIAL_EVIDENCE_VERSION='DIRECT_EMPLOYER_HTML_V1';
const FRESH_MS=24*60*60*1000;
const MAX_RESPONSE=220000;
const DEGREE=['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'];
const canon=raw=>safeOfficialJobLocator(raw);
const xmlEntities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
function htmlToText(html){
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
export async function directOfficialJobEvidence(url,{fetcher=fetch,now=new Date()}={}){
 const locator=canon(url);
 if(!locator)throw Error('OFFICIAL_URL_NOT_SUPPORTED');
 const response=await fetcher(locator.url,{
  method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{Accept:'text/html,text/plain;q=0.9','User-Agent':'HHBA-JobEvidence/1.0'}
 });
 if(response.status!==200)throw Error('OFFICIAL_PAGE_UNAVAILABLE');
 const type=(response.headers.get('Content-Type')||'').toLowerCase();
 if(!type.includes('text/html')&&!type.includes('text/plain'))throw Error('OFFICIAL_PAGE_UNREADABLE');
 const raw=await readLimited(response);
 const plain=type.includes('text/html')?htmlToText(raw):raw;
 const item=extractOfficialJob({url:locator.url},{content:plain},now);
 if(!item||item.official_url!==locator.url||item.company!==locator.company||
  item.source_status!=='OFFICIAL_DETAIL_FETCHED')throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const requirements=item.evidence?.requirement;
 if(typeof requirements!=='string'||requirements.length<25)throw Error('OFFICIAL_JD_NOT_VERIFIED');
 const checked_at=new Date(now).toISOString();
 const id='verified-official-'+(await sha256Hex(locator.url)).slice(0,32);
 const jd_hash=await sha256Hex([locator.url,item.title,item.location,requirements].join('\n'));
 return {id,canonical_url:locator.url,company:item.company,title:item.title,
  location:item.location,requirements,jd_hash,proof_method:OFFICIAL_EVIDENCE_VERSION,checked_at};
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
