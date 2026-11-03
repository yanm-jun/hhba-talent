import {getRealAuthToken,realAuthReady} from './realAuth';

export const privateResumeAvailable=realAuthReady&&import.meta.env.BASE_URL!=='/hhba-talent/';
export const PRIVATE_RESUME_LIMIT=3*1024*1024;
export type PrivateResume={
 id:string;name:string;type:string;size:number;createdAt:string;
};
const API='/api/resumes';
const errors:Record<string,string>={
 SESSION_INVALID:'登录已失效，请重新登录。',
 PRIVATE_STORAGE_NOT_ENABLED:'简历私有存储尚未启用。管理员需先在 Cloudflare 开通 R2。',
 ACCOUNT_DATABASE_NOT_CONNECTED:'账户数据库暂未连接。',
 STORAGE_CONSENT_REQUIRED:'请先确认本次简历私有存储授权。',
 INVALID_FILENAME:'文件名不符合要求，请使用名称正常的 PDF 或 DOCX。',
 INVALID_RESUME_SIZE:'文件大小须在 3 MB 以内。',
 INVALID_PDF_CONTAINER:'PDF 文件格式异常，请重新导出后上传。',
 INVALID_DOCX_CONTAINER:'DOCX 文件结构异常，请重新导出后上传。',
 UNSAFE_DOCX_CONTENT:'DOCX 包含宏、嵌入组件或不安全内容，请移除后重试。',
 DOCX_EXPANSION_LIMIT:'文档解压后内容过大，请精简后重试。',
 FILE_TYPE_MISMATCH:'文件格式与声明类型不一致。',
 RESUME_ALREADY_EXISTS:'这份简历已经保存在当前账户。',
 RESUME_ALREADY_EXISTS_OR_LIMIT:'这份文件已存在，或当前账户最多保存 3 份简历。',
 RESUME_LIMIT_REACHED:'当前账户最多保存 3 份简历，请先删除旧文件。',
 UPLOAD_RATE_LIMITED:'近 24 小时上传次数达到上限，请稍后重试。',
 RESUME_NOT_FOUND:'简历不存在或当前账户没有访问权限。',
 ORIGIN_REQUIRED:'请求来源不符合安全要求。',
};
function token(){
 if(!privateResumeAvailable)throw Error('该环境暂未开放真实简历功能。');
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录真实求职者账户。');
 return token;
}
async function request(path:string,method:string,body?:File,consent=false){
 const session=token();
 const headers:Record<string,string>={Authorization:'Bearer '+session};
 if(body){
  headers['Content-Type']=body.type||'application/octet-stream';
  headers['X-HHBA-Resume-Name']=encodeURIComponent(body.name);
  if(consent)headers['X-HHBA-Storage-Consent']='private-resume-storage-v1';
 }
 const res=await fetch(API+path,{
  method,headers,body:body||undefined,credentials:'same-origin',cache:'no-store',
 });
 if(!res.ok){
  const error=await res.json().catch(()=>null) as {error?:string}|null;
  throw Error(errors[error?.error||'']||(res.status===401?
   '登录已失效，请重新登录。':'私有简历服务暂时不可用，请稍后重试。'));
 }
 return res;
}
export async function listPrivateResumes():Promise<PrivateResume[]>{
 const res=await request('','GET');
 const data=await res.json() as {kind?:string;items?:PrivateResume[]};
 if(data.kind!=='HHBA_PRIVATE_RESUME_VAULT_V1'||!Array.isArray(data.items))
  throw Error('简历列表响应异常。');
 return data.items;
}
export async function uploadPrivateResume(file:File,consent:boolean):Promise<void>{
 if(!consent)throw Error('请先确认本次简历私有存储授权。');
 if(!/\.(pdf|docx)$/i.test(file.name)||file.size<30||file.size>PRIVATE_RESUME_LIMIT)
  throw Error('请使用 3 MB 以内的 PDF 或 DOCX 简历。');
 await request('','POST',file,true);
}
export async function deletePrivateResume(id:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/.test(id))throw Error('简历标识无效。');
 await request('/'+id,'DELETE');
}
export async function downloadPrivateResume(resume:PrivateResume):Promise<void>{
 if(!/^[0-9a-f-]{36}$/.test(resume.id))throw Error('简历标识无效。');
 const res=await request('/'+resume.id+'/download','GET');
 const blob=await res.blob();
 const temp=URL.createObjectURL(blob);
 try{
  const a=document.createElement('a');
  a.href=temp;a.download=resume.name;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
 }finally{window.setTimeout(()=>URL.revokeObjectURL(temp),10000);}
}
