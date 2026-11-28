import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JOBS_PER_PAGE,FETCH_BATCH_SIZE,pageCount,batchOffsetForPage,sliceJobsForPage} from '../src/services/jobPaging.mjs';

const cards=readFileSync(new URL('../src/components/UnifiedJobMarket.tsx',import.meta.url),'utf8');
const reader=readFileSync(new URL('../src/services/officialJd.ts',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/HomePage.tsx',import.meta.url),'utf8');
const archive=readFileSync(new URL('../src/pages/CandidateJobsPage.tsx',import.meta.url),'utf8');

test('white HHBA keeps AI matching and labor rights entrances',()=>{
 assert.ok(home.includes('title="求职与机会"'));
 assert.ok(home.includes('title="劳动权益"'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
});
test('job cards only link internally to the white detail page',()=>{
 const card=cards.slice(cards.indexOf('function JobCard'),cards.indexOf('function LanguageSwitcher'));
 assert.match(card,/\/candidate\/jobs\//);
 assert.ok(!card.includes('<a href={source}'));
 assert.ok(!card.includes('企业官方页'));
 assert.ok(!card.includes('Official posting'));
});
test('white detail includes full JD parsing, retry and verified apply link',()=>{
 const detail=cards.slice(cards.indexOf('export function UnifiedJobDetail'));
 assert.ok(detail.includes('fetchOfficialJd(job,controller.signal)'));
 assert.ok(detail.includes('fetchPreparedBilingualJd(job,controller.signal)'));
 assert.ok(!detail.includes('translateGreenJd('),'the browser must never translate JD chunks on click');
 assert.ok(detail.includes('职位说明与任职要求'));
 assert.ok(detail.includes("setJdRetry(n=>n+1)"));
 assert.ok(detail.includes("safeOfficialJobUrl(job)"));
 assert.ok(detail.includes("'立即申请'"));
 assert.ok(!detail.includes('greenDetailLink'));
 assert.ok(!detail.includes('原有绿色市场'));
});
test('JD fallback keeps strict official identity checks',()=>{
 assert.ok(reader.includes('sameOfficialPosting(source.href,expected.href)'));
 assert.ok(reader.includes("body?.status!=='LIVE_CONTENT'"));
 assert.ok(reader.includes("body.description.length>100_000"));
 assert.ok(reader.includes("sourceHash:hash"));
 assert.ok(!reader.includes('原招聘市场查看'));
});

test('archive listing also keeps official links inside the detail, not cards',()=>{
 const listing=archive.slice(archive.indexOf('function Position('),archive.indexOf('export function CandidateJobsPage'));
 assert.ok(!listing.includes('<a href={direct}'));
 assert.ok(!listing.includes('去官方投递 ↗'));
 assert.ok(listing.includes('查看岗位'));
});

test('recruitment market hides all three highlighted notices while retaining filters and verified results',()=>{
 const market=cards.slice(cards.indexOf('export function UnifiedJobMarket'),cards.indexOf('export function UnifiedJobDetail'));
 for(const removed of [
   'unified-search-provenance','unified-audit-summary','unified-jd-sync-progress','unified-market-caution',
   '全量官方 JD 核验：','仅显示本页符合近期来源记录要求的岗位',
   '学历和年限筛选仅使用官方 JD 明确可识别的内容'
 ])assert.ok(!market.includes(removed),'notice still visible: '+removed);
 for(const retained of [
   'unified-job-controls','unified-job-grid','unified-job-search',
   'listJobs(filters,batchOffsetForPage(page),controller.signal)','officialStatus(j,snapshot.updated)',
   'type="checkbox"','unified-job-state'
 ])assert.ok(market.includes(retained),'required function unexpectedly removed: '+retained);
 assert.ok(cards.slice(cards.indexOf('export function UnifiedJobDetail')).includes('loadPublicJobAudit()'),
   'job detail official source audit must continue to work');
});

test('market pagination uses 10 visible jobs from independently verified 30-job backend batches',()=>{
 assert.equal(JOBS_PER_PAGE,10);
 assert.equal(FETCH_BATCH_SIZE,30);
 assert.equal(pageCount(0),0);
 assert.equal(pageCount(61),7);
 const roles=Array.from({length:30},(_,i)=>({id:'official-'+i}));
 for(let page=0;page<6;page++){
  const offset=batchOffsetForPage(page);
  assert.equal(offset,page<3?0:30,'backend fetch offset must cover 3 UI pages');
  const rows=sliceJobsForPage(roles,page);
  assert.equal(rows.length,10);
  assert.equal(rows[0].id,'official-'+((page%3)*10));
 }
 assert.equal(batchOffsetForPage(6),60);
 assert.throws(()=>batchOffsetForPage(-1),/INVALID_JOB_PAGE/);
 const market=cards.slice(cards.indexOf('export function UnifiedJobMarket'),cards.indexOf('export function UnifiedJobDetail'));
 assert.match(cards,/import \{JOBS_PER_PAGE,batchOffsetForPage,sliceJobsForPage,pageCount\}/);
 assert.match(market,/listJobs\(filters,batchOffsetForPage\(page\),controller\.signal\)/);
 assert.match(market,/sliceJobsForPage\(/);
});
test('cached original and complete Chinese are source-bound, no partial translation UI',()=>{
 const detail=cards.slice(cards.indexOf('export function UnifiedJobDetail'));
 assert.ok(detail.includes('setChineseJd(prepared.chinese'));
 assert.ok(detail.includes('setTranslationPrepared(prepared.ready)'));
 assert.ok(detail.includes('fetchOfficialJd(job,controller.signal)'));
 assert.ok(detail.includes('中文完整译文正在后台准备'));
 assert.ok(!detail.includes('翻译进度'));
 assert.ok(reader.includes('/ready-jd'));
 assert.ok(reader.includes('if(sourceHash!==data.sourceHash)'));
 assert.ok(reader.includes('data.sourceUrl!==job.url'));
});
