import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('existing home and three role routes preserved',()=>{
 const home=read('src/pages/HomePage.tsx');
 const main=read('src/main.tsx');
 assert.match(home,/HomeOpenLetter/);
 assert.match(home,/HomePeopleBanner/);
 for(const route of ['/employer/workspace','/candidate/my-applications','/admin/recruitment']) assert.ok(main.includes(route),route);
});
test('responsibilities are separately guarded and never calculated from fake client timestamps',()=>{
 const api=read('src/services/api.ts');
 for(const key of ['recruitmentResponsibilityApiReady','VITE_HHBA_RECRUITMENT_RESPONSIBILITY_API_ENABLED','employerRecruitmentResponsibilities','myRecruitmentResponsibilities','adminRecruitmentResponsibilities','updateEmployerApplicationStatus'])assert.ok(api.includes(key),key);
 assert.match(api,/recruitmentResponsibilityApiReady = employerApiReady &&/);
 const due=read('src/components/RecruitmentDue.tsx');
 assert.match(due,/if\(!record\)/);
 assert.match(due,/record.response_due_at/);
 assert.match(due,/Intl.DateTimeFormat/);
 assert.doesNotMatch(due,/Date\.now\(\)\s*\+/);
});
test('existing employer applicants tab adds real responsibility but keeps status flow',()=>{
 const panel=read('src/components/EmployerApplicantPanel.tsx');
 assert.match(panel,/employerJobApplications/);
 assert.match(panel,/updateEmployerApplicationStatus/);
 assert.match(panel,/employerRecruitmentResponsibilities/);
 assert.match(panel,/开始审阅（不结束回应责任）/);
 assert.match(panel,/RecruitmentDue/);
 assert.match(panel,/slaLoaded/);
 assert.match(panel,/正在读取服务端履约记录/);
});
test('candidate withdrawal and admin review unaffected by new modules',()=>{
 const c=read('src/pages/MyEmployerApplicationsPage.tsx');
 const a=read('src/pages/AdminRecruitmentPage.tsx');
 assert.match(c,/withdrawEmployerApplication/);
 assert.match(c,/myRecruitmentResponsibilities/);
 assert.match(a,/adminVerificationQueue/);
 assert.match(a,/adminPendingPostings/);
 assert.match(a,/adminRecruitmentResponsibilities/);
 assert.match(a,/招聘履约管理/);
});
test('public existing unified admin preview shows unknown instead of fabricated metrics',()=>{
 const js=read('public/preview-admin/unified-workbench.js');
 const json=JSON.parse(read('public/preview-admin/data/workspace.json'));
 assert.match(js,/response:'招聘履约管理'/);
 const item=json.modules.find(x=>x.key==='response');
 assert.ok(item);assert.equal(item.state,'not_connected');
 assert.equal(item.pending,null);assert.equal(item.total,null);
 assert.equal(item.reviewAllowed,false);
});
