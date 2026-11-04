import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Extract the pure row builder from the exact browser script shipped to /admin-preview/.
// This prevents a duplicate test-only implementation from drifting away from production.
const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const begin=source.indexOf('function buildVerifiedInvestorRows(');
const end=source.indexOf('\nfunction exportCSV()',begin);
assert.ok(begin>=0&&end>begin,'actual investor exporter is present');
const buildRows=runInNewContext(source.slice(begin,end)+'\nbuildVerifiedInvestorRows;');

const publicSnapshot={
 kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2',quality:'current',
 asOf:'2026-11-04T04:00:00.000Z',auditCheckedAt:'2026-11-04T04:01:00.000Z',
 counts:{indexedJobs:11,displayableJobs:10,auditedJobRequirements:9,
  distinctIndexedCompanies:5,checkedAtsSources:4,failedAtsSources:0},
 definitions:{indexedJobs:'真实公开记录',displayableJobs:'不保证当前在招',
  auditedJobRequirements:'官网核验',distinctIndexedCompanies:'非合作企业',
  checkedAtsSources:'来源审计，不是合作企业',failedAtsSources:'失败来源'}
};
const privateData={
 kind:'HHBA_CLOUDFLARE_PRIVATE_METRICS_V1',asOf:'2026-11-04T05:12:00.000Z',
 period:{start:'2026-10-06',end:'2026-11-04',timezone:'UTC',days:30},
 account:{quality:'collected',registeredUsers:1,newRegistered:1,savedJobs:1,accountsWithSavedJobs:1},
 activity:{quality:'collected',dau:0,wau:0,mau:0,periodActive:0,
  firstSeenRetention:{d1:{eligible:0,returned:0,rate:null},d7:{eligible:0,returned:0,rate:null}}},
 traffic:{quality:'collected',pv:0,jobViews:2,searches:3,outboundClicks:1},
 devices:{quality:'collected',savedJobs:0}
};
const row=(rows,name)=>rows.find(x=>x[0]===name);
test('export reflects real PNVS registration and account saves while retaining true zero opt-in activity',()=>{
 const rows=buildRows(publicSnapshot,privateData);
 assert.equal(row(rows,'累计真实求职者账号')[1],'1');
 assert.equal(row(rows,'账号当前收藏岗位数')[1],'1');
 assert.equal(row(rows,'有账号收藏的求职者')[1],'1');
 assert.equal(row(rows,'账号 DAU')[1],'0');
 assert.equal(row(rows,'账号 WAU')[1],'0');
 assert.equal(row(rows,'账号 MAU')[1],'0');
 assert.equal(row(rows,'区间授权活跃账号')[1],'0');
 assert.equal(row(rows,'页面访问事件 PV')[1],'0');
 assert.equal(row(rows,'岗位详情浏览事件')[1],'2');
 assert.equal(row(rows,'岗位搜索事件')[1],'3');
 assert.equal(row(rows,'官网招聘链接点击事件')[1],'1');
 assert.match(row(rows,'官网招聘链接点击事件')[2],/不代表已投递/);
 assert.equal(row(rows,'设备有效收藏')[1],'0');
 assert.equal(row(rows,'首次活跃次日回访率')[1],'样本不足');
 assert.equal(row(rows,'累计真实求职者账号')[3],privateData.asOf);
 assert.match(row(rows,'区间新增求职者')[2],/2026-10-06 至 2026-11-04/);
 assert.match(row(rows,'账号当前收藏岗位数')[2],/与日期筛选无关/);
 assert.match(row(rows,'设备有效收藏')[2],/不是登录账号收藏/);
 assert.equal(row(rows,'真实收入')[1],'未接入');
 assert.ok(!JSON.stringify(rows).includes('phone')&&!JSON.stringify(rows).includes('token'));
});
test('missing/unauthorized private aggregates never become zero, even if public jobs are available',()=>{
 const rows=buildRows(publicSnapshot,null);
 assert.equal(row(rows,'累计真实求职者账号')[1],'未采集或未授权');
 assert.equal(row(rows,'账号当前收藏岗位数')[1],'未采集或未授权');
 assert.equal(row(rows,'账号 MAU')[1],'未采集或未授权');
 assert.equal(row(rows,'页面访问事件 PV')[1],'未采集或未授权');
 assert.equal(row(rows,'岗位搜索事件')[1],'未采集或未授权');
 assert.equal(row(rows,'已审计 ATS 来源')[1],'4');
 assert.equal(row(rows,'失败 ATS 来源')[1],'0');
 assert.equal(row(rows,'真实收入')[1],'未接入');
});
test('partial private results and invalid numbers are explicitly unavailable',()=>{
 const rows=buildRows(publicSnapshot,{
  ...privateData,account:{quality:'not_connected',registeredUsers:500},
  activity:{...privateData.activity,quality:'not_connected',mau:500},
  traffic:{...privateData.traffic,pv:-2},
  devices:{...privateData.devices,savedJobs:NaN}
 });
 assert.equal(row(rows,'累计真实求职者账号')[1],'未采集或未授权');
 assert.equal(row(rows,'账号 MAU')[1],'未采集或未授权');
 assert.equal(row(rows,'页面访问事件 PV')[1],'未采集或未授权');
 assert.equal(row(rows,'设备有效收藏')[1],'未采集或未授权');
});
test('retention uses mature first-active cohort, not registration retention',()=>{
 const rows=buildRows(publicSnapshot,{
  ...privateData,activity:{...privateData.activity,dau:2,periodActive:2,
   firstSeenRetention:{d1:{eligible:4,returned:1,rate:25},d7:{eligible:2,returned:1,rate:50}}}
 });
 assert.equal(row(rows,'账号 DAU')[1],'2');
 assert.equal(row(rows,'首次活跃次日回访率')[1],'25.00%（1/4）');
 assert.equal(row(rows,'首次活跃第七日回访率')[1],'50.00%（1/2）');
 assert.match(row(rows,'首次活跃第七日回访率')[2],/不是注册七日留存/);
});
