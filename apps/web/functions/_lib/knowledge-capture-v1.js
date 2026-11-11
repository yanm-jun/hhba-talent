/**
 * HHBA V1 Stage 2: private, additive knowledge capture from PUBLIC DeepSeek Search.
 * This is an internal candidate ledger, NOT an official-company whitelist.
 * It never receives/stores resume text, user identifiers, model explanations,
 * ranking scores, search queries, provider tokens or raw webpage content.
 *
 * All rows remain PENDING / SEARCH_CANDIDATE until evidence review in later stages.
 * Ingestion is opt-in through HHBA_KNOWLEDGE_CAPTURE_ENABLED=1 and a preview D1 migration.
 */
import {recruitmentSourceCandidate} from './dual-classification-v1.js';
import {isEmployerDirectedSource} from './match-employer-source.js';
import {classifyOccupation} from './match-ranking.js';
import {isMainlandJobLocation} from './mainland-job-location.js';

export const KNOWLEDGE_CAPTURE_VERSION='HHBA_KNOWLEDGE_CAPTURE_V1_STAGE2';
const SAFE_JOB_IDS=new Set([
 'id','jobid','job_id','postid','positionid','position_id','requmentid','requementid',
 'requisitionid','reqid','jobunionid','advertisementid','gh_jid','jid','jobcode'
]);
const BAD_PATH=/(?:\/(?:login|logout|oauth|reset-password|forgot-password|account|profile|my-resume|personal-info)(?:\/|$))/i;
const REJECT_FIELD=/(?:@|https?:\/\/|(?:\+?\d[\s-]?){9,})/i;
const short=(v,max)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const normName=v=>short(v,100).toLowerCase().replace(/[\s·・（）()\[\]【】,，.。\-_—–]+/g,'');

/**
 * Canonical public candidate link. Strip unknown query params (often session
 * tokens/emails) while retaining known non-sensitive job IDs. Do not rewrite
 * the actual applicant-facing job URL: this applies to INTERNAL storage only.
 */
export function knowledgeSourceUrl(raw){
 const candidate=recruitmentSourceCandidate(raw);
 if(candidate.status!=='REVIEW_REQUIRED'||!isEmployerDirectedSource(candidate.source_kind))return null;
 const url=new URL(candidate.canonical_url);
 if(BAD_PATH.test(url.pathname)||url.pathname.length>600)return null;
 for(const [key,value] of [...url.searchParams.entries()]){
  if(!SAFE_JOB_IDS.has(key.toLowerCase())||
   !/^[a-z0-9_-]{1,75}$/i.test(value))url.searchParams.delete(key);
 }
 if(url.href.length>1000)return null;
 return {canonical_url:url.href,hostname:url.hostname,source_kind:candidate.source_kind};
}

function employerName(v){
 const name=short(v,85);
 if(name.length<2||REJECT_FIELD.test(name)||!normName(name))return null;
 return name;
}
function jobTitle(v){
 const title=short(v,110);
 if(title.length<2||REJECT_FIELD.test(title))return null;
 return title;
}

/** Public-only schema. Ignore all unknown input fields; never spread model objects. */
export function normalizeKnowledgeCapture({hits=[],matches=[]}={}){
 const sources=new Map(),employers=new Map(),jobs=new Map();
 const putSource=raw=>{
  const src=knowledgeSourceUrl(raw);
  if(src)sources.set(src.canonical_url,src);
  return src;
 };
 for(const hit of (Array.isArray(hits)?hits:[]).slice(0,48)){
  if(hit&&typeof hit==='object')putSource(hit.url);
 }
 for(const job of (Array.isArray(matches)?matches:[]).slice(0,10)){
  if(!job||typeof job!=='object')continue;
  const src=putSource(job.official_url);
  const name=employerName(job.company),title=jobTitle(job.title_zh||job.title);
  const city=short(job.location,50);
  if(!src||!name||!title||!city||!isMainlandJobLocation(city))continue;
  // Brand + host is a CANDIDATE observation key, not legal company identity.
  const entityKey=normName(name)+'|'+src.hostname;
  employers.set(entityKey,{display_name:name,name_normalized:normName(name),
   observed_host:src.hostname});
  const key=src.canonical_url+'|'+title.toLowerCase()+'|'+city.toLowerCase();
  jobs.set(key,{entity_key:entityKey,canonical_url:src.canonical_url,
   title,mainland_location:city,occupation_tag:short(classifyOccupation(title)||'',75)});
 }
 return {version:KNOWLEDGE_CAPTURE_VERSION,
  sources:[...sources.values()],employers:[...employers.entries()]
   .map(([key,value])=>({key,...value})),jobs:[...jobs.values()]};
}

async function digestId(prefix,text){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return prefix+'-'+Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,48);
}
export function knowledgeCaptureEnabled(env,waitUntil){
 return env?.HHBA_KNOWLEDGE_CAPTURE_ENABLED==='1'&&
  typeof env?.HHBA_PNVS_AUTH_DB?.batch==='function'&&typeof waitUntil==='function';
}

/** D1 batch writes are idempotent, bounded and never promote a trust state. */
export async function persistKnowledgeCapture(db,data,{now=new Date()}={}){
 if(typeof db?.batch!=='function'||typeof db?.prepare!=='function')
  throw Error('KNOWLEDGE_DB_UNAVAILABLE');
 const batch=normalizeKnowledgeCapture(data),stamp=now.toISOString();
 const sourceIds=new Map(),employerIds=new Map(),statements=[];
 for(const src of batch.sources){
  const id=await digestId('src',src.canonical_url);
  sourceIds.set(src.canonical_url,id);
  statements.push(db.prepare(
   'INSERT INTO hhba_knowledge_sources(id,canonical_url,hostname,source_kind,first_seen_at,last_seen_at,seen_count) '+
   'VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET '+
   'last_seen_at=excluded.last_seen_at,seen_count=hhba_knowledge_sources.seen_count+1'
  ).bind(id,src.canonical_url,src.hostname,src.source_kind,stamp,stamp));
 }
 for(const ent of batch.employers){
  const id=await digestId('emp',ent.key);
  employerIds.set(ent.key,id);
  statements.push(db.prepare(
   'INSERT INTO hhba_knowledge_employer_observations '+
   '(id,display_name,name_normalized,observed_host,first_seen_at,last_seen_at,seen_count) '+
   'VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET '+
   'last_seen_at=excluded.last_seen_at,seen_count=hhba_knowledge_employer_observations.seen_count+1'
  ).bind(id,ent.display_name,ent.name_normalized,ent.observed_host,stamp,stamp));
 }
 for(const job of batch.jobs){
  const sid=sourceIds.get(job.canonical_url),eid=employerIds.get(job.entity_key);
  if(!sid||!eid)continue;
  const id=await digestId('job',job.canonical_url+'|'+job.title.toLowerCase()+'|'+job.mainland_location.toLowerCase());
  statements.push(db.prepare(
   'INSERT INTO hhba_knowledge_job_observations '+
   '(id,source_id,employer_observation_id,title,mainland_location,occupation_tag,first_seen_at,last_seen_at,seen_count) '+
   'VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET '+
   'last_seen_at=excluded.last_seen_at,seen_count=hhba_knowledge_job_observations.seen_count+1'
  ).bind(id,sid,eid,job.title,job.mainland_location,job.occupation_tag,stamp,stamp));
 }
 if(statements.length)await db.batch(statements);
 return {sources:batch.sources.length,employers:batch.employers.length,
  jobs:batch.jobs.length,statements:statements.length};
}

/**
 * Cloudflare waitUntil is required: never delay or fail a candidate's match.
 * No extra DeepSeek requests are made; only Search results already obtained
 * by the existing matching service are captured.
 */
export function knowledgeCaptureCallbacks(env,waitUntil){
 if(!knowledgeCaptureEnabled(env,waitUntil))return {};
 const submit=batch=>{
  try{
   waitUntil(persistKnowledgeCapture(env.HHBA_PNVS_AUTH_DB,batch)
    .catch(()=>{console.warn('HHBA_KNOWLEDGE_CAPTURE_UNAVAILABLE');}));
  }catch{console.warn('HHBA_KNOWLEDGE_CAPTURE_UNAVAILABLE');}
 };
 return {
  onDiscoveredCandidates:hits=>submit({hits}),
  onDiscoveredMatches:matches=>submit({matches})
 };
}
