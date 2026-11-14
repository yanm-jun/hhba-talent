// HHBA same-origin Cloudflare AI matching. No provider key in the browser.
import {getRealAuthToken,realAuthReady} from './realAuth';
import {extractDocxText} from './docxProfile.mjs';
import {extractPdfText} from './pdfProfile.mjs';

export type MatchProfile = {
  education:string|null;education_evidence:string|null;
  experience_years:number|null;experience_evidence:string|null;
  skills:{name:string;evidence:string}[];target_roles:string[];
  professional_credentials?:string[];warnings:string[];
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
  recommendation_reason?:string;source_status?:'MODEL_SEARCH_REPORTED';
  match_score?:number|null;score_basis?:string;
  travel_requirement?:string|null;travel_requirement_evidence?:string|null;
  fit_dimensions?:{role_fit:number;skill_fit:number;experience_fit:number;location_fit:number}|null;
  fit_dimension_evidence?:Record<string,string>|null;
  availability_status?:'OPEN_LISTED'|'CLOSED_LISTED'|'POSSIBLY_CLOSED'|'UNKNOWN';
  availability_note?:string;availability_checked_at?:string|null;
  score_reasoning?:string;
  evidence_quality?:{skills:string;experience:string;education:string};
  ranking_version?:'HHBA_MATCH_RANKING_V2';
};
export type MatchResponse = {
  status:'COMPLETE';profile:MatchProfile;matches:MatchedJob[];
  matched_official_jobs:number;source:string;scoring:string;privacy:string;disclaimer:string;
  native_search?:{model:string;searches:number;page_reads:number;provider_items:number;visible_jobs:number;discarded:number;elapsed_ms:number};
  history_id?:string|null;
  history_status?:'SAVED'|'EMPTY'|'UNAVAILABLE';
  new_job_count?:number;
  improved_job_count?:number;
};
export type MatchSearchPreferences = {
 industry_hint:string;preferred_cities:string;
 location_mode:'PRIORITY'|'ONLY'|'NATIONWIDE';
 travel_preference:'UNSPECIFIED'|'FREQUENT_OK'|'OCCASIONAL'|'NO';
 salary_min_k:string;salary_max_k:string;employer_models:string[];
};
export type MatchOptions = {
 country:string;remote_only:boolean;role_hint:string;limit:number;
 search_preferences?:MatchSearchPreferences;
};
const API='/api/match-native';
const LEGACY_SEARCH_API='/api/match'; // Independent non-CV job discovery stays unchanged.
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
  INVALID_SEARCH_PREFERENCES:'求职偏好设置不完整，请检查城市、薪资范围和出差要求。',
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
  AI_PROVIDER_TIMEOUT:'DeepSeek 接口等待超时，尚未取得完整结果。',
  AI_PROVIDER_SLOW:'DeepSeek 请求超时且没有发现可展示岗位。',
  AI_SEARCH_TIMEOUT:'DeepSeek Search 搜索服务超时。',
  AI_SEARCH_UNAVAILABLE:'DeepSeek Search 暂时不可用，未调用推荐模型。',
  AI_SEARCH_NO_DETAIL_JOBS:'搜索已完成，但未找到符合要求的具体岗位页面；没有编造职位。',
  AI_SEARCH_API_REJECTED:'DeepSeek Search API 拒绝了请求，请检查账号权限或接口配置。',
  AI_SEARCH_RESPONSE_INVALID:'DeepSeek Search 返回格式异常，请检查接口兼容性。',
  AI_MATCH_REASON_TIMEOUT:'候选岗位已检索，但推荐理由生成超时；请稍后再试。',
  AI_MATCH_NO_VALID_JOBS:'未能从企业招聘站候选中找到满足中国大陆工作地点条件的岗位。',
  AI_EMPLOYER_JOBS_NOT_FOUND:'已检索到部分信息，但未通过岗位地点、链接及招聘来源核验，本次没有展示未确认职位。',
  AI_DEEP_SEARCH_NO_MODEL_JOBS:'DeepSeek 已完成搜索，但没有生成可用的具体岗位列表。建议调整求职方向再尝试。',
  AI_DEEP_SEARCH_EVIDENCE_MISSING:'DeepSeek 已生成岗位候选，但搜索来源证据没有正确返回，HHBA 已安全拦截结果。请联系管理员检查接口。',
  AI_DEEP_SEARCH_NO_EMPLOYER_SOURCES:'DeepSeek 已返回搜索来源，但未发现符合官方招聘页规则的具体岗位链接。未使用第三方招聘平台代替。',
  AI_DEEP_SEARCH_SOURCE_MISMATCH:'DeepSeek 返回的岗位链接无法与实际搜索来源对应，为防止虚构链接，本次没有展示推荐。',
  AI_PROVIDER_RESPONSE_INVALID:'DeepSeek 输出中断或格式异常，暂不展示不完整推荐。',
  AI_PROFILE_INCOMPLETE:'AI 未能可靠识别简历内容，请完善简历后重试。',
  MATCH_PERSONAL_LIMIT:'今天的个人免费体验次数已达上限。',
  MATCH_GLOBAL_LIMIT:'平台今天的 AI 体验额度已用完。',
  BAD_RESPONSE:'匹配结果格式不完整，请稍后重试。',
  AI_WEB_SEARCH_NOT_USED:'DeepSeek 本次没有执行联网搜索，未展示未经搜索证实的岗位，请重试。',
  AI_RESPONSE_INVALID:'DeepSeek 返回结果格式异常，请重试。',
  AI_PROVIDER_INCOMPLETE:'DeepSeek 搜索未能完成，没有返回不完整的岗位结果。'
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
  return data.kind==='HHBA_NATIVE_WEB_MATCH_V1'&&data.enabled===true;
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
export type NativeMatchProgress='preparing'|'connected'|'searching'|'reading'|'writing'|'waiting';
async function consumeNativeMatchStream(
 response:Response,onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void
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
  if(event==='progress'){
   const stage=value?.stage;
   if(['preparing','connected','searching','reading','writing','waiting'].includes(stage))
    onProgress?.(stage as NativeMatchProgress);
  }else if(event==='partial'){
   if(Array.isArray(value?.matches)&&value.matches.length>0&&value.matches.length<=10)
    onPartial?.(value.matches as MatchedJob[]);
  }else if(event==='failure'){
   const code=String(value?.error||'AI_PROVIDER_UNAVAILABLE');
   const stage=String(value?.phase||'preparing');
   const elapsed=Number(value?.elapsed_ms||0);
   const names:Record<string,string>={
    preparing:'连接 DeepSeek',connected:'准备联网搜索',searching:'DeepSeek Search 检索职位',reading:'读取岗位详情',writing:'生成匹配理由'
   };
   const elapsedNote=Number.isFinite(elapsed)&&elapsed>=1000?
    '（'+Math.round(elapsed/1000)+'秒，阶段：'+(names[stage]||'模型处理')+'）':'';
   throw new MatchError(502,(errorMap[code]||'智能匹配服务暂时不可用。')+elapsedNote);
  }else if(event==='complete'){
   complete=value as MatchResponse;
  }
 }
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   if(buffer.length>320000)throw new MatchError(502,'结果数据异常，已停止处理。');
   let stop;
   while((stop=buffer.indexOf('\n\n'))>=0){
    const event=buffer.slice(0,stop);buffer=buffer.slice(stop+2);
    parseEvent(event);
   }
  }
  if(buffer.trim())parseEvent(buffer);
 }catch(e){
  if(e instanceof MatchError||(e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'智能匹配连接中断，未收到完整推荐。');
 }finally{reader.releaseLock();}
 if(!complete)throw new MatchError(502,'智能匹配未返回完整结果，请稍后重试。');
 return complete;
}

function toSearchPreferencesPayload(value?:MatchSearchPreferences){
 const p=value||{} as MatchSearchPreferences;
 const cities=String(p.preferred_cities||'').split(/[，,、;；\\s]+/)
  .map(x=>x.trim().replace(/市$/,'')).filter(x=>x.length>=2&&x.length<=24);
 const salary=(raw:string)=>{const n=Number(raw);return Number.isFinite(n)&&n>0&&n<=500?n:null};
 const models=['dealer_network','chain_stores','regional_teams','brand_service_network'];
 return {
  industry_hint:String(p.industry_hint||'').trim().slice(0,120),
  preferred_cities:[...new Set(cities)].slice(0,5),
  location_mode:p.location_mode||'PRIORITY',
  travel_preference:p.travel_preference||'UNSPECIFIED',
  salary_min_k:salary(p.salary_min_k||''),
  salary_max_k:salary(p.salary_max_k||''),
  employer_models:Array.isArray(p.employer_models)?[...new Set(p.employer_models.filter(x=>models.includes(x)))]:[]
 };
}
export async function submitExtractedResumeText(
 text:string,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string,
 onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const token=session();
 const cleaned=redactResumeTextLocally(text);
 if(cleaned.replace(/\s/g,'').length<30)throw new MatchError(400,errorMap.INVALID_RESUME_TEXT);
 const response=await fetch(API+'/resume',{
  method:'POST',credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'Accept':'text/event-stream'},
  body:JSON.stringify({resume_id:resumeId||null,text:cleaned,consent:true,
   options:{country:'CN',remote_only:false,
    role_hint:opts.role_hint,limit:Math.min(10,Math.max(1,opts.limit||10)),
    search_preferences:toSearchPreferencesPayload(opts.search_preferences)}})
 }).catch(e=>{if((e as Error)?.name==='AbortError')throw e;
  throw new MatchError(503,'暂时无法连接 HHBA 智能匹配服务。');});
 const isStream=(response.headers.get('content-type')||'').includes('text/event-stream');
 if(isStream&&!response.ok)throw new MatchError(response.status,'智能匹配流式连接失败。');
 const data=isStream?await consumeNativeMatchStream(response,onProgress,onPartial):
  await response.json().catch(()=>({})) as Partial<MatchResponse>&{error?:string};
 if(!response.ok)throw new MatchError(response.status,errorMap[(data as {error?:string}).error||'']||'智能匹配服务暂时不可用。');
 if(data.status!=='COMPLETE'||!data.profile||!Array.isArray(data.matches)||data.matches.length>10)
  throw new MatchError(502,errorMap.BAD_RESPONSE);
 return data as MatchResponse;
}

export async function submitResumeForMatching(
 file:File,opts:MatchOptions,consent:boolean,signal?:AbortSignal,resumeId?:string,
 onProgress?:(stage:NativeMatchProgress)=>void,
 onPartial?:(jobs:MatchedJob[])=>void
):Promise<MatchResponse>{
 if(!consent)throw new MatchError(400,errorMap.EXPLICIT_AI_SHARING_CONSENT_REQUIRED);
 const extracted=await extractResumeTextLocally(file,signal);
 return submitExtractedResumeText(extracted,opts,consent,signal,resumeId,onProgress,onPartial);
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
