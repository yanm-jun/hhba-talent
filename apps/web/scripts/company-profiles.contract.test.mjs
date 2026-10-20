import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const data=read('../src/services/companyProfiles.ts');
const page=read('../src/pages/CompanyProfilePage.tsx');
const jobMarket=read('../src/components/UnifiedJobMarket.tsx');
const router=read('../src/router.tsx');
const app=read('../src/main.tsx');
const server=read('../../../ops/legacy-marketplace/railway-function-20261018.ts');
const css=read('../src/styles/company-profiles.css');

test('HHBA authors sourced company information without invented financial figures',()=>{
 for(const [company,home] of [
  ['OpenAI','https://openai.com/about/'],
  ['Anthropic','https://www.anthropic.com/company'],
  ['SpaceX','https://www.spacex.com/mission/']
 ])assert.ok(data.includes(home),company+' needs original public source');
 assert.ok(data.includes("lastReviewed:'2026-10-20'"));
 assert.ok(data.includes("slug:'openai'")&&data.includes("slug:'anthropic'")&&data.includes("slug:'spacex'"));
 assert.ok(data.includes("companyProfileForJob"));
 assert.ok(data.includes("verifiedBrandKey(job)"));
 assert.ok(!/revenue:|valuation:|employeesCount:|netProfit:/i.test(data));
 assert.ok(data.includes('HHBA')&&data.includes('并不意味着 HHBA 获得了企业招聘授权'));
});
test('company identity opens company profile; job title and View job still open detail',()=>{
 assert.ok(jobMarket.includes("to={'/companies/'+profile.slug}"));
 assert.ok(jobMarket.includes("to={'/companies/'+companyProfile.slug}"));
 assert.ok(jobMarket.includes("to={'/candidate/jobs/'+encodeURIComponent(job.id)}"));
 assert.ok(jobMarket.includes('companyProfileForJob(job)'));
 assert.ok(page.includes("className=\"company-profile-identity\""));
 assert.ok(page.includes("logoName[profile.slug]"));
 assert.ok(page.includes("getCompanyReturnTarget()"));
});
test('no fake jobs: company posts derive from current verified ATS and official JD audit',()=>{
 assert.ok(page.includes('loadOfficialPublicSnapshot(controller.signal)'));
 assert.ok(page.includes('loadPublicJobAudit()'));
 assert.ok(page.includes('audit.summary.indexed_as_of!==snapshot.updated'));
 assert.ok(page.includes("row.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'"));
 assert.ok(page.includes("verifiedBrandKey(job)===profile.slug"));
 assert.ok(page.includes("officialStatus(job,snapshot.updated)==='recent'"));
 assert.ok(page.includes('!!safeOfficialJobUrl(job)'));
 assert.ok(page.includes("jobs.slice(0,shown)"));
 assert.ok(page.includes("jobs.length.toLocaleString()"));
 assert.ok(!page.includes('placeholder job'));
});
test('company profile supports real deep links and company-only job filter',()=>{
 assert.ok(app.includes("if(/^\\/companies\\/[a-z-]{2,60}$/.test(route))"));
 assert.ok(server.includes('companies(?:\\/(?:openai|anthropic|spacex|id\\/'));
 assert.ok(router.includes('const companyRoute='));
 assert.ok(router.includes("getCompanyReturnTarget()"));
 assert.ok(router.includes('hhbaCompanyOrigin'));
 assert.ok(jobMarket.includes('initialCompanyQuery()'));
 assert.ok(jobMarket.includes('filters.company'));
 assert.ok(jobMarket.includes('清除企业筛选'));
 assert.ok(page.includes("'/candidate/jobs?company='+encodeURIComponent(profile.name)"));
});
test('responsive white profile shows independently sourced business info and working links',()=>{
 for(const marker of ['关于企业','主要业务与代表产品','发展与重要节点',
   '该企业的真实招聘岗位','信息来源','企业官方招聘网站','企业官网'])
  assert.ok(page.includes(marker),'missing section '+marker);
 assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'));
 assert.ok(page.includes('LanguageSwitch'));
 assert.ok(page.includes('company-profile-editorial'));
 assert.ok(css.includes('@media(max-width:720px)'));
 assert.ok(css.includes('.company-profile-job-grid'));
});
