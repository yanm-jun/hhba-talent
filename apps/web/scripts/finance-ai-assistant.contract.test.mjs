import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateFinance} from '../functions/admin-preview/api/finance.js';
import {assessFinanceRegister,prepareFinanceAssistant,getFinanceAssistantSnapshot} from '../functions/_lib/finance-ai-assistant.js';
import {onRequestGet as getAssistant,onRequestPost as postAssistant} from '../functions/admin-preview/api/finance-ai.js';
import {onRequestPost as scheduled} from '../functions/admin-preview/api/finance-ai-cron.js';
import cronWorker from '../ops/finance-ai-review-scheduler.mjs';
import inferenceWorker from '../ops/finance-ai-inference-worker.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const month='2026-10';
const actor='finance-owner@example.test';
const rows=[
 {kind:'entry',id:'10000000-0000-4000-8000-000000000001',month,day:'2026-10-10',at:'2026-10-10T08:00:00Z',actor,
  direction:'expense',category:'deepseek',amountFen:1200,evidenceRef:'PrivateInvoiceABC123',note:'supplier note'},
 {kind:'entry',id:'10000000-0000-4000-8000-000000000002',month,day:'2026-10-11',at:'2026-10-11T08:00:00Z',actor,
  direction:'expense',category:'cloudflare',amountFen:350,evidenceRef:'CF-Demo',note:'supplier note'},
 {kind:'entry',id:'10000000-0000-4000-8000-000000000003',month,day:'2026-10-12',at:'2026-10-12T08:00:00Z',actor,
  direction:'income',category:'customer',amountFen:3000,evidenceRef:'CustomerPaymentPrivateABC',note:''},
 {kind:'entry',id:'10000000-0000-4000-8000-000000000004',month,day:'2026-10-13',at:'2026-10-13T08:00:00Z',actor,
  direction:'expense',category:'other',amountFen:700,evidenceRef:'MiscBillABC',note:''},
 {kind:'entry',id:'10000000-0000-4000-8000-000000000005',month,day:'2026-10-14',at:'2026-10-14T08:00:00Z',actor,
  direction:'expense',category:'domain',amountFen:2000,evidenceRef:'ReversedEvidencePrivate',note:''},
 {kind:'void',id:'10000000-0000-4000-8000-000000000006',month,at:'2026-10-16T08:00:00Z',actor,
  targetId:'10000000-0000-4000-8000-000000000005',reason:'This is a test cancellation'}
];
function kv(items=rows){
 const map=new Map(items.map(r=>['finance:entry:v1:'+month+':'+r.id,r]));
 let puts=[];
 return {
  map,puts,
  async list({prefix,limit}){
   assert.ok(prefix.startsWith('finance:entry:v1:'));
   assert.ok(limit<=51);
   return {keys:[...map.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};
  },
  async get(key){return map.get(key)||null},
  async put(key,value,opts){assert.ok(key.startsWith('finance:ai-review:v1:'));puts.push({key,opts});map.set(key,JSON.parse(value));}
 };
}
test('the assistant only calculates valid, active, evidence-referenced entries and never assumes full financial statements',()=>{
 const ledger=aggregateFinance(rows,month);
 const a=assessFinanceRegister(ledger);
 assert.equal(a.recorded.incomeFen,3000);
 assert.equal(a.recorded.expensesFen,2250);
 assert.equal(a.recorded.voidedCount,1);
 assert.equal(a.recorded.unclassifiedExpenses,1);
 assert.equal(a.suggestedExpenseFields.aiCostFen,1200);
 assert.equal(a.suggestedExpenseFields.infrastructureFen,350);
 assert.equal(a.suggestedExpenseFields.otherCostFen,undefined);
 assert.equal(a.suggestedExpenseFields.revenueFen,undefined);
 assert.equal(a.canPublish,false);
 assert.equal(a.canAutoSaveDraft,false);
 assert.equal(a.canConfirmDistribution,false);
 assert.equal(a.readiness,'NEEDS_SOURCE_RECONCILIATION');
 assert.ok(a.alerts.some(v=>v.code==='NO_PROVIDER_RECONCILIATION'));
 assert.ok(a.alerts.some(v=>v.code==='STATUTORY_PROFIT_UNKNOWN'));
 assert.equal(assessFinanceRegister(aggregateFinance([],month)).recorded.incomeFen,null,
  'No evidence must NEVER display confirmed zero financial income');
 assert.throws(()=>assessFinanceRegister({month,quality:'owner_entered_unreconciled',
  entries:[{voided:false,amountFen:12.3,direction:'income',category:'other',evidenceRef:'x'}],eventsCount:1}),
  /INVALID_FINANCE_SOURCE_ITEM/);
});
test('AI sees only anonymized aggregate flags; its text cannot change money or approve publication',async()=>{
 const store=kv(),seen=[];
 const env={HHBA_FIN_AI_ENABLED:'1',HHBA_FIN_AI:{async run(name,input){
  seen.push({name,input});
  return {response:'核对完整账单和冲销依据；确认退款和税费；有疑问交管理员处理。'};
 }}};
 const first=await prepareFinanceAssistant(store,env,month,{mode:'manual',at:new Date('2026-11-17T08:00:00Z')});
 assert.equal(first.model.state,'completed');
 assert.equal(first.canPublish,false);
 assert.equal(first.suggestedExpenseFields.aiCostFen,1200);
 assert.equal(store.puts.length,1);
 assert.equal(seen.length,1);
 const prompt=JSON.stringify(seen[0].input);
 for(const secret of ['PrivateInvoiceABC123','CustomerPaymentPrivateABC',actor,'supplier note','CF-Demo'])
  assert.ok(!prompt.includes(secret),'Sensitive invoice/actor/source text must not leave admin KV: '+secret);
 assert.ok(prompt.includes('NO_PROVIDER_RECONCILIATION'));
 const repeat=await prepareFinanceAssistant(store,env,month,{mode:'cron',at:new Date('2026-11-18T08:00:00Z')});
 assert.equal(repeat.cached,true);
 assert.equal(store.puts.length,1);
 assert.equal(seen.length,1,'Unchanged source never incurs another AI call');
 assert.equal((await getFinanceAssistantSnapshot(store,month)).kind,'HHBA_FINANCE_ASSISTANT_V1');
});
test('daily tasks work without model binding but must honestly mark rules-only mode',async()=>{
 const store=kv();
 const result=await prepareFinanceAssistant(store,{HHBA_FIN_AI_ENABLED:'0'},month,{mode:'cron',
  at:new Date('2026-11-17T08:00:00Z')});
 assert.equal(result.trigger,'automatic_daily');
 assert.equal(result.model.state,'disabled');
 assert.equal(result.recorded.incomeFen,3000);
 assert.equal(result.canPublish,false);
});
test('private finance AI API denies anonymous users and cron rejects unauthenticated/disabled caller',async()=>{
 const unsafe={get(){throw Error('leaked KV')},put(){throw Error('leaked KV')},list(){throw Error('leaked KV')}};
 const env={HHBA_LIBRARY_CACHE_KV:unsafe,HHBA_FIN_AI_AUTO_ENABLED:'1',HHBA_FIN_AI_CRON_SECRET:'a'.repeat(96)};
 const request=new Request('https://admin.hhba.work/admin-preview/api/finance-ai?month=2026-10');
 const res=await getAssistant({request,env});
 assert.notEqual(res.status,200);
 const post=await postAssistant({request:new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"month":"2026-10"}'}),env});
 assert.notEqual(post.status,200);
 const schedulerUrl='https://admin.hhba.work/admin-preview/api/finance-ai-cron';
 for(const disabled of ['0','1']){
  const response=await scheduled({request:new Request(schedulerUrl,{method:'POST',headers:{Authorization:'Bearer wrong'}}),
   env:{...env,HHBA_FIN_AI_AUTO_ENABLED:disabled}});
  assert.equal(response.status,403);
 }
 const middle=read('../functions/_middleware.js');
 assert.match(middle,/path==='\/admin-preview\/api\/finance-ai-cron'&&request\.method==='POST'/);
 assert.match(read('../functions/admin-preview/api/finance-ai-cron.js'),/exactSecret\(token\.slice\(7\),configured\)/);
});
test('scheduled worker exposes no direct finance HTTP API and only runs at Beijing 10 AM',async()=>{
 assert.equal((await cronWorker.fetch()).status,404);
 const prior=globalThis.fetch;
 const calls=[];globalThis.fetch=async(url,init)=>{
  calls.push({url,auth:init.headers.Authorization});
  return new Response('{"ok":true}',{status:200});
 };
 const secret='b'.repeat(96),env={HHBA_FIN_AI_CRON_SECRET:secret};
 const event=(time,cron='0 2 * * *')=>({cron,scheduledTime:Date.parse(time)});
 try{
  await cronWorker.scheduled(event('2026-11-17T01:00:00Z'),env);
  await cronWorker.scheduled(event('2026-11-17T02:00:00Z','*/5 2 * * *'),env);
  await cronWorker.scheduled(event('2026-11-17T02:00:00Z'),{});
  assert.equal(calls.length,0);
  await cronWorker.scheduled(event('2026-11-17T02:00:00Z'),env);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://admin.hhba.work/admin-preview/api/finance-ai-cron');
  assert.equal(calls[0].auth,'Bearer '+secret);
 }finally{globalThis.fetch=prior;}
});
test('AI finance remains embedded in existing admin, uses plain text, never has automatic publish paths',()=>{
 const html=read('../../admin-preview/index.html');
 const js=read('../../admin-preview/finance-ai.js');
 const api=read('../functions/admin-preview/api/finance-ai.js');
 const core=read('../functions/_lib/finance-ai-assistant.js');
 const builder=read('./build-standalone-admin.py');
 assert.match(html,/id="view-finance"/);
 assert.match(html,/id="hhba-fin-ai-root"/);
 assert.match(html,/src="\/finance-ai\.js"/);
 assert.match(builder,/"finance-ai.js","finance-ai.css"/);
 assert.match(js,/textContent=String\(v\)/);
 assert.match(js,/new Event\('input',\{bubbles:true\}\)/);
 assert.match(js,/只将待核对的费用建议填入月报空白字段，不覆盖、不保存、不公开/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(api,/verifyAdmin\(request,env\)/);
 assert.match(core,/suggestedExpenseFields:fieldTotals/);
 assert.doesNotMatch(core,/publishReviewed|hhba_fin_reports|HHBA_FIN_SEND_ENABLED/);
 assert.doesNotMatch(js,/innerHTML\s*\+=/);
});



test('isolated finance AI Worker rejects public unauthenticated access and sensitive payloads',async()=>{
 const url='https://finance-ai.internal/v1/review';
 const secret='c'.repeat(96);
 const env={HHBA_FIN_AI_SERVICE_TOKEN:secret,AI:{async run(model,req){
  assert.equal(model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  const s=JSON.stringify(req);
  assert.doesNotMatch(s,/phone|email|evidenceRef|PrivateInvoiceABC123|CustomerPaymentPrivateABC/);
  return {response:'请补齐实际账单，并核对冲销与税费凭证。'};
 }}};
 const request=(data,token=secret)=>new Request(url,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(data)
 });
 const input={period:'2026-10',entryCount:5,voidedCount:1,unclassifiedExpenses:1,
  alertCodes:['NO_PROVIDER_RECONCILIATION','STATUTORY_PROFIT_UNKNOWN'],
  categoryCoverage:['aiCostFen','infrastructureFen']};
 assert.equal((await inferenceWorker.fetch(new Request(url),env)).status,404);
 assert.equal((await inferenceWorker.fetch(request(input,'wrong'),env)).status,403);
 assert.equal((await inferenceWorker.fetch(request({...input,evidenceRef:'PrivateInvoiceABC123'}),env)).status,400);
 assert.equal((await inferenceWorker.fetch(request({...input,entryCount:1000}),env)).status,400);
 const accepted=await inferenceWorker.fetch(request(input),env);
 assert.equal(accepted.status,200);
 const json=await accepted.json();
 assert.equal(json.ok,true);
 assert.match(json.response,/账单/);
});
test('finance assistant calls encrypted service binding with only redacted aggregate, no external API key',async()=>{
 const store=kv();
 const requests=[];
 const env={HHBA_FIN_AI_ENABLED:'1',HHBA_FIN_AI_SERVICE_TOKEN:'d'.repeat(96),
  HHBA_FIN_AI_SERVICE:{async fetch(url,opts){
   assert.equal(url,'https://finance-ai.internal/v1/review');
   assert.equal(opts.headers.Authorization,'Bearer '+'d'.repeat(96));
   const data=JSON.parse(opts.body);
   assert.ok(!('evidenceRef' in data));
   assert.ok(!('amountFen' in data));
   assert.ok(!('phone' in data));
   requests.push(data);
   return new Response(JSON.stringify({ok:true,response:'核对合同与实际支付账单。'}),{status:200});
  }}};
 const result=await prepareFinanceAssistant(store,env,month,{mode:'cron',at:new Date('2026-11-18T08:00:00Z')});
 assert.equal(result.model.state,'completed');
 assert.equal(result.canPublish,false);
 assert.equal(requests.length,1);
 assert.equal(store.puts.length,1);
 const repeat=await prepareFinanceAssistant(store,env,month,{mode:'cron',at:new Date('2026-11-19T08:00:00Z')});
 assert.equal(repeat.cached,true);
 assert.equal(requests.length,1);
});
