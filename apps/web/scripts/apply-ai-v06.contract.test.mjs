import test from 'node:test';
import assert from 'node:assert/strict';
import {
 AI_MODEL,AI_MAX_OUTPUT_TOKENS,extensionAIConfigured,providerKeyConfigured,
 makeAIRequest,parseAIUsage,classifyAIError,runAIFieldMap,publicAIResponse
} from '../functions/_lib/apply-ai-runtime.js';
import {reserveAIUsage,recordAIUsage,boundedAIUsage} from '../functions/_lib/apply-ai-usage.js';
import {onRequest} from '../functions/api/apply/[[path]].js';

const input={consentToExternalAi:true,profileKeys:['fullName','school','experience'],
 fields:[{id:'f1',label:'请写你的称呼',kind:'text'},
 {id:'f2',label:'学校信息',kind:'text'},
 {id:'f3',label:'身份证号码',kind:'text'},
 {id:'f4',label:'联系人 a@example.com',kind:'text'}]};
const env={HHBA_APPLY_AI_ENABLED:'1',HHBA_AI_DISCLOSURE_APPROVED:'1',
 HHBA_APPLY_EXTENSION_AI_ENABLED:'1',
 HHBA_AI_API_KEY:'integration-test-key-not-a-real-secret-123456789'};
function provider({matches=[{id:'f1',key:'fullName',confidence:.95},
 {id:'f2',key:'school',confidence:.98},{id:'f3',key:'fullName',confidence:1}],
 usage={prompt_tokens:200,prompt_cache_hit_tokens:50,completion_tokens:40,total_tokens:240},
 finish_reason='stop'}={}){
 return new Response(JSON.stringify({choices:[{finish_reason,message:{content:JSON.stringify({matches})}}],usage}),
  {status:200,headers:{'Content-Type':'application/json'}});
}
test('provider credentials, consent and operator flags are required for real calls',async()=>{
 assert.equal(providerKeyConfigured({}),false);
 assert.equal(extensionAIConfigured(env),true);
 assert.equal(extensionAIConfigured({...env,HHBA_APPLY_EXTENSION_AI_ENABLED:'0'}),false);
 assert.equal(extensionAIConfigured({...env,HHBA_AI_DISCLOSURE_APPROVED:'0'}),false);
 const disabled=await runAIFieldMap({...env,HHBA_APPLY_EXTENSION_AI_ENABLED:'0'},input,
  async()=>{throw Error('MUST_NOT_CALL')});
 assert.deepEqual({ok:disabled.ok,error:disabled.error,attempts:disabled.attempts},
  {ok:false,error:'AI_NOT_ENABLED',attempts:0});
 const noConsent=await runAIFieldMap(env,{...input,consentToExternalAi:false},
  async()=>{throw Error('MUST_NOT_CALL')});
 assert.equal(noConsent.error,'INVALID_AI_REQUEST');
});
test('DeepSeek Flash uses JSON output, explicitly nonthinking and max 500 output tokens',()=>{
 assert.equal(AI_MODEL,'deepseek-flash');
 assert.equal(AI_MAX_OUTPUT_TOKENS,500);
 const request=makeAIRequest(input);
 assert.equal(request.model,'deepseek-flash');
 assert.deepEqual(request.thinking,{type:'disabled'});
 assert.deepEqual(request.response_format,{type:'json_object'});
 assert.equal(request.max_tokens,500);
 const serialized=JSON.stringify(request);
 assert.ok(!serialized.includes('a@example.com'));
 assert.ok(!serialized.includes('身份证号码'));
 assert.ok(!serialized.includes('integration-test-key'));
 assert.equal(makeAIRequest({...input,profileValues:{fullName:'假信息'}}),null);
});
test('mocked real provider response returns safe key suggestions and sanitized usage',async()=>{
 let called=false;
 const fake=async(url,opts)=>{
  called=true;
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(opts.headers.Authorization,'Bearer '+env.HHBA_AI_API_KEY);
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.redirect,'error');
  const body=JSON.parse(opts.body);
  assert.ok(!JSON.stringify(body).includes('a@example.com'));
  assert.ok(!JSON.stringify(body).includes('身份证号码'));
  return provider();
 };
 const result=await runAIFieldMap(env,input,fake);
 assert.equal(called,true);assert.equal(result.ok,true);assert.equal(result.attempts,1);
 assert.deepEqual(result.matches,[
  {id:'f1',key:'fullName',confidence:.95},
  {id:'f2',key:'school',confidence:.98}
 ]);
 assert.deepEqual(result.usage,{promptTokens:200,cacheHitTokens:50,completionTokens:40,
  totalTokens:240,estimatedPeakMicroUsd:94,hasUsage:true});
 const publicResult=publicAIResponse(result);
 assert.ok(!('usage' in publicResult));
 assert.ok(!('model' in publicResult));
 assert.ok(!('attempts' in publicResult));
 assert.ok(!JSON.stringify(publicResult).includes('a@example.com'));
});
test('usage upper bound uses published PEAK reference rates and safe numeric input',()=>{
 const u=parseAIUsage({usage:{prompt_tokens:200,prompt_cache_hit_tokens:50,completion_tokens:40}});
 assert.equal(u.estimatedPeakMicroUsd,94);
 assert.deepEqual(boundedAIUsage(u),{prompt:200,cached:50,completion:40,costUpper:94});
 assert.equal(parseAIUsage({usage:{prompt_tokens:-3,completion_tokens:'too many'}}).promptTokens,0);
 assert.equal(parseAIUsage(null).hasUsage,false);
});
test('unauthorized and insufficient balance statuses fail without retry',async()=>{
 for(const [status,error] of [[401,'AI_PROVIDER_AUTH_REJECTED'],[402,'AI_PROVIDER_INSUFFICIENT_BALANCE'],
 [422,'AI_PROVIDER_INVALID_REQUEST']]){
  let calls=0;
  const res=await runAIFieldMap(env,input,async()=>{calls++;return new Response('secret provider error',{status})});
  assert.equal(res.ok,false);assert.equal(res.error,error);assert.equal(calls,1);
 }
 assert.equal(classifyAIError(503),'AI_PROVIDER_UNAVAILABLE');
});
test('429 is retried at most once, with bounded wait and no leak',async()=>{
 let calls=0,waits=[];
 const result=await runAIFieldMap(env,input,async()=>{
  calls++;return calls===1?new Response('busy',{status:429,headers:{'Retry-After':'1'}}):provider();
 },async ms=>waits.push(ms));
 assert.equal(result.ok,true);assert.equal(result.attempts,2);
 assert.deepEqual(waits,[900]);
 assert.equal(calls,2);
 const fail=await runAIFieldMap(env,input,async()=>new Response('busy',{status:429}),async()=>{});
 assert.equal(fail.ok,false);assert.equal(fail.attempts,2);
 assert.equal(fail.error,'AI_PROVIDER_RATE_LIMITED');
});
test('network ambiguity and truncation fail closed without fabricated results',async()=>{
 const network=await runAIFieldMap(env,input,async()=>{throw Error('sensitive upstream response here')});
 assert.equal(network.error,'AI_PROVIDER_NETWORK_ERROR');
 assert.equal(network.attempts,1);
 assert.ok(!JSON.stringify(publicAIResponse(network)).includes('sensitive'));
 const truncated=await runAIFieldMap(env,input,async()=>provider({finish_reason:'length'}));
 assert.equal(truncated.error,'AI_PROVIDER_INCOMPLETE');
 const malformed=await runAIFieldMap(env,input,async()=>new Response(JSON.stringify({
  choices:[{finish_reason:'stop',message:{content:'NOT JSON'}}]
 }),{status:200}));
 assert.equal(malformed.error,'AI_PROVIDER_INVALID_RESPONSE');
});
test('quota uses atomic D1 insert and only sanitized cost counters are persisted',async()=>{
 const statements=[];
 const db={prepare(sql){return {bind(...args){statements.push({sql,args});return {
  async run(){return {success:true,meta:{changes:1}}}
 }}}}};
 const reserved=await reserveAIUsage(db,'13800138000','safe-ai-id',Date.UTC(2026,10,7,4));
 assert.equal(reserved,true);
 assert.ok(statements[0].sql.includes('SELECT COUNT(*)'));
 assert.ok(statements[0].sql.includes("status,model"));
 assert.ok(statements[0].sql.includes('created_at>=?'));
 const recorded=await recordAIUsage(db,'13800138000','safe-ai-id',
  {ok:true,attempts:1,usage:parseAIUsage({usage:{
   prompt_tokens:200,prompt_cache_hit_tokens:50,completion_tokens:40
  }})},Date.UTC(2026,10,7,4),Date.UTC(2026,10,7,4,0,2));
 assert.equal(recorded,true);
 assert.ok(statements[1].sql.includes("status='reserved'"));
 assert.deepEqual(statements[1].args.slice(0,8),['ok',1,200,50,40,94,2000,null]);
 assert.equal(JSON.stringify(statements).includes('a@example.com'),false);
 const failed=await recordAIUsage(db,'13800138000','another-id',
  {ok:false,attempts:2,error:'AI_PROVIDER_RATE_LIMITED'},0,1000);
 assert.equal(failed,true);
 assert.equal(statements[2].args[0],'failed');
 assert.equal(statements[2].args[7],'AI_PROVIDER_RATE_LIMITED');
});
test('AI HTTP route is not accessible when DB absent or extension not paired',async()=>{
 const c=await onRequest({request:new Request('https://hhba.work/api/apply/ai/status'),env:{}});
 assert.equal(c.status,503);
 const e=await onRequest({request:new Request('https://hhba.work/api/apply/extension/ai/map',{
  method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},
  body:JSON.stringify(input)}),env:{HHBA_PNVS_AUTH_DB:{}}});
 assert.equal(e.status,403);
});
