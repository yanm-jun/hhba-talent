import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {tangshanYouthGuide,tangshanPurchaseGuide,tangshanHousingGuide} from '../src/data/tangshanGuides.ts';
const pol=TALENT_POLICY_RECORDS.filter(p=>p.city==='唐山'),homes=TALENT_HOUSING_RECORDS.filter(h=>h.city==='唐山');
for(const id of ['ts-youth-2024-base','ts-home-2024-base','ts-hightech-rent-2023','ts-undergraduate-2024-archive'])assert.ok(pol.some(x=>x.id===id),'Tangshan policy missing '+id);
assert.ok(pol.length>=4);
assert.equal(new Set(pol.map(x=>x.id)).size,pol.length);
for(const p of pol){
 assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' must have government original');
 assert.equal(assessPolicy(p,'2026-10-31').grade,'C',p.id+' original rules archived pending 2026 transition');
 assert.ok(p.reviewNote.includes('办理入口待核实'),'No unverified legacy online application');
 assert.equal(p.applicationUrl,undefined);
 assert.ok(p.materials.length>=3&&p.applicationSteps.length>=4);
 assert.ok(p.summary.includes('2026')&&p.reviewedAt);
}
assert.ok(!pol.some(p=>p.id==='ts-enterprise-master-2026-updated'),'2026 media report must not pretend to be primary government policy');
assert.ok(tangshanYouthGuide.sources.some(x=>x[1].includes('/202608/01/')),'2026 secondary authority must remain disclosed in guide');
assert.ok(tangshanYouthGuide.desc.includes('2026年3月')&&tangshanYouthGuide.desc.includes('2024年'));
assert.ok(tangshanYouthGuide.faq.some(x=>x[0].includes('2026企业硕士')));
for(const id of ['ts-digital-park-young-apartment-2024','ts-phoenix-apartment-rules-2022','ts-hightech-rent-program-2023'])assert.ok(homes.some(x=>x.id===id),'Tangshan housing missing '+id);
assert.equal(homes.filter(x=>x.kind==='project').length,1,'Only the government-proven real youth apartment is a project');
assert.equal(homes.filter(x=>x.kind==='program').length,2,'Do not call two policy programs independent projects');
const project=homes.find(x=>x.id==='ts-digital-park-young-apartment-2024');
assert.equal(project.kind,'project');
assert.ok(project.units.includes('134套')&&project.units.includes('不是2026年10月可租余房'));
assert.ok(project.statusNote.includes('申报入口待核验'));
assert.equal(project.applyUrl,undefined);
for(const h of homes){assert.equal(talentSourceKind(h.sourceUrl),'government',h.id+' official original');assert.equal(assessHousing(h,'2026-10-31').grade,'B');assert.ok(h.eligibility.length>=50&&h.steps.length>=4);assert.ok(h.statusNote.includes('申报入口待核验')&&/非实时|不是2026年10月实时空房/.test(h.statusNote));}
assert.equal(findTalentCity('tangshan')?.name,'唐山');
assert.equal(assessTalentCity('唐山','2026-10-31').accepted,false);
for(const g of [tangshanYouthGuide,tangshanPurchaseGuide,tangshanHousingGuide]){
 assert.equal(g.city,'唐山');assert.ok(g.steps.length>=6&&g.faq.length>=6);assert.ok(Object.keys(g.branches).length>=3);assert.equal(g.officialUrl,undefined);
}
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(route.includes("fragments[2]==='tangshan'")&&route.includes('唐山市2024/2026政策版本提醒'));
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(list.includes("p.id==='ts-youth-2024-base'"));
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(detail.includes("'ts-home-2024-base':'/talent-service/policy-guide-preview/tangshan/purchase'"));
console.log('Tangshan V5.1 PASS: 4 government-original historical policies, 1 genuine government-reported youth apartment, 2 program channels and 3 linked guides.');
