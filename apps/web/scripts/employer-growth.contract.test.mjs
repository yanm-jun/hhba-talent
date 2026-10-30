import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('existing HHBA homepage keeps original candidate card and company discovery',()=>{
 const home=read('src/pages/HomePage.tsx');
 assert.ok(home.includes("kind==='candidate'?'/candidate/register':'/employer/start'"));
 assert.match(home,/UnifiedJobMarket compact/);
 assert.match(home,/HomeCompanyMarquee/);
 assert.match(home,/企业发现 · 200 家国内企业/);
});
test('employer entry, four-step guide, recruit hub, growth, aid, public views are connected',()=>{
 const main=read('src/main.tsx'), hub=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const path of ['/employer/start','/employer/onboarding-preview','/employer/hub','/employer/growth','/employer/aid','/employer/public']) { assert.ok(main.includes(path),path); assert.ok(main.includes(path+"/"),path+' trailing slash'); }
 for(const text of ['企业身份','企业信息','经办人身份','核对规则','招聘管理','企业信誉值','员工善待值','HHBA 企业发展帮扶','求职者','员工','待评估']) assert.ok(hub.includes(text),text);
});
test('existing real recruiting and certification APIs remain the only source for recruitment actions',()=>{
 const main=read('src/main.tsx'),hub=read('src/pages/EmployerGrowthHubPage.tsx');
 assert.ok(main.includes("if(route==='/employer/workspace'||route==='/employer/workspace/')return <EmployerWorkspacePage user={user}/>"));
 assert.ok(main.includes("if(route==='/recruiter/onboarding')return <RecruiterWelcomePage user={user}/>"));
 assert.match(hub,/api\.organizations\(\)/);
 assert.match(hub,/api\.postings\(oid\)/);
});
test('no fabricated reputation or employee care score and no false aid submission',()=>{
 const hub=read('src/pages/EmployerGrowthHubPage.tsx');
 assert.ok(!/\b88\b|\b92\b/.test(hub));
 assert.match(hub,/尚未提交或保存到 HHBA/);
 assert.match(hub,/尚未开放收集/);
 assert.match(hub,/静态预览模式/);
 assert.match(hub,/实际企业名称和认证状态将取自核验后的组织数据/);
});
