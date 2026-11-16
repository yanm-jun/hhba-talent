// Read-only adapter for HHBA's legacy admin.hhba.work evidence register.
// The shared KV contains other admin resources; never read outside this
// finance-only prefix. No writes, exports to public pages, or auto-publication.
const KIND='HHBA_PRIVATE_FINANCE_REGISTER_V1';
const PREFIX='finance:entry:v1:';
const MONTH=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
const DAY=/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CATEGORIES=new Set(['cloudflare','deepseek','domain','email','infrastructure','operations','customer','other']);
const MAX_EVENTS=50;
const text=(v,max,min=0)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&
 !/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;
const validDate=(day,month)=>{
 if(typeof day!=='string'||!DAY.test(day)||!day.startsWith(month+'-'))return false;
 const date=new Date(day+'T00:00:00Z');
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===day;
};
const eventValid=(e,month)=>{
 if(!e||!UUID.test(e.id||'')||e.month!==month||
  !Number.isFinite(Date.parse(e.at||''))||!text(e.actor,200,5))return false;
 if(e.kind==='entry')return validDate(e.day,month)&&['income','expense'].includes(e.direction)&&
  CATEGORIES.has(e.category)&&Number.isSafeInteger(e.amountFen)&&
  e.amountFen>0&&e.amountFen<=1_000_000_000&&text(e.evidenceRef,120,3)!==null&&
  text(e.note,160)!==null;
 if(e.kind==='void')return UUID.test(e.targetId||'')&&text(e.reason,160,4)!==null;
 return false;
};
export function aggregatePrivateRegister(events,month){
 if(!MONTH.test(month||'')||!Array.isArray(events)||events.length>MAX_EVENTS)
  throw new Error('INVALID_FINANCE_REGISTER');
 const entries=new Map(),voids=new Map();
 for(const event of events){
  if(!eventValid(event,month)||entries.has(event.id)||voids.has(event.id))
   throw new Error('INVALID_FINANCE_REGISTER_EVENT');
  if(event.kind==='entry')entries.set(event.id,event);
  else voids.set(event.id,event);
 }
 const reversed=new Set();
 for(const e of voids.values()){
  if(!entries.has(e.targetId))throw new Error('INVALID_FINANCE_REVERSAL');
  reversed.add(e.targetId);
 }
 let incomeFen=0,expenseFen=0;
 const byCategory={};
 const records=[];
 for(const e of entries.values()){
  const voided=reversed.has(e.id);
  records.push({id:e.id,day:e.day,direction:e.direction,category:e.category,
   amountFen:e.amountFen,evidenceRef:e.evidenceRef,voided});
  if(voided)continue;
  if(e.direction==='income')incomeFen+=e.amountFen;
  else expenseFen+=e.amountFen;
  const key=e.direction+':'+e.category;
  byCategory[key]=(byCategory[key]||0)+e.amountFen;
 }
 if(!Number.isSafeInteger(incomeFen)||!Number.isSafeInteger(expenseFen)||
  !Object.values(byCategory).every(Number.isSafeInteger))throw new Error('FINANCE_REGISTER_OVERFLOW');
 return {
  kind:KIND,month,
  quality:events.length?'owner_entered_unreconciled':'no_records_not_zero',
  totals:events.length?{incomeFen,expenseFen,netFen:incomeFen-expenseFen}:null,
  recordedCount:entries.size,voidedCount:reversed.size,eventsCount:events.length,
  byCategory,entries:records.sort((a,b)=>b.day.localeCompare(a.day)),
  caution:'仅管理员手动登记；未与银行或供应商账单自动对账，不得直接作为已核验财报'
 };
}
export async function readPrivateRegister(kv,month){
 if(!MONTH.test(month||''))throw new Error('INVALID_REGISTER_MONTH');
 if(!kv||typeof kv.list!=='function'||typeof kv.get!=='function')
  return {ok:false,code:'ADMIN_COST_SOURCE_NOT_CONNECTED'};
 const prefix=PREFIX+month+':';
 const listing=await kv.list({prefix,limit:MAX_EVENTS+1});
 if(!Array.isArray(listing?.keys)||listing.list_complete!==true||
  listing.keys.length>MAX_EVENTS)throw new Error('INCOMPLETE_PRIVATE_REGISTER');
 const keys=listing.keys.map(x=>x?.name);
 if(!keys.every(x=>typeof x==='string'&&x.startsWith(prefix)&&UUID.test(x.slice(prefix.length))))
  throw new Error('UNSAFE_PRIVATE_REGISTER_KEY');
 const events=await Promise.all(keys.map(async key=>{
  const event=await kv.get(key,'json');
  if(!event||event.id!==key.slice(prefix.length))throw new Error('MISSING_PRIVATE_REGISTER_EVENT');
  return event;
 }));
 return {ok:true,...aggregatePrivateRegister(events,month)};
}
