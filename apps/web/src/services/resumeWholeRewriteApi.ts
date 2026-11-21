import {getRealAuthToken,realAuthReady} from './realAuth';
import type {ResumeBlock} from './targetedResumeOptimization';

export type ResumeWholeRewriteBlock={
 blockId:string;section:ResumeBlock['section'];original:string;proposed:string;
 changed:boolean;evidenceQuotes:string[];rationale:string;jobRequirements:string[];
 status:'needs_user_confirmation'|'kept_original';
};
export type ResumeWholeRewriteResult={
 kind:'HHBA_WHOLE_RESUME_REWRITE_V1';ok:true;
 provider:string;reviewer:string;blocks:ResumeWholeRewriteBlock[];
 recommended_order?:string[];
 autonomy?:{enabled:boolean;rounds:number;stop_reason:string;needs_more_work:boolean;
  tools_used:Array<{action:string;sections:string[];accepted:number}>;
  inspected_ids?:string[];previous_signature?:string;
 };
 continuation?:{enabled:boolean;checkpoint?:string};
 questions:{blockId:string;question:string;reason:string;status:'user_input_needed'}[];
 warnings:{blockId:string;code:string;note:string}[];
 coverage:{source_blocks:number;analyzed_blocks:number;proposed_rewrites:number;held_for_review:number};
 disclaimer:string;
};
export type ResumeWholeRewriteStatus={
 kind:'HHBA_WHOLE_RESUME_REWRITE_V1';ok:true;
 enabled:boolean;configured:boolean;mode:string;autonomy_enabled?:boolean;
 continuation_enabled?:boolean;
 requires_user_approval:boolean;
};
const errorMessage:Record<string,string>={
 INVALID_REWRITE_INPUT:'简历或岗位资料不完整。为避免遗漏，我们没有生成不完整的改写稿。',
 AI_CONSENT_REQUIRED:'请先同意将简历证据发送至所选 AI 服务。',
 SESSION_INVALID:'登录已失效，请重新登录。',
 FORBIDDEN:'当前账号无权使用简历重写。',
 RESUME_REWRITE_NOT_ENABLED:'整份简历 AI 撰写服务还没有在当前环境开启。',
 AI_PROVIDER_NOT_CONFIGURED:'平台尚未配置完整简历撰写模型。',
 AI_PROVIDER_KEY_REJECTED:'AI 模型密钥验证失败，请检查平台配置。',
 AI_PROVIDER_BALANCE_INSUFFICIENT:'模型账户余额不足。',
 AI_PROVIDER_RATE_LIMITED:'模型当前请求过多，请稍后重试。',
 AI_PROVIDER_TIMEOUT:'整份简历分析超时，原始 Word 未改变。',
 AI_PROVIDER_RESPONSE_TRUNCATED:'模型输出不完整，没有保存不完整版本。',
 AI_PROVIDER_RESPONSE_JSON_INVALID:'模型返回内容格式错误，原始 Word 未改变。',
 AI_RESUME_REWRITE_FAILED:'完整简历撰写暂时无法完成，原始 Word 未改变。',
 AI_CHECKPOINT_EXPIRED:'此轮 AI 继续编辑的授权已过期，已保留当前草稿。',
 AI_CHECKPOINT_INVALID:'AI 续写状态校验失败，未执行新的模型调用。',
 AI_CHECKPOINT_NOT_CONFIGURED:'平台尚未启用安全的跨请求 AI 续写。',
 AI_AGENT_CONTINUATION_FAILED:'后续 AI 编辑没能完成，已保留上一份核实过的草稿。'
};
export class WholeRewriteError extends Error{
 constructor(public readonly code:string,public readonly status:number){
  super(errorMessage[code]||'整份简历重写失败，原始文件没有修改。');
 }
}
const PATH='/api/resume-rewrite';
export async function getWholeRewriteStatus(signal?:AbortSignal):Promise<ResumeWholeRewriteStatus|null>{
 if(!realAuthReady)return null;
 try{
  const r=await fetch(PATH,{method:'GET',credentials:'omit',cache:'no-store',signal});
  if(!r.ok)return null;
  const value=await r.json() as Partial<ResumeWholeRewriteStatus>;
  return value.kind==='HHBA_WHOLE_RESUME_REWRITE_V1'&&typeof value.enabled==='boolean'
   ?value as ResumeWholeRewriteStatus:null;
 }catch{return null;}
}
export async function requestWholeResumeRewrite(blocks:ResumeBlock[],
 job:{title:string;requirements:string},signal?:AbortSignal):Promise<ResumeWholeRewriteResult>{
 if(!realAuthReady)throw new WholeRewriteError('RESUME_REWRITE_NOT_ENABLED',503);
 const token=getRealAuthToken();
 if(!token)throw new WholeRewriteError('SESSION_INVALID',401);
 let response:Response;
 try{
  response=await fetch(PATH,{method:'POST',credentials:'omit',cache:'no-store',signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({consent_ai:true,blocks,job})});
 }catch(e){
  if((e as Error)?.name==='AbortError')throw e;
  throw new WholeRewriteError('NETWORK_ERROR',503);
 }
 const data=await response.json().catch(()=>({})) as Partial<ResumeWholeRewriteResult>&{error?:string};
 if(!response.ok)throw new WholeRewriteError(String(data.error||'UNKNOWN_ERROR'),response.status);
 if(!data.ok||data.kind!=='HHBA_WHOLE_RESUME_REWRITE_V1'||
  !Array.isArray(data.blocks)||!Array.isArray(data.questions)||
  data.coverage?.analyzed_blocks!==blocks.length)
  throw new WholeRewriteError('INVALID_RESPONSE',502);
 return data as ResumeWholeRewriteResult;
}

/** The model selects one tool per call; keep state only in the in-memory draft.
 * Signed checkpoint prevents a modified draft from inheriting verification. */
export async function continueWholeResumeRewrite(
 blocks:ResumeBlock[],job:{title:string;requirements:string},
 draft:ResumeWholeRewriteResult,signal?:AbortSignal
):Promise<ResumeWholeRewriteResult>{
 const checkpoint=draft.continuation?.checkpoint;
 if(!checkpoint||!draft.continuation?.enabled)
  throw new WholeRewriteError('AI_CHECKPOINT_INVALID',409);
 if(!realAuthReady)throw new WholeRewriteError('SESSION_INVALID',401);
 const token=getRealAuthToken();
 if(!token)throw new WholeRewriteError('SESSION_INVALID',401);
 let response:Response;
 try{
  response=await fetch('/api/resume-rewrite-step',{
   method:'POST',credentials:'omit',cache:'no-store',signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({consent_ai:true,blocks,job,draft,checkpoint})
  });
 }catch(e){
  if((e as Error)?.name==='AbortError')throw e;
  throw new WholeRewriteError('NETWORK_ERROR',503);
 }
 const data=await response.json().catch(()=>({})) as Partial<ResumeWholeRewriteResult>&{error?:string};
 if(!response.ok)throw new WholeRewriteError(String(data.error||'UNKNOWN_ERROR'),response.status);
 if(data.ok!==true||data.kind!=='HHBA_WHOLE_RESUME_REWRITE_V1'||
  !Array.isArray(data.blocks)||data.blocks.length!==blocks.length||
  data.coverage?.analyzed_blocks!==blocks.length||!data.autonomy)
  throw new WholeRewriteError('INVALID_RESPONSE',502);
 return data as ResumeWholeRewriteResult;
}
