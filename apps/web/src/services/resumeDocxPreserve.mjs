// Lossless-package DOCX text patcher. Does not regenerate styles, tables,
// drawing, pictures, headers, footers, relationships or any other document parts.
// It edits *only* one explicitly verified w:t node per requested replacement;
// all unrelated ZIP members keep their exact original compressed bytes.
// Important: byte preservation of OOXML parts is NOT a promise that Word's
// pagination remains pixel-identical after changing the text.
const dec=new TextDecoder('utf-8',{fatal:true});
const enc=new TextEncoder();
const fail=(code)=>{throw Error(code)};
const requireValue=(ok,code='WORD_FILE_UNSUPPORTED')=>{if(!ok)fail(code)};
const read16=(d,p)=>d.getUint16(p,true);
const read32=(d,p)=>d.getUint32(p,true);
const write16=(d,p,v)=>d.setUint16(p,v,true);
const write32=(d,p,v)=>d.setUint32(p,v,true);
const MAX_DOCX=3*1024*1024,MAX_XML=2*1024*1024,MAX_ENTRIES=1200;
const textOnly=(s)=>typeof s==='string'&&s.length>1&&
 !/[\r\n\t\u0000-\u001f]/.test(s)&&s===s.trim();
// The same lossless ZIP validation runs inside the browser and Workers Free.
// A 256-entry lookup avoids an 8-round bitwise loop per source byte, which
// matters under Cloudflare's strict per-request free CPU budget.
const CRC_TABLE=(()=>{
 const values=new Uint32Array(256);
 for(let i=0;i<256;i++){
  let c=i;
  for(let n=0;n<8;n++)c=(c>>>1)^(c&1?0xEDB88320:0);
  values[i]=c>>>0;
 }
 return values;
})();
function crc32(bytes){
 let c=0xFFFFFFFF;
 for(const x of bytes)c=(c>>>8)^CRC_TABLE[(c^x)&255];
 return (c^0xFFFFFFFF)>>>0;
}
function u8(bytes){
 const output=bytes instanceof Uint8Array?bytes:
  bytes instanceof ArrayBuffer?new Uint8Array(bytes):null;
 requireValue(output&&output.length>=50&&output.length<=MAX_DOCX);
 return output;
}
function readPackage(raw){
 const bytes=u8(raw),d=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(read32(d,i)===0x06054b50&&i+22+read16(d,i+20)===bytes.length){
   eocd=i;break;
  }
 }
 requireValue(eocd>=0);
 const count=read16(d,eocd+10),disk=read16(d,eocd+4),centralDisk=read16(d,eocd+6);
 const countDisk=read16(d,eocd+8),size=read32(d,eocd+12),start=read32(d,eocd+16);
 requireValue(disk===0&&centralDisk===0&&count===countDisk&&
  count>2&&count<=MAX_ENTRIES&&start<size+start&&start+size===eocd&&
  count!==0xFFFF&&start!==0xFFFFFFFF&&size!==0xFFFFFFFF);
 const entries=[],names=new Set();let pos=start;
 for(let i=0;i<count;i++){
  requireValue(pos+46<=eocd&&read32(d,pos)===0x02014b50);
  const flag=read16(d,pos+8),method=read16(d,pos+10);
  const crc=read32(d,pos+16),packed=read32(d,pos+20),unpacked=read32(d,pos+24);
  const nameSize=read16(d,pos+28),extra=read16(d,pos+30),comment=read16(d,pos+32);
  const originalOffset=read32(d,pos+42),end=pos+46+nameSize+extra+comment;
  requireValue(end<=eocd&&nameSize>0&&packed!==0xFFFFFFFF&&
   unpacked!==0xFFFFFFFF&&originalOffset!==0xFFFFFFFF&&!(flag&1)&&
   originalOffset<start);
  let name;
  try{name=dec.decode(bytes.subarray(pos+46,pos+46+nameSize));}
  catch{fail('WORD_FILE_UNSUPPORTED');}
  requireValue(!names.has(name)&&name.length<240&&!name.startsWith('/')&&
   !name.includes('\\')&&!name.split('/').includes('..')&&!/[\u0000-\u001f]/.test(name));
  names.add(name);
  const local=originalOffset;
  requireValue(local+30<=start&&read32(d,local)===0x04034b50&&
   read16(d,local+8)===method);
  const localName=read16(d,local+26),localExtra=read16(d,local+28);
  const dataStart=local+30+localName+localExtra;
  requireValue(dataStart+packed<=start);
  entries.push({name,local,central:pos,centralEnd:end,
   crc,packed,unpacked,method,flag,dataStart});
  pos=end;
 }
 requireValue(pos===eocd&&entries.some(e=>e.name==='[Content_Types].xml')&&
  entries.some(e=>e.name==='_rels/.rels')&&
  entries.some(e=>e.name==='word/document.xml')&&
  !entries.some(e=>/vbaProject\.bin$/i.test(e.name)));
 const sorted=[...entries].sort((a,b)=>a.local-b.local);
 requireValue(sorted[0].local===0);
 for(let i=0;i<sorted.length;i++){
  const next=i+1<sorted.length?sorted[i+1].local:start;
  requireValue(sorted[i].dataStart+sorted[i].packed<=next);
  sorted[i].localEnd=next;
 }
 return {bytes,d,entries,sorted,originalEnd:bytes.slice(eocd+22),eocd};
}
async function xmlBytes(pkg,entry){
 requireValue(entry.unpacked>0&&entry.unpacked<=MAX_XML&&entry.packed>0);
 const source=pkg.bytes.subarray(entry.dataStart,entry.dataStart+entry.packed);
 if(entry.method===0){
  requireValue(source.length===entry.unpacked&&crc32(source)===entry.crc);
  return source;
 }
 requireValue(entry.method===8&&typeof DecompressionStream==='function');
 let stream;
 try{stream=new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
 catch{fail('WORD_FILE_UNSUPPORTED');}
 const reader=stream.getReader(),chunks=[];let total=0;
 try{for(;;){const item=await reader.read();if(item.done)break;
  total+=item.value.length;requireValue(total<=MAX_XML);
  chunks.push(item.value);
 }}catch{fail('WORD_FILE_UNSUPPORTED');}finally{reader.releaseLock();}
 const out=new Uint8Array(total);let pos=0;
 for(const chunk of chunks){out.set(chunk,pos);pos+=chunk.length;}
 requireValue(out.length===entry.unpacked&&crc32(out)===entry.crc);
 return out;
}
function decodeXML(s){
 return s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,entity=>{
  if(entity==='&amp;')return '&';
  if(entity==='&lt;')return '<';
  if(entity==='&gt;')return '>';
  if(entity==='&quot;')return '"';
  if(entity==='&apos;')return "'";
  const hex=entity.startsWith('&#x'),num=parseInt(entity.slice(hex?3:2,-1),hex?16:10);
  return Number.isInteger(num)&&num>0&&num<=0x10FFFF&&
   !(num>=0xD800&&num<=0xDFFF)?String.fromCodePoint(num):'';
 });
}
const encodeXML=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function countWidth(s){
 let units=0;
 for(const c of s){
  const point=c.codePointAt(0);
  units+=point>=0x2E80||point>=0x1100&&point<=0x11FF?2:1;
 }
 return units;
}
// Plain text runs can carry different styles. Preserve unchanged prefix/suffix
// runs and inherit the first affected run's style for replacement text.
// Links, fields, breaks, drawings and tracked changes are not plain text runs.
function paragraphRunGroups(xml,matches){
 const index=new Map(matches.map(m=>[m.index,m])),groups=[],paragraphs=[],paragraphCounts=new Map();
 for(const p of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)){
  const inner=p[1],offset=p.index+p[0].indexOf('>')+1;
  const nodes=[...inner.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
  if(!nodes.length)continue;
  const text=nodes.map(m=>decodeXML(m[1])).join('');
  paragraphCounts.set(text,(paragraphCounts.get(text)||0)+1);
  // A previously merged paragraph has one nonempty node and retained empty
  // styled nodes. Treat it as the ordinary unique text run, not two anchors.
  if(!textOnly(text))continue;
  // A leading pPr is allowed but must remain byte-identical.
  const properties=inner.match(/^\s*<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0]||'';
  const content=inner.slice(properties.length).trim();
  const runs=[...content.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)];
  if(!runs.length||runs.map(m=>m[0]).join('').replace(/>\s+</g,'><')!==content.replace(/>\s+</g,'><'))continue;
  const styles=new Set();
  let valid=true;
  for(const run of runs){
   const value=run[1].trim(),props=value.match(/^<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0]||'';
   styles.add(props);
   const rest=value.slice(props.length).trim();
   if(!/^(?:<w:t(?:\s[^>]*)?>[^<]*<\/w:t>\s*)+$/.test(rest)){valid=false;break;}
  }
  if(!valid)continue;
  const exact=nodes.map(m=>index.get(offset+m.index));
  if(exact.some(m=>!m))continue;
  if(nodes.filter(m=>decodeXML(m[1]).length>0).length>=2)groups.push({text,nodes:exact,mixed:styles.size>1});
  // Do not clone section breaks, tracked changes, or properties containing IDs.
  const style=[...styles][0]||'';
  if(!/<w:(?:sectPr|pPrChange|rPrChange|ins|del|bookmarkStart|bookmarkEnd)\b/.test(properties+style))
   paragraphs.push({text,nodes:exact,start:p.index,end:p.index+p[0].length,properties,style});
 }
 return {groups,paragraphs,paragraphCounts};
}
// Map a contiguous changed range onto the existing text runs. Unchanged
// styled fragments are never moved. New wording inherits the affected run;
// a wholesale rewrite cannot infer semantic formatting of new words.
export function distributeStyledText(originalRuns,replacement){
 const source=originalRuns.join('');
 let start=0,end=0;
 while(start<source.length&&start<replacement.length&&source[start]===replacement[start])start++;
 while(end<source.length-start&&end<replacement.length-start&&source[source.length-1-end]===replacement[replacement.length-1-end])end++;
 const cut=source.length-end,insert=replacement.slice(start,replacement.length-end);
 let offset=0,placed=false;
 const first=originalRuns.findIndex(Boolean);
 return originalRuns.map((run,i)=>{
  const from=offset,to=offset+run.length;offset=to;
  const prefix=run.slice(0,Math.max(0,Math.min(run.length,start-from)));
  const suffix=run.slice(Math.max(0,Math.min(run.length,cut-from)));
  const take=!placed&&((start<to&&start>=from)||(start===source.length&&i===originalRuns.length-1)||(first===-1&&i===0));
  if(take)placed=true;
  return prefix+(take?insert:'')+suffix;
 });
}
function editXml(xml,edits,{allowExpansion=false}={}){
 requireValue(xml.includes('<w:document')&&xml.includes('<w:body')&&
  !/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml));
 const matches=[...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
 requireValue(matches.length>0);
 const changed=new Map(),used=new Set(),insertions=[];
 const {groups,paragraphs,paragraphCounts}=allowExpansion?paragraphRunGroups(xml,matches):{groups:[],paragraphs:[],paragraphCounts:new Map()};
 for(const edit of edits){
  requireValue(edit&&textOnly(edit.original)&&typeof edit.text==='string'&&
   (textOnly(edit.text)||(allowExpansion&&edit.text.includes('\n')&&edit.text.split('\n').every(line=>line.length>0&&line===line.trim()&&!/[\r\t\u0000-\u001f]/.test(line))))&&
   edit.text!==edit.original,'WORD_EDIT_UNSAFE');
  // Only the opt-in DOCX-only mode may permit expansions, with an explicit
  // UNVERIFIED pagination label. Renderer-verified mode retains the older
  // restrictive width guard and checks page geometry before publication.
  if(!allowExpansion)
   requireValue(countWidth(edit.text)<=countWidth(edit.original),'WORD_EDIT_TOO_LONG');
  const hits=matches.filter(m=>decodeXML(m[1])===edit.original);
  const combined=groups.filter(group=>group.text===edit.original);
  requireValue(hits.length+combined.length===1&&
   (!combined.length||paragraphCounts.get(edit.original)===1),'WORD_EDIT_AMBIGUOUS');
  const lines=edit.text.split('\n');
  const targets=combined.length?combined[0].nodes:hits;
  if(lines.length>1){
   const candidates=paragraphs.filter(p=>p.text===edit.original);
   requireValue(candidates.length===1&&paragraphCounts.get(edit.original)===1&&
    candidates[0].nodes.filter(n=>decodeXML(n[1])).every(n=>targets.includes(n)),'WORD_EDIT_AMBIGUOUS');
   const paragraph=candidates[0];
   // Add actual sibling w:p elements, retaining paragraph and run style.
   // Fresh paragraph tags omit original IDs, revision attributes and bookmarks.
   const added=lines.slice(1).map(line=>'<w:p>'+paragraph.properties+'<w:r>'+paragraph.style+
    '<w:t xml:space="preserve">'+encodeXML(line)+'</w:t></w:r></w:p>').join('');
   insertions.push({index:paragraph.end,length:0,value:added});
  }
  const values=combined[0]?.mixed?distributeStyledText(targets.map(hit=>decodeXML(hit[1])),lines[0]):targets.map((_,i)=>i===0?lines[0]:'');
  requireValue(values.join('')===lines[0],'WORD_EDIT_UNSAFE');
  for(const [i,hit] of targets.entries()){
   requireValue(!used.has(hit.index),'WORD_EDIT_AMBIGUOUS');
   used.add(hit.index);
   let prefix=hit[0].slice(0,hit[0].indexOf('>')+1);
   if(/^\s|\s$/.test(values[i])&&!/\bxml:space=/.test(prefix))prefix=prefix.slice(0,-1)+' xml:space="preserve">';
   changed.set(hit.index,prefix+encodeXML(values[i])+'</w:t>');
  }
 }
 let patched=xml;
 const patches=[...matches.filter(m=>changed.has(m.index)).map(m=>({index:m.index,length:m[0].length,value:changed.get(m.index)})),...insertions];
 for(const patch of patches.sort((a,b)=>b.index-a.index)){
  patched=patched.slice(0,patch.index)+patch.value+patched.slice(patch.index+patch.length);
 }
 requireValue(patched!==xml);
 return patched;
}
function newStoredPart(name,data){
 const filename=enc.encode(name),h=new Uint8Array(30+filename.length),
  d=new DataView(h.buffer),crc=crc32(data);
 write32(d,0,0x04034b50);write16(d,4,20);write16(d,6,0x0800);
 write16(d,8,0);write32(d,14,crc);write32(d,18,data.length);
 write32(d,22,data.length);write16(d,26,filename.length);h.set(filename,30);
 return {body:[h,data],crc,packed:data.length,unpacked:data.length,method:0,flags:0x0800};
}
function repack(pkg,name,replacement){
 const chunks=[],centers=[],newPositions=new Map();let size=0;
 const push=(bytes)=>{chunks.push(bytes);size+=bytes.length;};
 for(const e of pkg.sorted){
  newPositions.set(e.name,size);
  if(e.name===name){
   const rewritten=newStoredPart(name,replacement);
   for(const chunk of rewritten.body)push(chunk);
  }else push(pkg.bytes.subarray(e.local,e.localEnd));
 }
 const centralStart=size;
 for(const entry of pkg.entries){
  const header=pkg.bytes.slice(entry.central,entry.centralEnd);
  const view=new DataView(header.buffer);
  write32(view,42,newPositions.get(entry.name));
  if(entry.name===name){
   write16(view,8,0x0800);write16(view,10,0);
   write32(view,16,crc32(replacement));write32(view,20,replacement.length);
   write32(view,24,replacement.length);
  }
  centers.push(header);size+=header.length;
 }
 const eo=new Uint8Array(22),ed=new DataView(eo.buffer);
 write32(ed,0,0x06054b50);write16(ed,8,pkg.entries.length);
 write16(ed,10,pkg.entries.length);write32(ed,12,size-centralStart);
 write32(ed,16,centralStart);
 const result=new Uint8Array(size+eo.length);let p=0;
 for(const chunk of [...chunks,...centers,eo]){result.set(chunk,p);p+=chunk.length;}
 requireValue(result.length<=MAX_DOCX,'WORD_EDIT_TOO_LARGE');
 return result;
}
export async function editOriginalDocxStrict(raw,edits,options={}){
 requireValue(Array.isArray(edits)&&edits.length>0&&edits.length<=20,'WORD_EDIT_UNSAFE');
 const pkg=readPackage(raw),entry=pkg.entries.find(e=>e.name==='word/document.xml');
 const originalXml=dec.decode(await xmlBytes(pkg,entry));
 const rewritten=enc.encode(editXml(originalXml,edits,options));
 requireValue(rewritten.length<=MAX_XML,'WORD_EDIT_TOO_LARGE');
 const bytes=repack(pkg,entry.name,rewritten);
 // Strict post-write validation: package structure intact; unrelated ZIP
 // members and their original compressed payload remain byte-identical.
 const rebuilt=readPackage(bytes);
 requireValue(rebuilt.entries.length===pkg.entries.length,'WORD_EDIT_CORRUPTED');
 const next=rebuilt.entries.find(e=>e.name===entry.name);
 requireValue(dec.decode(await xmlBytes(rebuilt,next))===dec.decode(rewritten),
  'WORD_EDIT_CORRUPTED');
 for(const old of pkg.entries){
  if(old.name===entry.name)continue;
  const found=rebuilt.entries.find(e=>e.name===old.name);
  requireValue(found&&found.packed===old.packed&&found.unpacked===old.unpacked&&
   found.crc===old.crc&&found.method===old.method,'WORD_EDIT_CORRUPTED');
  // repack() copies each UNMODIFIED local ZIP member as a single original
  // byte slice. We have already validated its source offsets, its new central
  // directory position, original CRC, compression method and compressed size.
  // No other function mutates the source Uint8Array or those copied chunks.
  // Re-scanning megabytes of untouched pictures here duplicates the
  // copy-by-construction invariant and can exceed Workers Free's CPU limit.
  // CI independently compares every unrelated compressed part byte-for-byte.
  requireValue(found.packed===old.packed,'WORD_EDIT_CORRUPTED');
 }
 return bytes;
}
// Only this gated entry point may be wired to the user-facing "下载 Word".
// A trusted server-side Word renderer must confirm that old and new pages
// have unchanged geometry outside the modified text. DO NOT substitute an
// optimistic model score, a mocked front-end flag or ZIP validation for proof.
export async function prepareVerifiedOriginalDocxExport({
 original,edits,verifyLayout
}){
 requireValue(typeof verifyLayout==='function','WORD_RENDERER_REQUIRED');
 requireValue(Array.isArray(edits)&&edits.length===1,'WORD_LAYOUT_NOT_VERIFIED');
 const docx=await editOriginalDocxStrict(original,edits);
 let report;
 try{
  report=await verifyLayout({
   original:u8(original),edited:docx,
   oldText:edits[0].original,newText:edits[0].text
  });
 }catch{fail('WORD_LAYOUT_NOT_VERIFIED');}
 requireValue(report?.passed===true&&
  Number.isInteger(report.page_count)&&report.page_count>=1&&
  report.page_count<=20&&
  Number.isInteger(report.changed_pixels)&&report.changed_pixels>=5&&
  Number.isInteger(report.changed_region?.page)&&
  report.changed_region.page>=1&&
  report.changed_region.page<=report.page_count,
  'WORD_LAYOUT_NOT_VERIFIED');
 return {bytes:docx,verified:true,pageCount:report.page_count};
}

export async function inspectOriginalDocxStrict(raw,{allowParagraphRuns=false}={}){
 const pkg=readPackage(raw),entry=pkg.entries.find(e=>e.name==='word/document.xml');
 const originalXml=dec.decode(await xmlBytes(pkg,entry));
 const matches=[...originalXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
 const occurrences=new Map();
 for(const m of matches){
  const value=decodeXML(m[1]);occurrences.set(value,(occurrences.get(value)||0)+1);
 }
 const {groups,paragraphs,paragraphCounts}=allowParagraphRuns?paragraphRunGroups(originalXml,matches):{groups:[],paragraphs:[],paragraphCounts:new Map()};
 const eligible=groups.filter(g=>paragraphCounts.get(g.text)===1&&!occurrences.has(g.text));
 const covered=new Set(eligible.flatMap(g=>g.nodes.map(m=>m.index)));
 const unique=matches.filter(m=>!covered.has(m.index)).map(m=>decodeXML(m[1])).filter(value=>
  textOnly(value)&&occurrences.get(value)===1&&!groups.some(g=>g.text===value));
 unique.push(...eligible.map(g=>g.text));
 return {mode:'strict_original_docx',editable_text:unique,
  paragraph_text:paragraphs.filter(p=>paragraphCounts.get(p.text)===1&&unique.includes(p.text)).map(p=>p.text),
  entries:pkg.entries.map(e=>e.name)};
}
