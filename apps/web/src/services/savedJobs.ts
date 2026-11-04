import {getRealAuthToken,realAuthReady} from './realAuth';
import {trackAccountActivity} from './engagement';

export const savedAvailable=realAuthReady && import.meta.env.BASE_URL!=='/hhba-talent/';
export type SavedJob={jobId:string;savedAt:string};
const STORE='/api/account/saved';
let requestCache:Promise<SavedJob[]>|null=null;
let cacheToken:string|null=null;
function sessionToken(){
 if(!savedAvailable)throw Error('账号级收藏服务仅在 HHBA 正式登录环境开放');
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录真实账户后再收藏岗位');
 return token;
}
export async function listSavedJobs():Promise<SavedJob[]>{
 const token=sessionToken();
 // Never return a previous account's bookmarks after a login/account switch.
 if(cacheToken!==token){cacheToken=token;requestCache=null;}
 if(!requestCache)requestCache=fetch(STORE,{
  credentials:'same-origin',cache:'no-store',headers:{Authorization:'Bearer '+token}
 }).then(async res=>{
  if(!res.ok)throw Error(res.status===401?'登录状态已失效，请重新登录':'真实账户收藏服务暂不可用');
  return res.json();
 }).then(payload=>{
  if(payload.kind!=='HHBA_ACCOUNT_SAVED_JOBS_V1'||!Array.isArray(payload.items))
   throw Error('收藏数据异常');
  return payload.items as SavedJob[];
 }).catch(error=>{requestCache=null;throw error});
 return requestCache;
}
export async function setSavedJob(jobId:string,save:boolean){
 if(!/^[A-Za-z0-9_-]{1,180}$/.test(jobId))throw Error('岗位标识无效');
 const token=sessionToken();
 const res=await fetch(STORE+'/'+encodeURIComponent(jobId),{
  method:save?'PUT':'DELETE',credentials:'same-origin',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}
 });
 if(!res.ok)throw Error(res.status===401?'请重新登录真实账户':res.status===404?
  '该岗位已不在官方职位索引中':'账号收藏操作失败，请重试');
 cacheToken=token;requestCache=null;
 if(save)trackAccountActivity('job_save');
 dispatchEvent(new CustomEvent('hhba:saved-changed',{detail:{jobId,saved:save}}));
}
