import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('enterprise evidence and admin reviewer routes are linked without disturbing recruiting',()=>{
 const main=read('src/main.tsx'),growth=read('src/pages/EmployerGrowthHubPage.tsx');
 assert.match(main,/route==='\/employer\/evidence'/);
 assert.match(main,/route==='\/admin\/employer-evidence'/);
 assert.match(main,/EmployerEvidencePage/);
 assert.match(main,/AdminEmployerEvidencePage/);
 assert.match(growth,/to="\/employer\/evidence"/);
 assert.match(main,/EmployerWorkspacePage/);
});
test('evidence upload is explicitly gated on independently connected authenticated API',()=>{
 const api=read('src/services/api.ts'),page=read('src/pages/EmployerEvidencePage.tsx');
 assert.match(api,/VITE_HHBA_EVIDENCE_API_ENABLED/);
 assert.match(api,/evidenceApiReady = employerApiReady &&/);
 assert.match(api,/submitEmployerEvidence/);
 assert.match(page,/const allowed=evidenceApiReady&&!!user&&org\?\.status==='approved'/);
 assert.match(page,/disabled=\{!allowed\|\|busy\}/);
 assert.match(page,/本页面不接受文件上传/);
});
test('privacy and audit guardrails are visible and scores remain unverified',()=>{
 const page=read('src/pages/EmployerEvidencePage.tsx');
 const hub=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const t of ['员工个人工资表','不要上传','只改变材料核验状态','企业认证','12—1200','独立审核人员'])
  assert.ok(page.includes(t),t);
 assert.ok(hub.includes('待评估'));
 assert.ok(!/\b88\b|\b92\b/.test(page));
});
