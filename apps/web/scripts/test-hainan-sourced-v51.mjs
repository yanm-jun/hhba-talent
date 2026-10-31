import assert from 'node:assert/strict';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {HAINAN_POLICY_RECORDS} from '../src/data/hainanPolicyRecords.ts';
import {HAINAN_HOUSING_RECORDS} from '../src/data/hainanHousingRecords.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {readFileSync} from 'node:fs';

assert.equal(HAINAN_POLICY_RECORDS.length,3);
assert.equal(HAINAN_HOUSING_RECORDS.length,3);
assert.equal(queryTalentCities('','海南省').length,4);
const auditedCities=['海口','三亚','儋州'];
for(const city of auditedCities){
 assert.equal(findTalentCity(city)?.name,city);
 const p=HAINAN_POLICY_RECORDS.filter(x=>x.city===city);
 const h=HAINAN_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.equal(p.length,1);
 assert.equal(h.length,1);
 assert.ok(TALENT_POLICY_RECORDS.some(x=>x.id===p[0].id));
 assert.ok(TALENT_HOUSING_RECORDS.some(x=>x.id===h[0].id));
 assert.equal(talentSourceKind(p[0].sourceUrl),'government');
 assert.equal(talentSourceKind(h[0].sourceUrl),'government');
 assert.equal(assessPolicy(p[0],'2026-10-31').grade,'B','do not pretend independently certified A');
 assert.equal(assessHousing(h[0],'2026-10-31').grade,'B');
 assert.ok(p[0].materials.length>=3&&p[0].applicationSteps.length>=4);
 assert.ok(p[0].reviewNote&&p[0].reviewedAt);
 assert.equal(h[0].kind,'program');
 assert.ok((h[0].units.includes('未核验')||h[0].units.includes('空房'))&&h[0].steps.length>=4);
 assert.ok(h[0].statusNote.includes('非实时')||h[0].statusNote.includes('无实时'));
}
assert.equal(HAINAN_POLICY_RECORDS.find(x=>x.city==='儋州').published,'2026-06-01');
assert.ok(HAINAN_POLICY_RECORDS.find(x=>x.city==='儋州').reviewNote.includes('2026年12月31日'));
assert.ok(!HAINAN_POLICY_RECORDS.some(x=>x.city==='三沙'),'unverified Sansha city-wide subsidies must not be fabricated');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(routes.includes('buildCityPolicyConfig(city)'));
assert.ok(routes.includes('TALENT_HOUSING_RECORDS'));
console.log('PASS Hainan source-backed policy/housing 3+3, 1 city still pending independent evidence');
