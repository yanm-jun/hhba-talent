import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sha256} from '../functions/_lib/console-password.js';
import {onRequestGet,onRequestPost,aggregateFinance} from '../functions/admin-preview/api/finance.js';
import {onRequest as adminMiddleware} from '../functions/_middleware.js';

const month='2026-11',day='2026-11-12',base='https://admin.hhba.work';
let currentToken=0;
async function fixture(){
 const token=randomBytes(32).toString('base64url'),hash=await sha256(token);
 const owner={id:'owner',email:'test-finance-owner@example.com',auth_version:'finance-test-auth-version'};
 const session={owner_id:'owner',expires_at:Math.floor(Date.now()/1000)+1000,auth_version:owner.auth_version};
 const events=new Map();let financeReads=0,financeWrites=0,d1Calls=0;
 const kv={async list({prefix,limit}){
  financeReads++;
  assert.equal(limit,51);
  const keys=[...events.keys()].filter(key=>key.startsWith(prefix)).sort().map(name=>({name}));
  return {keys:keys.slice(0,limit),list_complete:keys.length<=limit};
 },async get(key,format){financeReads++;const s=events.get(key);return s===undefined?null:format==='json'?JSON.parse(s):s},
 async put(key,value){
  financeWrites++;
  assert.match(key,/^finance:entry:v1:2026-11:/);
  assert.ok(!events.has(key),'every finance event has a new immutable key');
  events.set(key,value);
 }};
 const authKv={async get(key){
  if(key==='admin:owner')return owner;
  if(key==='session:'+hash)return session;
  return null;
 },async put(){throw Error('read-only session verifier must not mutate auth KV')}};
 const db={prepare(){d1Calls++;throw Error('D1 must not be touched')}};
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_MODE:'kv',HHBA_ADMIN_AUTH_KV:authKv,
  HHBA_METRICS_ADMIN_EMAIL:owner.email,HHBA_LIBRARY_CACHE_KV:kv,HHBA_METRICS_DB:db,HHBA_PNVS_AUTH_DB:db};
 const request=(path,method='GET',payload,origin=base,header=true)=>{
  const headers={Cookie:'__Host-hhba_admin='+token};
  if(method==='POST'){
   headers['Content-Type']='application/json';
   headers.Origin=origin;
   headers['Sec-Fetch-Site']=origin===base?'same-origin':'cross-site';
   if(header)headers['X-HHBA-FINANCE-REQUEST']='1';
  }
  return new Request(base+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
 };
 return {env,kv,events,request,counts:()=>({financeReads,financeWrites,d1Calls})};
}
const entry=(amountFen=12045)=>({action:'create',month,day,direction:'expense',category:'cloudflare',
 amountFen,evidenceRef:'invoice-2026-11-001',note:'官网域名成本'});
test('no finance records is explicitly unknown, never fabricated zero',async()=>{
 const x=await fixture();
 const r=await onRequestGet({request:x.request('/admin-preview/api/finance?month='+month),env:x.env});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.kind,'HHBA_PRIVATE_FINANCE_REGISTER_V1');
 assert.equal(data.quality,'no_records_not_zero');
 assert.equal(data.totals,null);
 assert.deepEqual(data.entries,[]);
 assert.equal(data.recordedCount,0);
 assert.equal(x.counts().d1Calls,0);
});
test('admin can append evidence-backed expense and income, retaining source and month accuracy',async()=>{
 const x=await fixture();
 const post=p=>onRequestPost({request:x.request('/admin-preview/api/finance','POST',p),env:x.env});
 assert.equal((await post(entry())).status,201);
 assert.equal((await post({...entry(9975),direction:'income',category:'customer',
  evidenceRef:'client-invoice-111'})).status,201);
 const r=await onRequestGet({request:x.request('/admin-preview/api/finance?month='+month),env:x.env});
 const data=await r.json();
 assert.equal(data.quality,'owner_entered_unreconciled');
 assert.equal(data.totals.expenseFen,12045);
 assert.equal(data.totals.incomeFen,9975);
 assert.equal(data.totals.netFen,-2070);
 assert.equal(data.recordedCount,2);
 assert.equal(data.entries.length,2);
 assert.ok(data.entries.every(e=>e.voided===false));
 assert.equal(x.counts().financeWrites,2);
 assert.equal(x.counts().d1Calls,0);
 assert.ok([...x.events.keys()].every(k=>k.startsWith('finance:entry:v1:2026-11:')));
});
test('void appends a new immutable event and retains the original and reversal reason',async()=>{
 const x=await fixture();
 const post=p=>onRequestPost({request:x.request('/admin-preview/api/finance','POST',p),env:x.env});
 const created=await (await post(entry())).json();
 const reverted=await post({action:'void',month,targetId:created.eventId,reason:'原始发票重复登记'});
 assert.equal(reverted.status,201);
 const ledger=await (await onRequestGet({request:x.request('/admin-preview/api/finance?month='+month),env:x.env})).json();
 assert.equal(ledger.recordedCount,1);
 assert.equal(ledger.voidedCount,1);
 assert.equal(ledger.eventsCount,2);
 assert.equal(ledger.totals.expenseFen,0);
 assert.equal(ledger.entries[0].voided,true);
 assert.equal(ledger.entries[0].voidReason,'原始发票重复登记');
 assert.equal(x.counts().financeWrites,2);
 assert.equal((await post({action:'void',month,targetId:created.eventId,reason:'第二次重复冲销'})).status,409);
 assert.equal(x.counts().d1Calls,0);
});
test('unauthenticated or cross-origin writes never reach finance KV',async()=>{
 const x=await fixture(),path='/admin-preview/api/finance';
 const unauth=new Request(base+path);
 assert.equal((await onRequestGet({request:unauth,env:x.env})).status,401);
 assert.equal((await onRequestPost({request:unauth,env:x.env})).status,401);
 assert.equal((await onRequestPost({request:x.request(path,'POST',entry(),'https://attacker.test'),env:x.env})).status,403);
 assert.equal((await onRequestPost({request:x.request(path,'POST',entry(),base,false),env:x.env})).status,403);
 assert.equal(x.counts().financeReads,0);
 assert.equal(x.counts().financeWrites,0);
 assert.equal(x.counts().d1Calls,0);
});
test('invalid amounts, invented references, nonexistent days and wrong months fail closed',async()=>{
 const x=await fixture(),path='/admin-preview/api/finance';
 for(const v of [
  {...entry(),amountFen:0},{...entry(),amountFen:1.25},
  {...entry(),amountFen:-1},{...entry(),amountFen:1000000001},
  {...entry(),evidenceRef:' '},{...entry(),day:'2026-11-31'},
  {...entry(),day:'2026-12-01'},{...entry(),category:'arbitrary'},
  {...entry(),direction:'refund'}
 ]){
  const r=await onRequestPost({request:x.request(path,'POST',v),env:x.env});
  assert.equal(r.status,400,JSON.stringify(v));
 }
 assert.equal(x.counts().financeWrites,0);
});
test('KV incomplete listing or corrupt audit event returns error, never partial monthly total',async()=>{
 const x=await fixture();
 const badKv={...x.kv,async list(){return {list_complete:false,keys:[]}}};
 assert.equal((await onRequestGet({request:x.request('/admin-preview/api/finance?month='+month),
  env:{...x.env,HHBA_LIBRARY_CACHE_KV:badKv}})).status,503);
 x.events.set('finance:entry:v1:2026-11:'+randomBytes(16).toString('hex'),
  JSON.stringify({amountFen:1,kind:'entry'}));
 assert.equal((await onRequestGet({request:x.request('/admin-preview/api/finance?month='+month),env:x.env})).status,503);
 assert.equal(x.counts().d1Calls,0);
});
test('finance code and UI are isolated, do not autofetch D1, and preserve guarded access',async()=>{
 const x=await fixture();
 const guest=new Request(base+'/admin-preview/api/finance?month='+month);
 let advanced=false;
 const response=await adminMiddleware({request:guest,env:x.env,next:async()=>{advanced=true;return new Response('exposed')}});
 assert.equal(response.status,401);
 assert.equal(advanced,false);
 const ui=readFileSync(new URL('../../admin-preview/finance.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 assert.match(ui,/window\.hhbaFinance=\{open\(\)\{/);
 assert.match(ui,/x-hhba-finance-request/i);
 assert.match(html,/id="view-finance"/);
 assert.match(html,/id="finance-evidence"/);
 assert.doesNotMatch(ui,/localStorage/);
 assert.doesNotMatch(ui,/Math\.random/);
});
test('sum and void folding rejects missing originals rather than showing guessed money',()=>{
 assert.throws(()=>aggregateFinance([{kind:'void',id:crypto.randomUUID(),at:new Date().toISOString(),
  month,actor:'admin@test.com',targetId:crypto.randomUUID(),reason:'错误的撤销记录'}],month),/BROKEN_REGISTER_REVERSAL/);
});
