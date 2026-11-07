// HHBA same-origin Cloudflare AI matching. No provider key in the browser.
import {getRealAuthToken,realAuthReady} from './realAuth';
import {extractDocxText} from './docxProfile.mjs';
import {extractPdfText} from './pdfProfile.mjs';

export type MatchProfile = {
  education:string|null;education_evidence:string|null;
  experience_years:number|null;experience_evidence:string|null;
  skills:{name:string;evidence:string}[];target_roles:string[];warnings:string[];
};
export type MatchedJob = {
  id:string;company:string;title:string;title_zh?:string|null;location:string;
  official_url:string;platform:string;source:string;remote:boolean;
  reference_score:number;matched:string[];not_evidenced:string[];
  needs_verification:string[];requirements_basis:string;
  source_type?:'HHBA站内岗位';
};
export type MatchResponse = {
  status:'COMPLETE';profile:MatchProfile;matches:MatchedJob[];
  matched_official_jobs:number;source:string;scoring:string;privacy:string;disclaimer:string;
};
export type MatchOptions = {country:string;remote_only:boolean;role_hint:string;limit:number};
const API='/api/match';
const LIMIT=3*1024*1024;
const errorMap:Record<string,string>={
  MATCH_NOT_ENABLED:'智能匹配服务尚未开放，请稍后再试。',
  MATCH_DATABASE_NOT_READY:'智能匹配额度保护尚未配置，已停止分析以防产生费用。',
  SESSION_INVALID:'请登录 HHBA 求职账户后重试。',
  FORBIDDEN:'当前账户无权使用求职者匹配服务。',
  ORIGIN_REQUIRED:'请求来源不符合安全要求，请从 HHBA 网站进入。',
  RESUME_NOT_FOUND:'这份简历不在当前账户，请重新选择。',
  EXPLICIT_AI_SHARING_CONSENT_REQUIRED:'请先确认本次第三方 AI 分析授权。',
  INVALID_RESUME_TEXT:'简历中没有足够可复制的文字，请使用文字版 PDF 或 DOCX。',
  OFFICIAL_JOB_INDEX_UNAVAILABLE:'岗位官方审核数据暂时不可用，请稍后再试。',
  AI_PROVIDER_UNAVAILABLE:'AI 分析服务暂时不可用，请稍后重试。',
  AI_PROFILE_INCOMPLETE:'AI 未能可靠识别简历内容，请完善简历后重试。',
  MATCH_PERSONAL_LIMIT:'今天的个人免费体验次数已达上限。',
  MATCH_GLOBAL_LIMIT:'平台今天的 AI 体验额度已用完。',
  BAD_RESPONSE:'匹配结果格式不完整，请稍后重试。'
};
export class MatchError extends Error {
 constructor(public readonly status:number,message:string){super(message);this.name='MatchError'}
}
function session(){
 if(!realAuthReady)throw new MatchError(401,'请在 HHBA 正式站登录求职账户。');
 const token=getRealAuthToken();
 if(!token)throw new MatchError(401,'请先登录求职者账号，再使用 AI 匹配。');
 return token;
}
export async function matchServiceReady(signal?:AbortSignal):Promise<boolean>{
 if(!realAuthReady)return false;
 try{
  const response=await fetch(API+'/status',{method:'GET',credentials:'same-origin',cache:'no-store',signal});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('json'))return false;
  const data=await response.json() as {kind?:string;enabled?:boolean};
  return data.kind==='HHBA_RESUME_MATCH_CLOUDFLARE_V1'&&data.enabled===true;
 }catch{return false}
}
/** Best-effort browser redaction before submitting text to HHBA's server. */
export function redactResumeTextLocally(text:string):string{
 return text
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[邮箱已隐藏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[手机号已隐藏]')
  .replace(/(?<![0-9A-Za-z])\d{17}[0-9Xx](?![0-9A-Za-z])/g,'[身份证号已隐藏]')
  .replace(/\bhttps?:\/\/[^\s<>]{3,200}/gi,'[个人网址已隐藏]')
  .replace(/(?:微信号|微信|QQ号|QQ)\s*[:：]\s*[A-Za-z0-9_-]{5,32}/gi,'[即时通讯账号已隐藏]')
  .trim().slice(0,20000);
}
export async function extractResumeTextLocally(file:File,signal?:AbortSignal):Promise<string>{
 if(!/\.(pdf|docx)$/i.test(file.name)||file.size<30||file.size>LIMIT)
  throw new MatchError(413,'请选择 3 MB 以内的 PDF 或 DOCX 简历。');
 try{
  const buffer=await file.arrayBuffer();
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const value=/\.pdf$/i.test(file.name)?
   (await extractPdfText(buffer,{signal})).text:
   await extractDocxText(buffer);
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const text=redactResumeTextLocally(value);
  if(text.replace(/\s/g,'').length<30)throw new MatchError(400,errorMap.INVALID_RESUME_TEXT);
  return text;
 }catch(e){
  if((e as Error)?.name==='AbortError'||e instanceof MatchError)throw e;
  throw new MatchError(400,(e as Error)?.message||errorMap.INVALID_RESUME_TEXT);
 }
}
export async function submitExtractedResumeText(
 text:string,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const token=session();
 const cleaned=redactResumeTextLocally(text);
 if(cleaned.replace(/\s/g,'').length<30)throw new MatchError(400,errorMap.INVALID_RESUME_TEXT);
 const response=await fetch(API+'/resume',{
  method:'POST',credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
  body:JSON.stringify({resume_id:resumeId||null,text:cleaned,consent:true,
   options:{country:opts.country,remote_only:opts.remote_only,
    role_hint:opts.role_hint,limit:Math.min(10,Math.max(1,opts.limit||10))}})
 }).catch(e=>{if((e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'暂时无法连接 HHBA 智能匹配服务。');});
 const data=await response.json().catch(()=>({})) as Partial<MatchResponse>&{error?:string};
 if(!response.ok)throw new MatchError(response.status,errorMap[data.error||'']||'智能匹配服务暂时不可用。');
 if(data.status!=='COMPLETE'||!data.profile||!Array.isArray(data.matches)||data.matches.length>10)
  throw new MatchError(502,errorMap.BAD_RESPONSE);
 return data as MatchResponse;
}

export async function submitResumeForMatching(
 file:File,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const extracted=await extractResumeTextLocally(file,signal);
 return submitExtractedResumeText(extracted,opts,consent,signal,resumeId);
}
