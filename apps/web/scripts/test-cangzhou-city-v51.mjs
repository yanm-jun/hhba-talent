import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CANGZHOU_POLICY_RECORDS} from '../src/data/cangzhouPolicyRecords.ts';
import {CANGZHOU_HOUSING_RECORDS} from '../src/data/cangzhouHousingRecords.ts';
import {CANGZHOU_HOUSING_LEADS} from '../src/data/cangzhouHousingLeads.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
import {cangzhouLivingGuide,cangzhouPurchaseGuide,cangzhouHousingGuide} from '../src/data/cangzhouGuides.ts';
const policy=CANGZHOU_POLICY_RECORDS,housing=CANGZHOU_HOUSING_RECORDS,leads=CANGZHOU_HOUSING_LEADS;
assert.equal(policy.length,3);assert.equal(housing.length,1);assert.equal(leads.length,2);
assert.equal(new Set([...policy,...housing,...leads].map(x=>x.id)).size,6);
assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.city==='沧州').length,3);
assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.city==='沧州').length,1);
assert.equal(TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='沧州').length,2);
assert.equal(findTalentCity('cangzhou')?.name,'沧州');
assert.equal(findTalentCity('沧州')?.name,'沧州');
for(const p of policy){
 assert.ok(p.sourceUrl.startsWith('https://') && p.materials?.length>=3 && p.applicationSteps?.length>=4);
 assert.ok(p.reviewNote?.includes('办理入口待核实'));
 assert.equal(p.applicationUrl,undefined);
 assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A');
}
for(const h of housing){
 assert.equal(h.kind,'program');
 assert.ok(h.steps.length>=4 && h.eligibility && h.statusNote.includes('不等于'));
 assert.notEqual(assessHousing(h,'2026-10-31').grade,'A');
}
for(const l of leads) {
 assert.ok(l.steps.length>=4 && l.statusNote && l.units);
 assert.ok(!TALENT_HOUSING_RECORDS.some(h=>h.id===l.id),'unverified housing must not be published as verified stock');
}
for(const g of [cangzhouLivingGuide,cangzhouPurchaseGuide,cangzhouHousingGuide]){
 assert.equal(g.city,'沧州');assert.equal(g.qualityLevel,'B');
 assert.ok(g.steps.length>=6 && g.faq.length>=4 && Object.keys(g.branches).length>=2);
 assert.equal(g.officialUrl,undefined,'unverified applicant portal should not be linked as verified');
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("fragments[2]==='cangzhou'"));
assert.ok(routes.includes("match.name==='沧州'"));
assert.equal(assessTalentCity('沧州','2026-10-31').accepted,false);
console.log('CANGZHOU V5.1: policies 3 / housing program 1 / source-labeled housing leads 2 / guides 3 / route and search OK');
