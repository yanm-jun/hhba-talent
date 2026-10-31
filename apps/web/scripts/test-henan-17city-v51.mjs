import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
const cities=["郑州","开封","洛阳","平顶山","安阳","鹤壁","新乡","焦作","濮阳","许昌","漯河","三门峡","南阳","商丘","信阳","周口","驻马店"];
for(const city of cities){const entry=findTalentCity(city);assert.ok(entry&&entry.province==='河南省',city+' not in Henan');
const p=TALENT_POLICY_RECORDS.filter(x=>x.city===city&&x.id.startsWith('hn-'));
const h=TALENT_HOUSING_RECORDS.filter(x=>x.city===city&&x.id.startsWith('hn-'));
assert.equal(p.length,1,city+' missing policies');assert.equal(h.length,1,city+' missing housing');assert.ok(!ACCEPTED_TALENT_CITIES.includes(city));
for(const x of p){assert.equal(assessPolicy(x).sourceKind,'government',x.id+' not primary source');assert.ok(x.materials.length>=3&&x.applicationSteps.length>=4&&x.reviewNote.includes('办理入口待核实'));}
for(const x of h){assert.equal(assessHousing(x).sourceKind,'government',x.id+' not primary source');assert.ok(x.steps.length>=4&&x.statusNote.includes('不等于实时')&&x.statusNote.includes('申报入口待核验'));}
console.log('HENAN_CITY_V51_DATA_OK',city);}
const routes=fs.readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');assert.ok(routes.includes('buildCityPolicyConfig(city)'));assert.ok(routes.includes('TALENT_HOUSING_RECORDS.filter'));
console.log('HENAN_17_CITY_POLICY_AND_HOUSING_COMPLETE',cities.length);
