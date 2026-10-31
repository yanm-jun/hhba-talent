import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SICHUAN_POLICY_RECORDS} from '../src/data/sichuanPolicyRecords.ts';
import {SICHUAN_HOUSING_RECORDS} from '../src/data/sichuanHousingRecords.ts';
import {SICHUAN_21_REGIONS,SICHUAN_VERIFIED_POLICIES,SICHUAN_VERIFIED_HOUSING,buildSichuanGuide,sichuanGuideUrl} from '../src/data/sichuanGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {ACCEPTED_TALENT_CITIES,assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
assert.equal(SICHUAN_21_REGIONS.length,21);
assert.equal(new Set(SICHUAN_21_REGIONS).size,21);
assert.equal(queryTalentCities('','四川省').length,21);
for(const c of SICHUAN_21_REGIONS){
 assert.equal(findTalentCity(c)?.name,c,'missing Sichuan city/prefecture index');
}
assert.equal(SICHUAN_POLICY_RECORDS.length,9);
assert.equal(SICHUAN_HOUSING_RECORDS.length,7);
assert.equal(SICHUAN_VERIFIED_POLICIES.length,11,'must keep two Leshan policies');
assert.equal(SICHUAN_VERIFIED_HOUSING.length,8,'must keep separate Leshan housing');
for(const p of SICHUAN_VERIFIED_POLICIES){
 assert.equal(talentSourceKind(p.sourceUrl),'government','not government source: '+p.id);
 assert.equal(assessPolicy(p,'2026-10-31').grade,'B','not A-city certified: '+p.city);
 assert.ok(p.eligibility.length>=45&&p.applicationSteps.length>=4&&p.materials.length>=3,p.id+' incomplete guidance');
 assert.ok(p.reviewNote?.length>20);
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
 const g=buildSichuanGuide('policy',p.id);
 assert.ok(g?.branches.eligible&&g.branches.other&&g.branches.verify&&g.steps.length>=4&&g.faq.length>=6,p.id);
 assert.equal(g.qualityLevel,'B');
 assert.ok(sichuanGuideUrl('policy',p.id).includes(p.id));
}
for(const h of SICHUAN_VERIFIED_HOUSING){
 assert.equal(talentSourceKind(h.sourceUrl),'government');
 assert.equal(assessHousing(h,'2026-10-31').grade,'B');
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.equal(h.kind,'program','no fake apartment projects');
 assert.ok(h.statusNote.match(/空房|房源|可租|项目/));
 const g=buildSichuanGuide('housing',h.id);
 assert.ok(g?.steps.length>=4&&g.branches.verify&&g.faq.length>=6);
}
assert.equal(buildSichuanGuide('policy','not-real'),null);
assert.equal(buildSichuanGuide('housing','not-real'),null);
assert.ok(SICHUAN_POLICY_RECORDS.find(x=>x.city==='成都')?.benefit.includes('50平方米'));
assert.ok(SICHUAN_HOUSING_RECORDS.find(x=>x.city==='阿坝')?.units.includes('1500'));
assert.ok(!ACCEPTED_TALENT_CITIES.some(x=>SICHUAN_21_REGIONS.includes(x)),'Sichuan B city mistakenly certified');
const newPolicyCities=new Set(SICHUAN_POLICY_RECORDS.map(x=>x.city));
const pending=SICHUAN_21_REGIONS.filter(c=>!newPolicyCities.has(c)&&c!=='乐山');
assert.equal(pending.length,11,'unverified remaining region must not be silently passed');
const router=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const card=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(router.includes("fragments[2]==='sichuan'")&&router.includes('buildSichuanGuide('));
assert.ok(router.includes('SICHUAN_21_REGIONS.some(')&&router.includes('sichuanGuideUrl('));
assert.ok(card.includes('policy-guide-preview/sichuan/policy/'));
assert.ok(detail.includes('policy-guide-preview/sichuan/'));
console.log('HHBA SICHUAN V5.1 source-backed coverage: 9 new cities + Leshan; 11 cities/prefectures pending source evidence');
