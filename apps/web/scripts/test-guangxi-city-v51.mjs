import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUANGXI_POLICY_RECORDS,GUANGXI_CITY_CONTACTS} from '../src/data/guangxiPolicyRecords.ts';
import {GUANGXI_MUNICIPAL_POLICY_RECORDS} from '../src/data/guangxiMunicipalPolicyRecords.ts';
import {GUANGXI_MUNICIPAL_RESEARCH_RECORDS} from '../src/data/guangxiMunicipalResearch.ts';
import {GUANGXI_RENT_RESEARCH_RECORDS} from '../src/data/guangxiRentPolicyResearch.ts';
import {GUANGXI_HOUSING_RECORDS} from '../src/data/guangxiHousingRecords.ts';
import {GUANGXI_HOUSING_RESEARCH_LEADS} from '../src/data/guangxiHousingLeads.ts';
import {GUANGXI_14_CITIES,buildGuangxiGuide} from '../src/data/guangxiGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
const expected=['南宁','柳州','桂林','梧州','北海','防城港','钦州','贵港','玉林','百色','贺州','河池','来宾','崇左'];
assert.deepEqual(GUANGXI_CITY_CONTACTS.map(c=>c.city),expected);
assert.deepEqual(GUANGXI_14_CITIES,expected);
assert.equal(GUANGXI_POLICY_RECORDS.length,28);
assert.equal(GUANGXI_RENT_RESEARCH_RECORDS.length,14);
const allGuangxi=[...GUANGXI_POLICY_RECORDS,...GUANGXI_RENT_RESEARCH_RECORDS,...GUANGXI_MUNICIPAL_POLICY_RECORDS,...GUANGXI_MUNICIPAL_RESEARCH_RECORDS];
assert.equal(new Set(allGuangxi.map(p=>p.id)).size,allGuangxi.length,'Guangxi policy IDs unique');
for(const city of expected){
 const cityEntry=TALENT_CITY_INDEX.find(x=>x.name===city);
 assert.ok(cityEntry&&cityEntry.province==='广西壮族自治区',city+' city dictionary entry');
 const rows=TALENT_POLICY_RECORDS.filter(p=>p.city===city&&p.id.startsWith('gx-'));
 assert.ok(rows.length>=2,city+' provincial policies registered');
 assert.equal(rows.filter(p=>p.temporal==='past-window').length,1);
 const rent=GUANGXI_RENT_RESEARCH_RECORDS.find(p=>p.city===city);
 assert.ok(rent&&rent.category==='租房安居');
 assert.equal(talentSourceKind(rent.sourceUrl),'secondary',city+' rent news must not masquerade as government original');
 assert.equal(assessPolicy(rent,'2026-10-31').grade,'B',city+' unverified rent stays B');
 for(const p of rows){
  assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' government source');
  assert.ok(p.applicationSteps?.length>=4&&p.materials?.length>=3,p.id+' source and material quality');
  assert.ok(p.reviewedAt&&p.reviewNote&&p.targetGroup);
  assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A','A requires independent certification');
 }
 assert.equal(assessPolicy(rows.find(p=>p.temporal==='past-window'),'2026-10-31').grade,'C',city+' old recruitment must downgrade');
 for(const kind of ['purchase','rental','three-support']){
  const g=buildGuangxiGuide(city,kind);
  assert.equal(g.city,city);
  assert.ok(g.steps.length>=6&&g.steps.every(s=>s.title&&s.why&&s.action&&s.done),city+' '+kind+' steps');
  assert.ok(g.faq.length>=6&&Object.keys(g.branches).length>=2,city+' '+kind+' applicant branching and FAQs');
  assert.ok(g.sources?.length>0&&g.checks?.length>=4);
  assert.equal(g.qualityLevel,kind==='three-support'?'C':'B');
  assert.equal(g.officialUrl?kind:'no-portal',kind==='three-support'?'three-support':'no-portal',city+' direct registration portal cannot be fabricated');
 }
}
assert.equal(GUANGXI_MUNICIPAL_POLICY_RECORDS.length,1,'Current original-city evidence = 1');
assert.ok(TALENT_POLICY_RECORDS.find(p=>p.id==='gx-liuzhou-2026-2027-shortage-talents'),'Liuzhou actual municipal record indexed');
for(const p of GUANGXI_MUNICIPAL_RESEARCH_RECORDS){
 assert.equal(talentSourceKind(p.sourceUrl),'secondary',p.id+' original government file not authenticated');
 assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A',p.id+' cannot pretend A');
 assert.ok(p.reviewNote?.includes('待核实'),p.id+' caveat');
 assert.ok(p.applicationSteps?.length>=4&&p.materials?.length>=3);
}
assert.ok(GUANGXI_MUNICIPAL_RESEARCH_RECORDS.some(p=>p.city==='百色'));
assert.ok(GUANGXI_MUNICIPAL_RESEARCH_RECORDS.some(p=>p.city==='玉林'));
assert.ok(GUANGXI_MUNICIPAL_RESEARCH_RECORDS.some(p=>p.city==='钦州'));
assert.ok(GUANGXI_MUNICIPAL_RESEARCH_RECORDS.some(p=>p.city==='来宾'));
assert.equal(GUANGXI_HOUSING_RECORDS.length,1,'Only independently sourced 2026 Guilin housing program is formal');
const h=GUANGXI_HOUSING_RECORDS[0];
assert.equal(h.city,'桂林');
assert.equal(h.kind,'program','Guilin is a city qualification/program, not a specific rent apartment');
assert.equal(talentSourceKind(h.sourceUrl),'government');
assert.equal(assessHousing(h,'2026-10-31').grade,'B');
assert.ok(TALENT_HOUSING_RECORDS.some(x=>x.id===h.id));
assert.equal(GUANGXI_HOUSING_RESEARCH_LEADS.length,3,'Separate unverified Nanning Guilin Guigang housing lead');
for(const lead of GUANGXI_HOUSING_RESEARCH_LEADS){
 assert.ok(TALENT_HOUSING_RESEARCH_LEADS.some(x=>x.id===lead.id));
 assert.equal(TALENT_HOUSING_RECORDS.some(x=>x.id===lead.id),false,'No unverified lead in verified housing inventory');
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const listing=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("GUANGXI_14_CITIES.includes(match.name)"));
assert.ok(routes.includes("fragments[2]==='guangxi'"));
assert.ok(routes.includes("...GUANGXI_MUNICIPAL_RESEARCH_RECORDS"));
assert.ok(routes.includes("...GUANGXI_RENT_RESEARCH_RECORDS"));
assert.ok(routes.includes("GUANGXI_MUNICIPAL_RESEARCH_RECORDS.find("));
assert.ok(listing.includes("GUANGXI_MUNICIPAL_RESEARCH_RECORDS"));
assert.ok(listing.includes("p.id.endsWith('-graduate-housing-rent')"),'Municipal research does not link to unrelated regional guides');
assert.equal((routes.match(/<UnifiedPolicyGuide/g)||[]).length>=1,true,'Use existing V5.1 shared guide template');
console.log('✓ Guangxi 14 city registry, 42 provincial city views, 42 real shared-guide routes');
console.log('✓ 1 original local-policy record, 4 research local-policy leads, 1 verified city housing program, 3 clearly separate housing research leads');
console.log('✓ National search/list/housing integrations, source grades, expiry, NO false city acceptance');
console.log('GUANGXI:',JSON.stringify({cities:expected.length,provinceViews:GUANGXI_POLICY_RECORDS.length+GUANGXI_RENT_RESEARCH_RECORDS.length,municipalGovernment:GUANGXI_MUNICIPAL_POLICY_RECORDS.length,municipalResearch:GUANGXI_MUNICIPAL_RESEARCH_RECORDS.length,housingGov:GUANGXI_HOUSING_RECORDS.length,housingResearch:GUANGXI_HOUSING_RESEARCH_LEADS.length,qualityA:0}));
