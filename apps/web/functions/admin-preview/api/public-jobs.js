// HHBA admin-only, source-validated public job snapshot gateway.
// The standalone admin Pages site intentionally has NO /data/jobs.json assets.
// Read the exact production public metrics endpoint; never touch D1 or expose raw jobs.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad} from '../../_lib/metric-utils.js';

const OFFICIAL_SOURCE='https://hhba.work/api/metrics/public';
const MAX_AGE_MS=86400000;
const REQUIRED_COUNTS=['indexedJobs','displayableJobs','auditedJobRequirements',
 'checkedAtsSources','failedAtsSources','distinctIndexedCompanies'];

export function validateOfficialSnapshot(raw,now=Date.now()){
 if(raw?.kind!=='HHBA_CLOUDFLARE_PUBLIC_METRICS_V1'||
  !['current','partial','stale'].includes(raw.quality)||!raw.counts||
  typeof raw.counts!=='object'||Array.isArray(raw.counts))throw Error('INVALID_SOURCE_KIND');
 const sourceTime=Date.parse(raw.sourceTime),auditTime=Date.parse(raw.auditCheckedAt);
 if(!Number.isFinite(sourceTime)||!Number.isFinite(auditTime)||
  sourceTime>now+300000||auditTime>now+300000)throw Error('INVALID_SOURCE_TIMES');
 const counts={};
 for(const key of REQUIRED_COUNTS){
  const value=raw.counts[key];
  if(value!==null&&!(Number.isSafeInteger(value)&&value>=0))throw Error('INVALID_SOURCE_COUNTS');
  counts[key]=value;
 }
 // Public source metrics must be internally consistent before appearing in an investor/manager dashboard.
 if((counts.indexedJobs!==null&&counts.displayableJobs!==null&&counts.displayableJobs>counts.indexedJobs)||
    (counts.displayableJobs!==null&&counts.auditedJobRequirements!==null&&counts.auditedJobRequirements>counts.displayableJobs)||
    (counts.displayableJobs!==null&&counts.distinctIndexedCompanies!==null&&counts.distinctIndexedCompanies>counts.displayableJobs)||
    (counts.checkedAtsSources!==null&&counts.failedAtsSources!==null&&counts.failedAtsSources>counts.checkedAtsSources)||
    (raw.quality==='current'&&counts.failedAtsSources!==0))
    throw Error('INCONSISTENT_SOURCE_COUNTS');
 const stale=raw.quality==='stale'||now-sourceTime>MAX_AGE_MS||now-auditTime>MAX_AGE_MS;
 if(stale)for(const key of REQUIRED_COUNTS){
  if(key!=='failedAtsSources')counts[key]=null;
 }
 return {
  kind:'HHBA_CLOUDFLARE_PUBLIC_METRICS_V1',
  quality:stale?'stale':raw.quality,
  source:'HHBA 正式站已发布的官网职位索引与同批次审计',
  sourceTime:raw.sourceTime,auditCheckedAt:raw.auditCheckedAt,
  counts,
  definitions:{
   displayableJobs:'已排除明确异常的索引记录，不能证明现在仍可投递',
   checkedAtsSources:'公开 ATS 来源核查数，不是企业入驻或签约数',
   auditedJobRequirements:'本批已核验完整任职要求的岗位数'
  }
 };
}

export async function onRequestGet({request,env}){
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 if(new URL(request.url).hostname!=='admin.hhba.work')return bad('ADMIN_HOST_REQUIRED',404);
 try{
  const res=await fetch(OFFICIAL_SOURCE,{method:'GET',credentials:'omit',redirect:'error',
   headers:{Accept:'application/json'},cf:{cacheTtl:120,cacheEverything:true}});
  if(!res.ok||!(res.headers.get('content-type')||'').includes('application/json'))
   throw Error('OFFICIAL_PUBLIC_METRICS_UNAVAILABLE');
  const body=await res.text();
  if(body.length>16000)throw Error('OFFICIAL_PUBLIC_METRICS_OVERSIZED');
  const result=validateOfficialSnapshot(JSON.parse(body));
  return json(result);
 }catch(e){
  console.warn('HHBA_ADMIN_OFFICIAL_SNAPSHOT_UNAVAILABLE',e?.name||'error');
  return bad('PUBLIC_RECRUITMENT_SNAPSHOT_UNAVAILABLE',503);
 }
}
