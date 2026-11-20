/**
 * Very narrow in-place edit of a genuinely EMBEDDED Chinese CIDFontType2.
 * The existing original font, its glyph table and ToUnicode CMap remain
 * byte-for-byte identical. A target character must already have appeared
 * in the source PDF text, hence its original font glyph is demonstrably
 * present. No new glyphs are fabricated from a similar font.
 *
 * Only classic xref, unsigned, uncompressed, single-page PDFs with one
 * embedded TrueType CID font, Identity-H, an explicit bfchar CMap, and
 * one fixed-width hex Tj run are even eligible for renderer proof.
 */
const reject=(code='PDF_CJK_UNSUPPORTED')=>{throw Error(code)};
const check=(good,code)=>{if(!good)reject(code)};
const latin1=bytes=>{
 let result='';
 for(let i=0;i<bytes.length;i+=8192)
  result+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return result;
};
const exactlyOne=(items)=>{check(items.length===1);return items[0]};
const objectRef=(raw,pattern)=>Number(exactlyOne([...raw.matchAll(pattern)])[1]);
function indexClassicPdf(bytes){
 check(bytes instanceof Uint8Array&&bytes.length>=300&&bytes.length<=8*1024*1024);
 const raw=latin1(bytes);
 check(/^%PDF-1\.[0-7]\b/.test(raw)&&
  !/\/(?:Encrypt|ObjStm|XRef|Linearized|ByteRange|Sig|AcroForm|XFA|Prev|JavaScript|OpenAction)\b/.test(raw));
 const last=raw.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
 check(Boolean(last));
 const xrefAt=Number(last[1]);
 check(Number.isSafeInteger(xrefAt)&&xrefAt>20&&xrefAt<raw.length-80);
 const section=raw.slice(xrefAt);
 const header=section.match(/^xref\r?\n0\s+(\d+)\r?\n/);
 check(Boolean(header));
 const count=Number(header[1]);check(count>=5&&count<=60);
 const entries=section.slice(header[0].length).split(/\r?\n/);
 check(entries.length>=count+1&&/^0000000000\s+65535\s+f\s*$/.test(entries[0]));
 const positions=[];
 for(let i=1;i<count;i++){
  const line=entries[i]?.match(/^(\d{10})\s+00000\s+n\s*$/);
  check(Boolean(line));
  const offset=Number(line[1]);
  check(offset>=9&&offset<xrefAt);
  positions.push({id:i,offset});
 }
 const sorted=positions.slice().sort((a,b)=>a.offset-b.offset);
 check(sorted.every((x,i)=>i===0||x.offset>sorted[i-1].offset));
 const objects=new Map();
 for(let i=0;i<sorted.length;i++){
  const {id,offset}=sorted[i],next=sorted[i+1]?.offset??xrefAt;
  const source=raw.slice(offset,next);
  const match=source.match(new RegExp('^'+id+'\\s+0\\s+obj\\s*'));
  check(Boolean(match));
  const end=source.lastIndexOf('endobj');
  check(end>match[0].length&&/^\s*$/.test(source.slice(end+6)));
  objects.set(id,{id,offset,raw:source.slice(match[0].length,end)});
 }
 check(/trailer\s*<<[\s\S]*?\/Root\s+\d+\s+0\s+R\b/.test(section));
 return {raw,objects};
}
function streamFor(objects,id){
 const body=objects.get(id)?.raw;check(typeof body==='string');
 const found=body.match(/^\s*<<(.*?)>>\s*stream(\r?\n)/s);
 check(Boolean(found));
 const dict=found[1];check(!/\/(?:Filter|DecodeParms)\b/.test(dict));
 const length=objectRef(dict,/\/Length\s+(\d+)\b/g);
 const start=found[0].length,end=start+length;
 check(length>=10&&length<=8*1024*1024&&end<body.length);
 check(body.slice(end).match(/^\r?\nendstream\s*$/));
 return {dict,text:body.slice(start,end),offset:objects.get(id).offset+
  // The offset of the object BODY inside the full file is needed by callers;
  // derive it from the xref object header, not an untrusted stream token.
  0};
}
function parseCmap(text){
 check(text.length<=32768&&/\bbegincmap\b/.test(text)&&
  /\bendcmap\b/.test(text)&&
  !/\bbeginbfrange\b|\busecmap\b|\bWMode\s+1\b/.test(text));
 const block=exactlyOne([...text.matchAll(/(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g)]);
 const count=Number(block[1]);check(count>0&&count<=256);
 const pairs=[...block[2].matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>/g)];
 check(pairs.length===count&&
  block[2].replace(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>/g,'').trim()==='');
 const forward=new Map(),reverse=new Map();
 for(const [,src,dst] of pairs){
  const code=src.toUpperCase(),point=parseInt(dst,16);
  check(point>0&&point<0xd800||point>=0xe000&&point<=0xffff);
  const char=String.fromCharCode(point);
  check(!forward.has(code)&&!reverse.has(char));
  forward.set(code,char);reverse.set(char,code);
 }
 return {forward,reverse};
}
export function patchPdfWithOriginalCjkFont(bytes,original,replacement){
 check(typeof original==='string'&&typeof replacement==='string'&&
  original!==replacement&&[...original].length>1&&[...original].length<=80&&
  [...original].length===[...replacement].length&&
  [...original,...replacement].every(ch=>/\p{Script=Han}/u.test(ch)),
 'PDF_CJK_TEXT_UNSUPPORTED');
 const {raw,objects}=indexClassicPdf(bytes);
 const pages=[...objects.values()].filter(o=>/\/Type\s*\/Page\b/.test(o.raw));
 check(pages.length===1);
 const page=pages[0].raw;
 check(!/\/(?:Rotate|XObject|Annots|Contents)\s*\[/.test(page));
 const contentId=objectRef(page,/\/Contents\s+(\d+)\s+0\s+R\b/g);
 const font=exactlyOne([...page.matchAll(
  /\/Font\s*<<\s*\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R\s*>>/g)]);
 const tag=font[1],type0=objects.get(Number(font[2]))?.raw;
 check(typeof type0==='string'&&/\/Subtype\s*\/Type0\b/.test(type0)&&
  /\/Encoding\s*\/Identity-H\b/.test(type0)&&
  !/\/(?:Filter|DecodeParms)\b/.test(type0));
 const face=exactlyOne([...type0.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+_.-]+)\b/g)])[1];
 const descendantId=objectRef(type0,/\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R\s*\]/g);
 const cmapId=objectRef(type0,/\/ToUnicode\s+(\d+)\s+0\s+R\b/g);
 const descendant=objects.get(descendantId)?.raw;
 check(typeof descendant==='string'&&/\/Subtype\s*\/CIDFontType2\b/.test(descendant)&&
  /\/CIDToGIDMap\s*\/Identity\b/.test(descendant));
 const descriptorId=objectRef(descendant,/\/FontDescriptor\s+(\d+)\s+0\s+R\b/g);
 const descriptor=objects.get(descriptorId)?.raw;
 check(typeof descriptor==='string'&&/\/Type\s*\/FontDescriptor\b/.test(descriptor));
 const embeddedId=objectRef(descriptor,/\/FontFile2\s+(\d+)\s+0\s+R\b/g);
 const embedded=streamFor(objects,embeddedId);
 // TrueType sfnt: actual embedded font, NOT a renderer's guessed CJK font.
 check(embedded.text.charCodeAt(0)===0&&embedded.text.charCodeAt(1)===1&&
  embedded.text.charCodeAt(2)===0&&embedded.text.charCodeAt(3)===0);
 const {forward,reverse}=parseCmap(streamFor(objects,cmapId).text);
 const sourceStream=streamFor(objects,contentId).text;
 const expression=new RegExp('^\\s*BT\\s*\\/'+tag+
  '\\s+\\d+(?:\\.\\d+)?\\s+Tf\\s+-?\\d+(?:\\.\\d+)?'+
  '\\s+-?\\d+(?:\\.\\d+)?\\s+Td\\s+<([0-9A-Fa-f]+)>\\s+Tj\\s+ET\\s*$');
 const match=sourceStream.match(expression);
 check(Boolean(match)&&match[1].length>=8&&match[1].length%4===0);
 const sourceCodes=match[1].toUpperCase().match(/.{4}/g);
 check(sourceCodes.every(code=>forward.has(code)));
 const actual=sourceCodes.map(code=>forward.get(code)).join('');
 check(actual===original);
 // Glyphs can only be re-used when they demonstrably existed in the exact
 // source text. This rejects missing characters in subset fonts, even if an
 // arbitrary ToUnicode dictionary contains a tempting additional mapping.
 const seen=new Set(sourceCodes);
 const newCodes=[...replacement].map(ch=>reverse.get(ch));
 check(newCodes.every(code=>code&&seen.has(code)),'PDF_CJK_GLYPH_NOT_PRESENT');
 const changedHex=newCodes.join('');
 check(changedHex.length===match[1].length);
 const absolute=raw.indexOf('<'+match[1]+'>');
 check(absolute>=0&&raw.lastIndexOf('<'+match[1]+'>')===absolute);
 const offset=absolute+1;
 const edited=new Uint8Array(bytes);
 for(let i=0;i<changedHex.length;i++)edited[offset+i]=changedHex.charCodeAt(i);
 return {bytes:edited,proof:{
  schema:'HHBA_PDF_CJK_CID_V1',page:1,fontName:face,fontResource:tag,
  offset,length:changedHex.length,oldText:original,newText:replacement,
  originalByteLength:bytes.length,oldGlyphs:match[1].toUpperCase(),
  newGlyphs:changedHex
 }};
}
