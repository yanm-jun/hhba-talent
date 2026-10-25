import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('enterprise, public and independent review entry points exist',()=>{
 const main=read('src/main.tsx');
 const hub=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const route of ['/employer/improvements','/employer/improvements/public','/admin/employer-improvements']) {
   assert.ok(main.includes("route==='"+route+"'"),route);
   assert.ok(main.includes("route==='"+route+"/'"),route+' deep link');
 }
 assert.match(hub,/to="\/employer\/improvements"/);
 assert.match(hub,/to="\/employer\/improvements\/public"/);
 for(const component of ['EmployerWorkspacePage','EmployerEvidencePage','EmployeeFeedbackPage','EmployerScoringPage','EmployerAppealsPage'])
  assert.ok(main.includes(component),component);
});
test('sensitive routes are fail-closed unless independently authorized backend enabled',()=>{
 const api=read('src/services/api.ts'),page=read('src/pages/EmployerImprovementsPage.tsx');
 assert.match(api,/improvementsApiReady = employerApiReady && import\.meta\.env\.VITE_HHBA_IMPROVEMENTS_API_ENABLED==='1'/);
 for(const msg of ['真实改善提交尚未开放','真实成长档案尚未接通','真实改善审核暂未开放','暂无可以公开展示的已核验改善事项'])
  assert.ok(page.includes(msg),msg);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!item\}/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!evidence/);
});
test('privacy safe human approval, no invented case or score delta',()=>{
 const page=read('src/pages/EmployerImprovementsPage.tsx');
 for(const msg of ['隐私检查','独立核验','不会直接修改企业分数','不自动代表加分','不允许提交','不要填写员工姓名'])
  assert.ok(page.includes(msg) || (msg==='不允许提交' && page.includes('不会提交')),msg);
 assert.ok(!page.includes('恭喜企业已增长'));
 assert.ok(!page.includes('88分'));
 assert.ok(page.includes('privacy_checked'));
});
