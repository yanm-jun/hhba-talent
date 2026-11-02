import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../functions/_lib/auth.js';
const preview='https://auth-check.hhba-talent.pages.dev';
function context(base,environment,method='GET',body=null,extras={}){
  return {env:environment,request:new Request(base+'/api/v1/auth/'+(method==='GET'?'status':'register'),{
    method,headers:{origin:base,'content-type':'application/json',...extras},
    body:body===null?undefined:JSON.stringify(body)
  })};
}
test('production auth defaults to disabled even with D1 binding',async()=>{
 const ctx=context('https://hhba-talent.pages.dev',{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'preview'});
 const r=await route(ctx);assert.equal(r.status,503);
});
test('production auth refuses to start without server-side password pepper',async()=>{
 const url='https://hhba-talent.pages.dev';
 let r=await route(context(url,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'production'}));
 assert.equal(r.status,503);
 r=await route(context(url,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'production',HHBA_AUTH_PASSWORD_PEPPER:'preview-contract-pepper-required-value-1234'}));
 assert.equal(r.status,200);
});
test('preview explicitly reports email provider unconfigured; no secrets are returned',async()=>{
 const r=await route(context(preview,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'preview',HHBA_AUTH_ALLOW_TEST_EMAIL:'1'}));
 assert.equal(r.status,200); const v=await r.json();
 assert.deepEqual(v,{email_delivery_configured:false,preview_test_email_enabled:true,password_recovery_available:false,phone_login_available:false});
});
test('QQ/Gmail real addresses cannot register while sender credentials are absent',async()=>{
 for(const email of ['person@qq.com','person@163.com','person@gmail.com','person@outlook.com']){
  const r=await route(context(preview,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'preview'},'POST',{
    email,password:'only-for-contract-test-1234',display_name:'Tester',account_type:'candidate'
  }));
  assert.equal(r.status,503,email);
 }
});
test('synthetic emails are rejected without explicit preview permission',async()=>{
 const r=await route(context(preview,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'preview'},'POST',{
  email:'person@example.test',password:'only-for-contract-test-1234',display_name:'Tester',account_type:'candidate'
 }));
 assert.equal(r.status,400);
});
test('request-origin tampering fails before credentials are read',async()=>{
 const r=await route(context(preview,{HHBA_AUTH_DB:{},HHBA_AUTH_ROLLOUT:'preview'},'POST',{
  email:'person@qq.com',password:'only-for-contract-test-1234',display_name:'Tester',account_type:'candidate'
 },{origin:'https://attacker.invalid'}));
 assert.equal(r.status,403);
});
