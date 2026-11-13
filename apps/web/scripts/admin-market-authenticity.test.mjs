import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
