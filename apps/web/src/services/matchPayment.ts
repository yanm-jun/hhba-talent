import {getRealAuthToken} from './realAuth';
export type MatchPaymentOrder={id:string;amountFen:number;status:'pending'|'paid'|'closed'|'refunded';qrCode:string|null;createdAt:string;paidAt:string|null;bound:boolean;closed:boolean};
export type MatchPaymentState={required:boolean;enabled:boolean;amountFen:number;order:MatchPaymentOrder|null};
export async function matchPaymentRequest(action:'status'|'order'|'query'|'close'='status',id?:string,signal?:AbortSignal):Promise<MatchPaymentState>{
 const token=getRealAuthToken();if(!token)throw new Error('请先登录求职者账号。');
 const path=action==='status'?'status':action==='order'?'order':action==='query'?'order/status':'order/close';
 const response=await fetch('/api/match-payment/'+path,{method:action==='status'?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,headers:{Authorization:'Bearer '+token,...(action==='status'?{}:{'Content-Type':'application/json'})},...(action==='status'?{}:{body:JSON.stringify(id?{id}:{})})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true)throw new Error(data?.error==='MATCH_PAYMENT_NOT_ENABLED'?'支付宝支付暂未开通。':'暂时无法确认支付状态，请勿重复付款，可重新查询原订单。');
 return data as MatchPaymentState;
}
