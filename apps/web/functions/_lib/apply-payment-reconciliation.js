// Alipay reconciliations require a signed gateway response as well as a
// verified order/merchant/amount match. No browser-originated state can mint uses.
import {alipayCredentialsConfigured,gatewayRequest,amountFen} from './apply-billing.js';
const tradeStatuses=new Set(['WAIT_BUYER_PAY','TRADE_SUCCESS','TRADE_FINISHED','TRADE_CLOSED']);
const tradeNo=/^[A-Za-z0-9_-]{4,90}$/;
const clock=()=>new Date().toISOString();
export function verifiedTrade(data,order,env){
 if(!data||!tradeStatuses.has(data.trade_status)||data.out_trade_no!==order.id||
  data.seller_id!==env.ALIPAY_SELLER_ID||amountFen(String(data.total_amount||''))!==order.amount_fen)return null;
 if(['TRADE_SUCCESS','TRADE_FINISHED'].includes(data.trade_status)){
  if(!tradeNo.test(data.trade_no||''))return null;
  if(order.provider_trade_no&&order.provider_trade_no!==data.trade_no)return null;
  return {status:'paid',tradeNo:data.trade_no};
 }
 if(data.trade_no&&!tradeNo.test(data.trade_no))return null;
 if(order.provider_trade_no&&data.trade_no&&order.provider_trade_no!==data.trade_no)return null;
 return {status:data.trade_status==='TRADE_CLOSED'?'closed':'pending',tradeNo:data.trade_no||null};
}
export async function reconcileOrder(db,env,order,operation=gatewayRequest){
 if(!alipayCredentialsConfigured(env))return {ok:false,error:'PAYMENT_NOT_CONFIGURED'};
 if(order.status!=='pending')return {ok:true,status:order.status,changed:false};
 const data=await operation(env,'alipay.trade.query',{out_trade_no:order.id});
 const result=verifiedTrade(data,order,env);
 if(!result)return {ok:false,error:'PAYMENT_QUERY_MISMATCH'};
 const now=clock();
 let update=null;
 if(result.status==='paid'){
  update=await db.prepare("UPDATE hhba_apply_orders SET status='paid',provider_trade_no=?,paid_at=?,checked_at=? WHERE id=? AND status='pending'").bind(result.tradeNo,now,now,order.id).run();
 }else if(result.status==='closed'){
  update=await db.prepare("UPDATE hhba_apply_orders SET status='closed',checked_at=? WHERE id=? AND status='pending'").bind(now,order.id).run();
 }else{
  update=await db.prepare("UPDATE hhba_apply_orders SET checked_at=? WHERE id=? AND status='pending'").bind(now,order.id).run();
 }
 return {ok:true,status:result.status,changed:update?.meta?.changes===1};
}
export async function closeUnpaidOrder(db,env,order,operation=gatewayRequest){
 if(order.status!=='pending')return {ok:false,error:'ORDER_NOT_PENDING'};
 const first=await reconcileOrder(db,env,order,operation);
 if(!first.ok)return first;
 if(first.status!=='pending')return {ok:false,error:first.status==='paid'?'ORDER_ALREADY_PAID':'ORDER_ALREADY_CLOSED'};
 // Do not close if the provider cannot confirm the order's existence and unpaid state.
 const closed=await operation(env,'alipay.trade.close',{out_trade_no:order.id});
 if(closed.out_trade_no&&closed.out_trade_no!==order.id)return {ok:false,error:'PAYMENT_CLOSE_MISMATCH'};
 // A close acknowledgement alone is not confirmation: query the gateway again.
 return reconcileOrder(db,env,order,operation);
}
