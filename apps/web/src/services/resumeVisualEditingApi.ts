import {getRealAuthToken,realAuthReady} from './realAuth';

export type VisualResumeRegion={
 id:string;page:number;bbox:[number,number,number,number];kind:string;text:string;
 confidence:number|null;placement_verified:false;
};
export type VisualResumeLayout={
 schema:'HHBA_RESUME_VISUAL_LAYOUT_V1';source_sha256:string;format:'pdf';
 page_count:number;regions:VisualResumeRegion[];needs_review:true;
 editable_in_original:false;warning:string;
};
export type PageResumeEdit={
 id:string;original:string;text:string;confirmed:true;page?:number;
};
const messages:Record<string,string>={
 SESSION_INVALID:'请重新登录后继续。',
 FORBIDDEN:'无法使用这份简历。',
 RESUME_NOT_FOUND:'找不到这份简历，请重新选择。',
 VISUAL_LAYOUT_DISABLED:'这项功能暂时没有开放。',
 VISION_PROVIDER_TIMEOUT:'处理时间过长，请稍后再试。',
 VISION_PROVIDER_RATE_LIMITED:'当前使用人数较多，请稍后再试。',
 VISUAL_LAYOUT_DAILY_LIMIT:'今天的使用次数已达到上限。',
 VISION_RESPONSE_INVALID:'这份简历暂时无法准确定位文字。',
 WORD_VISUAL_RENDERER_NOT_READY:'这份 Word 暂时只能查看，不能在原文件位置修改。',
 LAYOUT_NOT_READY:'请先打开并检查这份简历。',
 EDITS_STALE:'这份简历已经变化，请重新打开。',
 INVALID_CHANGES:'修改内容未通过检查，请重新确认。',
 EDITS_UNAVAILABLE:'修改暂时无法保存，请重试。'
};
function bearer(){
 if(!realAuthReady)throw Error('请先登录 HHBA。');
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录 HHBA。');
 return token;
}
async function call<T>(path:string,method:'GET'|'POST'|'DELETE',data?:unknown,signal?:AbortSignal):Promise<T>{
 let response:Response;
 try{
  response=await fetch(path,{
   method,signal,cache:'no-store',credentials:'same-origin',
   headers:{
    Authorization:'Bearer '+bearer(),
    ...(data?{'Content-Type':'application/json'}:{})
   },...(data?{body:JSON.stringify(data)}:{})
  });
 }catch(error){
  if((error as Error)?.name==='AbortError')throw error;
  throw Error('网络连接失败，请重试。');
 }
 const json=await response.json().catch(()=>null) as (T&{error?:string})|null;
 if(!response.ok)throw Error(messages[json?.error||'']||'这项操作暂时无法完成。');
 return json as T;
}
export async function visualEditingReady(signal?:AbortSignal):Promise<boolean>{
 try{
  const status=await call<{enabled:boolean;formats:string[]}>(
   '/api/resume-layout','GET',undefined,signal);
  return status.enabled===true&&status.formats.includes('pdf');
 }catch{return false;}
}
export async function analyzeVisualResume(resumeId:string,signal?:AbortSignal){
 return call<{ok:boolean;cached:boolean;layout:VisualResumeLayout}>(
  '/api/resume-layout','POST',{resume_id:resumeId,consent_ai_vision:true},signal);
}
export async function listPageResumeEdits(resumeId:string,signal?:AbortSignal){
 return call<{ok:boolean;changes:PageResumeEdit[]}>(
  '/api/resume-page-edits?resume_id='+encodeURIComponent(resumeId),
  'GET',undefined,signal);
}
export async function savePageResumeEdits(resumeId:string,changes:PageResumeEdit[]){
 return call<{ok:boolean;changes:PageResumeEdit[];updated_at:string}>(
  '/api/resume-page-edits','POST',{
   resume_id:resumeId,confirmed_real:true,
   changes:changes.map(x=>({id:x.id,original:x.original,text:x.text,confirmed:true}))
  });
}
export async function removePageResumeEdits(resumeId:string){
 return call<{ok:boolean;deleted:boolean}>(
  '/api/resume-page-edits?resume_id='+encodeURIComponent(resumeId),'DELETE');
}
