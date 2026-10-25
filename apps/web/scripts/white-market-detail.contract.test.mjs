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
test('white detail uses first-party saved job records only, while preserving verified employer apply link',()=>{
 const detail=cards.slice(cards.indexOf('export function UnifiedJobDetail'));
 assert.ok(detail.includes('readSelfHostedJd(job,controller.signal)'));
 assert.ok(!detail.includes('fetchOfficialJd('));
 assert.ok(!detail.includes('fetchPreparedBilingualJd('));
 assert.ok(!detail.includes('translateGreenJd('));
 assert.ok(!detail.includes('setJdRetry'));
 assert.ok(detail.includes('职位说明与任职要求'));
 assert.ok(detail.includes('safeOfficialJobUrl(job)'));
 assert.ok(detail.includes("'立即申请'"));
 assert.ok(detail.includes('HHBA 本地岗位资料'));
 assert.ok(detail.includes('未取得足以展示的职责和任职要求'));
 assert.ok(!detail.includes('greenDetailLink'));
});
test('self-hosted JD shards do not call foreign endpoints or invent requirements',()=>{
 const local=readFileSync(new URL('../src/services/selfHostedJd.ts',import.meta.url),'utf8');
 assert.ok(local.includes("import.meta.env.BASE_URL+'data/self-hosted-jd/v1/'"));
 assert.ok(local.includes("row.sourceUrl!==job.url"));
 assert.ok(local.includes("row.title!==job.title"));
 assert.ok(local.includes("row.company!==job.company"));
 assert.ok(!/https:\/\/|JD_API_ORIGIN|boards-api|api\.lever\.co|api\.ashbyhq/.test(local));
 // Old reader remains in the repository for historical provenance, not in the public detail flow.
 assert.ok(reader.includes('sameOfficialPosting(source.href,expected.href)'));
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

test('static details distinguish self-authored summaries from unverified full JD',()=>{
 const detail=cards.slice(cards.indexOf('export function UnifiedJobDetail'));
 assert.ok(detail.includes("staticJd.mode==='ARCHIVAL_EDITORIAL'"));
 assert.ok(detail.includes("staticJd.mode==='MANUAL_EDITORIAL'"));
 assert.ok(detail.includes('EXTRACTED_FACTS'));
 assert.ok(detail.includes('HHBA 根据招聘方公开信息独立整理'));
 assert.ok(detail.includes('不会在打开职位时请求境外 ATS'));
 assert.ok(!detail.includes('中文完整译文正在后台准备'));
 assert.ok(!detail.includes('正在读取官方岗位职责及任职要求'));
});
