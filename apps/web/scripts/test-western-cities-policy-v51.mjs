import assert from 'node:assert/strict';
import {WESTERN_CITIES_POLICY_RECORDS_20261031 as policies} from '../src/data/westernCitiesPolicyRecords20261031.ts';
import {WESTERN_CITIES_HOUSING_RECORDS_20261031 as housing} from '../src/data/westernCitiesHousingRecords20261031.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
assert.equal(policies.length,6);
assert.equal(housing.length,5);
for(const city of ['贵阳','银川','西安'])assert.equal(findTalentCity(city)?.name,city);
for(const p of policies){
 assert.equal(talentSourceKind(p.sourceUrl),'government','must use a first-party government source: '+p.id);
 assert.ok(p.eligibility.length>=45&&p.applicationSteps.length>=4&&p.materials.length>=3);
 assert.ok(p.reviewNote&&p.reviewedAt);
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
}
for(const p of policies.filter(x=>x.city!=='西安'))assert.equal(assessPolicy(p,'2026-10-31').grade,'B');
const xian=policies.find(x=>x.city==='西安');
assert.equal(xian.temporal,'past-window');
assert.equal(xian.deadline,'2026-09-30');
assert.equal(assessPolicy(xian,'2026-10-31').grade,'C','expired Xi’an 2026 call must not appear open');
for(const h of housing){
 assert.equal(talentSourceKind(h.sourceUrl),'government');
 assert.ok(h.steps.length>=4&&h.eligibility.length>=50);
 assert.ok(h.statusNote);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.equal(assessHousing(h,'2026-10-31').grade,'B');
}
const guiProject=housing.find(x=>x.id==='gz-guiyang-zhuchao-luchongguan-202610');
assert.equal(guiProject.kind,'project');
assert.ok(guiProject.units.includes('首次开放')&&guiProject.units.includes('不代表'));
assert.ok(guiProject.statusNote.includes('当前空置情况未核验'));
const yin=housing.find(x=>x.id==='nx-yinchuan-youth-apartment-program-2025');
assert.ok(yin.statusNote.includes('轮候制')&&yin.statusNote.includes('空房'));
const xh=housing.find(x=>x.city==='西安');
assert.ok(xh.units.includes('28户')&&xh.units.includes('不是可出租房源套数'));
console.log('PASS 3 cities: 6 official policy records + 5 housing program/project records; Xi’an deadline and vacancies remain explicit');
