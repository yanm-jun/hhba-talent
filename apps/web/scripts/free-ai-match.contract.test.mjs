import test from 'node:test';
import assert from 'node:assert/strict';
import {
 eligibleProviders,runFreeAIJson,FREE_PROVIDER_VERSION,CF_MODEL
} from '../functions/_lib/free-ai-provider.js';
import {safeRankedAI,onRequest as freeRoute} from '../functions/api/match-free/[[path]].js';
import {onRequest as nativeRoute} from '../functions/api/match-native/[[path]].js';
import {onRequest as oldMatchRoute} from '../functions/api/match/[[path]].js';
import {onRequestGet,onRequestPost} from '../functions/api/match/discover.js';

function fakeBudget(){
 const reservations=[],env={
  HHBA_ZERO_PAID_AI_ENFORCED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'synthetic-pepper-with-32-chars-123456789',
  HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED:'1',
  AI:{async run(model,payload){
   assert.equal(model,CF_MODEL);
   assert.equal(payload.chat_template_kwargs.enable_thinking,false);
   return {choices:[{message:{content:'{"ranked":[{"id":"j1"}]}'} } ]};
  }},
  HHBA_PNVS_AUTH_DB:{prepare(sql){return {bind(...args){return {
   async run(){
    if(!sql.startsWith('INSERT INTO hhba_free_ai_provider_calls'))throw Error('unexpected D1 write');
    const provider=args[3],units=args[4];
    const sum=reservations.filter(x=>x.provider===provider).reduce((a,x)=>a+x.units,0);
    if(sum+units>(provider==='cloudflare'?7200:120000))return {success:true,meta:{changes:0}};
    reservations.push({provider,units});return {success:true,meta:{changes:1}};
   }
  }}}}}
 };
 return {env,reservations};
}
test('free-only is OFF unless the entire account free-plan gate is confirmed',()=>{
 const h=fakeBudget(),{env}=h;
 assert.deepEqual(eligibleProviders({...env,HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED:'0'}),[]);
 assert.deepEqual(eligibleProviders({...env,HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED:'1'}),['cloudflare']);
 assert.equal(FREE_PROVIDER_VERSION,'HHBA_FREE_PROVIDER_V1');
});
test('CF AI ranks using exactly one reserved provider call; no paid provider is ever involved',async()=>{
 const h=fakeBudget();
 const ownerHash='f'.repeat(64);
 const r=await runFreeAIJson(h.env,{ownerHash,
  system:'Return JSON object with ranked IDs.',user:'Synthetic profile + verified job j1',maxTokens:100});
 assert.equal(r.provider,'cloudflare');
 assert.deepEqual(r.data.ranked,[{id:'j1'}]);
 assert.equal(h.reservations.length,1);
 assert.equal(h.reservations[0].units,145);
});
test('absence of verified free AI provider always fails before network or charge',async()=>{
 const h=fakeBudget();
 delete h.env.AI;
 await assert.rejects(runFreeAIJson(h.env,{
  system:'Return a JSON object',user:'safe',ownerHash:'a'.repeat(64)
 }),e=>e.code==='FREE_AI_NOT_CONFIGURED');
 assert.equal(h.reservations.length,0);
});
test('Groq fallback can only use the hard-whitelisted free model with verified plan',async()=>{
 const h=fakeBudget(),{env}=h;
 delete env.AI;
 env.HHBA_FREE_AI_GROQ_FREE_PLAN_VERIFIED='1';
 env.HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED='1';
 env.HHBA_FREE_GROQ_KEY='synthetic-groq-free-token-987654';
 const orig=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  assert.equal(String(url),'https://api.groq.com/openai/v1/chat/completions');
  const body=JSON.parse(init.body);
  assert.equal(body.model,'openai/gpt-oss-20b');
  assert.equal(body.stream,false);
  return Response.json({choices:[{message:{content:'{"ranked":[{"id":"j1"}]}'}}]});
 };
 try{
  const x=await runFreeAIJson(env,{ownerHash:'f'.repeat(64),system:'Return JSON.',user:'Synthetic job.',maxTokens:100});
  assert.equal(x.provider,'groq');
  assert.equal(h.reservations[0].units,7500);
 }finally{globalThis.fetch=orig;}
});
test('raw resume never goes to Groq without separate processing approval',async()=>{
 const h=fakeBudget(),{env}=h;
 delete env.AI;
 env.HHBA_FREE_AI_GROQ_FREE_PLAN_VERIFIED='1';
 env.HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED='1';
 env.HHBA_FREE_GROQ_KEY='synthetic-groq-free-token-987654';
 await assert.rejects(runFreeAIJson(env,{
  ownerHash:'f'.repeat(64),system:'JSON',user:'Synthetic CV',dataClass:'resume'
 }),e=>e.code==='FREE_AI_NOT_CONFIGURED');
 assert.equal(h.reservations.length,0);
});
test('OpenRouter model must explicitly end in :free; never accepts dynamic paid router',()=>{
 const h=fakeBudget(),{env}=h;
 delete env.AI;
 env.HHBA_FREE_AI_OPENROUTER_FREE_PLAN_VERIFIED='1';
 env.HHBA_FREE_AI_OPENROUTER_ENABLED='1';
 env.HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED='1';
 env.HHBA_FREE_OPENROUTER_KEY='synthetic-openrouter-key-0123456789';
 env.HHBA_FREE_OPENROUTER_MODEL='openrouter/free';
 assert.deepEqual(eligibleProviders(env),[]);
 env.HHBA_FREE_OPENROUTER_MODEL='provider/model:free';
 assert.deepEqual(eligibleProviders(env),['openrouter']);
});
test('AI can neither add a company nor bypass official job whitelist',()=>{
 const jobs=[{id:'j1',company:'公司A',title:'Data Analyst',location:'Shanghai',reference_score:89,matched:['Python']},
  {id:'j2',company:'公司B',title:'Data Analyst',location:'Beijing',reference_score:82,matched:['SQL']}];
 const result=safeRankedAI({ranked:[{id:'made-up'},{id:'j2'},{id:'j2'}]},jobs,10);
 assert.deepEqual(result.map(x=>x.id),['j2','j1']);
 assert.ok(result.every(j=>!j.official_url||j.official_url.startsWith('https://')));
});
test('disabled free route never emits provider requests or creates D1 data',async()=>{
 const request=new Request('https://hhba.example/api/match-free/status');
 const response=await freeRoute({request,env:{}});
 assert.equal(response.status,200);
 assert.equal((await response.json()).enabled,false);
});
test('paid native match is hard-blocked when zero-cost enforcement is set',async()=>{
 const env={HHBA_ZERO_PAID_AI_ENFORCED:'1',HHBA_FREE_MATCH_ENABLED:'0',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-nonreal-paid-provider-key'};
 const req=new Request('https://hhba.example/api/match-native/status');
 const r=await nativeRoute({request:req,env});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'FREE_AI_NOT_CONFIGURED');
 const old=await oldMatchRoute({request:new Request('https://hhba.example/api/match/status'),env});
 assert.equal((await old.json()).error,'PAID_AI_DISABLED');
 const discover=await onRequestGet({env});
 assert.equal((await discover.json()).error,'PAID_AI_DISABLED');
 const post=await onRequestPost({request:new Request('https://hhba.example/api/match/discover',{method:'POST'}),env});
 assert.equal((await post.json()).error,'PAID_AI_DISABLED');
});
