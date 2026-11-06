// Commercial apply-service API. PRE-LAUNCH: no live payment without both
// merchant secrets and an explicit environment opt-in. No client can add credits.
import {getUserByPhone,sessionOfBearer} from '../../_lib/real-auth.js';
import {APPLY_PACKAGES,packagePriceFen,alipayConfigured,alipayCredentialsConfigured,tasksConfigured,
 gatewayRequest,verifyAlipayNotification,amountFen} from '../../_lib/apply-billing.js';
import {reconcileOrder,closeUnpaidOrder} from '../../_lib/apply-payment-reconciliation.js';
import {aiConfigured,validateAISuggestionRequest,suggestSafeFields,validateAIKeyMapRequest,suggestAIFieldKeys} from '../../_lib/apply-ai-suggest.js';
import {pairingConfigured,validExtensionOrigin,extensionCors,createPairCode,claimPairCode,extensionSession,revokeExtensions} from '../../_lib/apply-extension-pairing.js';
import {syncKeyConfigured,prepareProfileTransfer,claimProfileTransfer,revokeProfileTransfer} from '../../_lib/apply-profile-sync.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}});
const err=(code,status=400)=>json({ok:false,error:code},status);
const route='/api/apply';
const iso=()=>new Date().toISOString();
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderPath=/^\/orders\/([0-9a-f-]{36})(?:\/(status|close|refund-request))?$/i;
function sameOrigin(request){
 const origin=request.headers.get('Origin');
 return origin===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function jsonBody(request,maxBytes=512){
 const len=Number(request.headers.get('Content-Length')||0);
 if(len>maxBytes)return null;
 try{
  const raw=await request.text();
  if(raw.length>maxBytes)return null;
  const value=JSON.parse(raw);
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return null}
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
   paymentEnabled:alipayConfigured(env),tasksEnabled:tasksConfigured(env),pairingEnabled:pairingConfigured(env)});
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!db)return err('ACCOUNT_DATABASE_NOT_CONNECTED',503);
 // Extension requests have a completely separate, narrow bearer credential;
 // they are never allowed to use site session tokens or modify credits.
 if(path.startsWith('/extension/')){
  if(!validExtensionOrigin(request,env))return err('EXTENSION_ORIGIN_DENIED',403);
  const cors=extensionCors(request,env);
  const wrap=response=>{
   const headers=new Headers(response.headers);
   for(const [key,value] of Object.entries(cors))headers.set(key,value);
   return new Response(response.body,{status:response.status,headers});
  };
  if(method==='OPTIONS')return wrap(new Response(null,{status:204}));
  if(!pairingConfigured(env))return wrap(err('PAIRING_NOT_ENABLED',503));
  if(method==='POST'&&path==='/extension/claim'){
   const body=await jsonBody(request,128);
   const ip=request.headers.get('CF-Connecting-IP')||'';
   try{
    const result=await claimPairCode(db,env,body?.code,ip);
    return wrap(result.ok?json(result):err(result.error,result.error==='PAIR_RATE_LIMITED'?429:400));
   }catch{return wrap(err('PAIR_SERVICE_UNAVAILABLE',503))}
  }
  let ext;
  try{ext=await extensionSession(db,env,request)}
  catch{return wrap(err('EXTENSION_SESSION_UNAVAILABLE',503))}
  if(!ext)return wrap(err('EXTENSION_SESSION_INVALID',401));
  if(method==='POST'&&path==='/extension/profile/claim'){
   // Separate extension session, same verified account and fixed extension origin.
   if(!syncKeyConfigured(env))return wrap(err('PROFILE_TRANSFER_NOT_CONFIGURED',503));
   try{
    const user=await getUserByPhone(db,ext.phone);
    if(user?.role!=='candidate')return wrap(err('CANDIDATE_REQUIRED',403));
    const claim=await claimProfileTransfer(db,env,ext.phone);
    return wrap(claim.ok?json(claim):err(claim.error,claim.status));
   }catch{return wrap(err('PROFILE_TRANSFER_UNAVAILABLE',503))}
  }
  if(method==='GET'&&path==='/extension/wallet'){
   try{
    const user=await getUserByPhone(db,ext.phone);
    if(user?.role!=='candidate')return wrap(err('CANDIDATE_REQUIRED',403));
    return wrap(json({ok:true,wallet:await wallet(db,ext.phone),expiresAt:ext.expires_at}));
   }catch{return wrap(err('ACCOUNT_DATABASE_NOT_CONNECTED',503))}
  }
  // V0.5: scoped AI label mapping; this never opens credit writes or returns
  // personal profile values. Call budget is bounded by a single D1 SQL write.
  if(method==='POST'&&path==='/extension/ai/map'){
   if(!aiConfigured(env)||env.HHBA_APPLY_EXTENSION_AI_ENABLED!=='1')
    return wrap(err('AI_NOT_ENABLED',503));
   let user;
   try{user=await getUserByPhone(db,ext.phone)}
   catch{return wrap(err('ACCOUNT_DATABASE_NOT_CONNECTED',503))}
   if(!user||user.role!=='candidate')return wrap(err('CANDIDATE_REQUIRED',403));
   const body=await jsonBody(request,6000);
   if(!validateAIKeyMapRequest(body))return wrap(err('INVALID_AI_REQUEST',400));
   try{
    const now=iso(),cutoff=new Date(Date.now()-3600000).toISOString();
    const used=await db.prepare(
     'INSERT INTO hhba_apply_ai_requests(id,phone,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM hhba_apply_ai_requests WHERE phone=? AND created_at>=?)<3'
    ).bind(crypto.randomUUID(),ext.phone,now,ext.phone,cutoff).run();
    if(!used?.success||used?.meta?.changes!==1)return wrap(err('AI_RATE_LIMITED',429));
    const advice=await suggestAIFieldKeys(env,body);
    return wrap(advice.ok?json(advice):err(advice.error,502));
   }catch{return wrap(err('AI_SERVICE_UNAVAILABLE',503))}
  }
  if(method==='POST'&&path==='/extension/disconnect'){
   try{
    await db.prepare('UPDATE hhba_apply_extension_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
      .bind(iso(),ext.tokenHash).run();
    return wrap(json({ok:true}));
   }catch{return wrap(err('PAIR_SERVICE_UNAVAILABLE',503))}
  }
  return wrap(err('METHOD_NOT_ALLOWED',405));
 }
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
  if(method==='GET'&&path==='/pair/status'){
   if(!pairingConfigured(env))return err('PAIRING_NOT_ENABLED',503);
   const now=iso();
   const total=await db.prepare('SELECT COUNT(*) AS n FROM hhba_apply_extension_sessions WHERE phone=? AND revoked_at IS NULL AND expires_at>?')
    .bind(phone,now).first();
   return json({ok:true,connectedDevices:Number(total?.n||0)});
  }
  if(method==='POST'&&path==='/profile-transfer/prepare'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   if(!pairingConfigured(env))return err('PAIRING_NOT_ENABLED',503);
   const body=await jsonBody(request,22000);
   if(!body)return err('INVALID_PROFILE_SYNC_REQUEST',400);
   try{
    const result=await prepareProfileTransfer(db,env,phone,body);
    return result.ok?json(result):err(result.error,result.status);
   }catch{return err('PROFILE_TRANSFER_UNAVAILABLE',503)}
  }
  if(method==='POST'&&path==='/profile-transfer/revoke'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   try{
    const result=await revokeProfileTransfer(db,phone);
    return result.ok?json(result):err('PROFILE_TRANSFER_UNAVAILABLE',503);
   }catch{return err('PROFILE_TRANSFER_UNAVAILABLE',503)}
  }
  if(method==='POST'&&path==='/pair/start'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   if(!pairingConfigured(env))return err('PAIRING_NOT_ENABLED',503);
   const result=await createPairCode(db,env,phone);
   return result.ok?json(result):err(result.error,result.error==='PAIR_RATE_LIMITED'?429:503);
  }
  if(method==='POST'&&path==='/pair/revoke'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   if(!pairingConfigured(env))return err('PAIRING_NOT_ENABLED',503);
   await revokeExtensions(db,phone);
   await revokeProfileTransfer(db,phone);
   return json({ok:true,connectedDevices:0});
  }
  if(method==='POST'&&path==='/ai/suggest'){
   if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
   if(!aiConfigured(env))return err('AI_NOT_ENABLED',503);
   const body=await jsonBody(request,16000);
   if(!validateAISuggestionRequest(body))return err('INVALID_AI_REQUEST',400);
   // Atomic hour cap prevents unlimited model calls; never store resume text
   // or form labels in the audit.
   const now=iso(),limit=new Date(Date.now()-3600000).toISOString();
   const reserved=await db.prepare(
    "INSERT INTO hhba_apply_ai_requests(id,phone,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM hhba_apply_ai_requests WHERE phone=? AND created_at>=?)<3"
   ).bind(crypto.randomUUID(),phone,now,phone,limit).run();
   if(!reserved?.success||reserved?.meta?.changes!==1)return err('AI_RATE_LIMITED',429);
   const advice=await suggestSafeFields(env,body);
   return advice.ok?json(advice):err(advice.error,502);
  }
  if(method==='GET'&&path==='/wallet')return json({ok:true,wallet:await wallet(db,phone)});
  if(method==='GET'&&path==='/orders'){
   const rows=await db.prepare("SELECT id,package_uses AS uses,amount_fen AS amountFen,status,created_at AS createdAt,paid_at AS paidAt FROM hhba_apply_orders WHERE phone=? ORDER BY created_at DESC LIMIT 30").bind(phone).all();
   return json({ok:true,items:rows.results||[]});
  }
  if(method==='GET'&&path==='/tasks'){
   const rows=await db.prepare("SELECT id,status,created_at AS createdAt,finished_at AS finishedAt FROM hhba_apply_tasks WHERE phone=? ORDER BY created_at DESC LIMIT 30").bind(phone).all();
   return json({ok:true,items:rows.results||[]});
  }
  if(method==='GET'&&path==='/refund-requests'){
   const rows=await db.prepare("SELECT order_id AS orderId,reason,status,created_at AS createdAt FROM hhba_apply_refund_requests WHERE phone=? ORDER BY created_at DESC LIMIT 30").bind(phone).all();
   return json({ok:true,items:rows.results||[]});
  }
  const matched=path.match(orderPath);
  if(matched&&uuidPattern.test(matched[1])){
   const orderId=matched[1],action=matched[2]||'';
   // Fetch the owner's order; no account IDs, prices or states accepted from client.
   const own=await db.prepare("SELECT id,phone,package_uses AS uses,amount_fen,status,provider_trade_no,qr_code AS qrCode,created_at AS createdAt,paid_at AS paidAt,checked_at AS checkedAt FROM hhba_apply_orders WHERE id=? AND phone=?").bind(orderId,phone).first();
   if(!own)return err('ORDER_NOT_FOUND',404);
   if(method==='GET'&&action==='status'){
    // Rate-limit provider reads while allowing a user-triggered refresh.
    if(own.status==='pending'&&(!own.checkedAt||Date.now()-Date.parse(own.checkedAt)>10000)){
     try{
      const result=await reconcileOrder(db,env,own);
      if(!result.ok)return err(result.error,502);
     }catch{return err('PAYMENT_QUERY_UNAVAILABLE',502)}
    }
    const updated=await db.prepare("SELECT id,package_uses AS uses,amount_fen AS amountFen,status,created_at AS createdAt,paid_at AS paidAt,qr_code AS qrCode FROM hhba_apply_orders WHERE id=? AND phone=?").bind(orderId,phone).first();
    return json({ok:true,order:updated});
   }
   if(method==='POST'&&action==='close'){
    if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
    if(own.status!=='pending')return err('ORDER_NOT_PENDING',409);
    try{
     const outcome=await closeUnpaidOrder(db,env,own);
     if(!outcome.ok)return err(outcome.error,outcome.error==='ORDER_ALREADY_PAID'?409:502);
    }catch{return err('PAYMENT_CLOSE_UNCONFIRMED',502)}
    const updated=await db.prepare("SELECT id,package_uses AS uses,amount_fen AS amountFen,status,created_at AS createdAt,paid_at AS paidAt,qr_code AS qrCode FROM hhba_apply_orders WHERE id=? AND phone=?").bind(orderId,phone).first();
    return json({ok:true,order:updated});
   }
   if(method==='POST'&&action==='refund-request'){
    if(!sameOrigin(request))return err('ORIGIN_REQUIRED',403);
    if(own.status!=='paid')return err('ORDER_NOT_PAID',409);
    const body=await jsonBody(request);
    const reason=typeof body?.reason==='string'?body.reason.trim():'';
    if(reason.length<2||reason.length>300)return err('INVALID_REFUND_REASON');
    const id=crypto.randomUUID(),now=iso();
    await db.prepare("INSERT OR IGNORE INTO hhba_apply_refund_requests(id,order_id,phone,reason,status,created_at,updated_at) VALUES(?,?,?,?,'requested',?,?)").bind(id,orderId,phone,reason,now,now).run();
    const req=await db.prepare("SELECT order_id AS orderId,reason,status,created_at AS createdAt FROM hhba_apply_refund_requests WHERE order_id=? AND phone=?").bind(orderId,phone).first();
    return json({ok:true,request:req,note:'REVIEW_ONLY_NOT_REFUNDED'},201);
   }
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
    // Timeout does NOT establish that Alipay failed to create the transaction.
    // Preserve pending and reconcile by out_trade_no before any retry or close.
    return err('PAYMENT_GATEWAY_UNCERTAIN',502);
   }
   if(!payload.qr_code||typeof payload.qr_code!=='string'||payload.qr_code.length>2000){
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
