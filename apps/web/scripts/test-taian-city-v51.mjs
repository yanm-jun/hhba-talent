// 泰安 HHBA V5.1 回归：新旧记录共存，官方依据，真实办理步骤，住房制度非虚构公寓。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {taianLivingGuide,taianPurchaseGuide,taianHousingGuide} from '../src/data/taianGuide.ts';
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const details=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const ids=['ta-2026-living-guide','ta-2026-first-home-guide','ta-2026-rent-relief','ta-2026-youth-fund','ta-2026-expansion'];
const homes=['ta-2026-city-affordable-rental','ta-2026-new-worker-public-rent'];
let passed=0;function check(label,fn){fn();passed++;console.log('✓ '+label)}
check('Five new sourced Taian policies keep historical records and avoid A-grade claims',()=>{
 for(const id of ids){const rows=TALENT_POLICY_RECORDS.filter(p=>p.id===id);assert.equal(rows.length,1,id);const p=rows[0];assert.equal(p.city,'泰安');assert.equal(talentSourceKind(p.sourceUrl),'government');assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4);assert.equal(assessPolicy(p,'2026-10-30').grade,'B',id);}
 for(const id of ['ta-home-25','ta-living-25','sd-taian-2025-youth'])assert.ok(TALENT_POLICY_RECORDS.some(p=>p.id===id),'Lost historical record '+id);
});
check('Money recipients, current law and noncash mortgage are distinguished',()=>{
 const p=id=>TALENT_POLICY_RECORDS.find(x=>x.id===id);
 assert.equal(p('ta-2026-living-guide').payoutTo,'个人');
 assert.ok(p('ta-2026-living-guide').reviewNote.includes('单位'));
 assert.equal(p('ta-2026-youth-fund').payoutTo,'非现金贷款');
 assert.equal(p('ta-2026-expansion').payoutTo,'用人单位');
 assert.equal(p('ta-2026-expansion').deadline,'2026-12-31');
 assert.equal(p('ta-2026-rent-relief').headlineAmount,'≥¥300');
});
check('Housing is accurately labelled as a policy program, not a current apartment listing',()=>{
 for(const id of homes){const rows=TALENT_HOUSING_RECORDS.filter(h=>h.id===id);assert.equal(rows.length,1);const h=rows[0];assert.equal(h.city,'泰安');assert.equal(h.kind,'program');assert.equal(talentSourceKind(h.sourceUrl),'government');assert.ok(h.steps.length>=4);assert.match(h.statusNote,/不代表|非实时|没有/);assert.match(h.statusNote,/申报入口未公开/);assert.ok(!h.applyUrl);assert.equal(assessHousing(h,'2026-10-30').grade,'B');}
});
check('Three B-grade guides use the shared V5.1 renderer, with official sources and applicant branches',()=>{
 for(const guide of [taianLivingGuide,taianPurchaseGuide,taianHousingGuide]){
  assert.equal(guide.city,'泰安');assert.equal(guide.qualityLevel,'B');assert.ok(guide.steps.length>=5&&guide.faq.length>=7);
  assert.ok(guide.checks.length>=5&&Object.keys(guide.branches).length>=3);
  assert.ok(guide.sources.length>=1&&guide.sources.every(([_,url])=>talentSourceKind(url)==='government'));
  for(const step of guide.steps)assert.ok(step.why&&step.action&&step.done);
 }
 assert.ok(taianLivingGuide.officialUrl?.startsWith('https://rsj.taian.cn:8008/'));
 assert.equal(taianPurchaseGuide.officialUrl,undefined);
 assert.equal(taianHousingGuide.officialUrl,undefined);
});
check('Main routes, city list, detail and housing are connected without a separate JSX city page',()=>{
 assert.ok(routes.includes("fragments[2]==='taian'"));
 assert.ok(routes.includes('taianLivingGuide,taianPurchaseGuide,taianHousingGuide'));
 assert.ok(list.includes("p.id==='ta-2026-living-guide'")&&list.includes("p.id==='ta-2026-first-home-guide'"));
 assert.ok(details.includes("'ta-2026-living-guide'")&&details.includes("'ta-2026-first-home-guide'"));
 assert.ok(details.includes("'ta-2026-city-affordable-rental'"));
 assert.equal(assessTalentCity('泰安','2026-10-30').accepted,false);
});
console.log(JSON.stringify({passed,city:'泰安',newPolicies:ids.length,housingPrograms:homes.length,independentGuides:3,certified:'not yet'},null,2));
