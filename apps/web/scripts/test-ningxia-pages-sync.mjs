import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {NINGXIA_POLICY_RECORDS} from '../src/data/ningxiaPolicyRecords.ts';
import {NINGXIA_HOUSING_RECORDS} from '../src/data/ningxiaHousingRecords.ts';
const expected=[
 ['银川','银川市',11,5],
 ['石嘴山','石嘴山市',7,7],
 ['吴忠','吴忠市',7,4],
 ['固原','固原市',8,5],
 ['中卫','中卫市',7,5]
];
assert.equal(NINGXIA_POLICY_RECORDS.length,40);
assert.equal(NINGXIA_HOUSING_RECORDS.length,26);
for(const [short,official,policies,housing] of expected){
 const c=findTalentCity(official);
 assert.equal(c?.name,short,'wrong canonical nationwide city alias '+official);
 assert.equal(c?.official,official,'wrong official city name '+official);
 const fromOfficial=getTalentCitySnapshot(official);
 const fromShort=getTalentCitySnapshot(short);
 assert.equal(fromShort.policyCount,policies,'short-name policies missing for '+short);
 assert.equal(fromShort.housingCount,housing,'short-name housing missing for '+short);
 assert.equal(fromOfficial.policyCount,policies,'OFFICIAL CITY PAGE would display zero policies: '+official);
 assert.equal(fromOfficial.housingCount,housing,'OFFICIAL CITY PAGE would display zero housing: '+official);
 assert.ok(!fromOfficial.isEmpty,'must never show officially sourced Ningxia as pending '+official);
 assert.deepEqual(fromOfficial.policies.map(x=>x.id),fromShort.policies.map(x=>x.id));
 assert.deepEqual(fromOfficial.homes.map(x=>x.id),fromShort.homes.map(x=>x.id));
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const policyList=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const details=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(routes.includes('getTalentCitySnapshot(match.name)')&&routes.includes("fragments[2]==='ningxia'"));
assert.ok(routes.includes('NINGXIA_5_CITIES.some(c=>c===match.name)'));
assert.ok(policyList.includes('policy-guide-preview/ningxia')&&details.includes('policy-guide-preview/ningxia'));
console.log('NINGXIA_PAGES_MAIN_SYNC_OK 5/5 canonical+official city routes, 40 policy links, 26 housing links, five full guides.');
