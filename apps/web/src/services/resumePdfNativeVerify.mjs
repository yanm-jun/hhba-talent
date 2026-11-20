import {patchPdfWithOriginalFont} from './resumePdfNativeFont.mjs';
const fail=()=>{throw Error('PDF_NATIVE_NOT_VERIFIED')};
const ensure=condition=>{if(!condition)fail()};
export async function verifyOriginalFontPdfPatch({
 originalBytes,editedBytes,proof,getDocument,canvasFactory
}){
 ensure(proof?.schema==='HHBA_PDF_NATIVE_FONT_V1'&&
  originalBytes instanceof Uint8Array&&editedBytes instanceof Uint8Array&&
  originalBytes.length===editedBytes.length&&
  typeof getDocument==='function'&&typeof canvasFactory==='function');
 const reconstructed=patchPdfWithOriginalFont(originalBytes,proof.oldText,proof.newText);
 ensure(reconstructed.proof.offset===proof.offset&&
  reconstructed.proof.fontName===proof.fontName&&
  reconstructed.bytes.every((byte,i)=>editedBytes[i]===byte));
 let oldTask,newTask,oldDoc,newDoc;
 try{
  const parse=data=>getDocument({data:new Uint8Array(data),useSystemFonts:false,
   isEvalSupported:false,disableAutoFetch:true,disableStream:true});
  oldTask=parse(originalBytes);newTask=parse(editedBytes);
  [oldDoc,newDoc]=await Promise.all([oldTask.promise,newTask.promise]);
  ensure(oldDoc.numPages===1&&newDoc.numPages===1);
  const [oldPage,newPage]=await Promise.all([oldDoc.getPage(1),newDoc.getPage(1)]);
  const [a,b]=await Promise.all([
   oldPage.getTextContent({includeMarkedContent:false}),
   newPage.getTextContent({includeMarkedContent:false})
  ]);
  const lines=page=>page.items.filter(item=>typeof item.str==='string'&&item.str.trim());
  const before=lines(a),after=lines(b);
  // PDF.js generates document-local fontName IDs (g_d0_f1, g_d1_f1);
  // those differ across documents even when the actual PDF font stays same.
  // Compare the resolved font family/style and the unchanged source font
  // object, not PDF.js runtime IDs.
  const originalFont=a.styles?.[before[0]?.fontName];
  const revisedFont=b.styles?.[after[0]?.fontName];
  ensure(before.length===1&&after.length===1&&
   before[0].str===proof.oldText&&after[0].str===proof.newText&&
   originalFont?.fontFamily&&originalFont.fontFamily===revisedFont?.fontFamily&&
   originalFont.vertical===revisedFont.vertical&&
   before[0].height===after[0].height);
  ensure(before[0].width>10&&after[0].width<=before[0].width*1.01&&
   after[0].width>=before[0].width*.7);
  const vp=oldPage.getViewport({scale:1.5});
  const vpNew=newPage.getViewport({scale:1.5});
  ensure(vp.width===vpNew.width&&vp.height===vpNew.height&&
   vp.width*vp.height<=4_000_000);
  const render=async(page)=>{
   const canvas=canvasFactory(),ctx=canvas.getContext('2d',{willReadFrequently:true});
   ensure(ctx);
   canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
   await page.render({canvas,canvasContext:ctx,viewport:vp}).promise;
   return {width:canvas.width,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};
  };
  const [oldPixels,newPixels]=await Promise.all([render(oldPage),render(newPage)]);
  ensure(oldPixels.width===newPixels.width&&
   oldPixels.pixels.length===newPixels.pixels.length);
  const boxes=[before[0],after[0]].map(line=>{
   const [x,y]=vp.convertToViewportPoint(line.transform[4],line.transform[5]);
   const w=line.width*Math.hypot(vp.transform[0],vp.transform[1]);
   const h=line.height*Math.hypot(vp.transform[0],vp.transform[1]);
   return [x-5,y-h-5,x+w+5,y+6];
  });
  let changed=0;
  const data=oldPixels.pixels,other=newPixels.pixels;
  for(let i=0;i<data.length;i+=4){
   if(data[i]===other[i]&&data[i+1]===other[i+1]&&
    data[i+2]===other[i+2]&&data[i+3]===other[i+3])continue;
   changed++;
   const pixel=i/4;
   const x=pixel%oldPixels.width,y=Math.floor(pixel/oldPixels.width);
   ensure(boxes.some(box=>x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3]));
  }
  ensure(changed>8);
  return {ok:true,pageCount:1,originalFont:proof.fontName,changedPixels:changed};
 }catch{fail();}
 finally{
  try{if(oldDoc)await oldDoc.destroy();else await oldTask?.destroy();}catch{}
  try{if(newDoc)await newDoc.destroy();else await newTask?.destroy();}catch{}
 }
}
