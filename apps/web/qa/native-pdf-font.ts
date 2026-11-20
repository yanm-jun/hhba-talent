// Synthetic browser-only PDF; NEVER fed user resumes.
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {patchPdfWithOriginalFont} from '../src/services/resumePdfNativeFont.mjs';
import {verifyOriginalFontPdfPatch} from '../src/services/resumePdfNativeVerify.mjs';
if(import.meta.env.PROD)throw Error('QA fixture cannot ship to production');
GlobalWorkerOptions.workerSrc=workerUrl;
const source='HELLO WORLD',edited='HELLO THERE';
function pdf(){
 const stream='BT /F1 18 Tf 45 760 Td ('+source+') Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
 ];
 let raw='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(raw.length);raw+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=raw.length;
 raw+='xref\n0 6\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))raw+=String(off).padStart(10,'0')+' 00000 n \n';
 return new TextEncoder().encode(raw+'trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+xref+'\n%%EOF');
}
const host=document.getElementById('native-pdf-test')!;
async function main(){
 const original=pdf(),patch=patchPdfWithOriginalFont(original,source,edited);
 const proof=await verifyOriginalFontPdfPatch({
  originalBytes:original,editedBytes:patch.bytes,proof:patch.proof,
  getDocument,canvasFactory:()=>document.createElement('canvas')
 });
 host.dataset.status='passed';
 host.dataset.font=proof.originalFont;
 host.dataset.changedPixels=String(proof.changedPixels);
 host.textContent='原始 PDF 字体已验证：'+proof.originalFont+'；只有文字区域发生改变。';
 const examples=document.createElement('div');
 examples.style.cssText='display:flex;flex-wrap:wrap;gap:15px;margin-top:15px';
 for(const [name,data] of [['原文件',original],['原字体修改后',patch.bytes]] as const){
  const documentTask=getDocument({data:new Uint8Array(data),useSystemFonts:false});
  const doc=await documentTask.promise,pg=await doc.getPage(1),view=pg.getViewport({scale:.75});
  const wrap=document.createElement('figure');
  wrap.style.cssText='margin:0;background:white;border:1px solid #eee;padding:12px';
  const label=document.createElement('figcaption');label.textContent=name;
  const canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;
  canvas.style.cssText='max-width:100%;height:auto;display:block';
  await pg.render({canvas,canvasContext:canvas.getContext('2d')!,viewport:view}).promise;
  wrap.append(label,canvas);examples.append(wrap);await doc.destroy();
 }
 host.append(examples);
}
main().catch(err=>{host.dataset.status='failed';host.textContent='PDF 原字体验证失败：'+String(err?.message||err);});
