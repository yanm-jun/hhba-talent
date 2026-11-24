import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const personal=read('../src/pages/PersonalCenterPage.tsx');
const routes=read('../src/main.tsx');
const dropdown=read('../src/components/CandidateAccountDropdown.tsx');
const css=read('../src/styles/career-refresh.css');
test('a single dashboard serves all candidate accounts regardless of employment status',()=>{
 assert.doesNotMatch(personal,/careerStage|hhba:career-stage:|正在求职.*已经入职/);
 assert.match(personal,/current==='overview'/);
 assert.match(personal,/个人账户/);
 assert.match(personal,/我的工作台/);
 assert.doesNotMatch(personal,/hhba-workbench-opportunity|发现适合自己的下一份工作/);
 assert.match(personal,/hhba-workbench-card-grid/);
 assert.doesNotMatch(personal,/hhba-workbench-rights|hhba-workbench-overview/);
 assert.match(personal,/label:'智能岗位匹配'/);
});
test('sidebar groups preserve existing services and connect new service information',()=>{
 const sidebar=personal.slice(personal.indexOf('const navGroups='),personal.indexOf('function matchDate'));
 const cards=personal.slice(personal.indexOf('const workspaceCards='),personal.indexOf('const sectionTitle='));
 const links=source=>[...source.matchAll(/\{label:'([^']+)',path:'([^']+)'/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(links(sidebar).map(x=>x[0]),['劳动权益知识','个人资料','求职偏好','账户与隐私']);
 assert.deepEqual(links(cards).map(x=>x[0]),['智能岗位匹配','我的简历','我的收藏','历史查找','职业成长档案']);
 const destinations=[...links(sidebar),...links(cards)].map(x=>x[1]);
 assert.equal(new Set(destinations).size,destinations.length);
 assert.doesNotMatch(sidebar,/一键网申|会员与权益服务/);
 assert.equal((cards.match(/primary:true/g)||[]).length,1);
 assert.match(routes,/privacy\|apply-assistant\|career/);
 assert.match(personal,/hasVisited\('resume'\).*<PrivateResumeVault active=\{current==='resume'\}\/>/);
 assert.match(personal,/hasVisited\('applications'\).*<CandidateMatchHistory active=\{current==='applications'\}\/>/);
 assert.match(personal,/hasVisited\('apply-assistant'\).*<ApplyAssistantProduct/);
 assert.match(dropdown,/candidate\/account\/career/);
});
test('overview displays actual account data and does not advertise unlaunched membership',()=>{
 assert.match(personal,/latestMatch\.created_at/);
 assert.match(personal,/savedCount/);
 assert.match(personal,/resumeCount/);
 assert.match(personal,/劳动权益知识/);
 assert.doesNotMatch(personal,/会员与权益服务|服务筹备中|了解会员资格/);
 assert.doesNotMatch(personal,/¥24\.90|hhba-career-membership|规划会员月费/);
 assert.match(personal,/职业成长档案/);
 assert.match(personal,/职业成长档案/);
});
test('growth archive reuses real profile and private resumes rather than inventing work history',()=>{
 assert.match(personal,/current==='career'/);
 assert.match(personal,/account\?\.headline/);
 assert.match(personal,/简历状态待确认/);
 assert.match(personal,/独立的任职经历、工作成果和阶段性更新记录尚在规划中/);
});
test('tight right column, clear left groups and responsive mobile nav',()=>{
 for(const selector of ['.hhba-workbench-heading','.hhba-workbench-card-grid','.hhba-account-nav-group','.hhba-workbench-card-primary','.hhba-workbench-card:focus-visible'])
  assert.ok(css.includes(selector),selector);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/focus-visible/);
});


test('all candidate sidebar destinations render inside one persistent workspace shell',()=>{
 assert.ok(routes.includes('isCandidateWorkspaceRoute'));
 for(const route of ["route==='/candidate/account/match'","route==='/candidate/account/rights'","route==='/candidate/account/legal-aid'","route==='/candidate/account/legal-aid/intervention'"]) assert.ok(routes.includes(route),route);
 for(const component of ['CandidateMatchPage','WorkplaceRightsPage','LegalAidLandingPage','LegalAidInterventionPage']) assert.ok(routes.includes(component+' user={user} embedded'),component+' must be embedded');
 assert.match(routes,/LegalAidTopicPage user=\{user\} slug=\{[^\n]+ embedded\/>/);
 assert.ok(personal.includes('externalSections&&Object.entries(externalSections)'));
 assert.ok(personal.includes("hasVisited('resume')"));
 assert.ok(personal.includes("hasVisited('apply-assistant')"));
 assert.ok(personal.includes('navActive(item.path)'));
});
test('embedded service modules omit duplicate site shells and retain hidden module state',()=>{
 const shell=read('../src/components/Shell.tsx');
 assert.ok(shell.includes('embedded?: boolean'));
 assert.ok(shell.includes('if(embedded)return <>{children}</>'));
 for(const path of ['../src/pages/CandidateMatchPage.tsx','../src/pages/WorkplaceRightsPage.tsx','../src/pages/LegalAidLandingPage.tsx','../src/pages/LegalAidInterventionPage.tsx','../src/pages/LegalAidTopicPage.tsx']){
  const source=read(path);assert.ok(source.includes('embedded=false'));assert.ok(source.includes('embedded={embedded}'));
 }
 assert.ok(css.includes('position:sticky'));
 for(const [path,signature] of [
  ['../src/components/PrivateResumeVault.tsx','active?:boolean'],
  ['../src/components/CandidateMatchHistory.tsx','active?:boolean'],
  ['../src/components/ApplyAssistantProduct.tsx','active?:boolean']
 ]){
  const source=read(path);assert.ok(source.includes(signature),path+' refreshes when shown again');
 }
 assert.ok(personal.includes("active={current==='resume'}"));
 assert.ok(personal.includes("active={current==='applications'}"));
 assert.ok(personal.includes("active={current==='apply-assistant'}"));
 assert.ok(css.includes('.hhba-account-external-stage .hhba-ai-page'));
});
