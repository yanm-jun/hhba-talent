import {RESUME_LIMIT_BYTES,DOCX_MIME,validateResumeBytes} from './private-resume-validation.js';
import {MAX_TEXT_LENGTH,redactForModel} from './resume-match-core.js';

export const OCR_CONSENT='deepseek-resume-ocr-v1';
const OCR_URL='https://api.deepseek.com/v1/tools/ocr';
const OCR_RESPONSE_LIMIT=2*1024*1024;
const formats=new Map([
 ['pdf','application/pdf'],['docx',DOCX_MIME],['jpg','image/jpeg'],
 ['png','image/png'],['webp','image/webp']
]);
const failure=(code,status)=>Object.assign(new Error(code),{code,status});
const hasPrefix=(data,...prefix)=>prefix.every((byte,i)=>data[i]===byte);

async function readBytes(message,limit,error){
 const declared=message.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))throw error;
 if(!message.body)throw error;
 const reader=message.body.getReader(),chunks=[];
 let size=0;
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.length;
   if(size>limit){await reader.cancel();throw error;}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return bytes;
}

function validateFile(bytes,format){
 if(bytes.length<30)throw failure('OCR_INVALID_FILE',400);
 if(format==='pdf'||format==='docx'){
  try{validateResumeBytes(bytes,'resume.'+format);}
  catch{throw failure('OCR_INVALID_FILE',400);}
 }else{
  const valid=format==='png'?hasPrefix(bytes,137,80,78,71,13,10,26,10):
   format==='jpg'?hasPrefix(bytes,255,216,255):
   hasPrefix(bytes,82,73,70,70)&&hasPrefix(bytes.subarray(8),87,69,66,80);
  if(!valid)throw failure('OCR_INVALID_FILE',400);
 }
}

export async function recognizeResumeFile(request,key,fetcher=fetch){
 if(request.headers.get('X-HHBA-OCR-Consent')!==OCR_CONSENT)
  throw failure('OCR_CONSENT_REQUIRED',400);
 const format=request.headers.get('X-HHBA-Resume-Format');
 const mime=formats.get(format);
 if(!mime||request.headers.get('Content-Type')!=='application/octet-stream')
  throw failure('OCR_UNSUPPORTED_FORMAT',415);
 const bytes=await readBytes(request,RESUME_LIMIT_BYTES,failure('OCR_FILE_TOO_LARGE',413));
 validateFile(bytes,format);
 const purpose=format==='docx'?'rich_layout_recognition':'text_recognition';
 const body=new FormData();
 body.set('purpose',purpose);
 body.set('file',new Blob([bytes],{type:mime}),'resume.'+format);
 const timeout=AbortSignal.timeout(180000);
 let data;
 try{
  const response=await fetcher(OCR_URL,{method:'POST',redirect:'manual',
   signal:AbortSignal.any([request.signal,timeout]),headers:{Authorization:'Bearer '+key},body});
  if(!response.ok){
   if(response.status===429)throw failure('OCR_BUSY',429);
   if(response.status===408||response.status===504)throw failure('OCR_TIMEOUT',504);
   if([400,413,415,422].includes(response.status))throw failure('OCR_INVALID_FILE',422);
   throw failure('OCR_SERVICE_UNAVAILABLE',502);
  }
  const raw=await readBytes(response,OCR_RESPONSE_LIMIT,failure('OCR_RESPONSE_INVALID',502));
  data=JSON.parse(new TextDecoder().decode(raw));
 }catch(error){
  if(error?.status)throw error;
  throw failure(timeout.aborted?'OCR_TIMEOUT':'OCR_SERVICE_UNAVAILABLE',timeout.aborted?504:502);
 }
 if(data?.object!=='ocr.result'||data.purpose!==purpose||!Array.isArray(data.pages)||
  !data.pages.length||data.page_count!==data.pages.length||data.pages.length>15||
  data.pages.some((page,index)=>page?.index!==index||typeof page.text!=='string'||
   !['stop','length'].includes(page.finish_reason)))
  throw failure(data?.pages?.length>15?'OCR_TOO_MANY_PAGES':'OCR_RESPONSE_INVALID',422);
 const pages=data.pages.map(page=>page.text
  .replace(/<[|｜]box[|｜]>\s*\[\[[\d,\s\[\].-]+\]\]\s*<(?:[|｜]\/|\/[|｜])box[|｜]>/gi,'')
  .replace(/<\/?[|｜]\/?(?:ref|box|det|grounding)[|｜]>/gi,'')
  .trim());
 const fullText=pages.join('\n\n');
 const text=redactForModel(fullText);
 if(!text.replace(/\s/g,''))throw failure('OCR_NO_TEXT',422);
 return {text,partial:fullText.length>MAX_TEXT_LENGTH||data.pages.some(page=>page.finish_reason==='length')};
}
