import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TIANJIN_POLICY_RECORDS} from '../src/data/tianjinPolicyRecords.ts';
import {TIANJIN_HOUSING_RECORDS} from '../src/data/tianjinHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind,assessTalentCity,assessPolicy,assessHousing} from '../src/data/talentQuality.ts';
import {tianjinHaiheGuide,tianjinApartmentGuide,tianjinRentalGuide,tianjinPublicGuide,tianjinStartupGuide,tianjinGrantGuide} from '../src/data/tianjinGuides.ts';
const p=TALENT_POLICY_RECORDS.filter(x=>x.city==='天津');
const h=TALENT_HOUSING_RECORDS.filter(x=>x.city==='天津');
assert.equal(TIANJIN_POLICY_RECORDS.length,5);assert.equal(TIANJIN_HOUSING_RECORDS.length,2);
assert.ok(p.length>=8 && h.length>=6,`Tianjin coverage: ${p.length}/${h.length}`);
assert.equal(new Set(TALENT_POLICY_RECORDS.map(x=>x.id)).size,TALENT_POLICY_RECORDS.length);
assert.equal(new Set(TALENT_HOUSING_RECORDS.map(x=>x.id)).size,TALENT_HOUSING_RECORDS.length);
for(const x of TIANJIN_POLICY_RECORDS){assert.equal(talentSourceKind(x.sourceUrl),'government');assert.ok(x.materials.length>=3 && x.applicationSteps.length>=4);assert.ok(x.reviewNote.includes('办理入口待核实'));assert.equal(x.applicationUrl,undefined);assert.notEqual(assessPolicy(x,'2026-10-31').grade,'A')}
for(const x of TIANJIN_HOUSING_RECORDS){assert.equal(x.kind,'program');assert.equal(talentSourceKind(x.sourceUrl),'government');assert.ok(x.steps.length>=4 && /申报入口待核实/.test(x.statusNote));assert.equal(x.applyUrl,undefined);assert.notEqual(assessHousing(x,'2026-10-31').grade,'A')}
for(const g of [tianjinHaiheGuide,tianjinApartmentGuide,tianjinRentalGuide,tianjinPublicGuide,tianjinStartupGuide,tianjinGrantGuide]){assert.equal(g.city,'天津');assert.ok(g.steps.length>=6 && g.faq.length>=7);assert.ok(Object.keys(g.branches).length>=2);assert.ok(g.sources.every(x=>talentSourceKind(x[1])==='government'));assert.equal(g.officialUrl,undefined)}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');assert.ok(routes.includes("match.name==='天津'") && routes.includes("fragments[2]==='tianjin'"));for(const slug of ['haihe','apartment','rental','public','startup','grant'])assert.ok(routes.includes('/policy-guide-preview/tianjin/'+slug));
for(const x of TIANJIN_POLICY_RECORDS)assert.ok(list.includes(x.id));assert.equal(findTalentCity('tianjin')?.name,'天津');
for(const city of ['北京','上海','重庆','济南','青岛','石家庄','沧州']) assert.ok(TALENT_POLICY_RECORDS.some(x=>x.city===city));
assert.equal(assessTalentCity('天津','2026-10-31').accepted,false);
console.log('TIANJIN V5.1 PASS',p.length,'policy',h.length,'housing',6,'guides, city and search routes retained');
