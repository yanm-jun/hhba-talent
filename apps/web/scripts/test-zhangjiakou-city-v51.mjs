import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {zhangjiakouShuoboGuide,zhangjiakouParkGuide,zhangjiakouHousingGuide} from '../src/data/zhangjiakouGuides.ts';
const ps=TALENT_POLICY_RECORDS.filter(x=>x.city==='张家口'),hs=TALENT_HOUSING_RECORDS.filter(x=>x.city==='张家口');
const p=id=>{const x=ps.find(x=>x.id===id);assert.ok(x,'missing policy '+id);return x};
const h=id=>{const x=hs.find(x=>x.id===id);assert.ok(x,'missing housing '+id);return x};
const policies=['zjk-2026-shuobo-doctor','zjk-2026-shuobo-hospital','zjk-2024-highpark-apartment','zjk-2024-highpark-office'];
const homes=['zjk-highpark-talent-apartment-2024','zjk-qiaodong-2026-public-rental-rehabilitation'];
for(const id of policies){
 const r=p(id);assert.equal(talentSourceKind(r.sourceUrl),'government',id+' must point to primary-origin official URL');
 assert.ok(r.materials?.length>=3&&r.applicationSteps?.length>=4&&r.reviewNote.includes('办理入口待核实'),id+' V5.1 baseline');
 assert.equal(assessPolicy(r,'2026-10-31').grade,'C',id+' historical/expired program cannot pass as A/B current');
 assert.equal(r.applicationUrl,undefined);
}
assert.equal(new Set(ps.map(x=>x.id)).size,ps.length);
assert.equal(ps.length,4);
assert.equal(p('zjk-2026-shuobo-doctor').temporal,'past-window');
assert.equal(p('zjk-2026-shuobo-doctor').deadline,'2026-05-29');
assert.ok(p('zjk-2026-shuobo-doctor').benefit.includes('5年')&&p('zjk-2026-shuobo-doctor').benefit.includes('500'));
assert.ok(p('zjk-2026-shuobo-hospital').eligibility.includes('专业技术岗位'));
assert.equal(p('zjk-2024-highpark-office').payoutTo,'用人单位');
assert.ok(p('zjk-2024-highpark-office').reviewNote.includes('不能当作个人'));
for(const id of homes){
 const r=h(id);assert.equal(r.kind,'program','No independent apartment with address and 2026 real vacancies certified');
 assert.equal(talentSourceKind(r.sourceUrl),'government',id+' government original');
 assert.ok(r.units&&r.rent&&r.address&&r.eligibility?.length>50&&r.steps?.length>=4);
 assert.ok(r.statusNote.includes('非实时')&&r.statusNote.includes('申报入口待核验'));
 assert.equal(r.applyUrl,undefined);
 assert.ok(['B','C'].includes(assessHousing(r,'2026-10-31').grade));
}
assert.equal(hs.length,2);
assert.equal(hs.filter(x=>x.kind==='project').length,0,'Renovation units must not be certified as available apartment units');
assert.ok(h('zjk-qiaodong-2026-public-rental-rehabilitation').units.includes('4268套'));
assert.ok(h('zjk-qiaodong-2026-public-rental-rehabilitation').statusNote.includes('不代表'));
assert.equal(findTalentCity('zhangjiakou')?.name,'张家口');
assert.equal(findTalentCity('zjk')?.name,'张家口');
assert.equal(assessTalentCity('张家口','2026-10-31').accepted,false);
for(const g of [zhangjiakouShuoboGuide,zhangjiakouParkGuide,zhangjiakouHousingGuide]){
 assert.equal(g.city,'张家口');
 assert.ok(g.steps?.length>=6&&g.faq?.length>=6&&Object.keys(g.branches).length>=3);
 assert.equal(g.officialUrl,undefined);
}
assert.ok(zhangjiakouHousingGuide.faq.some(x=>x[0].includes('4268套')));
assert.ok(zhangjiakouShuoboGuide.faq.some(x=>x[0].includes('15万元')));
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("fragments[2]==='zhangjiakou'"));
assert.ok(read('pages/TalentServiceRoutes.tsx').includes('张家口市2026硕博政策和住房批次提醒'));
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("p.id==='zjk-2026-shuobo-doctor'"));
assert.ok(read('components/talent/UnifiedTalentRecordDetail.tsx').includes("'zjk-2024-highpark-apartment':'/talent-service/policy-guide-preview/zhangjiakou/park'"));
console.log('Zhangjiakou V5.1 PASS: 4 explicit historical/closed government-origin policies, two non-realtime housing programs, three shared practical guides, no invented apartment vacancies.');
