import {getRealAuthToken,realAuthReady} from './realAuth';

type SavedWord={original:string;text:string;updated_at:string};
export type WordInspect={ok:boolean;editable_text:string[];saved?:SavedWord|null};
const messages:Record<string,string>={
 WORD_NOT_READY:'Word 原样式编辑暂未开放。',
 WORD_FONT_UNAVAILABLE:'原文件使用的字体在处理环境中不可用，为保留原样式，暂不修改这份简历。',
 WORD_FONT_UNVERIFIED:'无法确认原始字体，为避免改变排版，暂不修改这份简历。',
 WORD_LAYOUT_MOVED:'修改会影响原来的排版，请缩短文字或保留原文。',
 WORD_TEXT_NOT_VERIFIED:'暂时无法确认修改后的文字位置，请保留原文。',
 WORD_DB_NOT_READY:'Word 编辑暂时不可用。',
 WORD_DAILY_LIMIT:'今天的操作次数已达到上限。',
 WORD_NOT_EDITED:'请先修改并保存简历。',
 WORD_LAYOUT_NOT_VERIFIED:'修改后排版发生了变化，未保存此次修改。',
 WORD_EDIT_TOO_LONG:'这段文字放不下，请缩短后再保存。',
 WORD_EDIT_AMBIGUOUS:'无法确定原文位置，请换一段文字。',
 WORD_EDIT_UNSAFE:'这段修改暂时无法安全保存。',
 WORD_RENDER_FAILED:'暂时无法准确显示 Word 原始页面。',
 WORD_FILE_UNSUPPORTED:'暂时无法处理这份 Word 的原始样式。',
 SESSION_INVALID:'请重新登录。',
 RESUME_NOT_FOUND:'简历文件未找到。',
 FORBIDDEN:'无法访问此简历。',
 WORD_PROCESSING_UNAVAILABLE:'Word 处理暂时不可用。'
};
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function auth(){
 if(!realAuthReady)throw Error('请先登录。');
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录。');
 return token;
}
async function send(path:string,method:'GET'|'POST'='GET',data?:unknown,signal?:AbortSignal){
 let response;
 try{response=await fetch(path,{method,signal,cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+auth(),
   ...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})
 });}
 catch(error){if((error as Error)?.name==='AbortError')throw error;
  throw Error('网络连接失败，请重试。');}
 if(!response.ok){
  const payload=await response.json().catch(()=>null);
  throw Error(messages[payload?.error||'']||'这项操作暂时无法完成。');
 }
 return response;
}
function url(resumeId:string,action:string){
 if(!uid.test(resumeId))throw Error('简历文件无效。');
 return '/api/resume-word?action='+action+'&resume_id='+encodeURIComponent(resumeId);
}
export async function wordRendererReady(signal?:AbortSignal){
 try{
  const response=await send('/api/resume-word?action=status','GET',undefined,signal);
  return (await response.json()).enabled===true;
 }catch{return false;}
}
export async function wordEditableText(id:string,signal?:AbortSignal):Promise<WordInspect>{
 const response=await send(url(id,'inspect'),'GET',undefined,signal);
 return response.json();
}
export async function wordPreviewBytes(id:string,edited=false,signal?:AbortSignal){
 const response=await send(url(id,edited?'edited-preview':'preview'),'GET',undefined,signal);
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength<500||buffer.byteLength>12*1024*1024)
  throw Error('简历预览文件不完整。');
 return buffer;
}
export async function saveOriginalWordEdit(id:string,original:string,text:string){
 const response=await send('/api/resume-word','POST',{
  resume_id:id,original,text,confirmed_real:true,consent_word_processing:true
 });
 return response.json() as Promise<{ok:true;saved:true;page_count:number}>;
}
async function downloadVerifiedWordResult(id:string,format:'docx'|'pdf'){
 // Both files originate from the same saved, renderer-verified original DOCX.
 // A PDF is never edited in-place and no browser print-template is substituted.
 const response=await send(url(id,format==='pdf'?'download-pdf':'download'));
 const expected=format==='pdf'?'application/pdf':
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 if((response.headers.get('Content-Type')||'').split(';')[0].toLowerCase()!==expected)
  throw Error('下载格式不正确，请稍后重试。');
 const blob=await response.blob();
 if(blob.size<(format==='pdf'?500:100)||blob.size>(format==='pdf'?12:4)*1024*1024)
  throw Error('下载文件不完整。');
 const first=new Uint8Array(await blob.slice(0,8).arrayBuffer());
 const signature=format==='pdf'?[37,80,68,70,45]:[80,75,3,4];
 if(signature.some((byte,index)=>first[index]!==byte))
  throw Error('下载文件校验失败，请稍后重试。');
 const object=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=object;link.download='我的简历-已修改.'+format;
 link.hidden=true;document.body.appendChild(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(object),10000);}
}
export async function downloadOriginalWordEdited(id:string){
 return downloadVerifiedWordResult(id,'docx');
}
export async function downloadOriginalWordPdf(id:string){
 return downloadVerifiedWordResult(id,'pdf');
}
