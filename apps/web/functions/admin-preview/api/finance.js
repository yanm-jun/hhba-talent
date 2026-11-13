// Private, evidence-referenced manual cash ledger for HHBA.
// Append-only KV event keys; NO D1, no bank/payment provider credentials, no fabricated balances.
// Cloudflare KV is eventually consistent: recorded totals are an operational register,
// NOT a bank statement, audited invoice or a confirmed all-time financial balance.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad,sameOrigin} from '../../_lib/metric-utils.js';

const KIND='HHBA_PRIVATE_FINANCE_REGISTER_V1';
const PREFIX='finance:entry:v1:';
const MAX_EVENTS=50;
const CATEGORIES=new Set(['cloudflare','deepseek','domain','email','infrastructure','operations','customer','other']);
const MONTH=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
const DAY=/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const money=v=>Number.isSafeInteger(v)&&v>0&&v<=1_000_000_000;
const text=v=>typeof v==='string'?v.trim():null;
const clean=(v,max,min=0)=>{
 const s=text(v);
 return s!==null&&s.length>=min&&s.length<=max&&!/[\u0000-\u001f\u007f]/.test(s)?s:null;
};
const validMonth=s=>typeof s==='string'&&MONTH.test(s);
function validDay(s,month){
 if(typeof s!=='string'||!DAY.test(s)||!s.startsWith(month+'-'))return false;
 const day=new Date(s+'T00:00:00Z');
 return Number.isFinite(day.valueOf())&&day.toISOString().slice(0,10)===s&&s<=new Date().toISOString().slice(0,10);
}
const prefix=month=>PREFIX+month+':';
function isEvent(v,month){
 if(!v||typeof v!=='object'||!ID.test(v.id||'')||!Number.isFinite(Date.parse(v.at||''))||
  !clean(v.actor,200,5)||v.month!==month)return false;
 if(v.kind==='entry')return ['income','expense'].includes(v.direction)&&CATEGORIES.has(v.category)&&
  money(v.amountFen)&&validDay(v.day,month)&&clean(v.evidenceRef,120,3)!==null&&
  clean(v.note,160)!==null;
 if(v.kind==='void')return ID.test(v.targetId||'')&&clean(v.reason,160,4)!==null;
 return false;
}
export function aggregateFinance(events,month){
 if(!validMonth(month)||!Array.isArray(events))throw Error('INVALID_MONTH');
 const entries=new Map(),voids=new Map();
 for(const e of events){
  if(!isEvent(e,month)||entries.has(e.id)||voids.has(e.id))throw Error('INVALID_REGISTER_RECORD');
  if(e.kind==='entry')entries.set(e.id,e);
  else voids.set(e.id,e);
 }
 const canceled=new Set();
 for(const e of voids.values()){
  if(!entries.has(e.targetId))throw Error('BROKEN_REGISTER_REVERSAL');
  canceled.add(e.targetId);
 }
 const active=[...entries.values()].filter(e=>!canceled.has(e.id));
 let income=0,expense=0;
 for(const e of active){
  if(e.direction==='income')income+=e.amountFen;
  else expense+=e.amountFen;
  if(!Number.isSafeInteger(income)||!Number.isSafeInteger(expense))throw Error('REGISTER_AMOUNT_OVERFLOW');
 }
 return {kind:KIND,month,quality:events.length?'owner_entered_unreconciled':'no_records_not_zero',
  source:'管理员手工登记及凭证编号（未经自动账单或银行对账）',
  consistency:'Cloudflare KV 最终一致；新增或冲销可能短暂延迟展示',
  totals:events.length?{incomeFen:income,expenseFen:expense,netFen:income-expense}:null,
  recordedCount:entries.size,voidedCount:canceled.size,
  eventsCount:events.length,limit:MAX_EVENTS,
  entries:[...entries.values()].map(e=>({
   id:e.id,day:e.day,direction:e.direction,category:e.category,amountFen:e.amountFen,
   evidenceRef:e.evidenceRef,note:e.note,at:e.at,voided:canceled.has(e.id)
  })).sort((a,b)=>b.day.localeCompare(a.day)||b.at.localeCompare(a.at))
 };
}
async function readMonth(kv,month){
 const p=prefix(month);
 const listing=await kv.list({prefix:p,limit:MAX_EVENTS+1});
 if(!listing||!Array.isArray(listing.keys)||listing.list_complete!==true||
   listing.keys.length>MAX_EVENTS)throw Error('REGISTER_CAPACITY_OR_PAGINATION');
 if(!listing.keys.every(x=>typeof x.name==='string'&&x.name.startsWith(p)&&ID.test(x.name.slice(p.length))))throw Error('INVALID_REGISTER_KEY');
 const rows=await Promise.all(listing.keys.map(async x=>{
  const data=await kv.get(x.name,'json');
  if(data===null||data.id!==x.name.slice(p.length))throw Error('MISSING_OR_INVALID_EVENT');
  return data;
 }));
 return aggregateFinance(rows,month);
}
const fail=(e)=>{
 console.error('HHBA_FINANCE_REGISTER_FAILED',e?.name||'Error');
 if(/CAPACITY_OR_PAGINATION/.test(String(e?.message||'')))return bad('REGISTER_MONTH_LIMIT_REACHED',503);
 return bad('PRIVATE_REGISTER_UNAVAILABLE',503);
};
const gate=async(request,env)=>{
 const session=await verifyAdmin(request,env);
 if(!session.ok)return {error:bad(session.code,session.status)};
 const kv=env?.HHBA_LIBRARY_CACHE_KV;
 if(!kv||typeof kv.get!=='function'||typeof kv.list!=='function'||typeof kv.put!=='function')
  return {error:bad('REGISTER_STORE_NOT_CONFIGURED',503)};
 return {kv,actor:session.email};
};
export async function onRequestGet({request,env}){
 const access=await gate(request,env);if(access.error)return access.error;
 const month=new URL(request.url).searchParams.get('month');
 if(!validMonth(month))return bad('INVALID_REGISTER_MONTH',400);
 try{return json(await readMonth(access.kv,month))}
 catch(e){return fail(e)}
}
export async function onRequestPost({request,env}){
 const access=await gate(request,env);if(access.error)return access.error;
 if(!sameOrigin(request)||request.headers.get('x-hhba-finance-request')!=='1'||
  !(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
  return bad('REGISTER_ORIGIN_REQUIRED',403);
 const raw=await request.text();
 if(raw.length>2500)return bad('REGISTER_INPUT_TOO_LARGE',413);
 let v;try{v=JSON.parse(raw)}catch{return bad('INVALID_REGISTER_INPUT',400)}
 if(!v||typeof v!=='object'||Array.isArray(v)||!validMonth(v.month))return bad('INVALID_REGISTER_INPUT',400);
 const month=v.month;
 try{
  // Check month capacity and ensure a reversal references an existing active row.
  // KV is eventually consistent: never promise immediate read-after-write.
  const current=await readMonth(access.kv,month);
  if(current.eventsCount>=MAX_EVENTS)return bad('REGISTER_MONTH_LIMIT_REACHED',409);
  const at=new Date().toISOString(),id=crypto.randomUUID();
  let entry;
  if(v.action==='create'){
   const note=clean(v.note,160),evidenceRef=clean(v.evidenceRef,120,3);
   if(!validDay(v.day,month)||!['income','expense'].includes(v.direction)||
    !CATEGORIES.has(v.category)||!money(v.amountFen)||!evidenceRef||note===null)
    return bad('INVALID_REGISTER_INPUT',400);
   entry={kind:'entry',id,at,month,actor:access.actor,day:v.day,
    direction:v.direction,category:v.category,amountFen:v.amountFen,evidenceRef,note};
  }else if(v.action==='void'){
   const reason=clean(v.reason,160,4);
   if(!ID.test(v.targetId||'')||!reason)return bad('INVALID_REGISTER_INPUT',400);
   const target=current.entries.find(e=>e.id===v.targetId);
   if(!target||target.voided)return bad('REGISTER_ENTRY_NOT_ACTIVE',409);
   entry={kind:'void',id,at,month,actor:access.actor,targetId:v.targetId,reason};
  }else return bad('INVALID_REGISTER_ACTION',400);
  // Unique key per event: no read-modify-write of shared KV key, preserving audit trail.
  await access.kv.put(prefix(month)+id,JSON.stringify(entry));
  return json({ok:true,kind:KIND,eventId:id,month,source:'manual_record',
   message:'RECORD_APPENDED_KV_EVENTUAL_CONSISTENCY'},201);
 }catch(e){return fail(e)}
}
