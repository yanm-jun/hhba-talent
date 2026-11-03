// Historical device-only bookmarks remain readable to the device owner.
// New writes require a verified PNVS login at /api/account/saved; never turn
// a shared device cookie into another user's account data.
import {bad,json,metricDb,sameOrigin,parseCookie,hmac} from '../../_lib/metric-utils.js';
const key='__Host-hhba_saved';
const pattern=/^[A-Za-z0-9_-]{1,180}$/;
async function historicalOwner(request,env){
 const raw=parseCookie(request,key),parts=raw.split('.');
 if(parts.length===2&&/^[a-f0-9]{48}$/.test(parts[0])&&
    parts[1]===await hmac(env.HHBA_METRICS_SECRET,'device:'+parts[0]))
  return await hmac(env.HHBA_METRICS_SECRET,'device-db:'+parts[0]);
 return null;
}
export async function onRequest({request,env}){
 const db=metricDb(env);
 if(!db)return bad('DEVICE_SAVE_NOT_ENABLED');
 const url=new URL(request.url),tail=url.pathname.slice('/api/saved'.length);
 if(tail&&!/^\/[A-Za-z0-9_-]{1,180}$/.test(tail))return bad('INVALID_JOB_ID',400);
 const id=tail.slice(1);
 if(!id&&request.method==='GET'){
  try{
   const hash=await historicalOwner(request,env);
   if(!hash)return json({kind:'HHBA_DEVICE_SAVED_JOBS_V1',items:[]});
   const records=await db.prepare('SELECT job_id AS jobId,saved_at AS savedAt FROM hhba_device_saved WHERE device_hash=? ORDER BY saved_at DESC LIMIT 300').bind(hash).all();
   return json({kind:'HHBA_DEVICE_SAVED_JOBS_V1',items:records.results||[]});
  }catch{return bad('DEVICE_SAVE_READ_FAILED')}
 }
 if(!id||!pattern.test(id)||!['PUT','DELETE'].includes(request.method))return bad('METHOD_NOT_ALLOWED',405);
 if(!sameOrigin(request))return bad('ORIGIN_REQUIRED',403);
 return bad('ACCOUNT_LOGIN_REQUIRED',410);
}
