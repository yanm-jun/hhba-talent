import test from 'node:test';
import assert from 'node:assert/strict';
import {
 VISION_SCHEMA,normalizeVisionLayout,analyzeOriginalPdf
} from '../functions/_lib/resume-visual-layout.js';

const sha='a'.repeat(64),pdf=new TextEncoder().encode('%PDF-1.7\n'+''.padEnd(50,' '));
const sample={
 page_count:2,layout_style:'two_columns',
 regions:[
  {page:1,kind:'experience',text:'某公司：完成测试任务',bbox:[80,180,440,175],confidence:.88},
  {page:2,kind:'skills',text:'沟通与整理',bbox:[100,230,720,120],confidence:.91},
 ],
 reading_order:[0,1]
};
test('Vision layout uses normalized page coordinates and never permits automatic PDF rewrite',()=>{
 const layout=normalizeVisionLayout(sample,sha);
 assert.equal(layout.schema,VISION_SCHEMA);
 assert.equal(layout.regions.length,2);
 assert.equal(layout.regions[0].placement_verified,false);
 assert.equal(layout.editable_in_original,false);
 assert.equal(layout.needs_review,true);
 assert.deepEqual(layout.regions[0].bbox,[80,180,440,175]);
 assert.equal(layout.layout,'two_columns');
});
test('untrusted model positions are validated and malformed / invented fields filtered',()=>{
 const layout=normalizeVisionLayout({
  ...sample,regions:[sample.regions[0],
   {...sample.regions[0],text:'坏位置',bbox:[990,900,100,150]},
   {...sample.regions[0],text:'',bbox:[100,100,200,200]},
   {...sample.regions[0],text:'可用段落',bbox:[100,300,250,200],kind:'fake',confidence:5}],
  reading_order:[0,-1,1,1000]
 },sha);
 assert.equal(layout.regions.length,2);
 assert.equal(layout.regions[1].kind,'other');
 assert.equal(layout.regions[1].confidence,1);
 assert.deepEqual(layout.reading_order,[0,1]);
 assert.throws(()=>normalizeVisionLayout({...sample,page_count:0},sha),/VISION_RESPONSE_INVALID/);
 assert.throws(()=>normalizeVisionLayout({...sample,regions:[]},sha),/VISION_RESPONSE_INVALID/);
});
test('PDF is privately sent only through an authenticated provider call with storage disabled',async()=>{
 let checked=false;
 const fakeFetch=async(url,options)=>{
  checked=true;
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.headers.Authorization,'Bearer synthetic-secret-not-real');
  assert.equal(options.redirect,'manual');
  const body=JSON.parse(options.body);
  assert.equal(body.store,false,'provider cannot persist AI output by default');
  assert.equal(body.input[0].content[0].type,'input_file');
  assert.equal(body.input[0].content[0].detail,'high');
  assert.ok(body.input[0].content[0].file_data.startsWith('data:application/pdf;base64,'));
  assert.equal(body.input[0].content[0].file_data.split(',')[1],Buffer.from(pdf).toString('base64'));
  return {status:200,ok:true,json:async()=>({
   output:[{content:[{type:'output_text',text:JSON.stringify(sample)}]}]
  })};
 };
 const layout=await analyzeOriginalPdf({
  env:{HHBA_AI_OPENAI_API_KEY:'synthetic-secret-not-real'},bytes:pdf,sha256:sha,
  fetchImpl:fakeFetch
 });
 assert.equal(checked,true);
 assert.equal(layout.model,'gpt-4.1-mini');
 assert.equal(layout.regions[1].text,'沟通与整理');
 assert.equal(layout.source_sha256,sha);
});
test('refuses invalid input and upstream redirects; no successful layout is fabricated',async()=>{
 await assert.rejects(()=>analyzeOriginalPdf({
  env:{HHBA_AI_OPENAI_API_KEY:'synthetic-secret-not-real'},
  bytes:new TextEncoder().encode('not-a-PDF'.padEnd(60,'.')),sha256:sha
 }),/VISION_NOT_PDF/);
 await assert.rejects(()=>analyzeOriginalPdf({
  env:{HHBA_AI_OPENAI_API_KEY:'synthetic-secret-not-real'},
  bytes:pdf,sha256:sha,fetchImpl:async()=>({status:302,ok:false})
 }),/VISION_PROVIDER_REDIRECT_BLOCKED/);
});
