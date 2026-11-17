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

test('invalid report period falls back to latest publication and new pages preserve official separation',()=>{
 const report=read('src/pages/TransparencyReportsPage.tsx');
 const cases=read('src/pages/TransparencyCasesPage.tsx');
 const funds=read('src/pages/TransparencyFundsPage.tsx');
 const overview=read('src/pages/TransparencyPage.tsx');
 assert.match(report,/selectedReport\|\|reports\[0\]\|\|null/);
 assert.match(report,/url\.searchParams\.delete\('period'\)/);
 assert.match(report,/if\(loading\|\|error\|\|!selected\|\|selectedReport\)return/);
 assert.match(cases,/fetch\(endpoint,\{cache:'no-store'\}\)/);
 assert.match(funds,/fetch\(endpoint\('\/ledger'\)/);
 assert.match(cases,/暂无通过公开审核的真实案例/);
 assert.match(funds,/逐笔资金公开数据库尚未启用/);
 assert.match(overview,/<h1>责任与透明<\/h1>/);
 assert.doesNotMatch(overview+cases+funds+report,/HHBA-DEMO-OUT-|111350|111,350/);
});
