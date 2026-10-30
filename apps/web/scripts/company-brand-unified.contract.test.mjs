import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=f=>readFileSync('src/'+f,'utf8');
const registry=src('services/domesticCompanyBrand.ts');
const card=src('components/DomesticCompanyResults.tsx');
const mark=src('components/DomesticBrandMark.tsx');
const autumn=src('components/AutumnCompanyBrand.tsx');
const employer=src('components/EmployerBrandLogo.tsx');
const screenshots=JSON.parse(src('data/domesticAutumnScreenshot20261028.json'));
const records=JSON.parse(src('data/domesticShkp2026SourcedRoles20261030.json'));
assert.equal(screenshots.entries.length,156);
assert.equal(records.jobs.length,8);
assert(registry.includes("cn-autumn-010':'images/shkp-user/shkp-logo.webp"));
assert(registry.includes("cn-autumn-008':'images/autumn-real-logos/cn-autumn-008.svg"));
assert(registry.includes("cn-autumn-009':'images/laifen-user/laifen-logo.webp"));
assert(registry.includes('const saved=mediaBrands[input.name]?.brand'));
assert(registry.includes('const mark=catalogueMarks[input.name]'));
assert(registry.includes('idFromRoute(jobRoutes.get(name))'));
assert(card.includes('<DomesticBrandMark name={company.name} route={company.route}/>'));
assert(card.includes("reviewedJobCount.get(company.route)||0"),'Only actual reviewed employer role metadata upgrades a company listing');
assert(card.includes("已整理企业详情 · 岗位状态待核验"),'Never mislabel a reviewed employer as list-only');
assert(autumn.includes("DomesticBrandMark name={name}"));
assert(employer.includes('if(domesticAsset)return'), 'Job cards should prefer the same single brand registry');
assert(mark.includes('onError={()=>setBroken(true)}'),'Broken image must fall back to honest placeholder');
for(const file of ['shkp-user/shkp-logo.webp','laifen-user/laifen-logo.webp','autumn-real-logos/cn-autumn-008.svg']){
 assert(existsSync('public/images/'+file), 'Verified image not bundled: '+file);
}
console.log('HHBA_UNIFIED_BRAND_SEARCH_STATUS_156_COMPANIES_OK');
