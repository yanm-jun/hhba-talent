// Conservative, single-line visual replacement on the ORIGINAL PDF page.
// This is a private preview overlay only: original PDF bytes remain unchanged.
// Never label it an exported or truly redacted PDF.
const clean=(value)=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function planInlinePdfPreview({anchor,replacement,pageWidth,pageHeight,measure,onWhite}){
 const reject=(reason)=>({safe:false,reason});
 if(!anchor?.verified||!Array.isArray(anchor.bbox)||anchor.bbox.length!==4||
   !Number.isFinite(pageWidth)||!Number.isFinite(pageHeight)||pageWidth<100||pageHeight<100)
  return reject('position');
 const original=String(anchor.source_text||'');
 const text=String(replacement||'').trim();
 const box=anchor.bbox;
 if(!clean(original)||clean(original)!==clean(anchor.text)||
    text.length<2||text.length>1600||/[\r\n]/.test(text)||
    /[\r\n]/.test(original)||anchor.native_line_count!==1||
    box.some(v=>!Number.isFinite(v))||box[0]<0||box[1]<0||box[2]<16||box[3]<6||
    box[0]+box[2]>1000||box[1]+box[3]>1000)return reject('complex_layout');
 const width=box[2]*pageWidth/1000;
 const height=box[3]*pageHeight/1000;
 if(height<7||height>40||width<30||width>pageWidth)return reject('complex_layout');
 const fontPx=Math.min(32,Math.max(7,height*.78));
 if(typeof measure!=='function')return reject('measurement');
 const originalWidth=Number(measure(original,fontPx));
 const newWidth=Number(measure(text,fontPx));
 if(!Number.isFinite(originalWidth)||!Number.isFinite(newWidth)||
    originalWidth<=0||newWidth<=0)return reject('measurement');
 // A shorter line is the only safe first iteration. No reflow, no extra page.
 if(newWidth>originalWidth*.96||newWidth>width*.94)return reject('too_long');
 if(onWhite!==true)return reject('background');
 return {safe:true,reason:null,fontPx,text};
}
export function whitePdfPatchBackground(canvas,box){
 try{
  if(!canvas||typeof canvas.getContext!=='function')return false;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx||!Number.isFinite(canvas.width)||!Number.isFinite(canvas.height))return false;
  const x=box[0]/1000*canvas.width,y=box[1]/1000*canvas.height;
  const w=box[2]/1000*canvas.width,h=box[3]/1000*canvas.height;
  // Background should be near white on BOTH sides, above/below text.
  // Reject colored panels, photos or any unknown/tainted raster.
  const points=[
   [x+Math.max(2,w*.2),y-4],
   [x+Math.max(2,w*.8),y-4],
   [x+Math.max(2,w*.2),y+h+4],
   [x+Math.max(2,w*.8),y+h+4]
  ];
  return points.every(([px,py])=>{
   if(px<1||py<1||px>=canvas.width-1||py>=canvas.height-1)return false;
   const rgba=ctx.getImageData(Math.floor(px),Math.floor(py),1,1).data;
   return rgba[3]===255&&rgba[0]>245&&rgba[1]>245&&rgba[2]>245;
  });
 }catch{return false;}
}
