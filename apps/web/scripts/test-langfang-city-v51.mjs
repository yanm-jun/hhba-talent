import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGFANG_POLICY_RECORDS as P} from '../src/data/langfangPolicyRecords.ts';
import {LANGFANG_HOUSING_RECORDS as H} from '../src/data/langfangHousingRecords.ts';
import {LANGFANG_HOUSING_LEADS as L} from '../src/data/langfangHousingLeads.ts';
import {TALENT_POLICY_RECORDS as ALLP} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS as ALLH} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS as ALLL} from '../src/data/talentHousingResearch.ts';
import {assessPolicy,assessHousing,assessTalentCity,talentSourceKind} from '../src/data/talentQuality.ts';
import {langfangRentGuide,langfangBuyGuide,langfangHousingGuide,langfangProvidentGuide} from '../src/data/langfangGuides.ts';
const city='廊坊';
assert.equal(P.length,4,'Four direct-source government policies, including 2026 A/B-card loan');
assert.equal(H.length,2,'Two government-backed housing programs, not fake projects');
assert.equal(L.length,2,'Two clearly downgraded independent apartment news leads');
for(const p of P){
 assert.ok(ALLP.some(q=>q.id===p.id),'Policy must be visible in national city index');
 assert.equal(p.city,city);assert.equal(talentSourceKind(p.sourceUrl),'government');
 assert.ok(p.applicationSteps.length>=4&&p.materials.length>=3);
 assert.ok(p.reviewNote.includes('办理入口待核实'));
 assert.equal(assessPolicy(p,'2026-10-31').grade,p.id.startsWith('lf-2025')?'C':'B');
}
for(const h of H){
 assert.ok(ALLH.some(q=>q.id===h.id));
 assert.equal(h.city,city);assert.equal(h.kind,'program');
 assert.equal(talentSourceKind(h.sourceUrl),'government');
 assert.ok(h.steps.length>=4);assert.ok(h.statusNote.includes('申报入口待核实'));
 assert.equal(assessHousing(h,'2026-10-31').grade,'B');
}
for(const lead of L){
 assert.ok(ALLL.some(q=>q.id===lead.id));
 assert.ok(!ALLH.some(q=>q.id===lead.id));
 assert.ok(lead.steps.length>=4&&lead.statusNote&&lead.units);
}
for(const [slug,g] of [['rent',langfangRentGuide],['buy',langfangBuyGuide],['housing',langfangHousingGuide],['provident',langfangProvidentGuide]]){
 assert.equal(g.city,city);
 assert.ok(g.steps.length>=5&&g.faq.length>=5&&g.checks.length>=5);
 assert.ok(g.sources.length>=1&&Object.keys(g.branches).length>=3);
 for(const s of g.steps) assert.ok(s.title&&s.why&&s.action&&s.done);
 assert.equal(g.qualityLevel,['housing','provident'].includes(slug)?'B':'C');
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const registry=readFileSync(new URL('../src/data/talentCityRegistry.ts',import.meta.url),'utf8');
assert.ok(routes.includes("match.name==='廊坊'"));
assert.ok(routes.includes("fragments[2]==='langfang'"));
for(const slug of ['rent','buy','housing','provident'])assert.ok(routes.includes('/talent-service/policy-guide-preview/langfang/'+slug));
assert.ok(registry.includes("name:'廊坊'"));
const loan=P.find(p=>p.id==='lf-2026-yanzhao-ab-provident-loan');
assert.ok(loan&&loan.payoutTo==='非现金贷款'&&loan.headlineUnit.includes('须还本息'));
assert.ok(langfangProvidentGuide.desc.includes('绝非无偿领取'));
assert.ok(langfangProvidentGuide.faq.some(([q,a])=>q.includes('补贴')&&a.includes('不是')));
assert.equal(assessTalentCity(city,'2026-10-31').accepted,false,'No fake V5.1 city completion');
console.log('PASS Langfang V5.1 city: 4 official policies, 2 housing programs, 2 housing research leads, 4 detailed guides, no false live vacancy');
