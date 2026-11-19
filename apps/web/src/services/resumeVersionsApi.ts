import {getRealAuthToken,realAuthReady} from './realAuth';
import type {ResumeBlock} from './targetedResumeOptimization';
const PATH='/api/resume-versions';
type VersionBody={blocks:ResumeBlock[];acceptedSuggestionIds:string[]};
export type SavedResumeVersion={
 id:string;job_id:string;job_title:string;company:string;created_at:string;version:VersionBody;
};
export class ResumeVersionError extends Error{
 constructor(readonly code:string,readonly status:number){
  super(({RESUME_VERSION_STORAGE_DISABLED:'云端简历版本尚未开放。',
   RESUME_VERSION_DB_NOT_READY:'简历版本数据库尚未准备好。',
   SESSION_INVALID:'请先登录 HHBA 账户。',
   VERSION_ACCOUNT_LIMIT:'当前账户最多保存15份岗位简历，请先删除旧版本。',
   INVALID_VERSION:'请先采纳至少一条真实有效的建议。',
   RESUME_VERSION_DB_UNAVAILABLE:'云端保存服务暂时不可用。'} as Record<string,string>)[code]||'简历版本请求未完成。');
 }
}
async function send<T>(method:'GET'|'POST'|'DELETE',params:string,body?:unknown):Promise<T>{
 if(!realAuthReady||!getRealAuthToken())throw new ResumeVersionError('SESSION_INVALID',401);
 let response:Response;
 try{response=await fetch(PATH+params,{
  method,credentials:'omit',cache:'no-store',
  headers:{Authorization:'Bearer '+getRealAuthToken(),...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });}
 catch{throw new ResumeVersionError('NETWORK_ERROR',503);}
 const data=await response.json().catch(()=>({})) as T&{error?:string};
 if(!response.ok)throw new ResumeVersionError(data.error||'UNKNOWN_ERROR',response.status);
 return data;
}
export function listResumeVersions(jobId:string){
 return send<{ok:boolean;items:SavedResumeVersion[]}>('GET','?job_id='+encodeURIComponent(jobId));
}
export function saveResumeVersion(job:{id:string;title:string;company:string},blocks:ResumeBlock[],acceptedIds:string[]){
 return send<{ok:boolean;id:string;created_at:string}>('POST','',{
  job_id:job.id,job_title:job.title,company:job.company,blocks,accepted_ids:acceptedIds
 });
}
export function deleteResumeVersion(id:string){
 return send<{ok:boolean;deleted:boolean}>('DELETE','?id='+encodeURIComponent(id));
}
