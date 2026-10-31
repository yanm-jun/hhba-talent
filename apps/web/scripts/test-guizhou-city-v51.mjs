import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIZHOU_9_REGIONS,buildGuizhouGuide,guizhouGuideUrl} from '../src/data/guizhouGuides.ts';
import {GUIZHOU_POLICY_RECORDS} from '../src/data/guizhouPolicyRecords.ts';
import {GUIZHOU_HOUSING_RECORDS} from '../src/data/guizhouHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
assert.equal(GUIZHOU_9_REGIONS.length,9);
assert.equal(new Set(GUIZHOU_9_REGIONS).size,9);
assert.equal(queryTalentCities('','贵州省').length,9);
assert.equal(GUIZHOU_POLICY_RECORDS.length,17);
assert.equal(GUIZHOU_HOUSING_RECORDS.length,5);
for(const city of GUIZHOU_9_REGIONS){
 assert.equal(findTalentCity(city)?.name,city);
 assert.ok(GUIZHOU_POLICY_RECORDS.some(p=>p.city===city),'city missing distinct policy: '+city);
 assert.ok(!ACCEPTED_TALENT_CITIES.includes(city),'city cannot be fully certified');
}
for(const p of GUIZHOU_POLICY_RECORDS){
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
 assert.ok(p.eligibility.length>=45&&p.applicationSteps.length>=4&&p.materials.length>=3);
 assert.ok(p.sourceUrl.startsWith('https://')&&p.reviewNote);
 assert.ok(p.temporal==='policy'||p.temporal==='past-window'||p.temporal==='historical');
 assert.ok(assessPolicy(p,'2026-10-31').grade!=='A');
 const guide=buildGuizhouGuide('policy',p.id);
 assert.ok(guide?.city===p.city&&guide?.steps.length>=4&&guide.faq.length>=6);
 assert.ok(Object.keys(guide.branches).length>=3);
 assert.equal(guide.sources[0][1],p.sourceUrl);
 assert.equal(guide.qualityLevel,p.temporal==='policy'?'B':'C');
 assert.ok(guizhouGuideUrl('policy',p.id).includes(p.id));
}
for(const h of GUIZHOU_HOUSING_RECORDS){
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.ok(h.statusNote.includes('申报入口待核实')&&h.steps.length>=4&&h.eligibility.length>50);
 assert.ok(!h.applyUrl,'unverified direct portal must not be invented');
 assert.ok(h.units.includes('不是')||h.units.includes('不代表')||h.units.includes('非'));
 const g=buildGuizhouGuide('housing',h.id);
 assert.ok(g?.qualityLevel==='B'&&g.faq.length>=6&&g.steps.length>=4);
 assert.equal(assessHousing(h,'2026-10-31').grade,'B');
}
assert.equal(buildGuizhouGuide('policy','fake-id'),null);
assert.equal(buildGuizhouGuide('housing','fake-id'),null);
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(route.includes("fragments[2]==='guizhou'")&&route.includes("GUIZHOU_9_REGIONS.some"));
assert.ok(route.includes("match.name==='贵阳'")&&route.includes("policies.filter(p=>p.category===group)"),'Guiyang city page must render categorized 2026 policy cards');
console.log('HHBA_GUIZHOU_9_REGIONS_V51_CHECKS_OK');
