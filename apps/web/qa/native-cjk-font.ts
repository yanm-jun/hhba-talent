// A genuine embedded TrueType CJK font is generated from an OS font only in
// isolated GitHub CI. Neither the font nor test document ships in production.
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {patchPdfWithOriginalCjkFont} from '../src/services/resumePdfCjkFont.mjs';
import {verifyOriginalFontPdfPatch} from '../src/services/resumePdfNativeVerify.mjs';
if(import.meta.env.PROD)throw Error('Private QA Chinese font fixture must not ship');
GlobalWorkerOptions.workerSrc=workerUrl;
const host=document.getElementById('native-cjk-test')!;
async function main(){
 const response=await fetch('/qa/generated-cjk-original.pdf',{cache:'no-store'});
 if(!response.ok)throw Error('synthetic CJK font fixture was not generated');
 const original=new Uint8Array(await response.arrayBuffer());
 const patch=patchPdfWithOriginalCjkFont(original,'中国测试工作经历','工作经历中国测试');
 const proof=await verifyOriginalFontPdfPatch({
  originalBytes:original,editedBytes:patch.bytes,proof:patch.proof,
  getDocument,canvasFactory:()=>document.createElement('canvas')
 });
 if(proof.changedPixels<=8)throw Error('no actual CJK glyph raster change');
 host.dataset.font=proof.originalFont;
 host.dataset.changedPixels=String(proof.changedPixels);
 host.dataset.glyphProof=patch.proof.newGlyphs;
 host.textContent='中文原始字体不变，修改后的文字已经通过逐页校验。';
 const gallery=document.createElement('div');
 gallery.style.cssText='display:flex;flex-wrap:wrap;gap:15px;margin-top:16px';
 for(const [title,bytes] of [['原始中文 PDF',original],
                              ['同字体修改完成',patch.bytes]] as const){
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false});
  const doc=await task.promise;
  const page=await doc.getPage(1);
  const text=await page.getTextContent({includeMarkedContent:false});
  const content=text.items.filter((x:any)=>typeof x.str==='string')
   .map((x:any)=>x.str).join('');
  if(content!==(title==='原始中文 PDF'?'中国测试工作经历':'工作经历中国测试'))
   throw Error('unicode glyph extraction mismatch: '+content);
  const viewport=page.getViewport({scale:.7});
  const fig=document.createElement('figure');
  fig.style.cssText='margin:0;padding:10px;background:white;border:1px solid #e5e7eb';
  const cap=document.createElement('figcaption');cap.textContent=title;
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  canvas.style.cssText='display:block;max-width:100%;height:auto';
  await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
  fig.append(cap,canvas);gallery.append(fig);
  await task.destroy();
 }
 host.append(gallery);
 host.dataset.status='passed';
}
main().catch(e=>{host.dataset.status='failed';host.textContent='中文原字体测试失败：'+
 String(e instanceof Error?e.message:e);});
