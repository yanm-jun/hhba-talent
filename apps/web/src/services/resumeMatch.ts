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
  source_type?:'HHBA站内岗位'|'站外官方招聘';
  application_status?:'NEEDS_OFFICIAL_CONFIRMATION';checked_at?:string;
  salary?:string|null;experience_requirement?:string|null;
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
  NO_VERIFIED_DOMESTIC_JOBS:'目前尚无通过最新审核的中国大陆岗位，本次没有调用 AI，也没有扣匹配次数。我们正在补充国内招聘来源。',
  AI_PROVIDER_UNAVAILABLE:'AI 接口出现异常，请稍后再试。',
  AI_PROVIDER_KEY_REJECTED:'AI 服务密钥未通过平台验证，请联系 HHBA 管理员检查配置。',
  AI_PROVIDER_BALANCE_INSUFFICIENT:'AI 平台账户余额不足，请联系 HHBA 管理员充值。',
  AI_PROVIDER_RATE_LIMITED:'AI 平台当前请求较多，请稍后再试。',
  AI_PROVIDER_REQUEST_REJECTED:'AI 服务请求配置有误，HHBA 正在检查接口兼容性。',
  AI_PROVIDER_UPSTREAM_ERROR:'DeepSeek 服务器暂时异常，请稍后再试。',
  AI_PROVIDER_NETWORK_ERROR:'HHBA 暂时无法连接 DeepSeek，请稍后再试。',
  AI_PROVIDER_REDIRECT_BLOCKED:'AI 接口发生异常重定向，为保护密钥，已安全终止请求。',
  AI_PROVIDER_TIMEOUT:'AI 请求超时，请稍后再试。',
  AI_PROVIDER_RESPONSE_INVALID:'AI 服务返回了无法识别的数据，请稍后再试。',
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
   options:{country:'CN',remote_only:false,
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

/** Preview-only free balance/key check, authenticated candidate, no resume content. */
export async function checkMatchProviderConnection(signal?:AbortSignal):Promise<string>{
 const token=session();
 let response;
 try{
  response=await fetch(API+'/provider-check',{
   method:'GET',credentials:'same-origin',cache:'no-store',signal,
   headers:{Authorization:'Bearer '+token}
  });
 }catch(e){
  if((e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'AI 服务连接检测失败，请稍后重试。');
 }
 const data=await response.json().catch(()=>({})) as {ok?:boolean;status?:string;error?:string};
 if(!response.ok)throw new MatchError(response.status,
  errorMap[data.error||'']||'AI 服务检测暂时不可用。');
 if(data.ok!==true||data.status!=='READY')throw new MatchError(502,'AI 服务检测返回异常结果。');
 return 'AI 密钥验证成功、余额可用。没有发送简历，也没有消耗匹配次数。';
}

/** Safe outbound detail URL for a fetched and independently reviewed mainland
 * enterprise posting. The frontend never trusts arbitrary URLs from AI.
 */
export function safeExternalJobApplicationUrl(job:MatchedJob):string|null{
 if(job?.source_type!=='站外官方招聘'||job.application_status!=='NEEDS_OFFICIAL_CONFIRMATION')return null;
 try{
  const u=new URL(job.official_url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.searchParams.size!==1)return null;
  const specs:Record<string,{company:string;path:string;param:string;pattern:RegExp}>={
   'careers.tencent.com':{company:'腾讯',path:'/jobdesc.html',param:'postId',pattern:/^\d{12,22}$/},
   'career.huawei.com':{company:'华为',path:'/cn/job-details',param:'advertisementId',pattern:/^\d{1,12}$/},
   'zhaopin.meituan.com':{company:'美团',path:'/web/position/detail',param:'jobUnionId',pattern:/^\d{8,14}$/}
  };
  if(u.hostname==='jobs.bytedance.com'){
   const id=u.pathname.match(/^\/experienced\/position\/([0-9]{13,22})\/detail$/)?.[1];
   return u.searchParams.size===0&&id&&job.company==='字节跳动'&&
    job.source==='jobs.bytedance.com'&&job.id==='external-jobs-bytedance-com-'+id?
    'https://jobs.bytedance.com/experienced/position/'+id+'/detail':null;
  }
  const expected=specs[u.hostname];
  if(!expected||u.pathname!==expected.path||job.company!==expected.company||
   job.source!==u.hostname||!u.searchParams.has(expected.param))return null;
  const native=u.searchParams.get(expected.param)||'';
  if(!expected.pattern.test(native)||job.id!=='external-'+u.hostname.replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+native)
   return null;
  return 'https://'+u.hostname+expected.path+'?'+expected.param+'='+native;
 }catch{return null;}
}

export type ExternalOfficialCandidate={
 id:string;source_type:'站外官方招聘';source_status:'OFFICIAL_DETAIL_FETCHED';
 application_status:'NEEDS_OFFICIAL_CONFIRMATION';company:string;title:string;
 location:string;official_url:string;official_domain:string;has_application_cta:boolean;
 checked_at:string;evidence:{title:string;location:string;requirement:string;salary?:string|null};
};
export type ExternalSearchResult={
 ok:true;kind:'HHBA_DOMESTIC_DISCOVERY_V1';scope:'CN_MAINLAND_ONLY';
 candidates:ExternalOfficialCandidate[];candidate_count:number;
 usage:{search:number;fetch:number};
 max_search_requests:number;max_fetch_requests:number;disclaimer:string;
};
const externalSearchErrors:Record<string,string>={
 EXTERNAL_SEARCH_NOT_ENABLED:'站外搜索尚未开放，请先使用站内岗位推荐。',
 EXTERNAL_SEARCH_DB_NOT_READY:'站外搜索额度保护尚未就绪。',
 SESSION_INVALID:'登录状态失效，请重新登录。',
 FORBIDDEN:'只有求职者账号可使用站外搜索。',
 ORIGIN_REQUIRED:'不允许跨站触发搜索。',
 SEARCH_CONSENT_REQUIRED:'请主动点击站外搜索按钮后发起请求。',
 INVALID_SEARCH_INTENT:'请先填写具体岗位方向，如“软件开发”或“数据分析”。',
 EXTERNAL_SEARCH_GLOBAL_LIMIT:'今天的站外岗位搜索预算已用完。',
 EXTERNAL_SEARCH_PERSONAL_LIMIT:'今天的站外搜索额度已用完。',
 SEARCH_PROVIDER_KEY_REJECTED:'官方岗位搜索服务密钥验证失败，请联系 HHBA 管理员。',
 SEARCH_PROVIDER_BALANCE_INSUFFICIENT:'搜索服务账户余额不足，请联系 HHBA 管理员。',
 SEARCH_PROVIDER_RATE_LIMIT:'官方岗位搜索请求较多，请稍后重试。',
 SEARCH_PROVIDER_TIMEOUT:'官方岗位搜索超时，请稍后重试。',
 SEARCH_PROVIDER_NETWORK:'暂时无法连接官方岗位搜索服务。',
 SEARCH_PROVIDER_REDIRECT_BLOCKED:'岗位搜索服务发生异常重定向，已安全终止。',
 SEARCH_RESPONSE_INVALID:'官方岗位搜索返回的结果格式不完整。',
 SEARCH_PROVIDER_ERROR:'官方岗位搜索服务暂时出现错误。'
};
export async function externalDomesticSearchReady(signal?:AbortSignal):Promise<boolean>{
 if(!realAuthReady||!getRealAuthToken())return false;
 try{
  const response=await fetch(API+'/discover',{method:'GET',credentials:'same-origin',cache:'no-store',signal});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('json'))return false;
  const data=await response.json() as {kind?:string;scope?:string;enabled?:boolean;integrated_into_top10?:boolean};
  return data.kind==='HHBA_DOMESTIC_DISCOVERY_V1'&&data.scope==='CN_MAINLAND_ONLY'&&data.enabled===true;
 }catch{return false;}
}
/** Called only from an explicit click on the external official-job search action.
 * Send only the short job title, never the resume text or profile evidence.
 */
export async function discoverExternalDomesticJobs(roleHint:string,signal?:AbortSignal):Promise<ExternalSearchResult>{
 const token=session();
 const clean=roleHint.trim().slice(0,42);
 if(clean.length<2||/[@\n\r]|(?:\d[\s-]?){5,}/.test(clean))
  throw new MatchError(400,externalSearchErrors.INVALID_SEARCH_INTENT);
 let response:Response;
 try{
  response=await fetch(API+'/discover',{
   method:'POST',credentials:'same-origin',cache:'no-store',signal,
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({role_hint:clean,consent_search:true})
  });
 }catch(e){
  if((e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'暂时无法连接 HHBA 站外官方岗位搜索。');
 }
 const data=await response.json().catch(()=>({})) as Partial<ExternalSearchResult>&{error?:string};
 if(!response.ok)throw new MatchError(response.status,externalSearchErrors[data.error||'']||'站外岗位搜索暂不可用。');
 if(data.ok!==true||data.kind!=='HHBA_DOMESTIC_DISCOVERY_V1'||data.scope!=='CN_MAINLAND_ONLY'||
  !Array.isArray(data.candidates)||data.candidates.length>3)
  throw new MatchError(502,'站外岗位搜索数据格式不完整，已丢弃本次结果。');
 return data as ExternalSearchResult;
}
