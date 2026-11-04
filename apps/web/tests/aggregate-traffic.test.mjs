import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost as record} from '../functions/api/engagement/event.js';
import {onRequestGet as adminReport} from '../functions/api/admin/metrics.js';

const origin='https://hhba.work';
const secret='test-only-secret-is-long-enough-for-hmac-not-real-data';
function fixture(){
 const events=[];
 const db={prepare(sql){
  if(!sql.startsWith('INSERT OR IGNORE INTO hhba_traffic_events'))throw Error('unexpected SQL '+sql);
  return {bind(...args){this.args=args;return this},async run(){events.push(this.args);return {success:true}}};
 }};
 const env={HHBA_METRICS_DB:db,HHBA_METRICS_SECRET:secret};
 return {events,env};
}
function request(type,headers={},body=JSON.stringify({type})){
 return new Request(origin+'/api/engagement/event',{method:'POST',headers:{
  origin,'content-type':'application/json',...headers
 },body});
}
test('ordinary route events are counted without consent popup, visitor cookie, token or path',async()=>{
 const {events,env}=fixture();
 for(const type of ['page_view','page_view','job_view','job_search','official_apply_click']){
  const response=await record({request:request(type),env});
  assert.equal(response.status,202);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal((await response.json()).scope,'UNLINKED_EVENT_COUNT_ONLY');
 }
 assert.equal(events.length,5,'repeated actual events are real event counts');
 assert.deepEqual(events.map(x=>x[1]),['page_view','page_view','job_view','job_search','official_apply_click']);
 assert.equal(new Set(events.map(x=>x[2])).size,5,'per-event random nonces are never reused');
 assert.ok(events.every(x=>/^[a-f0-9]{48}$/.test(x[2])&&x[0]===x[4].slice(0,10)));
 assert.ok(events.every(x=>!JSON.stringify(x).includes('visitor-id')&&!JSON.stringify(x).includes('/candidate/jobs')));
});
test('browser cookie is not read, returned or used to link events',async()=>{
 const {events,env}=fixture();
 const h={'cookie':'__Host-hhba_visitor=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
 const first=await record({request:request('page_view',h),env});
 const second=await record({request:request('page_view',h),env});
 assert.equal(first.headers.has('set-cookie'),false);
 assert.equal(second.headers.has('set-cookie'),false);
 assert.equal(events.length,2);
 assert.notEqual(events[0][2],events[1][2]);
 assert.notEqual(events[0][2],'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});
test('strict event-only payload and privacy signals are enforced',async()=>{
 const {events,env}=fixture();
 const bad=[
  [request('page_view',{},JSON.stringify({type:'page_view',path:'/candidate/jobs'})),400],
  [request('page_view',{},JSON.stringify({type:'page_view',phone:'13900000000'})),400],
  [request('page_view',{},JSON.stringify({type:'page_view',query:'private-term'})),400],
  [request('something_else'),400],
  [request('page_view',{dnt:'1'}),403],
  [request('page_view',{'sec-gpc':'1'}),403],
  [request('page_view',{origin:'https://malicious.invalid'}),403],
  [request('page_view',{'content-type':'text/plain'}),415]
 ];
 for(const [req,code] of bad)assert.equal((await record({request:req,env})).status,code);
 assert.equal(events.length,0);
});
test('admin does not manufacture UV or DAU from count-only events',()=>{
 const admin=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 assert.match(admin,/dailyUvSum:null/);
 assert.match(admin,/dailyUv:null/);
 assert.match(admin,/accountAnalyticsEnabled:false/);
 assert.match(admin,/UNLINKED_AGGREGATE_EVENT_COUNTS_NO_UV/);
 assert.doesNotMatch(admin,/COUNT\(DISTINCT CASE WHEN event_type='page_view' THEN visitor_day_hash END\)/);
 assert.match(index,/访客 UV（未采集）/);
 assert.match(index,/账号行为采集已停止/);
});

test('public disclosure is a quiet page link, not a new consent or identity-tracking step',()=>{
 const shell=readFileSync(new URL('../src/components/Shell.tsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/DataUsePage.tsx',import.meta.url),'utf8');
 assert.match(shell,/<footer className="hhba-site-disclosure"><Link to="\/data-use">运营数据说明<\/Link><\/footer>/);
 assert.match(main,/if\(route==='\/data-use'\)return <DataUsePage user=\{user\}\/>/);
 assert.match(page,/事件次数/);
 assert.match(page,/不为访问统计设置访客 Cookie/);
 assert.match(page,/运营计数以最少字段收集/);
 assert.match(page,/简历智能匹配/);
 assert.match(page,/留期限和自动清理机制尚待平台完成专项治理验收/);
 assert.doesNotMatch(page,/<input|<button|同意使用情况统计|暂不同意/);
});
