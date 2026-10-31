import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
assert.ok(original.every(p=>!p.district?.includes('海南省')),'no Hainan Province conflation');
assert.ok(QINGHAI_HOUSING_RESEARCH_RECORDS.find(h=>h.city==='海西')?.units.includes('不是2026实时空房'),'670 historical units not vacancies');
const r=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(r.includes("fragments[2]==='qinghai'")&&r.includes("QINGHAI_8_REGIONS.some"));
console.log('QINGHAI_2026_POLICY_INTEGRATION_OK: '+QINGHAI_POLICY_RESEARCH_RECORDS.length+' policy leads, '+QINGHAI_HOUSING_RESEARCH_RECORDS.length+' housing leads, 8 prefectures, dates, guides, search integration');
