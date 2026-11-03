import {bad,json,metricDb,sameOrigin,parseCookie,randomHex,cookie,hmac,assetJson} from '../../_lib/metric-utils.js';
const key='__Host-hhba_saved';
const pattern=/^[A-Za-z0-9_-]{1,180}$/;
async function owner(request,env,create){
 const raw=parseCookie(request,key),parts=raw.split('.');
 if(parts.length===2&&/^[a-f0-9]{48}$/.test(parts[0])&&parts[1]===await hmac(env.HHBA_METRICS_SECRET,'device:'+parts[0]))return {hash:await hmac(env.HHBA_METRICS_SECRET,'device-db:'+parts[0]),setCookie:null};
 if(!create)return {hash:null,setCookie:null};
 const id=randomHex(24),sig=await hmac(env.HHBA_METRICS_SECRET,'device:'+id);
 return {hash:await hmac(env.HHBA_METRICS_SECRET,'device-db:'+id),setCookie:cookie(key,id+'.'+sig)};
}
export async function onRequest({request,env}){
 const db=metricDb(env);if(!db)return bad('DEVICE_SAVE_NOT_ENABLED');
 const url=new URL(request.url),tail=url.pathname.slice('/api/saved'.length);
 if(tail&&!/^\/[A-Za-z0-9_-]{1,180}$/.test(tail))return bad('INVALID_JOB_ID',400);
 const id=tail.slice(1);
 if(!id&&request.method==='GET'){
  try{
   const o=await owner(request,env,false);
   if(!o.hash)return json({kind:'HHBA_DEVICE_SAVED_JOBS_V1',items:[]});
   const r=await db.prepare('SELECT job_id as jobId, saved_at as savedAt FROM hhba_device_saved WHERE device_hash=? ORDER BY saved_at DESC LIMIT 300').bind(o.hash).all();
   return json({kind:'HHBA_DEVICE_SAVED_JOBS_V1',items:r.results||[]});
  }catch{return bad('DEVICE_SAVE_READ_FAILED')}
 }
 if(!id||!pattern.test(id)||!['PUT','DELETE'].includes(request.method))return bad('METHOD_NOT_ALLOWED',405);
 if(!sameOrigin(request))return bad('ORIGIN_REQUIRED',403);
 // Legacy device-only saves are read-only for historical data recovery.
 // New bookmark writes MUST go through /api/account/saved with a PNVS bearer
 // session. This does not delete existing anonymous device history.
 return bad('ACCOUNT_LOGIN_REQUIRED',410);
 /* Retired device mutation implementation, kept out of production execution. */
 try{
  const o=await owner(request,env,request.method==='PUT');
  if(request.method==='PUT'){
   // Do not save arbitrary user-provided IDs: check the same published recruitment snapshot.
   const feed=await assetJson(env,request,'/data/jobs.json');
   if(!Array.isArray(feed.jobs)||!feed.jobs.some(j=>j.id===id))return bad('JOB_NOT_IN_VERIFIED_SNAPSHOT',404);
   const count=await db.prepare('SELECT COUNT(*) AS n FROM hhba_device_saved WHERE device_hash=?').bind(o.hash).first();
   const found=await db.prepare('SELECT job_id FROM hhba_device_saved WHERE device_hash=? AND job_id=?').bind(o.hash,id).first();
   if(!found&&Number(count?.n)>=300)return bad('SAVED_LIMIT_REACHED',409);
   const change=await db.prepare('INSERT OR IGNORE INTO hhba_device_saved(device_hash,job_id,saved_at) VALUES(?,?,?)').bind(o.hash,id,new Date().toISOString()).run();
   if(change.meta?.changes>0)await db.prepare('INSERT INTO hhba_device_save_events(day,event_type,created_at) VALUES(?,?,?)')
    .bind(new Date().toISOString().slice(0,10),'added',new Date().toISOString()).run();
  }else if(o.hash){
   const change=await db.prepare('DELETE FROM hhba_device_saved WHERE device_hash=? AND job_id=?').bind(o.hash,id).run();
   if(change.meta?.changes>0)await db.prepare('INSERT INTO hhba_device_save_events(day,event_type,created_at) VALUES(?,?,?)')
    .bind(new Date().toISOString().slice(0,10),'removed',new Date().toISOString()).run();
  }
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(o.setCookie)headers['Set-Cookie']=o.setCookie;
  return new Response(JSON.stringify({kind:'HHBA_DEVICE_SAVED_JOBS_V1',jobId:id,saved:request.method==='PUT'}),{headers});
 }catch(e){console.error('HHBA_DEVICE_SAVE_FAILED',e?.name||'error');return bad('DEVICE_SAVE_UNAVAILABLE')}
}
