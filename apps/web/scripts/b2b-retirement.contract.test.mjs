import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('single C-end login remains and no recruiter admin or B2B page is mounted',()=>{
 const main=read('main.tsx');
 const shell=read('components/Shell.tsx');
 const notFound=read('pages/SiteNotFoundPage.tsx');
 for(const name of [
   'EmployerWorkspacePage','EmployerPage','AdminRecruitmentPage','EmployerReviewPage',
   'EmployerGrowthHubPage','EmployerPublicJobsPage','EmployerPublicJobDetail',
   'AdminEmployerScoringPage','RecruiterWelcomePage','SubmitReviewPage'
 ]){
   assert.ok(!main.includes('return <'+name),name+' remains routed');
   assert.ok(!main.includes('const '+name+'=lazy'),name+' is bundled');
 }
 assert.ok(main.includes("route==='/auth')return <PhoneAuthPage"));
 assert.match(main,/Removed routes are indistinguishable/);
 assert.match(main,/return <SiteNotFoundPage user=\{user\}\/>/);
 assert.doesNotMatch(main,/if\(route==='\/recruiter\/login'/);
 assert.doesNotMatch(main,/if\(route==='\/employer\/hub'/);
 assert.doesNotMatch(shell,/to="\/employer\/|to="\/recruiter\//);
 assert.doesNotMatch(shell,/企业入驻|企业工作台|招聘方身份|企业招聘与治理导航/);
 assert.match(notFound,/页面不存在/);
 assert.doesNotMatch(notFound,/企业招聘|停止提供|业务已停止/);
 assert.equal(existsSync(new URL('../src/pages/RetiredEnterprisePage.tsx',import.meta.url)),false);
 assert.equal(existsSync(new URL('../src/pages/AuthChoicePage.tsx',import.meta.url)),false);
});
test('enterprise recruiting API calls fail closed while C-end login is preserved',()=>{
 const api=read('services/api.ts');
 assert.match(api,/legacyEnterpriseRecruitmentRetired = true/);
 assert.match(api,/retiredBusinessEndpoint\(path\)\|\|retiredRecruiterSession\(path,init\.body\)/);
 assert.match(api,/throw new ApiError\(410/);
 for(const endpoint of ['/organizations','/recruiter','/public/employer-postings','/admin/verification',
   '/admin/employer-postings','/me/employer-applications','/admin/recruitment-responsibilities']){
   assert.ok(api.includes("'"+endpoint+"'"),endpoint);
 }
 assert.match(api,/sendPhoneCode:/);
 assert.match(api,/phoneSession:/);
 assert.match(api,/\/auth\/me/);
 const real=read('services/realAuth.ts');
 assert.match(real,/REAL_AUTH_TOKEN_KEY/);
});
test('official employer sources are still C-end resources, not recruitment clients',()=>{
 const home=read('pages/HomePage.tsx');
 const market=read('components/UnifiedJobMarket.tsx');
 const shell=read('components/Shell.tsx');
 for(const label of ['求职与机会','劳动权益'])assert.ok(home.includes(label));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(!shell.includes("['企业招聘导航']"));
 assert.ok(shell.includes('to="/candidate/jobs"'));
 assert.ok(market.includes('to="/companies"'));
 assert.doesNotMatch(market,/to="\/candidate\/employer-jobs"/);
 const search=read('services/siteSearchIndex.ts');
 assert.doesNotMatch(search,/path:'\/employer\//);
 assert.doesNotMatch(search,/title:'企业服务与治理'/);
 assert.match(search,/path:'\/companies\/discover'/);
 assert.match(search,/path:'\/companies\/library'/);
 const work=read('pages/WorkspacePage.tsx');
 assert.doesNotMatch(work,/to="\/employer"/);
 assert.match(work,/to="\/candidate\/account\/rights"/);
});

test('legacy B2B paths respond with genuine Pages Functions HTTP 404',()=>{
 const paths=[
  '../functions/recruiter/index.js','../functions/recruiter/[[path]].js',
  '../functions/employer/index.js','../functions/employer/[[path]].js',
  '../functions/admin/[[path]].js','../functions/candidate/employer-jobs/index.js',
  '../functions/candidate/employer-jobs/[[path]].js','../functions/candidate/my-applications.js'
 ];
 for(const path of paths){
  const code=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(code,/status:404/,path);
  assert.doesNotMatch(code,/企业招聘业务已停止提供|RetiredEnterprisePage/,path);
 }
});
