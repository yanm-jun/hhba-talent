import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,TALENT_PREFECTURE_CITIES,TALENT_NEW_PREFECTURES_20261031} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {ACCEPTED_TALENT_CITIES,TALENT_QUALITY_SUMMARY,assessPolicy,assessHousing} from '../src/data/talentQuality.ts';

// This is a code/data integrity audit, not a government-portal availability or housing vacancy audit.
// Counts are derived from the current git checkout on each run, never copied from a report.
const provincialTargets={
 '山西省':11,'内蒙古自治区':12,'吉林省':9,'黑龙江省':13,'安徽省':16,
 '福建省':9,'江西省':11,'河南省':17,'湖北省':13,'湖南省':14
};
const asOf='2026-10-31';
const byCity=(items)=>items.reduce((map,item)=>{
 const list=map.get(item.city)||[];list.push(item);map.set(item.city,list);return map;
},new Map());
const byPolicy=byCity(TALENT_POLICY_RECORDS);
const byHousing=byCity(TALENT_HOUSING_RECORDS);
const names=new Set(TALENT_CITY_INDEX.map(c=>c.name));
const official=new Set(TALENT_CITY_INDEX.map(c=>c.official));
const policyIds=TALENT_POLICY_RECORDS.map(r=>r.id);
const housingIds=TALENT_HOUSING_RECORDS.map(r=>r.id);
assert.equal(new Set(policyIds).size,policyIds.length,'duplicate policy IDs across merged provinces');
assert.equal(new Set(housingIds).size,housingIds.length,'duplicate housing IDs across merged provinces');
assert.equal(names.size,TALENT_CITY_INDEX.length,'duplicate region names');
assert.equal(new Set(TALENT_CITY_INDEX.map(c=>c.code)).size,TALENT_CITY_INDEX.length,'duplicate region codes');
assert.equal(TALENT_PREFECTURE_CITIES.length,293,'original prefecture-city baseline was modified');
assert.equal(TALENT_CITY_INDEX.length,337,'25 additional prefecture-level administrative regions must be indexed');
for(const r of [...TALENT_POLICY_RECORDS,...TALENT_HOUSING_RECORDS]){
 assert.ok(names.has(r.city),'orphan data points to an unknown region: '+r.city+' / '+r.id);
 assert.ok(r.id&&r.sourceUrl&&r.published,'missing ID, evidence or published date: '+r.id);
}
const provinceCoverage=Object.entries(provincialTargets).map(([province,expected])=>{
 const cities=TALENT_CITY_INDEX.filter(c=>c.province===province).map(c=>c.name);
 assert.equal(cities.length,expected,province+' incomplete merged city directory');
 for(const city of cities){
  assert.ok((byPolicy.get(city)||[]).length>0,'missing merged policy data for '+province+city);
  assert.ok((byHousing.get(city)||[]).length>0,'missing merged housing data for '+province+city);
 }
 return {province,regions:cities.length,policies:cities.reduce((n,c)=>n+(byPolicy.get(c)||[]).length,0),
   housing:cities.reduce((n,c)=>n+(byHousing.get(c)||[]).length,0)};
});
const missingPolicy=TALENT_CITY_INDEX.filter(c=>!byPolicy.has(c.name)).map(c=>({province:c.province,city:c.name}));
const missingHousing=TALENT_CITY_INDEX.filter(c=>byPolicy.has(c.name)&&!byHousing.has(c.name)).map(c=>({province:c.province,city:c.name}));
const addedRegionNames=new Set(TALENT_NEW_PREFECTURES_20261031.map(x=>x.name));
assert.equal(addedRegionNames.size,25,'new prefectures were lost or duplicated');
const originalMissingPolicy=missingPolicy.filter(x=>!addedRegionNames.has(x.city));
assert.ok(originalMissingPolicy.length<=64,'original 312-region policy coverage regressed');
assert.ok(missingHousing.length<=26,'housing coverage regressed from the 2026-10-31 main audit');
// Compare only the PCA province -> second-layer nodes. They include counties and directly
// administered municipalities and must NEVER all be treated as prefecture cities.
const pca=JSON.parse(readFileSync(new URL('../src/data/china_pca_2026.json',import.meta.url),'utf8'));
const pcaSecondLevel=pca.flatMap(p=>(p.ch||[]).map(c=>({province:p.n,name:c.n,code:String(c.c)})));
const unmatchedPca=pcaSecondLevel.filter(c=>!official.has(c.name));
const missingPrefecture=unmatchedPca.filter(c=>c.code.length===4&&c.name!=='县');
const directAdminOrCounty=unmatchedPca.filter(c=>c.code.length===6);
const syntheticPcaNode=unmatchedPca.filter(c=>c.name==='县');
assert.equal(missingPrefecture.length+directAdminOrCounty.length+syntheticPcaNode.length,unmatchedPca.length,'PCA nodes require an explicit administrative-level classification');
const policyQuality=TALENT_POLICY_RECORDS.reduce((a,p)=>(a[assessPolicy(p,asOf).grade]++,a),{A:0,B:0,C:0,D:0});
const housingQuality=TALENT_HOUSING_RECORDS.reduce((a,h)=>(a[assessHousing(h,asOf).grade]++,a),{A:0,B:0,C:0,D:0});
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const cards=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.match(detail,/nationalRecordGuideUrl\('policy',policy\.id,policy\.city\)/,'policy guide links must check province city');
assert.match(detail,/id\.startsWith\('hn-'\)[^\n]*includes\(city\)/,'Henan and Hunan must not share a guide route');
assert.match(cards,/newProvincePolicyRoute\(p\.id,p\.city\)/,'policy listing must also check province city');
assert.equal(ACCEPTED_TALENT_CITIES.filter(city=>!names.has(city)).length,0,'certification contains unknown region');
const report={
 auditDate:asOf,scope:'GitHub repository code and data (not government live verification)',
 regions:TALENT_CITY_INDEX.length,policyRecords:TALENT_POLICY_RECORDS.length,housingRecords:TALENT_HOUSING_RECORDS.length,
 provinceCoverage,policyQuality,housingQuality,
 qualitySummaryByGrade:TALENT_QUALITY_SUMMARY.byGrade,acceptedCities:ACCEPTED_TALENT_CITIES.length,
 zeroPolicyCities:missingPolicy.length,zeroPolicyList:missingPolicy,
 original312MissingPolicy:originalMissingPolicy.length,pendingNewPrefectures:missingPolicy.filter(x=>addedRegionNames.has(x.city)).length,
 policyCitiesMissingHousing:missingHousing.length,missingHousingList:missingHousing,
 pcaSecondLevelCount:pcaSecondLevel.length,unmatchedPcaCount:unmatchedPca.length,
 pcaUnmatchedNodes:unmatchedPca,
 pcaMissingPrefectureCount:missingPrefecture.length,pcaMissingPrefectureList:missingPrefecture,
 pcaDirectAdminOrCountyCount:directAdminOrCounty.length,
 pcaSyntheticNodeCount:syntheticPcaNode.length,
 constraints:'PCA unmatched county-level or provincial-direct units are not automatically classified as prefecture cities'
};
console.log('HHBA_NATIONAL_TALENT_AUDIT_BEGIN');
console.log(JSON.stringify(report,null,2));
console.log('HHBA_NATIONAL_TALENT_AUDIT_END');
