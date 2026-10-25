import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('public profile and two-person review appear without changing recruitment routes',()=>{
 const main=read('src/main.tsx');
 const hub=read('src/pages/EmployerGrowthHubPage.tsx');
 const score=read('src/pages/EmployerScoringPage.tsx');
 for(const route of ['/employer/verified-profile','/admin/employer-publication']){
  assert.ok(main.includes("route==='"+route+"'"),route);
  assert.ok(main.includes("route==='"+route+"/'"),route+' deep link');
 }
 assert.ok(hub.includes('to="/employer/verified-profile"'));
 assert.ok(score.includes('to="/admin/employer-publication"'));
 for(const component of ['EmployerWorkspacePage','EmployerEvidencePage','EmployeeFeedbackPage','EmployerAppealsPage','EmployerImprovementsPage'])
  assert.ok(main.includes(component),component);
});
test('publication requires its own independently enabled backend',()=>{
 const api=read('src/services/api.ts');
 const page=read('src/pages/EmployerVerifiedProfilePage.tsx');
 assert.match(api,/publicationApiReady = employerApiReady && import\.meta\.env\.VITE_HHBA_PUBLICATION_API_ENABLED==='1'/);
 assert.match(page,/const enabled=publicationApiReady&&user\?\.role==='admin'/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!selected\|\|reason\.trim\(\)\.length<25\}/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!isUUID\(revokeId\)/);
 assert.ok(page.includes('正式评分发布服务尚未开放'));
 assert.ok(page.includes('真实评分发布与撤销尚未开放'));
});
test('public profile contains no imaginary scores, orders or leaked employee data',()=>{
 const page=read('src/pages/EmployerVerifiedProfilePage.tsx');
 for(const text of ['企业信誉值','员工善待值','待评估','经核验的实际改善','版本追溯','帮扶'])
  assert.ok(page.includes(text),text);
 assert.ok(!/\b88\b|\b92\b/.test(page));
 assert.ok(!page.includes('恭喜您已获得订单'));
 assert.ok(!page.includes('employee_id'));
});
