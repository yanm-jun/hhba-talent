// HHBA V5.1 Zibo city integration: official records, no fake live apartments, unified pages only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,assessHousing,talentSourceKind,assessTalentCity} from '../src/data/talentQuality.ts';
import {ziboLivingGuide,ziboPurchaseGuide,ziboZichuanHousingGuide} from '../src/data/ziboGuide.ts';
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const listing=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const details=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)};
const policyIds=['zb-2026-living-reviewed','zb-2026-purchase-reviewed','zb-2026-expansion','zb-2026-flexible-social'];
const housingIds=['zb-zichuan-shuian-202606','zb-zichuan-yuting-202606','zb-zhangdian-shangpin-202609'];
check('Zibo has 4 independently sourced policy entries without overriding historical baselines',()=>{
 for(const id of policyIds){
  const p=TALENT_POLICY_RECORDS.filter(x=>x.id===id);
  assert.equal(p.length,1,id);assert.equal(p[0].city,'淄博');
  assert.equal(talentSourceKind(p[0].sourceUrl),'government');
  assert.ok(p[0].materials?.length>=3&&p[0].applicationSteps?.length>=4,id);
  assert.match(p[0].reviewNote,/办理入口待核实/,id);
  assert.equal(assessPolicy(p[0],'2026-10-30').grade,'B',id+' cannot claim A without independent certification');
 }
 for(const id of ['zb-home-history','zb-living-history','sd-zibo-2026-training'])assert.ok(TALENT_POLICY_RECORDS.some(p=>p.id===id),id+' legacy missing');
});
check('The 3 actual apartments disclose exact historical batch dates and no live vacancy',()=>{
 const count={ 'zb-zichuan-shuian-202606':'9套','zb-zichuan-yuting-202606':'8套','zb-zhangdian-shangpin-202609':'20套' };
 for(const id of housingIds){
  const entries=TALENT_HOUSING_RECORDS.filter(h=>h.id===id);
  assert.equal(entries.length,1,id);
  const h=entries[0];
  assert.equal(h.city,'淄博');assert.equal(h.kind,'project');
  assert.equal(h.housingCategory,'人才公寓');
  assert.equal(talentSourceKind(h.sourceUrl),'government');
  assert.ok(h.address&&h.eligibility.length>80&&h.steps.length>=5&&h.contactPhone);
  assert.ok(h.units.includes(count[id]),id+' mismatched published batch');
  assert.match(h.statusNote,/已截止/);assert.match(h.statusNote,/不等于|非实时/);
  assert.ok(h.applicationEnd<'2026-10-30');
  assert.equal(assessHousing(h,'2026-10-30').grade,'C');
 }
});
check('Shared 6-panel guide supports user branch, action steps, FAQ and direct official evidence',()=>{
 for(const [guide,id] of [[ziboLivingGuide,'zb-2026-living-reviewed'],[ziboPurchaseGuide,'zb-2026-purchase-reviewed']]){
  assert.equal(guide.city,'淄博');assert.ok(guide.steps.length>=5);
  assert.ok(Object.keys(guide.branches).length>=4);
  assert.ok(guide.faq.length>=7&&guide.checks.length>=5);
  for(const st of guide.steps)assert.ok(st.why&&st.action&&st.done);
  assert.ok(guide.sources.length>=3&&guide.sources.every(s=>talentSourceKind(s[1])==='government'));
  assert.equal(guide.detailPath,'/talent-service/policy/'+id);
  assert.equal(guide.officialUrl,undefined,'unverified government homepage must not masquerade as application link');
 }
 assert.equal(ziboZichuanHousingGuide.city,'淄博');
 assert.ok(ziboZichuanHousingGuide.review.includes('2026')&&ziboZichuanHousingGuide.steps.length>=5);
 assert.ok(ziboZichuanHousingGuide.faq.length>=7);
 assert.equal(ziboZichuanHousingGuide.officialUrl,undefined);
});
check('All Zibo routes use shared renderer, linked from city policy list and housing detail',()=>{
 assert.ok(routes.includes("fragments[2]==='zibo'"));
 assert.ok(routes.includes('ziboLivingGuide,ziboPurchaseGuide,ziboZichuanHousingGuide'));
 assert.ok(routes.includes('<UnifiedPolicyGuide data='));
 assert.ok(listing.includes("p.id==='zb-2026-living-reviewed'"));
 assert.ok(listing.includes("p.id==='zb-2026-purchase-reviewed'"));
 assert.ok(details.includes("'zb-2026-living-reviewed'"));
 assert.ok(details.includes("['zb-zichuan-shuian-202606','zb-zichuan-yuting-202606']"));
 assert.ok(TALENT_POLICY_RECORDS.filter(p=>p.city==='淄博').length>=7);
});
check('No unearned full-city acceptance or A grade is conferred',()=>{
 const audit=assessTalentCity('淄博','2026-10-30');
 assert.equal(audit.accepted,false);
 assert.ok(audit.records.some(r=>r.grade==='B')&&audit.records.some(r=>r.grade==='C'));
});
console.log(JSON.stringify({passed,city:'淄博',newPolicies:policyIds.length,newHousing:housingIds.length,certified:'none'},null,2));
