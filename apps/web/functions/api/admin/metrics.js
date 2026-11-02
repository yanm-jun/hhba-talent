import {json,bad,metricDb,isoDay} from '../../_lib/metric-utils.js';
import {verifyAdmin} from '../../_lib/admin-access.js';
const validDays=new Set([1,7,30,90]);
export async function onRequestGet({request,env}){
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 const db=metricDb(env);if(!db)return bad('METRICS_DATABASE_NOT_CONNECTED');
 const url=new URL(request.url),days=Number(url.searchParams.get('days')||30);
 if(!validDays.has(days))return bad('INVALID_PERIOD',400);
 const today=isoDay(),since=isoDay(new Date(Date.now()-(days-1)*86400000));
 try{
  const [daily,saved,installed]=await Promise.all([
   db.prepare(`SELECT day,
    SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) AS pv,
    COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_day_hash END) AS daily_uv,
    SUM(CASE WHEN event_type='job_view' THEN 1 ELSE 0 END) AS job_views,
    SUM(CASE WHEN event_type='job_search' THEN 1 ELSE 0 END) AS searches,
    SUM(CASE WHEN event_type='official_apply_click' THEN 1 ELSE 0 END) AS outbound_clicks
    FROM hhba_traffic_events WHERE day>=? AND day<=? GROUP BY day ORDER BY day`).bind(since,today).all(),
   db.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT device_hash) AS devices FROM hhba_device_saved').first(),
   db.prepare("SELECT value FROM hhba_metrics_metadata WHERE key='installed_at'").first()
  ]);
  const series=Array.from({length:days},(_,i)=>{const d=isoDay(new Date(Date.parse(since+'T00:00:00.000Z')+i*86400000));const row=(daily.results||[]).find(r=>r.day===d);return {day:d,pv:Number(row?.pv||0),dailyUv:Number(row?.daily_uv||0),jobViews:Number(row?.job_views||0),searches:Number(row?.searches||0),outboundClicks:Number(row?.outbound_clicks||0)}})
  const sum=k=>series.reduce((a,x)=>a+x[k],0);
  const result={kind:'HHBA_CLOUDFLARE_PRIVATE_METRICS_V1',asOf:new Date().toISOString(),period:{start:since,end:today,days,timezone:'UTC'},collectorStartedAt:installed?.value||null,
   traffic:{quality:'collected',pv:sum('pv'),dailyUvSum:sum('dailyUv'),jobViews:sum('jobViews'),searches:sum('searches'),outboundClicks:sum('outboundClicks'),series,scope:'OPT_IN_CONSENT_ONLY_AND_PER_MINUTE_DEDUP'},
   devices:{quality:'collected',savedJobs:Number(saved?.n||0),devicesWithSavedJobs:Number(saved?.devices||0),scope:'CLOUDFLARE_DEVICE_COOKIE_ONLY_NOT_ACCOUNT_SAVES'},
   account:{quality:'not_connected',registeredUsers:null,dau:null,mau:null,scope:'VERIFIED_PRODUCTION_ACCOUNT_ONLY',
     reason:'正式邮箱认证与真实登录活动尚未接入生产账户数据库，不能用设备 UV 或测试用户推算 DAU/MAU。'}
  };
  return json(result);
 }catch(e){console.error('HHBA_METRICS_PRIVATE_QUERY_FAILED',e?.name||'error');return bad('PRIVATE_METRICS_QUERY_FAILED')}
}
