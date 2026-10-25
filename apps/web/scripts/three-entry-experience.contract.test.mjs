import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const shell=read('components/Shell.tsx'),home=read('pages/HomePage.tsx');
const routes=read('main.tsx'),employer=read('pages/EmployerGrowthHubPage.tsx');
const demo=read('pages/DemoAuthPage.tsx'),auth=read('pages/AuthPage.tsx');
const style=read('styles/experience-navigation.css');
const apply=read('services/liveRecruitment.ts');
const register=data=>data.replace(/\s+/g,' ');

test('first visit to home is public and has a real two-intent landing choice',()=>{
 assert.ok(shell.includes("if(route==='/')return 'public'"));
 assert.match(home,/title="我要应聘"/);
 assert.match(home,/title="我要招人"/);
 assert.ok(home.includes("kind==='candidate'?'/candidate/register':'/employer/start'"));
 assert.ok(home.includes("to=\"/candidate/jobs\""));
 assert.ok(home.includes('先浏览招聘市场'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(home.includes('<HomeCompanyMarquee/>'));
 assert.ok(!home.includes("kind === 'candidate' ? '/candidate'"));
 assert.ok(home.includes('企业发现 · 200 家国内企业'));
});

test('candidate has separate register-first navigation and no mandatory login for public listings',()=>{
 for(const text of ['求职者端','求职者服务导航','招聘市场','企业发现','我的收藏','CandidateAccountDropdown','登录 / 注册','我要招人'])
   assert.ok(shell.includes(text),'candidate navigation lost: '+text);
 assert.ok(shell.includes("to=\"/candidate/register\""));
 assert.ok(shell.includes("to=\"/candidate/jobs\""));
 assert.ok(shell.includes("to=\"/companies/discover\""));
 assert.ok(shell.includes("to=\"/employer/start\""));
 assert.ok(shell.includes('candidateSignedIn?<><CandidateAccountDropdown/>'));
 assert.ok(routes.includes("route==='/candidate/login'||route==='/candidate/register'"));
 assert.ok(demo.includes('创建你的演示账户'));
 assert.ok(demo.includes('公开前端演示，不是真正注册或登录'));
 assert.ok(auth.includes("accountType = 'candidate'"));
});

test('enterprise public intro comes before business registration; employer uses its own navigation',()=>{
 for(const text of ['企业端','企业招聘与治理导航','企业服务','企业工作台','职位与人才','企业治理','发展帮扶','返回求职端','企业入驻'])
   assert.ok(shell.includes(text),'enterprise navigation lost: '+text);
 assert.ok(shell.includes("route.startsWith('/employer')||route.startsWith('/recruiter')"));
 assert.ok(shell.includes("to=\"/employer/start\""));
 assert.ok(shell.includes("to=\"/employer/growth\""));
 assert.ok(shell.includes("to=\"/employer/aid\""));
 assert.ok(shell.includes("to=\"/candidate/jobs\""));
 assert.ok(employer.includes('让招聘更透明，让企业更值得信赖。'));
 for(const heading of ['企业入驻与认证','招聘与人才管理','企业信誉与治理','企业发展帮扶'])
   assert.ok(employer.includes(heading),'enterprise intro card absent: '+heading);
 assert.ok(employer.includes('先了解平台服务，再决定是否入驻'));
 assert.ok(employer.includes('to={entryRoute(user)}'));
 assert.ok(employer.includes('to="/employer/hub"'));
 assert.ok(routes.includes("route==='/employer/start'"));
 assert.ok(routes.includes("route==='/employer/onboarding-preview'"));
});

test('real account permissions are not conflated with applicant demo sessions',()=>{
 assert.ok(shell.includes("user?.account_types?.includes('candidate')"));
 assert.ok(shell.includes("user?.account_types?.includes('recruiter')"));
 assert.ok(shell.includes('candidateSignedIn=hasCandidate||(demoModeEnabled&&!!demo)'));
 assert.ok(shell.includes('recruiterSignedIn=hasRecruiter'));
 assert.ok(!shell.includes("to=\"/admin/employer-evidence\""));
 assert.ok(!shell.includes("to=\"/admin/employer-scoring\""));
 assert.ok(employer.includes('企业招聘账户不等于 HHBA 内部审核账户'));
 assert.ok(employer.includes('不收集企业隐私资料'));
});

test('all existing domestic, curated overseas, employer and static resources remain present',()=>{
 assert.ok(apply.includes("VITE_HHBA_OVERSEAS_CURATED_100==='1'"));
 assert.ok(apply.includes("(!OVERSEAS_CURATED_100||job.domestic)"));
 for(const route of ['Company200PreviewPage','EmployerStartPage','EmployerOnboardingPreviewPage',
   'AdminEmployerEvidencePage','AdminEmployerPublicationPage','AdminAppealsReviewPage','EmployerAidApplicationPage',
   'LegalAidLandingPage','UnifiedJobMarket','JoinUsPage','VisionPage']){
   assert.ok(routes.includes(route),'removed established route '+route);
 }
 assert.ok(home.includes('企业发现 · 200 家国内企业'));
 assert.ok(shell.includes("'app-shell hhba-experience-'+experience"));
 assert.ok(shell.includes("experience==='candidate'"));
 assert.ok(shell.includes("experience==='employer'"));
 for(const token of ['hhba-experience-public','hhba-public-entry-grid','hhba-employer-services']){
   assert.ok(register(shell+style).includes(token),'missing responsive navigation style '+token);
 }
 assert.ok(style.includes('@media(max-width:680px)'));
});
