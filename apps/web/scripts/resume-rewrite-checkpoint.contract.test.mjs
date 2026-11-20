import test from 'node:test';
import assert from 'node:assert/strict';
import {issueCheckpoint,verifyCheckpoint}
 from '../functions/_lib/resume-rewrite-checkpoint.js';
import {onRequestPost}
 from '../functions/api/resume-rewrite-step.js';

const origin='https://preview.hhba.example';
const blocks=[{id:'experience-0',section:'experience',
 text:'参与门店运营和真实的客户服务工作。'}];
const job={title:'区域督导',requirements:'门店运营与客户服务'};
const state={
 ok:true,kind:'HHBA_WHOLE_RESUME_REWRITE_V1',provider:'mock',
 reviewer:'mock',recommended_order:['experience-0'],
 blocks:[{blockId:'experience-0',section:'experience',
  original:blocks[0].text,proposed:'协助门店运营和真实客户服务工作。',
  changed:true,evidenceQuotes:[blocks[0].text],rationale:'强调真实工作',
  jobRequirements:['门店运营'],status:'needs_user_confirmation'}],
 questions:[],warnings:[],
 coverage:{source_blocks:1,analyzed_blocks:1,proposed_rewrites:1,held_for_review:0},
 autonomy:{enabled:true,rounds:1,stop_reason:'execution_round_guard',
  needs_more_work:true,previous_signature:'',
  inspected_ids:['experience-0'],tools_used:[{action:'inspect_source',
   sections:['experience-0'],accepted:1}]},
 disclaimer:'synthetic QA'
};
const secret='qa-only-hhba-checkpoint-'+ 'x'.repeat(70);
const env={
 HHBA_AUTH_ROLLOUT:'preview',HHBA_RESUME_REWRITE_ENABLED:'1',
 HHBA_RESUME_AGENT_CHECKPOINT_SECRET:secret,
 HHBA_AI_DEEPSEEK_API_KEY:'local-mock-key',HHBA_AI_DEEPSEEK_MODEL:'mock',
 HHBA_PNVS_AUTH_DB:{prepare(sql){return {bind(){return {
  first:async()=>sql.includes('hhba_auth_users')?{role:'candidate'}:
   {phone:'candidate',revoked:0,
    expires_at:new Date(Date.now()+60000).toISOString()},
  run:async()=>({success:true})
 }}}}}
};
const account='candidate';
function request(token,draft=state,owner=origin){
 return new Request(origin+'/api/resume-rewrite-step',{
  method:'POST',
  headers:{Origin:owner,'Content-Type':'application/json',
   Authorization:'Bearer local-qa-session'},
  body:JSON.stringify({consent_ai:true,blocks,job,draft,checkpoint:token})
 });
}
const response=value=>Response.json({choices:[{finish_reason:'stop',
 message:{content:JSON.stringify(value)}}]});

test('checkpoint is signed over user, source, JD, prior audited draft and expiry',async()=>{
 const now=Date.now(),token=await issueCheckpoint({env,account,blocks,job,draft:state,now});
 assert.match(token,/^h1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.equal(await verifyCheckpoint({env,account,blocks,job,draft:state,token,now}),true);
 for(const mutation of [
  {account:'another-user'},
  {blocks:[{...blocks[0],text:'伪造：负责全国全部门店。'}]},
  {job:{...job,requirements:'公司机密招聘信息'}},
  {draft:{...state,blocks:[{...state.blocks[0],proposed:'拥有未经证明的高层管理经验'}]}}
 ]){
  await assert.rejects(
   verifyCheckpoint({env,account,blocks,job,draft:state,token,now,...mutation}),
   e=>e.message==='AI_CHECKPOINT_INVALID');
 }
 await assert.rejects(
  verifyCheckpoint({env,account,blocks,job,draft:state,token,
   now:now+3600001}),
  e=>e.message==='AI_CHECKPOINT_EXPIRED');
});
test('signed previous inspect_source result becomes authenticated next-turn model context',async()=>{
 const token=await issueCheckpoint({env,account,blocks,job,draft:state});
 const previous=globalThis.fetch,requests=[];
 globalThis.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);
  requests.push(body);
  assert.equal(body.thinking.type,'enabled');
  const context=JSON.parse(body.messages[1].content);
  assert.equal(context.previousActions[0].action,'inspect_source');
  assert.equal(context.inspectedSections[0].source,blocks[0].text);
  return response({action:'finish',reason:'初稿事实完整，无需继续修改'});
 };
 try{
  const result=await onRequestPost({request:request(token),env});
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(requests.length,1);
  assert.equal(body.autonomy.rounds,2);
  assert.deepEqual(body.autonomy.tools_used.map(x=>x.action),['inspect_source','finish']);
  assert.equal(body.autonomy.needs_more_work,false);
  assert.equal(body.continuation.enabled,false);
  assert.equal(body.blocks[0].proposed,state.blocks[0].proposed);
 }finally{globalThis.fetch=previous;}
});
test('tampered or cross-origin checkpoint is refused BEFORE any paid model request',async()=>{
 const token=await issueCheckpoint({env,account,blocks,job,draft:state});
 const prev=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('model should not be invoked')};
 try{
  const forged={...state,blocks:[{...state.blocks[0],
   proposed:'虚构高级管理履历'}]};
  const invalid=await onRequestPost({request:request(token,forged),env});
  assert.equal(invalid.status,409);
  assert.equal((await invalid.json()).error,'AI_CHECKPOINT_INVALID');
  const foreign=await onRequestPost({request:request(token,state,'https://bad.example'),env});
  assert.equal(foreign.status,403);
  assert.equal(calls,0);
 }finally{globalThis.fetch=prev;}
});
test('next inspect_source step is resumable again and server signs the new state',async()=>{
 const token=await issueCheckpoint({env,account,blocks,job,draft:state});
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>response({action:'inspect_source',
  sections:[{blockId:'experience-0',goal:'重新核对原文'}]});
 try{
  const result=await onRequestPost({request:request(token),env});
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.autonomy.stop_reason,'repeated_identical_action');
  assert.equal(data.autonomy.needs_more_work,false);
 }finally{globalThis.fetch=previous;}
});
