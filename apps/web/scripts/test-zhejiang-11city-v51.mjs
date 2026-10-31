import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
import {findTalentCity,parseTalentCityQuery} from '../src/data/talentCityRegistry.ts';
const cities=['杭州','宁波','温州','嘉兴','湖州','绍兴','金华','衢州','舟山','台州','丽水'];
const ids=new Set();const baseline=JSON.parse(fs.readFileSync(new URL('../src/data/talentBaselineIds.json',import.meta.url),'utf8'));const legacyPolicies=new Set(baseline.policyIds),legacyHomes=new Set(baseline.housingIds);let totalPolicy=0,totalHousing=0;
for(const city of cities){
 const entry=findTalentCity(city);
 assert.ok(entry&&entry.province==='浙江',city+' not indexed in Zhejiang');
 const ps=TALENT_POLICY_RECORDS.filter(p=>p.city===city);
 const hs=TALENT_HOUSING_RECORDS.filter(h=>h.city===city);
 assert.ok(ps.length>=1,city+' missing policies');assert.ok(hs.length>=1,city+' missing housing');
 assert.ok(!ACCEPTED_TALENT_CITIES.includes(city),'Uncertified city marked accepted '+city);
 for(const p of ps){
  assert.ok(!ids.has(p.id),'Duplicate record ID '+p.id);ids.add(p.id);
  if(legacyPolicies.has(p.id))continue;
  assert.ok(p.sourceUrl.startsWith('https://'),p.id+' bad source');
  assert.equal(assessPolicy(p).sourceKind,'government',p.id+' non-primary source');
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,p.id+' incomplete minimum details');
  assert.ok(p.reviewNote.includes('待核')||p.reviewNote.includes('2026'),p.id+' no provenance caveat');
  if(city==='台州')assert.ok(!p.title.includes('泰州'),p.id+' confused with Jiangsu Taizhou');
 }
 for(const h of hs){assert.ok(!ids.has(h.id),'Duplicate record ID '+h.id);ids.add(h.id);
  if(legacyHomes.has(h.id))continue;
  assert.equal(assessHousing(h).sourceKind,'government',h.id+' non-primary source');
  assert.ok(h.steps?.length>=4&&h.statusNote.includes('申报入口待核验'),h.id+' false housing availability');}
 totalPolicy+=ps.length;totalHousing+=hs.length;
 console.log('CITY',city,'policies',ps.length,'housing',hs.length,'province',entry.province);
}
const route=fs.readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(route.includes('buildCityPolicyConfig(city)'),'National shared list missing');
assert.ok(route.includes('TALENT_HOUSING_RECORDS.filter'),'Housing shared list missing');
console.log('ZHEJIANG_V51_11_CITIES_OK',cities.length,'POLICIES',totalPolicy,'HOUSING',totalHousing);
