import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-optimize.js';

const url='https://preview.hhba.example/api/resume-optimize';
const base={
 consent_ai:true,
 blocks:[{id:'experience-0',section:'experience',text:'负责门店运营'}],
 job:{title:'区域督导',requirements:'运营和团队协作'}
};
function mockEnv(){
 const records=[];
 const db={prepare(sql){return{
  first:async()=>({name:'hhba_resume_optimization_requests'}),
  bind(...args){return{
   first:async()=>sql.includes('hhba_auth_users')?{role:'candidate'}:{
    phone:'person',revoked:0,expires_at:new Date(Date.now()+60000).toISOString()
   },
   run:async()=>{
    if(sql.startsWith('INSERT INTO hhba_resume_optimization_requests')){
     if(records.length>=3)return {success:true,meta:{changes:0}};
     records.push(args);return {success:true,meta:{changes:1}};
    }
    return {success:true,meta:{changes:1}};
   }
  }}
 }}};
 return {env:{
  HHBA_AUTH_ROLLOUT:'preview',HHBA_RESUME_OPTIMIZATION_ENABLED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'long-test-pepper-long-test-pepper',
  HHBA_PNVS_AUTH_DB:db,
  HHBA_AI_DEFAULT_PROVIDER:'openai',
  HHBA_AI_OPENAI_API_KEY:'placeholder',
  HHBA_AI_OPENAI_MODEL:'test-model'
 },records};
}
function request(body=base,origin='https://preview.hhba.example',auth=true){
 return new Request(url,{method:'POST',headers:{
  Origin:origin,...(auth?{Authorization:'Bearer example'}:{})
 },body:JSON.stringify(body)});
}
test('refuses cross-origin requests and missing authentication',async()=>{
 const h=mockEnv();
 assert.equal((await onRequestPost({request:request(base,'https://elsewhere.example'),env:h.env})).status,403);
 assert.equal((await onRequestPost({request:request(base,undefined,false),env:h.env})).status,401);
 assert.equal((await onRequestPost({request:request({...base,consent_ai:false}),env:h.env})).status,400);
 assert.equal(h.records.length,0);
});
test('feature status fails closed when disabled',async()=>{
 const h=mockEnv();
 h.env.HHBA_RESUME_OPTIMIZATION_ENABLED='0';
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 assert.equal((await onRequestPost({request:request(),env:h.env})).status,503);
});

test('generates suggestions with user confirmation and enforces daily quota',async()=>{
 const h=mockEnv();
 const previous=globalThis.fetch;
 let count=0;
 globalThis.fetch=async (_url,options)=>{
  count++;
  const submitted=JSON.parse(options.body);
  const input=JSON.parse(submitted.messages[1].content);
  assert.equal(input.blocks[0].text,base.blocks[0].text);
  return Response.json({choices:[{message:{content:JSON.stringify({suggestions:[{
   id:'suggestion-0',blockId:'experience-0',action:'replace',
   original:base.blocks[0].text,proposed:'统筹门店日常运营',
   rationale:'使用更清晰的动词',jobRequirement:'运营和团队协作',
   evidenceStatus:'verified'
  }]})}}]});
 };
 try{
  for(let i=0;i<3;i++){
   const result=await onRequestPost({request:request(),env:h.env});
   assert.equal(result.status,200);
   const output=await result.json();
   assert.equal(output.suggestions[0].original,base.blocks[0].text);
   assert.equal(output.suggestions[0].evidenceStatus,'needs_user_confirmation');
  }
  assert.equal((await onRequestPost({request:request(),env:h.env})).status,429);
  assert.equal(count,3);
 }finally{globalThis.fetch=previous;}
});
