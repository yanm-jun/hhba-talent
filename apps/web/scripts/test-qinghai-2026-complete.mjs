import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QINGHAI_SHARED_POLICY_RECORDS} from '../src/data/qinghaiSharedPolicies.ts';
import {QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS} from '../src/data/qinghaiVerifiedHousing.ts';
import {QINGHAI_POLICY_RECORDS,QINGHAI_POLICY_RESEARCH_RECORDS} from '../src/data/qinghaiPolicyRecords.ts';
import {QINGHAI_HOUSING_RECORDS,QINGHAI_HOUSING_RESEARCH_RECORDS} from '../src/data/qinghaiHousingRecords.ts';
import {QINGHAI_8_REGIONS,qinghaiGuideUrl,buildQinghaiGuide} from '../src/data/qinghaiGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {findTalentCity,findTalentProvince,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
assert.equal(QINGHAI_8_REGIONS.length,8);
assert.equal(new Set(QINGHAI_8_REGIONS).size,8);
assert.ok(QINGHAI_POLICY_RESEARCH_RECORDS.length>=17);
assert.ok(QINGHAI_HOUSING_RESEARCH_RECORDS.length>=7);
const ids=[...QINGHAI_POLICY_RESEARCH_RECORDS,...QINGHAI_HOUSING_RESEARCH_RECORDS].map(p=>p.id);
assert.equal(new Set(ids).size,ids.length,'all entries unique');
for(const city of QINGHAI_8_REGIONS){
 assert.equal(findTalentCity(city)?.province,'青海省',city);
 assert.ok(queryTalentCities('', '青海省').some(p=>p.name===city),city);
 assert.ok(QINGHAI_POLICY_RESEARCH_RECORDS.some(p=>p.city===city),'city should not disappear from the policy search: '+city);
 const snapshot=getTalentCitySnapshot(city);
 assert.equal(snapshot.policyCount,QINGHAI_POLICY_RECORDS.filter(p=>p.city===city).length);
 assert.equal(snapshot.housingCount,QINGHAI_HOUSING_RECORDS.filter(p=>p.city===city).length);
 assert.ok(!ACCEPTED_TALENT_CITIES.includes(city),'B-grade cities are not city certified');
}
assert.equal(findTalentProvince('青海')?.official,'青海省');
assert.notEqual(findTalentCity('海南州')?.province,'海南省');
for(const p of QINGHAI_POLICY_RESEARCH_RECORDS){
 assert.ok(p.sourceUrl.startsWith('https://'),p.id);
 assert.ok(p.published.match(/^202[0-6]-\d\d-\d\d$/),p.id);
 assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,p.id);
 assert.ok(p.eligibility.length>40&&p.reviewNote,p.id);
 assert.ok(buildQinghaiGuide('policy',p.id)?.faq.length>=8,p.id);
 assert.ok(qinghaiGuideUrl('policy',p.id).includes('qinghai'),p.id);
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,QINGHAI_POLICY_RECORDS.some(x=>x.id===p.id)?1:0,p.id);
 const grade=assessPolicy(p,'2026-11-01').grade;
 assert.ok(grade==='B'||grade==='C'||grade==='D','not falsely A-certified: '+p.id);
}
for(const h of QINGHAI_HOUSING_RESEARCH_RECORDS){
 assert.ok(h.sourceUrl.startsWith('https://'),h.id);
 assert.ok(h.steps.length>=4,h.id);
 assert.ok(/待核实|未公布|未核验|未公开/.test(h.statusNote),h.id);
 assert.ok(buildQinghaiGuide('housing',h.id)?.faq.length>=8,h.id);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,QINGHAI_HOUSING_RECORDS.some(x=>x.id===h.id)?1:0,h.id);
 assert.notEqual(assessHousing(h,'2026-11-01').grade,'A',h.id);
}
assert.equal(assessPolicy(QINGHAI_POLICY_RESEARCH_RECORDS.find(p=>p.id==='qh-tongde-flexsocial-2026'),'2026-11-28').grade,'C');
assert.equal(assessPolicy(QINGHAI_POLICY_RESEARCH_RECORDS.find(p=>p.id==='qh-golok-culture-2026'),'2026-11-01').grade,'C');
const original=QINGHAI_POLICY_RESEARCH_RECORDS.filter(p=>p.city==='海南州');
assert.ok(original.every(p=>p.city==='海南州')&&findTalentCity('海南藏族自治州')?.province==='青海省','no Hainan Province conflation');
assert.ok(QINGHAI_HOUSING_RESEARCH_RECORDS.find(h=>h.city==='海西')?.units.includes('不是2026实时空房'),'670 historical units not vacancies');
const r=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(r.includes("fragments[2]==='qinghai'")&&r.includes("QINGHAI_8_REGIONS.some"));

// Province-wide policies are each single canonical entries, not duplicated 8 times.
assert.ok(QINGHAI_SHARED_POLICY_RECORDS.length>=11);
assert.ok(QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS.length>=9);
assert.equal(new Set(QINGHAI_SHARED_POLICY_RECORDS.map(p=>p.id)).size,QINGHAI_SHARED_POLICY_RECORDS.length);
assert.equal(new Set(QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS.map(h=>h.id)).size,QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS.length);
for(const p of QINGHAI_SHARED_POLICY_RECORDS){
 assert.equal(p.city,'青海省',p.id);
 assert.ok(new URL(p.sourceUrl).hostname.endsWith('.gov.cn'),p.id);
 assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,p.id);
 assert.ok(p.reviewNote.includes('办理入口待核实'),p.id);
 assert.ok(buildQinghaiGuide('policy',p.id)?.faq.length>=8,p.id);
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1,p.id);
 assert.notEqual(assessPolicy(p,'2026-11-01').grade,'A');
}
for(const h of QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS){
 assert.ok(h.city==='青海省'||QINGHAI_8_REGIONS.some(c=>c===h.city),h.id);
 assert.ok(new URL(h.sourceUrl).hostname.endsWith('.gov.cn'),h.id);
 assert.ok(h.steps.length>=4&&/空房|房源|非实时/.test(h.statusNote),h.id);
 assert.ok(/申报入口待核实/.test(h.statusNote),h.id);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1,h.id);
 assert.ok(buildQinghaiGuide('housing',h.id)?.faq.length>=8,h.id);
}
assert.equal(QINGHAI_SHARED_POLICY_RECORDS.find(p=>p.id==='qh-province-direct-settlement-2026')?.published,'2025-11-14');
assert.ok(QINGHAI_SHARED_POLICY_RECORDS.find(p=>p.id==='qh-province-direct-settlement-2026')?.summary.includes('省直'));
assert.ok(!QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS.some(h=>h.id==='qh-hainanzhou-guide-rent-2026'),'expired 2021 Guide County rules excluded');
assert.equal(assessHousing(QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS.find(h=>h.id==='qh-haixi-geermu-11th-publicrent-2026'),'2026-11-01').grade,'C');
const ui=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(ui.includes('qinghaiSharedPolicies.map')&&ui.includes('qinghaiSharedHousing.map'),'shared cards on each Qinghai region');
assert.ok(ui.includes("recordCity==='青海省'")&&ui.includes('qhPolicyMatch')&&ui.includes('qhHousingMatch'),'national search reaches province shared programs');
console.log('QINGHAI_2026_EXPANSION_OK: 11 provincial policies, 9 new housing records (2 shared), official sources and no expired Guide record');
console.log('QINGHAI_2026_POLICY_INTEGRATION_OK: '+QINGHAI_POLICY_RESEARCH_RECORDS.length+' policy leads, '+QINGHAI_HOUSING_RESEARCH_RECORDS.length+' housing leads, 8 prefectures, dates, guides, search integration');
