import {bad,json,metricDb,sameOrigin,parseCookie,randomHex,cookie,hmac,isoDay} from '../../_lib/metric-utils.js';
const events=new Set(['page_view','job_view','job_search','official_apply_click']);
export async function onRequestPost({request,env}){
 const db=metricDb(env);
 if(!db)return bad('COLLECTION_NOT_ENABLED');
 if(!sameOrigin(request)||request.headers.get('x-hhba-consent')!=='yes'||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return bad('CONSENT_OR_ORIGIN_REQUIRED',403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return bad('JSON_REQUIRED',415);
 let data;try{data=await request.json()}catch{return bad('INVALID_JSON',400)}
 if(!events.has(data?.type))return bad('INVALID_EVENT_TYPE',400);
 let device=parseCookie(request,'__Host-hhba_visitor');
 const fresh=!/^[a-f0-9]{48}$/.test(device);
 if(fresh)device=randomHex(24);
 const day=isoDay(),visitorHash=await hmac(env.HHBA_METRICS_SECRET,'visitor-day:'+day+':'+device);
 // One event of a type per minute per consenting browser: deliberate dedupe; no IP, URL, queries or resume data.
 const minute=new Date().toISOString().slice(0,16);
 try{
  await db.prepare('INSERT OR IGNORE INTO hhba_traffic_events(day,event_type,visitor_day_hash,minute_bucket,created_at) VALUES (?,?,?,?,?)')
   .bind(day,data.type,visitorHash,minute,new Date().toISOString()).run();
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(fresh)headers['Set-Cookie']=cookie('__Host-hhba_visitor',device);
  return new Response(JSON.stringify({accepted:true}),{status:202,headers});
 }catch(e){console.error('HHBA_METRICS_TRAFFIC_WRITE_FAILED',e?.name||'error');return bad('METRICS_WRITE_UNAVAILABLE')}
}
