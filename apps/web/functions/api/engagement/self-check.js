// Read-only self-verification of authenticated account activity in Cloudflare D1.
// This is not a tracking endpoint: no events are created by the GET request.
import {json,bad,metricDb,isoDay,hmac} from '../../_lib/metric-utils.js';
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
const allowedAreas=new Set(['general','jobs','companies','policies','tools','job_save']);
export async function onRequestGet({request,env}){
 if(env.HHBA_ACCOUNT_ANALYTICS_ENABLED!=='1')return bad('ACCOUNT_ANALYTICS_DISABLED',503);
 const metrics=metricDb(env),auth=env.HHBA_PNVS_AUTH_DB;
 if(!metrics||!auth)return bad('ACCOUNT_ANALYTICS_NOT_CONFIGURED',503);
 try{
  const session=await sessionOfBearer(auth,request,Date.now());
  if(!session)return bad('SESSION_REQUIRED',401);
  const user=await getUserByPhone(auth,session.phone);
  if(!user||user.role!=='candidate')return bad('FORBIDDEN',403);
  const hash=await hmac(env.HHBA_METRICS_SECRET,'account-activity-v1:'+session.phone);
  const day=isoDay();
  const [result,history]=await Promise.all([
   metrics.prepare('SELECT area FROM hhba_account_activity WHERE account_hash=? AND day=? ORDER BY area').bind(hash,day).all(),
   metrics.prepare('SELECT 1 AS present FROM hhba_account_activity WHERE account_hash=? LIMIT 1').bind(hash).first()
  ]);
  const areas=(result.results||[]).map(x=>x.area).filter(x=>allowedAreas.has(x));
  // Historical presence is scoped to the same authenticated account, never another user.
  return json({kind:'HHBA_ACCOUNT_ACTIVITY_SELF_CHECK_V1',ok:true,day,recorded:areas.length>0,
   historicalRecorded:!!history,areas});
 }catch(e){
  console.error('HHBA_ACCOUNT_ACTIVITY_SELF_CHECK_FAILED',e?.name||'error');
  return bad('ACCOUNT_ACTIVITY_CHECK_UNAVAILABLE',503);
 }
}
