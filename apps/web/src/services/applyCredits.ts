import {getRealAuthToken,realAuthReady} from './realAuth';

export type ApplyPackage={uses:number;amountFen:number};
export type ApplyConfig={ok:boolean;packages:ApplyPackage[];paymentEnabled:boolean;tasksEnabled:boolean;pairingEnabled:boolean;profileSyncEnabled?:boolean};
export type ApplyWallet={purchased:number;consumed:number;reserved:number;available:number};
export type ApplyOrder={id:string;uses:number;amountFen:number;status:'pending'|'paid'|'closed'|'refunded';createdAt:string;paidAt:string|null;qrCode?:string};
export type ApplyTask={id:string;status:'reserved'|'completed'|'released';createdAt:string;finishedAt:string|null};
export type ApplyRefundRequest={orderId:string;reason:string;status:'requested'|'reviewing'|'rejected'|'completed';createdAt:string};
export const applyAccountAvailable=realAuthReady&&import.meta.env.BASE_URL!=='/hhba-talent/';
const errors:Record<string,string>={
 SESSION_INVALID:'登录已失效，请重新登录。',
 CANDIDATE_REQUIRED:'只有真实求职者账户可购买或使用。',
 ACCOUNT_DATABASE_NOT_CONNECTED:'次数账户尚未启用，请稍后查看。',
 PAYMENT_NOT_ENABLED:'支付宝商户功能尚未正式开通，暂不收款。',
 INVALID_PACKAGE:'请选择有效的次数套餐。',
 ORDER_RATE_LIMITED:'创建订单过于频繁，请稍后再试。',
 ORIGIN_REQUIRED:'安全校验失败，请刷新后重新操作。',
 PAYMENT_GATEWAY_UNAVAILABLE:'支付网关暂不可用，请稍后查看订单。',
 PAYMENT_GATEWAY_UNCERTAIN:'支付创建请求结果不明确。请查看订单，不要重复付款。',
 PAYMENT_QUERY_UNAVAILABLE:'支付宝查单暂时不可用，请稍后重试。',
 PAYMENT_QUERY_MISMATCH:'支付查询数据校验未通过，请联系支持。',
 PAYMENT_CLOSE_UNCONFIRMED:'尚未确认订单关闭，请稍后查询，不要重复付款。',
 ORDER_NOT_PENDING:'订单已付款或关闭，不能取消。',
 ORDER_NOT_PAID:'仅已确认付款订单可申请退款。',
 INVALID_REFUND_REASON:'请填写2到300字的退款原因。',
 PAYMENT_NOT_CONFIGURED:'商户接口尚未开放，请稍后重试。',
 PAYMENT_GATEWAY_INVALID_RESPONSE:'支付通道返回了异常结果，没有扣款。',
 TASK_ENGINE_NOT_ENABLED:'自动网申引擎尚未开放。',
 PAIRING_NOT_ENABLED:'浏览器插件连接功能尚未开放。',
 PAIR_RATE_LIMITED:'连接码生成过于频繁，请稍后重试。',
 PAIR_SERVICE_UNAVAILABLE:'插件连接服务暂不可用。',
 PAIRING_REQUIRED:'请先在本页面完成浏览器插件连接，再生成同步任务。',
 PROFILE_TRANSFER_NOT_CONFIGURED:'安全同步服务尚未启用，未传输任何简历内容。',
 PROFILE_TRANSFER_NOT_READY:'尚未准备同步任务，或任务已被领取、取消或过期。',
 PROFILE_TRANSFER_UNAVAILABLE:'简历同步服务暂时不可用，请稍后再试。',
 PROFILE_TRANSFER_CORRUPT:'简历同步安全校验未通过，未导入任何信息。',
 INVALID_PROFILE_SYNC_REQUEST:'请检查并确认简历资料内容和本次同步授权。',
 RESUME_NOT_FOUND:'该简历不属于当前账号或已被删除。',

 INVALID_APPLICATION:'企业、岗位、链接或投递状态不正确。',
 INVALID_APPLICATION_ID:'投递记录编号不正确。',
 APPLICATION_LIMIT:'最多保存200条投递记录，请先整理已有记录。',
 APPLICATIONS_UNAVAILABLE:'投递记录暂不可用，请稍后重试。',
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
export const queryApplyOrderStatus=(id:string)=>request<{ok:true;order:ApplyOrder}>('/orders/'+encodeURIComponent(id)+'/status').then(x=>x.order);
export const closeApplyOrder=(id:string)=>request<{ok:true;order:ApplyOrder}>('/orders/'+encodeURIComponent(id)+'/close','POST').then(x=>x.order);
export const listApplyRefundRequests=()=>request<{ok:true;items:ApplyRefundRequest[]}>('/refund-requests').then(x=>x.items);
export const requestApplyRefund=(orderId:string,reason:string)=>request<{ok:true;request:ApplyRefundRequest}>('/orders/'+encodeURIComponent(orderId)+'/refund-request','POST',{reason}).then(x=>x.request);

export type ApplyPairStatus={ok:true;connectedDevices:number};
export type ApplyPairCode={ok:true;code:string;expiresAt:string};
export const getApplyPairStatus=()=>request<ApplyPairStatus>('/pair/status');
export const startApplyPair=()=>request<ApplyPairCode>('/pair/start','POST');
export const revokeApplyPairs=()=>request<ApplyPairStatus>('/pair/revoke','POST');

export const PROFILE_SYNC_CONSENT='extension-structured-profile-sync-v1';
export type ApplyProfileSyncResult={ok:true;expiresAt:string;fieldsWithValue:number};
export const prepareApplyProfileSync=(resumeId:string,profile:Record<string,string>,consent:boolean)=>{
 if(!consent)throw Error('请先主动勾选本次将所确认资料交给已连接插件的授权。');
 return request<ApplyProfileSyncResult>('/profile-transfer/prepare','POST',{
  resumeId,profile,consent:true,consentVersion:PROFILE_SYNC_CONSENT
 });
};
export const revokeApplyProfileSync=()=>request<{ok:true}>('/profile-transfer/revoke','POST');

export type ApplicationRecord={
 id:string;company:string;position:string;applicationUrl:string;
 status:'pending'|'confirmed'|'manual';source:'edge'|'manual';
 evidenceKind:'none'|'success_notice'|'receipt_marker'|'self_report';
 recordedAt:string;updatedAt:string
};
export const listMyApplications=()=>request<{ok:true;items:ApplicationRecord[]}>('/applications')
 .then(x=>x.items);
export const saveManualApplication=(entry:{company:string;position:string;applicationUrl:string;status:'pending'|'manual'})=>
 request<{ok:true;record:ApplicationRecord}>('/applications','POST',{
  ...entry,evidenceKind:entry.status==='manual'?'self_report':'none'
 }).then(x=>x.record);
export const deleteMyApplication=(id:string)=>request<{ok:true;deleted:boolean}>('/applications/delete','POST',{id});
