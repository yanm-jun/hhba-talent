import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(p)=>readFileSync('src/'+p,'utf8');
const matching=read('services/majorJobMatching.ts');
const market=read('components/UnifiedJobMarket.tsx');
const company=read('components/CompanyMajorJobs.tsx');
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
 ['HypergryphCompactProfilePage.tsx','/companies/autumn/cn-autumn-007'],
 ['AnkerCompactProfilePage.tsx','/companies/autumn/cn-autumn-008'],
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
assert(!market.includes('MajorEmployerRecommendations'), 'Professional selection must never display grouped companies in recruitment market');
assert(market.includes('selectedMajor&&<section className="hhba-major-role-summary"'), 'Professional selection must show concrete role-result heading');
assert(market.includes('!selectedMajor&&<V2EmployerSearchResults'), 'Do not show company-first V2 search during professional selection');
assert(market.includes('!selectedMajor&&!rebuilding&&!curatedHundred&&<DomesticCompanyResults'), 'No separate employer list when major is selected');
assert(market.includes('majorSlug={selectedMajor}'), 'Job cards should explain each major match');
assert(market.includes('当前没有符合该专业及其他筛选条件的已收录岗位'), 'Empty major result must disclose zero roles, not invent companies');
assert(market.includes('major_slug:selectedMajor'), 'Market must apply major filter to listJobs');
assert(market.includes('include_unknown_majors:e.target.checked'), 'User can inspect unverified records');
assert(recruitment.includes('visibleRoleForMajor(job,f.major_slug'), 'Filters must run before pagination');
const rebuildMarket=recruitment.slice(recruitment.indexOf('export async function listDomesticRebuildMarket'));
assert(rebuildMarket.indexOf('rebuildListFilter(job,filters)')>=0&&rebuildMarket.indexOf('rebuildListFilter(job,filters)')<rebuildMarket.indexOf('allowed.slice(offset,offset+30)'), 'Filter before pagination in domestic V2');
assert(company.includes("domesticV2Records.filter(j=>j.employerRoute===companyRoute"), 'Use the same V2 source');
assert(company.includes("'\/candidate\/jobs\/'+encodeURIComponent(job.id)"),'Must open HHBA on-site job detail');
assert(recruitment.includes('matchRoleToMajor(b,filters.major_slug!)'), 'Rank real jobs by major evidence before pagination');
assert(recruitment.indexOf('allowed.sort((a,b)=>priority[')>recruitment.indexOf('const allowed=combined.filter'), 'Sort matching roles only after filtering');
assert(recruitment.indexOf('allowed.sort((a,b)=>priority[')<recruitment.indexOf('allowed.slice(offset,offset+30)'), 'Major priority must be applied before pagination');
assert(!existsSync('src/components/MajorEmployerRecommendations.tsx'), 'Remove obsolete company-first component');
assert(router.includes('job.employerRoute'), 'Job cards must lead back to reviewed employer page');
assert(catalog.includes('sftechV2Records.length!==17')&&catalog.includes('neteaseV2Records.length!==14')&&catalog.includes('hypergryphV2Records.length!==20')&&catalog.includes('ankerV2Records.length!==24')&&catalog.includes('domesticV2Records.length!==160+profileV2Records.length'), 'Preserve 160 legacy domestic roles and all newly approved employer records');
assert(catalog.includes('editorialRelatedMajors:job.editorialRelatedMajors'), 'Do not silently drop published editorial mapping');
assert(existsSync('src/styles/major-company-flow.css'));
console.log('MAJOR_TO_DIRECT_JOB_CONTRACT_OK',routes.length,'reviewed employer profiles retained');
