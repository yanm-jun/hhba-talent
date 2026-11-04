// Event counts with NO persistent visitor identifier. Page views are not UV or DAU.
import {bad,metricDb,sameOrigin,randomHex,isoDay} from '../../_lib/metric-utils.js';
const events=new Set(['page_view','job_view','job_search','official_apply_click']);
export async function onRequestPost({request,env}){
 const db=metricDb(env);
 if(!db)return bad('COLLECTION_NOT_ENABLED');
 if(!sameOrigin(request)||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')
  return bad('ORIGIN_OR_PRIVACY_PREFERENCE_REQUIRED',403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return bad('JSON_REQUIRED',415);
 const size=Number(request.headers.get('content-length')||0);
 if(size>128)return bad('INVALID_EVENT_BODY',413);
 const data=await request.json().catch(()=>null);
 // Reject any path, device, account or query payload. Nothing about a visitor is stored.
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==1||!events.has(data.type))
  return bad('INVALID_EVENT',400);
 const day=isoDay(),created=new Date().toISOString();
 // Schema column name is historical. This fresh nonce is generated PER EVENT,
 // never sent to a browser and never reused; it cannot identify returning visitors.
 const eventNonce=randomHex(24);
 try{
  await db.prepare('INSERT OR IGNORE INTO hhba_traffic_events(day,event_type,visitor_day_hash,minute_bucket,created_at) VALUES (?,?,?,?,?)')
   .bind(day,data.type,eventNonce,created.slice(0,16),created).run();
  return new Response(JSON.stringify({ok:true,accepted:true,scope:'UNLINKED_EVENT_COUNT_ONLY'}),{
   status:202,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  });
 }catch(e){console.error('HHBA_ANONYMOUS_COUNT_WRITE_FAILED',e?.name||'error');return bad('METRICS_WRITE_UNAVAILABLE')}
}
