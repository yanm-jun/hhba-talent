import assert from 'node:assert/strict';
import {JIANGSU_POLICY_RECORDS} from '../src/data/jiangsuPolicyRecords.ts';
import {JIANGSU_HOUSING_RECORDS} from '../src/data/jiangsuHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {talentSourceKind,assessPolicy,assessHousing} from '../src/data/talentQuality.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
const cities=['南京','无锡','徐州','常州','苏州','南通','连云港','淮安','盐城','扬州','镇江','泰州','宿迁'];
assert.equal(JIANGSU_POLICY_RECORDS.length,13);
assert.equal(new Set(JIANGSU_POLICY_RECORDS.map(x=>x.id)).size,13);
assert.deepEqual(new Set(JIANGSU_POLICY_RECORDS.map(x=>x.city)),new Set(cities));
assert.equal(queryTalentCities('','江苏省').length,13);
for (const city of cities) {
  assert.equal(findTalentCity(city+'市')?.name,city);
  const p=TALENT_POLICY_RECORDS.filter(x=>x.city===city);
  assert.ok(p.length>=1,city+' missing searchable policy');
  for (const r of p) {
    assert.equal(talentSourceKind(r.sourceUrl),'government',r.id+' source');
    assert.ok(r.materials?.length>=3 && r.applicationSteps?.length>=4,r.id+' V5.1 detail');
    assert.ok(r.reviewNote&&r.reviewedAt&&r.targetGroup,r.id+' review');
    assert.ok(assessPolicy(r).grade!=='A',r.id+' has no independently certified full guide');
  }
}
for (const r of JIANGSU_HOUSING_RECORDS) {
 assert.ok(TALENT_HOUSING_RECORDS.some(x=>x.id===r.id));
 assert.equal(r.kind,'program');
 assert.equal(talentSourceKind(r.sourceUrl),'government');
 assert.ok(r.steps.length>=4 && /非实时|无实时/.test(r.statusNote));
 assert.ok(assessHousing(r).grade!=='A');
}
console.log('Jiangsu V5.1 checks passed: '+cities.length+' cities, '+JIANGSU_POLICY_RECORDS.length+' policy records, '+JIANGSU_HOUSING_RECORDS.length+' housing programs');
