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
