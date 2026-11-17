import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const overview=read('pages/TransparencyPage.tsx');
const cases=read('pages/TransparencyCasesPage.tsx');
const funds=read('pages/TransparencyFundsPage.tsx');
const reports=read('pages/TransparencyReportsPage.tsx');
const rules=read('pages/TransparencyRulesPage.tsx');
const demo=read('pages/transparencyDemoData.ts');
const frame=read('pages/TransparencyFrame.tsx');
const legacy=read('pages/AidArchiveDemoPage.tsx');
const main=read('main.tsx');
const shell=read('components/Shell.tsx');
test('V6 public navigation opens fund and case summary with four concise archive rows',()=>{
 assert.match(overview,/workerDemoCurrency\(workerDemoTotals\.balance\)/);
 assert.match(overview,/workerDemoTotals\.cases/);
 assert.match(overview,/hhba-v6-archive-rows/);
 for(const p of ['cases','funds','reports','rules']){
  assert.ok(overview.includes('to="/transparency/'+p+'"'),p);
  assert.ok(main.includes("route==='/transparency/"+p+"'"),p);
 }
 assert.equal((shell.match(/className="auth hhba-nav-transparency"/g)||[]).length,2);
});
test('V6 all direct pages show one conspicuous shared demo disclosure',()=>{
 assert.match(demo,/WORKER_ARCHIVE_DEMO_NOTICE='此页面展示的数据为虚构演示数据。'/);
 assert.match(overview,/WORKER_ARCHIVE_DEMO_NOTICE/);
 assert.match(frame,/WORKER_ARCHIVE_DEMO_NOTICE/);
 assert.match(frame,/role="note"/);
 assert.match(cases,/WORKER_ARCHIVE_DEMO_MODE/);
 assert.match(funds,/WORKER_ARCHIVE_DEMO_MODE/);
 assert.match(reports,/WORKER_ARCHIVE_DEMO_MODE/);
});
test('V6 28 sample cases, 21 accounting entries and 60/40 policy remain separate from real database',()=>{
 assert.match(demo,/aidArchiveProfiles\.length!==28/);
 assert.match(demo,/workerDemoCases\.filter/);
 assert.match(demo,/workerDemoMonths/);
 assert.match(demo,/WORKER_ARCHIVE_DEMO_MODE/);
 assert.match(cases,/DemoCaseDocument/);
 assert.match(cases,/record\.timeline/);
 assert.match(cases,/record\.feeLabels/);
 assert.match(funds,/workerDemoLedger\.filter/);
 assert.match(funds,/workerDemoCurrency\(workerDemoTotals\.balance\)/);
 assert.match(rules,/不构成保险赔付/);
});
test('V6 archive detail links remain bidirectional with old anchors safely redirected',()=>{
 assert.match(cases,/\/transparency\/funds\?case=/);
 assert.match(funds,/\/transparency\/cases\?case=/);
 assert.match(funds,/\/transparency\/reports\?period=/);
 for(const item of ['financial-allocation','public-case-register','public-fund-register','fin-latest-title'])
  assert.ok(overview.includes("'#"+item+"'"),item);
 assert.match(legacy,/navigate\(destination\)/);
 assert.match(legacy,/noindex, nofollow, noarchive/);
});
test('V6 public report does not expose business turnover in UI or email',()=>{
 const dispatch=readFileSync(new URL('../functions/api/transparency/dispatch.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/transparency/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(reports,/available\.(revenueFen|netResultFen|distributableProfitFen|companyAllocationFen)/);
 assert.doesNotMatch(dispatch,/report\.(revenueFen|netResultFen|distributableProfitFen|companyAllocationFen)/);
 assert.match(api,/map\(publicFundReport\)/);
 assert.match(api,/const report=publicFundReport\(/);
});
