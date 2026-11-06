// Commercial apply-service API. PRE-LAUNCH: no live payment without both
// merchant secrets and an explicit environment opt-in. No client can add credits.
import {getUserByPhone,sessionOfBearer} from '../../_lib/real-auth.js';
import {APPLY_PACKAGES,packagePriceFen,alipayConfigured,alipayCredentialsConfigured,tasksConfigured,
 gatewayRequest,verifyAlipayNotification,amountFen} from '../../_lib/apply-billing.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}});
const err=(code,status=400)=>json({ok:false,error:code},status);
const route='/api/apply';
const iso=()=>new Date().toISOString();
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sameOrigin(request){
 const origin=request.headers.get('Origin');
 return origin===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function jsonBody(request){
 const len=Number(request.headers.get('Content-Length')||0);
 if(len>512)return null;
 try{const value=await request.json();return value&&typeof value==='object'&&!Array.isArray(value)?value:null}
 catch{return null}
}
function walletQuery(){
 return "SELECT (SELECT COALESCE(SUM(package_uses),0) FROM hhba_apply_orders WHERE phone=? AND status='paid') AS purchased,"+
 "(SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone=? AND status='completed') AS consumed,"+
 "(SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone=? AND status='reserved') AS reserved";
}
async function wallet(db,phone){
 const x=await db.prepare(walletQuery()).bind(phone,phone,phone).first();
 const purchased=Number(x?.purchased||0),consumed=Number(x?.consumed||0),reserved=Number(x?.reserved||0);
 return {purchased,consumed,reserved,available:Math.max(0,purchased-consumed-reserved)};
}
async function notifyPayment(request,env,db){
 if(!alipayCredentialsConfigured(env))return new Response('failure',{status:503});
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type')||''))return new Response('failure',{status:400});
 const raw=await request.text();
 if(raw.length>8192)return new Response('failure',{status:413});
 const form=new URLSearchParams(raw);
 // Reject duplicate security-critical keys, including sign.
 for(const key of ['sign','sign_type','app_id','seller_id','out_trade_no','total_amount','trade_status','trade_no'])
  if(form.getAll(key).length!==1)return new Response('failure',{status:400});
 if(!(await verifyAlipayNotification(form,env.ALIPAY_PUBLIC_KEY)))return new Response('failure',{status:403});
 const p=Object.fromEntries(form);
 if(p.app_id!==env.ALIPAY_APP_ID||p.seller_id!==env.ALIPAY_SELLER_ID||
  !['TRADE_SUCCESS','TRADE_FINISHED'].includes(p.trade_status)||
  !uuidPattern.test(p.out_trade_no)||!/^[A-Za-z0-9_-]{4,90}$/.test(p.trade_no))
  return new Response('failure',{status:400});
 const order=await db.prepare('SELECT id,amount_fen,status,provider_trade_no FROM hhba_apply_orders WHERE id=?')
  .bind(p.out_trade_no).first();
 if(!order||amountFen(p.total_amount)!==order.amount_fen||
  (order.provider_trade_no&&order.provider_trade_no!==p.trade_no)||
  !['pending','paid'].includes(order.status))
  return new Response('failure',{status:400});
 // A single conditional state change is the only granting operation.
 // Duplicate or out-of-order notifications never increment a separate counter.
 await db.prepare("UPDATE hhba_apply_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE id=? AND status='pending'")
  .bind(p.trade_no,iso(),p.out_trade_no).run();
 return new Response('success',{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
export async function onRequest({request,env}){
 const pathname=new URL(request.url).pathname;
 if(!pathname.startsWith(route))return err('NOT_FOUND',404);
 const path=pathname.slice(route.length).replace(/\/$/,'')||'/';
 const method=request.method;
 if(method==='GET'&&path==='/config')
  return json({ok:true,packages:APPLY_PACKAGES.map(uses=>({uses,amountFen:packagePriceFen(uses)})),
   paymentEnabled:alipayConfigured(env),tasksEnabled:tasksConfigured(env)});
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!db)return err('ACCOUNT_DATABASE_NOT_CONNECTED',503);
 if(path==='/alipay/notify'){
  if(method!=='POST')return err('METHOD_NOT_ALLOWED',405);
  try{return await notifyPayment(request,env,db)}catch{return new Response('failure',{status:500})}
 }
 let session,user;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return err('SESSION_INVALID',401);
  user=await getUserByPhone(db,session.phone);
  if(!user||user.role!=='candidate')return err('CANDIDATE_REQUIRED',403);
 }catch{return err('SESSION_CHECK_FAILED',503)}
 const phone=session.phone;
 try{
  if(method==='GET'&&path==='/wallet')return json({ok:true,wallet:await wallet(db,phone)});
  if(method==='GET'&&path==='/orders'){
   const rows=await db.prepare("SELECT id,package_uses AS uses,amount_fen AS amountFen,status,created_at AS createdAt,paid_at AS paidAt FROM hhba_apply_orders WHERE phone=? ORDER BY created_at DESC LIMIT 30").bind(phone).all();
   return json({ok:true,items:rows.results||[]});
  }
  if(method==='GET'&&path==='/tasks'){
   const rows=await db.prepare("SELECT id,status,created_at AS createdAt,finished_at AS finishedAt FROM hhba_apply_tasks WHERE phone=? ORDER BY created_at DESC LIMIT 30").bind(phone).all();
   return json({ok:true,items:rows.results||[]});
  }
  if(method==='GET'&&/^\/orders\/[0-9a-f-]{36}$/i.test(path)){
   const id=path.split('/')[2];if(!uuidPattern.test(id))return err('INVALID_ORDER_ID');
   const order=await db.prepare("SELECT id,package_uses AS uses,amount_fen AS amountFen,status,created_at AS createdAt,paid_at AS paidAt,qr_code AS qrCode FROM hhba_apply_orders WHERE id=? AND phone=?").bind(id,phone).first();
   return order?json({ok:true,order}):err('ORDER_NOT_FOUND',404);
  }
  if(method==='POST'&&path==='/orders'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   if(!alipayConfigured(env))return err('PAYMENT_NOT_ENABLED',503);
   const body=await jsonBody(request);
   const uses=body?.uses;
   const amount=packagePriceFen(uses);
   if(amount===null)return err('INVALID_PACKAGE');
   const recent=await db.prepare("SELECT COUNT(*) AS n FROM hhba_apply_orders WHERE phone=? AND created_at>=?").bind(phone,new Date(Date.now()-3600000).toISOString()).first();
   if(Number(recent?.n||0)>=5)return err('ORDER_RATE_LIMITED',429);
   const id=crypto.randomUUID(),createdAt=iso();
   await db.prepare("INSERT INTO hhba_apply_orders(id,phone,package_uses,amount_fen,status,created_at) VALUES(?,?,?,?,'pending',?)").bind(id,phone,uses,amount,createdAt).run();
   let payload;
   try{
    payload=await gatewayRequest(env,'alipay.trade.precreate',{
     out_trade_no:id,total_amount:(amount/100).toFixed(2),
     subject:'HHBA 一键网申 '+uses+' 次套餐',timeout_express:'30m'
    });
   }catch{
    await db.prepare("UPDATE hhba_apply_orders SET status='closed' WHERE id=? AND phone=? AND status='pending'").bind(id,phone).run();
    return err('PAYMENT_GATEWAY_UNAVAILABLE',502);
   }
   if(!payload.qr_code||typeof payload.qr_code!=='string'||payload.qr_code.length>2000){
    await db.prepare("UPDATE hhba_apply_orders SET status='closed' WHERE id=? AND phone=? AND status='pending'").bind(id,phone).run();
    return err('PAYMENT_GATEWAY_INVALID_RESPONSE',502);
   }
   await db.prepare("UPDATE hhba_apply_orders SET qr_code=? WHERE id=? AND phone=? AND status='pending'").bind(payload.qr_code,id,phone).run();
   return json({ok:true,order:{id,uses,amountFen:amount,status:'pending',qrCode:payload.qr_code,createdAt}},201);
  }
  if(method==='POST'&&path==='/tasks/reserve'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   // Disabled until the user-approved browser engine and secure settlement
   // endpoints are operational. Never charge for a placeholder run.
   if(!tasksConfigured(env))return err('TASK_ENGINE_NOT_ENABLED',503);
   return err('TASK_ENGINE_NOT_VERIFIED',503);
  }
  return err('METHOD_NOT_ALLOWED',405);
 }catch{return err('APPLY_SERVICE_UNAVAILABLE',503)}
}
