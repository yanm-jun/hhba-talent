// Scheduler-only endpoint; protected by a dedicated high-entropy bearer key.
// Never accesses payment provider credentials; never creates or publishes reports.
import {prepareFinanceAssistant} from '../../_lib/finance-ai-assistant.js';
import {bad,json} from '../../_lib/metric-utils.js';
const monthCN=()=>new Intl.DateTimeFormat('sv-SE',{
 timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'
}).format(new Date());
function exactSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string'||b.length<64||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export async function onRequestPost({request,env}){
 if(new URL(request.url).hostname!=='admin.hhba.work'||env.HHBA_FIN_AI_AUTO_ENABLED!=='1')
  return bad('AUTOMATION_DISABLED',403);
 const configured=String(env.HHBA_FIN_AI_CRON_SECRET||'');
 const token=String(request.headers.get('Authorization')||'');
 if(!token.startsWith('Bearer ')||!exactSecret(token.slice(7),configured))
  return bad('UNAUTHORIZED',403);
 const kv=env.HHBA_LIBRARY_CACHE_KV;
 if(!kv?.get||!kv?.put||!kv?.list)return bad('LEDGER_NOT_READY',503);
 try{
  const result=await prepareFinanceAssistant(kv,env,monthCN(),{mode:'cron'});
  // No financial amounts or personal data in scheduled HTTP responses or logs.
  return json({ok:true,period:result.period,
   generated:!result.cached,readiness:result.readiness,
   modelState:result.model?.state||'unknown'});
 }catch(e){
  console.error('HHBA_FIN_AI_CRON_FAILED',e?.name||'error');
  return bad('FINANCE_AUTO_REVIEW_FAILED',503);
 }
}
