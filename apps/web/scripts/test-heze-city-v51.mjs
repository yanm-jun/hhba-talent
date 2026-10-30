// HHBA V5.1 菏泽：把转载、公租房历史房源和国企人才公寓运营线索分级，不冒充政府原文和实时可租。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {assessPolicy,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {hezeLivingGuide,hezePurchaseGuide,hezeStartupGuide,hezeHousingGuide} from '../src/data/talentHezeGuides.ts';
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)};
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const policy=TALENT_POLICY_RECORDS.filter(x=>x.city==='菏泽');
const homes=TALENT_HOUSING_RECORDS.filter(x=>x.city==='菏泽');
const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='菏泽');
check('Keep Heze legacy 2026 policy IDs without pretending media pages are government originals',()=>{
 for(const id of ['hz-loan-26','sd-heze-2026-startup'])assert.ok(policy.some(p=>p.id===id),'missing '+id);
 assert.equal(new Set(policy.map(x=>x.id)).size,policy.length);
 assert.notEqual(assessPolicy(policy.find(p=>p.id==='sd-heze-2026-startup'),'2026-10-30').grade,'A');
});
check('Five independent 2026-09-30 public rental community leads total 112 published units, not live vacancies',()=>{
 const items=['longtian','yiwu','zhongfu','shuangjing','shidai'];
 const counts=[74,14,6,16,2];
 assert.equal(counts.reduce((a,b)=>a+b,0),112);
 for(let i=0;i<items.length;i++){
  const id='hz-mudan-20260930-'+items[i]+'-lead';
  const h=leads.find(x=>x.id===id);
  assert.ok(h,id);
  assert.equal(h.city,'菏泽');assert.equal(h.category,'保障性租赁住房'); // 平台分类；正文明确这是公共租赁住房
  assert.ok(h.units.includes(counts[i]+'套'));assert.ok(h.units.includes('不是10月底实时空房'));
  assert.ok(h.statusNote.includes('待核验'));assert.ok(h.steps.length>=4);
  assert.notEqual(talentSourceKind(h.sourceUrl),'government');
  assert.ok(!homes.some(x=>x.id===id));
 }
});
check('Separately retain the actual talent-apartment management operator but do not invent its projects',()=>{
 const h=leads.find(x=>x.id==='hz-talent-apartment-operator-lead');
 assert.ok(h&&h.city==='菏泽'&&h.category==='人才公寓');
 assert.ok(h.address.includes('运营机构地址')&&h.address.includes('不是人才公寓楼址'));
 assert.ok(h.statusNote.includes('待核验')&&h.steps.length>=4);
 assert.notEqual(talentSourceKind(h.sourceUrl),'government');
 assert.ok(!homes.some(x=>x.id===h.id));
 assert.equal(leads.length,6);
});
check('Four shared B/C guides include distinct beneficiaries, real procedures and source quality caveats',()=>{
 for(const g of [hezeLivingGuide,hezePurchaseGuide,hezeStartupGuide,hezeHousingGuide]){
  assert.equal(g.city,'菏泽');
  assert.ok(g.steps.length>=5&&g.faq.length>=7&&g.checks.length>=5);
  assert.ok(Object.keys(g.branches).length>=2&&g.sources.length>=2);
  for(const step of g.steps)assert.ok(step.title&&step.why&&step.action&&step.done);
  assert.ok(!g.officialUrl,'unverified primary application URL must not be created');
 }
 assert.equal(hezePurchaseGuide.qualityLevel,'C');
 assert.ok(hezePurchaseGuide.review.includes('5月17日'));
 assert.equal(hezeLivingGuide.qualityLevel,'B');
 assert.ok(hezeLivingGuide.review.includes('媒体转载'));
 assert.equal(hezeHousingGuide.qualityLevel,'B');
 assert.ok(hezeHousingGuide.unit.includes('非实时空房'));
});
check('All heze routes and city homepage use national shared renderer, preserve policy search',()=>{
 const routes=read('../src/pages/TalentServiceRoutes.tsx');
 const list=read('../src/components/talent/UnifiedPolicyList.tsx');
 const detail=read('../src/components/talent/UnifiedTalentRecordDetail.tsx');
 assert.ok(routes.includes("fragments[2]==='heze'"));
 assert.ok(routes.includes('hezeLivingGuide,hezePurchaseGuide,hezeStartupGuide,hezeHousingGuide'));
 assert.ok(routes.includes("match.name==='菏泽'"));
 for(const route of ['/talent-service/policy-guide-preview/heze/living','/talent-service/policy-guide-preview/heze/purchase','/talent-service/policy-guide-preview/heze/startup','/talent-service/policy-guide-preview/heze/housing'])assert.ok(routes.includes(route),'missing '+route);
 assert.ok(list.includes("p.id==='sd-heze-2026-startup'"));
 assert.ok(detail.includes("'sd-heze-2026-startup'"));
 assert.ok(routes.includes('housingResearchLeads(match.name)'));
 assert.ok(routes.includes('<UnifiedTalentHousingResearch city={city} query={query}/>'));
 assert.equal(assessTalentCity('菏泽','2026-10-30').accepted,false);
});
console.log(JSON.stringify({passed,city:'菏泽',existingPolicies:policy.length,verifiedHousing:homes.length,pendingHousingLeads:leads.length,guides:4,fullCityCertified:false},null,2));
