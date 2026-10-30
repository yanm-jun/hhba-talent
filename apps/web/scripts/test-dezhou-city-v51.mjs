// HHBA 全国城市V5.1：德州业务、历史政策与媒体线索独立核验。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
const policies=TALENT_POLICY_RECORDS.filter(x=>x.city==='德州');
const homes=TALENT_HOUSING_RECORDS.filter(x=>x.city==='德州');
const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='德州');
const byId=(arr,id)=>arr.find(x=>x.id===id);
let checked=0;const check=(name,fn)=>{fn();checked++;console.log('✓ '+name)};
check('Keep Dezhou two original policies and source-backed V5.1 additions',()=>{
 for(const id of ['dz-home-history','sd-dezhou-2026-startup','dz-2026-job-readiness-training','dz-doctor-housing-history-2023'])assert.ok(byId(policies,id),id);
 assert.equal(new Set(policies.map(x=>x.id)).size,policies.length);
 assert.ok(policies.length>=4);
});
check('2026 real youth training program pays institutions, never youth cash',()=>{
 const x=byId(policies,'dz-2026-job-readiness-training');
 assert.equal(talentSourceKind(x.sourceUrl),'government');
 assert.equal(x.payoutTo,'用人单位');
 assert.ok(x.reviewNote.includes('承训实施单位')&&(x.reviewNote.includes('现金补贴')||x.reviewNote.includes('个人现金')));
 assert.ok(x.materials?.length>=3&&x.applicationSteps?.length>=4);
 assert.equal(assessPolicy(x,'2026-10-30').grade,'B');
});
check('Dezhou historical doctorate subsidy is explicitly archived',()=>{
 const old=byId(policies,'dz-doctor-housing-history-2023');
 assert.equal(old.temporal,'historical');
 assert.equal(assessPolicy(old,'2026-10-30').grade,'C');
 assert.equal(assessPolicy(byId(policies,'dz-home-history'),'2026-10-30').grade,'C');
});
check('2026 startup loan not marketed as personal free money',()=>{
 const x=byId(policies,'sd-dezhou-2026-startup');
 assert.equal(x.payoutTo,'非现金贷款');
 assert.ok(x.materials?.length>=3&&x.applicationSteps?.length>=4);
 assert.ok(x.reviewNote.includes('办理入口待核实'));
});
check('Official housing historical totals are not advertised as current vacancies',()=>{
 for(const id of ['dz-citywide-talent-housing-2023','dz-doctor-apartment-2023']){
  const h=byId(homes,id);assert.ok(h,id);
  assert.equal(h.kind,'program');assert.equal(talentSourceKind(h.sourceUrl),'government');
  assert.ok(h.steps.length>=4&&h.statusNote.includes('2026')&&h.statusNote.includes('申报'));
  assert.notEqual(assessHousing(h,'2026-10-30').grade,'A');
 }
 assert.equal(homes.filter(h=>h.kind==='project').length,0,'Do not certify a project without direct governmental project notice');
});
check('Real Yingcai, Youlai and Dongcheng leads are distinct and clearly pending',()=>{
 for(const id of ['dz-yingcai-140-2024-lead','dz-you-lai-youth-2025-lead','dz-dongcheng-mingzhu-2026-lead','dz-linzhuang-199-2026-lead']){
  const lead=byId(leads,id);assert.ok(lead,id);
  assert.notEqual(talentSourceKind(lead.sourceUrl),'government');
  assert.ok(lead.address&&lead.units&&lead.rent&&lead.eligibility&&lead.steps.length>=4);
  assert.match(lead.statusNote,/待核|待.*核验|未核验|不等于/);
  assert.ok(!homes.some(h=>h.id===id));
 }
 assert.equal(leads.length,4);
});
check('Dezhou search and housing route use shared city renderer and lead discovery',()=>{
 const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
 const policyList=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
 assert.ok(routes.includes('housingResearchLeads(city,query||'));assert.ok(routes.includes('isHousingPolicy(p)'));
 assert.ok(routes.includes('housingPrograms=resultHomes.filter')&&routes.includes('housingProjects=resultHomes.filter'));
 assert.ok(policyList.includes('buildCityPolicyConfig(city)')||policyList.includes('export function buildCityPolicyConfig'));
 assert.equal(assessTalentCity('德州','2026-10-30').accepted,false);
});
console.log(JSON.stringify({city:'德州',checked,policies:policies.length,housingPrograms:homes.length,pendingApartments:leads.length},null,2));
