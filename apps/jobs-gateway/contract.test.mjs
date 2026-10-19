import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, normalizeAts, normalizeHistorical, searchSnapshot } from './contract.mjs';
import { createGateway, upstreamUrl, fetchAtsSnapshot } from './server.mjs';

const now = Date.parse('2026-10-19T12:00:00Z');
const row = (id = 'first', title = 'Account Executive', more = {}) => ({
  id: `ashby-openai-${id}`, company: 'OpenAI', title, titleZh: '客户经理',
  titleStatus: 'machine', location: 'San Francisco', locationZh: '旧金山',
  platform: 'ashby', source: 'openai', remote: false,
  url: `https://jobs.ashbyhq.com/openai/${id}`, ...more
});
const payload = jobs => ({ jobs, total: jobs.length, boards: 2, failures: 0, updated: '2026-10-19T11:00:00Z' });

test('recent ATS identity and bilingual metadata do not claim approved JD or confirmed application', () => {
 const result = normalizeAts(row(), { observedAt: '2026-10-19T11:00:00Z', now });
 assert.match(result.job_id, /^J_[0-9a-f]{32}$/);
 assert.equal(result.title.original, 'Account Executive');
 assert.equal(result.title.zh_CN, '客户经理');
 assert.equal(result.availability.application_confirmed_open, false);
 assert.equal(result.description.original_status, 'NOT_AVAILABLE_FOR_PUBLIC_DISPLAY');
 assert.equal(result.matching_eligibility, 'NEEDS_REQUIREMENTS_EVIDENCE');
});
test('canonical ID ignores marketing query and disallows fake official hosts', () => {
 const a = normalizeAts(row('a', 'Engineer', { url:'https://jobs.ashbyhq.com/openai/real?utm_source=foo' }),
  { observedAt:'2026-10-19T11:00:00Z', now });
 const b = normalizeAts(row('b', 'Engineer', { url:'https://jobs.ashbyhq.com/openai/real?utm_source=bar' }),
  { observedAt:'2026-10-19T11:00:00Z', now });
 assert.equal(a.job_id, b.job_id);
 for (const url of ['http://jobs.ashbyhq.com/openai/x',
  'https://jobs.ashbyhq.com.evil.test/openai/x', 'https://evil.test/openai/x']) {
  assert.equal(normalizeAts(row('x', 'Bad', { url }),
   { observedAt:'2026-10-19T11:00:00Z', now }), null);
 }
});
test('historical open, domestic unverified, stale data excluded from active market', () => {
 assert.equal(normalizeHistorical({job_id:'JOB-003545',job_title:'Marketing',job_status:'OPEN'}).active_market_eligible, false);
 assert.equal(normalizeAts(row('a', 'Marketing', { domestic:true }), { observedAt:'2026-10-19T11:00:00Z', now }), null);
 assert.equal(normalizeAts(row('a', 'Marketing', { status:'stale' }), { observedAt:'2026-10-19T11:00:00Z', now }), null);
 assert.equal(normalizeAts(row(), { observedAt:'2026-10-17T10:00:00Z', now }), null);
});
test('incomplete, failed or stale ATS snapshot fails closed', () => {
 assert.throws(() => buildSnapshot({ ...payload([row()]), failures:1 }, {now}));
 assert.throws(() => buildSnapshot({ ...payload([row()]), total:20 }, {now}));
 assert.throws(() => buildSnapshot({ ...payload([row()]), updated:'2026-10-17T00:00:00Z' }, {now}));
});
test('stable paging, Chinese search and legacy ID lookup', async () => {
 const s = buildSnapshot(payload([row('a'), row('b', 'Marketing'), row('c', 'Senior Engineer')]), {now});
 const a = searchSnapshot(s, {limit:'2',offset:'0'});
 const b = searchSnapshot(s, {limit:'2',offset:'2'});
 assert.equal(a.total, 3);
 assert.equal(new Set([...a.items,...b.items].map(x => x.job_id)).size, 3);
 assert.equal(searchSnapshot(s, {q:'客户经理'}).total, 3);
 const g = createGateway({source:async()=>payload([row('a')]), now:()=>now});
 await g.refresh();
 assert.equal(g.resolve('ashby-openai-a').job_id, g.resolve(g.resolve('ashby-openai-a').job_id).job_id);
});
test('read-only ATS upstream allowlist and no browser credentials', async () => {
 assert.equal(upstreamUrl('https://hhba-web-production-024c.up.railway.app/'),
 'https://hhba-web-production-024c.up.railway.app');
 assert.throws(() => upstreamUrl('https://example.com/'));
 assert.throws(() => upstreamUrl('http://hhba-web-production-024c.up.railway.app/'));
 const calls = [];
 const data = await fetchAtsSnapshot('https://hhba-web-production-024c.up.railway.app', {
  limit:2, fetchImpl:async (url,options) => {
    calls.push({url:String(url),options});
    const offset = Number(url.searchParams.get('offset'));
    return {ok:true,json:async()=>({
      jobs:offset ? [row('c')] : [row('a'),row('b')],
      total:3, boards:2, failures:0, updated:'2026-10-19T11:00:00Z'
    })};
  }
 });
 assert.equal(data.jobs.length, 3);
 assert.equal(calls.length, 2);
 assert.equal(calls[0].options.credentials, 'omit');
 assert.equal(calls[0].options.method, 'GET');
});
