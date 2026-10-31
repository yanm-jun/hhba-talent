import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GANSU_14_REGIONS,GANSU_POLICY_RECORDS} from '../src/data/gansuPolicyRecords.ts';
import {GANSU_HOUSING_RECORDS} from '../src/data/gansuHousingRecords.ts';
import {GANSU_EXPANDED_POLICY_RECORDS} from '../src/data/gansuExpandedPolicyRecords.ts';
import {GANSU_EXPANDED_HOUSING_RECORDS} from '../src/data/gansuExpandedHousingRecords.ts';
import {GANSU_HOUSING_BATCH_RECORDS} from '../src/data/gansuHousingBatchRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {buildGansuGuide,gansuGuideUrl} from '../src/data/gansuGuides.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const allP=[...GANSU_POLICY_RECORDS,...GANSU_EXPANDED_POLICY_RECORDS];
const allH=[...GANSU_HOUSING_RECORDS,...GANSU_EXPANDED_HOUSING_RECORDS,...GANSU_HOUSING_BATCH_RECORDS];
assert.equal(GANSU_14_REGIONS.length,14);
assert.equal(GANSU_POLICY_RECORDS.length,21);
assert.equal(GANSU_EXPANDED_POLICY_RECORDS.length,58);
assert.equal(GANSU_HOUSING_RECORDS.length,26);
assert.equal(GANSU_EXPANDED_HOUSING_RECORDS.length,9);
assert.equal(GANSU_HOUSING_BATCH_RECORDS.length,3);
assert.equal(allP.length,79);
assert.equal(allH.length,38);
assert.equal(new Set(allP.map(p=>p.id)).size,allP.length);
assert.equal(new Set(allH.map(h=>h.id)).size,allH.length);
const provinceRecords=GANSU_EXPANDED_POLICY_RECORDS.filter(p=>p.title.startsWith('【甘肃全省统一】'));
assert.equal(provinceRecords.length,42,'14 geographic guide entries for 3 actual provincial schemes; never claim 42 distinct schemes');
assert.equal(new Set(provinceRecords.map(p=>p.title.replace(/ · .+属地办理核验$/,''))).size,3,'exactly three province-wide programs');
for(const city of GANSU_14_REGIONS){
 const p=allP.filter(x=>x.city===city),h=allH.filter(x=>x.city===city);
 assert.ok(p.length>=4,city+' still has only 1–2 policies');
 assert.ok(h.length>=1,city+' housing evidence entirely missing');
 assert.equal(p.filter(x=>x.title.startsWith('【甘肃全省统一】')).length,3,city+' province-wide schemes improperly counted as local add-ons');
 assert.equal(getTalentCitySnapshot(city).policyCount,p.length,city+' policies not shown in nationwide search');
 assert.equal(getTalentCitySnapshot(city).housingCount,h.length,city+' housing not shown in nationwide search');
 for(const rec of p){
  assert.ok(talentSourceKind(rec.sourceUrl)==='government','not government-hosted source '+rec.id);
  assert.ok(rec.summary.length>=60&&rec.eligibility.length>=80,rec.id+' lacks detailed conditions');
  assert.ok(rec.materials?.length>=4&&rec.applicationSteps?.length>=5,rec.id+' lacks real guide steps/materials');
  assert.ok(rec.reviewNote?.includes('办理入口待核实')&&rec.targetGroup&&rec.payoutTo,rec.id);
  assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===rec.id).length,1,rec.id+' missing or duplicate nationwide record');
  const guide=buildGansuGuide('policy',rec.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5&&Object.keys(guide.branches).length===3,rec.id+' incomplete user guide');
  assert.ok(gansuGuideUrl('policy',rec.id).includes(rec.id),rec.id+' dead route');
 }
 for(const rec of h){
  assert.ok(talentSourceKind(rec.sourceUrl)==='government','not government-hosted housing source '+rec.id);
  assert.ok(rec.eligibility.length>=50&&rec.steps.length>=5,rec.id);
  assert.ok(rec.statusNote.includes('申报入口待核实')&&rec.statusNote.includes('非实时空房'),rec.id+' falsely implies availability');
  assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===rec.id).length,1,rec.id+' missing or duplicated in housing search');
  const guide=buildGansuGuide('housing',rec.id);
  assert.ok(guide?.faq.length>=10&&guide.steps.length>=5&&guide.branches.verify,rec.id+' incomplete housing guide');
  assert.ok(gansuGuideUrl('housing',rec.id).includes(rec.id));
 }
}
const s=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(s.includes('甘肃省14市州贵阳V6政策住房完整分类目录')&&s.includes("fragments[2]==='gansu'"));
assert.ok(detail.includes('policy-guide-preview/gansu')&&list.includes('policy-guide-preview/gansu'));
for(const city of GANSU_14_REGIONS){
 const local=allP.filter(p=>p.city===city&&!p.title.startsWith('【甘肃全省统一】'));
 assert.ok(local.length>=1,city+' has only provincial generic policies');
}
assert.ok(allH.some(h=>h.city==='白银'&&h.title.includes('配售型保障性住房')));
assert.ok(allH.some(h=>h.city==='嘉峪关'&&h.title.includes('免租4—8年')));
assert.ok(allP.some(p=>p.city==='张掖'&&p.title.includes('40万元')));
assert.ok(allP.some(p=>p.city==='平凉'&&p.deadline==='2026-11-04'));
assert.ok(allH.some(h=>h.city==='甘南'&&h.published==='2026-10-21'));
console.log('GANSU_2026_EXPANSION_OK: 14/14 places, 79 geo-indexed policy records (incl 42 references to 3 provincial schemes), 38 housing evidence records; status, routes, sources, materials/FAQs verified.');
