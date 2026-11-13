import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
import {sha256} from '../functions/_lib/console-password.js';
import {onRequest as adminMiddleware} from '../functions/_middleware.js';
import {validateOfficialSnapshot,onRequestGet} from '../functions/admin-preview/api/public-jobs.js';

const now=Date.now();
const iso=offset=>new Date(now+offset).toISOString();
const count={indexedJobs:80,displayableJobs:66,auditedJobRequirements:11,
 checkedAtsSources:4,failedAtsSources:0,distinctIndexedCompanies:14};
const raw={kind:'HHBA_CLOUDFLARE_PUBLIC_METRICS_V1',quality:'current',
 sourceTime:iso(-3600000),auditCheckedAt:iso(-1800000),counts:count};
test('official snapshot is strictly validated and old counts fail closed',()=>{
 const good=validateOfficialSnapshot(raw,now);
 assert.equal(good.quality,'current');
 assert.equal(good.counts.displayableJobs,66);
 assert.equal(good.counts.distinctIndexedCompanies,14);
 assert.equal(good.sourceTime,raw.sourceTime);
 assert.equal(validateOfficialSnapshot({...raw,sourceTime:iso(-90000000)},now).quality,'stale');
 const stale=validateOfficialSnapshot({...raw,auditCheckedAt:iso(-90000000)},now);
 assert.equal(stale.counts.displayableJobs,null);
 assert.equal(stale.counts.auditedJobRequirements,null);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,displayableJobs:-2}},now),/INVALID_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,indexedJobs:'80'}},now),/INVALID_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,sourceTime:iso(1000000)},now),/INVALID_SOURCE_TIMES/);
 assert.throws(()=>validateOfficialSnapshot({...raw,kind:'HHBA_UNVERIFIED_METRICS'},now),/INVALID_SOURCE_KIND/);
});
test('public metrics gateway refuses unauthenticated visitors before external fetch',async()=>{
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_MODE:'kv',
  HHBA_ADMIN_AUTH_KV:{async get(){throw Error('should not read without cookie')},async put(){}}};
 const response=await onRequestGet({env,request:new Request('https://admin.hhba.work/admin-preview/api/public-jobs')});
 assert.equal(response.status,401);
});
function fakeNode(){
 return {textContent:'',children:[],handlers:{},disabled:false,
  append(...items){this.children.push(...items)},
  replaceChildren(){this.children=[]},
  addEventListener(name,callback){this.handlers[name]=callback}};
}
function setupMarket({publicResult=raw,catalogResult,publicFails=false}={}){
 const elements={};
 const document={getElementById(id){return elements[id]||(elements[id]=fakeNode())},
  createElement:()=>fakeNode()};
 const calls=[],window={hhbaAdminNavigation:{openLibrary:id=>calls.push({navigatedTo:id})}};
 let failCatalog=false;
 const fetch=async(uri,options)=>{
  calls.push({uri,credentials:options?.credentials});
  if(uri==='/admin-preview/api/public-jobs')return {
   ok:!publicFails,status:publicFails?503:200,json:async()=>publicResult};
  if(uri.startsWith('/admin-preview/api/library'))return {
   ok:!failCatalog,status:failCatalog?503:200,json:async()=>catalogResult};
  throw Error('unexpected URL '+uri);
 };
 const source=readFileSync(new URL('../../admin-preview/market.js',import.meta.url),'utf8');
 vm.runInNewContext(source,{window,document,location:{hostname:'admin.hhba.work'},fetch,Intl,Date});
 return {window,elements,calls,setFailCatalog:x=>{failCatalog=x}};
}
const halls=['automotive','semiconductor','internet-ai','energy','manufacturing','finance','telecom','biomed','aerospace','logistics','construction','consumer-hardware','chem-materials','retail','agri-food','culture-media','education-research'];
const catalogue={
 kind:'HHBA_RECRUITMENT_LIBRARY_V1',mode:'summary',archived:true,overlayCount:76,
 asOf:iso(-3600000),source:'production-d1-export+KV',readonly:false,
 total:{records:2,linked:2,unique_urls:2,verified:1,historical_verified:0,candidate:1,missing:0},
 industries:halls.map((id,i)=>({id,label:id,records:i===0?2:0,linked:i===0?2:0,
  unique_urls:i===0?2:0,verified:i===0?1:0,historical_verified:0,
  candidate:i===0?1:0,missing:0}))
};
test('market view does not fetch employer catalog until explicit manual action',async()=>{
 const x=setupMarket({catalogResult:catalogue});
 x.window.hhbaMarket.open();
 await new Promise(r=>setImmediate(r));
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].uri,'/admin-preview/api/public-jobs');
 assert.equal(x.calls[0].credentials,'same-origin');
 assert.equal(x.elements['market-jobs'].textContent,'66');
 assert.ok(!x.calls.some(c=>typeof c.uri==='string'&&c.uri.includes('/api/library')));
 x.elements['market-load'].handlers.click();
 await new Promise(r=>setImmediate(r));
 assert.equal(x.calls.length,2);
 assert.equal(x.calls[1].uri,'/admin-preview/api/library?mode=summary');
 assert.equal(x.elements['market-urls'].textContent,'2');
 assert.equal(x.elements['market-pending'].textContent,'1');
 assert.equal(x.elements['market-industry-rows'].children.length,17);
 // Click through to the real existing 17-hall library.
 const firstRow=x.elements['market-industry-rows'].children[0];
 firstRow.children[7].children[0].handlers.click();
 assert.equal(x.calls.at(-1).navigatedTo,'automotive');
 x.setFailCatalog(true);
 x.elements['market-load'].handlers.click();
 await new Promise(r=>setImmediate(r));
 assert.equal(x.elements['market-urls'].textContent,'—');
 assert.equal(x.elements['market-industry-rows'].children.length,1);
});
test('market never presents a stale snapshot as an active job count',async()=>{
 const x=setupMarket({publicResult:{...raw,quality:'stale'}});
 x.window.hhbaMarket.open();
 await new Promise(r=>setImmediate(r));
 assert.equal(x.elements['market-jobs'].textContent,'—');
 assert.match(x.elements['market-index-status'].textContent,/已过期/);
});

test('source rejects mathematically impossible investor and job counts',()=>{
 const oversubscribed={...raw,counts:{...count,displayableJobs:100}};
 assert.throws(()=>validateOfficialSnapshot(oversubscribed,now),/INCONSISTENT_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,auditedJobRequirements:70}},now),/INCONSISTENT_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,distinctIndexedCompanies:80}},now),/INCONSISTENT_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,failedAtsSources:5}},now),/INCONSISTENT_SOURCE_COUNTS/);
 assert.throws(()=>validateOfficialSnapshot({...raw,counts:{...count,failedAtsSources:1}},now),/INCONSISTENT_SOURCE_COUNTS/);
});
test('password-protected official gateway never touches D1 or accepts arbitrary upstream URLs',async()=>{
 const token=randomBytes(32).toString('base64url'),hashed=await sha256(token),expiry=Math.floor(Date.now()/1000)+1200;
 const owner={id:'owner',email:'test-owner@example.com',auth_version:'some-random-version'};
 const record={owner_id:'owner',expires_at:expiry,auth_version:owner.auth_version};
 let kvReads=0,d1Touches=0,networkCalls=0;
 const kv={async get(key){
   kvReads++;
   if(key==='admin:owner')return owner;
   if(key==='session:'+hashed)return record;
   return null;
 },async put(){throw Error('auth KV must not be written by a read-only health check') }};
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_MODE:'kv',
  HHBA_METRICS_ADMIN_EMAIL:owner.email,HHBA_ADMIN_AUTH_KV:kv,
  HHBA_METRICS_DB:{prepare(){d1Touches++;throw Error('D1 must not be queried')}},
  HHBA_PNVS_AUTH_DB:{prepare(){d1Touches++;throw Error('D1 must not be queried')} }};
 const request=new Request('https://admin.hhba.work/admin-preview/api/public-jobs',{
  headers:{Cookie:'__Host-hhba_admin='+token}});
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  networkCalls++;
  assert.equal(url,'https://hhba.work/api/metrics/public');
  assert.equal(options.method,'GET');
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'error');
  return new Response(JSON.stringify(raw),{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
 };
 try{
  let advanced=false;
  const response=await adminMiddleware({request,env,next:async()=>{
   advanced=true;
   return onRequestGet({request,env});
  }});
  assert.equal(response.status,200);
  assert.equal(advanced,true);
  const payload=await response.json();
  assert.equal(payload.counts.displayableJobs,66);
  assert.equal(payload.counts.distinctIndexedCompanies,14);
  assert.match(response.headers.get('Cache-Control')||'',/private/);
  assert.equal(networkCalls,1,'never re-fetch for every field');
  assert.equal(d1Touches,0);
  assert.ok(kvReads>=2);
  let passed=false;
  const guestRequest=new Request('https://admin.hhba.work/admin-preview/api/public-jobs');
  const guest=await adminMiddleware({request:guestRequest,env,next:async()=>{passed=true;return new Response('exposed')}});
  assert.equal(guest.status,401);
  assert.equal(passed,false,'unsigned user must never enter route handler');
  assert.equal(networkCalls,1,'unauthorized requests never contact official source');
 }finally{globalThis.fetch=previous}
});
