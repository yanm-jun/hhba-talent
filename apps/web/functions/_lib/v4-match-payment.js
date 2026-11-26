// Match orders are a separate product, never apply credits. Only a verified
// merchant response can authorize an exact paid research task.
import {matchTaskKey} from './v4-match-checkpoint-storage.js';
import {gatewayRequest,verifyAlipayNotification} from './apply-billing.js';
import {verifiedTrade} from './apply-payment-reconciliation.js';
export const MATCH_PRICE_FEN=1990;
export const matchPaymentRequired=env=>env?.HHBA_MATCH_PAYMENT_REQUIRED==='1';
export const matchPaymentConfigured=env=>env?.HHBA_MATCH_PAYMENTS_ENABLED==='1'&&['ALIPAY_APP_ID','ALIPAY_SELLER_ID','ALIPAY_PRIVATE_KEY_PKCS8','ALIPAY_PUBLIC_KEY'].every(k=>typeof env?.[k]==='string'&&!!env[k].trim())&&env.HHBA_MATCH_ALIPAY_NOTIFY_URL==='https://hhba.work/api/match-payment/alipay/notify';
export const matchOrderId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const error=(code,status=402)=>Object.assign(Error(code),{code,status});
const iso=()=>new Date().toISOString();
const columns='id,phone,amount_fen,status,provider_trade_no,qr_code,created_at,paid_at,checked_at,task_binding,task_closed_at';
export async function currentMatchOrder(db,phone){return db.prepare('SELECT '+columns+" FROM hhba_match_orders WHERE phone=? AND status IN ('pending','paid') AND task_closed_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(phone).first();}
export async function ownedMatchOrder(db,phone,id){return db.prepare('SELECT '+columns+' FROM hhba_match_orders WHERE phone=? AND id=?').bind(phone,id).first();}
export const publicMatchOrder=o=>o?{id:o.id,amountFen:o.amount_fen,status:o.status,qrCode:o.status==='pending'?o.qr_code:null,createdAt:o.created_at,paidAt:o.paid_at,bound:!!o.task_binding,closed:!!o.task_closed_at}:null;
export async function matchOrderBinding(env,account,task){return matchTaskKey(env,account,task.id,{scope:'paid-match-v1',text:task.text,role:task.role,excludeUrls:task.excludeUrls,resume_id:task.resume_id});}
export async function bindPaidMatchOrder(env,session,task){
 if(!matchPaymentRequired(env))return;
 if(!matchOrderId(task.payment_order_id)||task.id!==task.payment_order_id)throw error('AI_MATCH_PAYMENT_REQUIRED');
 const db=env.HHBA_PNVS_AUTH_DB,binding=await matchOrderBinding(env,session.phone,task);
 try{
  await db.prepare("UPDATE hhba_match_orders SET task_binding=?,bound_at=? WHERE id=? AND phone=? AND amount_fen=? AND status='paid' AND provider_trade_no IS NOT NULL AND task_binding IS NULL AND task_closed_at IS NULL").bind(binding,iso(),task.id,session.phone,MATCH_PRICE_FEN).run();
  await assertPaidMatchOrder(env,session,task);
 }catch(e){if(e?.code)throw e;throw error('AI_MATCH_PAYMENT_UNAVAILABLE',503);}
}
export async function assertPaidMatchOrder(env,session,task){
 if(!matchPaymentRequired(env))return;
 if(!matchOrderId(task?.payment_order_id)||task.id!==task.payment_order_id)throw error('AI_MATCH_PAYMENT_REQUIRED');
 const binding=await matchOrderBinding(env,session.phone,task);
 let row;
 try{row=await env.HHBA_PNVS_AUTH_DB.prepare("SELECT id FROM hhba_match_orders WHERE id=? AND phone=? AND amount_fen=? AND status='paid' AND provider_trade_no IS NOT NULL AND task_binding=? AND task_closed_at IS NULL").bind(task.id,session.phone,MATCH_PRICE_FEN,binding).first();}catch{throw error('AI_MATCH_PAYMENT_UNAVAILABLE',503);}
 if(!row)throw error('AI_MATCH_PAYMENT_REQUIRED');
}
export async function closePaidMatchBinding(env,session,task){
 if(!matchPaymentRequired(env)||!task?.payment_order_id)return;
 const binding=await matchOrderBinding(env,session.phone,task);
 await env.HHBA_PNVS_AUTH_DB.prepare('UPDATE hhba_match_orders SET task_closed_at=? WHERE id=? AND phone=? AND task_binding=? AND task_closed_at IS NULL').bind(iso(),task.id,session.phone,binding).run();
}
const merchantEnv=env=>({...env,HHBA_ALIPAY_NOTIFY_URL:env.HHBA_MATCH_ALIPAY_NOTIFY_URL});
export async function createOrResumeMatchOrder(env,phone,operation=gatewayRequest){
 if(!matchPaymentConfigured(env))throw error('MATCH_PAYMENT_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 let row=await currentMatchOrder(db,phone);
 if(!row){
  const id=crypto.randomUUID();
  await db.prepare("INSERT OR IGNORE INTO hhba_match_orders(id,phone,amount_fen,status,created_at) VALUES(?,?,?,'pending',?)").bind(id,phone,MATCH_PRICE_FEN,iso()).run();
  row=await currentMatchOrder(db,phone);
 }
 if(!row)throw error('MATCH_PAYMENT_UNAVAILABLE',503);
 if(row.status==='paid'||row.qr_code)return row;
 // Retrying uses the same merchant order ID; uncertainty preserves the order.
 const result=await operation(merchantEnv(env),'alipay.trade.precreate',{out_trade_no:row.id,total_amount:(row.amount_fen/100).toFixed(2),subject:'HHBA 智能岗位匹配',timeout_express:'30m'});
 if(result.out_trade_no!==row.id||typeof result.qr_code!=='string'||!/^https:\/\/qr\.alipay\.com\/[A-Za-z0-9/?=&%_.-]+$/.test(result.qr_code)||result.qr_code.length>2000)throw error('MATCH_PAYMENT_GATEWAY_INVALID',502);
 await db.prepare("UPDATE hhba_match_orders SET qr_code=? WHERE id=? AND status='pending'").bind(result.qr_code,row.id).run();
 return ownedMatchOrder(db,phone,row.id);
}
export async function reconcileMatchOrder(env,row,operation=gatewayRequest){
 if(!matchPaymentConfigured(env))throw error('MATCH_PAYMENT_NOT_ENABLED',503);
 if(row.status!=='pending')return row;
 const db=env.HHBA_PNVS_AUTH_DB,result=verifiedTrade(await operation(merchantEnv(env),'alipay.trade.query',{out_trade_no:row.id}),row,env);
 if(!result)throw error('MATCH_PAYMENT_GATEWAY_INVALID',502);
 const now=iso();
 if(result.status==='paid')await db.prepare("UPDATE hhba_match_orders SET status='paid',provider_trade_no=?,paid_at=?,checked_at=? WHERE id=? AND status='pending'").bind(result.tradeNo,now,now,row.id).run();
 else if(result.status==='closed')await db.prepare("UPDATE hhba_match_orders SET status='closed',checked_at=? WHERE id=? AND status='pending'").bind(now,row.id).run();
 else await db.prepare("UPDATE hhba_match_orders SET checked_at=? WHERE id=? AND status='pending'").bind(now,row.id).run();
 return ownedMatchOrder(db,row.phone,row.id);
}
export async function closeUnpaidMatchOrder(env,row,operation=gatewayRequest){
 const first=await reconcileMatchOrder(env,row,operation);
 if(first.status!=='pending')return first;
 const response=await operation(merchantEnv(env),'alipay.trade.close',{out_trade_no:row.id});
 if(response.out_trade_no&&response.out_trade_no!==row.id)throw error('MATCH_PAYMENT_GATEWAY_INVALID',502);
 return reconcileMatchOrder(env,first,operation);
}
export async function acceptMatchPaymentNotification(env,form,verify=verifyAlipayNotification){
 if(!matchPaymentConfigured(env))return false;
 for(const k of ['sign','sign_type','app_id','seller_id','out_trade_no','total_amount','trade_status','trade_no'])if(form.getAll(k).length!==1)return false;
 if(!await verify(form,env.ALIPAY_PUBLIC_KEY))return false;
 const data=Object.fromEntries(form),db=env.HHBA_PNVS_AUTH_DB;
 if(data.app_id!==env.ALIPAY_APP_ID||!matchOrderId(data.out_trade_no))return false;
 const row=await db.prepare('SELECT '+columns+' FROM hhba_match_orders WHERE id=?').bind(data.out_trade_no).first();
 if(!row||row.amount_fen!==MATCH_PRICE_FEN||!['pending','paid'].includes(row.status))return false;
 const result=verifiedTrade(data,row,env);if(result?.status!=='paid')return false;
 await db.prepare("UPDATE hhba_match_orders SET status='paid',provider_trade_no=?,paid_at=?,checked_at=? WHERE id=? AND status='pending'").bind(result.tradeNo,iso(),iso(),row.id).run();
 const saved=await db.prepare('SELECT status,provider_trade_no FROM hhba_match_orders WHERE id=?').bind(row.id).first();
 return saved?.status==='paid'&&saved.provider_trade_no===result.tradeNo;
}
