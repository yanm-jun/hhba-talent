// Authenticated, consent-based aggregate analytics. Never accept a caller-provided user identity.
import {json,bad,metricDb,sameOrigin,isoDay,hmac} from '../../_lib/metric-utils.js';
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
const areas=new Set(['general','jobs','companies','policies','tools','job_save']);
export async function onRequest({request,env}){
 if(!['POST','DELETE'].includes(request.method))return bad('METHOD_NOT_ALLOWED',405);
 if(!sameOrigin(request))return bad('ORIGIN_REQUIRED',403);
 // The former consent dialog is gone. Disable all new account-linked tracking,
 // while retaining DELETE for each user's historic activity and erasure rights.
 if(request.method==='POST')return bad('ACCOUNT_ACTIVITY_COLLECTION_RETIRED',410);
 if(request.method==='POST'&&env.HHBA_ACCOUNT_ANALYTICS_ENABLED!=='1')return bad('ACCOUNT_ANALYTICS_DISABLED');
 const metrics=metricDb(env),auth=env.HHBA_PNVS_AUTH_DB;
 if(!metrics||!auth)return bad('ACCOUNT_ANALYTICS_NOT_CONFIGURED');
 try{
  const session=await sessionOfBearer(auth,request,Date.now());
  if(!session)return bad('SESSION_REQUIRED',401);
  const user=await getUserByPhone(auth,session.phone);
  if(!user||user.role!=='candidate')return bad('FORBIDDEN',403);
  const digest=await hmac(env.HHBA_METRICS_SECRET,'account-activity-v1:'+session.phone);
  if(request.method==='DELETE'){
   await metrics.prepare('DELETE FROM hhba_account_activity WHERE account_hash=?').bind(digest).run();
   return json({ok:true,deleted:true});
  }
  if(request.headers.get('x-hhba-consent')!=='yes'||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')
   return bad('ANALYTICS_CONSENT_REQUIRED',403);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return bad('JSON_REQUIRED',415);
  const data=await request.json().catch(()=>null);
  if(!areas.has(data?.area))return bad('INVALID_AREA',400);
  await metrics.prepare('INSERT OR IGNORE INTO hhba_account_activity(account_hash,day,area,created_at) VALUES(?,?,?,?)')
   .bind(digest,isoDay(),data.area,new Date().toISOString()).run();
  return json({ok:true,accepted:true},202);
 }catch(e){
  console.error('HHBA_ACCOUNT_ANALYTICS_WRITE_FAILED',e?.name||'error');
  return bad('ACCOUNT_ANALYTICS_UNAVAILABLE');
 }
}
