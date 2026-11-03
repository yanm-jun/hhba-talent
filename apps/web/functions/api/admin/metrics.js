import {json,bad,metricDb,isoDay} from '../../_lib/metric-utils.js';
import {verifyAdmin} from '../../_lib/admin-access.js';
const validDays=new Set([1,7,30,90]);
export async function onRequestGet({request,env}){
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 const db=metricDb(env);if(!db)return bad('METRICS_DATABASE_NOT_CONNECTED');
 const url=new URL(request.url),today=isoDay();
 let days=Number(url.searchParams.get('days')||30);
 let since=isoDay(new Date(Date.now()-(days-1)*86400000)),until=today;
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(from!==null||to!==null){
  const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)
    &&Number.isFinite(Date.parse(d+'T00:00:00Z'))
    &&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  if(!valid(from)||!valid(to)||from>to||to>today)return bad('INVALID_CUSTOM_PERIOD',400);
  days=Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1;
  if(days<1||days>90)return bad('INVALID_CUSTOM_PERIOD',400);
  since=from;until=to;
 }else if(!validDays.has(days))return bad('INVALID_PERIOD',400);
 try{
  const [daily,saved,installed,changes]=await Promise.all([
   db.prepare(`SELECT day,
    SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) AS pv,
    COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_day_hash END) AS daily_uv,
    SUM(CASE WHEN event_type='job_view' THEN 1 ELSE 0 END) AS job_views,
    SUM(CASE WHEN event_type='job_search' THEN 1 ELSE 0 END) AS searches,
    SUM(CASE WHEN event_type='official_apply_click' THEN 1 ELSE 0 END) AS outbound_clicks
    FROM hhba_traffic_events WHERE day>=? AND day<=? GROUP BY day ORDER BY day`).bind(since,until).all(),
   db.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT device_hash) AS devices FROM hhba_device_saved').first(),
   db.prepare("SELECT value FROM hhba_metrics_metadata WHERE key='installed_at'").first(),
   db.prepare("SELECT event_type, COUNT(*) AS n FROM hhba_device_save_events WHERE day>=? AND day<=? GROUP BY event_type").bind(since,until).all()
  ]);
  const series=Array.from({length:days},(_,i)=>{const d=isoDay(new Date(Date.parse(since+'T00:00:00.000Z')+i*86400000));const row=(daily.results||[]).find(r=>r.day===d);return {day:d,pv:Number(row?.pv||0),dailyUv:Number(row?.daily_uv||0),jobViews:Number(row?.job_views||0),searches:Number(row?.searches||0),outboundClicks:Number(row?.outbound_clicks||0)}})
  const sum=k=>series.reduce((a,x)=>a+x[k],0);
  const counts=Object.fromEntries((changes.results||[]).map(x=>[x.event_type,Number(x.n)]));
  // Real registration count is sourced only from the verified PNVS auth D1.
  // Session timestamps are not a complete site-wide DAU/MAU signal; keep
  // those fields null until actual account-scoped activity telemetry exists.
  let accounts={quality:'not_connected',registeredUsers:null,dau:null,mau:null,
   scope:'VERIFIED_PNVS_D1_ACCOUNT_ONLY',reason:'未连接真实 PNVS 用户数据库。'};
  if(env.HHBA_PNVS_AUTH_DB){
   try{
    const authDb=env.HHBA_PNVS_AUTH_DB;
    const result=await authDb.prepare("SELECT COUNT(*) AS n FROM hhba_auth_users WHERE role='candidate'").first();
    accounts={quality:'collected',registeredUsers:Number(result?.n||0),dau:null,mau:null,
     scope:'VERIFIED_PNVS_CANDIDATE_USERS_ONLY',
     reason:'真实注册人数已连接。完整 DAU/MAU 需要独立的账号级活跃事件，不能用设备 UV 或会话数替代。'};
   }catch(e){console.error('HHBA_AUTH_AGGREGATE_UNAVAILABLE',e?.name||'error');}
  }

  const result={kind:'HHBA_CLOUDFLARE_PRIVATE_METRICS_V1',asOf:new Date().toISOString(),period:{start:since,end:until,days,timezone:'UTC'},collectorStartedAt:installed?.value||null,
   traffic:{quality:'collected',pv:sum('pv'),dailyUvSum:sum('dailyUv'),jobViews:sum('jobViews'),searches:sum('searches'),outboundClicks:sum('outboundClicks'),series,scope:'OPT_IN_CONSENT_ONLY_AND_PER_MINUTE_DEDUP'},
   devices:{quality:'collected',savedJobs:Number(saved?.n||0),devicesWithSavedJobs:Number(saved?.devices||0),added:counts.added||0,removed:counts.removed||0,scope:'CLOUDFLARE_DEVICE_COOKIE_ONLY_NOT_ACCOUNT_SAVES'},
   account:accounts
  };
  return json(result);
 }catch(e){console.error('HHBA_METRICS_PRIVATE_QUERY_FAILED',e?.name||'error');return bad('PRIVATE_METRICS_QUERY_FAILED')}
}
