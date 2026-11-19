import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildRasterReviewPdf,createOriginalPdfReviewCopy
} from '../src/services/resumePdfReviewCopy.mjs';
const jpeg=Uint8Array.from(Buffer.from(
 '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6pooooA//2Q==',
 'base64'));
const page=()=>({jpeg,width:2,height:2,pageWidth:595.28,pageHeight:841.89});
test('preview PDF wraps pixel image, not editable or hidden original text',()=>{
 const bytes=buildRasterReviewPdf([page()]);
 const text=Buffer.from(bytes).toString('latin1');
 assert.match(text,/^%PDF-1\.4/);
 assert.match(text,/\/Type \/Catalog/);
 assert.match(text,/\/Type \/Pages \/Count 1/);
 assert.match(text,/\/Filter \/DCTDecode/);
 assert.match(text,/\/MediaBox \[0 0 595\.28 841\.89\]/);
 assert.match(text,/startxref/);
 assert.doesNotMatch(text,/ORIGINAL RESUME VIEW|EDITED RESUME VIEW/);
 assert.equal(bytes[bytes.length-1],10);
});
test('multi-page visual copy has correct parent links and xref entries',()=>{
 const pages=[page(),{...page(),pageWidth:612,pageHeight:792}];
 const bytes=buildRasterReviewPdf(pages);
 const str=Buffer.from(bytes).toString('latin1');
 assert.match(str,/\/Count 2 \/Kids \[3 0 R 6 0 R\]/);
 assert.equal((str.match(/\/Subtype \/Image/g)||[]).length,2);
 const pointer=/startxref\n(\d+)\n%%EOF/.exec(str);
 assert.ok(pointer);
 assert.ok(str.slice(Number(pointer[1])).startsWith('xref'));
 assert.equal((str.match(/ 0 obj\n/g)||[]).length,8);
});
test('invalid/corrupted JPEG, excessive pages and missing edits fail closed',async()=>{
 assert.throws(()=>buildRasterReviewPdf([]),/REVIEW_PAGE_LIMIT/);
 assert.throws(()=>buildRasterReviewPdf(Array(13).fill(page())),/REVIEW_PAGE_LIMIT/);
 assert.throws(()=>buildRasterReviewPdf([{...page(),jpeg:Uint8Array.of(1,2,3)}]),/REVIEW_IMAGE_INVALID/);
 assert.throws(()=>buildRasterReviewPdf([{...page(),pageHeight:-1}]),/REVIEW_SIZE_INVALID/);
 await assert.rejects(()=>createOriginalPdfReviewCopy({document:{numPages:1},
  layout:{schema:'HHBA_RESUME_VISUAL_LAYOUT_V1',page_count:1,regions:[]},
  changes:[]}),/REVIEW_NOT_EDITED/);
 await assert.rejects(()=>createOriginalPdfReviewCopy({document:{numPages:3},
  layout:{schema:'HHBA_RESUME_VISUAL_LAYOUT_V1',page_count:1,regions:[]},
  changes:[{id:'p1-r1',text:'new',original:'old',confirmed:true}]}),
 /REVIEW_LAYOUT_NOT_READY/);
});

test('searchable edited PDF carries full Unicode ToUnicode layer but never old replaced phrase',()=>{
 const pdf=buildRasterReviewPdf([{...page(),textRuns:[
  {text:'已修改简历（中文）',x:65,y:720,fontSize:15},
  {text:'New role 2026',x:70,y:690,fontSize:12}
 ]}],{searchable:true});
 const src=Buffer.from(pdf).toString('latin1');
 assert.match(src,/\/Subtype \/Type0/);
 assert.match(src,/\/ToUnicode \d+ 0 R/);
 assert.match(src,/\/CMapName \/HHBAUnicodeIdentity/);
 assert.match(src,/3 Tr 1 0 0 1/);
 assert.match(src,/5DF24FEE65397B805386/,'full UTF-16BE Chinese glyphs must be encoded');
 assert.equal(src.includes('ORIGINAL RESUME VIEW'),false);
 const trailer=/startxref\n(\d+)\n%%EOF/.exec(src);
 assert.ok(trailer,'searchable PDF has xref');
 assert.ok(src.slice(Number(trailer[1])).startsWith('xref'));
});
test('searchable export refuses oversized and invalid text to protect memory and user content',()=>{
 const row={...page(),textRuns:[{text:'ok',x:10,y:25,fontSize:12}]};
 assert.throws(()=>buildRasterReviewPdf([{...row,textRuns:[{...row.textRuns[0],fontSize:0}]}],
  {searchable:true}),/SEARCHABLE_TEXT_INVALID/);
 assert.throws(()=>buildRasterReviewPdf([{...row,textRuns:[{...row.textRuns[0],text:'x'.repeat(1800)}]}],
  {searchable:true}),/SEARCHABLE_TEXT_INVALID/);
 assert.throws(()=>buildRasterReviewPdf([{...row,textRuns:Array(3001).fill(row.textRuns[0])}],
  {searchable:true}),/SEARCHABLE_TEXT_LIMIT/);
});
