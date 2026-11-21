// Candidate-requested official JD verification. Never fetch an arbitrary
// model-supplied website. Domain AND exact job-detail path are allowlisted.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {safeOfficialJobLocator} from '../_lib/domestic-search-fetch.js';
import {directOfficialJobEvidence,validatedCachedOfficialJob} from '../_lib/official-job-evidence.js';
const KIND='HHBA_OFFICIAL_JOB_VERIFY_V1',MAX_BODY=4500,USER_CAP=4,GLOBAL_CAP=120;
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(error,status)=>send({ok:false,error},status);
function enabled(env){
 return env?.HHBA_OFFICIAL_JOB_VERIFY_ENABLED==='1'&&
  (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  typeof env?.HHBA_MATCH_LIMIT_PEPPER==='string'&&env.HHBA_MATCH_LIMIT_PEPPER.length>=24&&
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
async function ready(db){
 try{
  const rows=await db.prepare(
   "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hhba_official_job_evidence','hhba_official_verify_requests')"
  ).all();
  const names=new Set((rows?.results||[]).map(x=>x.name));
  return names.has('hhba_official_job_evidence')&&names.has('hhba_official_verify_requests');
 }catch{return false;}
}
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin&&
 request.headers.get('Sec-Fetch-Site')!=='cross-site';}
async function smallBody(request){
 const length=request.headers.get('Content-Length');
 if(!request.body||length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY))throw Error('INVALID_REQUEST');
 const reader=request.body.getReader(),pieces=[];let n=0;
 try{for(;;){const r=await reader.read();if(r.done)break;n+=r.value.byteLength;
  if(n>MAX_BODY){await reader.cancel();throw Error('INVALID_REQUEST');}pieces.push(r.value);
 }}finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let off=0;
 for(const p of pieces){bytes.set(p,off);off+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('INVALID_REQUEST');}
}
async function reserve(db,hash){
 const now=new Date().toISOString(),day=now.slice(0,10),id=crypto.randomUUID();
 const row=await db.prepare(
  'INSERT INTO hhba_official_verify_requests(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_official_verify_requests WHERE day_utc=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_official_verify_requests WHERE day_utc=? AND account_hash=?)<?'
 ).bind(id,day,hash,now,day,GLOBAL_CAP,day,hash,USER_CAP).run();
 return row?.success===true&&row?.meta?.changes===1;
}
function describe(job,fromCache=false){
 return {ok:true,kind:KIND,verified:true,job_id:job.id,
  company:job.company,title:job.title,location:job.location,official_url:job.official_url,
  checked_at:job.updated_at,proof_method:'DIRECT_EMPLOYER_HTML_V1',
  from_cache:fromCache,
  disclaimer:'HHBA 已直接读取受支持企业招聘官网的岗位详情和任职要求；不保证该岗位此刻仍在招或可投递。'};
}
export async function onRequestGet({env}){
 return send({kind:KIND,enabled:enabled(env)&&await ready(env.HHBA_PNVS_AUTH_DB),
  daily_account_cap:USER_CAP,scope:'STRICT_OFFICIAL_EMPLOYER_DETAIL_ONLY'});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!enabled(env))return fail('OFFICIAL_JOB_VERIFY_DISABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!await ready(db))return fail('OFFICIAL_JOB_VERIFY_DB_NOT_READY',503);
 let session;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  const account=await getUserByPhone(db,session.phone);
  if(account?.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let data;
 try{data=await smallBody(request);}catch{return fail('INVALID_REQUEST',400);}
 if(data?.consent_verify!==true||typeof data.official_url!=='string')return fail('CONSENT_REQUIRED',400);
 const source=safeOfficialJobLocator(data.official_url);
 if(!source)return fail('OFFICIAL_URL_NOT_SUPPORTED',422);
 try{
  const prior=await db.prepare(
   'SELECT * FROM hhba_official_job_evidence WHERE canonical_url=?'
  ).bind(source.url).first();
  const cached=await validatedCachedOfficialJob(prior);
  if(cached)return send(describe(cached,true));
 }catch{return fail('OFFICIAL_JOB_VERIFY_DB_NOT_READY',503);}
 let reserved;
 try{
  const hash=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':official-verify:'+session.phone);
  reserved=await reserve(db,hash);
  if(!reserved)return fail('OFFICIAL_VERIFY_LIMIT',429);
 }catch{return fail('OFFICIAL_JOB_VERIFY_DB_NOT_READY',503);}
 let evidence;
 try{evidence=await directOfficialJobEvidence(source.url);}
 catch{return fail('OFFICIAL_JD_NOT_VERIFIED',422);}
 try{
  const saved=await db.prepare(
   'INSERT INTO hhba_official_job_evidence(id,canonical_url,company,title,location,requirements,jd_hash,proof_method,checked_at) '+
   'VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(canonical_url) DO UPDATE SET '+
   'company=excluded.company,title=excluded.title,location=excluded.location,requirements=excluded.requirements,'+
   'jd_hash=excluded.jd_hash,proof_method=excluded.proof_method,checked_at=excluded.checked_at'
  ).bind(evidence.id,evidence.canonical_url,evidence.company,evidence.title,evidence.location,
   evidence.requirements,evidence.jd_hash,evidence.proof_method,evidence.checked_at).run();
  if(saved?.success!==true)return fail('OFFICIAL_JOB_VERIFY_DB_NOT_READY',503);
  const approved=await validatedCachedOfficialJob(evidence);
  if(!approved)return fail('OFFICIAL_JD_NOT_VERIFIED',422);
  return send(describe(approved));
 }catch{return fail('OFFICIAL_JOB_VERIFY_DB_NOT_READY',503);}
}
