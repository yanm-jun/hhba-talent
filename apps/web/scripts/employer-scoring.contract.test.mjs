import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('scoring transparency, admin reviewer and existing employer market routes',()=>{
 const main=read('src/main.tsx'),growth=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const route of ['/employer/scoring','/admin/employer-scoring']) {
   assert.ok(main.includes("route==='"+route+"'"),route);
   assert.ok(main.includes("route==='"+route+"/'"),route+' deep-link slash');
 }
 assert.match(growth,/to="\/employer\/scoring"/);
 assert.match(growth,/to="\/employer\/evidence"/);
 assert.match(main,/EmployerWorkspacePage/);
 assert.match(main,/EmployeeFeedbackPage/);
});
test('private scoring explicitly requires real API and separate enablement switch',()=>{
 const api=read('src/services/api.ts'),page=read('src/pages/EmployerScoringPage.tsx');
 assert.match(api,/VITE_HHBA_SCORING_API_ENABLED/);
 assert.match(api,/scoringApiReady = employerApiReady &&/);
 assert.match(page,/const enabled=scoringApiReady&&user\?\.role==='admin'/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!orgId\|\|!proofId\}/);
 assert.match(page,/disabled=\{!enabled\|\|busy\|\|!orgId\}/);
 assert.match(page,/尚未公开/);
});
test('no demo company score, zero as missing data, or automatic aid eligibility',()=>{
 const page=read('src/pages/EmployerScoringPage.tsx');
 for(const line of ['待评估','公开审批','申诉','上一完整季度','材料','重算']) assert.ok(page.includes(line),line);
 assert.ok(!/\b88\b|\b92\b/.test(page));
 assert.ok(!page.includes('恭喜您已获得订单'));
 assert.match(page,/此操作不会公开分数/);
});
