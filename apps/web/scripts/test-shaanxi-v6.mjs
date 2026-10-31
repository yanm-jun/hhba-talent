import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHAANXI_10_CITIES,SHAANXI_POLICY_RECORDS} from '../src/data/shaanxiPolicyRecords.ts';
import {SHAANXI_HOUSING_RECORDS} from '../src/data/shaanxiHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {shaanxiGuideUrl,buildShaanxiGuide} from '../src/data/shaanxiGuides.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const expectedCities=['西安','铜川','宝鸡','咸阳','渭南','延安','榆林','汉中','安康','商洛'];
assert.deepEqual([...SHAANXI_10_CITIES],expectedCities);
assert.equal(queryTalentCities('','陕西省').length,10,'no prefecture may be skipped');
assert.equal(SHAANXI_POLICY_RECORDS.length,24,'14 city records plus 10 explicitly provincial pointers');
assert.equal(SHAANXI_HOUSING_RECORDS.length,30,'all 30 distinct housing research records must survive');
assert.equal(new Set(SHAANXI_POLICY_RECORDS.map(x=>x.id)).size,SHAANXI_POLICY_RECORDS.length);
assert.equal(new Set(SHAANXI_HOUSING_RECORDS.map(x=>x.id)).size,SHAANXI_HOUSING_RECORDS.length);
for(const city of SHAANXI_10_CITIES){
 assert.ok(findTalentCity(city),city);
 const p=SHAANXI_POLICY_RECORDS.filter(x=>x.city===city);
 const h=SHAANXI_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.ok(p.length>=2,city+' needs province policy + independently sourced local policy');
 assert.ok(h.length>=1,city+' cannot have zero housing without an explicitly logged evidence gap');
 const snapshot=getTalentCitySnapshot(city);
 assert.equal(snapshot.policyCount,p.length,city+' policy index not connected');
 assert.equal(snapshot.housingCount,h.length,city+' housing index not connected');
 assert.equal(p.filter(x=>x.title.startsWith('【全省统一】')).length,1,city+' must not claim multiple provincial grants');
 for(const r of p){
  assert.ok(r.title&&r.summary?.length>=35&&r.eligibility?.length>=75,r.id);
  assert.equal(talentSourceKind(r.sourceUrl),'government',r.id+' has non-government source');
  assert.ok(r.reviewNote?.includes('办理入口待核实'),r.id);
  assert.ok(r.materials?.length>=4&&r.applicationSteps?.length>=5,r.id);
  assert.ok(r.targetGroup&&r.payoutTo,r.id);
  assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===r.id).length,1,r.id);
  const guide=buildShaanxiGuide('policy',r.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5,r.id);
  assert.ok(guide?.branches.eligible&&guide.branches.other&&guide.branches.verify,r.id);
  assert.ok(shaanxiGuideUrl('policy',r.id).includes(r.id));
 }
 for(const r of h){
  assert.ok(r.title&&r.address&&r.eligibility?.length>=50,r.id);
  assert.equal(talentSourceKind(r.sourceUrl),'government',r.id+' housing primary source missing');
  assert.ok(r.steps.length>=5&&r.statusNote.includes('申报入口待核实'),r.id);
  assert.ok(/空房|房源/.test(r.statusNote),r.id+' lacks live vacancy caveat');
  assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===r.id).length,1,r.id);
  const guide=buildShaanxiGuide('housing',r.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5,r.id);
  assert.ok(shaanxiGuideUrl('housing',r.id).includes(r.id));
 }
}
assert.equal(SHAANXI_HOUSING_RECORDS.filter(x=>x.city==='西安').length,10);
assert.ok(SHAANXI_HOUSING_RECORDS.some(x=>x.id==='sn-baoji-taichuang-202610'&&x.rent.includes('600元/月')));
assert.ok(SHAANXI_HOUSING_RECORDS.some(x=>x.city==='榆林'&&x.title.includes('采购')&&x.kind==='program'));
assert.ok(SHAANXI_HOUSING_RECORDS.filter(x=>x.city==='渭南').every(x=>x.kind==='program'),'government procurement is not a live rental project');
assert.ok(SHAANXI_HOUSING_RECORDS.some(x=>x.city==='商洛'&&x.housingCategory==='其他住房'));
assert.ok(SHAANXI_HOUSING_RECORDS.some(x=>x.city==='汉中'&&x.title.includes('城固')));
assert.ok(SHAANXI_HOUSING_RECORDS.some(x=>x.city==='延安'&&x.title.includes('甘泉')));
const page=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(page.includes('陕西省十地市贵阳V6标准')&&page.includes("fragments[2]==='shaanxi'"),'Shaanxi CityHub and guide routes required');
assert.ok(detail.includes("policy-guide-preview/shaanxi")&&list.includes("policy-guide-preview/shaanxi"),'national policy list and detail must link V6 guide');
console.log('SHAANXI_V6_ALL_10_CITIES_OK: '+SHAANXI_POLICY_RECORDS.length+' policies, '+SHAANXI_HOUSING_RECORDS.length+' housing records; all city pages/guides/official sources/audit conditions.');
