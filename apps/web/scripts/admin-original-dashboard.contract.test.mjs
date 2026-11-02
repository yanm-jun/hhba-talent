import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {normalizePublicMetrics,normalizePrivateMetrics} from '../public/preview-admin/cloudflare-metrics-adapter.mjs';
const file=new URL('../public/preview-admin/',import.meta.url);
const read=p=>readFile(new URL(p,file),'utf8');
test('original HHBA dashboard DOM and all original menus remain',async()=>{
 const html=await read('index.html'),script=await read('dashboard.js'),workbench=await read('unified-workbench.js');
 for(const name of ['数据总览','访问与收藏','岗位与企业','运营监控','财务成本','融资展示','系统设置'])
  assert(html.includes(name),'missing original navigation '+name);
 for(const name of ['招聘业务','招聘履约','企业档案','审核待办','证据核验','员工关怀','双评分','申诉复核','真实改善','公开发布','帮扶审批','客户合作'])
  assert(workbench.includes(name),'missing original workbench '+name);
 for(const id of ['jobs-count','boards-count','registered-users','active-users','ov-pv','ov-uv','ov-saves','growth-pv','growth-saved','growth-changes','investor-jobs','investor-pv'])
  assert(html.includes('id="'+id+'"'),'missing existing KPI target '+id);
 assert(script.includes('cloudflareMetrics?\'/api/metrics/public\''));
 assert(script.includes('cloudflareMetrics?\'/api/admin/metrics\''));
 assert(!html.includes('/admin-metrics/'),'duplicate dashboard link forbidden');
});
test('Cloudflare public metrics adapter preserves official record source and null quality',()=>{
 const p=normalizePublicMetrics({kind:'HHBA_CLOUDFLARE_PUBLIC_METRICS_V1',sourceTime:'2026-11-02T05:32:29.000Z',auditCheckedAt:'2026-11-02T05:33:00.000Z',quality:'current',counts:{indexedJobs:15744,displayableJobs:15743,auditedJobRequirements:14654,checkedAtsSources:50,failedAtsSources:0,distinctIndexedCompanies:500},definitions:{}});
 assert.equal(p.counts.displayableJobs,15743);assert.equal(p.counts.checkedAtsSources,50);assert.equal(p.asOf,'2026-11-02T05:32:29.000Z');
});
test('private metrics adapter retains zero observed values without inventing accounts',()=>{
 const p=normalizePrivateMetrics({kind:'HHBA_CLOUDFLARE_PRIVATE_METRICS_V1',asOf:'2026-11-02T05:34:00Z',period:{start:'2026-11-02',end:'2026-11-02',days:1},traffic:{quality:'collected',pv:0,dailyUvSum:0,jobViews:0,searches:0,outboundClicks:0,series:[{day:'2026-11-02',pv:0,dailyUv:0}]},devices:{quality:'collected',savedJobs:0,devicesWithSavedJobs:0,added:0,removed:0},account:{quality:'not_connected',registeredUsers:null,dau:null,mau:null,reason:'production only'}});
 assert.equal(p.traffic.pv,0);assert.equal(p.bookmarks.totalActive,0);
 assert.equal(p.bookmarks.added,0);assert.equal(p.account.registeredUsers,null);assert.equal(p.account.dau,null);assert.equal(p.account.mau,null);
 assert.deepEqual(p.traffic.series.map(x=>x.date),['2026-11-02']);
});
test('no independent duplicate metrics dashboard in source',async()=>{
 await assert.rejects(stat(new URL('../public/admin-metrics/index.html',import.meta.url)),/ENOENT/);
});
