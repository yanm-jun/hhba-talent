import test from 'node:test';
import assert from 'node:assert/strict';
import {modelDecision,runResumeEditorialAgent}
 from '../functions/_lib/resume-rewrite-agent.js';
import {redacted,validateAuthoring,numberTokens}
 from '../functions/_lib/resume-rewrite-provider.js';

const blocks=[
 {id:'exp-1',section:'experience',text:'负责 A 店日常记录，2024 年完成 20 单。'},
 {id:'exp-2',section:'experience',text:'参与 B 店售后与客户回访。'}
];
const job={title:'区域督导',requirements:'协同多店、数据分析、客户回访'};
const draft={
 ok:true,kind:'HHBA_WHOLE_RESUME_REWRITE_V1',questions:[],warnings:[],
 blocks:blocks.map(b=>({
  blockId:b.id,section:b.section,original:b.text,
  proposed:b.text,changed:false,evidenceQuotes:[b.text],rationale:'原文事实',
  jobRequirements:[],status:'needs_user_confirmation'
 })),
 coverage:{source_blocks:2,analyzed_blocks:2,proposed_rewrites:0,held_for_review:0}
};
function agent(commands,env={}){
 let cursor=0,calls=[];
 const completeJson=async(_provider,system,data)=>{
  calls.push({system,data});
  if(system.includes('自主简历总编辑')){
   const command=commands[cursor++];
   assert.ok(command,'unexpected extra controller turn');
   return command;
  }
  if(system.includes('高级撰写者')){
   return {rewrites:data.sections.map(s=>({
    blockId:s.blockId,text:s.blockId==='exp-2'?
     '负责 B 店客户回访及售后反馈信息记录。':s.original,
    sourceQuotes:[s.original.slice(0,12)],
    rationale:'突出岗位相关的已有工作过程',
    jobRequirements:['客户回访']
   }))};
  }
  if(system.includes('独立事实审查员')){
   return {checks:data.blocks.map(b=>({blockId:b.blockId,safe:true,concern:''}))};
  }
  throw Error('unexpected system prompt');
 };
 return {
  calls,execute:()=>runResumeEditorialAgent({
   draft,blocks,job,env,provider:{name:'qa-write'},
   reviewer:{name:'qa-audit'},completeJson,
   validateAuthoring,numberTokens,redacted
  })
 };
}
test('model independently chooses inspect_source -> targeted rewrite -> finish',async()=>{
 const state=agent([
  {action:'inspect_source',sections:[{blockId:'exp-2',goal:'查看完整履历依据'}]},
  {action:'rewrite_sections',sections:[{blockId:'exp-2',goal:'更清楚地描述客户回访过程'}]},
  {action:'finish',reason:'正文已经完整'}
 ]);
 const out=await state.execute();
 assert.equal(out.autonomy.enabled,true);
 assert.deepEqual(out.autonomy.tools_used.map(t=>t.action),[
  'inspect_source','rewrite_sections','finish']);
 assert.equal(out.blocks[0].proposed,blocks[0].text);
 assert.equal(out.blocks[1].changed,true);
 assert.match(out.blocks[1].proposed,/售后反馈信息记录/);
 const inspect=state.calls.filter(x=>x.system.includes('自主简历总编辑'))[1].data;
 assert.ok(inspect.inspectedSections.some(x=>x.blockId==='exp-2'&&
  x.source.includes('客户回访')),'the model must see full original evidence on demand');
 assert.equal(out.autonomy.stop_reason,'model_finished');
});
test('model can stop immediately with zero pressure to rewrite for appearance',async()=>{
 const out=await agent([{action:'finish',reason:'现有文字已准确'}]).execute();
 assert.equal(out.autonomy.rounds,1);
 assert.equal(out.coverage.proposed_rewrites,0);
 assert.deepEqual(out.blocks.map(x=>x.proposed),blocks.map(x=>x.text));
});
test('model asks user a precise fact question rather than inventing experience',async()=>{
 const out=await agent([{action:'ask_user',questions:[{
  blockId:'exp-2',question:'是否还曾支援其他城市门店？',
  reason:'该岗位需要跨城市支援'
 }]}]).execute();
 assert.equal(out.autonomy.stop_reason,'user_evidence_requested');
 assert.match(out.questions[0].question,/其他城市门店/);
 assert.equal(out.blocks[1].proposed,blocks[1].text);
});
test('unlisted tool, unknown source ID, duplicate requests cannot run side effects',async()=>{
 assert.equal(modelDecision({action:'delete_database'},blocks.map(b=>b.id)).action,'finish');
 assert.equal(modelDecision({action:'rewrite_sections',sections:[
  {blockId:'unknown',goal:'做假业绩'}
 ]},blocks.map(b=>b.id)).action,'finish');
 const out=await agent([
  {action:'inspect_source',sections:[{blockId:'exp-2',goal:'读取证据'}]},
  {action:'inspect_source',sections:[{blockId:'exp-2',goal:'读取证据'}]}
 ]).execute();
 assert.equal(out.autonomy.stop_reason,'repeated_identical_action');
 assert.equal(out.autonomy.tools_used.at(-1).accepted,0);
});
test('enforced execution guard returns honest status, not fabricated final success',async()=>{
 const x=agent([
  {action:'inspect_source',sections:[{blockId:'exp-1',goal:'查原文'}]}
 ],{HHBA_RESUME_AGENT_MAX_PASSES:'1'});
 const out=await x.execute();
 assert.equal(out.autonomy.needs_more_work,true);
 assert.equal(out.autonomy.stop_reason,'execution_round_guard');
});
test('the independent reviewer inspects the ENTIRE revised paragraph, not only its visible excerpt',async()=>{
 const original=blocks[1],long=original.text+'工作过程与客户沟通。'.repeat(220);
 let audited=null,turn=0;
 const out=await runResumeEditorialAgent({
  draft,blocks,job,env:{},provider:{name:'qa'},reviewer:{name:'qa'},
  validateAuthoring,numberTokens,redacted,
  completeJson:async(_provider,system,data)=>{
   if(system.includes('自主简历总编辑')){
    return turn++===0?
     {action:'rewrite_sections',sections:[{blockId:original.id,goal:'细化事实描述'}]}:
     {action:'finish'};
   }
   if(system.includes('高级撰写者')){
    return {rewrites:[{blockId:original.id,text:long,
     sourceQuotes:[original.text],rationale:'细化已有的协作工作',jobRequirements:[]}]};
   }
   audited=data.blocks[0].proposed;
   return {checks:[{blockId:original.id,safe:true,concern:''}]};
  }
 });
 assert.ok(audited.length>1800,'audit model must get all text, not just the first 1800 characters');
 assert.equal(audited,long);
 assert.equal(out.blocks[1].proposed,long);
});
test('independent reviewer rejects a hallucination even if source quotes and number checks pass',async()=>{
 let turn=0;
 const out=await runResumeEditorialAgent({
  draft,blocks,job,env:{},provider:{name:'qa'},reviewer:{name:'qa'},
  validateAuthoring,numberTokens,redacted,
  completeJson:async(_provider,system)=>{
   if(system.includes('自主简历总编辑'))
    return turn++===0?
     {action:'rewrite_sections',sections:[{blockId:'exp-2',goal:'表现管理范围'}]}:
     {action:'finish'};
   if(system.includes('高级撰写者'))
    return {rewrites:[{blockId:'exp-2',
     text:'主管 B 店售后团队和客户回访工作。',sourceQuotes:['参与 B 店售后与客户回访。']}]};
   return {checks:[{blockId:'exp-2',safe:false,concern:'主管一词超出原始证据'}]};
  }
 });
 assert.equal(out.blocks[1].proposed,blocks[1].text);
 assert.ok(out.warnings.some(x=>x.code==='AI_AGENT_FACT_CHECK_REJECTED'));
});

test('large source remains fully accessible through AI-selected inspect_source, not an arbitrary snippet ceiling',async()=>{
 const source={id:'long-experience',section:'experience',
  text:'负责真实业务资料归档。'+'已有工作记录。'.repeat(220)};
 const originalBlocks=[source];
 const base={...draft,blocks:[{
  ...draft.blocks[0],blockId:source.id,original:source.text,
  proposed:source.text,changed:false
 }],coverage:{source_blocks:1,analyzed_blocks:1,proposed_rewrites:0,held_for_review:0}};
 let turn=0;
 const out=await runResumeEditorialAgent({
  draft:base,blocks:originalBlocks,job,env:{},provider:{name:'qa'},
  reviewer:{name:'qa'},validateAuthoring,numberTokens,redacted,
  completeJson:async(_provider,system,data)=>{
   assert.match(system,/自主简历总编辑/);
   if(turn++===0){
    assert.ok(data.sections[0].source.length<=750,
     'the overview must be compact to avoid overflowing long model contexts');
    return {action:'inspect_source',
     sections:[{blockId:source.id,goal:'理解该段完整工作记录'}]};
   }
   assert.equal(data.inspectedSections[0].source,source.text);
   return {action:'finish'};
  }
 });
 assert.equal(out.autonomy.stop_reason,'model_finished');
 assert.equal(out.autonomy.tools_used[0].action,'inspect_source');
 assert.equal(out.blocks[0].proposed,source.text);
});
