/**
 * Shared, PUBLIC, verified employer JD snapshots. NEVER persist candidate
 * documents or model prompts in this D1/R2 archive.
 *
 * D1 = small searchable index; private R2 bucket = actual JD text. Every
 * version has content-addressed identity and a hash checked on every read.
 * A stale document stays available for audit but is NEVER described as fresh.
 */
import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {sha256Hex} from './real-auth.js';

export const JD_ARCHIVE_KIND='HHBA_VERIFIED_JOB_JD_V1';
export const JD_FRESH_MS=24*60*60*1000;
const MAX_TEXT=16000;
const text=value=>typeof value==='string'?value.trim():'';

export function jdArchiveConfigured(env){
 return env?.HHBA_JOB_JD_ARCHIVE_ENABLED==='1'&&
  typeof env.HHBA_JOB_JD_DB?.prepare==='function'&&
  typeof env.HHBA_JOB_JD_R2?.put==='function'&&
  typeof env.HHBA_JOB_JD_R2?.get==='function';
}
export async function jdArchiveReady(env){
 if(!jdArchiveConfigured(env))return false;
 try{
  const row=await env.HHBA_JOB_JD_DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hhba_job_jd_versions','hhba_job_jd_fetch_attempts')"
  ).all();
  const tables=new Set((row?.results||[]).map(x=>x.name));
  return tables.has('hhba_job_jd_versions')&&tables.has('hhba_job_jd_fetch_attempts');
 }catch{return false}
}
export function isJDVersionId(id){
 return typeof id==='string'&&/^jd_[a-f0-9]{32}$/.test(id);
}
function normalizeDocument(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const locator=safeOfficialJobLocator(value.canonical_url);
 if(!locator||locator.url!==value.canonical_url||locator.company!==value.company)return null;
 const body=text(value.full_jd);
 if(body.length<80||body.length>MAX_TEXT||value.content_status!=='VERIFIED_SECTIONS'||
  value.proof_method!=='DIRECT_EMPLOYER_HTML_V1'||!body.includes('岗位职责')&&
  !body.includes('工作职责')&&!body.includes('职位职责')&&!body.includes('主要职责')&&!body.includes('工作内容'))return null;
 const sections=Array.isArray(value.sections)?value.sections.filter(x=>
  x&&/^(JD-\d{3})$/.test(x.id)&&
  ['responsibilities','requirements','other'].includes(x.kind)&&
  typeof x.text==='string'&&x.text.trim().length>0&&x.text.length<=8000
 ).slice(0,120):[];
 if(sections.length<2)return null;
 return {
  canonical_url:locator.url,company:locator.company,
  title:text(value.title).slice(0,120),
  location:text(value.location).slice(0,100),
  full_jd:body,sections,
  content_status:'VERIFIED_SECTIONS',
  proof_method:'DIRECT_EMPLOYER_HTML_V1'
 };
}
const safeDayIso=raw=>Number.isFinite(Date.parse(raw||''))?raw:null;
export async function readJobJdById(env,id){
 if(!isJDVersionId(id)||!jdArchiveConfigured(env))return null;
 const row=await env.HHBA_JOB_JD_DB.prepare(
  'SELECT * FROM hhba_job_jd_versions WHERE id=?'
 ).bind(id).first();
 return readArchivedRow(env,row);
}
async function readArchivedRow(env,row){
 if(!row||!isJDVersionId(row.id)||!row.object_key?.startsWith('official-jds/v1/'))return null;
 const official=safeOfficialJobLocator(row.canonical_url);
 if(!official||official.url!==row.canonical_url)return null;
 const object=await env.HHBA_JOB_JD_R2.get(row.object_key);
 if(!object)return null;
 const content=await object.text();
 if(content.length>85000)return null;
 let saved;
 try{saved=JSON.parse(content)}catch{return null}
 if(saved.id!==row.id||saved.jd_sha256!==row.jd_sha256||
  saved.canonical_url!==row.canonical_url||saved.proof_method!==row.proof_method)return null;
 const parsed=normalizeDocument(saved);
 if(!parsed||parsed.company!==row.company||parsed.title!==row.title||
  parsed.location!==row.location)return null;
 const hash=await sha256Hex(parsed.full_jd);
 if(hash!==row.jd_sha256)return null;
 const lastVerified=safeDayIso(row.last_verified_at);
 const age=lastVerified?Date.now()-Date.parse(lastVerified):Infinity;
 return {
  ...parsed,id:row.id,jd_sha256:row.jd_sha256,
  fetched_at:row.first_verified_at,checked_at:row.last_verified_at,
  fresh:age>=-300000&&age<=JD_FRESH_MS
 };
}
export async function readFreshJobJdByUrl(env,url){
 const locator=safeOfficialJobLocator(url);
 if(!locator||!jdArchiveConfigured(env))return null;
 const row=await env.HHBA_JOB_JD_DB.prepare(
  'SELECT * FROM hhba_job_jd_versions WHERE canonical_url=? ORDER BY last_verified_at DESC LIMIT 1'
 ).bind(locator.url).first();
 if(!row)return null;
 const archive=await readArchivedRow(env,row);
 return archive?.fresh?archive:null;
}
/** One official URL + one content hash = one stable JD version for all users. */
export async function saveVerifiedJobJd(env,raw,{now=new Date()}={}){
 if(!jdArchiveConfigured(env))throw Error('JD_ARCHIVE_DISABLED');
 const source=normalizeDocument(raw);
 if(!source)throw Error('JD_NOT_VERIFIED');
 const urlHash=await sha256Hex(source.canonical_url);
 const jdHash=await sha256Hex(source.full_jd);
 const versionHash=await sha256Hex(source.canonical_url+'\n'+jdHash);
 const id='jd_'+versionHash.slice(0,32);
 const key='official-jds/v1/'+urlHash.slice(0,32)+'/'+jdHash+'.json';
 const checked=now.toISOString();
 const payload={...source,id,jd_sha256:jdHash};
 const serialized=JSON.stringify(payload);
 const encoded=new TextEncoder().encode(serialized);
 if(encoded.byteLength>80000)throw Error('JD_TOO_LARGE');
 const bucket=env.HHBA_JOB_JD_R2;
 // Reverification without content changes updates only the D1 timestamp.
 const previous=await bucket.head(key);
 if(!previous){
  await bucket.put(key,serialized,{
   httpMetadata:{contentType:'application/json; charset=utf-8'},
   customMetadata:{kind:JD_ARCHIVE_KIND,jd_sha256:jdHash}
  });
 }
 const result=await env.HHBA_JOB_JD_DB.prepare(
  'INSERT INTO hhba_job_jd_versions(id,canonical_url,url_sha256,company,title,location,jd_sha256,'+
  'object_key,text_bytes,proof_method,content_status,first_verified_at,last_verified_at) '+
  'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(canonical_url,jd_sha256) DO UPDATE SET '+
  'last_verified_at=excluded.last_verified_at'
 ).bind(id,source.canonical_url,urlHash,source.company,source.title,source.location,
  jdHash,key,new TextEncoder().encode(source.full_jd).length,source.proof_method,
  source.content_status,checked,checked).run();
 if(result?.success!==true)throw Error('JD_INDEX_WRITE_FAILED');
 return readJobJdById(env,id);
}
export function publicJdPayload(saved,{includeText=true}={}){
 if(!saved)return null;
 return {
  ok:true,kind:JD_ARCHIVE_KIND,verified:true,job_id:saved.id,
  company:saved.company,title:saved.title,location:saved.location,
  canonical_url:saved.canonical_url,jd_sha256:saved.jd_sha256,
  checked_at:saved.checked_at,fresh:saved.fresh,
  content_status:saved.content_status,proof_method:saved.proof_method,
  ...(includeText?{full_jd:saved.full_jd,sections:saved.sections}:{}),
  disclaimer:saved.fresh?
   '直接读取企业官网并保存的岗位 JD；不保证此刻仍可投递。':
   '这是历史岗位 JD 版本，可能已经过期；不能当作最新招聘条件。'
 };
}

/**
 * Model-facing JD hydration: a client-provided search summary is NEVER
 * promoted to verified employer JD. The server reads content-addressed R2
 * bytes and independently checks the SHA256 before giving them to an LLM.
 */
export async function hydrateVerifiedJobRequirements(env,job){
 if(!job||typeof job!=='object'||Array.isArray(job))throw Error('JD_INVALID_JOB');
 const version=job.jd_version_id;
 if(version===undefined||version===null||version===''){
  if(env?.HHBA_JOB_JD_REQUIRED==='1')throw Error('JD_VERIFIED_VERSION_REQUIRED');
  return {...job,source_status:'UNVERIFIED_JOB_SUMMARY'};
 }
 if(!isJDVersionId(version)||!jdArchiveConfigured(env))
  throw Error('JD_VERSION_NOT_AVAILABLE');
 const saved=await readJobJdById(env,version);
 if(!saved)throw Error('JD_VERSION_NOT_AVAILABLE');
 if(!saved.fresh)throw Error('JD_VERSION_STALE');
 if(job.official_url&&job.official_url!==saved.canonical_url)
  throw Error('JD_JOB_IDENTITY_MISMATCH');
 return {...job,title:saved.title,requirements:saved.full_jd,
  official_url:saved.canonical_url,jd_version_id:saved.id,
  jd_sha256:saved.jd_sha256,source_status:'VERIFIED_OFFICIAL_JD'};
}
