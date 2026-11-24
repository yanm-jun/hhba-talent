// HHBA same-origin Cloudflare AI matching. No provider key in the browser.
import {getRealAuthToken,realAuthReady} from './realAuth';
import {extractDocxText} from './docxProfile.mjs';
import {extractPdfText,PDFResumeError} from './pdfProfile.mjs';

export type MatchProfile = {
  education:string|null;education_evidence:string|null;
  experience_years:number|null;experience_evidence:string|null;
  skills:{name:string;evidence:string}[];target_roles:string[];
  professional_credentials?:string[];warnings:string[];
  facts?:{id:string;kind:'work'|'project'|'skill'|'education'|'credential';quote:string}[];
};
export type MatchedJob = {
  id:string;company:string;title:string;title_zh?:string|null;location:string;
  official_url:string;platform:string;source:string;remote:boolean;
  reference_score:number;matched:string[];not_evidenced:string[];
  needs_verification:string[];requirements_basis:string;
  source_type?:'HHBA站内岗位'|'站外官方招聘'|'站外招聘职位';
  recruitment_source_kind?:'EMPLOYER_DOMAIN_CANDIDATE'|'EMPLOYER_ATS'|'THIRD_PARTY_BOARD'|'UNVERIFIED';
  recruitment_source_note?:string;
  application_status?:'NEEDS_OFFICIAL_CONFIRMATION';checked_at?:string;
  salary?:string|null;experience_requirement?:string|null;
  required_skills?:string[];mandatory_skills?:string[];preferred_skills?:string[];unclassified_skills?:string[];
  min_experience_years?:number|null;minimum_education?:string|null;
  professional_credential_requirements?:string[];
  professional_credential_review?:{kind:string;likely_credential:string;warning:string}|null;
  score_breakdown?:{role:number;skills:number;experience:number;education:number;location:number};
  recommendation_reason?:string;source_status?:'MODEL_SEARCH_REPORTED'|'SOURCE_SEARCH_PREVIEW'|'OFFICIAL_JD_VERIFIED';
  jd_version_id?:string;jd_sha256?:string;jd_checked_at?:string;
  evidence_status?:'VERIFIED_FULL_JD'|'PARTIAL_SOURCE'|'SEARCH_SNIPPET_ONLY'|'INSUFFICIENT_EVIDENCE'|'RESEARCH_PENDING';
  evidence_excerpt?:string;
  evidence_sources?:{url:string;kind:string}[];
  evidence_score_status?:'AI_PARTIAL_SOURCE_SCORED'|'AI_DIRECTION_REFERENCE_SCORED';
  score_evidence_status?:'GROUNDED_JD_RESUME_QUOTES';
  jd_proof_method?:'DIRECT_EMPLOYER_HTML_V1'|'PUBLIC_EMPLOYER_ATS_V1'|'V4_STRUCTURED_JOBPOSTING';
  jd_source_status?:'VERIFIED_JD';
  jd_employer_identity_status?:'ATS_TENANT_NOT_LEGAL_ENTITY_VERIFIED'|'DIRECT_EMPLOYER_SOURCE';
  jd_score_status?:'V2_JD_EVIDENCE_SCORED'|'AI_VERIFIED_JD_SCORED'|'INSUFFICIENT_RESUME_EVIDENCE';
  jd_comparisons?:{requirement:string;resume_evidence:string|null;status:'supported'|'partial'|'missing'}[];
  match_score?:number|null;score_basis?:string;
  availability_status?:'OPEN_LISTED'|'CLOSED_LISTED'|'POSSIBLY_CLOSED'|'UNKNOWN';
  availability_note?:string;availability_checked_at?:string|null;
  score_reasoning?:string;
  evidence_quality?:{skills:string;experience:string;education:string};
  ranking_version?:'HHBA_MATCH_RANKING_V2';
};
export type MatchResponse = {
  status:'COMPLETE';profile:MatchProfile;matches:MatchedJob[];
  matched_official_jobs:number;source:string;scoring:string;privacy:string;disclaimer:string;
  native_search?:{model:string;searches:number;page_reads:number;provider_items:number;visible_jobs:number;discarded:number;elapsed_ms:number;
   candidate_links?:number;explicit_city_sources?:number;selection_rounds?:number;
   underfilled_rechecks?:number;unscored_source_previews?:number;checkpoint_restored?:boolean;
   underfilled_expansion_queries?:number;underfilled_expansion_new?:number;
   search_failures?:number;rejected_links?:number;agent_exit_reason?:string;
   mode?:string;research_error?:string;search_result_links?:number;
   opened_job_pages?:number;model_candidate_rows?:number;model_source_grounded?:number;
   jd_verification?:{eligible?:number;verified?:number;scored?:number;failed?:number};
   native_error?:string|null;native_mode?:string|null;
   version?:string;stage?:string;queries?:number;fetch_attempted?:number;
   fetch_failures?:number;city_evidence_count?:number;extracted_jobs?:number;
   provider_error_codes?:string[];fetch_error_codes?:string[];
   model_failures?:number;score_provider_error?:string|null;planning_error?:string|null;
   extraction_page_rejections?:{invalid_detail_url?:number;empty_page?:number;
    work_city_missing?:number;company_or_role_missing?:number;
    employer_identity_missing?:number;role_title_unverified?:number;
    duties_quote_unverified?:number;requirements_quote_unverified?:number;
    no_verbatim_jd_fields?:number};
   source_batches?:number;source_backfill_attempts?:number;source_exhausted?:boolean;
   search_raw_results?:number;search_empty_queries?:number;
   search_rejection_counts?:{no_url?:number;non_employer?:number;not_detail?:number;
    duplicate?:number;empty_metadata?:number;foreign_title?:number};
   hybrid_fallback?:{queries?:number;raw_results?:number;candidate_links?:number;
    source_previews?:number;source_preview_before_fetch?:number;
    fetch_attempted?:number;fetched_job_pages?:number;fetch_failures?:number;
    explicit_work_city_sources?:number;model_recovered?:number;
    native_source_salvage_attempted?:number;native_source_salvage_fetched?:number;
    native_source_salvage_jobs?:number;
    search_failures?:number;index_companies_considered?:number;error?:string|null}};
  history_id?:string|null;
  history_status?:'SAVED'|'EMPTY'|'UNAVAILABLE';
  new_job_count?:number;
  improved_job_count?:number;
  can_continue?:boolean;
  research_pending?:boolean;
  preview_synthetic?:boolean;
};
export type MatchOptions = {country:string;remote_only:boolean;role_hint:string;limit:number;exclude_urls?:string[];history_id?:string;recovery_jobs?:MatchedJob[]};
const API='/api/match-next'; // Original default preserved for production and V2 compatibility.
// V4 is the default on HHBA hosts; the legacy API remains for isolated diagnostics.
export const MATCH_V4_PREVIEW=typeof window!=='undefined'&&
 (window.location.hostname.endsWith('.hhba-talent.pages.dev')||
  window.location.hostname==='hhba.work'||window.location.hostname==='www.hhba.work');
const EFFECTIVE_API=MATCH_V4_PREVIEW?'/api/match-v4':API;
const LEGACY_SEARCH_API='/api/match'; // Independent non-CV job discovery stays unchanged.
const LIMIT=3*1024*1024;
const errorMap:Record<string,string>={
  MATCH_NOT_ENABLED:'智能匹配服务尚未开放，请稍后再试。',
  AI_NATIVE_DEEPSEARCH_DISABLED:'原生深度搜索试用暂时关闭，请选择常规搜索。',
  AI_NATIVE_DEEPSEARCH_TIMEOUT:'DeepSeek 原生深度搜索用时过长，本轮未完成，请尝试常规搜索。',
  AI_NATIVE_DEEPSEARCH_INCOMPLETE:'DeepSeek 原生深度搜索未完整结束，未使用不完整结果。',
  AI_NATIVE_DEEPSEARCH_FAILED:'DeepSeek 原生深度搜索执行失败，可切换常规搜索重试。',
  AI_NATIVE_DEEPSEARCH_INVALID_ANSWER:'DeepSeek 本轮未返回合格岗位结构，请改用常规搜索重试。',
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
  AI_PROVIDER_UPSTREAM_ERROR:'AI 服务暂时异常，请稍后重试。',
  AI_PROVIDER_NETWORK_ERROR:'HHBA 暂时无法连接 AI 服务，请稍后重试。',
  AI_PROVIDER_REDIRECT_BLOCKED:'AI 接口发生异常重定向，为保护密钥，已安全终止请求。',
  AI_PROVIDER_TIMEOUT:'AI 接口等待超时，尚未取得完整结果。',
  AI_PROVIDER_SLOW:'DeepSeek 请求超时且没有发现可展示岗位。',
  AI_SEARCH_TIMEOUT:'DeepSeek Search 搜索服务超时。',
  AI_SEARCH_UNAVAILABLE:'DeepSeek Search 暂时不可用，未调用推荐模型。',
  AI_SEARCH_NO_DETAIL_JOBS:'搜索已完成，但未找到符合要求的具体岗位页面；没有编造职位。',
  AI_SEARCH_API_REJECTED:'DeepSeek Search API 拒绝了请求，请检查账号权限或接口配置。',
  AI_SEARCH_RESPONSE_INVALID:'DeepSeek Search 返回格式异常，请检查接口兼容性。',
  AI_FETCH_TIMEOUT:'DeepSeek 网页读取服务响应超时，本次不视为岗位不存在。',
  AI_FETCH_API_REJECTED:'DeepSeek Fetch 接口拒绝请求，需检查网页读取权限或接口配置。',
  AI_FETCH_ACCESS_DENIED:'DeepSeek Fetch 的网页访问被安全策略限制，并非密钥一定失效。',
  AI_FETCH_RESPONSE_INVALID:'DeepSeek Fetch 未返回有效网页正文，服务健康检查未通过。',
  AI_MATCH_REASON_TIMEOUT:'候选岗位已检索，但推荐理由生成超时；请稍后再试。',
  AI_MATCH_NO_VALID_JOBS:'本轮 AI 候选名单没有通过岗位信息核验，这不代表你的简历不符合国内招聘要求。请尝试重新搜索或填写具体岗位方向。',
  AI_EMPLOYER_JOBS_NOT_FOUND:'本轮已尝试补充搜索，但仍未找到信息足够明确的企业招聘岗位链接；并非你的简历不适合。请稍后重试或填写更具体的岗位方向。',
  AI_PROVIDER_RESPONSE_INVALID:'AI 输出格式异常，未采用不完整推荐结果。',
  AI_PROFILE_INCOMPLETE:'AI 没有识别到可用于匹配的经历或技能。请核对简历文字，补充真实内容后重试。',
  MATCH_PERSONAL_LIMIT:'今天的个人免费体验次数已达上限。',
  MATCH_GLOBAL_LIMIT:'平台今天的 AI 体验额度已用完。',
  BAD_RESPONSE:'匹配结果格式不完整，请稍后重试。',
  AI_WEB_SEARCH_NOT_USED:'AI 本轮未执行联网搜索，未展示未核实岗位。',
  AI_RESPONSE_INVALID:'DeepSeek 返回结果格式异常，请重试。',
  AI_PROVIDER_INCOMPLETE:'AI 搜索未能完成，没有返回不完整的岗位结果。'
};
export class MatchError extends Error {
 constructor(public readonly status:number,message:string,public readonly code?:string){super(message);this.name='MatchError'}
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
  const response=await fetch(EFFECTIVE_API+'/status',{method:'GET',credentials:'same-origin',cache:'no-store',signal});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('json'))return false;
  const data=await response.json() as {kind?:string;enabled?:boolean};
  return data.kind==='HHBA_NATIVE_WEB_MATCH_V1'&&data.enabled===true;
 }catch{return false}
}
/** An authenticated, explicit-on-click provider probe for the isolated preview.
 * Never sends résumé data and never works from the public production hostname.
 */
const isCleanV2PreviewHost=()=>typeof window!=='undefined'&&
 window.location.hostname.endsWith('.hhba-talent.pages.dev')&&
 window.location.hostname!=='hhba-talent.pages.dev';
export async function matchPreviewPreflightAvailable(signal?:AbortSignal):Promise<boolean>{
 if(!isCleanV2PreviewHost()||!realAuthReady)return false;
 try{
  const response=await fetch(API+'/status',{
   method:'GET',credentials:'same-origin',cache:'no-store',signal
  });
  if(!response.ok)return false;
  const data=await response.json() as {enabled?:boolean;preflight_available?:boolean};
  return data.enabled===false&&data.preflight_available===true;
 }catch{return false}
}
export async function runMatchPreviewProviderCheck(signal?:AbortSignal):Promise<{
 status:'READY';capabilities:string[];fetch_content_verified:boolean
}>{
 if(!isCleanV2PreviewHost())throw new MatchError(403,'只能在独立的 HHBA 预览环境中执行接口预检。');
 const token=session();
 const response=await fetch(API+'/provider-check',{
  method:'GET',credentials:'same-origin',cache:'no-store',signal,
  headers:{Authorization:'Bearer '+token}
 }).catch(error=>{
  if(error?.name==='AbortError')throw error;
  throw new MatchError(503,'预览环境暂时无法连接接口预检服务。');
 });
 const data=await response.json().catch(()=>null) as {
  ok?:boolean;status?:string;capabilities?:string[];error?:string;
  fetch_content_verified?:boolean
 }|null;
 if(!response.ok||data?.ok!==true||data?.status!=='READY'||
  !Array.isArray(data.capabilities)||data.fetch_content_verified!==true)
  throw new MatchError(response.status,errorMap[data?.error||'']||
   'DeepSeek 接口预检未通过，请检查预览环境配置。');
 return {status:'READY',capabilities:data.capabilities,fetch_content_verified:true};
}
/** Best-effort browser redaction before submitting text to HHBA's server. */
export function redactResumeTextLocally(text:string):string{
 const redacted=text
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[邮箱已隐藏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[手机号已隐藏]')
  .replace(/(?<![0-9A-Za-z])\d{17}[0-9Xx](?![0-9A-Za-z])/g,'[身份证号已隐藏]')
  .replace(/\bhttps?:\/\/[^\s<>]{3,200}/gi,'[个人网址已隐藏]')
  .replace(/(?:微信号|微信|QQ号|QQ)\s*[:：]\s*[A-Za-z0-9_-]{5,32}/gi,'[即时通讯账号已隐藏]')
  .trim();
 return MATCH_V4_PREVIEW?redacted:redacted.slice(0,20000);
}
export function resumeFileFormat(name:string){
 return /\.(pdf|docx)$/i.exec(name)?.[1].toLowerCase()??null;
}
export async function inspectResumeTextLocally(file:File,signal?:AbortSignal):Promise<{text:string;needsOcr:boolean}>{
 const format=resumeFileFormat(file.name);
 if(!format||file.size<30||(!MATCH_V4_PREVIEW&&file.size>LIMIT))
  throw new MatchError(413,MATCH_V4_PREVIEW?'请选择有效的 Word（DOCX）或 PDF 简历。':'请选择 3 MB 以内的 Word（DOCX）或 PDF 简历。');
 try{
  const buffer=await file.arrayBuffer();
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const pdf=format==='pdf'?await extractPdfText(buffer,{signal,unbounded:MATCH_V4_PREVIEW}):null;
  const value=pdf?.text??await extractDocxText(buffer,{signal,unbounded:MATCH_V4_PREVIEW});
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const text=redactResumeTextLocally(value);
  return {text,needsOcr:pdf?.hasTextlessPages===true||text.replace(/\s/g,'').length<30};
 }catch(e){
  if((e as Error)?.name==='AbortError'||e instanceof MatchError)throw e;
  if((e instanceof PDFResumeError&&['PDF_NO_TEXT','PDF_FAILED','PDF_TIMEOUT'].includes(e.code))||
   format==='docx')
   return {text:'',needsOcr:true};
  throw new MatchError(400,(e as Error)?.message||errorMap.INVALID_RESUME_TEXT);
 }
}
export async function extractResumeTextLocally(file:File,signal?:AbortSignal):Promise<string>{
 const {text}=await inspectResumeTextLocally(file,signal);
 if(text.replace(/\s/g,'').length<30)throw new MatchError(400,errorMap.INVALID_RESUME_TEXT);
 return text;
}

const ocrErrors:Record<string,string>={
 SESSION_INVALID:'请先登录求职账号，再识别简历文档。',
 OCR_CONSENT_REQUIRED:'请先授权 DeepSeek 处理这份原文件。',
 OCR_INVALID_FILE:'这份文件无法读取。请在 Word 中另存为 DOCX，或重新导出 PDF。',
 OCR_UNSUPPORTED_FORMAT:'请选择 Word（DOCX）或 PDF 简历。',
 OCR_FILE_TOO_LARGE:'请选择 3 MB 以内的简历文件。',
 OCR_TOO_MANY_PAGES:'简历最多支持 15 页，请精简后重试。',
 OCR_NO_TEXT:'暂时无法从文档中识别文字。请重新导出简历，或粘贴简历文字。',
 OCR_BUSY:'文档识别服务繁忙，请稍后重试。',
 OCR_TIMEOUT:'文档识别超时，请重试。'
};
export async function recognizeResumeDocument(file:File,signal?:AbortSignal):Promise<{text:string;partial:boolean}>{
 const token=session();
 const format=resumeFileFormat(file.name);
 if(!format||file.size<30||(!MATCH_V4_PREVIEW&&file.size>LIMIT))throw new MatchError(400,ocrErrors.OCR_INVALID_FILE);
 const response=await fetch(EFFECTIVE_API+'/ocr',{
  method:'POST',credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+token,
   'X-HHBA-Resume-Format':format,'X-HHBA-OCR-Consent':MATCH_V4_PREVIEW?'v4-resume-ocr-v1':'deepseek-resume-ocr-v1'},
  body:file
 }).catch(error=>{
  if(error?.name==='AbortError')throw error;
  throw new MatchError(503,'暂时连不上文档识别服务，请重试。');
 });
 const data=await response.json().catch(()=>null) as {ok?:boolean;error?:string;text?:string;partial?:boolean}|null;
 if(!response.ok||data?.ok!==true||typeof data.text!=='string')
  throw new MatchError(response.status,ocrErrors[data?.error||'']||errorMap[data?.error||'']||'文档识别暂未完成，可以重试或粘贴简历文字。');
 return {text:redactResumeTextLocally(data.text),partial:data.partial===true};
}
export type NativeMatchProgress='preparing'|'parsing'|'connected'|'planning'|'searching'|'reading'|'researching'|'writing'|'scoring'|'waiting';
export type NativeMatchActivity={
 stage:NativeMatchProgress;message:string;searches?:number;raw_results?:number;
 candidate_links?:number;rejected_links?:number;pages_read?:number;decisions?:number;
 search_failures?:number;elapsed_ms?:number
};
async function consumeNativeMatchStream(
 response:Response,onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void,
 onActivity?:(activity:NativeMatchActivity)=>void,onReceive?:()=>void
):Promise<MatchResponse>{
 if(!response.body)throw new MatchError(502,'智能匹配连接没有返回可读取的结果。');
 const decoder=new TextDecoder(),reader=response.body.getReader();
 let buffer='',complete:MatchResponse|null=null;
 function parseEvent(chunk:string){
  const event=chunk.split('\n').find(line=>line.startsWith('event:'))?.slice(6).trim();
  const data=chunk.split('\n').filter(line=>line.startsWith('data:'))
   .map(line=>line.slice(5).trimStart()).join('\n');
  if(!event||!data)return;
  let value:any;try{value=JSON.parse(data)}catch{return}
  onReceive?.();
  if(event==='progress'){
   const stage=value?.stage;
   if(['preparing','parsing','connected','planning','searching','reading','researching','writing','scoring','waiting'].includes(stage))
    onProgress?.(stage as NativeMatchProgress);
  }else if(event==='activity'){
   const stage=value?.stage;
   if(typeof value?.message==='string'&&value.message.length<=340&&
      ['preparing','parsing','connected','planning','searching','reading','researching','writing','scoring'].includes(stage)){
    const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?
     Math.floor(v):undefined;
    onActivity?.({stage:stage as NativeMatchProgress,message:value.message,
     searches:number(value.searches),raw_results:number(value.raw_results),
     candidate_links:number(value.candidate_links),rejected_links:number(value.rejected_links),
     pages_read:number(value.pages_read),decisions:number(value.decisions),
     search_failures:number(value.search_failures),elapsed_ms:number(value.elapsed_ms)});
   }
  }else if(event==='partial'){
   if(Array.isArray(value?.matches)&&(MATCH_V4_PREVIEW||value.matches.length<=10))
    onPartial?.(value.matches as MatchedJob[]);
  }else if(event==='failure'){
   const code=String(value?.error||'AI_PROVIDER_UNAVAILABLE');
   const stage=String(value?.phase||'preparing');
   const elapsed=Number(value?.elapsed_ms||0);
   const names:Record<string,string>={
    preparing:'准备匹配',parsing:'识别简历',connected:'准备搜索',planning:'分析求职方向',searching:'搜索企业岗位',reading:'核验岗位 JD',researching:'核对招聘资料',writing:'整理岗位',scoring:'对照简历和岗位 JD'
   };
   const elapsedNote=Number.isFinite(elapsed)&&elapsed>=1000?
    '（'+Math.round(elapsed/1000)+'秒，阶段：'+(names[stage]||'模型处理')+'）':'';
   throw new MatchError(502,(errorMap[code]||'智能匹配服务暂时不可用。')+elapsedNote,code);
  }else if(event==='complete'){
   complete=value as MatchResponse;
  }
 }
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   if(!MATCH_V4_PREVIEW&&buffer.length>320000)throw new MatchError(502,'结果数据异常，已停止处理。');
   let stop;
   while((stop=buffer.indexOf('\n\n'))>=0){
    const event=buffer.slice(0,stop);buffer=buffer.slice(stop+2);
    parseEvent(event);
    if(complete)return complete;
   }
  }
  if(buffer.trim())parseEvent(buffer);
 }catch(e){
  if(e instanceof MatchError||(e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'智能匹配连接中断，未收到完整推荐。');
 }finally{
  void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
 if(!complete)throw new MatchError(502,'智能匹配未返回完整结果，请稍后重试。');
 return complete;
}

/**
 * Explicit-on-click real DeepSeek acceptance run with a fixed SERVER-SIDE
 * fake résumé. This endpoint cannot read or match the user's uploaded résumé,
 * never writes to their recommendation history and only runs in Pages preview.
 */
export async function runMatchPreviewSyntheticAcceptance(
 signal?:AbortSignal,
 onProgress?:(stage:NativeMatchProgress)=>void,
 onActivity?:(activity:NativeMatchActivity)=>void
):Promise<MatchResponse>{
 if(!isCleanV2PreviewHost())throw new MatchError(403,
  '合成简历验收仅在独立预览环境开放。');
 const token=session();
 const deadline=AbortSignal.timeout(330000);
 const requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
 const response=await fetch(API+'/synthetic-check',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  signal:requestSignal,
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
   Accept:'text/event-stream'},
  body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
 }).catch(error=>{
  if(requestSignal.aborted)throw new MatchError(504,'合成简历验收等待超时或被取消。');
  if(error?.name==='AbortError')throw error;
  throw new MatchError(503,'暂时无法连接合成简历验收接口。');
 });
 if(!response.ok){
  const data=await response.json().catch(()=>null) as {error?:string}|null;
  throw new MatchError(response.status,
   errorMap[data?.error||'']||'合成简历验收未能启动。');
 }
 if(!(response.headers.get('content-type')||'').includes('text/event-stream'))
  throw new MatchError(502,'验收服务未返回流式岗位搜索进度。');
 const result=await consumeNativeMatchStream(response,onProgress,undefined,onActivity);
 if(result.preview_synthetic!==true)
  throw new MatchError(502,'验收响应缺少合成简历标识，已停止展示结果。');
 return result;
}

async function submitMatchRound(
 text:string,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string,
 onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void,
 onActivity?:(activity:NativeMatchActivity)=>void
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const token=session();
 const cleaned=redactResumeTextLocally(text);
 if(cleaned.replace(/\s/g,'').length<30)throw new MatchError(400,errorMap.INVALID_RESUME_TEXT);
 const watchdog=new AbortController();
 const requestSignal=signal?AbortSignal.any([signal,watchdog.signal]):watchdog.signal;
 let idleTimer:ReturnType<typeof setTimeout>|undefined;
 const timeout=(message:string)=>watchdog.abort(new MatchError(504,message));
 // The server sends a heartbeat every 12 seconds, including during long AI calls.
 const onReceive=()=>{
  // V4 research has no HHBA-imposed inactivity or overall deadline.
  if(MATCH_V4_PREVIEW)return;
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>timeout('一段时间没有收到匹配进度，已结束本次等待。可用当前简历重试。'),35000);
 };
 const deadline=MATCH_V4_PREVIEW?undefined:setTimeout(()=>
  timeout('这次智能匹配用时过长，已结束本次等待。可用当前简历重试。'),300000);
 onReceive();
 try{
  const response=await fetch(EFFECTIVE_API+'/resume',{
   method:'POST',credentials:'same-origin',cache:'no-store',signal:requestSignal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'Accept':'text/event-stream'},
   body:JSON.stringify({resume_id:resumeId||null,history_id:opts.history_id,text:cleaned,consent:true,
    options:{country:'CN',remote_only:false,
     role_hint:opts.role_hint,
     ...(!MATCH_V4_PREVIEW?{limit:Math.min(10,Math.max(1,opts.limit||10))}:{}),
     exclude_urls:opts.exclude_urls
    }})
  }).catch(e=>{if(requestSignal.aborted)throw requestSignal.reason;
   if((e as Error)?.name==='AbortError')throw e;
   throw new MatchError(503,'暂时无法连接 HHBA 智能匹配服务。');});
  onReceive();
  const isStream=(response.headers.get('content-type')||'').includes('text/event-stream');
  if(isStream&&!response.ok)throw new MatchError(response.status,'智能匹配流式连接失败。');
  const data=isStream?await consumeNativeMatchStream(response,onProgress,onPartial,onActivity,onReceive):
   await response.json().catch(()=>({})) as Partial<MatchResponse>&{error?:string};
  if(!response.ok)throw new MatchError(response.status,errorMap[(data as {error?:string}).error||'']||'智能匹配服务暂时不可用。',(data as {error?:string}).error);
  if(data.status!=='COMPLETE'||!data.profile||!Array.isArray(data.matches)||
   (!MATCH_V4_PREVIEW&&data.matches.length>10))
   throw new MatchError(502,errorMap.BAD_RESPONSE);
  return data as MatchResponse;
 }catch(error){
  if(requestSignal.aborted)throw requestSignal.reason;
  throw error;
 }finally{
  clearTimeout(idleTimer);
  clearTimeout(deadline);
 }
}

/** Each V4 HTTP request runs one AI-controlled research round. This renews
 * Cloudflare's per-request resource budget without capping the full search.
 * Keep the accumulated results in this authenticated browser session. */
export async function submitExtractedResumeText(
 text:string,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string,
 onProgress?:(stage:NativeMatchProgress)=>void,onPartial?:(jobs:MatchedJob[])=>void,
 onActivity?:(activity:NativeMatchActivity)=>void
):Promise<MatchResponse>{
 if(!MATCH_V4_PREVIEW)return submitMatchRound(text,opts,consent,signal,resumeId,onProgress,onPartial,onActivity);
 const collected=new Map<string,MatchedJob>((opts.recovery_jobs||[]).map(job=>[job.official_url,job])),previous=new Set(opts.exclude_urls||[]);
 const historyId=opts.history_id||crypto.randomUUID();
 let last:MatchResponse|undefined,round=0,delay=1000;
 const publish=(jobs:MatchedJob[])=>{for(const job of jobs)if(!previous.has(job.official_url))collected.set(job.official_url,job);onPartial?.([...collected.values()]);};
 const pause=(ms:number)=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
 while(true){
  if(signal?.aborted)throw signal.reason;
  try{
   const data=await submitMatchRound(text,{...opts,history_id:historyId,exclude_urls:[...previous,...collected.keys()]},consent,signal,resumeId,onProgress,publish,onActivity);
   publish(data.matches);last={...data,profile:(data.profile.facts?.length||data.profile.skills.length||data.profile.target_roles.length||!last)?data.profile:last.profile};round++;delay=1000;
   onActivity?.({stage:'searching',message:'第 '+round+' 轮已完成，累计 '+collected.size+' 条岗位来源。',searches:round,candidate_links:collected.size});
   if(!data.research_pending)break;
  }catch(e){
   if(signal?.aborted)throw signal.reason;
   const err=e as MatchError;
   const transient=err.code?['AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_UNAVAILABLE'].includes(err.code):[502,503,504,429].includes(err.status);
   if(!transient){
    if(!last)throw e;
    last={...last,disclaimer:last.disclaimer+' 本次搜索暂停，可继续搜索。'};break;
   }
   onActivity?.({stage:'searching',message:'接口暂时异常，已保留 '+collected.size+' 条岗位，正在自动恢复。'});
   await pause(delay);delay=Math.min(delay*2,30000);
  }
 }
 if(!last)throw new MatchError(502,'未取得完整的岗位研究结果。');
 onProgress?.('reading');
 // Verify one public JD per request, instead of spending the entire hosting
 // subrequest budget on all vacancies at once. No total job-count cap.
 const queue=[...collected.values()].filter(job=>!job.jd_version_id||job.jd_score_status!=='AI_VERIFIED_JD_SCORED');let cursor=0,checked=0;
 const worker=async()=>{
  while(cursor<queue.length){
   if(signal?.aborted)throw signal.reason;
   const job=queue[cursor++];
   try{
    const verified=await prepareV4Job(job.official_url,signal,job.title,historyId);
    const merged={...job,...verified};collected.set(job.official_url,merged);
    onPartial?.([...collected.values()]);
    try{const score=await scoreV4Job(merged,text,signal,historyId);collected.set(job.official_url,{...merged,...score});}
    catch(e){if(signal?.aborted)throw e;}
   }
   catch(e){if(signal?.aborted)throw e;}
   checked++;onActivity?.({stage:'reading',message:'已检查 '+checked+' / '+queue.length+' 条岗位来源。',pages_read:checked});
   onPartial?.([...collected.values()]);
  }
 };
 await Promise.all(Array.from({length:Math.min(3,queue.length)},()=>worker()));
 const matches=[...collected.values()].sort((a,b)=>(b.match_score??-1)-(a.match_score??-1));
 if(last.history_status==='SAVED'&&!last.research_pending){
  try{const done=await fetch('/api/match-v4/finish',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session()},body:JSON.stringify({history_id:historyId})});if(!done.ok)last.history_status='UNAVAILABLE';}
  catch(e){if(signal?.aborted)throw e;last.history_status='UNAVAILABLE';}
 }
 const verified=matches.filter(j=>j.jd_source_status==='VERIFIED_JD').length;
 const scored=matches.filter(j=>j.jd_score_status==='AI_VERIFIED_JD_SCORED').length;
 return {...last,matches,matched_official_jobs:verified,can_continue:true,research_pending:false,
  native_search:{...last.native_search!,searches:round,page_reads:checked,visible_jobs:matches.length,candidate_links:matches.length,jd_verification:{eligible:matches.length,verified,scored,failed:matches.length-verified}}};
}
async function scoreV4Job(job:MatchedJob,text:string,signal?:AbortSignal,historyId?:string):Promise<Partial<MatchedJob>>{
 const response=await fetch('/api/match-v4/score',{method:'POST',credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+session()},body:JSON.stringify({consent:true,history_id:historyId,text:redactResumeTextLocally(text),job:{jd_version_id:job.jd_version_id,jd_sha256:job.jd_sha256,official_url:job.official_url}})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true||!data.score)throw new MatchError(response.status,'完整 JD 评分暂未完成。');
 return data.score;
}
export async function prepareV4Job(officialUrl:string,signal?:AbortSignal,title?:string,historyId?:string):Promise<Partial<MatchedJob>>{
 const response=await fetch('/api/match-v4/jd',{method:'POST',credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+session()},
  body:JSON.stringify({consent:true,official_url:officialUrl,title,history_id:historyId})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true||!data.job?.jd_version_id||!data.job?.jd_sha256)
  throw new MatchError(response.status,'暂未取得可用于优化的可信 JD，请核对招聘原页面或稍后重试。');
 return data.job;
}

export async function submitResumeForMatching(
 file:File,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string,
 onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void,
 onExtracted?:(text:string)=>void,
 onActivity?:(activity:NativeMatchActivity)=>void
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const extracted=await extractResumeTextLocally(file,signal);
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 onExtracted?.(extracted); // same locally-redacted text, not a second model request
 return submitExtractedResumeText(extracted,opts,consent,signal,resumeId,onProgress,onPartial,onActivity);
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
 return 'DeepSeek 余额、Search 检索与 V4 Pro 模型 JSON 接口均通过检查。没有发送简历，也没有消耗匹配次数。';
}

/** Safe outbound detail URL for a fetched and independently reviewed mainland
 * enterprise posting. The frontend never trusts arbitrary URLs from AI.
 */
export function safeExternalJobApplicationUrl(job:MatchedJob):string|null{
 if(job?.source_type!=='站外官方招聘'||job.application_status!=='NEEDS_OFFICIAL_CONFIRMATION')return null;
 try{
  const u=new URL(job.official_url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  const specs:Record<string,{company:string;path:string;param:string;pattern:RegExp}>={
   'careers.tencent.com':{company:'腾讯',path:'/jobdesc.html',param:'postId',pattern:/^\d{12,22}$/},
   'career.huawei.com':{company:'华为',path:'/cn/job-details',param:'advertisementId',pattern:/^\d{1,12}$/},
   'zhaopin.meituan.com':{company:'美团',path:'/web/position/detail',param:'jobUnionId',pattern:/^\d{8,14}$/},
   'zhaopin.jd.com':{company:'京东',path:'/web/job-info-detail',param:'requementId',pattern:/^\d{3,12}$/}
  };
  if(u.hostname==='jobs.bytedance.com'){
   const id=u.pathname.match(/^\/experienced\/position\/([0-9]{13,22})\/detail$/)?.[1];
   return u.searchParams.size===0&&id&&job.company==='字节跳动'&&
    job.source==='jobs.bytedance.com'&&job.id==='external-jobs-bytedance-com-'+id?
    'https://jobs.bytedance.com/experienced/position/'+id+'/detail':null;
  }
  if(u.hostname==='talent.baidu.com'){
   const id=u.pathname.match(/^\/jobs\/detail\/SOCIAL\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1]?.toLowerCase();
   return id&&u.searchParams.size===0&&job.company==='百度'&&
    job.source==='talent.baidu.com'&&job.id==='external-talent-baidu-com-'+id?
    'https://talent.baidu.com/jobs/detail/SOCIAL/'+id:null;
  }
  if(u.searchParams.size!==1)return null;
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
 application_method?:'OFFICIAL_DETAIL_LOGIN_REQUIRED'|'DIRECT_CTA_UNVERIFIED';
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
  const response=await fetch(LEGACY_SEARCH_API+'/discover',{method:'GET',credentials:'same-origin',cache:'no-store',signal});
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
  response=await fetch(LEGACY_SEARCH_API+'/discover',{
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
