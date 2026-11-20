import test from 'node:test';
import assert from 'node:assert/strict';
import {patchPdfWithOriginalFont} from '../src/services/resumePdfNativeFont.mjs';

const enc=new TextEncoder(),dec=new TextDecoder('latin1');
const SOURCE='HELLO WORLD',EDITED='HELLO THERE';
function pdfFixture({font='Helvetica',filtered=false,signature=false,
 stream='BT /F1 18 Tf 45 760 Td (HELLO WORLD) Tj ET',duplicate=false}={}){
 const fontDetails='<< /Type /Font /Subtype /Type1 /BaseFont /'+font+' >>';
 const content='<< /Length '+stream.length+(filtered?' /Filter /FlateDecode':'')+
  ' >>\nstream\n'+stream+'\nendstream';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  fontDetails,
  content,
  ...(duplicate?['<< /Title (HELLO WORLD) >>']:[])
 ];
 let raw='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(raw.length);
  raw+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const xref=raw.length;
 raw+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))raw+=String(off).padStart(10,'0')+' 00000 n \n';
 raw+='trailer\n<< /Root 1 0 R /Size '+(objects.length+1)+
  (signature?' /ByteRange [0 10 20 30]':'')+
  ' >>\nstartxref\n'+xref+'\n%%EOF';
 return enc.encode(raw);
}
test('in-place edit preserves every PDF byte except the native literal glyphs',()=>{
 const source=pdfFixture(),{bytes,proof}=patchPdfWithOriginalFont(source,SOURCE,EDITED);
 assert.equal(bytes.length,source.length);
 assert.deepEqual({...proof,schema:'HHBA_PDF_NATIVE_FONT_V1'},proof);
 assert.equal(proof.fontName,'Helvetica');
 assert.equal(proof.oldText,SOURCE);assert.equal(proof.newText,EDITED);
 assert.equal(dec.decode(bytes).includes('(HELLO THERE) Tj'),true);
 assert.equal(dec.decode(bytes).includes('(HELLO WORLD) Tj'),false);
 const changed=[];
 for(let i=0;i<source.length;i++)if(source[i]!==bytes[i])changed.push(i);
 assert.ok(changed.length>0);
 assert.ok(changed.every(i=>i>=proof.offset&&i<proof.offset+proof.length));
 assert.equal(dec.decode(bytes.slice(0,proof.offset)),
  dec.decode(source.slice(0,proof.offset)));
 assert.equal(dec.decode(bytes.slice(proof.offset+proof.length)),
  dec.decode(source.slice(proof.offset+proof.length)));
 // Replacing glyphs must not reflow the object table or change the font object.
 assert.deepEqual(bytes.slice(0,60),source.slice(0,60));
});
test('preserves original standard font variation, never switches to HHBA styling',()=>{
 for(const font of ['Times-BoldItalic','Courier-Bold','Helvetica-Oblique']){
  const source=pdfFixture({font});
  const result=patchPdfWithOriginalFont(source,SOURCE,EDITED);
  assert.equal(result.proof.fontName,font);
  assert.ok(dec.decode(result.bytes).includes('/BaseFont /'+font));
 }
});
test('untrusted and ambiguous PDFs are rejected, not silently rasterized',()=>{
 const invalid=[
  [pdfFixture({filtered:true}),SOURCE,EDITED],
  [pdfFixture({font:'CustomCorporateFont'}),SOURCE,EDITED],
  [pdfFixture({duplicate:true}),SOURCE,EDITED],
  [pdfFixture({signature:true}),SOURCE,EDITED],
  [pdfFixture({stream:'BT /F1 18 Tf 45 760 Td (HELLO WORLD) Tj (X) Tj ET'}),SOURCE,EDITED],
  [pdfFixture(),'HELLO WORLD','HELLO THERE LONG'],
  [pdfFixture(),'HELLO WORLD','你好世界您好'],
  [pdfFixture(),'WRONG LABEL','HELLO THERE'],
  [pdfFixture(),'HELLO WORLD','HELLO WORLD']
 ];
 for(const [bytes,a,b] of invalid)
  assert.throws(()=>patchPdfWithOriginalFont(bytes,a,b),/PDF_NATIVE_(UNSUPPORTED|TEXT_UNSUPPORTED)/);
});
export {pdfFixture};
