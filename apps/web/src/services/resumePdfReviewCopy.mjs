// HHBA on-device visual PDF REVIEW export; never mistake this for an ATS-ready
// text PDF. Each page is rasterized, removing hidden original source text from
// the exported PDF (though the unchanged original stays privately stored).
// Unsupported or unsafe edits cause a full failure, never a partial export.
import {matchVisualRegionsToPdfPage} from './resumeVisualAnchors.mjs';
import {planInlinePdfPreview,whitePdfPatchBackground} from './resumeInlinePdfPreview.mjs';

const LIMIT_PAGES=12;
const LIMIT_JPEG_BYTES=28*1024*1024;
const te=new TextEncoder();
const b=(text)=>te.encode(text);
const ensure=(condition,code)=>{if(!condition)throw Error(code)};
function pageBytes(value){
 return value instanceof Uint8Array?value:new Uint8Array(value);
}
function concat(chunks,total){
 const out=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}
 return out;
}
// Standalone ISO PDF-1.4 writer, using one JPEG XObject per original page.
// The page images contain only the *visible* edited result, so no source text
// is accidentally hidden inside PDF content streams.
export function buildRasterReviewPdf(pages){
 ensure(Array.isArray(pages)&&pages.length>0&&pages.length<=LIMIT_PAGES,'REVIEW_PAGE_LIMIT');
 let total=0;
 for(const page of pages){
  const jpeg=pageBytes(page?.jpeg);
  ensure(jpeg.byteLength>100&&jpeg[0]===0xff&&jpeg[1]===0xd8&&
   jpeg[jpeg.byteLength-2]===0xff&&jpeg[jpeg.byteLength-1]===0xd9,
   'REVIEW_IMAGE_INVALID');
  ensure([page.width,page.height,page.pageWidth,page.pageHeight].every(v=>
   Number.isFinite(v)&&v>0&&v<10000)&&Number.isInteger(page.width)&&
   Number.isInteger(page.height),'REVIEW_SIZE_INVALID');
  total+=jpeg.byteLength;
  ensure(total<=LIMIT_JPEG_BYTES,'REVIEW_TOO_LARGE');
 }
 const chunks=[],offsets=[0];let position=0;
 const write=(bytes)=>{chunks.push(bytes);position+=bytes.length};
 const writeText=(value)=>write(b(value));
 function object(id,parts){
  offsets[id]=position;
  writeText(id+' 0 obj\n');
  for(const part of parts)write(typeof part==='string'?b(part):part);
  writeText('\nendobj\n');
 }
 const n=pages.length,count=2+3*n;
 writeText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
 object(2,['<< /Type /Pages /Count '+n+' /Kids ['+
  pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>']);
 for(let index=0;index<n;index++){
  const item=pages[index],jpeg=pageBytes(item.jpeg);
  const pageId=3+3*index,streamId=pageId+1,imageId=pageId+2;
  const pw=Number(item.pageWidth.toFixed(2)),ph=Number(item.pageHeight.toFixed(2));
  object(pageId,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+
   '] /Resources << /XObject << /Im0 '+imageId+' 0 R >> >> /Contents '+streamId+' 0 R >>']);
  const commands='q\n'+pw+' 0 0 '+ph+' 0 0 cm\n/Im0 Do\nQ\n';
  object(streamId,['<< /Length '+b(commands).length+' >>\nstream\n',commands,'endstream']);
  object(imageId,['<< /Type /XObject /Subtype /Image /Width '+item.width+
   ' /Height '+item.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8'+
   ' /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n',jpeg,'\nendstream']);
 }
 const start=position;
 writeText('xref\n0 '+(count+1)+'\n0000000000 65535 f \n');
 for(let id=1;id<=count;id++)writeText(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 writeText('trailer\n<< /Size '+(count+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n');
 return concat(chunks,position);
}
function toJpeg(canvas){
 return new Promise((resolve,reject)=>{
  try{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('REVIEW_RENDER_FAILED')),
   'image/jpeg',.9);
  }catch{reject(Error('REVIEW_RENDER_FAILED'));}
 });
}
export async function createOriginalPdfReviewCopy({
 document:source,layout,changes,signal,onPage,
 canvasFactory=()=>document.createElement('canvas')
}){
 ensure(source&&Number.isInteger(source.numPages)&&source.numPages>0&&
  source.numPages<=LIMIT_PAGES,'REVIEW_PAGE_LIMIT');
 ensure(layout?.schema==='HHBA_RESUME_VISUAL_LAYOUT_V1'&&
  layout.page_count===source.numPages&&Array.isArray(layout.regions),
  'REVIEW_LAYOUT_NOT_READY');
 ensure(Array.isArray(changes)&&changes.length>0&&changes.length<=60,'REVIEW_NOT_EDITED');
 const regionById=new Map(layout.regions.map(r=>[r.id,r]));
 const seen=new Set();
 for(const change of changes){
  const sourceRegion=regionById.get(change?.id);
  ensure(sourceRegion&&change.confirmed===true&&
   change.original===sourceRegion.text&&
   typeof change.text==='string'&&change.text.trim().length>1&&
   !seen.has(change.id),'REVIEW_EDITS_UNSAFE');
  seen.add(change.id);
 }
 const pages=[];let total=0,applied=0;
 for(let n=1;n<=source.numPages;n++){
  ensure(!signal?.aborted,'REVIEW_CANCELLED');
  const page=await source.getPage(n);
  const original=page.getViewport({scale:1});
  const pixelBudget=2_400_000;
  const scale=Math.min(1.85,Math.sqrt(pixelBudget/(original.width*original.height)));
  const viewport=page.getViewport({scale});
  const canvas=canvasFactory();
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ensure(ctx,'REVIEW_RENDER_FAILED');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const task=page.render({canvas,canvasContext:ctx,viewport});
  try{await task.promise;}catch{throw Error('REVIEW_RENDER_FAILED');}
  ensure(!signal?.aborted,'REVIEW_CANCELLED');
  const relevant=changes.filter(c=>regionById.get(c.id)?.page===n);
  if(relevant.length){
   const content=await page.getTextContent({includeMarkedContent:false});
   const anchors=matchVisualRegionsToPdfPage({
    regions:relevant.map(c=>regionById.get(c.id)),
    items:content.items.filter(item=>typeof item.str==='string'),
    viewport,page:n
   });
   const byId=new Map(anchors.map(a=>[a.id,a]));
   // Every saved edit must still match the real PDF and be safe at this scale.
   for(const change of relevant){
    const anchor=byId.get(change.id);
    ensure(anchor,'REVIEW_EDITS_UNSAFE');
    const plan=planInlinePdfPreview({
     anchor,replacement:change.text,pageWidth:viewport.width,pageHeight:viewport.height,
     onWhite:whitePdfPatchBackground(canvas,anchor.bbox),
     measure:(text,fontPx)=>{
      ctx.font=fontPx+'px Arial, "Noto Sans CJK SC", sans-serif';
      return ctx.measureText(text).width;
     }
    });
    ensure(plan.safe,'REVIEW_EDITS_UNSAFE');
    const [x,y,w,h]=anchor.bbox;
    const left=x/1000*canvas.width,top=y/1000*canvas.height;
    const rectWidth=w/1000*canvas.width,rectHeight=h/1000*canvas.height;
    ctx.fillStyle='#ffffff';
    ctx.fillRect(Math.max(0,left-1.5),Math.max(0,top-1.5),
     Math.min(canvas.width-left+1.5,rectWidth+3),Math.min(canvas.height-top+1.5,rectHeight+3));
    ctx.fillStyle='#242c35';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.font=plan.fontPx+'px Arial, "Noto Sans CJK SC", sans-serif';
    ctx.fillText(plan.text,left+1,top+rectHeight/2,Math.max(0,rectWidth-2));
    applied++;
   }
  }
  const jpg=new Uint8Array(await (await toJpeg(canvas)).arrayBuffer());
  total+=jpg.length;
  ensure(total<=LIMIT_JPEG_BYTES,'REVIEW_TOO_LARGE');
  pages.push({
   jpeg:jpg,width:canvas.width,height:canvas.height,
   pageWidth:original.width,pageHeight:original.height
  });
  canvas.width=0;canvas.height=0;
  if(onPage)onPage(n,source.numPages);
 }
 ensure(applied===changes.length,'REVIEW_EDITS_UNSAFE');
 return buildRasterReviewPdf(pages);
}
export function downloadOriginalPdfReviewCopy(bytes,filename){
 const body=new Uint8Array(bytes.byteLength);body.set(bytes);
 const blob=new Blob([body],{type:'application/pdf'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 const safeName=String(filename||'我的简历').replace(/\.pdf$/i,'')
  .replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,70)||'我的简历';
 a.href=url;a.download=safeName+'-修改预览稿.pdf';
 a.hidden=true;document.body.appendChild(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
}
