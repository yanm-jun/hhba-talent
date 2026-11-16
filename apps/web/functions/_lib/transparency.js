// HHBA public-finance helpers. All amounts are integer fen, never float currency.
// This service has its own D1 binding; it MUST NOT touch the recruitment/auth D1.
export const VERSION = '2026-11-16-v1';
const moneyFields=[
  'revenueFen','refundFen','aiCostFen','infrastructureFen','personnelFen',
  'operationsFen','taxesFen','otherCostFen','netResultFen','distributableProfitFen',
  'openingPoolFen','poolReceivedFen','poolSpentFen','closingPoolFen'
];
const extraFields=['adjustmentsFen'];
const maxFen=999999999999;
export const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'
 }});
export const failure=(code,status=400)=>json({ok:false,code},status);
export function financeDb(env){return env.HHBA_TRANSPARENCY_DB||null;}
export function validPeriod(period){
 return typeof period==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(period);
}
export function nowBeijing(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',hourCycle:'h23'
 }).formatToParts(date);
 const values=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return {year:Number(values.year),month:Number(values.month),day:Number(values.day),hour:Number(values.hour)};
}
export function priorMonth(date=new Date()){
 const d=nowBeijing(date);
 const y=d.month===1?d.year-1:d.year;
 const m=d.month===1?12:d.month-1;
 return y+'-'+String(m).padStart(2,'0');
}
export function isCurrentPublicationDay(date=new Date()){
 const d=nowBeijing(date);return d.day===21&&d.hour>=10;
}
export function safeParse(value){try{return JSON.parse(value);}catch{return null;}}
export function cleanPeriodPayload(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!validPeriod(value.period))return null;
 const result={period:value.period};
 for(const key of moneyFields){
  const n=value[key];
  if(!Number.isSafeInteger(n)||n<0||n>maxFen)return null;
  result[key]=n;
 }
 for(const key of extraFields){
  const n=value[key];
  if(!Number.isSafeInteger(n)||Math.abs(n)>maxFen)return null;
  result[key]=n;
 }
 if(!Number.isSafeInteger(value.beneficiaries)||value.beneficiaries<0||value.beneficiaries>10000000)return null;
 result.beneficiaries=value.beneficiaries;
 for(const key of ['basisNote','methodNote','poolNote','privacyReviewNote']){
  if(typeof value[key]!=='string'||value[key].trim().length<12||value[key].length>3000)return null;
  result[key]=value[key].trim();
 }
 if(value.isAudited!==false&&value.isAudited!==true)return null;
 result.isAudited=value.isAudited;
 // Reported accounting result is arithmetic and has a separate adjustment ledger.
 const calculated=value.revenueFen-value.refundFen-value.aiCostFen-
  value.infrastructureFen-value.personnelFen-value.operationsFen-
  value.taxesFen-value.otherCostFen+value.adjustmentsFen;
 if(calculated!==value.netResultFen)return null;
 // Company-law compliant distribution is not inferred from monthly operating profit.
 // Admin must explicitly attest the separate statutory distribution basis.
 const poolAccrual=Math.floor(result.distributableProfitFen*40/100);
 result.companyAllocationFen=result.distributableProfitFen-poolAccrual;
 result.poolAccrualFen=poolAccrual;
 if(result.openingPoolFen+result.poolReceivedFen-result.poolSpentFen!==result.closingPoolFen)return null;
 if(result.poolSpentFen>result.openingPoolFen+result.poolReceivedFen)return null;
 if(result.distributableProfitFen===0&&result.poolAccrualFen!==0)return null;
 return result;
}
export function publicReport(row){
 if(!row||row.status!=='published'||!row.published_json)return null;
 const payload=safeParse(row.published_json);
 if(!payload)return null;
 return {
  period:row.period,revision:row.revision||1,publishedAt:row.published_at,
  correctedAt:row.corrected_at||null,
  ...payload
 };
}
export function normalizeEmail(email){
 const value=String(email||'').trim().toLowerCase();
 return value.length<=180&&/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value)?value:null;
}
export function randomToken(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export async function sha256(value){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export function safeOrigin(request){
 const origin=request.headers.get('Origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
export async function readJson(request,maxBytes=12000){
 if(!(request.headers.get('Content-Type')||'').toLowerCase().includes('application/json'))return null;
 const declared=Number(request.headers.get('Content-Length')||0);
 if(declared>maxBytes)return null;
 try{
  const raw=await request.text();
  if(raw.length>maxBytes)return null;
  return JSON.parse(raw);
 }catch{return null;}
}
export function htmlEsc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
export function fromAddress(env){
 const address=String(env.HHBA_FIN_FROM_EMAIL||'').trim();
 // No resend.dev shared sandbox or unverified source should be used in production.
 return /^([\p{L}\p{N} .-]{1,60} <)?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}>?$/iu.test(address)&&
  !address.toLowerCase().includes('@resend.dev')?address:null;
}
export async function deliverEmail(env,{to,subject,html,idempotencyKey,headers={}}){
 const key=String(env.RESEND_API_KEY||'').trim(),from=fromAddress(env);
 if(!key||!from)return {ok:false,code:'MAIL_NOT_CONFIGURED'};
 let response;
 try{
  response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   Authorization:'Bearer '+key,'Content-Type':'application/json',
   'Idempotency-Key':idempotencyKey
  },body:JSON.stringify({from,to:[to],subject,html,headers})});
 }catch{return {ok:false,code:'MAIL_TRANSPORT_ERROR'};}
 if(!response.ok)return {ok:false,code:'MAIL_DELIVERY_ERROR'};
 let data;try{data=await response.json();}catch{return {ok:false,code:'MAIL_RESPONSE_ERROR'};}
 return {ok:!!data?.id,id:data?.id||null,code:data?.id?null:'MAIL_RESPONSE_ERROR'};
}
export async function checkTurnstile(env,token){
 const secret=String(env.HHBA_FIN_TURNSTILE_SECRET||'');
 if(!secret||typeof token!=='string'||token.length<20||token.length>2048)return false;
 try{
  const params=new URLSearchParams({secret,response:token});
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:params});
  if(!r.ok)return false;
  const info=await r.json();return info?.success===true;
 }catch{return false;}
}
export function publicUrl(env){
 const url=String(env.HHBA_FIN_PUBLIC_BASE_URL||'https://hhba.work').trim();
 // Never construct mail links to arbitrary hosts from request headers.
 if(!/^https:\/\/([a-z0-9-]+\.)?hhba\.work\/?$/i.test(url))return 'https://hhba.work';
 return url.replace(/\/$/,'');
}
