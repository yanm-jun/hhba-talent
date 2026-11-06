import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAIKeyMapRequest,filterAIKeyMatches,suggestAIFieldKeys,aiConfigured} from '../functions/_lib/apply-ai-suggest.js';

const allowed={consentToExternalAi:true,profileKeys:['fullName','email','school','experience'],
 fields:[
  {id:'f1',label:'请填写应聘者称呼',kind:'text'},
  {id:'f2',label:'个人经历概述',kind:'textarea'},
  {id:'f3',label:'身份证号码',kind:'text'},
  {id:'f4',label:'联系邮箱 aa@example.com',kind:'text'}
 ]};
const validEnv={HHBA_APPLY_AI_ENABLED:'1',HHBA_AI_DISCLOSURE_APPROVED:'1',
 HHBA_AI_API_KEY:'test-not-real-integration-api-key-123456'};
test('V0.5 validates explicit consent, narrow profile key names and label-only payload',()=>{
 const v=validateAIKeyMapRequest(allowed);
 assert.deepEqual(v.profileKeys,['fullName','email','school','experience']);
 assert.deepEqual(v.fields.map(f=>f.id),['f1','f2']);
 assert.equal(validateAIKeyMapRequest({...allowed,consentToExternalAi:false}),null);
 assert.equal(validateAIKeyMapRequest({...allowed,profile:{fullName:'李明'}}),null);
 assert.equal(validateAIKeyMapRequest({...allowed,profileKeys:['fullName','admin']}),null);
 assert.equal(validateAIKeyMapRequest({...allowed,profileKeys:['fullName','fullName']}),null);
 assert.equal(validateAIKeyMapRequest({...allowed,fields:[{id:'f1',label:'姓名',kind:'text',value:'李明'}]}),null);
});
test('AI model only suggests allowed keys with high confidence and no returned user data',()=>{
 const v=validateAIKeyMapRequest(allowed);
 const mapped=filterAIKeyMatches({matches:[
  {id:'f1',key:'fullName',confidence:0.99,value:'伪造资料'},
  {id:'f2',key:'experience',confidence:0.92},
  {id:'f3',key:'fullName',confidence:1},
  {id:'f1',key:'email',confidence:1},
  {id:'f2',key:'school',confidence:0.3},
  {id:'f4',key:'email',confidence:0.99},
  {id:'f5',key:'school',confidence:1},
 ]},v.profileKeys,v.fields);
 assert.deepEqual(mapped,[
  {id:'f1',key:'fullName',confidence:.99},
  {id:'f2',key:'experience',confidence:.92}
 ]);
 assert.ok(!JSON.stringify(mapped).includes('伪造资料'));
});
test('model fetch gated off by default; in mock only safe labels and names leave server',async()=>{
 assert.equal(aiConfigured({}),false);
 const off=await suggestAIFieldKeys({},allowed,()=>{throw Error('must not be called')});
 assert.equal(off.error,'AI_NOT_ENABLED');
 let providerRequest;
 const fetched=async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  providerRequest=JSON.parse(options.body);
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{
   content:JSON.stringify({matches:[{id:'f1',key:'fullName',confidence:.95},{id:'f3',key:'email',confidence:1}]})
  }}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const got=await suggestAIFieldKeys(validEnv,allowed,fetched);
 assert.equal(got.ok,true);
 assert.deepEqual(got.matches,[{id:'f1',key:'fullName',confidence:.95}]);
 assert.equal(providerRequest.model,'deepseek-flash');
 assert.deepEqual(providerRequest.thinking,{type:'disabled'});
 const serialized=JSON.stringify(providerRequest);
 assert.ok(!serialized.includes('aa@example.com'));
 assert.ok(!serialized.includes('身份证号码'));
 assert.ok(!serialized.includes('李明'));
 assert.ok(!serialized.includes('伪造资料'));
});
test('model errors and blank JSON fail closed with no applicant value',async()=>{
 const bad=await suggestAIFieldKeys(validEnv,allowed,async()=>new Response('not found',{status:404}));
 assert.equal(bad.error,'AI_PROVIDER_UNAVAILABLE');
 const empty=await suggestAIFieldKeys(validEnv,allowed,async()=>new Response(JSON.stringify({choices:[{message:{content:''}}]})));
 assert.equal(empty.error,'AI_INVALID_RESPONSE');
});
