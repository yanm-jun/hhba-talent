import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as rawRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {getPublicOverview,parsePublicIndex,PUBLIC_INDEX_ENDPOINT} from '../metrics.mjs';
import {createPreviewServer} from '../server.mjs';

const now=new Date('2026-10-21T00:05:00.000Z');
const fixture={allJobs:15552,boards:50,failures:0,updated:'2026-10-21T00:00:00.000Z'};
const file=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('validates official recruitment snapshot, preserving actual zeros and definitions',()=>{
 const result=parsePublicIndex(fixture,now);
 assert.equal(result.quality,'current');
 assert.equal(result.counts.indexedJobs,15552);
 assert.equal(result.counts.successfulJobBoards,50);
 assert.equal(result.counts.failedJobBoards,0);
 assert.equal(result.future.totalRegisteredUsers,null);
 assert.equal(result.future.revenueCny,null);
 assert.ok(result.definitions.successfulJobBoards.includes('不等于签约企业'));
 const empty=parsePublicIndex({...fixture,allJobs:0,boards:0},now);
 assert.equal(empty.counts.indexedJobs,0);
});
test('fails closed on missing, stale, partial or malformed upstream data',()=>{
 assert.throws(()=>parsePublicIndex({...fixture,allJobs:'15552'},now),/INVALID/);
 assert.throws(()=>parsePublicIndex({...fixture,updated:'not a date'},now),/TIMESTAMP/);
 assert.throws(()=>parsePublicIndex({...fixture,updated:'2026-10-23T00:00:00Z'},now),/TIMESTAMP/);
 const partial=parsePublicIndex({...fixture,failures:2},now);
 assert.equal(partial.quality,'partial');
 assert.equal(partial.counts.indexedJobs,null);
 assert.equal(partial.counts.successfulJobBoards,null);
 assert.equal(partial.counts.failedJobBoards,2);
 const stale=parsePublicIndex({...fixture,updated:'2026-10-18T00:00:00Z'},now);
 assert.equal(stale.quality,'stale');
 assert.equal(stale.counts.indexedJobs,null);
});
test('proxy only calls hard-coded public metadata endpoint, sends no cookies',async()=>{
 let called=null;
 const fetchImpl=async(uri,options)=>{
  called={uri,options};
  return {ok:true,json:async()=>fixture};
 };
 const result=await getPublicOverview({fetchImpl,now});
 assert.equal(result.counts.indexedJobs,15552);
 assert.equal(called.uri,PUBLIC_INDEX_ENDPOINT);
 assert.equal(called.options.method,'GET');
 assert.equal(called.options.credentials,'omit');
 assert.equal(called.options.redirect,'error');
 assert.ok(!('Cookie' in called.options.headers));
});
test('server is localhost only, refuses writes and exposes only vetted paths',async(t)=>{
 const local=createPreviewServer({overview:async()=>parsePublicIndex(fixture,now)});
 local.listen(0,'127.0.0.1');
 await once(local,'listening');
 t.after(()=>local.close());
 const port=local.address().port,origin='http://127.0.0.1:'+port;
 const home=await fetch(origin+'/');
 assert.equal(home.status,200);
 assert.match(home.headers.get('content-security-policy'),/default-src 'none'/);
 assert.match(home.headers.get('cache-control'),/no-store/);
 assert.match(await home.text(),/数据总览/);
 const response=await fetch(origin+'/api/overview');
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.counts.successfulJobBoards,50);
 const post=await fetch(origin+'/api/overview',{method:'POST'});
 assert.equal(post.status,405);
 const unknown=await fetch(origin+'/secret/users');
 assert.equal(unknown.status,404);
 const hostile=await new Promise((resolve,reject)=>{
  const req=rawRequest({hostname:'127.0.0.1',port,path:'/',method:'GET',headers:{Host:'example.com'}},res=>{
    res.resume();res.on('end',()=>resolve(res.statusCode));
  });
  req.on('error',reject);req.end();
 });
 assert.equal(hostile,403);
});
test('failed upstream remains unavailable without synthetic investor data',async(t)=>{
 const local=createPreviewServer({overview:async()=>{throw Error('PRIVATE_STACK_TRACE_TEST')}});
 local.listen(0,'127.0.0.1');
 await once(local,'listening');
 t.after(()=>local.close());
 const response=await fetch('http://127.0.0.1:'+local.address().port+'/api/overview');
 assert.equal(response.status,503);
 const body=await response.text();
 assert.match(body,/真实招聘索引暂不可用/);
 assert.doesNotMatch(body,/PRIVATE_STACK_TRACE_TEST/);
});
test('UI keeps future metrics null and distinguishes current snapshots from historical period filters',()=>{
 const html=file('../index.html');
 const js=file('../dashboard.js');
 const css=file('../styles.css');
 assert.match(html,/累计注册用户/);
 assert.match(html,/全部索引记录/);
 assert.match(html,/融资数据展示/);
 assert.match(html,/近 30 天/);
 assert.match(js,/当前岗位指标为最新索引快照/);
 assert.ok(js.includes("['current','partial'].includes(data?.quality)"));
 assert.match(js,/function exportCSV/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/max-width:780px/);
 assert.doesNotMatch(html,/15,552|50\s*家合作|模拟增长/);
});
