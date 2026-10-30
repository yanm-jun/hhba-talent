import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cards=readFileSync(new URL('../src/components/UnifiedJobMarket.tsx',import.meta.url),'utf8');
const reader=readFileSync(new URL('../src/services/officialJd.ts',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/HomePage.tsx',import.meta.url),'utf8');
const archive=readFileSync(new URL('../src/pages/CandidateJobsPage.tsx',import.meta.url),'utf8');

test('white HHBA keeps both candidate and employer entrances',()=>{
 assert.ok(home.includes('title="我要应聘"'));
 assert.ok(home.includes('title="我要招人"'));
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
   'listJobs(filters,page*30,controller.signal)','officialStatus(j,snapshot.updated)',
   'type="checkbox"','unified-job-state'
 ])assert.ok(market.includes(retained),'required function unexpectedly removed: '+retained);
 assert.ok(cards.slice(cards.indexOf('export function UnifiedJobDetail')).includes('loadPublicJobAudit()'),
   'job detail official source audit must continue to work');
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
