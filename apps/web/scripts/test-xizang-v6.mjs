import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {XIZANG_7_REGIONS,XIZANG_POLICY_RECORDS} from '../src/data/xizangPolicyRecords.ts';
import {XIZANG_HOUSING_RECORDS} from '../src/data/xizangHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {buildXizangGuide,xizangGuideUrl} from '../src/data/xizangGuides.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
assert.equal(XIZANG_7_REGIONS.length,7);
assert.equal(new Set(XIZANG_7_REGIONS).size,7);
assert.equal(XIZANG_POLICY_RECORDS.length,28);
assert.equal(new Set(XIZANG_POLICY_RECORDS.map(p=>p.id)).size,28);
assert.equal(XIZANG_HOUSING_RECORDS.length,2);
assert.equal(queryTalentCities('','西藏自治区').length,7);
for(const city of XIZANG_7_REGIONS){
 assert.ok(findTalentCity(city),city);
 const ps=XIZANG_POLICY_RECORDS.filter(p=>p.city===city);
 assert.equal(ps.length,4,'exactly three provincial pointers and one unique local record per city');
 assert.equal(getTalentCitySnapshot(city).policyCount,4);
 for(const p of ps){
  assert.ok(p.sourceUrl.startsWith('https://'),p.id);
  assert.ok(p.eligibility.length>=80&&p.summary.length>=30,p.id);
  assert.ok(p.materials?.length>=4&&p.applicationSteps?.length>=5,p.id);
  assert.ok(p.payoutTo&&p.targetGroup&&p.reviewNote,p.id);
  assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1,p.id);
  const guide=buildXizangGuide('policy',p.id);
  assert.ok(guide&&guide.faq.length>=10&&guide.steps.length>=5,p.id);
  assert.ok(guide?.branches.eligible&&guide.branches.other&&guide.branches.verify,p.id);
  assert.ok(xizangGuideUrl('policy',p.id).includes(p.id));
 }
 assert.ok(ps.filter(p=>p.title.includes('【自治区统一】')).length===2);
}
for(const h of XIZANG_HOUSING_RECORDS){
 assert.ok(h.statusNote.includes('申报入口待核实')&&/空房/.test(h.statusNote),h.id);
 assert.ok(h.steps.length>=5&&h.sourceUrl.startsWith('https://'),h.id);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.ok(buildXizangGuide('housing',h.id)?.faq.length>=10);
 assert.ok(xizangGuideUrl('housing',h.id).includes(h.id));
}
assert.equal(getTalentCitySnapshot('拉萨').housingCount,1);
assert.equal(getTalentCitySnapshot('山南').housingCount,1);
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("fragments[2]==='xizang'")&&routes.includes("xizangGuideUrl('policy',p.id)"));
assert.ok(routes.includes("policies.filter(p=>p.category===group)"));
assert.ok(!XIZANG_POLICY_RECORDS.some(p=>p.applicationSteps?.some(x=>x.includes('undefined'))));
console.log('XIZANG_V6_CATALOG_OK: seven regions, 28 policy/service records, two housing frameworks, guide routing and coverage');
