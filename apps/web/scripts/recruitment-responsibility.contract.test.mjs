import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const server=path=>readFileSync(new URL('../functions/'+path,import.meta.url),'utf8');

// This is a current C-end regression contract, not a legacy enterprise
// onboarding smoke test. The enterprise-facing business was retired and
// must not quietly reappear just to make an old Pages workflow pass.
test('enterprise recruitment responsibility remains retired, with no fake employer workflow',()=>{
 const api=source('services/api.ts');
 assert.match(api,/legacyEnterpriseRecruitmentRetired\s*=\s*true/);
 for(const endpoint of ['/recruiter','/me/employer-applications','/admin/recruitment-responsibilities']){
  assert.ok(api.includes("'"+endpoint+"'"),'retired business endpoint must fail closed: '+endpoint);
 }
 assert.match(api,/retiredBusinessEndpoint\(path\)\|\|retiredRecruiterSession\(path,init\.body\)/);
 assert.match(api,/throw new ApiError\(410/);
 const app=source('main.tsx'),shell=source('components/Shell.tsx');
 assert.doesNotMatch(app,/if\(route==='\/recruiter\/login'/);
 assert.doesNotMatch(shell,/to="\/employer\/|to="\/recruiter\//);
});
test('recruitment response status does not invent an employer response or deadline',()=>{
 const due=source('components/RecruitmentDue.tsx');
 assert.match(due,/if\(!record\)return/,'unverified records must not look completed');
 assert.match(due,/该申请尚无经过服务器核实的招聘责任记录/);
 assert.match(due,/Date\.parse\(record\.response_due_at\)/);
 assert.match(due,/Number\.isFinite\(timestamp\)/);
 assert.match(due,/record\.state==='responded'/);
 assert.match(due,/record\.state==='overdue'/);
 assert.match(due,/record\.state==='withdrawn'/);
 assert.match(due,/不代表已完成录用/);
});
test('existing applicant match and authorized admin operational metrics remain present',()=>{
 const main=source('main.tsx'),match=source('pages/CandidateMatchPage.tsx');
 const admin=server('api/admin/metrics.js'),dashboard=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 assert.match(main,/route==='\/candidate\/match'/);
 assert.match(match,/taskOpen\.current/);
 assert.match(match,/controller\.current/);
 assert.match(match,/taskFailed=/);
 assert.match(admin,/await verifyAdmin\(request,env\)/);
 assert.match(admin,/v4Operations:await readV4PhaseOps\(db,since,until\)/);
 assert.match(dashboard,/s\?\.quality==='collected'/);
 assert.match(dashboard,/暂无|还没有采集记录|数据暂不可用/);
});
