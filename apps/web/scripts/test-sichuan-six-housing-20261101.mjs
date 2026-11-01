import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SICHUAN_HOUSING_GAP_2026_COUNTY_OFFICIAL} from '../src/data/sichuanHousingGap2026CountyOfficial.ts';
import {SICHUAN_HOUSING_GAP_2026_RESEARCH_LEADS} from '../src/data/sichuanHousingGap2026ResearchLeads.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
const matrix=JSON.parse(readFileSync(new URL('../../../docs/TALENT_HOUSING_26REGIONS_EVIDENCE_MATRIX_20261101.json',import.meta.url),'utf8'));
const six=['攀枝花','泸州','绵阳','遂宁','内江','凉山'];
const luzhou=SICHUAN_HOUSING_GAP_2026_COUNTY_OFFICIAL.find(h=>h.city==='泸州');
assert.ok(luzhou,'Luzhou municipal government-published historical rule missing');
assert.equal(luzhou.kind,'program');
assert.equal(luzhou.published,'2023-12-22','do not label historical government cross-post as 2026 original');
assert.ok(luzhou.sourceUrl.includes('jiangjin.gov.cn'));
assert.ok(/2026.*效力/.test(luzhou.statusNote),'old regulation must disclose 2026 unknown validity');
assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.id===luzhou.id),'Luzhou record not indexed nationally');
assert.deepEqual(new Set(SICHUAN_HOUSING_GAP_2026_RESEARCH_LEADS.map(x=>x.city)),new Set(six.filter(x=>x!=='泸州')));
for(const c of six){
 const row=matrix.records.find(x=>x.city===c&&x.province==='四川省');
 assert.ok(row,'Missing Sichuan 26-region audit row for '+c);
 assert.equal(row.liveVacancyVerified,false,'No 2026-11 real-time vacancies verified for '+c);
 if(c==='泸州'){
   assert.equal(row.formalOldPolicyIndexed,true);
   assert.equal(row.originalIssuingAuthority2026Valid,false);
 }else{
   const h=SICHUAN_HOUSING_GAP_2026_RESEARCH_LEADS.find(x=>x.city===c);
   assert.ok(h&&h.sourceUrl.startsWith('https://'));
   assert.ok(h.steps.length>=5&&h.eligibility.length>=35&&h.statusNote.length>=35,'Insufficient detailed research '+c);
   assert.ok(TALENT_HOUSING_RESEARCH_LEADS.some(x=>x.id===h.id),'City research UI missing lead '+c);
   assert.ok(!TALENT_HOUSING_RECORDS.some(x=>x.id===h.id),'Research lead illegally promoted to formal housing '+c);
   assert.equal(row.researchLeadInCityPage,true);
 }
}
console.log('四川6地住房专项：泸州政府跨省旧版完整制度1条 + 其余5地独立2026住房线索卡片；缺官方2026原文或当前空房的，不虚报完整验收。');
