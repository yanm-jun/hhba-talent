import {getRealAuthToken,realAuthReady} from './realAuth';

export type ArchivedOfficialJd={
 ok:true;kind:'HHBA_VERIFIED_JOB_JD_V1';verified:true;job_id:string;
 company:string;title:string;location:string;canonical_url:string;
 jd_sha256:string;checked_at:string;fresh:boolean;
 content_status:'VERIFIED_SECTIONS';proof_method:'DIRECT_EMPLOYER_HTML_V1'|'PUBLIC_EMPLOYER_ATS_V1';
 full_jd:string;sections:{id:string;kind:'responsibilities'|'requirements'|'other';text:string}[];
 disclaimer:string;from_cache?:boolean;
};
export type JdAwareJob={
 title:string;requirements:string;official_url?:string;jd_version_id?:string;
};
export class JobJdArchiveError extends Error{
 constructor(readonly code:string,readonly status:number){
  const messages:Record<string,string>={
   JD_ARCHIVE_NOT_READY:'完整岗位 JD 档案尚未在当前环境准备好。',
   SESSION_INVALID:'请先登录 HHBA 后再获取官方岗位 JD。',
   OFFICIAL_URL_NOT_SUPPORTED:'这个企业招聘链接暂时不支持直接获取完整 JD；不会把搜索摘要冒充原文。',
   JD_OFFICIAL_FETCH_FAILED:'企业官网暂时无法提供可核验的岗位 JD。未使用猜测的招聘要求。',
   JD_NOT_COMPLETE_ENOUGH:'官方页面缺少明确的职责和任职要求，无法形成可靠的完整 JD。',
   JD_EXTERNAL_FETCH_LIMIT:'今天官方岗位原文核验已达到技术安全额度，请稍后再试。',
   JD_ARCHIVE_QUOTA_NOT_READY:'官方岗位 JD 读取服务暂不可用。',
   JD_VERSION_NOT_AVAILABLE:'这份岗位 JD 版本无法从可信档案中取回。',
   JD_VERSION_STALE:'岗位 JD 已超过核验有效期，需要重新核验。',
   JD_JOB_IDENTITY_MISMATCH:'岗位和 JD 版本并不对应，已阻止不准确的简历优化。',
   JD_VERIFIED_VERSION_REQUIRED:'当前岗位没有经过核验的 JD，不能开始严格岗位定向优化。'
  };
  super(messages[code]||'暂时无法获取可核验的官方岗位 JD；简历没有被修改。');
 }
}
const PATH='/api/job-jd';
async function request(url:string,init:RequestInit,signal?:AbortSignal){
 const token=getRealAuthToken();
 if(!realAuthReady||!token)throw new JobJdArchiveError('SESSION_INVALID',401);
 let response:Response;
 try{response=await fetch(url,{
  credentials:'omit',cache:'no-store',...init,
  headers:{...init.headers,Authorization:'Bearer '+token},signal
 })}catch(e){if((e as Error)?.name==='AbortError')throw e;
  throw new JobJdArchiveError('NETWORK_ERROR',503)}
 const data=await response.json().catch(()=>({})) as {ok?:boolean;error?:string;found?:boolean};
 if(!response.ok)throw new JobJdArchiveError(data.error||'UNKNOWN_ERROR',response.status);
 return data;
}
export async function jobJdArchiveStatus(signal?:AbortSignal):Promise<boolean>{
 if(!realAuthReady)return false;
 try{
  const response=await fetch(PATH,{cache:'no-store',credentials:'omit',signal});
  if(!response.ok)return false;
  const status=await response.json() as {kind?:string;enabled?:boolean};
  return status.kind==='HHBA_VERIFIED_JOB_JD_V1'&&status.enabled===true;
 }catch{return false}
}
/** Read a Search-verified JD by immutable version ID; never re-fetch the employer. */
export async function getArchivedJobJdVersion(id:string,signal?:AbortSignal):Promise<ArchivedOfficialJd>{
 if(!/^jd_[a-f0-9]{32}$/.test(id))throw new JobJdArchiveError('JD_VERSION_NOT_AVAILABLE',400);
 const result=await request(PATH+'?jd_id='+encodeURIComponent(id),{method:'GET'},signal) as ArchivedOfficialJd;
 if(result.ok!==true||result.verified!==true||result.job_id!==id||
  typeof result.full_jd!=='string'||!Array.isArray(result.sections))
  throw new JobJdArchiveError('JD_VERSION_NOT_AVAILABLE',503);
 return result;
}
/** Triggered only after the candidate's existing AI/verification consent. */
export async function ensureArchivedJobJd(officialUrl:string,signal?:AbortSignal):Promise<ArchivedOfficialJd>{
 const token=getRealAuthToken();
 if(!realAuthReady||!token)throw new JobJdArchiveError('SESSION_INVALID',401);
 const cached=await request(PATH+'?official_url='+encodeURIComponent(officialUrl),
  {method:'GET'},signal) as {ok?:boolean;verified?:boolean;found?:boolean};
 if(cached.ok&&cached.verified)return cached as ArchivedOfficialJd;
 const verified=await request(PATH,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({official_url:officialUrl,consent_verify:true})
 },signal) as ArchivedOfficialJd;
 if(verified.ok!==true||verified.verified!==true||verified.fresh!==true||
  typeof verified.full_jd!=='string'||!Array.isArray(verified.sections))
  throw new JobJdArchiveError('JD_NOT_COMPLETE_ENOUGH',422);
 return verified;
}
