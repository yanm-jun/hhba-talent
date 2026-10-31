// HHBA 承德市 V5.1：政府政策、收款主体、安居制度与非实时房源防回退验收。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
import {findTalentCity,parseTalentCityQuery} from '../src/data/talentCityRegistry.ts';
const policies=TALENT_POLICY_RECORDS.filter(p=>p.city==='承德');
const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city==='承德');
const p=id=>policies.find(x=>x.id===id);
const h=id=>homes.find(x=>x.id===id);
let passed=0;const check=(label,fn)=>{fn();passed++;console.log('PASS '+label)};
check('2026 Chengde city route, official primary sources and policy record contracts',()=>{
 assert.equal(findTalentCity('承德市')?.name,'承德');
 assert.equal(parseTalentCityQuery('承德市人才政策','北京').city,'承德');
 assert.equal(policies.length,7);
 assert.equal(new Set(policies.map(x=>x.id)).size,7);
 for(const x of policies){
  assert.equal(talentSourceKind(x.sourceUrl),'government',x.id);
  assert.ok(x.title&&x.eligibility&&x.benefit&&x.application&&x.reviewedAt,x.id);
  assert.ok(x.materials?.length>=3&&x.applicationSteps?.length>=4,x.id);
  assert.match(x.reviewNote,/办理入口待核实/,x.id);
  assert.notEqual(assessPolicy(x,'2026-10-31').grade,'A',x.id+' must not be auto-certified');
 }
});
check('Distinguish 2026 living and rental aid from cashless services or historical offers',()=>{
 assert.equal(p('cd-2026-industry-talent-rent').category,'租房安居');
 assert.ok(p('cd-2026-industry-talent-rent').benefit.includes('1000')&&p('cd-2026-industry-talent-rent').benefit.includes('2000'));
 assert.ok(p('cd-2026-industry-talent-living').benefit.includes('1万')&&p('cd-2026-industry-talent-living').benefit.includes('3万'));
 for(const id of ['cd-2026-industry-talent-rent','cd-2026-industry-talent-living']){
  assert.ok(p(id).eligibility.includes('5年')||p(id).eligibility.includes('5年以上'));
 }
 assert.equal(p('cd-2026-yanzhao-service-card').payoutTo,'非现金服务');
 assert.equal(p('cd-2025-guaranteed-home-talent').payoutTo,'住房折扣');
 assert.equal(p('cd-2024-municipal-masters-doctors-historical').temporal,'historical');
 assert.equal(assessPolicy(p('cd-2024-municipal-masters-doctors-historical'),'2026-10-31').grade,'C');
 assert.equal(assessPolicy(p('cd-2024-tax-subsidy-suspended'),'2026-10-31').grade,'C');
 assert.ok(p('cd-2024-tax-subsidy-suspended').benefit.includes('停止'));
});
check('Official housing policies exist and never imply a currently available independent building',()=>{
 assert.equal(homes.length,3);
 for(const id of ['cd-2025-talent-affordable-home-sale','cd-2023-beijing-tianjin-scitech-apartment','cd-2026-new-resident-rental-security']){
  const x=h(id);assert.ok(x,id);
  assert.equal(talentSourceKind(x.sourceUrl),'government',id);
  assert.equal(x.kind,'program',id);
  assert.ok(x.steps.length>=4&&x.eligibility&&x.rent&&x.address,id);
  assert.match(x.statusNote,/(不等于|非实时)/,id);
  assert.match(x.statusNote,/申报入口待核实/,id);
  assert.notEqual(assessHousing(x,'2026-10-31').grade,'A');
 }
 assert.equal(homes.filter(x=>x.kind==='project').length,0,'Unverified building cannot be called a real project');
});
check('Unified policy, housing, search and visibility remain V5.1 (no standalone city JSX)',()=>{
 const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
 const index=readFileSync(new URL('../src/data/talentCityRegistry.ts',import.meta.url),'utf8');
 assert.ok(route.includes('(!housingMode||isHousingPolicy(p))'));
 assert.ok(route.includes("housingPrograms=resultHomes.filter(p=>p.kind==='program')"));
 assert.ok(index.includes("name==='承德'?'已收录2026年主导产业租房与一次性生活补助"));
 assert.equal(assessTalentCity('承德','2026-10-31').accepted,false,'Only certified A cities accepted');
});
console.log(JSON.stringify({city:'承德',passed,policies:policies.length,housingPrograms:homes.length,verifiedBuildings:0},null,2));
