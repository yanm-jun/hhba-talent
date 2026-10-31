import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GANSU_14_REGIONS,GANSU_POLICY_RECORDS} from '../src/data/gansuPolicyRecords.ts';
import {GANSU_HOUSING_RECORDS} from '../src/data/gansuHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {buildGansuGuide,gansuGuideUrl} from '../src/data/gansuGuides.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const cities=['兰州','嘉峪关','金昌','白银','天水','武威','张掖','平凉','酒泉','庆阳','定西','陇南','临夏','甘南'];
assert.deepEqual([...GANSU_14_REGIONS],cities);
assert.equal(queryTalentCities('','甘肃省').length,14,'Gansu prefecture and autonomous prefecture coverage');
assert.equal(GANSU_POLICY_RECORDS.length,21,'independently researched 21 policies must remain');
assert.equal(GANSU_HOUSING_RECORDS.length,26,'all 26 sourced housing records must remain');
assert.equal(new Set(GANSU_POLICY_RECORDS.map(x=>x.id)).size,GANSU_POLICY_RECORDS.length,'policy ID collision');
assert.equal(new Set(GANSU_HOUSING_RECORDS.map(x=>x.id)).size,GANSU_HOUSING_RECORDS.length,'housing ID collision');
for(const city of cities){
 assert.equal(findTalentCity(city)?.name,city,'city not searchable '+city);
 const policies=GANSU_POLICY_RECORDS.filter(x=>x.city===city);
 const houses=GANSU_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.ok(policies.length>=1,'missing unique researched policy for '+city);
 assert.ok(houses.length>=1,'missing source-backed housing evidence for '+city);
 assert.ok(getTalentCitySnapshot(city).policyCount>=policies.length,city+' initial policies missing from expanded nationwide index');
 assert.ok(getTalentCitySnapshot(city).housingCount>=houses.length,city+' initial housing missing from expanded nationwide index');
 for(const p of policies){
  assert.ok(p.sourceUrl.startsWith('https://')&&p.title&&p.eligibility.length>=80&&p.summary.length>=50,p.id);
  assert.ok(p.targetGroup&&p.payoutTo&&p.reviewNote.includes('办理入口待核实'),p.id);
  assert.ok(p.materials.length>=4&&p.applicationSteps.length>=5,p.id);
  assert.ok(talentSourceKind(p.sourceUrl)!=='unverified','policy unverified domain '+p.id);
  assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1,p.id);
  const guide=buildGansuGuide('policy',p.id);
  assert.ok(guide&&guide.steps.length>=5&&guide.faq.length>=10&&Object.keys(guide.branches).length>=3,p.id);
  assert.equal(guide.detailPath,'/talent-service/policy/'+encodeURIComponent(p.id));
  assert.ok(gansuGuideUrl('policy',p.id).includes(p.id));
 }
 for(const h of houses){
  assert.ok(h.sourceUrl.startsWith('https://')&&h.title&&h.address&&h.eligibility.length>=50,h.id);
  assert.ok(h.steps.length>=5&&h.statusNote.includes('申报入口待核实'),h.id);
  assert.ok(/非实时空房/.test(h.statusNote),'must distinguish real time vacancy '+h.id);
  assert.ok(talentSourceKind(h.sourceUrl)!=='unverified',h.id);
  assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1,h.id);
  const guide=buildGansuGuide('housing',h.id);
  assert.ok(guide&&guide.steps.length>=5&&guide.faq.length>=10&&guide.branches.verify,h.id);
  assert.ok(gansuGuideUrl('housing',h.id).includes(h.id));
 }
}
assert.equal(GANSU_HOUSING_RECORDS.filter(x=>x.city==='金昌').length,3);
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='金昌'&&x.units.includes('504套')),'Jinchang construction scope must be explicitly captured');
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='张掖'&&x.title.includes('公租房')),'Zhangye public rental');
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='甘南'&&x.title.includes('租赁补贴')),'Gannan rent cash support');
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='定西'&&x.title.includes('63套')),'Zhangxian construction not lost');
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='临夏'&&x.units.includes('348套')),'Linxia historical stock not lost');
assert.ok(GANSU_HOUSING_RECORDS.some(x=>x.city==='庆阳'&&x.statusNote.includes('不是')||x.city==='庆阳'&&x.statusNote.includes('不能')),'no promise Qingyang media stock');
assert.ok(!GANSU_POLICY_RECORDS.some(x=>x.title.includes('省级统一发钱')),'no fake provincial cash duplication');
const page=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(page.includes('甘肃省14市州贵阳V6政策住房完整分类目录'), 'city hub missing');
assert.ok(page.includes("fragments[2]==='gansu'"),'gansu guide dispatch missing');
assert.ok(detail.includes('policy-guide-preview/gansu')&&list.includes('policy-guide-preview/gansu'),'national list/detail broken');
console.log('GANSU_V6_14_CITY_COMPLETE: 14 city/prefectures, 21 policy items, 26 housing evidence items, complete guide routing & no live vacancy claims.');
