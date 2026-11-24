import test from 'node:test';
import assert from 'node:assert/strict';
import {runSyntheticResumeAcceptance} from './v4-resume-live-acceptance.mjs';
import {reassessV4Document} from '../functions/_lib/v4-resume-reassess.js';
const env={HHBA_MATCH_V4_READY:'1',HHBA_AGENT_RELAY_API_KEY:'synthetic-placeholder-secret'};
const signal=new AbortController().signal;
test('isolated live acceptance runner patches actual DOCX then scores extracted original and edited bytes',async()=>{
 const records=[];
 const result=await runSyntheticResumeAcceptance({env,signal,report:r=>records.push(r),
  optimize:async({blocks,wanted})=>{
   assert.equal(wanted.length,3);
   return {suggestions:[{blockId:'a',action:'replace',original:blocks[0].text,
    proposed:'使用 Excel 汇总每周销售数据，向门店负责人汇报，并负责门店日常运营。'}],pendingIds:[]};
  },
  reassess:async({beforeBlocks,afterBlocks,jd})=>{
   assert.match(beforeBlocks[0].text,/负责门店日常运营，使用 Excel/);
   assert.match(afterBlocks[0].text,/使用 Excel 汇总每周销售数据/);
   assert.match(jd.full_jd,/门店经营数据分析/);
   return {supported:true,original_score:80,updated_score:78,delta:-2};
  }});
 assert.equal(result.status,'PASS');
 assert.equal(result.stages.docx.original_unchanged,true);
 assert.equal(result.stages.reassessment.delta,-2);
 assert.equal(result.layout,'NOT_PIXEL_VERIFIED');
 assert.equal(records.at(-1).status,'PASS');
});
test('a model omission or missing applicable suggestion cannot pass the diagnostic',async()=>{
 let calls=0;
 const result=await runSyntheticResumeAcceptance({env,signal,optimize:async({wanted})=>({suggestions:[],pendingIds:wanted}),reassess:async()=>{calls++;}});
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.stages.optimization.error,'QA_NO_PROGRESS');
 assert.equal(calls,0);
});
test('same V4 production score engine checks evidence in both actual input documents',async()=>{
 const jd={id:'synthetic',company:'虚构',title:'督导',location:'上海',full_jd:'负责门店运营数据分析。'};
 const beforeBlocks=[{text:'负责日常门店运营。'}],afterBlocks=[{text:'整理门店运营记录。'}];
 const scores=await reassessV4Document({env,jd,beforeBlocks,afterBlocks,signal,fetcher:async(_url,init)=>{
  const request=JSON.parse(init.body),input=JSON.parse(request.input);
  assert.equal(input.job.full_jd,jd.full_jd);
  assert.equal(input.before_resume,beforeBlocks[0].text);
  assert.equal(input.after_resume,afterBlocks[0].text);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
   before:{score:60,resume_quote:'负责日常门店运营',jd_quote:'门店运营数据分析',reason:'真实经历'},
   after:{score:99,resume_quote:'不存在的业绩',jd_quote:'门店运营数据分析',reason:'虚构依据'}
  })}]}]});
 }});
 assert.equal(scores.supported,false);
 assert.equal(scores.updated_score,undefined);
});


test('AI append becomes a complete editable Word replacement, preserving original facts and download bytes',async()=>{
 const {normalizeDocumentSuggestions}=await import('../functions/_lib/resume-ai-provider.js');
 const records=[];
 const result=await runSyntheticResumeAcceptance({env,signal,report:r=>records.push(r),
  optimize:async({blocks})=>{
   const original=blocks[0].text;
   const items=normalizeDocumentSuggestions(blocks,[
    {blockId:'a',action:'append',original:'incorrect model excerpt',proposed:'负责整理门店运营记录。'},
    {blockId:'b',action:'append',proposed:'新增\n跨段文字'},
    {blockId:'c',action:'replace',proposed:blocks[2].text}
   ]);
   assert.equal(items.length,1);
   assert.equal(items[0].action,'replace');
   assert.equal(items[0].original,original);
   assert.equal(items[0].proposed,original+'负责整理门店运营记录。');
   assert.deepEqual(normalizeDocumentSuggestions(blocks,[{blockId:'a',action:'append',proposed:original+'整理数据。'}])[0].proposed,original+'整理数据。');
   return {suggestions:items,pendingIds:[]};
  },
  reassess:async({beforeBlocks,afterBlocks})=>{
   assert.match(beforeBlocks[0].text,/每周销售数据并向门店负责人汇报。/);
   assert.match(afterBlocks[0].text,/每周销售数据并向门店负责人汇报。负责整理门店运营记录。/);
   return {supported:true,original_score:80,updated_score:80,delta:0};
  }});
 assert.equal(result.status,'PASS');
 assert.equal(result.stages.docx.edited_text_verified,true);
 assert.equal(result.stages.docx.original_unchanged,true);
});


test('all accepted edits must survive successive Word revisions before same-JD rescoring',async()=>{
 const result=await runSyntheticResumeAcceptance({env,signal,
  optimize:async({blocks})=>({pendingIds:[],suggestions:blocks.map(b=>({
   blockId:b.id,action:'replace',original:b.text,proposed:b.text+'（虚构测试改写）'
  }))}),
  reassess:async({beforeBlocks,afterBlocks})=>{
   assert.equal((beforeBlocks[0].text.match(/虚构测试改写/g)||[]).length,0);
   assert.equal((afterBlocks[0].text.match(/虚构测试改写/g)||[]).length,3);
   return {supported:true,original_score:80,updated_score:82,delta:2};
  }});
 assert.equal(result.status,'PASS');
 assert.equal(result.stages.docx.applied_edits,3);
 assert.equal(result.stages.docx.original_unchanged,true);
});
