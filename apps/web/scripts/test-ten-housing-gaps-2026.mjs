import assert from 'node:assert/strict';
import {HOUSING_TEN_CITY_OFFICIAL_RECORDS_20261101 as official} from '../src/data/housingTenCityOfficialRecords20261101.ts';
import {HOUSING_TEN_CITY_RESEARCH_LEADS_20261101 as leads} from '../src/data/housingTenCityResearchLeads20261101.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
const targets=['鞍山','丹东','锦州','铁岭','葫芦岛','日照','聊城','菏泽','邢台','海北'];
assert.equal(targets.length,10);
assert.deepEqual(new Set(official.map(x=>x.city)),new Set(['鞍山','丹东','锦州','葫芦岛']));
assert.deepEqual(new Set(leads.map(x=>x.city)),new Set(['铁岭','日照','菏泽','邢台','海北']));
for(const city of targets){
 assert.ok(TALENT_CITY_INDEX.some(x=>x.name===city),'City registry missing '+city);
 assert.ok(TALENT_HOUSING_RECORDS.some(x=>x.city===city)||TALENT_HOUSING_RESEARCH_LEADS.some(x=>x.city===city),'Housing evidence missing city '+city);
}
const all=[...official,...leads];
assert.equal(new Set(all.map(x=>x.id)).size,all.length);
for(const h of official){
 assert.equal(talentSourceKind(h.sourceUrl),'government','Government source expected '+h.id);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
 assert.ok(h.eligibility.length>50&&h.steps.length>=5);
 assert.ok(h.statusNote.includes('申报入口待核实')&&/房源|空房|待核实/.test(h.statusNote));
 assert.ok(!TALENT_HOUSING_RESEARCH_LEADS.some(x=>x.id===h.id));
 assert.ok(getTalentCitySnapshot(h.city).housingCount>=1);
 assert.notEqual(assessHousing(h,'2026-11-01').grade,'A','Do not fake fully accepted housing');
}
for(const city of ['鞍山','锦州']){
 const row=official.find(x=>x.city===city);
 assert.equal(assessHousing(row,'2026-11-01').grade,'C',city+' 2012 historical law is not current 2026 law');
 assert.ok(row.statusNote.includes('历史')&&row.sourceUrl.includes('ln.gov.cn'));
}
for(const city of ['丹东','葫芦岛'])assert.equal(assessHousing(official.find(x=>x.city===city),'2026-11-01').grade,'B');
for(const x of leads){
 assert.equal(TALENT_HOUSING_RECORDS.filter(y=>y.id===x.id).length,0,x.id+' research must not become government-only housing');
 assert.ok(TALENT_HOUSING_RESEARCH_LEADS.some(y=>y.id===x.id));
 assert.ok(x.steps.length>=5&&x.statusNote.length>60);
}
assert.ok(TALENT_HOUSING_RESEARCH_LEADS.some(x=>x.city==='聊城'&&x.id==='lc-jingkai-2026-batches-lead'),'Liaocheng already has official-publication research and must retain it');
assert.ok(!official.some(x=>['铁岭','日照','聊城','菏泽','邢台','海北'].includes(x.city)),'Secondary sources must not count as primary');
console.log('HHBA_2026_TEN_HOUSING_GAP_EVIDENCE_OK',JSON.stringify({cities:10,officialCityRecords:4,recordedButHistorical:2,researchCities:6,currentlyConfirmedVacantRooms:0}));
