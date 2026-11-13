// Read-only backend connectivity diagnostics for the standalone HHBA administrator.
// This endpoint NEVER queries D1, writes to KV, or exposes IDs, credentials or PII.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad} from '../../_lib/metric-utils.js';

export async function inspectBindings(env) {
 const configured = key => !!env?.[key];
 const cache = env?.HHBA_LIBRARY_CACHE_KV;
 let baseline='not_bound';
 if(cache && typeof cache.list==='function'){
  try {
   // Listing the exact baseline key needs no full 800KB catalog download.
   const result=await cache.list({prefix:'catalog:baseline:v1',limit:10});
   baseline=result?.keys?.some(item=>item.name==='catalog:baseline:v1')?'present':'missing';
  }catch{baseline='unavailable'}
 }
 return {
  kind:'HHBA_ADMIN_HEALTH_V1',
  observedAt:new Date().toISOString(),
  sources:{
   adminSession:{status:'verified',backend:env?.HHBA_ADMIN_AUTH_MODE==='kv'?'KV':'OTHER'},
   employerCatalog:{status:baseline,backend:'KV',snapshotFirst:env?.HHBA_LIBRARY_SNAPSHOT_FIRST==='1'},
   metricsDatabase:{status:configured('HHBA_METRICS_DB')?'bound_not_queried':'not_bound',backend:'D1'},
   identityDatabase:{status:configured('HHBA_PNVS_AUTH_DB')?'bound_not_queried':'not_bound',backend:'D1'}
  },
  d1QueriesPerformed:0,
  note:'绑定存在不代表 D1 今日额度或数据库读写一定正常；本次自检不执行 SQL，不提供虚假的健康判断。'
 };
}

export async function onRequestGet({request,env}) {
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 return json(await inspectBindings(env));
}
