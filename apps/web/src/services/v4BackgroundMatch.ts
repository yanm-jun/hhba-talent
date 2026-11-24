import {getRealAuthToken} from './realAuth';
export type BackgroundState={id:string;state:'UPLOADING'|'QUEUED'|'RUNNING'|'PAUSED'|'COMPLETE'|'CANCELLED';phase:string;uploaded_parts:number;research_round:number;error:string|null};
const base='/api/match-background';
export async function backgroundMatchAvailable(signal?:AbortSignal){try{const r=await fetch(base+'/status',{cache:'no-store',signal});return r.ok&&(await r.json()).enabled===true;}catch{return false;}}
async function request(path:string,method='GET',body?:string,signal?:AbortSignal,plain=false){
 const token=getRealAuthToken();if(!token)throw Error('请先登录。');
 const r=await fetch(base+path,{method,cache:'no-store',credentials:'same-origin',signal,headers:{Authorization:'Bearer '+token,...(body!==undefined?{'Content-Type':plain?'text/plain; charset=utf-8':'application/json'}:{})},...(body!==undefined?{body}:{})});
 const data=await r.json().catch(()=>({}));if(!r.ok||data.ok!==true)throw Error('后台任务暂未完成：'+String(data.error||r.status));
 return data;
}
// Split on Unicode boundaries and prefer paragraph boundaries. The 128k
// characters are a transport unit only, not a document or AI-work cap.
export function* backgroundTextParts(text:string){
 let at=0;
 while(at<text.length){
  let end=Math.min(text.length,at+128000);
  if(end<text.length){const newline=text.lastIndexOf('\n',end);if(newline>at+64000)end=newline+1;if(/[\uDC00-\uDFFF]/.test(text[end]||''))end--;}
  const part=text.slice(at,end);at=end;if(part.trim())yield part;
 }
}
export async function startBackgroundMatch(text:string,role:string,resumeId:string|undefined,signal?:AbortSignal):Promise<BackgroundState>{
 const id=crypto.randomUUID();
 await request('/start','POST',JSON.stringify({id,consent:true,consent_background_storage:true,country:'CN',role_hint:role,resume_id:resumeId||null}),signal);
 try{
  let index=0;
  for(const part of backgroundTextParts(text)){
   await request('/'+id+'/parts/'+index,'PUT',part,signal,true);index++;
  }
  const result=await request('/'+id+'/queue','POST',JSON.stringify({parts:index}),signal);
  return result.task as BackgroundState;
 }catch(e){await request('/'+id+'/cancel','POST').catch(()=>{});throw e;}
}
export async function getBackgroundMatch(id:string):Promise<BackgroundState|null>{try{return (await request('/'+id)).task as BackgroundState;}catch{return null;}}
export async function cancelBackgroundMatch(id:string){await request('/'+id+'/cancel','POST');}
export async function resumeBackgroundMatch(id:string){await request('/'+id+'/resume','POST');}
