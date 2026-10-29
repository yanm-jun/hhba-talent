import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(p)=>readFileSync('src/'+p,'utf8');
const matching=read('services/majorJobMatching.ts');
const market=read('components/UnifiedJobMarket.tsx');
const company=read('components/CompanyMajorJobs.tsx');
const employer=read('components/MajorEmployerRecommendations.tsx');
const recruitment=read('services/liveRecruitment.ts');
const catalog=read('services/domesticRebuildJobs.ts');
const router=read('services/companyDirectory.ts');
const routes=[
 ['KpmgCompactProfilePage.tsx','/companies/autumn/cn-autumn-001'],
 ['SchneiderCompactProfilePage.tsx','/companies/autumn/cn-autumn-002'],
 ['PfizerCompactProfilePage.tsx','/companies/autumn/cn-autumn-003'],
 ['CsairCompactProfilePage.tsx','/companies/autumn/cn-autumn-004'],
 ['SfExpressCompactProfilePage.tsx','/companies/autumn/cn-autumn-005'],
 ['NeteaseGamesCompactProfilePage.tsx','/companies/autumn/cn-autumn-006'],
 ['HuayuVisionCompactProfilePage.tsx','/companies/domestic/rel-huayu-004'],
 ['HuaanSecuritiesCompactProfilePage.tsx','/companies/domestic/a-600909'],
 ['GuangfaSecuritiesCompactProfilePage.tsx','/companies/domestic/a-000776'],
 ['CiticsSecuritiesCompactProfilePage.tsx','/companies/domestic/a-600030'],
];
for(const [page,route] of routes){
 const s=read('pages/'+page);
 assert(s.includes('CompanyMajorJobs companyRoute="'+route+'"'),page+' still has independent role filter');
 assert(s.includes('hhba-kpmg-photo-grid'),page+' missing original image layout');
 assert(s.includes('主要业务与专业服务'),page+' missing approved business layout');
}
assert(matching.includes("export function matchRoleToMajor"));
assert(matching.includes("return 'unknown'"),'Never treat absent evidence as eligible');
assert(matching.includes("return 'unrestricted'"),'Explicit unrestricted must be preserved');
assert(market.includes('MajorEmployerRecommendations filters='));
assert(market.includes('major_slug:selectedMajor'), 'Market must apply major filter to listJobs');
assert(market.includes('include_unknown_majors:e.target.checked'), 'User can inspect unverified records');
assert(recruitment.includes('visibleRoleForMajor(job,f.major_slug'), 'Filters must run before pagination');
const rebuildMarket=recruitment.slice(recruitment.indexOf('export async function listDomesticRebuildMarket'));
assert(rebuildMarket.indexOf('rebuildListFilter(job,filters)')>=0&&rebuildMarket.indexOf('rebuildListFilter(job,filters)')<rebuildMarket.indexOf('allowed.slice(offset,offset+30)'), 'Filter before pagination in domestic V2');
assert(company.includes("domesticV2Records.filter(j=>j.employerRoute===companyRoute"), 'Use the same V2 source');
assert(company.includes("'\/candidate\/jobs\/'+encodeURIComponent(job.id)"),'Must open HHBA on-site job detail');
assert(employer.includes('rebuildListFilter(job,filters)'), 'Employer counts must use same market filters');
assert(router.includes('job.employerRoute'), 'Job cards must lead back to reviewed employer page');
assert(catalog.includes('sftechV2Records.length!==17')&&catalog.includes('neteaseV2Records.length!==14')&&catalog.includes('domesticV2Records.length!==100'), 'Preserve all existing 100 domestic jobs');
assert(catalog.includes('editorialRelatedMajors:job.editorialRelatedMajors'), 'Do not silently drop published editorial mapping');
assert(existsSync('src/styles/major-company-flow.css'));
console.log('MAJOR_TO_COMPANY_TO_JOB_CONTRACT_OK',routes.length,'reviewed employers');
