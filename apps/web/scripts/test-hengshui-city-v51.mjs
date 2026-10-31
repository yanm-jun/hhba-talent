import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessTalentCity,assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {hengshuiGraduateGuide,hengshuiRentBuyGuide,hengshuiApartmentGuide,hengshuiSkillsGuide} from '../src/data/hengshuiGuides.ts';
const ps=TALENT_POLICY_RECORDS.filter(p=>p.city==='衡水'),hs=TALENT_HOUSING_RECORDS.filter(h=>h.city==='衡水');
assert.equal(ps.length,5);assert.equal(hs.length,2);assert.equal(hs.filter(h=>h.kind==='project').length,0);
for(const p of ps){assert.equal(talentSourceKind(p.sourceUrl),'government');assert.equal(assessPolicy(p,'2026-10-31').grade,'B');assert.ok(p.materials.length>=3&&p.applicationSteps.length>=4);assert.ok(p.reviewNote.includes('办理入口待核实'));assert.equal(p.applicationUrl,undefined);}
for(const h of hs){assert.equal(talentSourceKind(h.sourceUrl),'government');assert.equal(h.kind,'program');assert.equal(assessHousing(h,'2026-10-31').grade,'B');assert.ok(h.steps.length>=4&&h.eligibility.length>50);assert.ok(h.statusNote.includes('申报入口待核验'));assert.equal(h.applyUrl,undefined);}
assert.ok(ps.find(p=>p.id==='hs-2024-card-home').benefit.includes('博士15万元'));
assert.ok(ps.find(p=>p.id==='hs-2024-graduate-settlement').eligibility.includes('毕业2年内'));
assert.ok(hs.find(h=>h.id==='hs-2022-affordable-housing-policy').units.includes('320套'));
for(const g of [hengshuiGraduateGuide,hengshuiRentBuyGuide,hengshuiApartmentGuide,hengshuiSkillsGuide]){assert.equal(g.city,'衡水');assert.equal(g.qualityLevel,'B');assert.equal(g.officialUrl,undefined);assert.ok(g.steps.length>=6&&g.faq.length>=6&&Object.keys(g.branches).length>=3);assert.ok(g.steps.every(s=>s.title&&s.why&&s.action&&s.done));}
assert.equal(findTalentCity('hengshui')?.name,'衡水');assert.equal(findTalentCity('hs')?.name,'衡水');assert.equal(assessTalentCity('衡水','2026-10-31').accepted,false);
const read=f=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("fragments[2]==='hengshui'"));
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("match.name==='衡水'"));
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("p.id==='hs-2024-graduate-settlement'"));
assert.ok(read('components/talent/UnifiedTalentRecordDetail.tsx').includes("'hs-2024-card-home'"));
console.log('Hengshui V5.1 PASS: five 2024 graded policies, two 2026-nonrealtime housing programs and four shared guides.');
