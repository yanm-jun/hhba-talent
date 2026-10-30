import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const dashboard=read('../src/pages/CandidateDashboardPage.tsx');
const app=read('../src/main.tsx');
const upload=read('../src/pages/CandidatePages.tsx');
const market=read('../src/components/UnifiedJobMarket.tsx');
const styles=read('../src/styles/candidate-dashboard.css');

test('"我要应聘" opens a single candidate workspace, not another five-card directory',()=>{
 assert.ok(app.includes("if(route==='/candidate')return <CandidateDashboardPage user={user}/>"));
 assert.ok(dashboard.includes('找到适合你的工作'));
 assert.ok(dashboard.includes('我的求职档案'));
 assert.ok(dashboard.includes('我的申请'));
 assert.ok(dashboard.includes('职位匹配'));
 assert.ok(dashboard.includes('适合探索的职位'));
 assert.ok(!dashboard.includes('企业审核直发岗位'));
 assert.ok(!dashboard.includes('平台统一提供 DeepSeek'));
});
test('candidate search submits directly to existing verified market and pre-populates its search',()=>{
 assert.ok(dashboard.includes("navigate('/candidate/jobs'+(term?'?q='+encodeURIComponent(term):''))"));
 assert.ok(market.includes("new URLSearchParams(location.search).get('q')"));
 assert.ok(market.includes("readMarketState(compact)?.draft??initialJobQuery()"),
   'job market should keep origin-specific query history or read the URL on fresh entry');
});
test('real job previews are read from verified ATS index rather than placeholders',()=>{
 assert.ok(dashboard.includes('listJobs(initialFilters,0,controller.signal)'));
 assert.ok(dashboard.includes("officialStatus(job,data.updated)==='recent'"));
 assert.ok(dashboard.includes("to={'/candidate/jobs/'+encodeURIComponent(job.id)}"));
 assert.ok(dashboard.includes('localizedTitle(job,\'zh\')'));
 assert.ok(!dashboard.includes('真实招聘职位列表'));
});
test('private resume form is on its own route and remains disabled until real account backend exists',()=>{
 assert.ok(app.includes("if(route==='/candidate/resume/new')return <ResumeUploadPage user={user}/>"));
 assert.ok(upload.includes('export function ResumeUploadPage'));
 assert.ok(upload.includes('if(!employerApiReady)return'));
 assert.ok(dashboard.includes("demo?'演示账户':'可体验模拟账户'"), 'the visible mock account must remain labeled as a demo');
 assert.ok(dashboard.includes('账户服务接入后开放'));
});
test('mobile shows two side-by-side compact controls and no duplicated green menu',()=>{
 assert.ok(styles.includes('@media(max-width:600px)'));
 assert.ok(styles.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(styles.includes('.candidate-dashboard-job-list'));
 assert.ok(!dashboard.includes('官方招聘职位列表，支持职位搜索和分类筛选'));
});
