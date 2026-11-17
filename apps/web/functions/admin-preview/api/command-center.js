// HHBA single-admin operating cockpit: real, read-only monthly disclosure and
// narrowly scoped external discovery counters. NEVER treat these as all AI matches,
// real-time cash revenue, or customer conversion/placement results.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad} from '../../_lib/metric-utils.js';
import {publicReport} from '../../_lib/transparency.js';

const allowedDays=new Set([7,30,90]);
const dayUTC=ms=>new Date(ms).toISOString().slice(0,10);
const safeFen=v=>Number.isSafeInteger(v)?v:null;
const safeCount=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
export function privateFinanceSnapshot(rows){
 const reports=[];
 for(const row of rows||[]){
  const r=publicReport(row);
  if(!r||typeof r.period!=='string'||!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(r.period))continue;
  reports.push({
   period:r.period,publishedAt:r.publishedAt,
   revenueFen:safeFen(r.revenueFen),refundFen:safeFen(r.refundFen),
   netResultFen:safeFen(r.netResultFen),
   distributableProfitFen:safeFen(r.distributableProfitFen),
   poolAccrualFen:safeFen(r.poolAccrualFen),
   aiCostFen:safeFen(r.aiCostFen),infrastructureFen:safeFen(r.infrastructureFen),
   operationsFen:safeFen(r.operationsFen)
  });
 }
 reports.sort((a,b)=>a.period.localeCompare(b.period));
 return {quality:reports.length?'published_only':'no_published_report',
   latest:reports.at(-1)||null,
   months:reports,
   scope:'仅人工审核并公开的历史月报；当前未结束月份及草稿不参与核算'};
}
export function externalDiscoverySnapshot(rows){
 const byDay=(rows||[]).map(r=>({day:r.day_utc,count:safeCount(r.n)}))
  .filter(r=>/^20\d{2}-\d{2}-\d{2}$/.test(r.day)&&r.count!==null);
 return {quality:'partial_scope',total:byDay.reduce((n,r)=>n+r.count,0),
  byDay,successRate:null,avgLatencyMs:null,costFen:null,
  scope:'仅可选外部岗位发现请求配额日志；不包含全部简历匹配、推荐成功率、实际模型耗费，也不保存简历或搜索文本'};
}
export async function onRequestGet({request,env}){
 const identity=await verifyAdmin(request,env);
 if(!identity.ok)return bad(identity.code,identity.status);
 if(new URL(request.url).hostname!=='admin.hhba.work')return bad('ADMIN_ONLY_HOST',403);
 const expected=String(env.HHBA_FINANCE_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!expected||identity.email!==expected)return bad('FINANCE_OWNER_REQUIRED',403);
 const url=new URL(request.url),days=Number(url.searchParams.get('days')||30);
 if(!allowedDays.has(days))return bad('INVALID_DAYS',400);
 const to=dayUTC(Date.now()),from=dayUTC(Date.now()-(days-1)*86400000);
 const financeDB=env.HHBA_TRANSPARENCY_DB;
 const authDB=env.HHBA_PNVS_AUTH_DB;
 let finance={quality:'not_connected',latest:null,months:[],scope:'未连接财务 D1'},financeError=null;
 let externalDiscovery={quality:'not_connected',total:null,byDay:[],successRate:null,avgLatencyMs:null,costFen:null,
  scope:'未连接身份 D1 或外部探索请求数据'};
 let payment={quality:'not_connected',orderCount:null,paidFen:null,
  scope:'现有支付订单表缺失或尚未核验；不可用套餐标价、点击次数冒充实收'};
 if(financeDB?.prepare){
  try{
   const records=await financeDB.prepare(
    "SELECT period,status,revision,published_at,published_json FROM hhba_fin_reports WHERE status='published' ORDER BY period DESC LIMIT 12").all();
   finance=privateFinanceSnapshot(records.results||[]);
  }catch(e){finance={...finance,quality:'query_failed'};financeError=e?.name||'error';}
 }
 if(authDB?.prepare){
  try{
   const query=await authDB.prepare(
    'SELECT day_utc,COUNT(*) AS n FROM hhba_external_search_requests WHERE day_utc>=? AND day_utc<=? GROUP BY day_utc ORDER BY day_utc')
    .bind(from,to).all();
   externalDiscovery=externalDiscoverySnapshot(query.results||[]);
  }catch(e){console.warn('HHBA_EXTERNAL_DISCOVERY_STATS_UNAVAILABLE',e?.name||'error');externalDiscovery.quality='query_failed';}
  try{
   const has=await authDB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_apply_orders'").first();
   if(has?.name==='hhba_apply_orders'){
    const sum=await authDB.prepare(
     "SELECT COUNT(*) AS n, COALESCE(SUM(amount_fen),0) AS fen FROM hhba_apply_orders WHERE status='paid' AND paid_at>=? AND paid_at<?")
     .bind(from+'T00:00:00Z',dayUTC(Date.now()+86400000)+'T00:00:00Z').first();
    payment={quality:'verified_paid_apply_orders_only',orderCount:safeCount(sum?.n),paidFen:safeFen(sum?.fen),
     scope:'仅已完成支付通知核验的代投次数包订单；不含其他产品、退款待对账，不代表全部平台营业收入'};
   }
  }catch(e){console.warn('HHBA_APPLY_ORDER_SUMMARY_UNAVAILABLE',e?.name||'error');payment.quality='query_failed';}
 }
 return json({ok:true,kind:'HHBA_PRIVATE_OPERATIONS_COCKPIT_V1',
  period:{from,to,days,timezone:'UTC'},
  checkedAt:new Date().toISOString(),
  finance,externalDiscovery,payment,
  controls:{publicSubscriptionsEnabled:env.HHBA_FIN_SUBSCRIPTIONS_ENABLED==='1',
   batchMailEnabled:env.HHBA_FIN_SEND_ENABLED==='1'},
  caveat:'未上线的收款/费用及 AI 成功率保持空值；不得凭访问量、搜索配额或月报草稿推断平台收益。',
  ...(financeError?{financeStatus:'not_available'}:{})
 });
}
