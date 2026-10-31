// 河北邢台V5.1：独立准确的2026年政策，媒体转载不升级政府一手认证，人才公寓及公租房旧批次不假冒实时房源。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {findTalentCity,parseTalentCityQuery} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {xingtaiPurchaseGuide,xingtaiRentalGuide,xingtaiHousingGuide} from '../src/data/xingtaiGuides.ts';
const read=(x)=>readFileSync(new URL('../src/'+x,import.meta.url),'utf8');
const ids=['xt-2026-talent-purchase','xt-2026-talent-rental','xt-2026-employment-training','xt-2026-high-talent-introduction'];
const lids=['xt-public-rental-202607-city-lead','xt-xindu-202607-waiting-lead','xt-talent-house-2023-service-lead','xt-talent-renovation-2024-lead'];
const rows=TALENT_POLICY_RECORDS.filter(p=>p.city==='邢台'),homes=TALENT_HOUSING_RECORDS.filter(x=>x.city==='邢台'),leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='邢台');
let passed=0;function check(label,fn){fn();passed++;console.log('✓ '+label)}
check('Xingtai city is searchable in Hebei city directory and parse-policy query',()=>{
 assert.equal(findTalentCity('邢台')?.province,'河北省');
 assert.equal(findTalentCity('xingtai')?.name,'邢台');
 assert.equal(parseTalentCityQuery('邢台硕士购房补贴','北京').city,'邢台');
});
check('Four independent policy records preserve media-vs-government distinction',()=>{
 assert.equal(rows.length,4);
 for(const id of ids){const r=rows.find(p=>p.id===id);assert.ok(r,id);assert.ok(r.materials.length>=3&&r.applicationSteps.length>=4);assert.match(r.reviewNote,/办理入口待核实/);assert.ok(r.sourceUrl.startsWith('https://'));}
 assert.equal(talentSourceKind(rows.find(x=>x.id===ids[0]).sourceUrl),'secondary');
 assert.equal(talentSourceKind(rows.find(x=>x.id===ids[1]).sourceUrl),'secondary');
 assert.equal(talentSourceKind(rows.find(x=>x.id===ids[2]).sourceUrl),'government');
 assert.equal(assessPolicy(rows.find(x=>x.id===ids[3]),'2026-10-31').grade,'C');
 for(const id of ['sjz-2026-bcard-rent','ts-youth-2024-base'])assert.ok(TALENT_POLICY_RECORDS.some(p=>p.id===id),'Other Hebei data changed: '+id);
});
check('Explicit purchase installments, monthly rental and six districts cannot be mixed',()=>{
 const purchase=rows.find(x=>x.id===ids[0]),rent=rows.find(x=>x.id===ids[1]);
 assert.ok(purchase.benefit.includes('第1年15万')&&purchase.benefit.includes('第3年5万'));
 assert.equal(purchase.headlineAmount,'最高¥300,000');
 assert.ok(purchase.reviewNote.includes('媒体')||purchase.sourceName.includes('转载'));
 assert.ok(rent.benefit.includes('36个月')&&rent.benefit.includes('1500元'));
 for(const p of [purchase,rent]){assert.ok(p.eligibility.includes('2023年1月1日')&&p.eligibility.includes('半年'));assert.ok(p.eligibility.includes('南和区'));assert.ok(p.applicationSteps.length>=6);}
 assert.equal(assessPolicy(purchase,'2026-10-31').grade,'B');
 assert.equal(assessPolicy(rent,'2026-10-31').grade,'B');
});
check('Four 2026 public-rental and talent-housing research leads are not verified vacancies',()=>{
 assert.equal(leads.length,4);
 assert.equal(homes.length,0,'No original municipal verified apartment project source was located');
 for(const id of lids){const r=leads.find(x=>x.id===id);assert.ok(r,id);assert.ok(r.steps.length>=4);assert.ok(r.statusNote.includes('待核验')||r.statusNote.includes('未核验'));assert.notEqual(talentSourceKind(r.sourceUrl),'government');assert.ok(!homes.some(h=>h.id===id));}
 assert.ok(leads.find(x=>x.id===lids[0]).units.includes('488套')&&leads.find(x=>x.id===lids[0]).statusNote.includes('非实时'));
 assert.ok(leads.find(x=>x.id===lids[2]).address.includes('不是人才公寓'));
 assert.ok(leads.find(x=>x.id===lids[3]).statusNote.includes('不能证明'));
});
check('Three V5.1 guides have branch-by-branch eligibility, materials, actions and FAQ',()=>{
 for(const g of [xingtaiPurchaseGuide,xingtaiRentalGuide,xingtaiHousingGuide]){
 assert.equal(g.city,'邢台');assert.equal(g.qualityLevel,'B');assert.ok(g.steps.length>=6&&g.checks.length>=6&&g.faq.length>=8);assert.ok(Object.keys(g.branches).length>=3);
 assert.ok(g.sources.length>=2);assert.equal(g.officialUrl,undefined);
 for(const st of g.steps)assert.ok(st.title&&st.why&&st.action&&st.done);
 }
 assert.ok(xingtaiPurchaseGuide.amounts.some(v=>v.join(' ').includes('第3年')));
 assert.ok(xingtaiHousingGuide.review.includes('待核验'));
});
check('Same shared components and city landing link policy/search/housing and details',()=>{
 const routes=read('pages/TalentServiceRoutes.tsx'),list=read('components/talent/UnifiedPolicyList.tsx'),detail=read('components/talent/UnifiedTalentRecordDetail.tsx'),research=read('data/talentHousingResearch.ts');
 assert.ok(routes.includes("fragments[2]==='xingtai'")&&routes.includes("match.name==='邢台'"));
 for(const part of ['purchase','rental','housing'])assert.ok(routes.includes('/talent-service/policy-guide-preview/xingtai/'+part),part);
 assert.ok(list.includes("p.id==='xt-2026-talent-purchase'")&&list.includes("p.id==='xt-2026-talent-rental'"));
 assert.ok(detail.includes("'xt-2026-talent-purchase'")&&detail.includes("'xt-2026-talent-rental'"));
 assert.ok(research.includes('...XINGTAI_HOUSING_RESEARCH_LEADS'));
 assert.equal(assessTalentCity('邢台','2026-10-31').accepted,false);
});
console.log(JSON.stringify({city:'邢台',passed,policies:rows.length,verifiedHousing:homes.length,pendingHousingLeads:leads.length,guides:3,cityA:false},null,2));
