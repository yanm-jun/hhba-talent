/**
 * Make a mask from *actual rendered* modified DOCX glyph pixels.
 * The mask is used only for a local animated rainbow overlay; it never
 * substitutes fonts, changes source bytes, or enters a downloaded file.
 *
 * Fail closed for ambiguous text, background graphics, or unsafe bounds:
 * the original rendered page stays visible without colored highlight.
 */
const validBox=box=>Array.isArray(box)&&box.length===4&&
 box.every(n=>Number.isFinite(n))&&box[0]>=0&&box[1]>=0&&
 box[2]>=12&&box[3]>=5&&
 box[0]+box[2]<=1000&&box[1]+box[3]<=1000;

export function makeWordSiriInkMask(canvas,bbox){
 try{
  if(!canvas||!validBox(bbox)||canvas.width<100||canvas.height<100||
   typeof canvas.getContext!=='function')return null;
  const [x,y,w,h]=bbox;
  const x0=Math.max(0,Math.floor(x/1000*canvas.width));
  const y0=Math.max(0,Math.floor(y/1000*canvas.height));
  const right=Math.min(canvas.width,Math.ceil((x+w)/1000*canvas.width));
  const bottom=Math.min(canvas.height,Math.ceil((y+h)/1000*canvas.height));
  const maskWidth=right-x0,maskHeight=bottom-y0;
  if(maskWidth<12||maskHeight<5||maskWidth>1600||
   maskHeight>115||maskWidth*maskHeight>90000)return null;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return null;
  const white=(point)=>{
   const pixel=ctx.getImageData(Math.floor(point[0]),Math.floor(point[1]),1,1).data;
   return pixel[3]===255&&Math.min(pixel[0],pixel[1],pixel[2])>=245;
  };
  const margin=Math.max(2,Math.ceil(canvas.height/700));
  if(y0-margin<0||bottom+margin>=canvas.height)return null;
  // A solid light background only. No painting over graphics or a color block.
  for(const fraction of [.16,.84]){
   const px=x0+Math.min(maskWidth-1,Math.floor(maskWidth*fraction));
   if(!white([px,y0-margin])||!white([px,bottom+margin]))return null;
  }
  const image=ctx.getImageData(x0,y0,maskWidth,maskHeight);
  const bytes=image.data;
  const offscreen=document.createElement('canvas');
  offscreen.width=maskWidth;offscreen.height=maskHeight;
  const offctx=offscreen.getContext('2d');
  if(!offctx)return null;
  const mask=offctx.createImageData(maskWidth,maskHeight);
  let ink=0;
  for(let i=0;i<bytes.length;i+=4){
   const r=bytes[i],g=bytes[i+1],b=bytes[i+2];
   if(bytes[i+3]<250)return null;
   const lum=.299*r+.587*g+.114*b;
   // Dark visible glyph pixels; do not tint white paper or nearby margins.
   const alpha=lum<232?Math.min(255,Math.round((243-lum)*1.7)):0;
   if(alpha>25)ink++;
   mask.data[i]=0;mask.data[i+1]=0;mask.data[i+2]=0;mask.data[i+3]=alpha;
  }
  // Unusually empty/dense crops likely mapped the wrong PDF object.
  const fraction=ink/(maskWidth*maskHeight);
  if(ink<9||fraction<.008||fraction>.57)return null;
  offctx.putImageData(mask,0,0);
  const imageUrl=offscreen.toDataURL('image/png');
  if(!imageUrl.startsWith('data:image/png;base64,'))return null;
  return {
   bbox:[x0/canvas.width*1000,y0/canvas.height*1000,
    maskWidth/canvas.width*1000,maskHeight/canvas.height*1000],
   maskUrl:imageUrl,
   inkPixels:ink
  };
 }catch{return null;}
}
