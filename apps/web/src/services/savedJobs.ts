export const savedAvailable=import.meta.env.BASE_URL!=='/hhba-talent/';
export type SavedJob={jobId:string;savedAt:string};
const STORE='/api/saved';
let requestCache:Promise<SavedJob[]>|null=null;
export async function listSavedJobs():Promise<SavedJob[]>{
 if(!savedAvailable)throw Error('收藏目前仅在 Railway 站点开放');
 if(!requestCache)requestCache=fetch(STORE,{credentials:'same-origin',cache:'no-store'})
  .then(async res=>{if(!res.ok)throw Error('收藏服务暂不可用');return res.json()})
  .then(payload=>{if(payload.kind!=='HHBA_DEVICE_SAVED_JOBS_V1'||!Array.isArray(payload.items))
    throw Error('收藏数据异常');return payload.items as SavedJob[]})
  .catch(error=>{requestCache=null;throw error});
 return requestCache;
}
export async function setSavedJob(jobId:string,save:boolean){
 if(!savedAvailable||!/^[A-Za-z0-9_-]{1,180}$/.test(jobId))throw Error('暂时无法收藏该岗位');
 const res=await fetch(STORE+'/'+encodeURIComponent(jobId),{method:save?'PUT':'DELETE',
  credentials:'same-origin',headers:{'Content-Type':'application/json'}});
 if(!res.ok)throw Error(res.status===404?'该岗位已不在官方职位索引中':'收藏操作失败，请重试');
 requestCache=null;
 dispatchEvent(new CustomEvent('hhba:saved-changed',{detail:{jobId,saved:save}}));
 return res.json();
}
