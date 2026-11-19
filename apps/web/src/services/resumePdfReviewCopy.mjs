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
// A searchable review keeps the JPEG appearance but adds INVISIBLE Unicode
// text per original PDF.js text item, with any replaced old text removed.
// This is not a semantically tagged or fully editable vector PDF.
function utf16hex(input){
 let result='';
 for(let i=0;i<input.length;i++)result+=input.charCodeAt(i).toString(16).padStart(4,'0');
 return result.toUpperCase();
}
const cMapText=[
 '/CIDInit /ProcSet findresource begin','12 dict begin','begincmap',
 '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
 '/CMapName /HHBAUnicodeIdentity def','/CMapType 2 def',
 '1 begincodespacerange','<0000> <FFFF>','endcodespacerange',
 '1 beginbfrange','<0000> <FFFF> <0000>','endbfrange',
 'endcmap','CMapName currentdict /CMap defineresource pop',
 'end','end',''
].join('\n');
function safeTextLayerPage(input){
 ensure(Array.isArray(input)&&input.length<=3000,'SEARCHABLE_TEXT_LIMIT');
 let count=0;const valid=[];
 for(const run of input){
  const text=run?.text;
  ensure(typeof text==='string'&&text.length>0&&text.length<=1600&&
   !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)&&
   !/[\uD800-\uDFFF]/u.test(text),'SEARCHABLE_TEXT_INVALID');
  ensure([run.x,run.y,run.fontSize].every(Number.isFinite)&&
   run.fontSize>0&&run.fontSize<100&&run.x>=-10&&run.y>=-10,
   'SEARCHABLE_TEXT_INVALID');
  count+=text.length;
  ensure(count<=30000,'SEARCHABLE_TEXT_LIMIT');
  valid.push({text,x:run.x,y:run.y,fontSize:run.fontSize});
 }
 return valid;
}
function searchableTextCommands(textRuns){
 const rows=[];
 for(const run of safeTextLayerPage(textRuns)){
  const size=Number(run.fontSize.toFixed(3)),x=Number(run.x.toFixed(3)),
   y=Number(run.y.toFixed(3));
  // Rendering mode 3 is invisible but text extraction remains available.
  rows.push('BT /F1 '+size+' Tf 3 Tr 1 0 0 1 '+x+' '+y+
   ' Tm <'+utf16hex(run.text)+'> Tj ET');
 }
 return rows.join('\n')+'\n';
}
// Standalone ISO PDF-1.4 writer, using one JPEG XObject per original page.
// The page images contain only the *visible* edited result, so no source text
// is accidentally hidden inside PDF content streams.
export function buildRasterReviewPdf(pages,{searchable=false}={}){
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
 if(searchable)for(const page of pages)safeTextLayerPage(page.textRuns);
 const chunks=[],offsets=[0];let position=0;
 const write=(bytes)=>{chunks.push(bytes);position+=bytes.length};
 const writeText=(value)=>write(b(value));
 function object(id,parts){
  offsets[id]=position;
  writeText(id+' 0 obj\n');
  for(const part of parts)write(typeof part==='string'?b(part):part);
  writeText('\nendobj\n');
 }
 const n=pages.length,count=2+3*n+(searchable?4:0);
 const fontId=3+3*n;
 writeText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
 object(2,['<< /Type /Pages /Count '+n+' /Kids ['+
  pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>']);
 for(let index=0;index<n;index++){
  const item=pages[index],jpeg=pageBytes(item.jpeg);
  const pageId=3+3*index,streamId=pageId+1,imageId=pageId+2;
  const pw=Number(item.pageWidth.toFixed(2)),ph=Number(item.pageHeight.toFixed(2));
  object(pageId,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+
   '] /Resources << /XObject << /Im0 '+imageId+' 0 R >>'+
   (searchable?' /Font << /F1 '+fontId+' 0 R >>':'')+
   ' >> /Contents '+streamId+' 0 R >>']);
  const commands='q\n'+pw+' 0 0 '+ph+' 0 0 cm\n/Im0 Do\nQ\n'+
   (searchable?searchableTextCommands(item.textRuns):'');
  object(streamId,['<< /Length '+b(commands).length+' >>\nstream\n',commands,'endstream']);
  object(imageId,['<< /Type /XObject /Subtype /Image /Width '+item.width+
   ' /Height '+item.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8'+
   ' /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n',jpeg,'\nendstream']);
 }
 if(searchable){
  object(fontId,['<< /Type /Font /Subtype /Type0 /BaseFont /HHBAUnicode'+
   ' /Encoding /Identity-H /DescendantFonts ['+(fontId+1)+
   ' 0 R] /ToUnicode '+(fontId+3)+' 0 R >>']);
  object(fontId+1,['<< /Type /Font /Subtype /CIDFontType2 /BaseFont /HHBAUnicode'+
   ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>'+
   ' /FontDescriptor '+(fontId+2)+' 0 R /DW 1000 /CIDToGIDMap /Identity >>']);
  object(fontId+2,['<< /Type /FontDescriptor /FontName /HHBAUnicode /Flags 4'+
   ' /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900'+
   ' /Descent -200 /CapHeight 800 /StemV 80 >>']);
  object(fontId+3,['<< /Length '+b(cMapText).length+' >>\nstream\n',cMapText,'endstream']);
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
 document:source,layout,changes,signal,onPage,searchable=false,
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
  const content=(relevant.length||searchable)?
   await page.getTextContent({includeMarkedContent:false}):null;
  const visibleItems=content?.items.filter(item=>typeof item.str==='string'&&item.str.trim())||[];
  const replacementSlots=new Map(),excludedSlots=new Set();
  if(relevant.length){
   const anchors=matchVisualRegionsToPdfPage({
    regions:relevant.map(c=>regionById.get(c.id)),
    items:visibleItems,
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
    if(searchable){
     // The exact native text under this visual region MUST be removed from
     // the searchable layer; a white rectangle alone is not redaction.
     const [bx,by,bw,bh]=anchor.bbox;
     const matched=[];
     for(let index=0;index<visibleItems.length;index++){
      const item=visibleItems[index];
      if(!Array.isArray(item.transform)||item.transform.length!==6||
       !Number.isFinite(item.width)||!Number.isFinite(item.height))continue;
      if(Math.abs(item.transform[1])>.01||Math.abs(item.transform[2])>.01)
       throw Error('REVIEW_EDITS_UNSAFE');
      const [ux,base]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
      const sx=Math.hypot(viewport.transform[0],viewport.transform[1]);
      const midX=(ux+item.width*sx/2)/viewport.width*1000;
      const midY=(base-item.height*sx/2)/viewport.height*1000;
      if(midX>=bx-18&&midX<=bx+bw+18&&midY>=by-18&&midY<=by+bh+18)
       matched.push(index);
     }
     const normalize=text=>text.normalize('NFKC').toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu,'');
     ensure(matched.length>0&&
      normalize(matched.map(i=>visibleItems[i].str).join(' '))===
      normalize(change.original),'REVIEW_EDITS_UNSAFE');
     for(const index of matched){
      ensure(!excludedSlots.has(index),'REVIEW_EDITS_UNSAFE');
      excludedSlots.add(index);
     }
     replacementSlots.set(matched[0],change.text.trim());
    }
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
  const textRuns=[];
  if(searchable){
   const baseViewport=page.getViewport({scale:1});
   for(let index=0;index<visibleItems.length;index++){
    const item=visibleItems[index];
    if(excludedSlots.has(index)&&!replacementSlots.has(index))continue;
    const value=replacementSlots.get(index)??item.str;
    if(!value||!value.trim())continue;
    ensure(Array.isArray(item.transform)&&item.transform.length===6&&
     Number.isFinite(item.transform[4])&&Number.isFinite(item.transform[5]),
     'SEARCHABLE_TEXT_INVALID');
    const [x,top]=baseViewport.convertToViewportPoint(item.transform[4],item.transform[5]);
    textRuns.push({
     text:value,x,y:baseViewport.height-top,
     fontSize:Math.max(5,Math.min(72,Number(item.height)||10))
    });
   }
  }
  pages.push({
   jpeg:jpg,width:canvas.width,height:canvas.height,
   pageWidth:original.width,pageHeight:original.height,
   ...(searchable?{textRuns}:{})
  });
  canvas.width=0;canvas.height=0;
  if(onPage)onPage(n,source.numPages);
 }
 ensure(applied===changes.length,'REVIEW_EDITS_UNSAFE');
 return buildRasterReviewPdf(pages,{searchable});
}
// A searchable, copyable page-image PDF. Chinese text uses a dedicated
// two-byte ToUnicode map: it is NOT a guarantee of ATS compatibility.
export function createOriginalPdfSearchableCopy(options){
 return createOriginalPdfReviewCopy({...options,searchable:true});
}
export function downloadOriginalPdfSearchableCopy(bytes,filename){
 const body=new Uint8Array(bytes.byteLength);body.set(bytes);
 const blob=new Blob([body],{type:'application/pdf'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 const safeName=String(filename||'我的简历').replace(/\.pdf$/i,'')
  .replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,70)||'我的简历';
 a.href=url;a.download=safeName+'-已修改.pdf';
 a.hidden=true;document.body.appendChild(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
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
