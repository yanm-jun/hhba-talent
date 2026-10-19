export type MatchProfile = {
  education: string | null;
  education_evidence: string | null;
  experience_years: number | null;
  experience_evidence: string | null;
  skills: {name:string;evidence:string}[];
  target_roles: string[];
  warnings: string[];
};
export type MatchedJob = {
 id:string;company:string;title:string;title_zh?:string|null;
 location:string;official_url:string;platform:string;source:string;
 remote:boolean;reference_score:number;
 matched:string[];not_evidenced:string[];needs_verification:string[];
 requirements_basis:string;
};
export type MatchResponse = {
 status:'COMPLETE';profile:MatchProfile;matches:MatchedJob[];
 matched_official_jobs:number;source:string;scoring:string;privacy:string;disclaimer:string;
};
export type MatchOptions = {
 country:string;remote_only:boolean;role_hint:string;limit:number;
};

const configured = String(import.meta.env.VITE_HHBA_RESUME_MATCH_API || '').replace(/\/+$/,'');
function apiOrigin(){
 if(!configured)return null;
 try{
  const u=new URL(configured);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)
   return null;
  if(u.hostname.endsWith('.up.railway.app') && /^hhba-[a-z0-9-]+$/.test(u.hostname.split('.')[0]))return u.origin;
  return null;
 }catch{return null}
}
export const MATCH_API_ORIGIN=apiOrigin();

const messages:Record<string,string>={
 ADMIN_AI_NOT_CONFIGURED:'平台管理员尚未启用 DeepSeek 智能分析，当前不能调用 AI。',
 ADMIN_HAS_NOT_ENABLED_AI_MATCHING:'平台管理员尚未开放 AI 简历匹配，请稍后再试。',
 PERSISTENT_USAGE_QUOTA_UNAVAILABLE:'平台 AI 用量保护未就绪，已暂停调用以防超额收费。',
 AI_PROFILE_INCOMPLETE:'DeepSeek 返回不完整的能力信息，请稍后再试。',
 EXPLICIT_AI_SHARING_CONSENT_REQUIRED:'需要先同意将脱敏文本交给 DeepSeek 处理。',
 ONLY_PDF_OR_DOCX:'只支持 PDF 或 DOCX 格式简历。',
 INVALID_PDF_HEADER:'所选文件不是有效的 PDF。',
 INVALID_DOCX_HEADER:'所选文件不是有效的 DOCX。',
 INVALID_FILE_TYPE:'文件格式或类型不正确，请另选 PDF/DOCX。',
 FILE_TOO_LARGE:'简历文件过大，当前 AI 匹配上传上限为 3 MB。',
 TOO_MANY_PAGES:'PDF 超过 15 页，请精简后重试。',
 DOCUMENT_TEXT_TOO_LONG:'简历文本超过单次解析上限，请精简后重试。',
 RESUME_NOT_READABLE:'简历未能读取，请检查文件是否损坏。',
 NO_SELECTABLE_TEXT_OR_OCR_REQUIRED:'这份 PDF 可能是扫描图片，请先转换为可复制文字的 PDF。',
 AI_TOO_MANY_ACTIVE_REQUESTS:'当前智能分析请求较多，请稍后再试。',
 AI_DAILY_BUDGET_EXHAUSTED:'平台今日 AI 分析额度已使用完，请明天再试。',
 AI_DAILY_PERSONAL_LIMIT_REACHED:'你今天的 AI 匹配体验次数已达上限。',
 AI_PROVIDER_UNAVAILABLE:'DeepSeek 服务暂时不可用，请稍后再试。',
 AI_PROFILE_VALIDATION_FAILED:'AI 返回的信息未通过校验，请稍后重试。',
 OFFICIAL_JOB_INDEX_UNAVAILABLE:'招聘岗位索引暂时不可用，请稍后再试。',
 OFFICIAL_JOB_SNAPSHOT_MISMATCH:'官方岗位与岗位要求版本暂未同步，请稍后再试。',
 OFFICIAL_JOB_SNAPSHOT_OUTDATED:'岗位核验数据已过期，等待更新后再匹配。',
 ORIGIN_NOT_ALLOWED:'当前页面来源不被允许，请从 HHBA 官方网页访问。',
};
export class MatchError extends Error {
 constructor(public readonly status:number,message:string){super(message);this.name='MatchError'}
}
export async function matchServiceReady(signal?:AbortSignal):Promise<boolean>{
 if(!MATCH_API_ORIGIN)return false;
 try{
  const r=await fetch(MATCH_API_ORIGIN+'/health',{method:'GET',credentials:'omit',redirect:'error',signal,
   cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)return false;
  const body=await r.json();
  return body.ok===true && body.service==='hhba-private-resume-match' &&
   body.admin_deepseek_configured===true && body.public_enabled===true && body.quota_storage_ready===true;
 }catch{return false}
}
export async function submitResumeForMatching(file:File, opts:MatchOptions, consent:boolean, signal?:AbortSignal):Promise<MatchResponse>{
 if(!MATCH_API_ORIGIN)throw new MatchError(503,messages.ADMIN_AI_NOT_CONFIGURED);
 if(!consent)throw new MatchError(400,messages.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 if(file.size===0||file.size>3*1024*1024||!/\.(pdf|docx)$/i.test(file.name))
  throw new MatchError(413,messages.FILE_TOO_LARGE);
 const form=new FormData();
 form.append('file',file,file.name);
 form.append('consent','true');
 form.append('country',opts.country||'');
 form.append('remote_only',String(opts.remote_only));
 form.append('role_hint',opts.role_hint.slice(0,80));
 form.append('limit',String(Math.max(1,Math.min(15,opts.limit))));
 let r:Response;
 try{
  r=await fetch(MATCH_API_ORIGIN+'/api/v1/match/resume',{
   method:'POST',mode:'cors',credentials:'omit',redirect:'error',body:form,signal
  });
 }catch(e){
  if((e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'暂时无法连接 HHBA 智能匹配服务，请稍后再试。');
 }
 let body:unknown;
 try{body=await r.json()}catch{throw new MatchError(r.status,'服务器返回异常，请稍后再试。')}
 if(!r.ok){
  const code=typeof body==='object'&&body&&'error' in body?String((body as {error:string}).error):'';
  throw new MatchError(r.status,messages[code]||'智能匹配暂时不可用，请稍后再试。');
 }
 const data=body as Partial<MatchResponse>;
 if(data.status!=='COMPLETE'||!Array.isArray(data.matches)||
  !data.profile||!Array.isArray(data.profile.skills)||!Array.isArray(data.profile.target_roles)||
  data.matches.length>15)throw new MatchError(502,'智能匹配结果格式异常，请稍后重试。');
 return data as MatchResponse;
}
