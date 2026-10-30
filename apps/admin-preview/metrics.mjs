/**
 * HHBA internal console, Phase 1.
 * Only public, aggregated recruitment-index metadata may enter this preview.
 * Nothing here accesses candidate profiles, résumés, login sessions or costs.
 */
export const PUBLIC_INDEX_ENDPOINT =
  'https://hhba-web-production-024c.up.railway.app/api/jobs/page?limit=1&offset=0';

const whole=(value)=>Number.isSafeInteger(value)&&value>=0;
export function parsePublicIndex(payload,now=new Date()){
  if(!payload||typeof payload!=='object')throw Error('PUBLIC_INDEX_INVALID');
  const indexedJobs=payload.allJobs, boards=payload.boards, failures=payload.failures;
  if(!whole(indexedJobs)||!whole(boards)||!whole(failures)||
     typeof payload.updated!=='string')throw Error('PUBLIC_INDEX_INVALID');
  const checked=new Date(payload.updated);
  const age=now.getTime()-checked.getTime();
  if(!Number.isFinite(age)||age< -5*60_000)throw Error('PUBLIC_INDEX_TIMESTAMP_INVALID');
  const stale=age>24*60*60_000;
  const partial=failures>0;
  // Don't display incomplete/stale feeds as investment-grade headline metrics.
  return {
    kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V1',
    source:'HHBA 官方招聘来源公开索引',
    sourceType:'PUBLIC_INDEX_METADATA',
    asOf:checked.toISOString(),
    observedAt:now.toISOString(),
    quality:stale?'stale':partial?'partial':'current',
    counts:{
      indexedJobs:stale||partial?null:indexedJobs,
      successfulJobBoards:stale||partial?null:boards,
      failedJobBoards:failures
    },
    definitions:{
      indexedJobs:'官方招聘来源索引中的岗位记录总数，不等于有效投递数或招聘合作数量',
      successfulJobBoards:'本次同步成功的 ATS 招聘来源数，不等于签约企业或付费客户',
      failedJobBoards:'本次同步失败的 ATS 来源数'
    },
    // These categories are intentionally null until authenticated measurement is live.
    future:{
      totalRegisteredUsers:null,activeUsers30d:null,applyOutboundClicks:null,
      revenueCny:null,retention30d:null,trafficSeries:null
    }
  };
}
export async function getPublicOverview({fetchImpl=fetch,now=new Date()}={}){
 const response=await fetchImpl(PUBLIC_INDEX_ENDPOINT,{
   method:'GET',credentials:'omit',redirect:'error',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(10_000)
 });
 if(!response.ok)throw Error('PUBLIC_INDEX_HTTP_'+response.status);
 const json=await response.json();
 return parsePublicIndex(json,now);
}
