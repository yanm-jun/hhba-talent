import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JIANGSU_POLICY_RECORDS} from '../src/data/jiangsuPolicyRecords.ts';
import {JIANGSU_HOUSING_RECORDS} from '../src/data/jiangsuHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {talentSourceKind,assessPolicy,assessHousing} from '../src/data/talentQuality.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
const cities=['南京','无锡','徐州','常州','苏州','南通','连云港','淮安','盐城','扬州','镇江','泰州','宿迁'];
assert.equal(JIANGSU_POLICY_RECORDS.length,26);
assert.equal(new Set(JIANGSU_POLICY_RECORDS.map(x=>x.id)).size,26);
assert.deepEqual(new Set(JIANGSU_POLICY_RECORDS.map(x=>x.city)),new Set(cities));
assert.equal(queryTalentCities('','江苏省').length,13);
for (const city of cities) {
  assert.equal(findTalentCity(city+'市')?.name,city);
  const p=TALENT_POLICY_RECORDS.filter(x=>x.city===city);
  assert.ok(p.length>=2,city+' must include two searchable policy records');
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
 assert.ok(r.statusNote.includes('申报入口')||r.applyUrl);
 assert.equal(talentSourceKind(r.sourceUrl),'government');
 assert.ok(r.steps.length>=4 && /非实时|无实时/.test(r.statusNote));
 assert.ok(assessHousing(r).grade!=='A');
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const guides=readFileSync(new URL('../src/data/jiangsuGuides.ts',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("fragments[2]==='jiangsu'"),'Jiangsu shared guide route missing');
assert.ok(routes.includes("getJiangsuGuide("),'Jiangsu guide resolve missing');
assert.ok(routes.includes('政策和人才安居详细申请指南'),'City hub index of all policy and housing guides missing');
assert.ok(detail.includes("jiangsuGuideUrl('policy'"),'Policy detail deep link missing');
assert.ok(detail.includes("jiangsuGuideUrl('housing'"),'Housing detail deep link missing');
assert.ok(guides.includes('qualityLevel:isPast?\'C\':\'B\''),'New Jiangsu guides must not auto-certify A');
assert.equal(JIANGSU_HOUSING_RECORDS.length,14);
assert.equal(new Set(JIANGSU_HOUSING_RECORDS.map(x=>x.city)).size,13);
console.log('Jiangsu V5.1 checks passed: '+cities.length+' cities, '+JIANGSU_POLICY_RECORDS.length+' policy records, '+JIANGSU_HOUSING_RECORDS.length+' housing programs');
