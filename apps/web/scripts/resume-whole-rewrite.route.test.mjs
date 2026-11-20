import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-rewrite.js';
import {onRequestPost as onContinuationStep} from '../functions/api/resume-rewrite-step.js';

const origin='https://preview.hhba.example';
const endpoint=origin+'/api/resume-rewrite';
const fakeEnv={
 HHBA_AUTH_ROLLOUT:'preview',
 HHBA_RESUME_REWRITE_ENABLED:'1',
 HHBA_RESUME_AGENT_ENABLED:'0',
 HHBA_AI_DEEPSEEK_API_KEY:'qa-only-key',
 HHBA_AI_DEEPSEEK_MODEL:'mock',
 HHBA_PNVS_AUTH_DB:{
  prepare(sql){
   return {
    bind(){
     return {
      first:async()=>sql.includes('hhba_auth_users')?
       {role:'candidate'}:{phone:'candidate',revoked:0,
        expires_at:new Date(Date.now()+60000).toISOString()},
      run:async()=>({success:true})
     };
    }
   };
  }
 }
};
const block={id:'experience-0',section:'experience',text:'参与门店运营与真实客户沟通。'};
const job={title:'门店运营督导',requirements:'负责门店运营与数据复盘'};
const payload={consent_ai:true,blocks:[block],job};
function request(body=payload,headers={}){
 return new Request(endpoint,{method:'POST',headers:{
  Origin:origin,'Content-Type':'application/json',
  Authorization:'Bearer qa-token',...headers
 },body:JSON.stringify(body)});
}
const respond=value=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
test('candidate-only full writer refuses unauthorized origin, absent consent and disabled flag',async()=>{
 const foreign=request(payload,{Origin:'https://bad.example'});
 assert.equal((await onRequestPost({env:fakeEnv,request:foreign})).status,403);
 assert.equal((await onRequestPost({env:fakeEnv,
  request:request({...payload,consent_ai:false})})).status,400);
 assert.equal((await onRequestPost({env:{...fakeEnv,HHBA_RESUME_REWRITE_ENABLED:'0'},
  request:request()})).status,503);
 const status=await (await onRequestGet({env:fakeEnv})).json();
 assert.equal(status.mode,'full_document_draft');
 assert.equal(status.enabled,true);
});
test('a complete response is returned only after model writer AND reviewer finish',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,options)=>{
  calls++;
  const input=JSON.parse(JSON.parse(options.body).messages[1].content);
  const system=JSON.parse(options.body).messages[0].content;
  if(system.includes('内容架构师'))return respond({focus:['运营'],questions:[]});
  if(system.includes('专业简历撰写者'))return respond({rewrites:[{
   blockId:block.id,text:'协助门店运营与真实客户沟通。',
   sourceQuotes:['参与门店运营与真实客户沟通。'],
   rationale:'更清晰呈现职责',jobRequirements:['门店运营']
  }]});
  assert.equal(input.blocks.length,1);
  return respond({checks:[{blockId:block.id,safe:true,concern:''}]});
 };
 try{
  const response=await onRequestPost({env:fakeEnv,request:request()});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.blocks[0].proposed,'协助门店运营与真实客户沟通。');
  assert.equal(body.blocks[0].status,'needs_user_confirmation');
  assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});
test('invalid huge bodies are rejected before a paid model call',async()=>{
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('model should never be called')};
 try{
  const response=await onRequestPost({env:fakeEnv,request:request({...payload,
   blocks:[{...block,text:'中'.repeat(150000)}]})});
  assert.equal(response.status,400);
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('production remains disabled without its own explicit switch',async()=>{
 const env={...fakeEnv,HHBA_AUTH_ROLLOUT:'disabled',
  HHBA_MATCH_RUNTIME_MODE:'production'};
 assert.equal((await (await onRequestGet({env})).json()).enabled,false);
 assert.equal((await onRequestPost({env,request:request()})).status,503);
});

test('preview opt-in can use model-directed editorial tools and disclose what happened',async()=>{
 const env={...fakeEnv,HHBA_RESUME_AGENT_ENABLED:'1'};
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,options)=>{
  calls++;
  const system=JSON.parse(options.body).messages[0].content;
  const input=JSON.parse(JSON.parse(options.body).messages[1].content);
  if(system.includes('内容架构师'))
   return respond({focus:['真实门店记录'],questions:[]});
  if(system.includes('专业简历撰写者'))
   return respond({rewrites:[{blockId:block.id,
    text:'协同门店运营，开展真实客户沟通与记录。',
    sourceQuotes:['参与门店运营与真实客户沟通。'],
    rationale:'事实范围内重组职责',jobRequirements:['门店运营']}]});
  if(system.includes('事实审查员'))
   return respond({checks:[{blockId:block.id,safe:true,concern:''}]});
  if(system.includes('自主简历总编辑')){
   assert.equal(input.sections[0].blockId,block.id);
   return respond({action:'finish',reason:'已完成可信的岗位定向版本'});
  }
  throw Error('unexpected model call');
 };
 try{
  const res=await onRequestPost({request:request(),env});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.autonomy.enabled,true);
  assert.deepEqual(body.autonomy.tools_used.map(x=>x.action),['finish']);
  assert.equal(body.coverage.proposed_rewrites,1);
  assert.equal(calls,4);
 }finally{globalThis.fetch=previous;}
});
test('model-directed quality pass outage does not erase the already audited source-backed draft',async()=>{
 const env={...fakeEnv,HHBA_RESUME_AGENT_ENABLED:'1'};
 const previous=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{
  const system=JSON.parse(options.body).messages[0].content;
  if(system.includes('内容架构师'))
   return respond({focus:['门店运营'],questions:[]});
  if(system.includes('专业简历撰写者'))
   return respond({rewrites:[{blockId:block.id,
    text:'协助门店运营与真实客户沟通。',
    sourceQuotes:['参与门店运营与真实客户沟通。']}]});
  if(system.includes('事实审查员'))
   return respond({checks:[{blockId:block.id,safe:true,concern:''}]});
  return new Response('service unavailable',{status:503});
 };
 try{
  const res=await onRequestPost({request:request(),env});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.match(body.blocks[0].proposed,/协助门店运营/);
  assert.equal(body.autonomy.stop_reason,'tool_unavailable');
  assert.equal(body.autonomy.needs_more_work,true);
 }finally{globalThis.fetch=previous;}
});

test('initial signed AI draft automatically continues through an actual second authenticated HTTP request',async()=>{
 const env={...fakeEnv,HHBA_RESUME_AGENT_ENABLED:'1',
  HHBA_RESUME_AGENT_CHECKPOINT_SECRET:'local-preview-only-'+ 'v'.repeat(70)};
 const before=globalThis.fetch;let controllerCalls=0;
 globalThis.fetch=async(_url,init)=>{
  const packet=JSON.parse(init.body);
  const system=packet.messages[0].content;
  const data=JSON.parse(packet.messages[1].content);
  if(system.includes('内容架构师'))return respond({focus:['运营'],questions:[]});
  if(system.includes('专业简历撰写者'))return respond({rewrites:[{
   blockId:block.id,text:'协助门店运营与真实客户沟通。',
   sourceQuotes:[block.text],rationale:'澄清已有职责',jobRequirements:[]
  }]});
  if(system.includes('事实审查员'))
   return respond({checks:[{blockId:block.id,safe:true,concern:''}]});
  if(system.includes('自主简历总编辑')){
   if(controllerCalls++===0)
    return respond({action:'inspect_source',
     sections:[{blockId:block.id,goal:'检查完整原文'}]});
   assert.equal(data.inspectedSections[0].source,block.text);
   assert.equal(data.previousActions[0].action,'inspect_source');
   return respond({action:'finish',reason:'本轮已完成'});
  }
  throw Error('unknown model prompt');
 };
 try{
  const initial=await onRequestPost({env,request:request()});
  assert.equal(initial.status,200);
  const first=await initial.json();
  assert.equal(first.autonomy.rounds,1);
  assert.equal(first.autonomy.needs_more_work,true);
  assert.equal(first.continuation.enabled,true);
  assert.match(first.continuation.checkpoint,/^h1\./);
  const followUp=new Request(endpoint.replace('resume-rewrite','resume-rewrite-step'),{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
    Authorization:'Bearer qa-token'},
   body:JSON.stringify({
    consent_ai:true,blocks:[block],job,draft:first,
    checkpoint:first.continuation.checkpoint
   })
  });
  const response=await onContinuationStep({env,request:followUp});
  assert.equal(response.status,200);
  const second=await response.json();
  assert.equal(second.autonomy.rounds,2);
  assert.deepEqual(second.autonomy.tools_used.map(x=>x.action),[
   'inspect_source','finish']);
  assert.equal(second.autonomy.needs_more_work,false);
  assert.equal(second.continuation.enabled,false);
  assert.equal(controllerCalls,2);
 }finally{globalThis.fetch=before;}
});
