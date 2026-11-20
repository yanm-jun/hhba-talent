import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-rewrite.js';

const origin='https://preview.hhba.example';
const endpoint=origin+'/api/resume-rewrite';
const fakeEnv={
 HHBA_AUTH_ROLLOUT:'preview',
 HHBA_RESUME_REWRITE_ENABLED:'1',
 HHBA_AI_DEEPSEEK_API_KEY:'qa-only-key',
 HHBA_AI_DEEPSEEK_MODEL:'mock',
 HHBA_PNVS_AUTH_DB:{
  prepare(){
   return {
    bind(){
     return {
      first:async()=>({phone:'candidate',revoked:0,
       expires_at:new Date(Date.now()+60000).toISOString()})
     };
    },
    first:async()=>({role:'candidate'})
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
