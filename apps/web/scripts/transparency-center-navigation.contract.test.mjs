import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const overview=source('pages/TransparencyPage.tsx');
const cases=source('pages/TransparencyCasesPage.tsx');
const funds=source('pages/TransparencyFundsPage.tsx');
const reports=source('pages/TransparencyReportsPage.tsx');
const rules=source('pages/TransparencyRulesPage.tsx');
const demo=source('pages/AidArchiveDemoPage.tsx');
const shell=source('components/Shell.tsx');
const routes=source('main.tsx');
const css=source('styles/transparency-v5.css');

test('V5: one clear public-center entry in public and candidate header',()=>{
 assert.equal((shell.match(/className="auth hhba-nav-transparency"/g)||[]).length,2);
 assert.match(shell,/to="\/transparency" className="hhba-fin-footer-link"/);
 assert.match(overview,/<h1>责任与透明<\/h1>/);
 assert.match(css,/\.hhba-v5-cardgrid/);
 assert.doesNotMatch(overview,/hhba-resp-detail-nav|hhba-resp-public-register/);
});

test('V5: all four cards have a separate accessible routed page',()=>{
 const paths=['cases','funds','reports','rules'];
 for(const path of paths){
  assert.match(overview,new RegExp('to="/transparency/'+path+'"'));
  assert.match(routes,new RegExp("route==='/transparency/"+path+"'"));
 }
 assert.match(cases,/<TransparencyFrame/);
 assert.match(funds,/<TransparencyFrame/);
 assert.match(reports,/export function TransparencyReportsPage/);
 assert.match(rules,/export function TransparencyRulesPage/);
});

test('V5: old financial allocation and report deep links redirect to new locations',()=>{
 const targets={
  '#financial-allocation':'/transparency/rules#financial-allocation',
  '#responsibility-support':'/transparency/rules#responsibility-support',
  '#public-policy-monitor':'/transparency/rules#public-policy-monitor',
  '#fin-latest-title':'/transparency/reports#fin-latest-title',
  '#public-case-register':'/transparency/cases',
  '#public-fund-register':'/transparency/funds'
 };
 for(const [hash,destination] of Object.entries(targets))
  assert.ok(overview.includes("'"+hash+"':'"+destination+"'"),'Unmapped legacy URL: '+hash);
 assert.match(overview,/navigate\(withPeriod\)/);
 assert.match(reports,/url\.searchParams\.delete\('period'\)/);
 assert.match(reports,/selectedReport\|\|reports\[0\]\|\|null/);
 assert.match(rules,/id="financial-allocation"/);
});

test('V5: actual published report totals and approved case/ledger records stay separate',()=>{
 assert.match(funds,/fetch\(endpoint\('\/reports'\)/);
 assert.match(funds,/fetch\(endpoint\('\/ledger'\)/);
 assert.match(cases,/fetch\(endpoint,\{cache:'no-store'\}\)/);
 assert.match(funds,/reports\.map\(item=><tr key=\{item\.period\}>/);
 for(const key of ['poolReceivedFen','poolSpentFen','closingPoolFen'])assert.match(funds,new RegExp('yuan\\(item\\.'+key+'\\)'));
 assert.match(cases,/真实案例公开数据库尚未启用/);
 assert.match(funds,/逐笔资金公开数据库尚未启用/);
 assert.match(cases,/未经授权|经过本人授权/);
 assert.doesNotMatch(overview+cases+funds+reports+rules,/HHBA-DEMO-OUT-|HHBA-DEMO-001|111350|111,350/);
});

test('V5: simulation remains a distinct clearly fictional experience',()=>{
 assert.match(cases,/to="\/transparency\/archive-preview\?view=cases"/);
 assert.match(cases,/人物、雇主、争议、金额和结果均为虚构/);
 assert.match(demo,/view==='cases'\|\|view==='funds'/);
 assert.match(demo,/setArchiveUrl\(next\)/);
 assert.match(demo,/setLedgerQuery\(chosen.id\)/);
 assert.match(demo,/情景模拟，非真实案例/);
});

test('V5: linked public cases and approved fund entries offer bidirectional navigation',()=>{
 assert.match(cases,/\/transparency\/funds\?case=/);
 assert.match(funds,/\/transparency\/cases\?case=/);
 assert.match(funds,/完整资金汇总以月报为准/);
 assert.match(rules,/不构成保险赔付/);
 assert.match(reports,/财务报告邮件订阅/);
});
