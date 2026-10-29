import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=p=>readFileSync(p,'utf8');
const root='src/';
const overseas=JSON.parse(src('public/curated/v1/jobs.json')).jobs;
const china=JSON.parse(src('src/data/domesticSchneiderDetailedDossier20261029.json'));
const kpmg=JSON.parse(src('src/data/domesticKpmgConcreteJobs20261029.json'));
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
assert(index.includes("DOMESTIC_REBUILD_APPROVED_COMPANIES=['施耐德电气','毕马威']"));
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
assert(recruitment.includes("job.platform==='kpmg-moka-official'"));
assert(kpmgProfile.includes('kpmgJobs.jobs.filter'));
assert(kpmgProfile.includes("'/candidate/jobs/cn-v2-kpmg-'+job.id"));
for(const suffix of ['01','02']){
 const path='public/images/autumn-ai-scenes/cn-autumn-002-'+suffix+'.avif';
 assert(existsSync(path),'Reusing already created company photo '+path);
}
console.log('HHBA_DOMESTIC_V2_100_OVERSEAS_12_SCHNEIDER_6_HISTORICAL_KPMG_JOBS_NO_LEGACY_PORTALS '+workflowBranch);
