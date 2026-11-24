import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {
 editOriginalDocxStrict,inspectOriginalDocxStrict,prepareVerifiedOriginalDocxExport
} from '../src/services/resumeDocxPreserve.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const crc32=(bytes)=>{
 let crc=0xFFFFFFFF;
 for(const x of bytes){crc^=x;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xEDB88320:0);}
 return (crc^0xFFFFFFFF)>>>0;
};
const u16=(d,i,n)=>d.setUint16(i,n,true);
const u32=(d,i,n)=>d.setUint32(i,n,true);
// Synthetic DOCX with deliberately nontrivial styles, table, header,
// footer, picture and relationship: all must survive completely unchanged.
const body='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'+
 ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
 '<w:body><w:p><w:r><w:t>HHBA 测试：保留原始排版</w:t></w:r></w:p>'+
 '<w:tbl><w:tblPr><w:tblW w:w="4800" w:type="dxa"/></w:tblPr>'+
 '<w:tblGrid><w:gridCol w:w="4800"/></w:tblGrid>'+
 '<w:tr><w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>'+
 '<w:p><w:r><w:rPr><w:b/><w:color w:val="452786"/>'+
 '<w:rFonts w:eastAsia="Noto Sans CJK SC"/></w:rPr><w:t>原始岗位描述</w:t></w:r>'+
 '</w:p></w:tc></w:tr></w:tbl>'+
 '<w:p><w:r><w:rPr><w:rFonts w:eastAsia="Noto Serif CJK SC"/>'+
 '<w:sz w:val="28"/><w:i/><w:color w:val="0C699A"/></w:rPr>'+
 '<w:t>完整的另一段文字</w:t></w:r></w:p>'+
 '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/>'+
 '<w:footerReference w:type="default" r:id="rId3"/>'+
 '<w:pgSz w:w="11906" w:h="16838"/>'+
 '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr>'+
 '</w:body></w:document>';
function fixture({method=0,duplicate=false,split=false,macro=false,extraParagraphs=0,duplicateTail=false}={}){
 let doc=duplicate?body.replace('</w:body>','<w:p><w:r><w:t>原始岗位描述</w:t></w:r></w:p></w:body>'):
  split?body.replace('<w:t>原始岗位描述</w:t>','<w:t>原始岗位</w:t><w:t>描述</w:t>'):body;
 if(extraParagraphs){
  const extra=Array.from({length:extraParagraphs},(_,i)=>
   '<w:p><w:r><w:t>虚构补充经历第'+i+'项</w:t></w:r></w:p>').join('');
  const tail=duplicateTail?
   '<w:p><w:r><w:t>原始岗位描述</w:t></w:r></w:p>':'';
  // Keep section properties last, as a real Word document requires.
  doc=doc.replace('<w:sectPr>',extra+tail+'<w:sectPr>');
 }
 const parts=[
  ['[Content_Types].xml',
   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Default Extension="png" ContentType="image/png"/>'+
   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
   '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
   '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'+
   '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'+
   '</Types>'],
  ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
   '</Relationships>'],
  ['word/document.xml',doc],
  ['word/styles.xml','<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
   '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'+
   '</w:styles>'],
  ['word/header1.xml','<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
   '<w:p><w:r><w:t>页眉保持不变</w:t></w:r></w:p></w:hdr>'],
  ['word/footer1.xml','<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
   '<w:p><w:r><w:t>页脚保持不变</w:t></w:r></w:p></w:ftr>'],
  ['word/media/photo.png',Uint8Array.from(Buffer.from(
   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJUbRZkAAAAASUVORK5CYII=','base64'))],
  ['word/_rels/document.xml.rels',
   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
   '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'+
   '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'+
   '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo.png"/>'+
   '</Relationships>'],
  ...(macro?[['word/vbaProject.bin',Uint8Array.of(1,2,3)]]:[])
 ];
 const locals=[],central=[];let at=0;
 for(const [name,content] of parts){
  const nameBytes=enc.encode(name);
  const raw=typeof content==='string'?enc.encode(content):content;
  const packed=method===8?deflateRawSync(raw):raw;
  const crc=crc32(raw);
  const l=new Uint8Array(30+nameBytes.length),ld=new DataView(l.buffer);
  u32(ld,0,0x04034b50);u16(ld,4,20);u16(ld,6,0x0800);u16(ld,8,method);
  u32(ld,14,crc);u32(ld,18,packed.length);u32(ld,22,raw.length);
  u16(ld,26,nameBytes.length);l.set(nameBytes,30);
  locals.push(l,packed);
  const c=new Uint8Array(46+nameBytes.length),cd=new DataView(c.buffer);
  u32(cd,0,0x02014b50);u16(cd,4,20);u16(cd,6,20);
  u16(cd,8,0x0800);u16(cd,10,method);
  u32(cd,16,crc);u32(cd,20,packed.length);u32(cd,24,raw.length);
  u16(cd,28,nameBytes.length);u32(cd,42,at);c.set(nameBytes,46);
  central.push(c);at+=l.length+packed.length;
 }
 const end=new Uint8Array(22),ed=new DataView(end.buffer);
 u32(ed,0,0x06054b50);u16(ed,8,parts.length);u16(ed,10,parts.length);
 u32(ed,12,central.reduce((n,b)=>n+b.length,0));u32(ed,16,at);
 const chunks=[...locals,...central,end],out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));
 let pos=0;for(const chunk of chunks){out.set(chunk,pos);pos+=chunk.length;}
 return out;
}
function parts(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const d=new DataView(data.buffer,data.byteOffset,data.length);
 let end=-1;
 for(let i=data.length-22;i>=0;i--)if(d.getUint32(i,true)===0x06054b50){end=i;break;}
 assert.ok(end>0,'the output must contain a ZIP end-of-central-directory');
 let pos=d.getUint32(end+16,true);const count=d.getUint16(end+10,true),out=new Map();
 for(let i=0;i<count;i++){
  assert.equal(d.getUint32(pos,true),0x02014b50);
  const len=d.getUint16(pos+28,true),extra=d.getUint16(pos+30,true),
   comment=d.getUint16(pos+32,true),method=d.getUint16(pos+10,true);
  const name=dec.decode(data.subarray(pos+46,pos+46+len));
  const originalOffset=d.getUint32(pos+42,true);
  const p=originalOffset+30+d.getUint16(originalOffset+26,true)+
   d.getUint16(originalOffset+28,true),length=d.getUint32(pos+20,true);
  const packed=data.slice(p,p+length),raw=method===8?inflateRawSync(packed):packed;
  assert.equal(crc32(raw),d.getUint32(pos+16,true),'CRC verified '+name);
  out.set(name,{raw:Buffer.from(raw),compressed:Buffer.from(packed),method});
  pos+=46+len+extra+comment;
 }
 return out;
}
for(const method of [0,8]){
 test('surgical original DOCX patch preserves ALL untouched bytes, styles, headers, tables and media (ZIP method '+method+')',async()=>{
  const input=fixture({method});
  const source=parts(input);
  const output=await editOriginalDocxStrict(input,[
   {original:'原始岗位描述',text:'新的岗位描述'}
  ]);
  const after=parts(output);
  if(method===8&&process.env.HHBA_WORD_RENDER_QA_OUTPUT){
   const dir=process.env.HHBA_WORD_RENDER_QA_OUTPUT;
   mkdirSync(dir,{recursive:true});
   writeFileSync(dir+'/original-preserved-layout.docx',input);
   writeFileSync(dir+'/edited-preserved-layout.docx',output);
  }
  assert.deepEqual([...after.keys()],[...source.keys()]);
  const xml=after.get('word/document.xml').raw.toString();
  assert.ok(xml.includes('<w:t>新的岗位描述</w:t>'));
  assert.ok(!xml.includes('<w:t>原始岗位描述</w:t>'));
  assert.ok(xml.includes('<w:tbl>'));
  assert.ok(xml.includes('<w:color w:val="452786"/>'));
  assert.ok(xml.includes('<w:rFonts w:eastAsia="Noto Sans CJK SC"/>'));
  assert.ok(xml.includes('<w:rFonts w:eastAsia="Noto Serif CJK SC"/>'));
  assert.ok(xml.includes('<w:sz w:val="28"/>'));
  assert.ok(xml.includes('<w:i/>'));
  assert.ok(xml.includes('<w:color w:val="0C699A"/>'));
  assert.ok(xml.includes('<w:pgSz w:w="11906" w:h="16838"/>'));
  for(const [name,old] of source){
   if(name==='word/document.xml')continue;
   const current=after.get(name);
   assert.deepEqual(current.compressed,old.compressed,'compressed bytes identical: '+name);
   assert.equal(current.method,old.method,'compression preserved: '+name);
  }
  const inspection=await inspectOriginalDocxStrict(output);
  assert.ok(inspection.editable_text.includes('新的岗位描述'));
 });
}
test('Word inspection includes tail paragraphs and checks uniqueness beyond the first 100 text runs',async()=>{
 const all=await inspectOriginalDocxStrict(fixture({extraParagraphs:110}));
 assert.ok(all.editable_text.includes('虚构补充经历第109项'),
  'late resume content should still be independently editable');
 assert.ok(all.editable_text.includes('原始岗位描述'));
 const duplicate=await inspectOriginalDocxStrict(fixture({extraParagraphs:110,duplicateTail:true}));
 assert.ok(!duplicate.editable_text.includes('原始岗位描述'),
  'a duplicate after the old cutoff must disqualify BOTH positions');
 assert.ok(duplicate.editable_text.includes('虚构补充经历第109项'));
});
test('ambiguous, split-run, long and unconfirmed text must fail, never rebuild a new template',async()=>{
 await assert.rejects(
  ()=>editOriginalDocxStrict(fixture({duplicate:true}),
   [{original:'原始岗位描述',text:'新的岗位描述'}]),/WORD_EDIT_AMBIGUOUS/);
 await assert.rejects(
  ()=>editOriginalDocxStrict(fixture({split:true}),
   [{original:'原始岗位描述',text:'新的岗位描述'}]),/WORD_EDIT_AMBIGUOUS/);
 await assert.rejects(
  ()=>editOriginalDocxStrict(fixture(),
   [{original:'原始岗位描述',text:'这段文字会变得远远长于原来的可用位置'}]),/WORD_EDIT_TOO_LONG/);
 await assert.rejects(
  ()=>editOriginalDocxStrict(fixture(),
   [{original:'原始岗位描述',text:' 新的岗位描述 '}]),/WORD_EDIT_UNSAFE/);
});
test('reject malicious/macro-enabled inputs rather than preserve unexpected active content',async()=>{
 await assert.rejects(()=>editOriginalDocxStrict(fixture({macro:true}),[
  {original:'原始岗位描述',text:'新的岗位描述'}
 ]),/WORD_FILE_UNSUPPORTED/);
 await assert.rejects(()=>editOriginalDocxStrict(Uint8Array.from([0,1,2,3]),[
  {original:'原始岗位描述',text:'新的岗位描述'}
 ]),/WORD_FILE_UNSUPPORTED/);
});

test('production-facing Word export refuses to release files without trusted rendered-page proof',async()=>{
 const original=fixture({method:8});
 const edits=[{original:'原始岗位描述',text:'新的岗位描述'}];
 await assert.rejects(()=>prepareVerifiedOriginalDocxExport({
  original,edits
 }),/WORD_RENDERER_REQUIRED/);
 await assert.rejects(()=>prepareVerifiedOriginalDocxExport({
  original,edits,verifyLayout:async()=>({passed:false})
 }),/WORD_LAYOUT_NOT_VERIFIED/);
 await assert.rejects(()=>prepareVerifiedOriginalDocxExport({
  original,edits,verifyLayout:async()=>{throw Error('renderer unavailable');}
 }),/WORD_LAYOUT_NOT_VERIFIED/);
 let received=false;
 const approved=await prepareVerifiedOriginalDocxExport({
  original,edits,verifyLayout:async({original:src,edited,oldText,newText})=>{
   received=true;assert.deepEqual(Buffer.from(src),Buffer.from(original));
   assert.ok(edited.length>1000);assert.equal(oldText,'原始岗位描述');
   assert.equal(newText,'新的岗位描述');
   return {passed:true,page_count:1,changed_pixels:821,
    changed_region:{page:1,x:100,y:100,width:80,height:25}};
  }
 });
 assert.equal(received,true);
 assert.equal(approved.verified,true);
 assert.equal(approved.pageCount,1);
 assert.ok(parts(approved.bytes).get('word/document.xml').raw
  .toString().includes('新的岗位描述'));
});


test('V4 preserves long Word runs and more than twenty unique edits without changing unrelated ZIP members',async()=>{
 const source=fixture({extraParagraphs:25});
 const edits=Array.from({length:25},(_,i)=>({original:'虚构补充经历第'+i+'项',text:'原文可核实的工作经历第'+i+'项'}));
 edits.push({original:'原始岗位描述',text:'真实岗位描述'.repeat(70)});
 const result=await editOriginalDocxStrict(source,edits,{allowExpansion:true,unbounded:true});
 const inspected=await inspectOriginalDocxStrict(result,{unbounded:true});
 assert.ok(inspected.editable_text.includes(edits[25].text));
 for(const edit of edits)assert.ok(inspected.editable_text.includes(edit.text));
 await assert.rejects(()=>editOriginalDocxStrict(fixture({duplicate:true}),[{original:'原始岗位描述',text:'真实岗位描述'.repeat(70)}],{allowExpansion:true,unbounded:true}),/WORD_EDIT_AMBIGUOUS/);
});
