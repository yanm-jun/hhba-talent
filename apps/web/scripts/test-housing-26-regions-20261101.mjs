import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
import {SICHUAN_HOUSING_GAP_2026_COUNTY_OFFICIAL} from '../src/data/sichuanHousingGap2026CountyOfficial.ts';
const matrix=JSON.parse(readFileSync(new URL('../../../docs/TALENT_HOUSING_26REGIONS_EVIDENCE_MATRIX_20261101.json',import.meta.url),'utf8'));
assert.equal(matrix.records.length,26,'Must maintain 7 Sichuan + 12 Guangxi + 7 Guizhou regions');
const groups=Object.fromEntries(Object.entries(matrix.regionCounts));
assert.deepEqual(groups,{'四川省':7,'广西壮族自治区':12,'贵州省':7});
const seen=new Set();
const cityIndex=new Map(TALENT_CITY_INDEX.map(c=>[c.name,c.province]));
for(const r of matrix.records){
 assert.ok(!seen.has(r.city),'duplicate target city '+r.city); seen.add(r.city);
 assert.equal(cityIndex.get(r.city),r.province,r.city+' mismatched provincial geography');
 if(r.hasVerifiedLocalDirectOriginal){
  assert.ok(r.localGovernmentOriginalUrl,'claimed verified original without an exact URL: '+r.city);
  assert.equal(talentSourceKind(r.localGovernmentOriginalUrl),'government','verified original must be government source: '+r.city);
  assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.city===r.city&&h.sourceUrl===r.localGovernmentOriginalUrl),'verified housing original not in nationwide aggregate: '+r.city);
 }else{
  assert.equal(r.localGovernmentOriginalUrl,null,'uncertified original must remain unclaimed');
 }
 assert.equal(r.liveVacancyVerified,false,'no current available homes verified from this research');
 assert.equal(r.projectAddressVerified,false,'no real project-level site addresses verified from this research');
}
assert.ok(seen.has('甘孜'));
assert.ok(SICHUAN_HOUSING_GAP_2026_COUNTY_OFFICIAL.length>=1,'must retain verified 2026 Luding County record; may additionally index older scoped government regulations');
const luding=SICHUAN_HOUSING_GAP_2026_COUNTY_OFFICIAL[0];
assert.equal(luding.city,'甘孜');
assert.match(luding.district,/泸定县/);
assert.match(luding.eligibility,/泸定县城镇户籍/);
assert.match(luding.rent,/70%/);
assert.equal(luding.kind,'program');
assert.ok(luding.steps.length>=6);
assert.equal(luding.sourceUrl,'https://www.luding.gov.cn/gfxwj/article/707174');
assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.id===luding.id));
const remaining=matrix.records.filter(x=>!x.hasVerifiedLocalDirectOriginal).map(x=>x.city);
console.log(JSON.stringify({reviewed:matrix.records.length,verifiedLocalProgramOriginals:matrix.records.length-remaining.length,pendingIndependentGovernmentOriginals:remaining.length,pendingCities:remaining,projectVacanciesVerified:0},null,2));
