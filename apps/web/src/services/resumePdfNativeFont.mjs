// Narrow native-font PDF edit gate. No retyping, new templates or guessed fonts.
// Only unsigned one-page classic-xref PDFs with one unfiltered ASCII Tj,
// a single standard Type1 font and same-byte-length replacement may pass.
const bad=(code='PDF_NATIVE_UNSUPPORTED')=>{throw Error(code)};
const requireTrue=(yes,code)=>{if(!yes)bad(code)};
const asLatin1=(bytes)=>{
 let output='';
 for(let i=0;i<bytes.length;i+=8192)
  output+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return output;
};
const one=(matches)=>{requireTrue(matches.length===1);return matches[0]};
const fonts=new Set([
 'Helvetica','Helvetica-Bold','Helvetica-Oblique','Helvetica-BoldOblique',
 'Times-Roman','Times-Bold','Times-Italic','Times-BoldItalic',
 'Courier','Courier-Bold','Courier-Oblique','Courier-BoldOblique'
]);
export function patchPdfWithOriginalFont(bytes,original,replacement){
 requireTrue(bytes instanceof Uint8Array&&bytes.length>250&&bytes.length<=5*1024*1024);
 requireTrue(typeof original==='string'&&typeof replacement==='string'&&
  original!==replacement&&original.length===replacement.length&&
  /^[A-Za-z0-9 ,.?!;:_/-]{5,120}$/.test(original)&&
  /^[A-Za-z0-9 ,.?!;:_/-]{5,120}$/.test(replacement),'PDF_NATIVE_TEXT_UNSUPPORTED');
 const raw=asLatin1(bytes);
 requireTrue(/^%PDF-1\./.test(raw)&&raw.includes('\nstartxref\n')&&
  !/\/(?:Encrypt|ObjStm|XRef|Linearized|ByteRange|Sig|AcroForm|XFA|Prev|Filter|DecodeParms|JavaScript|OpenAction)\b/.test(raw));
 requireTrue((raw.match(/\bxref\s*\r?\n/g)||[]).length===1);
 const objects=[...raw.matchAll(/(?:^|\n)(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g)];
 const pages=objects.filter(m=>/\/Type\s*\/Page\b/.test(m[2]));
 requireTrue(pages.length===1);
 const page=pages[0][2];
 requireTrue(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+[\d.]+\s*\]/.test(page)&&
  !/\/(?:Rotate|XObject|Annots|Contents)\s*\[/.test(page));
 const cid=one([...page.matchAll(/\/Contents\s+(\d+)\s+0\s+R\b/g)])[1];
 const font=one([...page.matchAll(/\/Font\s*<<\s*\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R\s*>>/g)]);
 const [tag,fid]=[font[1],font[2]];
 const fontObjects=objects.filter(m=>m[1]===fid);
 requireTrue(fontObjects.length===1);
 const details=fontObjects[0][2];
 requireTrue(/\/Type\s*\/Font\b/.test(details)&&/\/Subtype\s*\/Type1\b/.test(details)&&
  !/\/(?:FontDescriptor|ToUnicode|Encoding|DescendantFonts|Widths|FirstChar|LastChar)\b/.test(details));
 const family=one([...details.matchAll(/\/BaseFont\s*\/([A-Za-z-]+)\b/g)])[1];
 requireTrue(fonts.has(family));
 const streams=objects.filter(m=>m[1]===cid);
 requireTrue(streams.length===1);
 const object=streams[0];
 const parsed=object[2].match(/^\s*<<(.*?)>>\s*stream(\r?\n)([\s\S]*?)(\r?\n)endstream\s*$/);
 requireTrue(parsed!==null);
 const [dict,stream]=[parsed[1],parsed[3]];
 requireTrue(!/<<|>>|\/(?:Filter|DecodeParms)\b/.test(dict));
 const bytesDeclared=one([...dict.matchAll(/\/Length\s+(\d+)\b/g)])[1];
 requireTrue(Number(bytesDeclared)===stream.length);
 const expression=new RegExp('^\\s*BT\\s*\\/'+tag+
  '\\s+(\\d+(?:\\.\\d+)?)\\s+Tf\\s+(-?\\d+(?:\\.\\d+)?)'+
  '\\s+(-?\\d+(?:\\.\\d+)?)\\s+Td\\s+\\(([^()]*)\\)\\s+Tj\\s+ET\\s*$');
 const glyph=stream.match(expression);
 requireTrue(glyph!==null&&glyph[4]===original&&!/[\\\r\n]/.test(glyph[4]));
 requireTrue(raw.split(original).length===2);
 const local=stream.indexOf('('+original+')');
 requireTrue(local>=0&&stream.lastIndexOf('('+original+')')===local);
 const at=object.index+object[0].indexOf(stream)+local+1;
 requireTrue(raw.slice(at,at+original.length)===original);
 const copy=new Uint8Array(bytes);
 for(let i=0;i<replacement.length;i++)copy[at+i]=replacement.charCodeAt(i);
 return {bytes:copy,proof:{
  schema:'HHBA_PDF_NATIVE_FONT_V1',page:1,fontName:family,fontResource:tag,
  offset:at,length:replacement.length,oldText:original,newText:replacement,
  originalByteLength:bytes.length
 }};
}
