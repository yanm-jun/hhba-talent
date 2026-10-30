import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('feedback route is connected to public employee view',()=>{
 const main=source('src/main.tsx'),publicPage=source('src/pages/EmployerGrowthHubPage.tsx');
 assert.match(main,/if\(route==='\/employee\/feedback'\|\|route==='\/employee\/feedback\/'\)/);
 assert.match(publicPage,/to=\{employeeFeedbackHref\}/);
 assert.match(main,/EmployerEvidencePage/);
 assert.match(main,/EmployerWorkspacePage/);
});
test('employee feedback is independently gated and never silently submitted',()=>{
 const api=source('src/services/api.ts'),page=source('src/pages/EmployeeFeedbackPage.tsx');
 assert.match(api,/VITE_HHBA_EMPLOYEE_FEEDBACK_API_ENABLED/);
 assert.match(api,/employeeFeedbackApiReady = employerApiReady &&/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!!ticket\|\|submitted\}/);
 assert.match(page,/disabled=\{!enabled\|\|!ticket\|\|!consent\|\|!questions\.every/);
 assert.match(page,/真实反馈服务尚未开放/);
 assert.match(page,/不会把原始个人评分或评价人身份提供给企业/);
});
test('all five questions and consent/disclosure have no free text field',()=>{
 const page=source('src/pages/EmployeeFeedbackPage.tsx');
 for(const dimension of ['pay','insurance','rest','respect','development'])
  assert.ok(page.includes("key:'"+dimension+"'"),dimension);
 assert.ok(!page.includes('<textarea'));
 for(const text of ['至少 10 份反馈','季度结束','绝对匿名','员工关系独立核验','自愿'])
  assert.ok(page.includes(text),text);
});
