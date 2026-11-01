import assert from 'node:assert/strict';
import {TALENT_2026_POLICY_GAP_RECORDS} from '../src/data/talent2026PolicyGapRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,talentSourceKind} from '../src/data/talentQuality.ts';
// 2026 municipal source records are not a statement that all city benefits are current.
// This regression is a structural data + provenance guard, not online source verification.
const targets=["攀枝花","泸州","绵阳","遂宁","内江","宜宾","广安","巴中","资阳","甘孜","凉山"];
assert.equal(targets.length,11);
const expected=new Set(targets);
const sichuan=TALENT_2026_POLICY_GAP_RECORDS.filter(r=>expected.has(r.city));
for(const city of targets){
  const rows=sichuan.filter(r=>r.city===city);
  assert.ok(rows.length>=1,city+' is missing direct 2026 policy evidence');
  assert.ok(TALENT_CITY_INDEX.some(x=>x.name===city&&x.province==='四川省'),city+' missing city directory');
  for(const row of rows){
    assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===row.id).length,1,row.id+' missing or duplicated from aggregate');
    assert.equal(talentSourceKind(row.sourceUrl),'government',row.id+' has no official source');
    assert.ok(row.published.startsWith('2026-')||row.city==='广安',row.id+' is not 2026 published');
    assert.ok(row.materials?.length>=4&&row.applicationSteps?.length>=5,row.id+' lacks detailed applicant guide');
    assert.ok(row.reviewNote?.includes('办理入口待核实'),row.id+' cannot assume a verified online application');
    assert.notEqual(assessPolicy(row,'2026-11-01').grade,'A',row.id+' not individually A-certified');
    assert.ok(row.scope&&row.targetGroup&&row.eligibility&&row.sourceName,row.id+' lacks scope or eligibility');
  }
}
const historical=new Set(['攀枝花','泸州','宜宾','巴中','甘孜','凉山']);
for(const city of historical){
  assert.ok(sichuan.filter(x=>x.city===city).some(x=>x.temporal==='past-window'),city+' must distinguish expired recruitment from current benefits');
}
assert.equal(sichuan.find(x=>x.city==='资阳')?.district?.includes('安岳县'),true,'Ziyang county subsidy must not imply full-city benefit');
assert.ok(sichuan.some(x=>x.city==='绵阳'&&x.eligibility.includes('快递员')),'Mianyang occupation-limited housing voucher must stay scoped');
assert.equal(new Set(sichuan.map(x=>x.id)).size,sichuan.length,'duplicate new policy ID');
for(const city of targets)assert.ok(TALENT_POLICY_RECORDS.some(x=>x.city===city),'Sichuan zero policy region regressed: '+city);
console.log('SICHUAN_2026_11REGIONS_POLICY_RECORDS_OK',JSON.stringify({regions:targets.length,records:sichuan.length,notCertifiedA:true,sourceNote:'Live application windows are NOT verified by this test'}));
