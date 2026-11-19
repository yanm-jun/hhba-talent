import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('homepage public API exposes the approved service plan without enabling transactions',()=>{
 const body=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 const api=read('../functions/api/public/homepage.js');
 assert.ok(api.includes('import homepagePublicConfig from'));
 assert.ok(api.includes('purchaseEnabled:false'));
 assert.ok(api.includes('return json({'));
 assert.equal(body.schemaVersion,1);
 assert.equal(body.membership.priceCents,2490);
 assert.equal(body.membership.currency,'CNY');
 assert.equal(body.membership.billingPeriod,'month');
 assert.equal(body.membership.introductoryMonths,6);
 assert.equal(body.membership.maxServiceMonths,36);
 assert.equal(body.membership.purchaseEnabled,false);
 assert.equal(body.membership.caseIntakeEnabled,false);
 assert.ok(body.membership.firstStageServices.some(item=>item.includes('简历')));
 assert.ok(body.membership.rightsStageServices.some(item=>item.includes('资料整理')));
 assert.match(body.membership.serviceNotice,/暂未开放购买/);
});

test('homepage free rights CTA opens the public knowledge index for anonymous visitors',()=>{
 const home=read('../src/components/HomeWorkplacePromise.tsx');
 const routes=read('../src/main.tsx');
 const rights=read('../src/pages/LegalAidLandingPage.tsx');
 assert.match(home,/href:'\/rights\/knowledge'/);
 assert.match(home,/href:'\/rights\/guide'/);
 assert.match(home,/className="hhba-home-resource-card"/);
 assert.doesNotMatch(home,/to="\/membership\/rules"/);
 assert.match(routes,/if\(route==='\/rights\/knowledge'\)return <LegalAidLandingPage user=\{user\}\/>/);
 assert.match(rights,/export function LegalAidLandingPage/);
});
test('all public rights and legal knowledge URLs render independently, while private workspace links remain private',()=>{
 const routes=read('../src/main.tsx');
 const footer=read('../src/components/Shell.tsx');
 const home=read('../src/pages/HomePage.tsx');
 const rights=read('../src/pages/WorkplaceRightsPage.tsx');
 const knowledge=read('../src/pages/LegalAidLandingPage.tsx');
 const article=read('../src/pages/LegalAidTopicPage.tsx');
 const support=read('../src/pages/LegalAidInterventionPage.tsx');
 const personal=read('../src/pages/PersonalCenterPage.tsx');
 const dropdown=read('../src/components/CandidateAccountDropdown.tsx');
 const search=read('../src/services/siteSearchIndex.ts');
 const publicRoute=routes.indexOf("if(route==='/rights')");
 const privateRoute=routes.indexOf('const isCandidateWorkspaceRoute=');
 assert.ok(publicRoute>0 && privateRoute>publicRoute,'public pages must be routed before account pages');
 for(const route of [
   "if(route==='/rights')return <WorkplaceRightsPage user={user}/>",
   "if(route==='/rights/knowledge')return <LegalAidLandingPage user={user}/>",
   "if(route==='/rights/support')return <LegalAidInterventionPage user={user}/>",
   String.raw`if(/^\/rights\/knowledge\/[a-z-]{5,60}$/.test(route))return <LegalAidTopicPage`
 ])assert.ok(routes.includes(route),'public route missing: '+route);
 assert.ok(footer.includes("['会员与权益服务','/rights']"));
 assert.ok(footer.includes("['劳动权益知识','/rights/knowledge']"));
 assert.ok(home.includes("kind==='rights'?'/rights/knowledge'"));
 assert.ok(rights.includes('embedded?"个人工作台":"HHBA 首页"'));
 assert.ok(rights.includes("embedded?'/candidate/account/legal-aid':'/rights/knowledge'"));
 assert.ok(knowledge.includes("embedded?'/candidate/account/legal-aid':'/rights/knowledge'"));
 assert.ok(knowledge.includes("knowledgeHref+\'/\'+topic.slug"),"knowledge cards link to topic details");
 assert.ok(knowledge.includes('to="/rights/guide"'),"guide is reachable from knowledge");



 assert.ok(article.includes("knowledgeHref+'/'+topics[index+1].slug"),'next article should keep the public context');
 assert.ok(support.includes("knowledgeHref+'/'+topic.slug"),'support guidance should point to public article');
 for(const path of ["/candidate/account/rights","/candidate/account/legal-aid","/candidate/account/legal-aid/intervention"]){
   assert.ok(routes.includes("route==='"+path+"'"),'private route missing: '+path);
 }
 assert.ok(personal.includes("path:'/candidate/account/rights'"));
 assert.ok(dropdown.includes("path:'/candidate/account/legal-aid'"));
 for(const path of ["/rights","/rights/knowledge","/rights/support"])assert.ok(search.includes("path:'"+path+"'"));
});
test('public job and company browsing are not marked as private workspaces, and same-label job entries agree',()=>{
 const home=read('../src/pages/HomePage.tsx');
 const shell=read('../src/components/Shell.tsx');
 assert.ok(home.includes("kind==='candidate'?'/candidate/jobs'"));
 assert.ok(shell.includes("['我要应聘','/candidate/jobs']"));
 assert.ok(shell.includes("if(route==='/candidate')return signedIn?'candidate':'public'"));
 assert.ok(shell.includes("return 'public';"));
 assert.ok(home.includes("onClick={()=>navigate('/candidate/match')}"),'AI matching remains accessible separately');
});

test('homepage financial disclosure uses distributable profit, not turnover, and does not invent reports',()=>{
 const body=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 assert.equal(body.distribution.companyPercent,60);
 assert.equal(body.distribution.workerSupportPercent,40);
 assert.equal(body.distribution.companyPercent+body.distribution.workerSupportPercent,100);
 assert.equal(body.distribution.basis,'依法核算后的可分配利润');
 assert.equal(body.distribution.reportStatus,'not_published');
 assert.match(body.distribution.reportNotice,/首期财务公开报告尚未发布/);
});

test('homepage promotes free rights, avoids legacy membership marketing and preserves recruitment modules',()=>{
 const home=read('../src/pages/HomePage.tsx');
 const component=read('../src/components/HomeWorkplacePromise.tsx');
 assert.ok(home.includes('找工作，不止于找到工作。'));
 assert.ok(home.includes('让机会与人才，找到彼此。'));
 for(const entry of ['title="求职与机会"','title="劳动权益"','title="企业招聘导航"'])assert.ok(home.includes(entry));
 assert.ok(home.includes("kind==='rights'?'/rights/knowledge'"));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(home.includes('<HomeCompanyMarquee/>'));
 assert.ok(home.includes('<HomeWorkplacePromise/>'));
 assert.ok(component.includes('劳动权益知识库'));
 assert.ok(component.includes('高性价比职场指南'));
 assert.ok(component.includes('20 个专题'));
 assert.ok(component.includes('200 条原创建议'));
 assert.ok(component.includes('免费开放'));
 assert.ok(component.includes('api/transparency/reports'));
 for(const removed of ['api/public/homepage','¥24.90','membership.','distribution.','60%','40%','连续缴费','会员服务'])
  assert.ok(!component.includes(removed),'outdated homepage claim: '+removed);
 assert.ok(!home.includes('HomeLiveDrawer'));
});
test('homepage keeps the existing background and shows two real resources with a slim pledge',()=>{
 const component=read('../src/components/HomeWorkplacePromise.tsx');
 const css=read('../src/styles/home-workplace-promise.css');
 for(const content of [
   '让职业选择更有依据。','HHBA · CAREER RESOURCES',
   'hhba-home-membership-card hhba-home-resources-panel',
   'hhba-home-resource-grid','hhba-home-resource-card',
   '劳动权益知识库','高性价比职场指南','20 个专题','200 条原创建议',
   "href:'/rights/knowledge'","href:'/rights/guide'",
   'hhba-home-pledge','每月根据实际经营情况',
   '不承诺固定金额或分配比例','to="/transparency"',
   'api/transparency/reports'
 ])assert.ok(component.includes(content),'missing new homepage resource content: '+content);
 for(const legacy of [
  'hhba-home-price','hhba-home-distribution-values','hhba-home-phase-grid',
  '职场权益知识','权益自助指引','to="/membership/rules"','60%','40%'
 ])assert.ok(!component.includes(legacy),'outdated visual / claim: '+legacy);
 assert.match(css,/\.hhba-home-workplace::before/);
 assert.match(css,/\.hhba-home-resource-grid\{display:grid;grid-template-columns:repeat\(2,/);
 assert.match(css,/\.hhba-home-resource-grid\{grid-template-columns:1fr/);
 assert.match(css,/\.hhba-home-pledge\{display:flex/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/:focus-visible/);
});

test('home job footer is one compact row; full marketplace still supports page jump',()=>{
 const market=read('../src/components/UnifiedJobMarket.tsx');
 const pager=read('../src/components/JobResultPagination.tsx');
 const css=read('../src/styles/unified-jobs.css');
 const layout=read('../src/styles/home-workplace-promise.css');
 assert.match(market,/unified-market--home/);
 assert.match(market,/unified-job-footer--home/);
 assert.match(market,/unified-job-footer-info/);
 assert.match(market,/showJump=\{!compact\}/);
 assert.match(market,/查看完整招聘市场/);
 assert.match(pager,/showJump\?:boolean/);
 assert.match(pager,/showJump&&<form className="unified-job-page-jump"/);
 assert.match(css,/\.unified-market--home \.unified-job-footer-info/);
 assert.match(css,/\.unified-market--home \.unified-job-footer \.unified-job-paging/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(layout,/\.hhba-home-workplace::before/);
});
