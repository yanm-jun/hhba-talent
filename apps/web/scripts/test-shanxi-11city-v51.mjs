import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,ACCEPTED_TALENT_CITIES} from '../src/data/talentQuality.ts';
const cities=["太原","大同","阳泉","长治","晋城","朔州","晋中","运城","忻州","临汾","吕梁"];
let pc=0,hc=0;
for(const city of cities){const reg=findTalentCity(city);assert.ok(reg&&reg.province==='山西省',city+' absent from Shanxi registry');
 const ps=TALENT_POLICY_RECORDS.filter(p=>p.city===city&&p.id.startsWith('sx-'));const hs=TALENT_HOUSING_RECORDS.filter(h=>h.city===city&&h.id.startsWith('sx-'));
 assert.equal(ps.length,2,city+' policies not fully imported');assert.equal(hs.length,1,city+' housing not imported');
 assert.ok(!ACCEPTED_TALENT_CITIES.includes(city),'No A certification without an independent full guide '+city);
 for(const p of ps){assert.equal(assessPolicy(p).sourceKind,'government',p.id+' official provenance');assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4&&p.reviewNote.includes('办理入口待核实'),p.id+' missing guide limits');}
 for(const h of hs){assert.equal(assessHousing(h).sourceKind,'government',h.id+' official provenance');assert.ok(h.steps?.length>=4&&h.statusNote.includes('不等于实时')&&h.statusNote.includes('申报入口待核验'),h.id+' unverified live inventory');}
 pc+=ps.length;hc+=hs.length;console.log('SHANXI_CITY_DATA_OK',city,ps.length,hs.length);}
 assert.equal(pc,22);assert.equal(hc,11);
 const page=fs.readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');assert.ok(page.includes('buildCityPolicyConfig(city)'),'Shared national city list missing');
 console.log('SHANXI_V51_11CITY_COMPLETE_DATA_INTEGRATION',pc,hc);
