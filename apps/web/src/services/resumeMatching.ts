export type CandidateProfile = {
 education:string|null;education_evidence:string|null;
 experience_years:number|null;experience_evidence:string|null;
 skills:{name:string;evidence:string}[];
 target_roles:string[];
 experiences:{role:string;organization:string|null;period:string|null;evidence:string}[];
 warnings:string[];
};
export type JobMatch={
 id:string;company:string;title:string;title_zh:string|null;location:string;
 official_url:string;platform:string;remote:boolean;reference_score:number;
 matched:string[];not_evidenced:string[];needs_verification:string[];
 requirements_basis:string;
};
export type ResumeMatchResponse={
 status:'COMPLETE';profile:CandidateProfile;matches:JobMatch[];matched_official_jobs:number;
 source:string;scoring:string;privacy:string;disclaimer:string;
};
export type ResumeMatchStatus={
 enabled:boolean;admin_configured:boolean;per_client_daily_limit:number;
 global_daily_limit:number;formats:string[];file_limit_bytes:number;
 no_resume_storage:boolean;
};
const ENDPOINT=(import.meta.env.VITE_HHBA_MATCH_API_ORIGIN||'').trim().replace(/\/$/,'');
function trustedOrigin(){
 try{
  if(!ENDPOINT)return null;
  const u=new URL(ENDPOINT);
  if(u.protocol!=='https:'||u.pathname!=='/'||u.username||u.password||u.port||u.search||u.hash)return null;
  return u.origin;
 }catch{return null}
}
export class ResumeMatchError extends Error{
 constructor(message:string,readonly code:string,readonly status:number){super(message)}
}
const messageForError=(code:string)=>{
 const messages:Record<string,string>={
  ADMIN_AI_NOT_CONFIGURED:'平台 DeepSeek 尚未配置，请稍后再试。',
  ADMIN_HAS_NOT_ENABLED_AI_MATCHING:'AI 简历匹配尚未正式开放。',
  PERSISTENT_USAGE_QUOTA_UNAVAILABLE:'系统额度保护尚未准备好，请稍后再试。',
  FILE_TOO_LARGE:'文件过大，请选择不超过 3 MB 的 PDF 或 DOCX。',
  ONLY_PDF_OR_DOCX:'只接受 PDF 或 DOCX 格式的简历。',
  INVALID_PDF_HEADER:'这不是有效的 PDF 文件。',
  INVALID_DOCX_HEADER:'这不是有效的 DOCX 文件。',
  RESUME_NOT_READABLE:'简历文件无法识别，请尝试其他文件。',
  NO_SELECTABLE_TEXT_OR_OCR_REQUIRED:'当前只支持带文字层的 PDF 或 DOCX，暂不支持扫描图片版简历。',
  DOCUMENT_TEXT_TOO_LONG:'简历正文超过处理限制，请精简后重试。',
  TOO_MANY_PAGES:'请上传 15 页以内的简历。',
  EXPLICIT_AI_SHARING_CONSENT_REQUIRED:'请先确认简历数据将经脱敏处理后由 DeepSeek 分析。',
  AI_TOO_MANY_ACTIVE_REQUESTS:'当前分析人数较多，请稍后再试。',
  AI_DAILY_BUDGET_EXHAUSTED:'平台今天的 AI 分析额度已用完，请明天再试。',
  AI_DAILY_PERSONAL_LIMIT_REACHED:'今天的个人试用额度已用完，请明天再试。',
  OFFICIAL_JOB_INDEX_UNAVAILABLE:'官方招聘数据暂时不可用，请稍后再试。',
  OFFICIAL_JOB_SNAPSHOT_OUTDATED:'岗位数据更新中，请稍后再试。',
  OFFICIAL_JOB_SNAPSHOT_MISMATCH:'岗位数据正在重新同步，请稍后再试。',
  AI_PROVIDER_UNAVAILABLE:'DeepSeek 当前暂时不可用，请稍后再试。',
  AI_PROFILE_VALIDATION_FAILED:'简历内容未能可靠提取，请稍后重试。',
  AI_PROFILE_INCOMPLETE:'AI 分析未完整返回，请稍后再试。',
  ORIGIN_NOT_ALLOWED:'当前网站尚未获得服务授权。',
 };
 return messages[code]||'分析暂时失败，请稍后重试。';
};
export async function matchServiceStatus(signal?:AbortSignal):Promise<ResumeMatchStatus|null>{
 const origin=trustedOrigin();
 if(!origin)return null;
 try{
  const r=await fetch(origin+'/api/v1/match/status',{method:'GET',
   mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal});
  if(!r.ok)return null;
  const status=await r.json() as Partial<ResumeMatchStatus>;
  if(typeof status.enabled!=='boolean'||typeof status.admin_configured!=='boolean'||
      !Number.isInteger(status.file_limit_bytes))return null;
  return status as ResumeMatchStatus;
 }catch{return null}
}
export async function matchResume(file:File,
 options:{consent:boolean;country:string;remoteOnly:boolean;roleHint:string;limit?:number},
 signal?:AbortSignal):Promise<ResumeMatchResponse>{
 const origin=trustedOrigin();
 if(!origin)throw new ResumeMatchError('简历分析服务尚未连接。','SERVICE_NOT_CONNECTED',503);
 if(!options.consent)throw new ResumeMatchError('请先同意第三方 AI 数据处理说明。','CONSENT_REQUIRED',400);
 if(file.size<1||file.size>3*1024*1024||!/\.(pdf|docx)$/i.test(file.name))
  throw new ResumeMatchError('仅支持 3MB 以内的 PDF 或 DOCX 简历。','INVALID_RESUME',400);
 const form=new FormData();
 form.append('file',file);
 form.append('consent','true');
 form.append('country',options.country);
 form.append('remote_only',String(options.remoteOnly));
 form.append('role_hint',options.roleHint.slice(0,80));
 form.append('limit',String(Math.max(1,Math.min(15,options.limit||10))));
 let r:Response;
 try{
  r=await fetch(origin+'/api/v1/match/resume',{
   method:'POST',mode:'cors',credentials:'omit',cache:'no-store',body:form,signal,
  });
 }catch{
  throw new ResumeMatchError('网络连接失败，请稍后重试。','NETWORK_UNAVAILABLE',503);
 }
 const response=await r.json().catch(()=>({})) as Partial<ResumeMatchResponse>&{error?:string};
 if(!r.ok){
  const code=String(response.error||'UNKNOWN_ERROR');
  throw new ResumeMatchError(messageForError(code),code,r.status);
 }
 if(response.status!=='COMPLETE'||!Array.isArray(response.matches)||
    !response.profile||!Array.isArray(response.profile.skills))
  throw new ResumeMatchError('返回结果不完整，请稍后重试。','RESPONSE_INCOMPLETE',502);
 return response as ResumeMatchResponse;
}
