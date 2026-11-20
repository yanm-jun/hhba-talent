import {getRealAuthToken,realAuthReady} from './realAuth';
const PATH='/api/official-job-verify';
export type OfficialJobVerifyStatus={
 kind:'HHBA_OFFICIAL_JOB_VERIFY_V1';enabled:boolean;daily_account_cap:number;scope:string;
};
export type OfficialVerifiedJob={
 ok:true;kind:'HHBA_OFFICIAL_JOB_VERIFY_V1';verified:true;job_id:string;
 title:string;company:string;location:string;official_url:string;
 checked_at:string;proof_method:'DIRECT_EMPLOYER_HTML_V1';from_cache:boolean;disclaimer:string;
};
const ERRORS:Record<string,string>={
 SESSION_INVALID:'请先登录 HHBA 求职者账号。',
 ORIGIN_REQUIRED:'请求来源验证失败。',
 OFFICIAL_JOB_VERIFY_DISABLED:'企业岗位直接核验功能尚未开放。',
 OFFICIAL_JOB_VERIFY_DB_NOT_READY:'官方岗位核验数据库尚未准备好。',
 CONSENT_REQUIRED:'请先确认只向企业官网获取公开岗位信息。',
 OFFICIAL_URL_NOT_SUPPORTED:'这个岗位的招聘网址暂不在独立核验支持范围内，不会将 AI 搜索结果当成已审核 JD。',
 OFFICIAL_JD_NOT_VERIFIED:'企业官网未返回足以核验的完整岗位职责、任职要求或大陆地点，未生成复评凭据。',
 OFFICIAL_VERIFY_LIMIT:'今天的独立官方岗位核验次数已达上限。'
};
export class OfficialJobVerifyError extends Error{
 constructor(readonly code:string,readonly status:number){
  super(ERRORS[code]||'企业岗位核验暂不可用，请稍后再试。');
 }
}
export async function officialJobVerifyStatus(signal?:AbortSignal):Promise<OfficialJobVerifyStatus|null>{
 if(!realAuthReady)return null;
 try{
  const response=await fetch(PATH,{method:'GET',cache:'no-store',credentials:'omit',signal});
  if(!response.ok)return null;
  const data=await response.json() as Partial<OfficialJobVerifyStatus>;
  return data.kind==='HHBA_OFFICIAL_JOB_VERIFY_V1'&&typeof data.enabled==='boolean'?
   data as OfficialJobVerifyStatus:null;
 }catch{return null;}
}
export async function verifyOfficialJob(url:string):Promise<OfficialVerifiedJob>{
 const token=getRealAuthToken();
 if(!realAuthReady||!token)throw new OfficialJobVerifyError('SESSION_INVALID',401);
 let response:Response;
 try{
  response=await fetch(PATH,{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({consent_verify:true,official_url:url})
  });
 }catch{throw new OfficialJobVerifyError('NETWORK_UNAVAILABLE',503);}
 const value=await response.json().catch(()=>({})) as Partial<OfficialVerifiedJob>&{error?:string};
 if(!response.ok)throw new OfficialJobVerifyError(value.error||'UNKNOWN_ERROR',response.status);
 if(value.ok!==true||value.verified!==true||typeof value.job_id!=='string'||
  value.kind!=='HHBA_OFFICIAL_JOB_VERIFY_V1')throw new OfficialJobVerifyError('INVALID_RESPONSE',502);
 return value as OfficialVerifiedJob;
}
