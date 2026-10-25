import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const shell=src('components/Shell.tsx');
const policy=src('services/recruitmentOutbound.ts');
const flow=src('pages/OfficialRecruitmentContinuePage.tsx');
const main=src('main.tsx');
const demoAuth=src('pages/DemoAuthPage.tsx');
const realAuth=src('pages/AuthPage.tsx');
const domestic=src('pages/DomesticCompanyPage.tsx');
const domesticCss=src('styles/domestic-company-search.css');
const foreignPhotos=src('components/CompanyVisualStory.tsx');

test('every recruitment link follows a single registration-first policy across routes',()=>{
 assert.ok(shell.includes('onClickCapture={guardRecruitmentClick}'));
 assert.ok(shell.includes("event.target.closest<HTMLAnchorElement>('a[href]')"));
 assert.ok(shell.includes('const destination=recruitmentTarget(anchor)'));
 assert.ok(shell.includes('if(!destination||verifiedCandidate)return'));
 assert.ok(shell.includes('verifiedCandidate=employerApiReady&&hasCandidate'));
 assert.ok(shell.includes('onAuxClickCapture={guardRecruitmentClick}'));
 assert.ok(shell.includes('onContextMenuCapture={guardRecruitmentContextMenu}'));
 assert.ok(shell.includes("navigate('/candidate/register?next=%2Fcandidate%2Fofficial-outbound')"));
 assert.ok(shell.includes('route+location.search')); // no /hhba-talent/ duplicated after registration
 assert.ok(policy.includes("data-hhba-recruitment-outbound")||policy.includes("dataset.hhbaRecruitmentOutbound"));
 assert.ok(policy.includes("EXPLICIT.test(label)||PATH.test(path)"));
 assert.ok(policy.includes("SOURCES.test(label)")); // source evidence links stay ungated
 assert.ok(!shell.includes('window.open('));
 assert.ok(!shell.includes('location.href='));
 assert.ok(shell.includes("route.startsWith('/admin')"));
 assert.ok(shell.includes("route.startsWith('/employer')"));
});

test('all known official recruiter endpoints share same outbound marker',()=>{
 const files=[
  'pages/DomesticCompanyPage.tsx','pages/CompanyProfilePage.tsx',
  'pages/IndexedCompanyPage.tsx','components/UnifiedJobMarket.tsx',
  'pages/CandidateJobsPage.tsx','components/RecruitmentMarketplace.tsx',
  'components/CuratedJobMarket.tsx','pages/EmployerPublicJobsPage.tsx',
  'components/AICompanySearch.tsx','components/HomeFeaturedEmployers.tsx',
  'pages/CandidateMatchPage.tsx','pages/ResumeMatchPage.tsx','pages/MajorCompaniesPage.tsx'
 ];
 for(const file of files){
  const c=src(file);
  assert.ok(c.includes('data-hhba-recruitment-outbound="true"'),'ungated official external recruitment family '+file);
 }
 assert.match(domestic,/<a data-hhba-recruitment-outbound="true" href=\{careers\}/);
 for(const needle of ['href={official}','href={job.url}'])
  assert.ok(src('components/UnifiedJobMarket.tsx').includes(needle));
});

test('login and demo account routes preserve stored official link without arbitrary next= external redirects',()=>{
 assert.ok(main.includes("route==='/candidate/official-outbound'"));
 assert.ok(main.includes('OfficialRecruitmentContinuePage'));
 assert.ok(demoAuth.includes("'/candidate/official-outbound'"));
 assert.ok(demoAuth.includes('resumeQuery'));
 assert.ok(realAuth.includes("safeNext==='/candidate/official-outbound'"));
 assert.ok(flow.includes('pendingRecruitment()'));
 assert.ok(flow.includes('registered')||flow.includes('signed'));
 assert.ok(flow.includes('href={saved.url}'));
 assert.ok(flow.includes('clearPendingRecruitment()'));
 assert.ok(flow.includes('正式账户服务尚未开通'));
 assert.ok(flow.includes('const signed=employerApiReady&&!!user?.account_types?.includes(\'candidate\')'));
 assert.ok(!flow.includes('useDemoAccount'));
 assert.ok(!flow.includes('demoModeEnabled&&!!demo'));
 assert.ok(demoAuth.includes('演示注册无法解锁第三方招聘官网'));
 assert.ok(flow.indexOf('!employerApiReady')<flow.indexOf('href={saved.url}'));

 assert.ok(policy.includes("sessionStorage.setItem(KEY"));
 assert.ok(policy.includes("Date.now()-x.at>30*60*1000"));
 assert.ok(policy.includes("u.protocol==='https:'"));
 assert.ok(policy.includes("!u.username&&!u.password"));
});

test('company photos stay in the same grid with captions but have no source clickout',()=>{
 assert.ok(domestic.includes('className="domestic-photo-display"'));
 assert.ok(domestic.includes('className="domestic-editorial-photo-grid"'));
 assert.ok(domestic.includes('<figcaption>{photo.label}'));
 assert.ok(domestic.includes('media?.photos?.[index]?.path'));
 assert.ok(!domestic.includes("<a href={(photo.source==='user_submission'"));
 assert.ok(!domestic.includes('打开图片</span>'));
 assert.ok(domesticCss.includes('.domestic-official-photo>.domestic-photo-display{'));
 assert.ok(!domesticCss.includes('.domestic-official-photo>a{'));
 assert.ok(foreignPhotos.includes('<CreditedPhoto photo={photo} lang={lang}/>'));
 assert.ok(foreignPhotos.includes('{photo.author} · {photo.license}'));
 assert.ok(!foreignPhotos.includes('title={lang===\'zh\'?\'查看原始图片与授权信息\''));
 assert.ok(!foreignPhotos.includes('<a href={person.source}'));
 assert.ok(!domestic.includes('<a href={article.photoSourcePage}'));
 assert.ok(!domestic.includes('<a href={article.imageSource}'));
 assert.ok(!domestic.includes('<a href={article.brandImageSource}'));
 assert.ok(domestic.includes('企业图片来源已登记'));
 assert.ok(domesticCss.includes('.domestic-editorial-photos .domestic-photo-display img{pointer-events:none}'));

});

test('domestic marketplace experiment excluded and original 100 overseas records intact',()=>{
 const home=src('pages/HomePage.tsx');
 const market=src('components/UnifiedJobMarket.tsx');
 const service=src('services/liveRecruitment.ts');
 assert.ok(home.includes('企业发现 · 200 家国内企业'));
 assert.ok(market.includes('浏览全部 200 家企业档案'));
 assert.ok(service.includes("VITE_HHBA_OVERSEAS_CURATED_100==='1'"));
 assert.ok(service.includes('(!OVERSEAS_CURATED_100||job.domestic)'));
 const old100=JSON.parse(readFileSync(new URL('../public/curated/v1/jobs.json',import.meta.url),'utf8'));
 assert.equal(old100.jobs.length,100);
 assert.equal(new Set(old100.jobs.map(x=>x.company)).size,10);
});
