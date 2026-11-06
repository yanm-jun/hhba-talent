import {getRealAuthToken,realAuthReady} from './realAuth';

export type ApplyPackage={uses:number;amountFen:number};
export type ApplyConfig={ok:boolean;packages:ApplyPackage[];paymentEnabled:boolean;tasksEnabled:boolean};
export type ApplyWallet={purchased:number;consumed:number;reserved:number;available:number};
export type ApplyOrder={id:string;uses:number;amountFen:number;status:'pending'|'paid'|'closed'|'refunded';createdAt:string;paidAt:string|null;qrCode?:string};
export type ApplyTask={id:string;status:'reserved'|'completed'|'released';createdAt:string;finishedAt:string|null};
export const applyAccountAvailable=realAuthReady&&import.meta.env.BASE_URL!=='/hhba-talent/';
const errors:Record<string,string>={
 SESSION_INVALID:'登录已失效，请重新登录。',
 CANDIDATE_REQUIRED:'只有真实求职者账户可购买或使用。',
 ACCOUNT_DATABASE_NOT_CONNECTED:'次数账户尚未启用，请稍后查看。',
 PAYMENT_NOT_ENABLED:'支付宝商户功能尚未正式开通，暂不收款。',
 INVALID_PACKAGE:'请选择有效的次数套餐。',
 ORDER_RATE_LIMITED:'创建订单过于频繁，请稍后再试。',
 ORIGIN_REQUIRED:'安全校验失败，请刷新后重新操作。',
 PAYMENT_GATEWAY_UNAVAILABLE:'暂时无法创建支付订单，没有扣款。',
 PAYMENT_GATEWAY_INVALID_RESPONSE:'支付通道返回了异常结果，没有扣款。',
 TASK_ENGINE_NOT_ENABLED:'自动网申引擎尚未开放。',
 APPLY_SERVICE_UNAVAILABLE:'次数服务暂不可用，请稍后再试。',
};
async function request<T>(path:string,method='GET',body?:unknown,publicRoute=false):Promise<T>{
 if(!applyAccountAvailable&&!publicRoute)throw new Error('当前预览环境没有真实账户接口。');
 const token=getRealAuthToken();
 if(!publicRoute&&!token)throw new Error('请先登录真实求职者账户。');
 const response=await fetch('/api/apply'+path,{
  method,credentials:'same-origin',cache:'no-store',
  headers:{...(token&&!publicRoute?{Authorization:'Bearer '+token}:{}),
   ...(body!==undefined?{'Content-Type':'application/json'}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>null) as ({ok?:boolean;error?:string})|null;
 if(!response.ok||!data?.ok)throw new Error(errors[data?.error||'']||(response.status===401?'登录状态已失效，请重新登录。':'暂时无法读取，请稍后重试。'));
 return data as T;
}
export const getApplyConfig=()=>request<ApplyConfig>('/config','GET',undefined,true);
export const getApplyWallet=()=>request<{ok:true;wallet:ApplyWallet}>('/wallet').then(x=>x.wallet);
export const getApplyOrders=()=>request<{ok:true;items:ApplyOrder[]}>('/orders').then(x=>x.items);
export const getApplyTasks=()=>request<{ok:true;items:ApplyTask[]}>('/tasks').then(x=>x.items);
export const createApplyOrder=(uses:number)=>request<{ok:true;order:ApplyOrder}>('/orders','POST',{uses}).then(x=>x.order);
export const getApplyOrder=(id:string)=>request<{ok:true;order:ApplyOrder}>('/orders/'+encodeURIComponent(id)).then(x=>x.order);
