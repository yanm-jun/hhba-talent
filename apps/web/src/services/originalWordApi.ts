import {getRealAuthToken,realAuthReady} from './realAuth';
import {editOriginalDocxStrict,type DuplicateWordParagraph} from './resumeDocxPreserve.mjs';

type SavedWord={original:string;text:string;updated_at:string};
export type WordHistoryEntry={revision:number;original:string;text:string;updated_at:string;page_count:number|null;layout_verified?:boolean};
export type WordInspect={ok:boolean;editable_text:string[];paragraph_text?:string[];duplicate_paragraphs?:DuplicateWordParagraph[];saved?:SavedWord|null;revision:number;total_revisions:number;max_revisions:number|null;max_daily_edits?:number|null;history?:WordHistoryEntry[];layout_verified?:boolean;pdf_available?:boolean};
const messages:Record<string,string>={
 WORD_NOT_READY:'Word 原样式编辑暂未开放。',
 WORD_FONT_UNAVAILABLE:'原文件使用的字体在处理环境中不可用，为保留原样式，暂不修改这份简历。',
 WORD_FONT_UNVERIFIED:'无法确认原始字体，为避免改变排版，暂不修改这份简历。',
 WORD_LAYOUT_MOVED:'修改会影响原来的排版，请缩短文字或保留原文。',
 WORD_TEXT_NOT_VERIFIED:'暂时无法确认修改后的文字位置，请保留原文。',
 WORD_DB_NOT_READY:'Word 编辑暂时不可用。',
 WORD_DAILY_LIMIT:'今天的操作次数已达到上限。',
 WORD_NOT_EDITED:'请先修改并保存简历。',
 WORD_REVISION_CONFLICT:'这份 Word 已在另一个页面或设备修改，请刷新后再试。',
 WORD_REVISION_CORRUPT:'已保存版本未通过完整性检查，请保留原件并联系平台。',
 WORD_REVISION_LIMIT:'这份简历已达到安全修订次数上限，请下载最新 Word 并重新上传。',
 WORD_REVISION_LOCK_UNAVAILABLE:'暂时无法安全保存，请稍后再试。',
 WORD_LAYOUT_NOT_VERIFIED:'修改后排版发生了变化，未保存此次修改。',
 WORD_EDIT_TOO_LONG:'这段文字放不下，请缩短后再保存。',
 WORD_EDIT_AMBIGUOUS:'无法安全定位这段文字或新增段落，请核对 Word 结构。',
 WORD_EDIT_UNSAFE:'这段修改暂时无法安全保存。',
 WORD_RENDER_FAILED:'暂时无法准确显示 Word 原始页面。',
 WORD_PDF_NOT_READY:'当前版本尚未经过专业分页校验，可以先下载 Word，PDF 暂不可用。',
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
function scopedJobId(jobId?:string){
 if(jobId===undefined)return undefined;
 // Job IDs are never used directly as object keys; the server derives a
 // SHA-256 scope from exactly this value. Never silently fall back to the
 // unscoped vault when the selected job ID is invalid.
 if(typeof jobId!=='string'||jobId.length<1||jobId.length>512||
  jobId!==jobId.trim()||/[\u0000-\u001f\u007f]/.test(jobId))
  throw Error('目标岗位标识无效，请返回岗位列表重新选择。');
 return jobId;
}
function url(resumeId:string,action:string,jobId?:string){
 if(!uid.test(resumeId))throw Error('简历文件无效。');
 const job=scopedJobId(jobId);
 return '/api/resume-word?action='+action+'&resume_id='+encodeURIComponent(resumeId)+
  (job===undefined?'':'&job_id='+encodeURIComponent(job));
}
function jobPayload(jobId?:string){
 const id=scopedJobId(jobId);
 return id===undefined?{}:{job_id:id};
}
export type WordCapabilities={enabled:boolean;rendererEnabled:boolean;docxOnlyEnabled:boolean};
export async function wordEditingCapabilities(signal?:AbortSignal):Promise<WordCapabilities>{
 try{
  const response=await send('/api/resume-word?action=status','GET',undefined,signal);
  const body=await response.json();
  return {enabled:body.enabled===true,rendererEnabled:body.renderer_enabled===true,
   docxOnlyEnabled:body.docx_only_enabled===true};
 }catch{return {enabled:false,rendererEnabled:false,docxOnlyEnabled:false};}
}
export async function wordRendererReady(signal?:AbortSignal){
 return (await wordEditingCapabilities(signal)).enabled;
}
export async function wordEditableText(id:string,signal?:AbortSignal,jobId?:string):Promise<WordInspect>{
 const response=await send(url(id,'inspect',jobId),'GET',undefined,signal);
 return response.json();
}
export async function wordPreviewBytes(id:string,edited=false,signal?:AbortSignal,revision?:number,jobId?:string){
 const path=url(id,edited?'edited-preview':'preview',jobId)+
  (edited&&revision!==undefined?'&revision='+revision:'');
 const response=await send(path,'GET',undefined,signal);
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength<500||buffer.byteLength>12*1024*1024)
  throw Error('简历预览文件不完整。');
 return buffer;
}
export type SavedWordVersion={scope:string;jobLabel:string;revision:number;updatedAt:string;pdfAvailable:boolean};
export async function listSavedWordVersions(id:string,signal?:AbortSignal):Promise<SavedWordVersion[]>{
 const result:SavedWordVersion[]=[];let cursor:string|null=null;const seen=new Set<string>();
 do{
  const response=await send(url(id,'versions')+(cursor?'&cursor='+encodeURIComponent(cursor):''),'GET',undefined,signal);
  const page=await response.json() as {ok:boolean;items:SavedWordVersion[];nextCursor:string|null};
  if(!page.ok||!Array.isArray(page.items))throw Error('岗位简历列表读取失败。');
  result.push(...page.items);cursor=page.nextCursor;
  if(cursor){if(seen.has(cursor))throw Error('岗位简历列表未完整读取。');seen.add(cursor);}
 }while(cursor);
 return [...new Map(result.map(item=>[item.scope,item])).values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export type WordMutationResult={ok:true;saved:boolean;revision:number;total_revisions:number;
 page_count?:number|null;layout_verified?:boolean;pdf_available?:boolean};
export async function wordSourceBytes(id:string,revision:number,jobId?:string,signal?:AbortSignal){
 const response=await send(url(id,'source-docx',jobId)+'&revision='+revision,'GET',undefined,signal);
 if((response.headers.get('Content-Type')||'').split(';')[0].toLowerCase()!==
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  throw Error('Word 文件格式不正确，请重试。');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length<100||bytes.length>3*1024*1024||
  bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)
  throw Error('原 Word 文件不完整。');
 return bytes;
}
export async function saveOriginalWordEdit(id:string,original:string,text:string,expectedRevision=0,jobId?:string,occurrence?:number,occurrenceCount?:number,jobLabel?:string):Promise<WordMutationResult>{
 const capabilities=await wordEditingCapabilities();
 if(!capabilities.enabled)throw Error(messages.WORD_NOT_READY);
 let clientHash:undefined|string;
 if(!capabilities.rendererEnabled){
  // Browser performs the exact OOXML edit first, without an external document server.
  // The Cloudflare endpoint independently repeats and verifies the same patch
  // before publishing the private, job-scoped revision into R2.
  const source=await wordSourceBytes(id,expectedRevision,jobId);
  const patched=await editOriginalDocxStrict(source,[{original,text,occurrence,occurrenceCount}],{allowExpansion:true});
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(patched).buffer));
  clientHash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 }
 const response=await send('/api/resume-word','POST',{
  action:'edit',resume_id:id,...jobPayload(jobId),original,text,expected_revision:expectedRevision,
  ...(jobLabel?{job_label:jobLabel}:{}),
  ...(occurrence!==undefined?{occurrence,occurrenceCount}:{}),
  ...(clientHash?{client_docx_sha256:clientHash}:{}),
  confirmed_real:true,consent_word_processing:true
 });
 const result=await response.json() as WordMutationResult;
 if(result.ok)window.dispatchEvent(new Event('hhba:word-versions-changed'));
 return result;
}
export async function shiftOriginalWordRevision(id:string,action:'undo'|'redo',expectedRevision:number,jobId?:string):Promise<WordMutationResult>{
 const response=await send('/api/resume-word','POST',{
  action,resume_id:id,...jobPayload(jobId),expected_revision:expectedRevision,
  confirmed_real:true,consent_word_processing:true
 });
 const result=await response.json() as WordMutationResult;
 if(result.ok)window.dispatchEvent(new Event('hhba:word-versions-changed'));
 return result;
}
async function downloadVerifiedWordResult(id:string,format:'docx'|'pdf',jobId?:string,jobLabel?:string,revision?:number){
 // DOCX retains the original OOXML package. Only optional PDF originates from
 // trusted renderer verification; never substitute a browser print-template.
 if(revision!==undefined&&(!Number.isInteger(revision)||revision<=0))throw Error('当前 Word 版本尚未保存。');
 const response=await send(url(id,format==='pdf'?'download-pdf':'download',jobId)+(revision===undefined?'':'&revision='+revision));
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
 const safeJob=(jobLabel||'岗位专属版').replace(/[<>:"\/\\|?*\u0000-\u001f]/g,'')
  .replace(/\s+/g,' ').trim().slice(0,64)||'岗位专属版';
 link.href=object;link.download=(jobId===undefined?'我的简历-已修改':
  '我的简历-'+safeJob+'-已优化')+'.'+format;
 link.hidden=true;document.body.appendChild(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(object),10000);}
}
export async function downloadOriginalWordEdited(id:string,jobId?:string,jobLabel?:string,revision?:number){
 return downloadVerifiedWordResult(id,'docx',jobId,jobLabel,revision);
}
export async function downloadOriginalWordPdf(id:string,jobId?:string,jobLabel?:string,revision?:number){
 return downloadVerifiedWordResult(id,'pdf',jobId,jobLabel,revision);
}
