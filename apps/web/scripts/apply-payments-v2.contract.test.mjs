import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyGatewayResponse} from '../functions/_lib/apply-billing.js';
import {verifiedTrade,reconcileOrder,closeUnpaidOrder} from '../functions/_lib/apply-payment-reconciliation.js';
import {validateAISuggestionRequest,filterAIChoices,aiConfigured,suggestSafeFields} from '../functions/_lib/apply-ai-suggest.js';
const k=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const env={ALIPAY_APP_ID:'2016090000000000',ALIPAY_SELLER_ID:'2088000000000000',
 ALIPAY_PUBLIC_KEY:k.publicKey,ALIPAY_PRIVATE_KEY_PKCS8:k.privateKey,
 HHBA_ALIPAY_NOTIFY_URL:'https://hhba.work/api/apply/alipay/notify'};
const order={id:'e1b3c580-b0ff-4dfb-bc04-74230fa9e2e0',amount_fen:300,status:'pending',provider_trade_no:null};
const status=(trade_status,more={})=>({trade_status,out_trade_no:order.id,
 seller_id:env.ALIPAY_SELLER_ID,total_amount:'3.00',trade_no:'2026110600000000001',...more});
test('only signed gateway JSON response is trusted and signature detects any change',async()=>{
 const body='{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","out_trade_no":"'+order.id+'"}';
 const sig=sign('RSA-SHA256',Buffer.from(body),k.privateKey).toString('base64');
 const raw='{"alipay_trade_query_response":'+body+',"sign":"'+sig+'"}';
 assert.equal((await verifyGatewayResponse(raw,'alipay.trade.query',k.publicKey)).trade_status,'TRADE_SUCCESS');
 assert.equal(await verifyGatewayResponse(raw.replace('TRADE_SUCCESS','TRADE_CLOSED'),'alipay.trade.query',k.publicKey),null);
 assert.equal(await verifyGatewayResponse('{"alipay_trade_query_response":'+body+'}','alipay.trade.query',k.publicKey),null);
});
test('matching merchant, cents, trade ID and order are all required',()=>{
 assert.equal(verifiedTrade(status('TRADE_SUCCESS'),order,env).status,'paid');
 assert.equal(verifiedTrade(status('TRADE_CLOSED'),order,env).status,'closed');
 assert.equal(verifiedTrade(status('WAIT_BUYER_PAY'),order,env).status,'pending');
 assert.equal(verifiedTrade(status('TRADE_SUCCESS',{seller_id:'wrong'}),order,env),null);
 assert.equal(verifiedTrade(status('TRADE_SUCCESS',{total_amount:'30.00'}),order,env),null);
 assert.equal(verifiedTrade(status('TRADE_SUCCESS',{out_trade_no:'different'}),order,env),null);
 assert.equal(verifiedTrade(status('TRADE_SUCCESS',{trade_no:''}),order,env),null);
});
function fakeDb(){
 const calls=[];
 return {calls,prepare(sql){return {bind(...args){return {async run(){calls.push({sql,args});return {success:true,meta:{changes:1}}}}}}}};
}
test('query reconciles pending once; never grants on unverified gateway fields',async()=>{
 const db=fakeDb(),mock=async(_env,method)=>{assert.equal(method,'alipay.trade.query');return status('TRADE_SUCCESS')};
 const res=await reconcileOrder(db,env,order,mock);
 assert.deepEqual({ok:res.ok,status:res.status},{ok:true,status:'paid'});
 assert.ok(db.calls[0].sql.includes("status='pending'"));
 const wrong=await reconcileOrder(db,env,order,async()=>status('TRADE_SUCCESS',{seller_id:'fake'}));
 assert.equal(wrong.ok,false);
});
test('order closing queries before closing and queries again after, no early credit loss',async()=>{
 let n=0;const db=fakeDb();
 const res=await closeUnpaidOrder(db,env,order,async(_env,method)=>{
  n++;if(n===1){assert.equal(method,'alipay.trade.query');return status('WAIT_BUYER_PAY')}
  if(n===2){assert.equal(method,'alipay.trade.close');return {out_trade_no:order.id}}
  assert.equal(method,'alipay.trade.query');return status('TRADE_CLOSED');
 });
 assert.equal(res.status,'closed');assert.equal(n,3);
 const paid=await closeUnpaidOrder(fakeDb(),env,order,async()=>status('TRADE_SUCCESS'));
 assert.equal(paid.error,'ORDER_ALREADY_PAID');
});
const sample={consentToExternalAi:true,profile:{fullName:'李明',email:'li@example.com',school:'某大学'},
 fields:[{id:'f1',label:'姓名',kind:'text'},{id:'f2',label:'身份证号码',kind:'text'},{id:'f3',label:'教育院校',kind:'text'}]};
test('AI input requires consent; blocks risky fields and never accepts raw applicant instructions',()=>{
 assert.equal(validateAISuggestionRequest({...sample,consentToExternalAi:false}),null);
 const v=validateAISuggestionRequest(sample);
 assert.deepEqual(v.fields.map(x=>x.id),['f1','f3']);
 assert.deepEqual(filterAIChoices({matches:[{id:'f1',key:'fullName',confidence:.93},
  {id:'f2',key:'fullName',confidence:1},{id:'f3',key:'school',confidence:.7}]},v.profile,v.fields),
  [{id:'f1',key:'fullName',value:'李明',confidence:.93}]);
});
test('AI off by default and enabled only with server secret AND disclosure gate',async()=>{
 const off=await suggestSafeFields({},sample,async()=>{throw Error('should not call')});
 assert.equal(off.error,'AI_NOT_ENABLED');
 const modelEnv={HHBA_APPLY_AI_ENABLED:'1',HHBA_AI_DISCLOSURE_APPROVED:'1',HHBA_AI_API_KEY:'test_not_a_real_secret_123456789'};
 assert.equal(aiConfigured(modelEnv),true);
 let sent;
 const fake=async(url,req)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  sent=JSON.parse(req.body);
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({matches:[
   {id:'f1',key:'fullName',confidence:.96},{id:'f2',key:'fullName',confidence:1}
  ]})}}]}),{status:200});
 };
 const got=await suggestSafeFields(modelEnv,sample,fake);
 assert.deepEqual(got.matches.map(x=>x.value),['李明']);
 assert.ok(!JSON.stringify(sent).includes('li@example.com'));
 assert.ok(!JSON.stringify(sent).includes('李明'));
});
