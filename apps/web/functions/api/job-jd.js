/**
 * Candidate-authorized verified JD archive:
 *   GET /api/job-jd                  -> public capability only
 *   GET /api/job-jd?jd_id=...        -> one archived version (possibly stale)
 *   GET /api/job-jd?official_url=... -> fresh cache lookup (never fetches)
 *   POST /api/job-jd                 -> consented, allowlisted live verification
 *
 * No arbitrary URL fetching, no model-supplied assertion of verification,
 * no candidate resume content, and no public R2 bucket URL.
 */
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {fetchPublicAtsJd} from '../_lib/public-ats-jd.js';
import {directOfficialJobEvidence} from '../_lib/official-job-evidence.js';
import {
 JD_ARCHIVE_KIND,jdArchiveConfigured,jdArchiveReady,safeJDSourceLocator,
 readJobJdById,readFreshJobJdByUrl,saveVerifiedJobJd,publicJdPayload
} from '../_lib/job-jd-archive.js';

const MAX_BODY=4500,DAILY_PERSON=40,DAILY_TOTAL=1200;
const respond=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}
});
const fail=(code,status)=>respond({ok:false,kind:JD_ARCHIVE_KIND,error:code},status);
const originOK=request=>request.headers.get('Origin')===new URL(request.url).origin&&
 request.headers.get('Sec-Fetch-Site')!=='cross-site';
const pepper=env=>env?.HHBA_JOB_JD_LIMIT_PEPPER||
 env?.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER||env?.HHBA_MATCH_LIMIT_PEPPER;
async function candidate(env,request){
 const auth=env.HHBA_PNVS_AUTH_DB;
 if(typeof auth?.prepare!=='function')return null;
 const session=await sessionOfBearer(auth,request,Date.now());
 if(!session)return null;
 const person=await getUserByPhone(auth,session.phone);
 return person?.role==='candidate'?session:null;
}
async function readJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
  throw Error('INVALID_REQUEST');
 const declared=request.headers.get('content-length');
 if(!request.body||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))
  throw Error('INVALID_REQUEST');
 const reader=request.body.getReader();const chunks=[];let total=0;
 try{for(;;){const x=await reader.read();if(x.done)break;
  total+=x.value.byteLength;if(total>MAX_BODY){await reader.cancel();throw Error('INVALID_REQUEST')}
  chunks.push(x.value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
 catch{throw Error('INVALID_REQUEST')}
}
async function countAttempt(env,session){
 const key=pepper(env);
 if(typeof key!=='string'||key.length<24)throw Error('JD_LIMIT_PEPPER_MISSING');
 const hash=await sha256Hex(key+':job-jd:'+session.phone);
 const now=new Date().toISOString(),day=now.slice(0,10);
 const result=await env.HHBA_JOB_JD_DB.prepare(
  'INSERT INTO hhba_job_jd_fetch_attempts(id,day_utc,account_hash,created_at) '+
  'SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_job_jd_fetch_attempts WHERE day_utc=?)<? '+
  'AND (SELECT COUNT(*) FROM hhba_job_jd_fetch_attempts WHERE day_utc=? AND account_hash=?)<?'
 ).bind(crypto.randomUUID(),day,hash,now,day,DAILY_TOTAL,day,hash,DAILY_PERSON).run();
 return result?.success===true&&result.meta?.changes===1;
}
export async function onRequestGet({request,env}){
 if(!jdArchiveConfigured(env))return respond({
  kind:JD_ARCHIVE_KIND,enabled:false,mode:'OFFICIAL_ONLY'});
 const ready=await jdArchiveReady(env);
 const url=new URL(request.url);
 if(!url.searchParams.has('jd_id')&&!url.searchParams.has('official_url'))
  return respond({kind:JD_ARCHIVE_KIND,enabled:ready,
   scope:'OFFICIAL_EMPLOYER_DETAIL_ONLY',versioned:true,
   requires_explicit_consent_for_new_fetch:true});
 if(!ready)return fail('JD_ARCHIVE_NOT_READY',503);
 let session;
 try{session=await candidate(env,request)}catch{return fail('SESSION_INVALID',401)}
 if(!session)return fail('SESSION_INVALID',401);
 if(url.searchParams.has('jd_id')){
  const id=url.searchParams.get('jd_id')||'';
  try{const item=await readJobJdById(env,id);
   return item?respond(publicJdPayload(item)):fail('JD_NOT_FOUND',404);
  }catch{return fail('JD_ARCHIVE_READ_FAILED',503)}
 }
 const requested=url.searchParams.get('official_url')||'';
 const locator=safeJDSourceLocator(requested);
 if(!locator)return fail('OFFICIAL_URL_NOT_SUPPORTED',422);
 try{
  const item=await readFreshJobJdByUrl(env,locator.url);
  return item?respond(publicJdPayload(item)):respond({
   ok:true,kind:JD_ARCHIVE_KIND,found:false,
   verified:false,message:'No fresh official JD in the shared archive'});
 }catch{return fail('JD_ARCHIVE_READ_FAILED',503)}
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return fail('ORIGIN_REQUIRED',403);
 if(!jdArchiveConfigured(env)||!await jdArchiveReady(env))
  return fail('JD_ARCHIVE_NOT_READY',503);
 let session;
 try{session=await candidate(env,request)}catch{return fail('SESSION_INVALID',401)}
 if(!session)return fail('SESSION_INVALID',401);
 let data;
 try{data=await readJson(request)}catch{return fail('INVALID_REQUEST',400)}
 if(data?.consent_verify!==true||typeof data.official_url!=='string')
  return fail('CONSENT_REQUIRED',400);
 const locator=safeJDSourceLocator(data.official_url);
 if(!locator)return fail('OFFICIAL_URL_NOT_SUPPORTED',422);
 try{
  const cached=await readFreshJobJdByUrl(env,locator.url);
  if(cached)return respond({...publicJdPayload(cached),from_cache:true});
 }catch{return fail('JD_ARCHIVE_READ_FAILED',503)}
 try{if(!await countAttempt(env,session))return fail('JD_EXTERNAL_FETCH_LIMIT',429)}
 catch{return fail('JD_ARCHIVE_QUOTA_NOT_READY',503)}
 let evidence;
 try{evidence=locator.kind?await fetchPublicAtsJd(locator.url):await directOfficialJobEvidence(locator.url)}
 catch{return fail('JD_OFFICIAL_FETCH_FAILED',422)}
 if(!evidence?.full_jd||evidence.content_status!=='VERIFIED_SECTIONS')
  return fail('JD_NOT_COMPLETE_ENOUGH',422);
 try{
  const archived=await saveVerifiedJobJd(env,evidence);
  if(!archived)return fail('JD_ARCHIVE_WRITE_FAILED',503);
  return respond({...publicJdPayload(archived),from_cache:false});
 }catch{return fail('JD_ARCHIVE_WRITE_FAILED',503)}
}
