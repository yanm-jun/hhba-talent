import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('function buildDailyOperationsRows(');
const end=source.indexOf('\nfunction renderDailyOperations(',start);
assert.ok(start>=0&&end>start,'test the exact shipped daily row builder');
const integer=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const build=runInNewContext(source.slice(start,end)+'\nbuildDailyOperationsRows;', {integer,Date,Number,Map});
const traffic= [
 {day:'2026-11-01',pv:0,jobViews:0,searches:0,outboundClicks:0},
 {day:'2026-11-02',pv:0,jobViews:0,searches:0,outboundClicks:0},
 {day:'2026-11-03',pv:3,jobViews:1,searches:2,outboundClicks:0},
 {day:'2026-11-04',pv:5,jobViews:0,searches:0,outboundClicks:1},
];
const report={
 period:{start:'2026-11-01',end:'2026-11-04',days:4,timezone:'UTC'},
 collectorStartedAt:'2026-11-02T07:38:55.485Z',
 account:{quality:'collected',registeredUsers:1,savedJobs:1,accountsWithSavedJobs:1,
  signupSeries:traffic.map((x,i)=>({day:x.day,count:i===2?1:0}))},
 traffic:{quality:'collected',series:traffic}
};
test('daily table joins authenticated PNVS signup series to real event counts by UTC date',()=>{
 const rows=build(report);
 assert.equal(rows.length,4);
 assert.equal(rows[2].signup,1);
 assert.equal(rows[2].pv,3);
 assert.equal(rows[2].jobViews,1);
 assert.equal(rows[2].searches,2);
 assert.equal(rows[3].outboundClicks,1);
 assert.equal(rows[1].pv,0,'a real zero after collection began remains zero');
 assert.equal(rows[1].signup,0,'zero signups from a connected identity table is valid');
});
test('days before event collector installation are unknown, not fabricated zero',()=>{
 const rows=build(report);
 assert.equal(rows[0].collected,false);
 assert.equal(rows[0].pv,null);
 assert.equal(rows[0].jobViews,null);
 assert.equal(rows[0].signup,0,'signup table has independent collection history');
});
test('missing signup, traffic or collector metadata fail closed',()=>{
 assert.equal(build({...report,traffic:{quality:'not_connected'}}),null);
 const noAccount=build({...report,account:{quality:'not_connected',signupSeries:[{day:'2026-11-03',count:999}]}});
 assert.equal(noAccount[2].signup,null);
 assert.equal(build({...report,collectorStartedAt:null})[2].pv,null);
 assert.equal(build({...report,traffic:{quality:'collected',series:[{day:'not-a-day',pv:4}]}}).length,0);
});
test('date filtering and real-data fields live inside ORIGINAL admin-preview',()=>{
 for(const id of ['users-date-from','users-date-to','users-apply-custom','users-daily-rows',
  'users-total-accounts','users-total-saves','users-accounts-with-saves','users-new-registrations']){
  assert.ok(html.includes('id="'+id+'"'),'required existing dashboard control '+id);
 }
 assert.match(source,/byId\('users-custom-range'\)\.hidden=value!=='custom'/);
 assert.match(source,/byId\('users-apply-custom'\)\.addEventListener/);
 assert.match(source,/diff>89/);
 assert.match(source,/growthRequestId/,'fast date changes cannot apply stale fetch');
 assert.match(source,/document\.createElement\('td'\)/,'table cells use textContent rather than unsafe HTML');
 assert.match(html,/不能当作历史区间累计收藏/);
 assert.match(html,/未开始采集的日期显示「未采集」/);
 assert.doesNotMatch(html,/同意使用情况统计|暂不同意/);
});
