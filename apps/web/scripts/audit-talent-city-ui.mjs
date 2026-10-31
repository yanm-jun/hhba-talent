import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,findTalentCity} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
assert.equal(TALENT_CITY_INDEX.length,337,'national registry count changed unexpectedly');
const names=new Set(TALENT_CITY_INDEX.map(x=>x.name));
for(const r of [...TALENT_POLICY_RECORDS,...TALENT_HOUSING_RECORDS])assert.ok(names.has(r.city),'record references missing city: '+r.id);
const summary=TALENT_CITY_INDEX.map(c=>{
 const s=getTalentCitySnapshot(c.name);
 const p=TALENT_POLICY_RECORDS.filter(r=>r.city===c.name).length;
 const h=TALENT_HOUSING_RECORDS.filter(r=>r.city===c.name).length;
 assert.equal(s.policyCount,p,'policy false-zero: '+c.name);
 assert.equal(s.housingCount,h,'housing false-zero: '+c.name);
 assert.equal(s.isEmpty,p+h===0,'empty-state drift: '+c.name);
 assert.equal(findTalentCity(c.official)?.name,c.name,'city alias route mismatch '+c.official);
 return {province:c.province,city:c.name,policy:p,housing:h};
});
const mustExist=['成都','自贡','德阳','广元','乐山','南充','眉山','达州','雅安','阿坝','海口','三亚','三沙','儋州'];
for(const city of mustExist){
 const s=getTalentCitySnapshot(city);
 assert.ok(s.policyCount>0,'known city displays zero policies '+city);
 assert.ok(s.housingCount>0,'known city displays zero housing '+city);
}
const ui=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(ui.includes('getTalentCitySnapshot(match.name)'),'city cards must use the exact data source audited by CI');
const empty=summary.filter(x=>x.policy+x.housing===0);
const noPolicy=summary.filter(x=>x.policy===0);
const noHousing=summary.filter(x=>x.housing===0);
console.log('HHBA_CITY_UI_AUDIT',JSON.stringify({regions:337,recordedPolicy:TALENT_POLICY_RECORDS.length,
 recordedHousing:TALENT_HOUSING_RECORDS.length,falseZeroInCurrentSource:0,
 trulyNoRecords:empty.length,noPolicy:noPolicy.length,noHousing:noHousing.length,
 knownSichuanWithPolicy:10,knownHainanWithPolicy:4,
 trulyNoRecordsByProvince:Object.fromEntries([...new Set(empty.map(x=>x.province))].map(p=>[p,empty.filter(x=>x.province===p).map(x=>x.city)]))}));
console.log('HHBA_337_CITY_UI_COUNTS_OK');
