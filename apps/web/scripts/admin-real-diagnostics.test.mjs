import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectBindings,onRequestGet} from '../functions/admin-preview/api/health.js';

test('health probe checks only KV key metadata and never executes D1 SQL',async()=>{
 let listed=0,queried=0;
 const neverSql={prepare(){queried++;throw Error('D1 MUST NOT BE QUERIED')}};
 const env={
  HHBA_ADMIN_AUTH_MODE:'kv',HHBA_LIBRARY_SNAPSHOT_FIRST:'1',
  HHBA_METRICS_DB:neverSql,HHBA_PNVS_AUTH_DB:neverSql,
  HHBA_LIBRARY_CACHE_KV:{async list(options){
   listed++;
   assert.deepEqual(options,{prefix:'catalog:',limit:602});
   return {keys:[{name:'catalog:baseline:v1'}]};
  }}
 };
 const result=await inspectBindings(env);
 assert.equal(listed,1);
 assert.equal(queried,0);
 assert.equal(result.d1QueriesPerformed,0);
 assert.equal(result.sources.employerCatalog.status,'present');
 assert.equal(result.sources.catalogDeltas.status,'normal');
 assert.equal(result.sources.catalogDeltas.count,0);
 assert.equal(result.sources.catalogDeltas.exact,true);
 assert.equal(result.sources.employerCatalog.snapshotFirst,true);
 assert.equal(result.sources.metricsDatabase.status,'bound_not_queried');
 assert.equal(result.sources.identityDatabase.status,'bound_not_queried');
 assert.equal(result.sources.adminSession.status,'verified');
});
test('a missing or broken KV baseline cannot masquerade as operational',async()=>{
 const missing=await inspectBindings({HHBA_LIBRARY_CACHE_KV:{async list(){return {keys:[]}}}});
 assert.equal(missing.sources.employerCatalog.status,'missing');
 assert.equal(missing.sources.metricsDatabase.status,'not_bound');
 const broken=await inspectBindings({HHBA_LIBRARY_CACHE_KV:{async list(){throw Error('connection lost')}}});
 assert.equal(broken.sources.employerCatalog.status,'unavailable');
 const unbound=await inspectBindings({});
 assert.equal(unbound.sources.employerCatalog.status,'not_bound');
});
test('health endpoint refuses unauthenticated requests without touching KV',async()=>{
 let listCalled=false;
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_MODE:'kv',HHBA_LIBRARY_CACHE_KV:{
  async list(){listCalled=true;return {keys:[]}}
 },HHBA_ADMIN_AUTH_KV:{async get(){throw Error('should not read session without cookie')},async put(){}}};
 const response=await onRequestGet({request:new Request('https://admin.hhba.work/admin-preview/api/health'),env});
 assert.equal(response.status,401);
 assert.equal(listCalled,false);
});
test('dashboard loads private D1 metrics only by user action',()=>{
 const root=new URL('../../admin-preview/',import.meta.url);
 const js=readFileSync(new URL('dashboard.js',root),'utf8');
 const html=readFileSync(new URL('index.html',root),'utf8');
 assert.match(js,/privateMetricsRequested=false/);
 assert.match(js,/if\(activeView==='users'&&privateMetricsRequested/);
 assert.match(js,/byId\('refresh'\)\.addEventListener\('click',\(\)=>\{void refresh\(\)\}/);
 assert.match(js,/byId\('health-check'\)\.addEventListener/);
 assert.match(html,/id="refresh-private"/);
 assert.match(html,/id="users-load-private"/);
 assert.match(html,/id="view-operations"/);
 assert.match(html,/data-view="finance"/);
 assert.match(html,/id="view-finance"/);
 assert.match(js,/if\(view==='finance'\)window\.hhbaFinance\?\.open\(\)/);
});

test('real KV backlog only uses bounded key metadata, with compaction warning',async()=>{
 const keys=[{name:'catalog:baseline:v1'}];
 const stamp=String(Date.now());
 for(let i=0;i<500;i++)keys.push({name:'catalog:delta:'+stamp+':unit-'+i});
 const mk=(data,complete=true)=>({HHBA_LIBRARY_CACHE_KV:{async list(options){
  assert.deepEqual(options,{prefix:'catalog:',limit:602});
  return {keys:data,list_complete:complete};
 }}});
 const moderate=await inspectBindings(mk(keys));
 assert.equal(moderate.sources.catalogDeltas.count,500);
 assert.equal(moderate.sources.catalogDeltas.status,'approaching_limit');
 assert.ok(moderate.sources.catalogDeltas.lastDeltaAt);
 const full=await inspectBindings(mk([...keys,...Array.from({length:100},(_,i)=>({name:'catalog:delta:'+stamp+':next-'+i}))]));
 assert.equal(full.sources.catalogDeltas.count,600);
 assert.equal(full.sources.catalogDeltas.status,'at_or_above_limit');
 const partial=await inspectBindings(mk(keys,false));
 assert.equal(partial.sources.catalogDeltas.exact,false);
 assert.equal(partial.sources.catalogDeltas.lastDeltaAt,null);
});
