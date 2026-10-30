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
const sharedJobs=src(root+'components/CompanyMajorJobs.tsx');
const sharedMatching=src(root+'services/majorJobMatching.ts');
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
assert(huaanProfile.includes('<CompanyMajorJobs companyRoute="/companies/domestic/a-600909"/>'),'Huaan uses shared professional matching');
assert(sharedJobs.includes("'/candidate/jobs/'+encodeURIComponent(job.id)"),'All reviewed roles must open HHBA detail');
assert(huaanProfile.includes('归属待核验'),'Original photos cannot be claimed authentic');
assert(sharedJobs.includes('申请状态待官网核对'),'Historical application status clearly stated');
assert.equal(guangfa.jobCount,10,'Review exactly one new employer');
assert.equal(new Set(guangfa.jobs.map(j=>j.id)).size,10);
assert.equal(guangfa.applicationDeadline,'2026-09-30');
assert(guangfa.jobs.every(j=>j.title&&j.city&&j.summary&&j.requirement&&j.sourceUrl&&j.officialListingUrl==='https://job.gf.com.cn/'&&j.currentOpenVerified===false));
assert(guangfa.jobs.every(j=>j.deadline<'2026-10-29'),'Must explicitly mark campus jobs historical');
assert(main.includes("if(route==='/companies/domestic/a-000776')return <GuangfaSecuritiesCompactProfilePage user={user}/>"));
assert(guangfaProfile.includes('<CompanyMajorJobs companyRoute="/companies/domestic/a-000776"/>'),'GF Securities uses shared professional matching');
assert(sharedJobs.includes('domesticV2Records.filter'),'Use same approved jobs as market');
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
assert(citicsProfile.includes('<CompanyMajorJobs companyRoute="/companies/domestic/a-600030"/>'),'CITIC trainees follow the shared major matcher');
assert(sharedMatching.includes("return 'unrestricted'"),'Explicit unrestricted roles remain visible for any major');
assert(sharedJobs.includes("'/candidate/jobs/'+encodeURIComponent(job.id)"),'Shared on-site role detail');
assert(citicsProfile.includes('归属待核验'),'Legacy image authenticity not invented');
assert(index.includes("const LEGACY_APPROVED_COMPANIES=['施耐德电气','毕马威'")&&index.includes('...employerProfiles.filter('),'Keep all previously approved employers and dynamically add reviewed V2 profiles');
const csair=JSON.parse(src('src/data/domesticCsairVerifiedPositions20261029.json'));
const csairPage=src('src/pages/CsairCompactProfilePage.tsx');
assert.equal(csair.jobs.length,6,'Exactly six source-backed China Southern jobs from official listings');
assert.equal(new Set(csair.jobs.map(j=>j.id)).size,6,'No duplicate China Southern jobs');
assert(csair.jobs.every(j=>j.company==='中国南方航空'&&j.city&&j.title&&j.date&&j.sourceUrl==='https://job.csair.cn/global'&&j.currentOpenVerified===false));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-004')return <CsairCompactProfilePage user={user}/>;"));
assert(csairPage.includes('hhba-kpmg-compact')&&csairPage.includes('hhba-kpmg-photo-grid'));
assert(csairPage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-004"/>'));
assert(csairPage.indexOf('CompanyMajorJobs')<csairPage.indexOf('主要业务与专业服务'),'Preserve image, major/jobs, business order');
assert(sharedJobs.includes('encodeURIComponent(job.id)'), 'CSAIR links use unified HHBA detail');
assert(csairPage.includes('data-hhba-recruitment-outbound="true"'));
assert(["csairV2Records.length!==6","sftechV2Records.length!==17","neteaseV2Records.length!==14","hypergryphV2Records.length!==20","ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
const sf=JSON.parse(src('src/data/domesticSfTechCampusRoles20261029.json'));
const sfPage=src('src/pages/SfExpressCompactProfilePage.tsx');
assert.equal(sf.jobs.length,17,'Keep 17 distinct positions evidenced by SF Technology 2027 campus announcement');
assert.equal(new Set(sf.jobs.map(j=>j.id)).size,17);
assert(sf.jobs.every(j=>j.company==='顺丰科技有限公司'&&j.currentOpenVerified===false&&j.individualPermalinkVerified===false&&j.sourceUrl==='https://campus.sf-express.com/#/homePage'));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-005')return <SfExpressCompactProfilePage user={user}/>;"));
assert(sfPage.includes('hhba-kpmg-compact')&&sfPage.includes('hhba-kpmg-photo-grid'));
assert(sfPage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-005"/>'));
assert(sfPage.indexOf('CompanyMajorJobs')<sfPage.indexOf('主要业务与专业服务'));
assert(sharedJobs.includes('encodeURIComponent(job.id)'),'SF Tech jobs use unified details');
assert(sfPage.includes('data-hhba-recruitment-outbound="true"'));
assert(["sftechV2Records.length!==17","neteaseV2Records.length!==14","hypergryphV2Records.length!==20","ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
assert(recruitment.includes("job.platform==='sftech-2027-campus-list'"));
for(const name of ['sf-logo.webp','sf-building.webp','sf-logistics.webp'])
 assert(existsSync('public/images/sf-user/'+name),'Missing separately provided SF photo '+name);


const hypergryph=JSON.parse(src('src/data/domesticHypergryph2027Roles20261029.json'));
const hypergryphPage=src('src/pages/HypergryphCompactProfilePage.tsx');
assert.equal(hypergryph.jobs.length,20,'20 separately indexed 2027 campus role titles with named public source');
assert.equal(new Set(hypergryph.jobs.map(j=>j.id)).size,20);
assert(hypergryph.jobs.every(j=>j.company==='上海鹰角网络科技有限公司'&&j.independentOfficialJobVerified===false&&j.currentOpenVerified===false&&j.officialListUrl==='https://career.hypergryph.com/'));
assert(hypergryph.jobs.every(j=>j.editorialRelatedMajors.length&&j.majors.length===0&&j.evidenceUrl.startsWith('https://')));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-007')return <HypergryphCompactProfilePage user={user}/>;"));
assert(hypergryphPage.includes('hhba-kpmg-photo-grid')&&hypergryphPage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-007"'));
assert(hypergryphPage.indexOf('CompanyMajorJobs')<hypergryphPage.indexOf('主要业务与专业服务'));
assert(hypergryphPage.includes('data-hhba-recruitment-outbound="true"'));
assert(["hypergryphV2Records.length!==20","ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
assert(recruitment.includes("job.platform==='hypergryph-2027-campus-reported'"));
for(const file of ['hypergryph-logo.png','hypergryph-reception.png','hypergryph-recruitment-art.png']){
 assert(existsSync('public/images/hypergryph-user/'+file),'Missing original PNG '+file);
}

const anker=JSON.parse(src('src/data/domesticAnker2027OfficialRoles20261030.json'));
const ankerPage=src('src/pages/AnkerCompactProfilePage.tsx');
assert.equal(anker.jobs.length,24,'24 distinct real Anker 2027 official campus role titles');
assert.equal(new Set(anker.jobs.map(j=>j.id)).size,24);
assert(anker.jobs.every(j=>j.company==='安克创新科技股份有限公司'&&j.evidenceUrl.startsWith('https://career.anker.com.cn/universities/recruitment/jobPosts/')));
assert.equal(anker.jobs.filter(j=>j.individualPermalinkVerified).length,2,'Only two individually verified job deep links');
assert(anker.jobs.every(j=>j.currentOpenVerified===false),'Do not claim real-time availability');
assert(anker.jobs.every(j=>j.majors.length>0||j.editorialRelatedMajors.length>0));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-008')return <AnkerCompactProfilePage user={user}/>;"));
assert(ankerPage.includes('hhba-kpmg-photo-grid')&&ankerPage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-008"'));
assert(ankerPage.indexOf('CompanyMajorJobs')<ankerPage.indexOf('主要业务与专业服务'));
assert(ankerPage.includes('data-hhba-recruitment-outbound="true"'));
assert(["ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
assert(recruitment.includes("job.platform==='anker-2027-campus-official'"));
for(const file of ['anker-logo.png','anker-brand-vision.png','anker-building.png'])
 assert(existsSync('public/images/anker-user/'+file),'Missing original Anker PNG '+file);

const netease=JSON.parse(src('src/data/domesticNeteaseCampusRoleDirections20261029.json'));
const neteasePage=src('src/pages/NeteaseGamesCompactProfilePage.tsx');
assert.equal(netease.jobs.length,14,'Fourteen evidenced and appropriately caveated role directions');
assert.equal(new Set(netease.jobs.map(j=>j.id)).size,14);
assert(netease.jobs.every(j=>j.company==='网易游戏（互娱）'&&j.currentOpenVerified===false&&j.independentOfficialJobVerified===false&&j.recordKind==='position_direction'));
assert(netease.jobs.every(j=>j.sourceUrl==='https://campus.game.163.com/'&&j.titleEvidenceUrl&&j.summary&&j.requirements));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-006')return <NeteaseGamesCompactProfilePage user={user}/>;"));
assert(neteasePage.includes('hhba-kpmg-compact')&&neteasePage.includes('hhba-kpmg-photo-grid'));
const order=['适合哪些专业背景？','招聘岗位','主要业务与专业服务'];
assert(neteasePage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-006"/>'));
assert(neteasePage.indexOf('CompanyMajorJobs')<neteasePage.indexOf('主要业务与专业服务'));
assert(sharedJobs.includes('encodeURIComponent(job.id)'),'NetEase jobs retain site detail');
assert(neteasePage.includes('data-hhba-recruitment-outbound="true"'));
assert(["neteaseV2Records.length!==14","hypergryphV2Records.length!==20","ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
assert(recruitment.includes("job.platform==='netease-interactive-2027-direction'"));
for(const name of ['netease-logo.png','netease-building.png','netease-team.png']){
 assert(existsSync('public/images/netease-user/'+name),'Missing unmodified user original PNG '+name);
}

assert(recruitment.includes("job.platform==='csair-official-list'"));
for(const f of ['csair-logo.png','csair-building.webp','csair-aircraft.webp'])
 assert(existsSync('public/images/csair-user/'+f),'Missing China Southern image '+f);

const pfizer=JSON.parse(src('src/data/domesticPfizerOfficialJobs20261029.json'));
const pfizerPage=src('src/pages/PfizerCompactProfilePage.tsx');
assert.equal(pfizer.jobs.length,4,'Pfizer must have four individually sourced roles');
assert.equal(new Set(pfizer.jobs.map(j=>j.id)).size,4,'Pfizer role identities unique');
assert(pfizer.jobs.every(j=>j.company==='辉瑞'&&/^https:\/\/www\.pfizer\.com\/about\/careers\/job\/\d{7}\?langcode=en$/.test(j.sourceUrl)));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-003')return <PfizerCompactProfilePage user={user}/>;"));
assert(pfizerPage.includes('hhba-kpmg-compact'),'Pfizer must reuse CITIC compact layout');
assert(pfizerPage.includes('data-company-template="openai"'));
assert(pfizerPage.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-003"/>'));
assert(pfizerPage.indexOf('CompanyMajorJobs')<pfizerPage.indexOf('主要业务与专业服务'));
assert(sharedJobs.includes("'/candidate/jobs/'+encodeURIComponent(job.id)"),'Pfizer jobs open unified HHBA role details');
assert(pfizerPage.includes('data-hhba-recruitment-outbound="true"'));
assert(["pfizerV2Records.length!==4","csairV2Records.length!==6","sftechV2Records.length!==17","neteaseV2Records.length!==14","hypergryphV2Records.length!==20","ankerV2Records.length!==24"].every(token=>index.includes(token))&&index.includes('domesticV2Records.length!==160+profileV2Records.length'),'Preserve original job count guardrails plus dynamically checked V2 roles');
for(const n of ['pfizer-building.webp','pfizer-logo.webp','pfizer-laboratory.webp'])assert(existsSync('public/images/pfizer-user/'+n),'Missing user supplied photo: '+n);

assert(main.includes("if(route==='/companies/domestic/rel-huayu-004')return <HuayuVisionCompactProfilePage user={user}/>"),'Preserve old profile URL');
assert(huayuProfile.includes('<CompanyMajorJobs companyRoute="/companies/domestic/rel-huayu-004"/>'),'Huayu uses shared major/job selector');
assert(sharedJobs.includes('encodeURIComponent(job.id)'),'All Huayu jobs retain shared onsite detail');
assert(huayuProfile.indexOf('CompanyMajorJobs')<huayuProfile.indexOf('主要业务与专业服务'),'Original four-block order');
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
assert(kpmgProfile.includes('<CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-001"/>'),'KPMG shares the same role registry');
assert(sharedJobs.includes('encodeURIComponent(job.id)'),'KPMG shared job detail');
for(const suffix of ['01','02']){
 const path='public/images/autumn-ai-scenes/cn-autumn-002-'+suffix+'.avif';
 assert(existsSync(path),'Reusing already created company photo '+path);
}
console.log('HHBA_DOMESTIC_V2_144_OVERSEAS_12_SCHNEIDER_6_KPMG_16_HUAYU_10_HUAAN_10_GUANGFA_5_CITICS_BRANCH_POSITIONS '+workflowBranch);
