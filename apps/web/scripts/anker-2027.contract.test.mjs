import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const d=JSON.parse(read('src/data/domesticAnker2027OfficialRoles20261030.json'));
const page=read('src/pages/AnkerCompactProfilePage.tsx');
const main=read('src/main.tsx');
const index=read('src/services/domesticRebuildJobs.ts');
const live=read('src/services/liveRecruitment.ts');
const market=read('src/components/UnifiedJobMarket.tsx');
const recommendation=read('src/components/MajorEmployerRecommendations.tsx');
const logo=read('src/components/EmployerBrandLogo.tsx');
const matcher=read('src/services/majorJobMatching.ts');
const chip=read('src/components/CompanyMajorChips.tsx');
assert.equal(d.parentEmployerId,'cn-autumn-008');
assert.equal(d.jobs.length,24);
assert.equal(new Set(d.jobs.map(x=>x.id)).size,24);
assert.equal(d.jobs.filter(x=>x.individualPermalinkVerified).length,2);
assert(d.jobs.every(x=>x.recordKind==='official_campus_role_listed'&&x.currentOpenVerified===false));
assert(d.jobs.every(x=>x.evidenceUrl.startsWith('https://career.anker.com.cn/universities/recruitment/jobPosts/')));
assert(d.jobs.every(x=>x.majors.length===0||x.individualPermalinkVerified),'No editorial subject field masquerades as official job requirement');
assert(d.jobs.every(x=>x.editorialRelatedMajors.length>=2));
assert(d.jobs.every(x=>x.city&&x.title&&x.summary&&x.requirements));
assert(page.includes('CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-008"'));
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('主要业务与专业服务'));
assert(!page.includes('<MajorFilter')&&!page.includes('清除专业'));
assert(page.includes('data-hhba-recruitment-outbound="true"'));
assert(main.includes("if(route==='/companies/autumn/cn-autumn-008')return <AnkerCompactProfilePage user={user}/>;"));
assert(index.includes('...hypergryphV2Records,...ankerV2Records,...laifenV2Records,...shkpV2Records,...boyuV2Records]')&&index.includes('domesticV2Records.length!==160'));
assert(index.includes('editorialRelatedMajors:job.editorialRelatedMajors'));
assert(live.includes("job.platform==='anker-2027-campus-official'")&&live.includes("job.source==='anker-innovations'"));
assert(live.includes("'cn-v2-anker-multimodal-ai'")&&live.includes("'cn-v2-anker-ai-app'"));
assert(matcher.includes('export function matchRoleToMajor'));
assert(chip.includes('companyMajorChoices(jobs,preferredNames,slug)'));
assert(market.includes('MajorEmployerRecommendations'));
assert(recommendation.includes('rebuildListFilter(job,filters)'));
assert(logo.includes('images/autumn-real-logos/cn-autumn-008.svg'));
assert(page.includes('images/autumn-real-logos/cn-autumn-008.svg'));
const userLogo=read('public/images/autumn-real-logos/cn-autumn-008.svg');
assert(userLogo.includes('Anker Innovations')&&userLogo.includes('fill="#071689"'));
assert(index.includes("Anker Innovations Anker 安克创新"));
assert(index.includes("job.company!=='安克创新科技股份有限公司'"));
assert(live.includes("ankerAliases=domestic&&job.company==='安克创新科技股份有限公司'"));
assert(live.includes("nameAliases=domestic&&job.company==='安克创新科技股份有限公司'"));
assert(live.includes("...(job.editorialRelatedMajors||[])"));
const hashes={
 'anker-logo.png':'f21c99496eaa7ae2704902a36dc8be65cc96c601a97f1efc271f4f534e6d6d42',
 'anker-brand-vision.png':'4f0bde576ec8491c9ac01a1e742e17dedef0c3211f3e00e4323cbb0ba87291ae',
 'anker-building.png':'aeafdc66c76589db01a7a3a1fa364bd0dde24d372f362cb7d89cc9873f9ab222'
};
for(const [file,expected] of Object.entries(hashes)){
 const path='public/images/anker-user/'+file;
 assert(existsSync(path),'Missing unmodified PNG '+file);
 const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
 assert.equal(actual,expected,'Original image was lossily modified: '+file);
}
console.log('HHBA_ANKER_24_REAL_ROLES_144_DOMESTIC_100_OVERSEAS_ORIGINAL_PNG_OK');
