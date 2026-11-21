// Candidate-only same-JD V2 ranking reassessment. No generative AI calls.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {validatedAuditedJob,validReassessmentInput,sameEngineReassessment,archivedJDToScoreJob} from '../_lib/resume-reassessment.js';
import {readJobJdById,jdArchiveConfigured} from '../_lib/job-jd-archive.js';
import {validatedCachedOfficialJob} from '../_lib/official-job-evidence.js';
const LIMIT_BYTES=160*1024,PER_ACCOUNT=12,GLOBAL=400;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const bad=(code,status)=>json({ok:false,error:code},status);
function active(env){return env?.HHBA_RESUME_REASSESS_ENABLED==='1'&&
 (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
 typeof env?.HHBA_MATCH_LIMIT_PEPPER==='string'&&env.HHBA_MATCH_LIMIT_PEPPER.length>=24&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function'&&typeof env?.ASSETS?.fetch==='function';}
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin&&
 request.headers.get('Sec-Fetch-Site')!=='cross-site';}
async function ready(db){try{const row=await db.prepare(
 "SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_reassess_requests'").first();
 return row?.name==='hhba_resume_reassess_requests';}catch{return false;}}
async function readBody(request){
 const size=request.headers.get('Content-Length');
 if(!request.body||size!==null&&(!/^\d+$/.test(size)||Number(size)>LIMIT_BYTES))throw Error('BAD_BODY');
 const reader=request.body.getReader(),parts=[];let n=0;
 try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;
  if(n>LIMIT_BYTES){await reader.cancel();throw Error('BAD_BODY');}parts.push(x.value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let offset=0;
 for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('BAD_BODY');}
}
async function resource(env,origin,path,max){
 const response=await env.ASSETS.fetch(new Request(origin+path,{headers:{Accept:'application/json'}}));
 if(!response.ok||!(response.headers.get('content-type')||'').includes('json'))throw Error('SOURCE_UNAVAILABLE');
 const declared=Number(response.headers.get('content-length')||0);
 if(declared>max)throw Error('SOURCE_UNAVAILABLE');
 const raw=await response.text();
 if(raw.length>max)throw Error('SOURCE_UNAVAILABLE');
 try{return JSON.parse(raw);}catch{throw Error('SOURCE_UNAVAILABLE');}
}
async function officialSources(env,origin){
 const [snapshot,audit,facets]=await Promise.all([
  resource(env,origin,'/data/jobs.json',16000000),
  resource(env,origin,'/data/job-sync-status.json',18000000),
  resource(env,origin,'/data/job-search-facets.json',7000000)
 ]);
 return {snapshot,audit,facets};
}
async function reserve(db,identity){
 const created=new Date().toISOString(),day=created.slice(0,10),id=crypto.randomUUID();
 const row=await db.prepare(
  'INSERT INTO hhba_resume_reassess_requests(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_resume_reassess_requests WHERE day_utc=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_resume_reassess_requests WHERE day_utc=? AND account_hash=?)<?'
 ).bind(id,day,identity,created,day,GLOBAL,day,identity,PER_ACCOUNT).run();
 return row?.success===true&&row?.meta?.changes===1;
}
export async function onRequestGet({env}){
 return json({kind:'HHBA_RESUME_REASSESS_V2',enabled:active(env)&&await ready(env.HHBA_PNVS_AUTH_DB),
  ranking_version:'HHBA_MATCH_RANKING_V2',scope:'AUDITED_MAINLAND_ATS_AND_VERIFIED_JD_VERSIONS'});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return bad('ORIGIN_REQUIRED',403);
 if(!active(env))return bad('REASSESSMENT_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!await ready(db))return bad('REASSESSMENT_DB_NOT_READY',503);
 let session;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return bad('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return bad('FORBIDDEN',403);
 }catch{return bad('SESSION_INVALID',401);}
 let input;
 try{input=await readBody(request);}catch{return bad('INVALID_REASSESSMENT_INPUT',400);}
 if(!validReassessmentInput(input))return bad('INVALID_REASSESSMENT_INPUT',400);
 let job;
 try{
  if(/^jd_[a-f0-9]{32}$/.test(input.job_id)){
   const jd=jdArchiveConfigured(env)?await readJobJdById(env,input.job_id):null;
   job=archivedJDToScoreJob(jd);
  }else if(/^verified-official-[a-f0-9]{32}$/.test(input.job_id)){
   const row=await db.prepare('SELECT * FROM hhba_official_job_evidence WHERE id=?')
    .bind(input.job_id).first();
   job=await validatedCachedOfficialJob(row);
  }else{
   const sources=await officialSources(env,new URL(request.url).origin);
   job=validatedAuditedJob(sources,input.job_id);
  }
 }catch{return bad('REASSESSMENT_SOURCE_UNAVAILABLE',503);}
 if(!job)return bad('AUDITED_JOB_NOT_AVAILABLE',422);
 let identity;
 try{identity=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':reassess:'+session.phone);
  if(!await reserve(db,identity))return bad('REASSESSMENT_LIMIT',429);
 }catch{return bad('REASSESSMENT_DB_NOT_READY',503);}
 try{
  const result=sameEngineReassessment(job,input.profile,input.before_blocks,input.after_blocks);
  return json({ok:true,kind:'HHBA_RESUME_REASSESS_V2',job_id:job.id,
   verified_job_title:job.title,verified_company:job.company,
   job_snapshot_updated_at:job.updated_at,source_label:job.source_label||'已核验的中国大陆官方 ATS 快照',...result});
 }catch{return bad('REASSESSMENT_SOURCE_UNAVAILABLE',503);}
}
