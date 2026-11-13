// Read-only backend connectivity diagnostics for the standalone HHBA administrator.
// This endpoint NEVER queries D1, writes to KV, or exposes IDs, credentials or PII.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad} from '../../_lib/metric-utils.js';
import {MAX_DELTAS} from '../../_lib/library-snapshot-cache.js';

export async function inspectBindings(env) {
 const configured = key => !!env?.[key];
 const cache = env?.HHBA_LIBRARY_CACHE_KV;
 let baseline='not_bound';
 let delta={status:'not_bound',count:null,exact:false,lastDeltaAt:null,limit:MAX_DELTAS};
 if(cache && typeof cache.list==='function'){
  try {
   // Exactly one bounded KV metadata listing (no catalog values and no D1 SQL).
   // 1 baseline key + MAX_DELTAS+1 possible deltas permits over-limit detection.
   const page=await cache.list({prefix:'catalog:',limit:MAX_DELTAS+2});
   if(!page||!Array.isArray(page.keys))throw Error('INVALID_KV_LIST');
   baseline=page.keys.some(x=>x.name==='catalog:baseline:v1')?'present':'missing';
   const deltas=page.keys.map(x=>String(x.name||'')).filter(x=>x.startsWith('catalog:delta:'));
   const exact=page.list_complete!==false;
   const count=deltas.length;
   let lastDeltaAt=null;
   // Do not pretend to know the newest update if the KV listing was truncated.
   if(exact)for(const key of deltas){
    const m=/^catalog:delta:(\\d{13}):/.exec(key);
    if(!m)continue;
    const t=Number(m[1]);
    if(!Number.isSafeInteger(t)||t<1577836800000||t>Date.now()+300000)continue;
    const iso=new Date(t).toISOString();
    if(!lastDeltaAt||iso>lastDeltaAt)lastDeltaAt=iso;
   }
   delta={status:count>=MAX_DELTAS?'at_or_above_limit':count>=MAX_DELTAS-100?'approaching_limit':'normal',
    count,exact,lastDeltaAt,limit:MAX_DELTAS};
  }catch{
   baseline='unavailable';
   delta={status:'unavailable',count:null,exact:false,lastDeltaAt:null,limit:MAX_DELTAS};
  }
 }
 return {
  kind:'HHBA_ADMIN_HEALTH_V1',
  observedAt:new Date().toISOString(),
  sources:{
   adminSession:{status:'verified',backend:env?.HHBA_ADMIN_AUTH_MODE==='kv'?'KV':'OTHER'},
   employerCatalog:{status:baseline,backend:'KV',snapshotFirst:env?.HHBA_LIBRARY_SNAPSHOT_FIRST==='1'},
   catalogDeltas:delta,
   metricsDatabase:{status:configured('HHBA_METRICS_DB')?'bound_not_queried':'not_bound',backend:'D1'},
   identityDatabase:{status:configured('HHBA_PNVS_AUTH_DB')?'bound_not_queried':'not_bound',backend:'D1'}
  },
  d1QueriesPerformed:0,
  note:'只列举 KV 目录键名，不读取企业资料或 D1 SQL。KV 增量计数不是实际已入库企业条数；绑定存在不代表 D1 今日额度可用。'
 };
}

export async function onRequestGet({request,env}) {
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 return json(await inspectBindings(env));
}
