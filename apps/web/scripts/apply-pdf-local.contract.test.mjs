import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 assertPdfBytes,pdfTextItemsToLines,extractPdfText,PDFResumeError,PDF_MAX_BYTES,PDF_MAX_PAGES
} from "../src/services/pdfProfile.mjs";
import {inferProfileFromText} from "../src/services/docxProfile.mjs";
function fakePdfBytes(){
 const b=new TextEncoder().encode("%PDF-1.5\n% synthetic local unit-test fixture\n%%EOF\n");
 return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}
function fakeLoader(items,numberOfPages=1){
 const recorded={settings:null,calls:[],destroyed:false};
 const loader=async()=>({
  getDocument(settings){
   recorded.settings=settings;
   return {
    promise:Promise.resolve({
     numPages:numberOfPages,
     async getPage(n){
      recorded.calls.push(n);
      return {async getTextContent(){return {items}},cleanup(){}};
     }
    }),
    async destroy(){recorded.destroyed=true}
   };
  }
 });
 return {loader,recorded};
}
test("PDF reading requires a real header and bounded size before invoking a parser",async()=>{
 assert.throws(()=>assertPdfBytes(new ArrayBuffer(0)),e=>e.code==="PDF_SIZE");
 const bytes=new TextEncoder().encode("not a PDF file with enough total bytes to parse");
 assert.throws(()=>assertPdfBytes(bytes.buffer),e=>e.code==="PDF_HEADER");
 assert.throws(()=>assertPdfBytes(new ArrayBuffer(PDF_MAX_BYTES+1)),e=>e.code==="PDF_SIZE");
});
test("PDF typed text locally becomes editable conservative fields, with no script execution",async()=>{
 const items=[
  {str:"姓名：",transform:[1,0,0,1,70,720]},
  {str:"示例求职者",transform:[1,0,0,1,128,720],hasEOL:true},
  {str:"邮箱：test@example.invalid",transform:[1,0,0,1,70,690],hasEOL:true},
  {str:"毕业院校：示例大学",transform:[1,0,0,1,70,660],hasEOL:true},
  {str:"最高学历：本科",transform:[1,0,0,1,70,630],hasEOL:true}
 ];
 const {loader,recorded}=fakeLoader(items);
 const found=await extractPdfText(fakePdfBytes(),{loadPdfJs:loader});
 const p=inferProfileFromText(found.text);
 assert.equal(found.pages,1);
 assert.equal(p.fullName,"示例求职者");
 assert.equal(p.email,"test@example.invalid");
 assert.equal(p.school,"示例大学");
 assert.equal(p.education,"本科");
 assert.equal(p.phone,"");
 assert.equal(p.experience,"");
 assert.deepEqual(recorded.calls,[1]);
 assert.equal(recorded.destroyed,true);
 assert.equal(recorded.settings.enableScripting,false);
 assert.equal(recorded.settings.isEvalSupported,false);
 assert.equal(recorded.settings.enableXfa,false);
 assert.equal(recorded.settings.disableAutoFetch,true);
 assert.ok(recorded.settings.data instanceof Uint8Array);
});
test("PDF text rows preserve label/value pairs and separate distinct lines",()=>{
 assert.deepEqual(pdfTextItemsToLines([
  {str:"姓",transform:[1,0,0,1,0,80]},
  {str:"名：",transform:[1,0,0,1,10,80]},
  {str:"张三",transform:[1,0,0,1,30,80]},
  {str:"邮箱：a@example.invalid",transform:[1,0,0,1,0,60]}
 ]),["姓名：张三","邮箱：a@example.invalid"]);
});
test("image-only PDF is not hallucinated; oversized page counts are rejected",async()=>{
 const blank=fakeLoader([],1);
 await assert.rejects(extractPdfText(fakePdfBytes(),{loadPdfJs:blank.loader}),e=>e.code==="PDF_NO_TEXT");
 assert.equal(blank.recorded.destroyed,true);
 const big=fakeLoader([],PDF_MAX_PAGES+1);
 await assert.rejects(extractPdfText(fakePdfBytes(),{loadPdfJs:big.loader}),e=>e.code==="PDF_PAGES");
 assert.deepEqual(big.recorded.calls,[]);
 assert.equal(big.recorded.destroyed,true);
});
test("malformed PDF or encrypted PDF fails with understandable errors",async()=>{
 const bad=await assert.rejects(extractPdfText(fakePdfBytes(),{
  loadPdfJs:async()=>({getDocument(){return{promise:Promise.reject(Object.assign(new Error("password"),{name:"PasswordException"})),async destroy(){}}}})
 }),e=>e.code==="PDF_PASSWORD");
 assert.equal(bad,undefined);
 const inactive=new AbortController();inactive.abort();
 await assert.rejects(extractPdfText(fakePdfBytes(),{signal:inactive.signal}),e=>e.name==="AbortError");
});
test("first-party parser is used only from local package and never from remote CDN",()=>{
 const pdf=readFileSync(new URL("../src/services/pdfProfile.mjs",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/components/ApplyResumeSync.tsx",import.meta.url),"utf8");
 assert.ok(pdf.includes('import("pdfjs-dist/build/pdf.mjs")'));
 assert.ok(pdf.includes('import("pdfjs-dist/build/pdf.worker.min.mjs?url")'));
 assert.ok(!/https?:\/\//.test(pdf));
 assert.ok(ui.includes('await fetchPrivateResumeForLocalReview(selectedFile)'));
 assert.ok(ui.includes('await extractPdfText(bytes)'));
 assert.ok(ui.includes("e.code==='PDF_NO_TEXT'"));
 assert.ok(ui.includes('checked={reviewed}')&&ui.includes('checked={consent}'));
});

function realMinimalPdf(){
 const stream="BT\n/F1 14 Tf\n45 720 Td\n(Name: Example Applicant) Tj\n0 -22 Td\n(Email: sample@example.invalid) Tj\nET\n";
 const objects=[
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  "<< /Length "+Buffer.byteLength(stream)+" >>\nstream\n"+stream+"endstream"
 ];
 let pdf="%PDF-1.4\n% synthetic public test document\n";
 const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(Buffer.byteLength(pdf));
  pdf+=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";
 }
 const startxref=Buffer.byteLength(pdf);
 pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,"0")+" 00000 n \n";
 pdf+="trailer\n<< /Root 1 0 R /Size "+(objects.length+1)+" >>\nstartxref\n"+startxref+"\n%%EOF";
 const buffer=Buffer.from(pdf,"latin1");
 return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
}
test("real pinned PDF.js parses a full synthetic one-page text PDF without remote service",async()=>{
 // Node 22 uses the official legacy build (Promise.try polyfilled);
 // the actual Edge/Vite browser path continues to load the modern build.
 const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
 pdfjs.GlobalWorkerOptions.workerSrc=new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",import.meta.url).href;
 const result=await extractPdfText(realMinimalPdf(),{loadPdfJs:async()=>pdfjs});
 assert.equal(result.pages,1);
 assert.match(result.text,/Example Applicant/);
 assert.match(result.text,/sample@example.invalid/);
});
