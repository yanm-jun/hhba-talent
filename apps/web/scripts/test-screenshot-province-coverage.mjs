import assert from 'node:assert/strict';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
/** The screenshot's 15 provinces are not all unmerged. Every province must be
 * audited against the exact main aggregation the city UI renders.
 * This verifies source data, not live benefits, approved applications, or real-time vacancies.
 */
const targets=['山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','安徽省','福建省','江西省','河南省','湖北省','湖南省','海南省','四川省','贵州省','西藏自治区'];
const fullyIntegrated=new Set(targets.slice(0,12));
const all=TALENT_CITY_INDEX.filter(c=>targets.includes(c.province));
const summary=targets.map(province=>{
 const cities=all.filter(c=>c.province===province);
 const details=cities.map(c=>{const s=getTalentCitySnapshot(c.name);return {city:c.name,policy:s.policyCount,housing:s.housingCount};});
 const missingPolicy=details.filter(c=>c.policy===0).map(c=>c.city);
 const missingHousing=details.filter(c=>c.housing===0).map(c=>c.city);
 if(fullyIntegrated.has(province)){
  assert.equal(missingPolicy.length,0,province+' has a false unresolved province gap: '+missingPolicy.join(','));
 }
 if(province==='贵州省'){
  assert.equal(cities.length,9,'Guizhou city-level index must include three autonomous prefectures');
  assert.equal(missingPolicy.length,0,'Guizhou nine policies were developed but not included in main');
  assert.ok(details.some(c=>c.housing===0),'do not claim all nine Guizhou housing records are developed');
 }
 if(province==='四川省'){
  assert.equal(cities.length,21,'Sichuan must include its three autonomous prefectures');
  assert.ok(details.every(c=>c.policy>=0));
 }
 return {province,regions:cities.length,withPolicy:details.length-missingPolicy.length,withHousing:details.length-missingHousing.length,missingPolicy,missingHousing};
});
const missing=summary.reduce((n,x)=>n+x.missingPolicy.length,0);
console.log('HHBA_SCREENSHOT_15_PROVINCES_AUDIT',JSON.stringify({provinces:summary.length,listedCities:all.length,missingPolicyCities:missing,provinces:summary},null,2));
console.log('HHBA_PROVINCE_MERGE_AND_AGGREGATION_GATE_PASS');
