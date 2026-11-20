import test from 'node:test';
import assert from 'node:assert/strict';
import {patchPdfWithOriginalCjkFont} from '../src/services/resumePdfCjkFont.mjs';

const source='中国测试',change='测试中国';
const latin=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));
const glyphs=['0001','0002','0003','0004'];
function fixture({missingFont=false,missingGlyph=false,filter=false,
 signed=false,changedCmap=false,extraRun=false}={}){
 const cmap=[
  '/CIDInit /ProcSet findresource begin',
  '12 dict begin','begincmap','/CMapName /HHBAChinese def',
  '1 begincodespacerange','<0000> <FFFF>','endcodespacerange',
  '4 beginbfchar',
  '<0001> <4E2D>','<0002> <56FD>','<0003> <6D4B>',
  '<0004> <'+(changedCmap?'4E0D':'8BD5')+'>',
  'endbfchar','endcmap','end','end',''
 ].join('\n');
 const stream='BT /F1 22 Tf 40 760 Td <'+glyphs.join('')+
  '> Tj'+(extraRun?' <0001> Tj':'')+' ET';
 const ttf=String.fromCharCode(0,1,0,0)+'synthetic-only-font-test';
 const items=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type0 /BaseFont /HHBATestFont /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>',
  '<< /Length '+stream.length+(filter?' /Filter /FlateDecode':'')+
   ' >>\nstream\n'+stream+'\nendstream',
  '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /HHBATestFont /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 8 0 R /CIDToGIDMap /Identity /DW 1000 >>',
  '<< /Length '+cmap.length+' >>\nstream\n'+cmap+'\nendstream',
  '<< /Type /FontDescriptor /FontName /HHBATestFont /Flags 4 /FontFile2 9 0 R >>',
  '<< /Length '+ttf.length+' >>\nstream\n'+
   (missingFont?'missing-font-content':ttf)+'\nendstream'
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<items.length;i++){
  offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+items[i]+'\nendobj\n';
 }
 const offset=pdf.length;
 pdf+='xref\n0 '+(items.length+1)+'\n0000000000 65535 f \n';
 for(const o of offsets.slice(1))pdf+=String(o).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(items.length+1)+' /Root 1 0 R '+
  (signed?'/ByteRange [0 6 8 2] ':'')+'>>\nstartxref\n'+offset+'\n%%EOF\n';
 return latin(pdf);
}
test('original embedded CID font is retained, only original hex text codes change',()=>{
 const original=fixture(),{bytes,proof}=patchPdfWithOriginalCjkFont(original,source,change);
 assert.equal(proof.schema,'HHBA_PDF_CJK_CID_V1');
 assert.equal(proof.fontName,'HHBATestFont');
 assert.equal(proof.oldGlyphs,'0001000200030004');
 assert.equal(proof.newGlyphs,'0003000400010002');
 assert.equal(original.length,bytes.length);
 let different=0;
 for(let i=0;i<bytes.length;i++){
  if(original[i]!==bytes[i]){
   different++;
   assert.ok(i>=proof.offset&&i<proof.offset+proof.length,
    'all font objects and non-target bytes must be bit-identical');
  }
 }
 assert.ok(different>2);
 assert.deepEqual(original.slice(0,proof.offset),bytes.slice(0,proof.offset));
 assert.deepEqual(original.slice(proof.offset+proof.length),
  bytes.slice(proof.offset+proof.length));
});
test('do not invent new CJK glyphs in subset font',()=>{
 const original=fixture();
 for(const text of ['中国升级','测试重点','测试中人']){
  assert.throws(()=>patchPdfWithOriginalCjkFont(original,source,text),
   /PDF_CJK_(GLYPH_NOT_PRESENT|TEXT_UNSUPPORTED)/);
 }
});
test('unknown font, bad CMap, filtered content, signature and extra text runs fail closed',()=>{
 for(const options of [{missingFont:true},{filter:true},{signed:true},
  {changedCmap:true},{extraRun:true}]){
  assert.throws(()=>patchPdfWithOriginalCjkFont(fixture(options),source,change),
   /PDF_CJK_(UNSUPPORTED|GLYPH_NOT_PRESENT|TEXT_UNSUPPORTED)/);
 }
});
test('modified target bytes or inaccurate original source cannot be replayed',()=>{
 assert.throws(()=>patchPdfWithOriginalCjkFont(fixture(),'中国测错',change),
  /PDF_CJK_UNSUPPORTED/);
 assert.throws(()=>patchPdfWithOriginalCjkFont(fixture(),source,source),
  /PDF_CJK_TEXT_UNSUPPORTED/);
});
