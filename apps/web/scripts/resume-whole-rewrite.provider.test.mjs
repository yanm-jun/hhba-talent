import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTailoredResume,REWRITE_KIND} from '../functions/_lib/resume-rewrite-provider.js';

const env={HHBA_AI_DEFAULT_PROVIDER:'deepseek',
 HHBA_AI_DEEPSEEK_API_KEY:'local-mock-credential',
 HHBA_AI_DEEPSEEK_MODEL:'local-mock-model'};
const job={title:'全国区域督导',requirements:'分析销售漏斗、跨区域支持门店、数据复盘'};
function evidence(n){
 return Array.from({length:n},(_,i)=>({
  id:'experience-'+i,section:'experience',
  text:'参与区域门店业务复盘与客户跟进工作。'+
   ('负责日常数据汇总与工作沟通。'.repeat(36))+' 段落编号'+i+'。'
 }));
}
function fakeResponse(data){
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});
}
function mockProvider(blocks,{inventMetrics=false,rejectBlockId=null,planOrder=null}={}){
 const source=new Map(blocks.map(x=>[x.id,x.text])),calls=[];
 return {calls,fetch:async (url,init)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(init.headers.authorization,'Bearer local-mock-credential');
  assert.equal(init.redirect,'manual');
  const packet=JSON.parse(init.body);
  const system=packet.messages[0].content;
  const input=JSON.parse(packet.messages[1].content);
  calls.push({system,blocks:input.blocks?.length});
  if(system.includes('内容架构师'))
   return fakeResponse({focus:['门店复盘','跨区域支持'],
    ...(planOrder?{recommended_order:planOrder}:{}),questions:[]});
  if(system.includes('专业简历撰写者'))
   return fakeResponse({rewrites:input.blocks.map(b=>({
    blockId:b.id,
    text:inventMetrics&&b.id===blocks[0].id?
     b.text+'业绩提升 999%。':b.text.replace('参与区域门店业务复盘','协同区域门店业务复盘'),
    sourceQuotes:[b.text.slice(0,18)],
    rationale:'突出与实际岗位相符的门店分析经历',
    jobRequirements:['分析销售漏斗']
   })),questions:[]});
  if(system.includes('事实审查员'))
   return fakeResponse({checks:input.blocks.map(b=>({
    blockId:b.blockId,safe:b.blockId!==rejectBlockId,
    concern:b.blockId===rejectBlockId?'缺少工作结果证据':''
   }))});
  throw Error('unknown upstream prompt');
 }};
}
test('complete resume rewrite has NO 5-suggestion ceiling and reads every source block',async()=>{
 const blocks=evidence(19),upstream=mockProvider(blocks),before=globalThis.fetch;
 globalThis.fetch=upstream.fetch;
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.equal(result.kind,REWRITE_KIND);
  assert.equal(result.coverage.source_blocks,19);
  assert.equal(result.coverage.analyzed_blocks,19);
  assert.equal(result.coverage.proposed_rewrites,19);
  assert.equal(result.blocks.length,19);
  assert.ok(result.blocks.every(x=>x.changed&&x.status==='needs_user_confirmation'));
  assert.ok(upstream.calls.filter(x=>x.system.includes('专业简历撰写者')).length>1,
   'large resumes should be chunked without deleting later sections');
  assert.ok(upstream.calls.filter(x=>x.system.includes('事实审查员')).length>1);
 }finally{globalThis.fetch=before;}
});
test('rejects newly invented achievements and separately audited unsafe sections',async()=>{
 const blocks=evidence(2),upstream=mockProvider(blocks,{
  inventMetrics:true,rejectBlockId:'experience-1'
 }),before=globalThis.fetch;
 globalThis.fetch=upstream.fetch;
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.equal(result.coverage.proposed_rewrites,0);
  assert.equal(result.blocks[0].proposed,blocks[0].text);
  assert.equal(result.warnings[0].code,'UNSUPPORTED_NUMERIC_CLAIM');
  assert.equal(result.warnings[1].code,'AI_FACT_CHECK_REJECTED');
 }finally{globalThis.fetch=before;}
});
test('redacts personal contact data before every model call',async()=>{
 const blocks=[{id:'experience-0',section:'experience',
  text:'联系邮箱是 qa@example.org。负责真实门店记录整理工作。'}];
 const prior=globalThis.fetch,seen=[];
 globalThis.fetch=async(_url,init)=>{
  assert.doesNotMatch(init.body,/qa@example.org/);
  seen.push(init);
  const system=JSON.parse(init.body).messages[0].content;
  const input=JSON.parse(JSON.parse(init.body).messages[1].content);
  if(system.includes('内容架构师'))return fakeResponse({focus:[],questions:[]});
  if(system.includes('专业简历撰写者'))return fakeResponse({rewrites:input.blocks.map(b=>({
   blockId:b.id,text:'负责真实门店记录整理工作。',sourceQuotes:['负责真实门店记录整理工作。'],
   rationale:'表达真实经历',jobRequirements:[]})),questions:[]});
  return fakeResponse({checks:input.blocks.map(b=>({blockId:b.blockId,safe:true,concern:''}))});
 };
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.equal(result.blocks.length,1);
  assert.equal(result.blocks[0].original,blocks[0].text);
  assert.equal(result.blocks[0].proposed,'负责真实门店记录整理工作。');
  assert.equal(seen.length,3);
 }finally{globalThis.fetch=prior;}
});
test('model missing review evidence always retains original source',async()=>{
 const blocks=evidence(1),before=globalThis.fetch;
 globalThis.fetch=async(_url,init)=>{
  const system=JSON.parse(init.body).messages[0].content;
  if(system.includes('内容架构师'))return fakeResponse({focus:[],questions:[]});
  if(system.includes('专业简历撰写者'))
   return fakeResponse({rewrites:[{blockId:'experience-0',text:'具备高级管理能力',
    sourceQuotes:['不在原文的事实']}]});
  return fakeResponse({checks:[{blockId:'experience-0',safe:true}]});
 };
 try{
  const out=await generateTailoredResume({env,blocks,job});
  assert.equal(out.blocks[0].status,'kept_original');
  assert.equal(out.warnings[0].code,'SOURCE_QUOTE_NOT_FOUND');
 }finally{globalThis.fetch=before;}
});
test('vendor failure never returns a superficially successful half-resume',async()=>{
 const blocks=evidence(17),prev=globalThis.fetch;
 globalThis.fetch=async(_url,init)=>{
  const system=JSON.parse(init.body).messages[0].content;
  const data=JSON.parse(JSON.parse(init.body).messages[1].content);
  if(system.includes('内容架构师'))return fakeResponse({focus:[],questions:[]});
  if(system.includes('专业简历撰写者')){
   if(data.blocks[0].id!=='experience-0')return new Response('rate-limited',{status:429});
   return fakeResponse({rewrites:data.blocks.map(b=>({
    blockId:b.id,text:b.text,sourceQuotes:[b.text.slice(0,20)]}))});
  }
  return fakeResponse({checks:data.blocks.map(b=>({blockId:b.blockId,safe:true}))});
 };
 try{
  await assert.rejects(
   generateTailoredResume({env,blocks,job}),
   e=>e.message==='AI_PROVIDER_RATE_LIMITED');
 }finally{globalThis.fetch=prev;}
});

test('full resume planner may prioritize every existing block but may never omit or duplicate one',async()=>{
 const blocks=evidence(3),wanted=[blocks[2].id,blocks[0].id,blocks[1].id];
 const original=globalThis.fetch,provider=mockProvider(blocks,{planOrder:wanted});
 globalThis.fetch=provider.fetch;
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.deepEqual(result.recommended_order,wanted);
 }finally{globalThis.fetch=original;}
 const invalid=mockProvider(blocks,{planOrder:[blocks[0].id,blocks[0].id,blocks[1].id]});
 globalThis.fetch=invalid.fetch;
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.deepEqual(result.recommended_order,blocks.map(x=>x.id),
   'invalid model order must never silently drop a source paragraph');
 }finally{globalThis.fetch=original;}
});
test('cannot borrow a genuine numeric achievement from another employer block',async()=>{
 const blocks=[
  {id:'experience-a',section:'experience',text:'2023 年，负责 A 门店，完成 50 单。'},
  {id:'experience-b',section:'experience',text:'2024 年，负责 B 门店客户沟通。'}
 ];
 const original=globalThis.fetch;
 globalThis.fetch=async(_url,init)=>{
  const system=JSON.parse(init.body).messages[0].content;
  const input=JSON.parse(JSON.parse(init.body).messages[1].content);
  if(system.includes('内容架构师'))return fakeResponse({focus:['门店工作'],questions:[]});
  if(system.includes('专业简历撰写者')){
   return fakeResponse({rewrites:input.blocks.map(b=>({
    blockId:b.id,
    text:b.id==='experience-b'?b.text+'期间完成 50 单。':b.text,
    sourceQuotes:[b.text],
    rationale:'工作成果表达',jobRequirements:[]
   }))});
  }
  return fakeResponse({checks:input.blocks.map(b=>({
   blockId:b.blockId,safe:true,concern:''
  }))});
 };
 try{
  const result=await generateTailoredResume({env,blocks,job});
  assert.equal(result.blocks[1].status,'kept_original');
  assert.equal(result.blocks[1].proposed,blocks[1].text);
  assert.equal(result.warnings[0].blockId,'experience-b');
  assert.equal(result.warnings[0].code,'UNSUPPORTED_NUMERIC_CLAIM');
 }finally{globalThis.fetch=original;}
});
