import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HAINAN_POLICY_RECORDS} from '../src/data/hainanPolicyRecords.ts';
import {HAINAN_HOUSING_RECORDS} from '../src/data/hainanHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,talentSourceKind,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
import {buildHainanGuide,hainanGuideUrl,HAINAN_TALENT_CITIES} from '../src/data/hainanGuides.ts';
const cs=['海口','三亚','三沙','儋州'];
assert.deepEqual([...HAINAN_TALENT_CITIES],cs);
assert.equal(queryTalentCities('','海南省').length,4);
assert.equal(HAINAN_POLICY_RECORDS.length,5);
assert.equal(HAINAN_HOUSING_RECORDS.length,4);
for(const city of cs){
 assert.equal(findTalentCity(city)?.name,city);
 const pp=HAINAN_POLICY_RECORDS.filter(p=>p.city===city);
 const hh=HAINAN_HOUSING_RECORDS.filter(h=>h.city===city);
 assert.ok(pp.length>=1,'missing city policy: '+city);
 assert.ok(hh.length>=1,'missing city housing: '+city);
 for(const p of pp){
   assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
   assert.equal(talentSourceKind(p.sourceUrl),'government');
   assert.equal(assessPolicy(p,'2026-10-31').grade,'B','not a verified A guide');
   assert.ok(p.eligibility.length>45&&p.materials.length>=3&&p.applicationSteps.length>=4);
   const guide=buildHainanGuide('policy',p.id);
   assert.ok(guide&&guide.city===city&&guide.qualityLevel==='B');
   assert.ok(guide.steps.length>=4&&Object.keys(guide.branches).length>=3&&guide.faq.length>=6);
   assert.equal(guide.sources[0][1],p.sourceUrl);
   assert.equal(hainanGuideUrl('policy',p.id).includes(encodeURIComponent(p.id)),true);
 }
 for(const h of hh){
  assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
  assert.equal(talentSourceKind(h.sourceUrl),'government');
  assert.equal(assessHousing(h,'2026-10-31').grade,'B');
  assert.equal(h.kind,'program','no Sansha invented apartment');
  assert.ok(h.steps.length>=4&&h.eligibility.length>=50);
  const guide=buildHainanGuide('housing',h.id);
  assert.ok(guide&&guide.qualityLevel==='B'&&guide.steps.length>=4);
  assert.ok(guide.faq.some(([q])=>q.includes('空房')));
 }
}
const sansha=HAINAN_POLICY_RECORDS.find(p=>p.city==='三沙');
const sanshaHome=HAINAN_HOUSING_RECORDS.find(h=>h.city==='三沙');
assert.ok(sansha?.benefit.includes('没有可核实的三沙普惠现金补贴金额'));
assert.ok(sansha?.summary.includes('第44条'));
assert.ok(!sansha?.applicationUrl,'do not invent Sansha application portal');
assert.ok(sanshaHome?.statusNote.includes('无实时空房'));
assert.ok(sanshaHome?.units.includes('未核验'));
assert.equal(sanshaHome?.kind,'program');
assert.ok(!ACCEPTED_TALENT_CITIES.includes('三沙'));
const sanya=HAINAN_POLICY_RECORDS.find(p=>p.id==='hi-sanya-2026-housing-apply-faq');
assert.equal(sanya?.published,'2026-09-04');
assert.ok(sanya?.reviewNote.includes('不')&&sanya?.applicationUrl==='https://wssp.hainan.gov.cn/');
assert.ok(!buildHainanGuide('policy','random-not-real'),'nonexistent guide must not render fake data');
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(route.includes("fragments[2]==='hainan'")&&route.includes('buildHainanGuide('));
assert.ok(route.includes("海南省四城人才政策及住房V5.1指南")&&route.includes('hainanGuideUrl('));
assert.ok(list.includes("policy-guide-preview/hainan/policy/"));
assert.ok(detail.includes("policy-guide-preview/hainan/"));
console.log('HHBA_HAINAN_4_CITY_V51_SOURCE_BACKED_B_GRADE_GUIDES_OK');
