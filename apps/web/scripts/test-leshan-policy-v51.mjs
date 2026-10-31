import assert from 'node:assert/strict';
import {LESHAN_POLICY_RECORDS} from '../src/data/leshanPolicyRecords.ts';
import {LESHAN_HOUSING_RECORDS} from '../src/data/leshanHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
assert.equal(findTalentCity('乐山')?.name,'乐山');
assert.equal(LESHAN_POLICY_RECORDS.length,2);
assert.equal(LESHAN_HOUSING_RECORDS.length,1);
for(const p of LESHAN_POLICY_RECORDS){
 assert.equal(p.city,'乐山');
 assert.equal(p.scope,'特定区域');
 assert.ok(p.district.includes('高新区'));
 assert.equal(talentSourceKind(p.sourceUrl),'government');
 assert.ok(p.sourceUrl.startsWith('https://www.leshan.gov.cn/'));
 assert.equal(assessPolicy(p,'2026-10-31').grade,'B');
 assert.ok(p.materials.length>=3&&p.applicationSteps.length>=4);
 assert.ok(p.reviewNote.includes('办理入口待核实'));
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
}
const h=LESHAN_HOUSING_RECORDS[0];
assert.equal(h.city,'乐山');
assert.equal(h.kind,'program');
assert.equal(assessHousing(h,'2026-10-31').grade,'B');
assert.ok(h.statusNote.includes('申报入口待核实')&&h.statusNote.includes('非实时空房'));
assert.ok(h.units.includes('不公开具体项目'));
assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
assert.ok(LESHAN_POLICY_RECORDS.some(x=>x.benefit.includes('不超过2年')));
assert.ok(LESHAN_POLICY_RECORDS.some(x=>x.benefit.includes('合租'))===false); // rent restriction is in eligibility
console.log('PASS Leshan official High-Tech Zone 2 policies + housing subsidy PROGRAM; no fake vacancies');
