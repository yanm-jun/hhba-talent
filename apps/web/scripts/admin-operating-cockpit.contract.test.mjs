import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {privateFinanceSnapshot,externalDiscoverySnapshot,onRequestGet} from '../functions/admin-preview/api/command-center.js';

const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('income curve uses only published, immutable monthly financial snapshots',()=>{
 const published=(month,overrides={})=>({
  period:month,status:'published',revision:1,published_at:month+'-25T12:00:00Z',
  published_json:JSON.stringify({revenueFen:17000,refundFen:1000,
   netResultFen:-4000,distributableProfitFen:0,poolAccrualFen:0,
   aiCostFen:600,operationsFen:1000,...overrides})
 });
 const privateDraft={period:'2026-11',status:'draft',revision:0,
  published_json:JSON.stringify({revenueFen:9900000,netResultFen:8800000})};
 const publishedRows=[published('2026-10'),privateDraft,published('2026-09',{revenueFen:0,netResultFen:0})];
 const snapshot=privateFinanceSnapshot(publishedRows);
 assert.equal(snapshot.quality,'published_only');
 assert.deepEqual(snapshot.months.map(x=>x.period),['2026-09','2026-10']);
 assert.equal(snapshot.latest.revenueFen,17000);
 assert.equal(snapshot.latest.netResultFen,-4000);
 assert.equal(snapshot.months[0].revenueFen,0,'A genuinely published zero is valid');
 assert.equal(snapshot.months.some(x=>x.revenueFen===9900000),false);
 assert.equal(snapshot.months[0].distributableProfitFen,0);
 assert.equal(snapshot.months[1].aiCostFen,600);
 assert.deepEqual(privateFinanceSnapshot([]),{
  quality:'no_published_report',latest:null,months:[],
  scope:'仅人工审核并公开的历史月报；当前未结束月份及草稿不参与核算'
 });
});

test('external exploration quota records do not claim all AI success rates or cost',()=>{
 const result=externalDiscoverySnapshot([
  {day_utc:'2026-11-15',n:3},{day_utc:'2026-11-16',n:0},
  {day_utc:'2026-11-17',n:'2'},{day_utc:'bad',n:4},{day_utc:'2026-11-16',n:-5}
 ]);
 assert.equal(result.quality,'partial_scope');
 assert.equal(result.total,5);
 assert.equal(result.byDay.length,3);
 assert.equal(result.successRate,null);
 assert.equal(result.avgLatencyMs,null);
 assert.equal(result.costFen,null);
 assert.match(result.scope,/不包含全部简历匹配/);
});

test('cockpit route denies anonymous requests before any database reads',async()=>{
 const db={prepare(){throw new Error('unsafe access attempted')}};
 const res=await onRequestGet({
  request:new Request('https://admin.hhba.work/admin-preview/api/command-center?days=30'),
  env:{HHBA_FINANCE_ADMIN_EMAIL:'finance-admin@example.invalid',
   HHBA_TRANSPARENCY_DB:db,HHBA_PNVS_AUTH_DB:db}
 });
 assert.notEqual(res.status,200);
});

test('cockpit UI reuses the ONLY private admin and never invents revenue, successful placements or account UV',()=>{
 const html=source('../../admin-preview/index.html');
 const js=source('../../admin-preview/command-center.js');
 const css=source('../../admin-preview/command-center.css');
 const builder=source('./build-standalone-admin.py');
 const api=source('../functions/admin-preview/api/command-center.js');
 assert.match(html,/id="hhba-command-center"/);
 assert.match(html,/id="cc-chart-signups"/);
 assert.match(html,/id="cc-chart-search"/);
 assert.match(html,/id="cc-chart-pv"/);
 assert.match(html,/id="cc-chart-finance"/);
 assert.match(html,/data-cc-days="90"/);
 assert.match(html,/id="cc-ai-cost"/);
 assert.match(html,/id="cc-revenue"/);
 assert.match(html,/class="hhba-cc-legacy"/);
 assert.match(builder,/"command-center.js","command-center.css"/);
 assert.match(builder,/src="\/command-center.js"/);
 assert.match(js,/fetch\('\/admin-preview\/api\/metrics\?days='/);
 assert.match(js,/fetch\('\/admin-preview\/api\/command-center\?days='/);
 assert.match(js,/r.day>=collector/);
 assert.match(js,/valid<values.length\?' · 缺失日期不补零'/);
 assert.match(js,/secondary:monthlySeries\(result.finance.months,'netResultFen'\)/);
 assert.match(js,/仍未接入|尚未完整采集|尚无完整可核验/);
 assert.doesNotMatch(js,/Math.random|demoDataset|fakeRevenue|simulatePurchase/);
 assert.match(api,/HHBA_FINANCE_ADMIN_EMAIL/);
 assert.match(api,/verifyAdmin\(request,env\)/);
 assert.match(api,/status='published'/);
 assert.match(api,/HHBA_PNVS_AUTH_DB/);
 assert.match(api,/quality:'not_connected'/);
 assert.match(css,/@media\(max-width:440px\)/);
});
