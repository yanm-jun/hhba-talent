import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
const cities=["合肥","芜湖","蚌埠","淮南","马鞍山","淮北","铜陵","安庆","黄山","滁州","阜阳","宿州","六安","亳州","池州","宣城"];let policyCount=0,housingCount=0;const ids=new Set();
for(const city of cities){const reg=findTalentCity(city);assert.ok(reg&&reg.province==='安徽省',city+' city registry mismatch');
 const ps=TALENT_POLICY_RECORDS.filter(x=>x.city===city&&x.id.startsWith('ah-'));
 const hs=TALENT_HOUSING_RECORDS.filter(x=>x.city===city&&x.id.startsWith('ah-'));
 assert.equal(ps.length,2,city+' policy dataset incomplete');assert.equal(hs.length,1,city+' housing dataset missing');
 assert.ok(!ACCEPTED_TALENT_CITIES.includes(city),'No A grade without independently certified full process '+city);
 for(const p of ps){assert.ok(!ids.has(p.id),p.id+' duplicate');ids.add(p.id);assert.ok(p.sourceUrl.startsWith('https://'),p.id+' missing source');
  assert.ok(p.applicationSteps?.length>=5&&p.materials?.length>=3&&p.reviewNote?.includes('办理入口待核实'),p.id+' ungrounded application guide');
  assert.ok(p.benefit.length>=55&&p.eligibility.length>=45,p.id+' too shallow');}
 for(const h of hs){assert.ok(!ids.has(h.id),h.id+' duplicate');ids.add(h.id);
  assert.ok(h.sourceUrl.startsWith('https://'),h.id+' missing source');assert.ok(h.steps?.length>=5&&h.statusNote.includes('不等于实时空房')&&h.statusNote.includes('申报入口待核验'),h.id+' false housing availability');}
 console.log('ANHUI_V51_CITY_OK',city,ps.length,hs.length);policyCount+=ps.length;housingCount+=hs.length;}
assert.equal(policyCount,32);assert.equal(housingCount,16);
const pg=fs.readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');assert.ok(pg.includes('buildCityPolicyConfig(city)'));
assert.ok(pg.includes('TALENT_HOUSING_RECORDS.filter'));
console.log('ANHUI_V51_ALL_16_INTEGRATED',policyCount,housingCount);
