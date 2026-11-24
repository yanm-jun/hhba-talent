/**
 * Shared, PUBLIC, verified employer JD snapshots. NEVER persist candidate
 * documents or model prompts in this D1/R2 archive.
 *
 * D1 = small searchable index; private R2 bucket = actual JD text. Every
 * version has content-addressed identity and a hash checked on every read.
 * A stale document stays available for audit but is NEVER described as fresh.
 */
import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {safePublicAtsJobLocator,ATS_JD_PROOF} from './public-ats-jd.js';
import {extractOfficialJdSections,MEITUAN_DETAIL_SOURCE,TENCENT_DETAIL_SOURCE} from './official-job-evidence.js';
import {sha256Hex} from './real-auth.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
import {recruitmentSourceKind} from './match-employer-source.js';
import {recordJdPostingCheck,readJdPostingState,isUsablePosting} from './jd-posting-lifecycle.js';

export const JD_ARCHIVE_KIND='HHBA_VERIFIED_JOB_JD_V1';
export const JD_FRESH_MS=24*60*60*1000;
const MAX_TEXT=16000;
export const safeJDSourceLocator=url=>safeOfficialJobLocator(url)||safePublicAtsJobLocator(url);
const JD_TABLE_DIRECT='hhba_job_jd_versions';
const JD_TABLE_ATS='hhba_job_ats_jd_versions';
const tableForProof=proof=>proof===ATS_JD_PROOF?JD_TABLE_ATS:JD_TABLE_DIRECT;
const text=value=>typeof value==='string'?value.trim():'';

export function jdArchiveConfigured(env){
 // Explicit D1+R2 bindings opt the environment in; an optional '0' killswitch
 // disables the archive without touching any private resume integration.
 return env?.HHBA_JOB_JD_ARCHIVE_ENABLED!=='0'&&
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
 const locator=safeJDSourceLocator(value.canonical_url);
 if(!locator||locator.url!==value.canonical_url||locator.company!==value.company)return null;
 const proof=locator.kind?ATS_JD_PROOF:'DIRECT_EMPLOYER_HTML_V1';
 if(value.proof_method!==proof)return null;
 const body=text(value.full_jd);
 if(body.length<80||body.length>MAX_TEXT||value.content_status!=='VERIFIED_SECTIONS'||
  !/(?:岗位职责|工作职责|职位职责|主要职责|工作内容|岗位描述|职位描述|responsibilities|what you(?:'|’)ll do|what you will do|about the role|your impact|key responsibilities|duties)/i.test(body))return null;
 const sections=Array.isArray(value.sections)?value.sections.filter(x=>
  x&&/^(JD-\d{3})$/.test(x.id)&&
  ['responsibilities','requirements','other'].includes(x.kind)&&
  typeof x.text==='string'&&x.text.trim().length>0&&x.text.length<=8000
 ).slice(0,120):[];
 if(sections.length<2||sections.some((section,index)=>
  section.id!=='JD-'+String(index+1).padStart(3,'0')||
  !body.includes(section.text)))return null;
 if(sections.map(section=>section.text).join('\n')!==body)return null;
 // The full-JD hash alone does not cover an attacker changing requirement
 // classification while retaining identical text. Re-derive section kinds
 // from the immutable source body every time R2 is read.
 const recomputed=extractOfficialJdSections(body);
 if(!recomputed||JSON.stringify(recomputed.sections)!==JSON.stringify(sections))
  return null;
 return {
  canonical_url:locator.url,company:locator.company,
  title:text(value.title).slice(0,120),
  location:text(value.location).slice(0,100),
  full_jd:body,sections,
  ...((locator.domain==='zhaopin.meituan.com'&&value.retrieval_method===MEITUAN_DETAIL_SOURCE)||
      (locator.domain==='careers.tencent.com'&&value.retrieval_method===TENCENT_DETAIL_SOURCE)?
   {retrieval_method:value.retrieval_method}:{}),
  content_status:'VERIFIED_SECTIONS',
  proof_method:proof
 };
}
const safeDayIso=raw=>Number.isFinite(Date.parse(raw||''))?raw:null;
export async function readJobJdById(env,id){
 if(!isJDVersionId(id)||!jdArchiveConfigured(env))return null;
 const db=env.HHBA_JOB_JD_DB;
 let row=await db.prepare('SELECT * FROM '+JD_TABLE_DIRECT+' WHERE id=?').bind(id).first();
 if(!row){
  try{row=await db.prepare('SELECT * FROM '+JD_TABLE_ATS+' WHERE id=?').bind(id).first()}
  catch{/* old ATS index may not exist */}
 }
 return row?readArchivedRow(env,row):readV4PublicJd(env,id);
}
async function readArchivedRow(env,row){
 if(!row||!isJDVersionId(row.id)||!row.object_key?.startsWith('official-jds/v1/'))return null;
 const official=safeJDSourceLocator(row.canonical_url);
 if(!official||official.url!==row.canonical_url||official.company!==row.company||
  row.proof_method!==(official.kind?ATS_JD_PROOF:'DIRECT_EMPLOYER_HTML_V1'))return null;
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
 const lifecycle=await readJdPostingState(env,row.canonical_url);
 return {
  ...parsed,id:row.id,jd_sha256:row.jd_sha256,
  fetched_at:row.first_verified_at,checked_at:row.last_verified_at,
  posting_status:lifecycle?.status||'UNTRACKED',
  posting_closed_at:lifecycle?.closed_at||null,
  fresh:age>=-300000&&age<=JD_FRESH_MS&&isUsablePosting(lifecycle)
 };
}
export async function readFreshJobJdByUrl(env,url){
 const locator=safeJDSourceLocator(url);
 if(!locator||!jdArchiveConfigured(env))return null;
 const table=locator.kind?JD_TABLE_ATS:JD_TABLE_DIRECT;
 const row=await env.HHBA_JOB_JD_DB.prepare(
  'SELECT * FROM '+table+' WHERE canonical_url=? ORDER BY last_verified_at DESC LIMIT 1'
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
  'INSERT INTO '+tableForProof(source.proof_method)+'(id,canonical_url,url_sha256,company,title,location,jd_sha256,'+
  'object_key,text_bytes,proof_method,content_status,first_verified_at,last_verified_at) '+
  'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(canonical_url,jd_sha256) DO UPDATE SET '+
  'last_verified_at=excluded.last_verified_at'
 ).bind(id,source.canonical_url,urlHash,source.company,source.title,source.location,
  jdHash,key,new TextEncoder().encode(source.full_jd).length,source.proof_method,
  source.content_status,checked,checked).run();
 if(result?.success!==true)throw Error('JD_INDEX_WRITE_FAILED');
 // Record ACTIVE only after the original JD text and index are durably saved.
 // Failure to write the lifecycle state fails closed in preview/strict mode.
 await recordJdPostingCheck(env,source.canonical_url,{now});
 return readJobJdById(env,id);
}

const V4_PUBLIC_PROOF='V4_STRUCTURED_JOBPOSTING';
const V4_HTML_PROOF='V4_EMPLOYER_HTML_JOB';
const isV4PublicProof=proof=>[V4_PUBLIC_PROOF,V4_HTML_PROOF].includes(proof);
const v4Key=id=>'official-jds/v4-public/'+id+'.json';
function normalizeV4Public(raw){
 // This is an independently retrieved same-domain structured posting, not
 // a legal-entity ownership certificate. Never use AI-provided JD text here.
 if(!isV4PublicProof(raw?.proof_method)||
  (raw.proof_method===V4_PUBLIC_PROOF?raw.source_confirmed!==true:raw.independently_read!==true)||
  v4PublicJobUrl(raw.canonical_url)!==raw.canonical_url||
  !raw.canonical_url||recruitmentSourceKind(raw.canonical_url)==='THIRD_PARTY_BOARD')return null;
 const body=text(raw.full_jd),company=text(raw.company),title=text(raw.title),location=text(raw.location);
 if(!company||!title||!location||body.length<80||body.length>240000)return null;
 const sections=extractOfficialJdSections(body,{full:true});
 if(!sections||sections.full_jd!==body)return null;
 return {canonical_url:raw.canonical_url,company,title,location,
  full_jd:body,sections:sections.sections,content_status:'VERIFIED_SECTIONS',
  proof_method:raw.proof_method,source_confirmed:raw.source_confirmed===true,
  independently_read:true};
}
async function v4PublicIdentity(source){
 const jd_sha256=await sha256Hex(source.full_jd);
 const id='jd_'+(await sha256Hex('v4-public\\n'+source.canonical_url+'\\n'+jd_sha256)).slice(0,32);
 return {id,jd_sha256};
}
export async function saveV4PublicJobJd(env,raw,{now=new Date()}={}){
 if(!jdArchiveConfigured(env))throw Error('JD_ARCHIVE_DISABLED');
 const source=normalizeV4Public(raw);
 if(!source)throw Error('JD_NOT_VERIFIED');
 const identity=await v4PublicIdentity(source);
 const checked_at=now.toISOString();
 const record={...source,...identity,checked_at};
 await env.HHBA_JOB_JD_R2.put(v4Key(identity.id),JSON.stringify(record),{
  httpMetadata:{contentType:'application/json; charset=utf-8'},
  customMetadata:{kind:JD_ARCHIVE_KIND,proof_method:source.proof_method}
 });
 return readV4PublicJd(env,identity.id);
}
async function readV4PublicJd(env,id){
 const object=await env.HHBA_JOB_JD_R2.get(v4Key(id));
 if(!object)return null;
 let raw;
 try{raw=JSON.parse(await object.text())}catch{return null}
 const source=normalizeV4Public(raw);
 if(!source)return null;
 const identity=await v4PublicIdentity(source);
 if(identity.id!==id||raw.id!==id||identity.jd_sha256!==raw.jd_sha256)return null;
 const age=Date.now()-Date.parse(raw.checked_at);
 return {...source,...identity,checked_at:raw.checked_at,fetched_at:raw.checked_at,
  posting_status:'UNTRACKED',fresh:Number.isFinite(age)&&age>=-300000&&age<=JD_FRESH_MS};
}

export function publicJdPayload(saved,{includeText=true}={}){
 if(!saved)return null;
 return {
  ok:true,kind:JD_ARCHIVE_KIND,verified:true,job_id:saved.id,
  company:saved.company,title:saved.title,location:saved.location,
  canonical_url:saved.canonical_url,jd_sha256:saved.jd_sha256,
  checked_at:saved.checked_at,fresh:saved.fresh,
  posting_status:saved.posting_status||'UNTRACKED',
  posting_closed_at:saved.posting_closed_at||null,
  content_status:saved.content_status,proof_method:saved.proof_method,
  ...(saved.retrieval_method?{retrieval_method:saved.retrieval_method}:{}),
  ...(includeText?{full_jd:saved.full_jd,sections:saved.sections}:{}),
  disclaimer:saved.fresh?
   (isV4PublicProof(saved.proof_method)?'独立读取的公开招聘 JD；企业官网归属及是否仍在招需要在原始页面确认。':saved.proof_method===ATS_JD_PROOF?
    '企业专属公开 ATS 招聘接口核验的原文；招聘主体法定名称和是否仍在招以企业公告为准。':
    '直接读取受支持企业官网并保存的岗位 JD；不保证此刻仍可投递。'):
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
 if((job.official_url&&job.official_url!==saved.canonical_url)||
    (job.jd_sha256&&job.jd_sha256!==saved.jd_sha256))
  throw Error('JD_JOB_IDENTITY_MISMATCH');
 return {...job,title:saved.title,requirements:saved.full_jd,
  official_url:saved.canonical_url,jd_version_id:saved.id,
  jd_sha256:saved.jd_sha256,source_status:isV4PublicProof(saved.proof_method)?'VERIFIED_PUBLIC_JD':'VERIFIED_OFFICIAL_JD'};
}
