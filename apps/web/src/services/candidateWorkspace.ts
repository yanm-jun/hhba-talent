import {getRealAuthToken,realAuthReady} from './realAuth';

export type CandidateWorkspaceProfile={
 display_name:string;headline:string;city:string;intro:string;skills:string;
 preferred_role:string;preferred_city:string;work_mode:'不限'|'远程'|'现场'|'混合办公';
};
export const realWorkspaceAvailable=realAuthReady && import.meta.env.BASE_URL!=='/hhba-talent/';
const empty:CandidateWorkspaceProfile={
 display_name:'',headline:'',city:'',intro:'',skills:'',
 preferred_role:'',preferred_city:'',work_mode:'不限',
};
async function request<T>(path:string,method='GET',payload?:unknown):Promise<T>{
 if(!realWorkspaceAvailable)throw Error('真实账户服务尚未在此预览环境开放');
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录真实账户');
 const response=await fetch('/api/account'+path,{
  method,credentials:'same-origin',cache:'no-store',
  headers:{'Authorization':'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 if(!response.ok){
  const error=await response.json().catch(()=>null) as {error?:string}|null;
  if(response.status===401)throw Error('登录状态已失效，请重新登录');
  if(response.status===403)throw Error('当前账户没有权限');
  if(error?.error==='INVALID_ACCOUNT_FIELDS')throw Error('资料格式不符合要求，请检查字数');
  throw Error('真实账户服务暂不可用，请稍后重试');
 }
 return response.json() as Promise<T>;
}
export async function getCandidateWorkspaceProfile():Promise<CandidateWorkspaceProfile>{
 const payload=await request<{ok:boolean;data:CandidateWorkspaceProfile}>('/profile');
 if(!payload.ok||!payload.data)throw Error('真实账户资料响应无效');
 return {...empty,...payload.data};
}
export function saveCandidateWorkspaceProfile(data:Pick<CandidateWorkspaceProfile,'display_name'|'headline'|'city'|'intro'|'skills'>){
 return request<{ok:boolean}>('/profile','PUT',data);
}
export function saveCandidateWorkspacePreferences(data:Pick<CandidateWorkspaceProfile,'preferred_role'|'preferred_city'|'work_mode'>){
 return request<{ok:boolean}>('/preferences','PUT',data);
}
