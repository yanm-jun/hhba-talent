// 河北首站 · 石家庄 V5.1。仅审核正式2026政府来源和真实页面路径；不擅自授予A级或“整城完成”。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {queryTalentCities,parseTalentCityQuery,findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {shijiazhuangRentGuide,shijiazhuangBuyGuide,shijiazhuangSettlementGuide,shijiazhuangHousingGuide} from '../src/data/shijiazhuangGuides.ts';
let passed=0;const check=(n,fn)=>{fn();console.log('✓ '+n);passed++};
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const ids=['sjz-2026-bcard-rent','sjz-2026-bcard-home','sjz-2026-graduate-settle','sjz-2026-bcard-eligibility'];
const hids=['sjz-2026-talent-574','sjz-2026-affordable-rental','sjz-2026-public-rental-yishui','sjz-2026-public-rental-tanan','sjz-2026-public-rental-shenghe'];
check('Hebei city index and search parse Shijiazhuang independently',()=>{
 const c=findTalentCity('石家庄');assert.ok(c);assert.equal(c.province,'河北省');assert.equal(c.code,'130100');
 assert.equal(parseTalentCityQuery('石家庄硕士补贴','北京').city,'石家庄');
 assert.ok(queryTalentCities('','河北省').some(c=>c.name==='石家庄'));
});
check('Four official city policies meet V5.1 baseline and preserve unrelated city IDs',()=>{
 for(const id of ids){const rows=TALENT_POLICY_RECORDS.filter(p=>p.id===id);assert.equal(rows.length,1,id);const p=rows[0];
 assert.equal(p.city,'石家庄');assert.equal(talentSourceKind(p.sourceUrl),'government');assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,id);
 assert.match(p.reviewNote,/办理入口待核实/);assert.equal(assessPolicy(p,'2026-10-31').grade,'B');}
 for(const id of ['sd-jinan-2026-talent-living','sd-heze-2026-startup'])assert.ok(TALENT_POLICY_RECORDS.some(p=>p.id===id));
});
check('No confusion between B-card rent, B-card buy and one-time graduate settlement',()=>{
 const p=id=>TALENT_POLICY_RECORDS.find(x=>x.id===id);
 assert.equal(p('sjz-2026-bcard-rent').headlineAmount,'¥1,000—3,000');
 assert.equal(p('sjz-2026-bcard-home').headlineAmount,'最高¥300,000');
 assert.equal(p('sjz-2026-graduate-settle').headlineAmount,'¥10,000—50,000');
 assert.ok(p('sjz-2026-graduate-settle').reviewNote.includes('只可享受一次'));
 assert.ok(p('sjz-2026-bcard-home').eligibility.includes('有效期'));
 assert.ok(p('sjz-2026-bcard-rent').benefit.includes('停发'));
 assert.equal(p('sjz-2026-bcard-eligibility').payoutTo,'非现金服务');
});
check('Five housing records distinguish verified closed batches from non-live support program',()=>{
 for(const id of hids){const items=TALENT_HOUSING_RECORDS.filter(p=>p.id===id);assert.equal(items.length,1,id);const h=items[0];
 assert.equal(h.city,'石家庄');assert.equal(talentSourceKind(h.sourceUrl),'government');
 assert.ok(h.address&&h.units&&h.rent&&h.eligibility.length>50&&h.steps.length>=4);
 assert.match(h.statusNote,/不等于.*实时空房|非实时空房/);
 assert.ok(h.applyUrl===undefined);}
 assert.equal(assessHousing(TALENT_HOUSING_RECORDS.find(h=>h.id==='sjz-2026-talent-574'),'2026-10-31').grade,'C');
 assert.equal(assessHousing(TALENT_HOUSING_RECORDS.find(h=>h.id==='sjz-2026-affordable-rental'),'2026-10-31').grade,'B');
 for(const id of hids.slice(2))assert.equal(assessHousing(TALENT_HOUSING_RECORDS.find(h=>h.id===id),'2026-10-31').grade,'C');
});
check('Four detailed guides have true branches, steps and FAQ but do not claim A',()=>{
 for(const guide of [shijiazhuangRentGuide,shijiazhuangBuyGuide,shijiazhuangSettlementGuide,shijiazhuangHousingGuide]){
 assert.equal(guide.city,'石家庄');assert.equal(guide.qualityLevel,'B');
 assert.ok(guide.steps.length>=5&&guide.checks.length>=5&&guide.faq.length>=7);
 assert.ok(Object.keys(guide.branches).length>=2);
 for(const step of guide.steps)assert.ok(step.title&&step.why&&step.action&&step.done);
 assert.ok(guide.sources.length>=2&&guide.sources.every(([_,url])=>talentSourceKind(url)==='government'));
 assert.equal(guide.officialUrl,undefined);
 }
 assert.ok(shijiazhuangHousingGuide.amounts.some(row=>row.join(' ').includes('历史')));
});
check('City landing, housing records and policy cards use shared V5.1 renderer',()=>{
 const routes=read('pages/TalentServiceRoutes.tsx');
 const list=read('components/talent/UnifiedPolicyList.tsx');
 const detail=read('components/talent/UnifiedTalentRecordDetail.tsx');
 assert.ok(routes.includes("fragments[2]==='shijiazhuang'"));
 assert.ok(routes.includes("match.name==='石家庄'"));
 for(const route of ['rent','home','settlement','housing'])assert.ok(routes.includes('/talent-service/policy-guide-preview/shijiazhuang/'+route));
 for(const id of ids.slice(0,3))assert.ok(list.includes("p.id==='"+id+"'"),id+' not listed');
 for(const id of ids.slice(0,3))assert.ok(detail.includes("'"+id+"':"),id+' detail missing');
 assert.ok(detail.includes("'sjz-2026-affordable-rental'"));
 assert.ok(!read('pages/TalentServiceRoutes.tsx').includes('TalentShijiazhuangGuidePreview'));
 assert.equal(assessTalentCity('石家庄','2026-10-31').accepted,false);
});
console.log(JSON.stringify({passed,city:'石家庄',province:'河北省',policies:ids.length,housing:hids.length,sharedGuides:4,certifiedA:false},null,2));
