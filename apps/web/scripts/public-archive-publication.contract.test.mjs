import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as archiveApi} from '../functions/api/transparency/[[path]].js';
import {onRequest as demoResponse} from '../functions/transparency/archive-preview.js';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const request=(path)=>new Request('https://hhba.work'+path);
const mock=(results,capture)=>({prepare(sql){capture.push(sql);return {all:async()=>({results})};}});
const payload=async res=>res.json();

test('fictional demonstration is explicitly noindex in HTTP policy and client SPA',async()=>{
 const headers=read('public/_headers'), page=read('src/pages/AidArchiveDemoPage.tsx');
 assert.match(headers,/\/transparency\/archive-preview\*[\s\S]*?X-Robots-Tag: noindex, nofollow, noarchive/);
 assert.match(page,/meta\[name="robots"\]/);
 assert.match(page,/noindex, nofollow, noarchive/);
 const response=await demoResponse({next:async()=>new Response('<html></html>',{status:200})});
 assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 assert.equal(response.status,200);
 // The demo is not blocked via robots.txt, so crawlers can observe noindex.
 assert.doesNotMatch(read('public/robots.txt'),/Disallow:\s*\/transparency\/archive-preview/);
});

test('public endpoints are explicitly unconfigured when storage is absent',async()=>{
 const a=await payload(await archiveApi({request:request('/api/transparency/cases'),env:{}}));
 const b=await payload(await archiveApi({request:request('/api/transparency/ledger'),env:{}}));
 assert.deepEqual({state:a.state,cases:a.cases},{state:'not_ready',cases:[]});
 assert.deepEqual({state:b.state,entries:b.entries},{state:'not_ready',entries:[]});
});

test('published worker cases are retrieved only with consent, factual and privacy review',async()=>{
 const sql=[];
 const db=mock([{id:'CASE-2026-TEST123',title:'已脱敏的工资争议',category:'工资与薪酬',case_stage:'已结束',
  summary:'公开摘要',process_summary:'公开经过',outcome_summary:'公开结果',published_at:'2026-11-17',revised_at:null,
  consent_confirmed:1,approved_by:'internal-reviewer'}],sql);
 const response=await archiveApi({request:request('/api/transparency/cases'),env:{HHBA_TRANSPARENCY_DB:db}});
 assert.equal(response.status,200);
 const data=await payload(response);
 assert.equal(data.state,'ready');
 assert.equal(data.cases.length,1);
 assert.equal(data.cases[0].id,'CASE-2026-TEST123');
 assert.equal(data.cases[0].approved_by,undefined);
 assert.equal(data.cases[0].consent_confirmed,undefined);
 const query=sql.join(' ');
 for(const guard of ["publication_state='published'","consent_confirmed=1","fact_reviewed=1","privacy_reviewed=1","approved_by IS NOT NULL","published_at IS NOT NULL"])assert.ok(query.includes(guard),'Missing required guard '+guard);
});

test('published ledger rows require reviewed payments AND a published monthly report',async()=>{
 const sql=[];
 const db=mock([{id:'FUND-2026-TEST123',period:'2026-11',occurred_on:'2026-11-17',
  entry_kind:'outflow',amount_fen:12000,purpose_summary:'经审核可公开的事务性费用',public_case_id:'CASE-2026-TEST123',
  source_checked:1,approved_by:'finance'}],sql);
 const response=await archiveApi({request:request('/api/transparency/ledger'),env:{HHBA_TRANSPARENCY_DB:db}});
 assert.equal(response.status,200);
 const data=await payload(response);
 assert.equal(data.state,'ready');assert.equal(data.entries.length,1);
 assert.deepEqual(data.entries[0],{id:'FUND-2026-TEST123',period:'2026-11',date:'2026-11-17',
  kind:'outflow',amountFen:12000,purpose:'经审核可公开的事务性费用',caseId:'CASE-2026-TEST123'});
 const query=sql.join(' ');
 for(const guard of ["e.publication_state='published'","e.source_checked=1","e.privacy_reviewed=1",
  "e.approved_by IS NOT NULL","r.status='published'","c.consent_confirmed=1"])assert.ok(query.includes(guard),'Missing required guard '+guard);
});

test('missing publication tables do not masquerade as zero verified cases',async()=>{
 const db={prepare(){return {all:async()=>{throw new Error('D1_ERROR: no such table: hhba_worker_public_cases');}};}};
 const response=await archiveApi({request:request('/api/transparency/cases'),env:{HHBA_TRANSPARENCY_DB:db}});
 assert.equal(response.status,200);
 assert.equal((await payload(response)).state,'not_ready');
});

test('publication migration stores no demonstration data and gates release',()=>{
 const schema=read('d1/0021_worker_public_archive.sql');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hhba_worker_public_cases/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hhba_fin_public_entries/);
 assert.match(schema,/consent_confirmed=1 AND fact_reviewed=1 AND privacy_reviewed=1/);
 assert.match(schema,/source_checked=1 AND privacy_reviewed=1/);
 assert.doesNotMatch(schema,/INSERT INTO|HHBA-DEMO-00[1-9]|111350|111,350/i);
});

test('official and demo data use separate sources and legacy links remain compatible',()=>{
 const report=read('src/pages/TransparencyReportsPage.tsx');
 const cases=read('src/pages/TransparencyCasesPage.tsx');
 const funds=read('src/pages/TransparencyFundsPage.tsx');
 const overview=read('src/pages/TransparencyPage.tsx');
 const demo=read('src/pages/transparencyDemoData.ts');
 assert.match(report,/selectedReport\|\|reports\[0\]\|\|null/);
 assert.match(report,/url\.searchParams\.delete\('period'\)/);
 assert.match(cases,/OfficialTransparencyCasesPage/);
 assert.match(funds,/OfficialTransparencyFundsPage/);
 assert.match(cases,/fetch\(endpoint,\{cache:'no-store'\}\)/);
 assert.match(funds,/fetch\(endpoint\('\/ledger'\)/);
 assert.match(overview,/workerDemoTotals\.balance/);
 assert.match(demo,/workerDemoCases/);
 assert.match(demo,/workerDemoMonths/);
 assert.match(overview,/financial-allocation/);
 assert.doesNotMatch(read('d1/0021_worker_public_archive.sql'),/HHBA-DEMO-00[1-9]/);
});

test('public fund reports expose no company operating revenue or profit even when database contains them',async()=>{
 const published={period:'2026-10',revision:2,published_at:'2026-11-21T02:00:00Z',
  corrected_at:null,status:'published',published_json:JSON.stringify({
   revenueFen:999900,refundFen:2000,aiCostFen:33000,netResultFen:700000,
   distributableProfitFen:200000,companyAllocationFen:120000,
   openingPoolFen:10000,poolAccrualFen:80000,poolReceivedFen:80000,
   poolSpentFen:2500,closingPoolFen:87500,beneficiaries:2,
   basisNote:'CONFIDENTIAL-OPERATING-FIGURES',poolNote:'PRIVATE-NOTES',isAudited:false
  })};
 const db={prepare(){return {all:async()=>({results:[published]}),bind(){return {first:async()=>published};}};}};
 for(const route of ['/api/transparency/reports','/api/transparency/report?period=2026-10','/api/transparency/report?period=2026-10&revision=2']){
  const response=await archiveApi({request:request(route),env:{HHBA_TRANSPARENCY_DB:db}});
  assert.equal(response.status,200,route);
  const content=await response.text();
  for(const privateValue of ['999900','700000','200000','120000','CONFIDENTIAL-OPERATING-FIGURES','PRIVATE-NOTES','revenueFen','distributableProfitFen','companyAllocationFen','netResultFen'])assert.ok(!content.includes(privateValue),'Leaked financial value '+privateValue);
  assert.match(content,/poolReceivedFen/);
  assert.match(content,/87500/);
 }
});
