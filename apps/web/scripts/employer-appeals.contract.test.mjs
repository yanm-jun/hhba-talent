import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all three appeal routes are connected with old recruiting and scoring left intact',()=>{
 const main=read('src/main.tsx'),growth=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const route of ['/employer/appeals','/employee/privacy-concerns','/admin/employer-appeals']){
  assert.ok(main.includes("route==='"+route+"'"),route);
  assert.ok(main.includes("route==='"+route+"/'"),route+' deep link');
 }
 assert.ok(growth.includes('to="/employer/appeals"'));
 for(const component of ['EmployerWorkspacePage','EmployerScoringPage','EmployeeFeedbackPage']) assert.ok(main.includes(component));
});
test('appeal writes require independent authenticated API and no fake cases',()=>{
 const api=read('src/services/api.ts'),page=read('src/pages/EmployerAppealsPage.tsx');
 assert.match(api,/appealsApiReady = employerApiReady && import\.meta\.env\.VITE_HHBA_APPEALS_API_ENABLED==='1'/);
 assert.match(page,/disabled=\{!enabled\|\|busy\}/);
 assert.match(page,/待安全申诉服务接入/);
 assert.match(page,/待可信员工验证接入/);
 assert.match(page,/待安全审核服务接入/);
 assert.match(page,/不能生成虚构案件/);
});
test('employee case intake is strictly structured without person-specific content',()=>{
 const page=read('src/pages/EmployerAppealsPage.tsx');
 for(const issue of ['identity_risk','retaliation_risk','eligibility_error','consent_problem']) assert.ok(page.includes(issue));
 assert.ok(page.includes('不允许填写姓名、岗位、部门、时间和自由文本'));
 assert.ok(!page.includes('uploadEmployeeFile'));
 assert.ok(page.includes('企业无法查看该案件或你的账户身份'));
});
test('public score remains pending and appeals require independent reviewer',()=>{
 const api=read('src/services/api.ts');
 const scoring=read('src/pages/EmployerScoringPage.tsx');
 assert.match(scoring,/待评估/);
 assert.match(api,/adminAppealsDecision/);
 assert.match(scoring,/to="\/employer\/appeals"/);
 assert.match(scoring,/to="\/admin\/employer-appeals"/);
});
