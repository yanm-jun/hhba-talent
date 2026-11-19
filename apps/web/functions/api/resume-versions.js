// Account-owned job-targeted resume snapshots. Explicit save only; no raw PDF/DOCX storage.
import {sessionOfBearer,getUserByPhone} from '../_lib/real-auth.js';
const KIND='HHBA_TARGETED_RESUME_VERSIONS_V1';
const MAX_BYTES=24000;
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const error=(code,status)=>respond({ok:false,error:code},status);
const allowedText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&
 !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
function configured(env){return env?.HHBA_RESUME_VERSION_STORAGE_ENABLED==='1'&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';}
function sameOrigin(request){const origin=new URL(request.url).origin;
 return request.headers.get('Origin')===origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';}
async function ready(db){try{const row=await db.prepare(
 "SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_targeted_resume_versions'").first();
 return row?.name==='hhba_targeted_resume_versions';}catch{return false;}}
async function jsonBody(request){
 const len=request.headers.get('Content-Length');
 if(!request.body||len!==null&&(!/^\d+$/.test(len)||Number(len)>MAX_BYTES))throw Error('BAD_BODY');
 const reader=request.body.getReader();const parts=[];let total=0;
 try{for(;;){const next=await reader.read();if(next.done)break;
  total+=next.value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw Error('BAD_BODY');}
  parts.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let i=0;for(const part of parts){bytes.set(part,i);i+=part.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('BAD_BODY');}
}
function validDraft(payload){
 if(!payload||Array.isArray(payload)||typeof payload!=='object'||
  !allowedText(payload.job_id,1,160)||!allowedText(payload.job_title,2,150)||
  !allowedText(payload.company,1,150)||!Array.isArray(payload.blocks)||
  payload.blocks.length===0||payload.blocks.length>12||!Array.isArray(payload.accepted_ids)||
  payload.accepted_ids.length===0||payload.accepted_ids.length>12)return false;
 const ids=new Set();
 if(!payload.blocks.every(b=>{
  if(!b||!allowedText(b.id,1,64)||!/^[A-Za-z0-9_-]+$/.test(b.id)||
   !['experience','skills','summary','education','projects'].includes(b.section)||
   !allowedText(b.text,1,1600)||ids.has(b.id))return false;
  ids.add(b.id);return true;
 }))return false;
 return new Set(payload.accepted_ids).size===payload.accepted_ids.length&&
  payload.accepted_ids.every(x=>allowedText(x,1,100));
}
export async function onRequest({request,env}){
 if(!configured(env))return error('RESUME_VERSION_STORAGE_DISABLED',503);
 const method=request.method;
 if(!['GET','POST','DELETE'].includes(method))return error('METHOD_NOT_ALLOWED',405);
 if(method!=='GET'&&!sameOrigin(request))return error('ORIGIN_REQUIRED',403);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!await ready(db))return error('RESUME_VERSION_DB_NOT_READY',503);
 let session;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return error('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return error('FORBIDDEN',403);
 }catch{return error('SESSION_INVALID',401);}
 const url=new URL(request.url);
 try{
  if(method==='GET'){
   const job=url.searchParams.get('job_id');
   if(!allowedText(job,1,160))return error('INVALID_JOB_ID',400);
   const rows=await db.prepare(
    'SELECT id,job_id,job_title,company,content_json,created_at FROM hhba_targeted_resume_versions '+
    'WHERE phone=? AND job_id=? ORDER BY created_at DESC LIMIT 10'
   ).bind(session.phone,job).all();
   return respond({ok:true,kind:KIND,items:(rows.results||[]).map(r=>({
    id:r.id,job_id:r.job_id,job_title:r.job_title,company:r.company,
    created_at:r.created_at,version:JSON.parse(r.content_json)
   }))});
  }
  if(method==='DELETE'){
   const id=url.searchParams.get('id');
   if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))return error('INVALID_VERSION_ID',400);
   const out=await db.prepare('DELETE FROM hhba_targeted_resume_versions WHERE phone=? AND id=?')
    .bind(session.phone,id).run();
   return out?.meta?.changes===1?respond({ok:true,deleted:true}):error('VERSION_NOT_FOUND',404);
  }
  let payload;try{payload=await jsonBody(request);}catch{return error('INVALID_VERSION',400);}
  if(!validDraft(payload))return error('INVALID_VERSION',400);
  const version={blocks:payload.blocks,acceptedSuggestionIds:payload.accepted_ids};
  const serialized=JSON.stringify(version);
  if(serialized.length>18000)return error('VERSION_TOO_LARGE',400);
  const id=crypto.randomUUID(),created=new Date().toISOString();
  const result=await db.prepare(
   'INSERT INTO hhba_targeted_resume_versions(id,phone,job_id,job_title,company,content_json,created_at) '+
   'SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_targeted_resume_versions WHERE phone=?)<15'
  ).bind(id,session.phone,payload.job_id,payload.job_title,payload.company,serialized,created,session.phone).run();
  if(result?.success!==true||result?.meta?.changes!==1)return error('VERSION_ACCOUNT_LIMIT',409);
  return respond({ok:true,kind:KIND,id,created_at:created},201);
 }catch{
  return error('RESUME_VERSION_DB_UNAVAILABLE',503);
 }
}
