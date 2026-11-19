import {getRealAuthToken,realAuthReady} from './realAuth';
import type {ResumeBlock,ResumeSuggestion} from './targetedResumeOptimization';

export type ResumeOptimizationStatus={
 kind:'HHBA_RESUME_OPTIMIZATION_V1';enabled:boolean;configured:boolean;
 per_account_daily_limit:number;global_daily_limit:number;
};
const OPTIMIZATION_ERRORS:Record<string,string>={
  SESSION_INVALID:'当前登录已失效，请重新登录。',
  FORBIDDEN:'当前账户无权使用求职者简历优化。',
  RESUME_OPTIMIZATION_NOT_ENABLED:'简历 AI 润色服务尚未启用。',
  RESUME_OPTIMIZATION_DB_NOT_READY:'平台简历优化额度服务尚未准备好。',
  RESUME_OPTIMIZATION_LIMIT:'今天的简历优化额度已使用完，请明天再试。',
  AI_PROVIDER_NOT_CONFIGURED:'后台尚未配置简历润色 AI 模型。',
  INVALID_OPTIMIZATION_INPUT:'简历证据不完整，请先完成简历解析。',
  AI_OPTIMIZATION_UNAVAILABLE:'AI 润色暂时失败，未修改简历。'
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
export async function requestResumeOptimization(blocks:ResumeBlock[],
 job:{title:string;requirements:string},signal?:AbortSignal):Promise<ResumeSuggestion[]>{
 if(!realAuthReady)throw new ResumeOptimizationError('RESUME_OPTIMIZATION_NOT_ENABLED',503);
 const token=getRealAuthToken();
 if(!token)throw new ResumeOptimizationError('SESSION_INVALID',401);
 let response:Response;
 try{
  response=await fetch(PATH,{method:'POST',cache:'no-store',credentials:'omit',signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({consent_ai:true,blocks,job})});
 }catch{throw new ResumeOptimizationError('NETWORK_ERROR',503);}
 const data=await response.json().catch(()=>({})) as {ok?:boolean;error?:string;suggestions?:ResumeSuggestion[]};
 if(!response.ok)throw new ResumeOptimizationError(data.error||'UNKNOWN_ERROR',response.status);
 if(data.ok!==true||!Array.isArray(data.suggestions))throw new ResumeOptimizationError('INVALID_RESPONSE',502);
 return data.suggestions;
}
