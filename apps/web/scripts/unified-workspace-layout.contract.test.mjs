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
 assert.match(personal,/职业概览与最近记录/);
 assert.doesNotMatch(personal,/hhba-workbench-opportunity|发现适合自己的下一份工作/);
 assert.match(personal,/hhba-workbench-overview/);
 assert.match(personal,/hhba-workbench-rights/);
 assert.match(personal,/label:'智能岗位匹配'/);
});
test('sidebar groups preserve existing services and connect new service information',()=>{
 for(const label of ['求职服务','职业与权益','账户管理','智能岗位匹配','我的简历','我的收藏','匹配历史','一键网申','职业成长档案','会员与权益服务','劳动权益知识','个人资料','求职偏好','账户与隐私'])
  assert.ok(personal.includes(label),label+' must be visible');
 assert.match(routes,/privacy\|apply-assistant\|career/);
 assert.match(personal,/current==='resume'&&<PrivateResumeVault\/>/);
 assert.match(personal,/current==='applications'&&<CandidateMatchHistory\/>/);
 assert.match(personal,/current==='apply-assistant'&&<ApplyAssistantProduct/);
 assert.match(dropdown,/candidate\/account\/career/);
});
test('overview displays actual account data and does not advertise unlaunched membership',()=>{
 assert.match(personal,/latestMatch\.created_at/);
 assert.match(personal,/savedCount/);
 assert.match(personal,/resumeCount/);
 assert.match(personal,/服务筹备中/);
 assert.doesNotMatch(personal,/¥24\.90|hhba-career-membership|规划会员月费/);
 assert.match(personal,/职业成长档案/);
 assert.match(personal,/职业经历/);
});
test('growth archive reuses real profile and private resumes rather than inventing work history',()=>{
 assert.match(personal,/current==='career'/);
 assert.match(personal,/account\?\.headline/);
 assert.match(personal,/简历状态待确认/);
 assert.match(personal,/独立的任职经历、工作成果和阶段性更新记录尚在规划中/);
});
test('tight right column, clear left groups and responsive mobile nav',()=>{
 for(const selector of ['.hhba-workbench-heading','.hhba-workbench-overview','.hhba-account-nav-group','.hhba-workbench-record-list','.hhba-workbench-rights'])
  assert.ok(css.includes(selector),selector);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/focus-visible/);
});


test('all candidate sidebar destinations render inside one persistent workspace shell',()=>{
 assert.match(routes,/isCandidateWorkspaceRoute/);
 for(const route of ["route==='/candidate/match'","route==='/candidate/account/rights'","route==='/candidate/account/legal-aid'","route==='/candidate/account/legal-aid/intervention'"] )assert.ok(routes.includes(route),route);
 for(const component of ['CandidateMatchPage','WorkplaceRightsPage','LegalAidLandingPage','LegalAidInterventionPage','LegalAidTopicPage'])assert.match(routes,new RegExp(component+' user=\\{user\\} embedded'));
 assert.match(personal,/externalSections&&Object\\.entries\\(externalSections\\)/);
 assert.match(personal,/hasVisited\\('resume'\\)/);
 assert.match(personal,/hasVisited\\('apply-assistant'\\)/);
 assert.match(personal,/navActive\\(item\\.path\\)/);
});
test('embedded service modules omit their duplicate site shell and preserve module state when hidden',()=>{
 const shell=read('../src/components/Shell.tsx');
 assert.match(shell,/embedded\\?: boolean/);
 assert.match(shell,/if\\(embedded\\)return <><\\{children\\}<\\/>>/);
 for(const path of ['../src/pages/CandidateMatchPage.tsx','../src/pages/WorkplaceRightsPage.tsx','../src/pages/LegalAidLandingPage.tsx','../src/pages/LegalAidInterventionPage.tsx','../src/pages/LegalAidTopicPage.tsx']){
  const source=read(path);assert.match(source,/embedded=false/);assert.match(source,/embedded=\\{embedded\\}/);
 }
 assert.match(css,/position:sticky/);
 assert.match(css,/hhba-account-external-stage \\.hhba-ai-page/);
});
