import {getRealAuthToken,realAuthReady} from './realAuth';
import type {JdAwareJob} from './jobJdArchive';
import type {ResumeBlock,ResumeSuggestion} from './targetedResumeOptimization';

export type ResumeOptimizationStatus={
 kind:'HHBA_RESUME_OPTIMIZATION_V1';enabled:boolean;configured:boolean;
 per_account_daily_limit:number;global_daily_limit:number;
 per_account_daily_attempt_limit?:number;global_daily_attempt_limit?:number;
 full_document_enabled?:boolean;
};
const OPTIMIZATION_ERRORS:Record<string,string>={
  SESSION_INVALID:'当前登录已失效，请重新登录。',
  FORBIDDEN:'当前账户无权使用求职者简历优化。',
  RESUME_OPTIMIZATION_NOT_ENABLED:'简历 AI 润色服务尚未启用。',
  RESUME_OPTIMIZATION_DB_NOT_READY:'平台简历优化额度服务尚未准备好。',
  RESUME_OPTIMIZATION_LIMIT:'今天成功生成简历建议的次数已达上限。',
  RESUME_OPTIMIZATION_ATTEMPT_LIMIT:'今天的 AI 润色尝试次数已达安全上限，请明天再试。',
  RESUME_OPTIMIZATION_TASK_DB_NOT_READY:'整份简历优化任务暂未就绪，请稍后重试。',
  RESUME_OPTIMIZATION_IN_PROGRESS:'这份简历已在处理同一岗位，可以回到已开始优化的窗口。',
  RESUME_OPTIMIZATION_QUEUED:'当前正在排队处理简历优化，请稍后重试。',
  AI_PROVIDER_NOT_CONFIGURED:'后台尚未配置简历润色 AI 模型。',
  INVALID_OPTIMIZATION_INPUT:'简历证据不完整，请先完成简历解析。',
  JD_VERIFIED_VERSION_REQUIRED:'当前岗位尚未取得核验过的完整 JD，不能进行严格定向优化。',
  JD_VERSION_NOT_AVAILABLE:'岗位 JD 档案读取失败，请重新获取该岗位的官方 JD。',
  JD_VERSION_STALE:'岗位 JD 需要重新核验，未按过期资料改写简历。',
  JD_JOB_IDENTITY_MISMATCH:'岗位和 JD 版本不一致，已阻止错误的改写。',

  AI_OPTIMIZATION_UNAVAILABLE:'AI 润色暂时失败，未修改简历。',
  AI_PROVIDER_KEY_REJECTED:'AI 服务密钥未通过平台验证，请管理员核对 Preview 配置。',
  AI_PROVIDER_BALANCE_INSUFFICIENT:'AI 服务账户余额不足，尚未取得润色建议。',
  AI_PROVIDER_RATE_LIMITED:'AI 服务当前触发限速，请稍后再试。',
  AI_PROVIDER_REQUEST_REJECTED:'AI 模型拒绝了请求格式，请管理员检查接口兼容性。',
  AI_PROVIDER_UPSTREAM_ERROR:'AI 模型服务器暂时异常，未修改简历。',
  AI_PROVIDER_UNEXPECTED_REDIRECT:'AI 模型返回了不安全的跳转地址，已阻止请求。',
  AI_PROVIDER_NETWORK_ERROR:'服务器暂时无法连接 AI 模型，未修改简历。',
  AI_PROVIDER_TIMEOUT:'AI 润色等待超时，未修改简历。',
  AI_PROVIDER_RESPONSE_INVALID:'AI 返回内容格式不符合要求，未修改简历。',
  AI_PROVIDER_RESPONSE_HTTP_INVALID:'AI 服务返回非标准数据，未修改简历。',
  AI_PROVIDER_RESPONSE_TRUNCATED:'AI 建议生成被截断，请缩短简历段落后重试。',
  AI_PROVIDER_RESPONSE_EMPTY:'AI 没有生成可用文字，请稍后重试。',
  AI_PROVIDER_RESPONSE_JSON_INVALID:'AI 返回的 JSON 不完整，请稍后重试。',
  AI_PROVIDER_SUGGESTION_SCHEMA_INVALID:'AI 的建议格式不符合安全要求，请稍后重试。'
};
export class ResumeOptimizationError extends Error{
 constructor(readonly code:string,readonly status:number){super(OPTIMIZATION_ERRORS[code]||'简历润色请求失败，请稍后再试。')}
}
const PATH='/api/resume-optimize';
export async function getResumeOptimizationStatus(signal?:AbortSignal):Promise<ResumeOptimizationStatus|null>{
 if(!realAuthReady)return null;
 try{
  const response=await fetch(PATH,{method:'GET',cache:'no-store',credentials:'omit',signal});
  if(!response.ok)return null;
  const value=await response.json() as Partial<ResumeOptimizationStatus>;
  return value.kind==='HHBA_RESUME_OPTIMIZATION_V1'&&typeof value.enabled==='boolean'
   ?value as ResumeOptimizationStatus:null;
 }catch{return null;}
}
type DocumentOptimization={
 text:string;wanted?:string[];onPending?:(ids:string[])=>void;onQueued?:()=>void;
};
function waitForOptimizationSlot(signal?:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const cancel=()=>{clearTimeout(timer);reject(signal?.reason);};
  const timer=setTimeout(()=>{
   signal?.removeEventListener('abort',cancel);resolve();
  },2500);
  signal?.addEventListener('abort',cancel,{once:true});
 });
}
export async function requestResumeOptimization(blocks:ResumeBlock[],
 job:JdAwareJob,signal?:AbortSignal,document?:DocumentOptimization):Promise<ResumeSuggestion[]>{
 if(!realAuthReady)throw new ResumeOptimizationError('RESUME_OPTIMIZATION_NOT_ENABLED',503);
 const token=getRealAuthToken();
 if(!token)throw new ResumeOptimizationError('SESSION_INVALID',401);
 const suggestions=new Map<string,ResumeSuggestion>();
 let wanted=document?.wanted;
 const ids=new Set(blocks.map(block=>block.id));
 let queueStarted=0;
 for(;;){
  let response:Response;
  try{
   response=await fetch(PATH,{method:'POST',cache:'no-store',credentials:'omit',signal,
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({consent_ai:true,blocks,job,
     ...(document?{full_document:{text:document.text,wanted}}:{})})});
  }catch{throw new ResumeOptimizationError('NETWORK_ERROR',503);}
  const data=await response.json().catch(()=>({})) as {
   ok?:boolean;error?:string;suggestions?:ResumeSuggestion[];pending_block_ids?:string[]
  };
  if(document&&data.error==='RESUME_OPTIMIZATION_QUEUED'){
   queueStarted ||= Date.now();
   if(Date.now()-queueStarted<240000){
    document.onQueued?.();
    await waitForOptimizationSlot(signal);
    continue;
   }
  }else queueStarted=0;
  if(!response.ok||data.ok!==true||!Array.isArray(data.suggestions)){
   if(wanted&&suggestions.size){document?.onPending?.(wanted);break;}
   throw new ResumeOptimizationError(data.error||'INVALID_RESPONSE',response.status);
  }
  for(const item of data.suggestions)suggestions.set(item.blockId,item);
  const pending=Array.isArray(data.pending_block_ids)?
   [...new Set(data.pending_block_ids.filter(id=>ids.has(id)&&(!wanted||wanted.includes(id))))]:[];
  if(!document||!pending.length){document?.onPending?.([]);break;}
  if(pending.length>=(wanted?.length??blocks.length)){
   document.onPending?.(pending);break;
  }
  wanted=pending;
 }
 return [...suggestions.values()];
}
