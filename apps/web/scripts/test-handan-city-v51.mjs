// 邯郸2026政策和住房统一开发标准 V5.1 专项验收；不得把2026批次当实时空房。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
const policies=TALENT_POLICY_RECORDS.filter(r=>r.city==='邯郸');
const homes=TALENT_HOUSING_RECORDS.filter(r=>r.city==='邯郸');
const policyIds=['hd-2026-doctor-living','hd-2026-master-living','hd-2026-double-first-bachelor-living','hd-2026-ordinary-bachelor-living','hd-2026-youth-first-home-purchase','hd-2026-young-talent-apartments','hd-2026-provident-fund-talent-loan'];
const homeIds=['hd-2026-four-district-rental','hd-2026-youth-talent-apartment-program'];
let passed=0;const check=(n,fn)=>{fn();passed++;console.log('✓ '+n)};
check('Handan all seven independently identified policies preserved with government primary sources',()=>{
 assert.equal(policies.length,policyIds.length);
 assert.equal(new Set(policies.map(x=>x.id)).size,policies.length);
 for(const id of policyIds){const p=policies.find(x=>x.id===id);assert.ok(p,id);
  assert.equal(talentSourceKind(p.sourceUrl),'government',id);
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4&&p.reviewedAt,id);
  assert.ok(p.reviewNote?.includes('办理入口待核实'),id+' lacks application URL caveat');
  assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A',id+' cannot automatically be A');
 }
});
check('Different cohorts, degrees, eligibility and recipients cannot be collapsed',()=>{
 const phd=policies.find(x=>x.id==='hd-2026-doctor-living');
 const master=policies.find(x=>x.id==='hd-2026-master-living');
 const bachelor=policies.find(x=>x.id==='hd-2026-double-first-bachelor-living');
 const ordinary=policies.find(x=>x.id==='hd-2026-ordinary-bachelor-living');
 assert.ok(phd.benefit.includes('5000')&&phd.eligibility.includes('35'));
 assert.ok(master.benefit.includes('2500')&&master.eligibility.includes('28'));
 assert.ok(bachelor.benefit.includes('1500')&&bachelor.eligibility.includes('25'));
 assert.ok(ordinary.benefit.includes('500')&&ordinary.eligibility.includes('2023'));
 assert.ok(policies.find(x=>x.id==='hd-2026-youth-first-home-purchase').eligibility.includes('首套'));
 assert.equal(policies.find(x=>x.id==='hd-2026-provident-fund-talent-loan').payoutTo,'非现金贷款');
 assert.equal(policies.find(x=>x.id==='hd-2026-young-talent-apartments').payoutTo,'住房折扣');
});
check('2026 3072 allocation is a historical batch not 3072 currently vacant rooms',()=>{
 assert.equal(homes.length,2);
 for(const id of homeIds){const h=homes.find(x=>x.id===id);assert.ok(h,id);
  assert.equal(h.kind,'program');assert.equal(talentSourceKind(h.sourceUrl),'government');
  assert.ok(h.steps.length>=4&&h.statusNote.includes('不等于')&&h.statusNote.includes('申报'),id);
  assert.notEqual(assessHousing(h,'2026-10-31').grade,'A');
 }
 const rental=homes.find(x=>x.id==='hd-2026-four-district-rental');
 assert.ok(rental.units.includes('3072')&&rental.units.includes('105'));
 assert.ok(rental.steps.some(x=>x.includes('冀时办')));
 assert.ok(rental.rent.includes('11.31')&&rental.rent.includes('6.43'));
 const talent=homes.find(x=>x.id==='hd-2026-youth-talent-apartment-program');
 assert.ok(talent.rent.includes('免租')&&talent.units.includes('80'));
 assert.equal(homes.filter(x=>x.kind==='project').length,0,'No false independently verifiable building');
});
check('Handan routes use shared V5.1 listing, search and relevant housing policies',()=>{
 const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
 assert.ok(routes.includes('housingResearchLeads(city,query||'));
 assert.ok(routes.includes('(!housingMode||isHousingPolicy(p))'));
 assert.ok(routes.includes('housingPrograms=resultHomes.filter'));
 assert.equal(assessTalentCity('邯郸','2026-10-31').accepted,false);
});
console.log(JSON.stringify({passed,city:'邯郸',policies:policies.length,housingPrograms:homes.length,certifiedProjects:0},null,2));
