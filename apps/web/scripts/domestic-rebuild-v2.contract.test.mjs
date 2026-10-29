import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=p=>readFileSync(p,'utf8');
const root='src/';
const overseas=JSON.parse(src('public/curated/v1/jobs.json')).jobs;
const china=JSON.parse(src('src/data/domesticSchneiderDetailedDossier20261029.json'));
const kpmg=JSON.parse(src('src/data/domesticKpmgConcreteJobs20261029.json'));
const huayu=JSON.parse(src('src/data/domesticHuayuVisionRoles20261029.json'));
const huaan=JSON.parse(src('src/data/domesticHuaanSecuritiesRoles20261029.json'));
const guangfa=JSON.parse(src('src/data/domesticGuangfaSecuritiesRoles20261029.json'));
const citics=JSON.parse(src('src/data/domesticCiticsSecuritiesRoles20261029.json'));
const citicsProfile=src('src/pages/CiticsSecuritiesCompactProfilePage.tsx');
const guangfaProfile=src('src/pages/GuangfaSecuritiesCompactProfilePage.tsx');
const huaanProfile=src('src/pages/HuaanSecuritiesCompactProfilePage.tsx');
const huayuProfile=src('src/pages/HuayuVisionCompactProfilePage.tsx');
const main=src('src/main.tsx');
const kpmgProfile=src('src/pages/KpmgCompactProfilePage.tsx');
const recruitment=src(root+'services/liveRecruitment.ts');
const ui=src(root+'components/UnifiedJobMarket.tsx');
const branded=src(root+'components/EmployerBrandLogo.tsx');
const index=src(root+'services/domesticRebuildJobs.ts');
const workflowBranch=process.env.HHBA_DOMESTIC_V2_CHECK||'build-agnostic';
assert.equal(overseas.length,100,'Original overseas 100 retained');
assert.equal(new Set(overseas.map(x=>x.id)).size,100);
assert.equal(new Set(overseas.map(x=>x.company)).size,10);
assert(overseas.every(x=>x.editorial?.responsibilities?.length&&x.editorial?.requirements?.length));
assert.equal(china.jobs.length,12,'First approved China company has 12 individually sourced jobs');
assert.equal(new Set(china.jobs.map(x=>x.id)).size,12);
for(const job of china.jobs){
 const u=new URL(job.url);
 assert.equal(u.protocol,'https:');
 assert.equal(u.hostname,'careers.se.com');
 assert.equal(u.pathname,'/jobs/'+job.id);
 assert(job.title&&job.city&&job.summary,'No empty faux vacancy');
}
assert.equal(kpmg.jobs.length,6,'Second approved employer has 6 historical individual KPMG vacancies');
assert.equal(new Set(kpmg.jobs.map(j=>j.id)).size,6);
for(const job of kpmg.jobs){
 const u=new URL(job.url);
 assert.equal(u.hostname,'app.mokahr.com');
 assert(/^#\/job\/[0-9a-f-]{36}$/.test(u.hash),'Must be specific Moka job UUID, not a recruitment board');
 assert(job.title&&job.city&&job.summary&&job.requirement&&job.evidenceUrl);
}
assert.equal(huayu.jobs.length,16,'Huayu official campus 21-role list, 16 source-backed role summaries in V2');
assert.equal(new Set(huayu.jobs.map(j=>j.id)).size,16);
assert.equal(huayu.indexedRoleCountOnOfficialPage,21);
for(const job of huayu.jobs){
 const u=new URL(job.sourceUrl);
 assert.equal(u.href,'https://hascovision.zhiye.com/campus/jobs');
 assert(job.title.length>=2&&job.city&&job.summary.length>24&&job.requirement.length>=8,'Short genuine employer qualification must not be padded with invented detail: '+job.id);
 assert(job.currentOpenVerified===false,'Do not invent current application status');
}
assert.equal(huaan.jobs.length,10,'Huaan Securities specific historical role evidence count');
assert.equal(new Set(huaan.jobs.map(j=>j.id)).size,10);
assert.equal(huaan.announcementRoleCount,10);
assert.equal(huaan.company,'华安证券');
assert.equal(huaan.officialRecruitmentPortal,'https://hahr.hazq.com:8083/eip4ha-hyapp/recruitment');
assert(huaan.jobs.every(j=>j.title&&j.city&&j.summary.length>20&&j.requirement.length>20&&j.currentOpenVerified===false));
assert(huaan.jobs.every(j=>j.deadline<'2026-10-29'),'All historical application deadlines passed');
assert(!JSON.stringify(huaan).includes('huaan.zhiye.com'),'Never confuse Huaan Fund and Huaan Securities');
assert(main.includes("if(route==='/companies/domestic/a-600909')return <HuaanSecuritiesCompactProfilePage user={user}/>"));
assert(huaanProfile.includes("rolesData.jobs.filter"),'Professional selection filters specific jobs');
assert(huaanProfile.includes("'/candidate/jobs/cn-v2-huaan-'+job.id"));
assert(huaanProfile.includes('归属待核验'),'Original photos cannot be claimed authentic');
assert(huaanProfile.includes('历史职位'));
assert.equal(guangfa.jobCount,10,'Review exactly one new employer');
assert.equal(new Set(guangfa.jobs.map(j=>j.id)).size,10);
assert.equal(guangfa.applicationDeadline,'2026-09-30');
assert(guangfa.jobs.every(j=>j.title&&j.city&&j.summary&&j.requirement&&j.sourceUrl&&j.officialListingUrl==='https://job.gf.com.cn/'&&j.currentOpenVerified===false));
assert(guangfa.jobs.every(j=>j.deadline<'2026-10-29'),'Must explicitly mark campus jobs historical');
assert(main.includes("if(route==='/companies/domestic/a-000776')return <GuangfaSecuritiesCompactProfilePage user={user}/>"));
assert(guangfaProfile.includes("rolesData.jobs.filter"),'Major selector filters actual source-backed roles');
assert(guangfaProfile.includes("'/candidate/jobs/cn-v2-guangfa-'+job.id"));
assert(guangfaProfile.includes('归属待核验'),'Old company photos cannot masquerade as verified');
assert.equal(citics.jobCount,5,'Only one new employer, five separately sourced branch vacancies');
assert.equal(new Set(citics.jobs.map(j=>j.id)).size,5);
assert.equal(new Set(citics.jobs.map(j=>j.office)).size,5,'Every job must be from a distinct named CITIC branch');
assert(citics.jobs.every(j=>j.education==='本科及以上应届毕业生'&&j.majorsRequirement.startsWith('不限专业')));
assert(citics.jobs.every(j=>j.sourceUrl.startsWith('https://')&&j.currentApplicationVerified===false));
assert.equal(citics.jobs.find(j=>j.id==='shanghai-branch-trainee').sourceUrl,
 'https://jdjyw.jlu.edu.cn/mportal/recruit/details?id=fbce9fb2a1e8489b97b9d5cbb1c7da17');
assert(citics.jobs.every(j=>{
 const u=new URL(j.sourceUrl);
 return ['jdjyw.jlu.edu.cn','www.career.zju.edu.cn','jy.scu.edu.cn'].includes(u.hostname);
}),'Every campus posting must link to a reviewed university career page');
assert(citics.jobs.every(j=>j.officialListingUrl==='https://careers.citics.com/campus/branch'));
assert(citics.jobs.every(j=>j.office.startsWith('中信证券股份有限公司')),'CSC Financial is a different company');
assert(citics.jobs.every(j=>!j.office.includes('山东')&&!j.office.includes('中信建投')),'Separate subsidiary jobs not folded in');
assert(main.includes("if(route==='/companies/domestic/a-600030')return <CiticsSecuritiesCompactProfilePage user={user}/>"));
assert(citicsProfile.includes("const jobs=rolesData.jobs;"),'All majors permitted; do not improperly filter unrestricted trainees');
assert(citicsProfile.includes("'/candidate/jobs/cn-v2-citics-'+job.id"),'Shared HHBA on-site job pages');
assert(citicsProfile.includes('归属待核验'),'Legacy image authenticity not invented');
assert(index.includes("DOMESTIC_REBUILD_APPROVED_COMPANIES=['施耐德电气','毕马威','华域视觉科技（上海）有限公司','华安证券','广发证券','中信证券']"));
assert(main.includes("if(route==='/companies/domestic/rel-huayu-004')return <HuayuVisionCompactProfilePage user={user}/>"),'Preserve old profile URL');
assert(huayuProfile.includes("rolesData.jobs.filter"),'Major selector filters real jobs');
assert(huayuProfile.includes("'/candidate/jobs/cn-v2-huayu-'+job.id"),'Onsite job detail for every role');
const headings=['适合哪些专业背景？','招聘岗位','主要业务与专业服务'];
assert(headings.map(h=>huayuProfile.indexOf(h)).every((v,i,a)=>v>=0&&(i===0||v>a[i-1])),'Four block order');
assert(huayuProfile.includes('domestic-media/user-4f0e78c7cb648df8a4cd2fed.webp'));
assert(huayuProfile.includes('企业官网公开照片')&&huayuProfile.includes('归属待核验'));
assert(huayuProfile.includes('原有建筑场景素材'));

assert(index.includes("id:'cn-v2-schneider-'"));
assert(index.includes("recordKind:'DOMESTIC_REBUILT'"));
assert(!index.includes('domesticAutumnVerifiedJobs20261028'),'Old mixed program/channel data must not feed new index');
assert(!index.includes('domesticRecruitmentRegistry'),'Portal-only records never become jobs');
assert(recruitment.includes("if(DOMESTIC_REBUILD_V2)return listDomesticRebuildMarket(filters,offset,signal)"));
assert(recruitment.includes("if(DOMESTIC_REBUILD_V2){"));
assert(recruitment.includes('loadCuratedOverseasJobs(signal)'));
assert(recruitment.includes("job.recordKind==='DOMESTIC_REBUILT'&&job.platform==='schneider-official'"));
assert(ui.includes("!rebuilding&&!curatedHundred&&<DomesticAutumnMarket"));
assert(ui.includes("!rebuilding&&!curatedHundred&&<DomesticCompanyResults"));
assert(ui.includes("job.recordKind==='DOMESTIC_REBUILT'?<div className=\"unified-jd-content\""));
assert(ui.includes("j.recordKind==='DOMESTIC_REBUILT'"));
assert(ui.includes("job.recordKind!=='DOMESTIC_REBUILT'&&<SaveJobButton jobId={job.id}/>"));
assert(branded.includes("autumn-real-logos/cn-autumn-002.svg"));
assert(branded.includes("autumn-real-logos/cn-autumn-001.svg"));
assert(branded.includes('domestic-media/user-f9727f3062cf91da52b3285c.png'));
assert(branded.includes('domestic-media/user-4e84106ce0d3db721fab644a.png'));
assert(branded.includes('domestic-media/user-bc5d9ca993044b7644390553.png'));
assert(branded.includes('domestic-media/user-ed43abe9b2aa6a7d0600525e.png'));
assert(recruitment.includes("job.platform==='citics-branch-campus-official'"));
assert(recruitment.includes('job.positionOrg'));
assert(ui.includes("job.platform==='citics-branch-campus-official'"));
assert(ui.includes('job.evidenceUrl'));
for(const p of ['user-ed43abe9b2aa6a7d0600525e.png','user-f330eee0347f310e7c9fcb2d.webp','user-f9608fde8808381f0d17894b.webp'])
 assert(existsSync('public/domestic-media/'+p),'Reused CITIC visual must exist: '+p);

assert(recruitment.includes("job.platform==='guangfa-securities-official'"));
assert(ui.includes("job.platform==='guangfa-securities-official'?'查看广发证券官方招聘首页"));
for(const f of ['user-bc5d9ca993044b7644390553.png','user-ee7dc13de9387efbca39caf1.webp','user-d1173b668561e62dec056169.webp'])
 assert(existsSync('public/domestic-media/'+f),'GF existing media must be reused '+f);

assert(recruitment.includes("job.platform==='huaan-securities-official'"));
assert(ui.includes("job.platform==='huaan-securities-official'?'查看华安证券官方招聘报名系统"));
for(const file of ['user-4e84106ce0d3db721fab644a.png','user-628c0cb2972a0ee5c3ef77b7.webp','user-0c1364cd23938f72c131e011.webp']){
 assert(existsSync('public/domestic-media/'+file),'Old Huaan image must be reused, not regenerated');
}
assert(recruitment.includes("job.platform==='huayu-official-campus'"));
assert(ui.includes("job.platform==='huayu-official-campus'?'前往官方职位列表核对该岗位'"));
assert(recruitment.includes("job.platform==='kpmg-moka-official'"));
assert(kpmgProfile.includes('kpmgJobs.jobs.filter'));
assert(kpmgProfile.includes("'/candidate/jobs/cn-v2-kpmg-'+job.id"));
for(const suffix of ['01','02']){
 const path='public/images/autumn-ai-scenes/cn-autumn-002-'+suffix+'.avif';
 assert(existsSync(path),'Reusing already created company photo '+path);
}
console.log('HHBA_DOMESTIC_V2_100_OVERSEAS_12_SCHNEIDER_6_KPMG_16_HUAYU_10_HUAAN_10_GUANGFA_5_CITICS_BRANCH_POSITIONS '+workflowBranch);
