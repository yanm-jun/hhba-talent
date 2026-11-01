import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NINGXIA_5_CITIES,NINGXIA_POLICY_RECORDS} from '../src/data/ningxiaPolicyRecords.ts';
import {NINGXIA_HOUSING_RECORDS} from '../src/data/ningxiaHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {ningxiaGuideUrl,buildNingxiaGuide} from '../src/data/ningxiaGuides.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const cities=['银川','石嘴山','吴忠','固原','中卫'];
assert.deepEqual([...NINGXIA_5_CITIES],cities);
assert.equal(queryTalentCities('','宁夏回族自治区').length,5);
assert.equal(NINGXIA_POLICY_RECORDS.length,40,'25 city-specific and 15 cross-indexed provincial items');
assert.equal(NINGXIA_HOUSING_RECORDS.length,26,'independently documented housing evidence');
assert.equal(new Set(NINGXIA_POLICY_RECORDS.map(r=>r.id)).size,40);
assert.equal(new Set(NINGXIA_HOUSING_RECORDS.map(r=>r.id)).size,26);
const province=NINGXIA_POLICY_RECORDS.filter(r=>r.title.startsWith('【自治区统一】'));
assert.equal(province.length,15,'3 actual provincial programs indexed in 5 cities must not inflate scheme count');
assert.equal(new Set(province.map(r=>r.title.split(' · ')[0])).size,3,'only 3 truly independent region-wide policies');
for(const city of cities){
 assert.ok(findTalentCity(city),'missing city in national registry: '+city);
 const policies=NINGXIA_POLICY_RECORDS.filter(r=>r.city===city);
 const houses=NINGXIA_HOUSING_RECORDS.filter(r=>r.city===city);
 assert.ok(policies.length>=7,city+' cannot be left with one/two policies');
 assert.ok(houses.length>=4,city+' cannot be left with one/two housing references');
 assert.equal(policies.filter(r=>r.title.startsWith('【自治区统一】')).length,3,city+' provincial index count');
 assert.ok(policies.filter(r=>!r.title.startsWith('【自治区统一】')).length>=4,city+' missing municipal-specific schemes');
 assert.equal(getTalentCitySnapshot(city).policyCount,policies.length,city+' policy not connected to nationwide index');
 assert.equal(getTalentCitySnapshot(city).housingCount,houses.length,city+' housing not connected to nationwide index');
 for(const r of policies){
  assert.ok(r.title&&r.summary.length>=60&&r.eligibility.length>=80,r.id+' incomplete source and qualification');
  assert.equal(talentSourceKind(r.sourceUrl),'government',r.id+' must use governmental first-party URL');
  assert.ok(r.materials.length>=4&&r.applicationSteps.length>=5,r.id+' has incomplete guide');
  assert.ok(r.targetGroup&&r.payoutTo&&r.reviewNote.includes('办理入口待核实'),r.id);
  assert.equal(TALENT_POLICY_RECORDS.filter(p=>p.id===r.id).length,1,r.id+' lost from nationwide search');
  const guide=buildNingxiaGuide('policy',r.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5&&guide.branches.eligible&&guide.branches.other&&guide.branches.verify,r.id);
  assert.ok(ningxiaGuideUrl('policy',r.id).includes(r.id),r.id);
 }
 for(const r of houses){
  assert.ok(r.title&&r.address&&r.eligibility.length>=80,r.id+' housing incomplete');
  assert.equal(talentSourceKind(r.sourceUrl),'government',r.id+' housing must have primary government source');
  assert.ok(r.steps.length>=5&&r.statusNote.includes('非实时空房')&&r.statusNote.includes('申报入口待核实'),r.id);
  assert.equal(TALENT_HOUSING_RECORDS.filter(h=>h.id===r.id).length,1,r.id+' housing missing or duplicate');
  const guide=buildNingxiaGuide('housing',r.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5&&guide.branches.verify,r.id);
  assert.ok(ningxiaGuideUrl('housing',r.id).includes(r.id));
 }
}
assert.equal(NINGXIA_HOUSING_RECORDS.filter(r=>r.city==='石嘴山'&&r.kind==='project').length,4,'four actual occupied estates in 2026 government rent reduction list');
assert.ok(NINGXIA_POLICY_RECORDS.some(r=>r.id==='nx-yinchuan-dev-settle'&&r.headlineAmount.includes('500,000')));
assert.ok(NINGXIA_POLICY_RECORDS.some(r=>r.id==='nx-wuzhong-doctoral-entry'&&r.headlineAmount.includes('300,000')));
assert.ok(NINGXIA_POLICY_RECORDS.some(r=>r.id==='nx-guyuan-home-2026'&&r.headlineAmount.includes('20,000')));
assert.ok(NINGXIA_POLICY_RECORDS.some(r=>r.id==='nx-shizuishan-enterprise-grant'&&r.payoutTo==='用人单位'));
assert.equal(buildNingxiaGuide('housing','nx-zhongwei-housing-rent2024')?.qualityLevel,'C','expired May 2026 regulation must be C');
assert.equal(buildNingxiaGuide('housing','nx-zhongwei-housing-sale-2026-draft')?.qualityLevel,'C','consultation draft must not be action grade');
assert.equal(NINGXIA_POLICY_RECORDS.find(r=>r.id==='nx-yinchuan-nx2026-grad500')?.headlineAmount,'¥500/月');
assert.ok(NINGXIA_POLICY_RECORDS.filter(r=>r.id.endsWith('nx2026-grad500')).every(r=>r.deadline==='2026-12-31'));
const page=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(page.includes('宁夏五地市贵阳V6标准')&&page.includes("fragments[2]==='ningxia'"));
assert.ok(detail.includes('policy-guide-preview/ningxia')&&list.includes('policy-guide-preview/ningxia'));
console.log('NINGXIA_2026_V6_OK: 5 cities, 40 indexed policies (25 municipal + 15 regional locators for only 3 programs), 26 housing evidence records, 4 occupied estates, expired/draft downgrades and all national routing verified.');
