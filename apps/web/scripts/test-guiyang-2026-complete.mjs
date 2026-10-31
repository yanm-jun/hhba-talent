import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIZHOU_POLICY_RECORDS} from '../src/data/guizhouPolicyRecords.ts';
import {GUIZHOU_HOUSING_RECORDS} from '../src/data/guizhouHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {buildGuizhouGuide,guizhouGuideUrl} from '../src/data/guizhouGuides.ts';
import {assessPolicy,assessHousing,talentSourceKind,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
const gy=GUIZHOU_POLICY_RECORDS.filter(p=>p.city==='贵阳');
const gyh=GUIZHOU_HOUSING_RECORDS.filter(h=>h.city==='贵阳');
assert.equal(gy.length,9,'Guiyang must contain all nine independently described policy programs');
assert.equal(gyh.length,4,'housing programs, short stay and real project must be separate');
assert.equal(GUIZHOU_POLICY_RECORDS.length,17,'preserve the other eight Guizhou regions');
assert.equal(GUIZHOU_HOUSING_RECORDS.length,5,'preserve Tongren housing');
assert.equal(getTalentCitySnapshot('贵阳').policyCount,9);
assert.equal(getTalentCitySnapshot('贵阳').housingCount,4);
assert.equal(TALENT_POLICY_RECORDS.filter(p=>p.city==='贵阳').length,9);
assert.equal(TALENT_HOUSING_RECORDS.filter(p=>p.city==='贵阳').length,4);
assert.equal(new Set(gy.map(x=>x.id)).size,9);
assert.equal(new Set(gyh.map(x=>x.id)).size,4);
for(const p of gy){
 assert.ok(p.eligibility.length>80&&p.materials.length>=4&&p.applicationSteps.length>=5,p.id);
 assert.ok(p.sourceUrl.startsWith('https://')&&p.reviewNote,p.id);
 assert.ok(p.targetGroup&&p.headlineAmount&&p.headlineUnit,p.id);
 assert.equal(talentSourceKind(p.sourceUrl),'government','official primary source: '+p.id);
 assert.equal(assessPolicy(p,'2026-10-31').grade,'B','not A-certified: '+p.id);
 const guide=buildGuizhouGuide('policy',p.id);
 assert.ok(guide&&guide.city==='贵阳'&&guide.steps.length>=5&&guide.faq.length>=10);
 assert.ok(guide.branches.eligible&&guide.branches.other&&guide.branches.verify);
 assert.equal(guide.sources[0][1],p.sourceUrl);
 assert.ok(guizhouGuideUrl('policy',p.id).includes(p.id));
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1,'duplicate policy');
}
for(const h of gyh){
 assert.ok(h.steps.length>=4&&h.statusNote.includes('申报入口待核实'),h.id);
 assert.ok(/空房|房源/.test(h.statusNote),'must disclaim real-time vacancy: '+h.id);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.equal(assessHousing(h,'2026-10-31').grade,'B');
 const g=buildGuizhouGuide('housing',h.id);
 assert.ok(g&&g.faq.length>=10&&g.steps.length>=4);
}
const settle=gy.find(p=>p.id==='gz-guiyang-2026-settlement-allowance');
assert.ok(settle?.benefit.includes('6万元')&&settle?.benefit.includes('4.8万元')&&settle?.benefit.includes('2.4万元')&&settle?.benefit.includes('1.2万元'));
assert.ok(settle?.eligibility.includes('2年')&&settle?.eligibility.includes('6个月'));
assert.equal(settle?.payoutTo,'个人');
for(const id of ['gz-guiyang-2026-enterprise-salary-grant','gz-guiyang-2026-enterprise-event-recruitment','gz-guiyang-2026-flexible-recruiting']){
 const p=gy.find(x=>x.id===id);
 assert.equal(p?.payoutTo,'用人单位','enterprise subsidy must never be presented as personal salary');
}
const autumn=gy.find(p=>p.id==='gz-guiyang-2026-autumn-public-recruitment');
assert.equal(autumn?.deadline,'2026-11-30');
assert.equal(autumn?.temporal,'policy');
assert.ok(autumn?.summary.includes('不是所有毕业生')&&autumn?.benefit.includes('不是')===false,'clear separation between autumn job postings and cash policy');
assert.equal(assessPolicy(autumn,'2026-12-01').grade,'C','past application window must auto archive');
assert.ok(gy.some(x=>x.category==='租房安居')&&gy.some(x=>x.category==='购房补贴')&&gy.some(x=>x.category==='生活补贴'));
assert.ok(gyh.some(h=>h.id==='gz-guiyang-2026-zhumeng-stay-program')&&gyh.some(h=>h.id==='gz-guiyang-rental-stipend-2026'));
assert.ok(!ACCEPTED_TALENT_CITIES.includes('贵阳'),'not automatically A-level certified');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("match.name==='贵阳'")&&routes.includes('policies.filter(p=>p.category===group)'));
assert.ok(routes.includes('guizhouGuideUrl(\'policy\',p.id)')&&routes.includes('guizhouGuideUrl(\'housing\',h.id)'));
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(list.includes('policy-guide-preview/guizhou/policy/'));
assert.ok(detail.includes('policy-guide-preview/guizhou/'));
console.log('GUIYANG_2026_FULL_CATALOG_OK: 9 official policies, 4 housing/short-stay records, categories+guides+deadline verified');
