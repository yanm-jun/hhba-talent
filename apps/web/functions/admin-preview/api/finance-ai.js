// Authenticated and same-origin HHBA finance assistant.
// Read-only against accounting records. Only AI analysis cache may be written in KV.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad,sameOrigin} from '../../_lib/metric-utils.js';
import {
 prepareFinanceAssistant,getFinanceAssistantSnapshot,financeAiModelName
} from '../../_lib/finance-ai-assistant.js';

const MONTH=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
const currentMonth=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',
 year:'numeric',month:'2-digit'}).format(new Date());
async function gate(request,env){
 const admin=await verifyAdmin(request,env);
 if(!admin.ok)return {error:bad(admin.code,admin.status)};
 if(new URL(request.url).hostname!=='admin.hhba.work'||
  admin.email!==String(env.HHBA_FINANCE_ADMIN_EMAIL||'').toLowerCase())
  return {error:bad('FINANCE_OWNER_REQUIRED',403)};
 const kv=env.HHBA_LIBRARY_CACHE_KV;
 if(!kv||typeof kv.get!=='function'||typeof kv.list!=='function'||typeof kv.put!=='function')
  return {error:bad('FINANCE_LEDGER_NOT_BOUND',503)};
 return {kv};
}
export async function onRequestGet({request,env}){
 const a=await gate(request,env);if(a.error)return a.error;
 const month=new URL(request.url).searchParams.get('month');
 if(!MONTH.test(month||'')||month>currentMonth())return bad('INVALID_MONTH',400);
 try{
  const item=await getFinanceAssistantSnapshot(a.kv,month);
  return json({ok:true,found:!!item,report:item||null,
   modelConfigured:!!env.HHBA_FIN_AI?.run||!!env.HHBA_FIN_AI_SERVICE?.fetch,
   modelEnabled:env.HHBA_FIN_AI_ENABLED==='1',
   dailyAutomationEnabled:env.HHBA_FIN_AI_AUTO_ENABLED==='1',
   modelName:financeAiModelName});
 }catch(e){console.error('HHBA_FIN_AI_READ_FAILED',e?.name||'error');return bad('FINANCE_AI_READ_FAILED',503);}
}
export async function onRequestPost({request,env}){
 const a=await gate(request,env);if(a.error)return a.error;
 if(!sameOrigin(request)||request.headers.get('X-HHBA-FINANCE-REQUEST')!=='1'||
  !(request.headers.get('Content-Type')||'').includes('application/json'))
  return bad('ORIGIN_REQUIRED',403);
 let data;try{const raw=await request.text();if(raw.length>500)return bad('BODY_TOO_LARGE',413);data=JSON.parse(raw)}catch{return bad('INVALID_JSON',400)}
 const month=data?.month;
 if(!MONTH.test(month||'')||month>currentMonth())return bad('INVALID_MONTH',400);
 try{
  const result=await prepareFinanceAssistant(a.kv,env,month,{mode:'manual'});
  return json({ok:true,report:result});
 }catch(e){
  console.error('HHBA_FIN_AI_PREPARATION_FAILED',e?.name||'error');
  return bad(e?.message==='REGISTER_CAPACITY_OR_PAGINATION'?'FINANCE_LEDGER_CAP_REACHED':'FINANCE_AI_PREPARATION_FAILED',503);
 }
}
