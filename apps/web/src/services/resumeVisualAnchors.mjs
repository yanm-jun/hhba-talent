/**
 * PDF native-text confirmation of visual model layout proposals.
 * The language model may *suggest* a region, but only PDF text objects
 * matching both content and approximate page geometry become clickable.
 * No OCR-only / scanned / ambiguous region is automatically editable.
 */
const canonical=(s)=>String(s||'').normalize('NFKC').toLowerCase()
 .replace(/[^\p{L}\p{N}]/gu,'');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function itemRect(item,viewport){
 if(!item||typeof item.str!=='string'||item.str.trim().length<1||
  !Array.isArray(item.transform)||item.transform.length!==6||
  !Number.isFinite(item.transform[4])||!Number.isFinite(item.transform[5])||
  !Number.isFinite(item.width)||!Number.isFinite(item.height)||
  item.width<=0||item.height<=0)return null;
 const [x,baseline]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
 const scale=Math.hypot(viewport.transform[0],viewport.transform[1]);
 const width=item.width*scale,height=item.height*scale;
 if(!(width>0&&height>0&&viewport.width>0&&viewport.height>0))return null;
 const left=x/viewport.width*1000,top=(baseline-height)/viewport.height*1000;
 const rect={x:left,y:top,w:width/viewport.width*1000,h:height/viewport.height*1000};
 if(!Object.values(rect).every(Number.isFinite))return null;
 return {...rect,str:item.str};
}
function intersectsCenter(item,box,margin){
 const midx=item.x+item.w/2,midy=item.y+item.h/2;
 return midx>=box[0]-margin&&midx<=box[0]+box[2]+margin&&
  midy>=box[1]-margin&&midy<=box[1]+box[3]+margin;
}
function textFidelity(predicted,extracted){
 const target=canonical(predicted),actual=canonical(extracted);
 if(target.length<8||actual.length<8)return false;
 // Full contained text is robust to extra spaces/punctuation but requires a
 // substantial overlap; short common words alone never authorize a patch.
 if(actual.includes(target))return target.length/actual.length>=.52;
 if(target.includes(actual))return actual.length/target.length>=.76;
 return false;
}
export function matchVisualRegionsToPdfPage({regions,items,viewport,page}){
 if(!Array.isArray(regions)||!Array.isArray(items)||!viewport||
   !Number.isInteger(page)||page<1)return [];
 const textItems=items.map(item=>itemRect(item,viewport)).filter(Boolean);
 const matched=[],seen=new Set();
 for(const region of regions.slice(0,80)){
  if(region?.page!==page||!/^p\d+-r\d+$/.test(String(region?.id||''))||
   !Array.isArray(region?.bbox)||region.bbox.length!==4||seen.has(region.id))continue;
  const box=region.bbox;
  if(box.some(v=>typeof v!=='number'||!Number.isFinite(v))||
   box[0]<0||box[1]<0||box[2]<8||box[3]<8||
   box[0]+box[2]>1000||box[1]+box[3]>1000)continue;
  // Allow modest disagreement in the model's rough box, not off-column text.
  const near=textItems.filter(item=>intersectsCenter(item,box,18));
  if(!near.length)continue;
  const sorted=near.slice().sort((a,b)=>Math.abs(a.y-b.y)>9?a.y-b.y:a.x-b.x);
  const source=sorted.map(x=>x.str).join(' ');
  if(!textFidelity(region.text,source))continue;
  const left=Math.min(...near.map(x=>x.x)),top=Math.min(...near.map(x=>x.y));
  const right=Math.max(...near.map(x=>x.x+x.w));
  const bottom=Math.max(...near.map(x=>x.y+x.h));
  const x=clamp(left,0,1000),y=clamp(top,0,1000);
  const w=clamp(right,0,1000)-x,h=clamp(bottom,0,1000)-y;
  if(w<10||h<6)continue;
  seen.add(region.id);
  matched.push({
   id:region.id,page,
   kind:region.kind||'other',text:region.text,
   source_text:source,
   verified:true, // verified only against PDF native glyphs, NOT writeback safety.
   bbox:[x,y,w,h]
  });
 }
 return matched;
}
