import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const h=read('apps/web/src/pages/HomePage.tsx');
const market=read('apps/web/src/components/RecruitmentMarketplace.tsx');
const m=read('apps/web/src/main.tsx');
const c=read('apps/web/src/pages/CandidatePages.tsx');
const v=read('apps/web/vite.config.ts');
const j=read('apps/web/src/pages/CandidateJobsPage.tsx');
assert.equal((h.match(/<EntryCard\s/g)||[]).length,2);
for(const word of ['我要招人才','我要找工作'])assert.ok(h.includes(word));
assert.ok(h.includes("'/candidate/jobs'"));assert.ok(h.includes("'/recruiter/register'"));
assert.ok(m.includes("route==='/candidate/jobs'"));
assert.ok(m.includes('CandidateJobDetailPage'));
assert.ok(c.includes('to="/candidate/jobs"'));
assert.ok(/credentials:\s*'omit'/.test(j));
assert.ok(j.includes('HISTORICAL_MASTER'));
assert.ok(j.includes('历史标记开放'));
assert.ok(v.includes('VITE_RECRUITMENT_PROXY_TARGET'));
assert.ok(v.includes("request.removeHeader('cookie')"));
assert.ok(v.includes("request.removeHeader('authorization')"));
console.log('PASS: original two-entry HHBA homepage and candidate-only job search.');

// The market is BELOW two authentic role actions, never a third fake role.
assert.ok(h.includes('<RecruitmentMarketplace/>'));
assert.ok(h.indexOf('<RecruitmentMarketplace/>')>h.lastIndexOf('<EntryCard'));
assert.ok(market.includes("const sourceUrl = '/recruitment/api/v1/marketplace'"));
assert.ok(market.includes("credentials:'omit'"));
assert.ok(market.includes("typeof result.all_current_application_statuses_unverified !== 'boolean'"));
assert.ok(market.includes("OFFICIAL_HISTORICAL_UNCONFIRMED"));
assert.ok(market.includes("job.current_application_verified === true"));
assert.ok(market.includes("没有符合筛选条件的已核对官方岗位记录"));
assert.ok(market.includes("未公开"));
assert.ok(market.includes("官网核对 · 投递未确认 ↗"));
console.log('PASS: genuine official-sourced market mounted below two roles, no synthetic records or live-opening assertion.');

assert.ok(market.includes("去官方投递 ↗"));
assert.ok(market.includes("官网核对 · 投递未确认 ↗"));
assert.ok(market.includes("application_link_status !== 'VERIFIED_DIRECT'"));

assert.ok(market.includes("OFFICIAL_LIST_OBSERVED"));
assert.ok(market.includes("OFFICIAL_LIST_UNCONFIRMED"));
assert.ok(market.includes("查看企业招聘频道 · 非岗位直达 ↗"));
assert.ok(j.includes("查看企业招聘频道 · 不是该岗位投递地址"));
