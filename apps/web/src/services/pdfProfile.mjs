// HHBA user-triggered, browser-local PDF text extraction using pinned
// Mozilla PDF.js. Nothing is sent to AI, third-party CDNs, or the extension.
// Parser and worker are bundled as first-party assets by Vite.
export const PDF_MAX_BYTES=3*1024*1024;
export const PDF_MAX_PAGES=15;
export const PDF_MAX_TEXT=50000;
export class PDFResumeError extends Error{
 constructor(code,message){super(message);this.code=code;this.name="PDFResumeError";}
}
export function assertPdfBytes(buffer,{unbounded=false}={}){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<32||
  (!unbounded&&buffer.byteLength>PDF_MAX_BYTES))throw new PDFResumeError("PDF_SIZE","PDF 文件大小必须在 3 MB 以内。");
 const bytes=new Uint8Array(buffer,0,Math.min(1024,buffer.byteLength));
 let header=false;
 for(let i=0;i<=bytes.length-5;i++){
  if(bytes[i]===37&&bytes[i+1]===80&&bytes[i+2]===68&&bytes[i+3]===70&&bytes[i+4]===45){header=true;break;}
 }
 if(!header)throw new PDFResumeError("PDF_HEADER","文件不是有效的 PDF，请从原始编辑器重新导出。");
}
const normalized=s=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/\s+/g," ").trim();
/** Preserve lines using PDF.js text item order and line positions.
 * Text evidence is presented for manual correction, never trusted as identity.
 */
export function pdfTextItemsToLines(items,{unbounded=false}={}){
 if(!Array.isArray(items))return [];
 const result=[];let line="",lastY=null;
 const flush=()=>{const value=normalized(line);if(value)result.push(value);line="";lastY=null;};
 for(const item of items){
  if(!item||typeof item.str!=="string")continue;
  const chunk=item.str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").trim();
  const y=Array.isArray(item.transform)&&Number.isFinite(item.transform[5])?item.transform[5]:null;
  if(chunk&&line&&y!==null&&lastY!==null&&Math.abs(y-lastY)>3)flush();
  if(chunk){
   if(line&&/[A-Za-z0-9]$/.test(line)&&/^[A-Za-z0-9]/.test(chunk))line+=" ";
   line+=chunk;
   if(y!==null)lastY=y;
  }
  if(item.hasEOL)flush();
  if(!unbounded&&result.join("\n").length>PDF_MAX_TEXT)
   throw new PDFResumeError("PDF_TEXT_LIMIT","PDF 可复制文字过长，请精简简历后重试。");
 }
 flush();
 return result;
}
async function firstPartyPdfJs(){
 // No dynamic remote script, CDN URL or user-controlled worker address.
 const [pdf,worker]=await Promise.all([
  import("pdfjs-dist/build/pdf.mjs"),
  import("pdfjs-dist/build/pdf.worker.min.mjs?url")
 ]);
 pdf.GlobalWorkerOptions.workerSrc=worker.default;
 return pdf;
}
function translatePDFError(e){
 if(e instanceof PDFResumeError)return e;
 const name=String(e?.name||"");
 if(name==="PasswordException")return new PDFResumeError("PDF_PASSWORD","这份 PDF 需要密码，请先解锁后重新上传。");
 if(name==="InvalidPDFException"||name==="MissingPDFException"||name==="UnexpectedResponseException")
  return new PDFResumeError("PDF_INVALID","PDF 文件已损坏或格式不受支持，请重新导出。");
 if(name==="AbortError")return e;
 return new PDFResumeError("PDF_FAILED","PDF 本地解析失败，请更换可复制文字的 PDF，或手动核对信息。");
}
function abortError(){const err=new Error("本次 PDF 提取已取消。");err.name="AbortError";return err;}
/** The injected loadPdfJs is only for unit tests; production always uses
 * firstPartyPdfJs, bundled locally. All work has an overall bounded timeout.
 */
export async function extractPdfText(buffer,{signal,loadPdfJs=firstPartyPdfJs,unbounded=false}={}){
 assertPdfBytes(buffer,{unbounded});
 if(signal?.aborted)throw abortError();
 let task=null,expired=false;
 const abort=()=>{if(task)void task.destroy().catch(()=>{});};
 if(signal)signal.addEventListener("abort",abort,{once:true});
 const timer=unbounded?undefined:setTimeout(()=>{expired=true;abort();},15000);
 try{
  const pdf=await loadPdfJs();
  if(expired)throw new PDFResumeError("PDF_TIMEOUT","PDF 处理超时，请导出更简洁的文字版 PDF。");
  if(signal?.aborted)throw abortError();
  // Transfer a copy to avoid reusing detached buffers. Disable PDF scripting
  // (CVE-2026-16633 defense in depth) and dynamic code evaluation.
  task=pdf.getDocument({
   data:new Uint8Array(buffer.slice(0)),
   enableScripting:false,
   isEvalSupported:false,
   enableXfa:false,
   disableAutoFetch:true,
   disableStream:true,
   stopAtErrors:true,
   useSystemFonts:false
  });
  const document=await task.promise;
  if(expired)throw new PDFResumeError("PDF_TIMEOUT","PDF 处理超时，请导出更简洁的文字版 PDF。");
  if(signal?.aborted)throw abortError();
  if(!Number.isInteger(document.numPages)||document.numPages<1||
    (!unbounded&&document.numPages>PDF_MAX_PAGES))
   throw new PDFResumeError("PDF_PAGES","PDF 简历最多支持 15 页，请精简后重试。");
  const pages=[];let chars=0,hasTextlessPages=false;
  for(let n=1;n<=document.numPages;n++){
   if(expired)throw new PDFResumeError("PDF_TIMEOUT","PDF 处理超时，请导出更简洁的文字版 PDF。");
   if(signal?.aborted)throw abortError();
   const page=await document.getPage(n);
   const content=await page.getTextContent({includeMarkedContent:false});
   const contentLines=pdfTextItemsToLines(content.items,{unbounded});
   const text=contentLines.join("\n");
   if(text.replace(/\s/g,"").length<12)hasTextlessPages=true;
   chars+=text.length;
   if(!unbounded&&chars>PDF_MAX_TEXT)throw new PDFResumeError("PDF_TEXT_LIMIT","PDF 文字超过安全提取上限，请精简后重试。");
   if(text)pages.push(text);
   page.cleanup?.();
  }
  const extracted=pages.join("\n");
  if(extracted.replace(/\s/g,"").length<12)
   throw new PDFResumeError("PDF_NO_TEXT","这份 PDF 未发现足够的可复制文字，可能是扫描件。请使用文字版 PDF，或改为手动填写后同步。");
  return {text:extracted,pages:document.numPages,characters:chars,hasTextlessPages};
 }catch(e){
  if(expired)throw new PDFResumeError("PDF_TIMEOUT","PDF 处理超时，请导出更简洁的文字版 PDF。");
  if(signal?.aborted)throw abortError();
  throw translatePDFError(e);
 }finally{
  clearTimeout(timer);
  if(signal)signal.removeEventListener("abort",abort);
  if(task)await task.destroy().catch(()=>{});
 }
}


// The caller must obtain explicit visual-processing consent before using this
// path. Render and release one page at a time, never rasterize the entire PDF
// in memory. Pixel budget protects browser memory, not document page count.
export async function readPdfVisualPages(buffer,{signal,onPage,loadPdfJs=firstPartyPdfJs,createCanvas=()=>document.createElement('canvas')}={}){
 assertPdfBytes(buffer,{unbounded:true});
 if(typeof onPage!=='function')throw Error('PDF_PAGE_HANDLER_REQUIRED');
 if(signal?.aborted)throw abortError();
 let task,renderTask;
 const abort=()=>{try{renderTask?.cancel()}catch{}if(task)void task.destroy().catch(()=>{});};
 signal?.addEventListener('abort',abort,{once:true});
 const canvasBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PDF_PAGE_RENDER_FAILED')),'image/jpeg',0.92));
 try{
  const pdf=await loadPdfJs();
  task=pdf.getDocument({data:new Uint8Array(buffer.slice(0)),enableScripting:false,isEvalSupported:false,enableXfa:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true,useSystemFonts:false});
  const doc=await task.promise;
  if(!Number.isInteger(doc.numPages)||doc.numPages<1)throw Error('PDF_INVALID');
  for(let number=1;number<=doc.numPages;number++){
   if(signal?.aborted)throw abortError();
   const page=await doc.getPage(number);
   let localText='',canvas;
   try{
    const content=await page.getTextContent({includeMarkedContent:false});
    localText=pdfTextItemsToLines(content.items,{unbounded:true}).join('\n');
    const base=page.getViewport({scale:1});
    let scale=Math.min(2.5,Math.sqrt(6000000/Math.max(1,base.width*base.height)));
    canvas=createCanvas();
    let blob;
    for(;;){
     if(signal?.aborted)throw abortError();
     const viewport=page.getViewport({scale});
     canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
     renderTask=page.render({canvas,canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'#ffffff'});
     await renderTask.promise;renderTask=null;
     blob=await canvasBlob(canvas);
     if(blob.size<=3*1024*1024)break;
     if(canvas.width<=1&&canvas.height<=1)throw Error('PDF_PAGE_IMAGE_TOO_LARGE');
     scale*=0.75;
    }
    // OCR may return partial text. The callback can request smaller visual
    // tiles of this same page without asking the user to upload again.
    const tiles=async()=>{
     const result=[];
     for(const [start,end] of [[0,Math.floor(canvas.height/2)],[Math.floor(canvas.height/2),canvas.height]]){
      if(end<=start)continue;
      const tile=createCanvas();tile.width=canvas.width;tile.height=end-start;
      try{tile.getContext('2d',{alpha:false}).drawImage(canvas,0,start,canvas.width,end-start,0,0,tile.width,tile.height);result.push(await canvasBlob(tile));}
      finally{tile.width=tile.height=0;}
     }
     return result;
    };
    await onPage({number,total:doc.numPages,localText,blob,tiles});
   }catch(e){
    if(signal?.aborted)throw abortError();
    // Preserve extracted text and report page failure; don't skip it silently.
    await onPage({number,total:doc.numPages,localText,blob:null,error:true});
   }finally{if(canvas)canvas.width=canvas.height=0;page.cleanup?.();}
  }
 }finally{signal?.removeEventListener('abort',abort);if(task)await task.destroy().catch(()=>{});}
}
