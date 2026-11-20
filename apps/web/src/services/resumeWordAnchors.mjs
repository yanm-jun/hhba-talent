// Word text nodes may be edited only when their exact text appears uniquely
// in the true PDF output produced from the SAME original DOCX.
const plain=s=>String(s||'').normalize('NFKC').trim();
export function matchWordAnchors({editableText,items,viewport,page}){
 if(!Array.isArray(editableText)||!Array.isArray(items)||!viewport||
  !Number.isInteger(page)||page<1)return [];
 const candidates=new Set(editableText.filter(t=>typeof t==='string'&&
  t.length>=3&&t.length<=300&&t.trim()===t));
 const seen=new Map();
 for(const item of items){
  if(!item||!candidates.has(plain(item.str))||!Array.isArray(item.transform)||
   item.transform.length!==6||!Number.isFinite(item.width)||
   !Number.isFinite(item.height)||item.width<=0||item.height<=0)continue;
  if(Math.abs(item.transform[1])>.02||Math.abs(item.transform[2])>.02)continue;
  const [x,baseline]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
  const scale=Math.hypot(viewport.transform[0],viewport.transform[1]);
  const w=item.width*scale,h=item.height*scale;
  const bbox=[x/viewport.width*1000,(baseline-h)/viewport.height*1000,
   w/viewport.width*1000,h/viewport.height*1000];
  if(bbox.some(n=>!Number.isFinite(n))||bbox[0]<0||bbox[1]<0||
   bbox[2]<12||bbox[3]<6||bbox[0]+bbox[2]>1000||bbox[1]+bbox[3]>1000)
   continue;
  const key=plain(item.str),matches=seen.get(key)||[];
  matches.push({id:'word-'+page+'-'+matches.length,text:key,page,bbox});
  seen.set(key,matches);
 }
 const result=[];
 for(const [text,matches] of seen)if(matches.length===1)
  result.push(matches[0]);
 return result.slice(0,35);
}
