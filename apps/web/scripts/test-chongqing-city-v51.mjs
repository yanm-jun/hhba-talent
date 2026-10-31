import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHONGQING_POLICY_RECORDS} from '../src/data/chongqingPolicyRecords.ts';
import {CHONGQING_HOUSING_RECORDS} from '../src/data/chongqingHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
import {chongqingHomeGuide,chongqingPurchaseGuide,chongqingRentalGuide,chongqingCountiesGuide,chongqingPolicyGuide,chongqingJobseekGuide,chongqingShortageGuide} from '../src/data/chongqingGuides.ts';
const p=TALENT_POLICY_RECORDS.filter(x=>x.city==='重庆'),h=TALENT_HOUSING_RECORDS.filter(x=>x.city==='重庆');
assert.equal(CHONGQING_POLICY_RECORDS.length,5);assert.equal(CHONGQING_HOUSING_RECORDS.length,2);
assert.ok(p.length>=8 && h.length>=6,`Chongqing ${p.length}/${h.length}`);
assert.equal(new Set(TALENT_POLICY_RECORDS.map(x=>x.id)).size,TALENT_POLICY_RECORDS.length);
assert.equal(new Set(TALENT_HOUSING_RECORDS.map(x=>x.id)).size,TALENT_HOUSING_RECORDS.length);
for(const x of CHONGQING_POLICY_RECORDS){assert.equal(talentSourceKind(x.sourceUrl),'government',x.id);assert.ok(x.materials.length>=3 && x.applicationSteps.length>=4);assert.ok(x.reviewNote.includes('办理入口待核实'));assert.equal(x.applicationUrl,undefined);assert.notEqual(assessPolicy(x,'2026-10-31').grade,'A')}
for(const x of CHONGQING_HOUSING_RECORDS){assert.equal(x.kind,'program');assert.equal(talentSourceKind(x.sourceUrl),'government');assert.ok(x.steps.length>=4 && x.statusNote.includes('申报入口待核实'));assert.equal(x.applyUrl,undefined);assert.notEqual(assessHousing(x,'2026-10-31').grade,'A')}
for(const g of [chongqingHomeGuide,chongqingPurchaseGuide,chongqingRentalGuide,chongqingCountiesGuide,chongqingPolicyGuide,chongqingJobseekGuide,chongqingShortageGuide]){assert.equal(g.city,'重庆');assert.ok(g.steps.length>=6 && g.faq.length>=7);assert.ok(Object.keys(g.branches).length>=2);assert.ok(g.sources.length && g.sources.every(x=>talentSourceKind(x[1])==='government'));assert.equal(g.officialUrl,undefined)}
assert.ok(p.some(x=>x.id==='cq-2026-jobseek') && p.some(x=>x.id==='cq-2026-shortage-job'));
for(const id of ['cq-sanyu-2026','cq-wufeng-2026','cq-longsheng-2026'])assert.ok(h.some(x=>x.id===id),'lost original project '+id);
assert.equal(findTalentCity('chongqing')?.name,'重庆');assert.equal(findTalentCity('重庆')?.name,'重庆');
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8'),list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(route.includes("match.name==='重庆'")&&route.includes("fragments[2]==='chongqing'"));
for(const slug of ['home','purchase','rental','counties','policy','jobseek','shortage'])assert.ok(route.includes('/policy-guide-preview/chongqing/'+slug));
for(const x of CHONGQING_POLICY_RECORDS)assert.ok(list.includes(x.id));
for(const city of ['北京','天津','上海','济南','青岛','石家庄','沧州'])assert.ok(TALENT_POLICY_RECORDS.some(x=>x.city===city));
assert.equal(assessTalentCity('重庆','2026-10-31').accepted,false);
console.log('CHONGQING V5.1 PASS:',p.length,'policies',h.length,'housing, 7 guides, no fake vacancies');
