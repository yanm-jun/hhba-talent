import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHANGHAI_POLICY_RECORDS} from '../src/data/shanghaiPolicyRecords.ts';
import {SHANGHAI_HOUSING_RECORDS} from '../src/data/shanghaiHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
import {shanghaiIntroductionGuide,shanghaiResidenceGuide,shanghaiGraduateGuide,shanghaiRentalGuide,shanghaiXuhuiGuide,shanghaiJinganGuide,shanghaiYangpuGuide,shanghaiBaoshanGuide,shanghaiStartupGuide,shanghaiJobseekGuide,shanghaiFlexGuide} from '../src/data/shanghaiGuides.ts';
const p=TALENT_POLICY_RECORDS.filter(x=>x.city==='上海');
const h=TALENT_HOUSING_RECORDS.filter(x=>x.city==='上海');
assert.equal(SHANGHAI_POLICY_RECORDS.length,6);
assert.equal(SHANGHAI_HOUSING_RECORDS.length,5);
assert.ok(p.length>=12,'Shanghai policy count '+p.length);
assert.ok(h.length>=8,'Shanghai housing count '+h.length);
assert.equal(new Set(TALENT_POLICY_RECORDS.map(x=>x.id)).size,TALENT_POLICY_RECORDS.length);
assert.equal(new Set(TALENT_HOUSING_RECORDS.map(x=>x.id)).size,TALENT_HOUSING_RECORDS.length);
for(const x of SHANGHAI_POLICY_RECORDS){
 assert.equal(x.city,'上海');
 assert.equal(talentSourceKind(x.sourceUrl),'government',x.id);
 assert.ok(x.eligibility.length>70 && x.applicationSteps?.length>=5 && x.materials?.length>=3,x.id);
 assert.equal(x.applicationUrl,undefined,'news cannot be applicant portal');
 assert.notEqual(assessPolicy(x,'2026-10-31').grade,'A','A must be certified');
}
for(const x of SHANGHAI_HOUSING_RECORDS){
 assert.equal(x.city,'上海');
 assert.equal(x.kind,'program','do not pretend cash/housing policy is a rentable apartment');
 assert.equal(talentSourceKind(x.sourceUrl),'government');
 assert.ok(x.steps.length>=5 && x.eligibility.length>60 && x.statusNote.length>40);
 assert.equal(x.applyUrl,undefined);
 assert.notEqual(assessHousing(x,'2026-10-31').grade,'A');
}
for(const id of ['sh-2026-jobseek-grant','sh-2026-flex-insurance','sh-2026-first-startup','sh-2026-hukou','sh-xuhui-rent','sh-pudong-housing']) assert.ok(p.some(x=>x.id===id),'original '+id+' lost');
for(const id of ['sh-yueting-2025','sh-zhangjiang-2026','sh-kuanting'])assert.ok(h.some(x=>x.id===id),'old housing '+id+' lost');
for(const id of ['sh-xuhui-rent','sh-pudong-housing'])assert.equal(p.find(x=>x.id===id).applicationUrl,undefined,'fake portal still present');
const all=[shanghaiIntroductionGuide,shanghaiResidenceGuide,shanghaiGraduateGuide,shanghaiRentalGuide,shanghaiXuhuiGuide,shanghaiJinganGuide,shanghaiYangpuGuide,shanghaiBaoshanGuide,shanghaiStartupGuide,shanghaiJobseekGuide,shanghaiFlexGuide];
assert.equal(all.length,11);
for(const g of all){
 assert.equal(g.city,'上海');
 assert.ok(g.steps.length>=5 && g.faq.length>=7 && g.checks.length>=5);
 assert.ok(Object.keys(g.branches).length>=2 && g.sources.length>0);
 assert.ok(g.sources.every(([,url])=>talentSourceKind(url)==='government'));
 assert.equal(g.officialUrl,undefined,'do not invent current application form URL');
}
assert.equal(findTalentCity('shanghai')?.name,'上海');
assert.equal(findTalentCity('上海')?.name,'上海');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("match.name==='上海'") && routes.includes("fragments[2]==='shanghai'"));
for(const slug of ['talent-introduction','residence-hukou','graduate-hukou','protected-rental','xuhui-youth','jingan-youth','yangpu-youth','baoshan-youth','first-startup','job-seeker','flex-social'])assert.ok(routes.includes('/policy-guide-preview/shanghai/'+slug));
for(const x of SHANGHAI_POLICY_RECORDS)assert.ok(list.includes(x.id),'new policy not mapped '+x.id);
for(const city of ['北京','天津','重庆','济南','青岛','石家庄','唐山','沧州','廊坊','衡水'])assert.ok(TALENT_POLICY_RECORDS.some(x=>x.city===city),'other city lost '+city);
assert.equal(assessTalentCity('上海','2026-10-31').accepted,false);
console.log('SHANGHAI V5.1 PASS: '+p.length+' policy, '+h.length+' housing, 11 guides, 10 neighboring city indexes retained');
