import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BEIJING_POLICY_RECORDS} from '../src/data/beijingPolicyRecords.ts';
import {BEIJING_HOUSING_RECORDS} from '../src/data/beijingHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {beijingPublicRentalGuide,beijingMarketRentGuide,beijingGraduateSettlementGuide,beijingJobGrantGuide,beijingFlexSocialGuide,beijingYouthHousingGuide,beijingHaidianHousingGuide} from '../src/data/beijingGuides.ts';

const official=['bj-2025-public-rental-qualification','bj-2025-market-rent-subsidy','bj-2021-graduate-introduction-settlement','bj-2026-haidian-youth-housing','bj-2026-may-graduate-housing'];
const originals=['bj-jobseeker-grant','bj-flex-insurance','bj-youth-rental-2026','bj-chaoyang-2026'];
assert.equal(BEIJING_POLICY_RECORDS.length,5);
assert.equal(BEIJING_HOUSING_RECORDS.length,3);
const p=TALENT_POLICY_RECORDS.filter(x=>x.city==='北京');
const h=TALENT_HOUSING_RECORDS.filter(x=>x.city==='北京');
assert.ok(p.length>=9 && h.length>=7,`Beijing records incomplete: ${p.length} / ${h.length}`);
assert.equal(new Set(TALENT_POLICY_RECORDS.map(x=>x.id)).size,TALENT_POLICY_RECORDS.length);
assert.equal(new Set(TALENT_HOUSING_RECORDS.map(x=>x.id)).size,TALENT_HOUSING_RECORDS.length);
for(const id of [...official,...originals]) assert.ok(p.some(x=>x.id===id),'missing original or new policy '+id);
assert.ok(h.some(x=>x.id==='bj-yiliangma-2026'),'Original Chaoyang housing project must be preserved');
assert.ok(h.some(x=>x.id==='bj-hongxin-2026'),'Original Chaoyang housing project must be preserved');
assert.ok(h.some(x=>x.id==='bj-beixi'),'Original Beijing housing project must be preserved');
assert.ok(h.some(x=>x.id==='bj-maquanying'),'Original Maquanying project must be preserved');
assert.ok(p.some(x=>x.id==='bj-jobseeker-grant' && x.benefit.includes('1000')),'existing graduate grant lost');
assert.equal(findTalentCity('beijing')?.name,'北京');
assert.equal(findTalentCity('北京')?.name,'北京');
for(const x of BEIJING_POLICY_RECORDS) {
 assert.equal(x.city,'北京');
 assert.equal(talentSourceKind(x.sourceUrl),'government',x.id+' official source');
 assert.ok(x.materials?.length>=3 && x.applicationSteps?.length>=4,x.id+' real steps and materials');
 assert.ok(x.reviewNote?.includes('办理入口待核实') && !x.applicationUrl,x.id+' must not fake direct application URL');
 assert.notEqual(assessPolicy(x,'2026-10-31').grade,'A',x.id+' must not self certify');
}
for(const x of BEIJING_HOUSING_RECORDS){
 assert.equal(x.kind,'program',x.id+' must be policy and not pretend to be rentable apartment');
 assert.equal(talentSourceKind(x.sourceUrl),'government');
 assert.ok(x.steps.length>=4 && x.eligibility.length>=50 && /实时|不等于/.test(x.statusNote));
 assert.notEqual(assessHousing(x,'2026-10-31').grade,'A');
 assert.equal(x.applyUrl,undefined);
}
for(const id of ['bj-2026-haidian-youth-housing','bj-2026-may-graduate-housing'])
 assert.equal(assessPolicy(p.find(x=>x.id===id),'2026-10-31').grade,'C');
assert.equal(assessHousing(h.find(x=>x.id==='bj-haidian-2026-youth-program'),'2026-10-31').grade,'C');
const guides=[beijingPublicRentalGuide,beijingMarketRentGuide,beijingGraduateSettlementGuide,beijingJobGrantGuide,beijingFlexSocialGuide,beijingYouthHousingGuide,beijingHaidianHousingGuide];
assert.equal(guides.length,7);
for(const g of guides){
 assert.equal(g.city,'北京');assert.ok(['B','C'].includes(g.qualityLevel));
 assert.ok(g.steps.length>=6 && g.steps.every(x=>x.title&&x.why&&x.action&&x.done));
 assert.ok(g.checks.length>=5 && g.faq.length>=7);
 assert.ok(Object.keys(g.branches).length>=2);
 assert.ok(g.sources.length>=1 && g.sources.every(x=>talentSourceKind(x[1])==='government'));
 assert.equal(g.officialUrl,undefined,'no unverified application portal');
}
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const listing=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(route.includes("match.name==='北京'") && route.includes("fragments[2]==='beijing'"));
for(const slug of ['public-rental','market-rent','graduate-settlement','job-grant','flex-social','youth-housing','haidian'])
 assert.ok(route.includes('/policy-guide-preview/beijing/'+slug),'missing city hub route '+slug);
for(const id of official) assert.ok(listing.includes(id),'policy list guide link missing '+id);
const originalCityCount={};
for(const city of ['天津','上海','重庆','济南','青岛','沧州','廊坊','衡水'])
 originalCityCount[city]=TALENT_POLICY_RECORDS.filter(x=>x.city===city).length;
assert.ok(Object.values(originalCityCount).every(n=>n>0),'other cities no longer indexed');
assert.equal(assessTalentCity('北京','2026-10-31').accepted,false,'not all records certified');
console.log('BEIJING V5.1 PASS: 9+ policy records / 7+ housing records / 7 interactive guides / national search / no incorrect live rental claims.');
