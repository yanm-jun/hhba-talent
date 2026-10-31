import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHANXI_POLICY_RECORDS} from '../src/data/shanxiPolicyRecords.ts';
import {SHANXI_HOUSING_RECORDS} from '../src/data/shanxiHousingRecords.ts';
import {SHANXI_CITIES,getShanxiGuide} from '../src/data/shanxiGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
const cities=[...SHANXI_CITIES];
assert.equal(cities.length,11);
assert.equal(queryTalentCities('','山西省').length,11);
assert.equal(SHANXI_POLICY_RECORDS.length,25);
assert.equal(SHANXI_HOUSING_RECORDS.length,15);
assert.equal(new Set(SHANXI_POLICY_RECORDS.map(x=>x.id)).size,25);
assert.equal(new Set(SHANXI_HOUSING_RECORDS.map(x=>x.id)).size,15);
for(const city of cities){
 assert.equal(findTalentCity(city+'市')?.name,city);
 const p=TALENT_POLICY_RECORDS.filter(x=>x.city===city&&x.id.startsWith('sx-'));
 const h=TALENT_HOUSING_RECORDS.filter(x=>x.city===city&&x.id.startsWith('sx-'));
 assert.ok(p.length>=2&&h.length>=1,city+' policy and housing coverage');
 for(const r of p){assert.ok(r.materials?.length>=3&&r.applicationSteps?.length>=4&&r.sourceUrl.includes('.gov.cn'));const g=getShanxiGuide('policy',r.id);assert.ok(g&&g.qualityLevel!=='A'&&g.steps.length>=4);}
 for(const r of h){assert.equal(r.kind,'program');assert.ok(r.steps.length>=4);const g=getShanxiGuide('housing',r.id);assert.ok(g&&g.qualityLevel!=='A');}
}
const route=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(route.includes("fragments[2]==='shanxi'")&&route.includes('getShanxiGuide('));
assert.ok(detail.includes("shanxiGuideUrl('policy'")&&detail.includes("shanxiGuideUrl('housing'"));
console.log('Shanxi V5.1 contracts passed: 11 cities, 25 policy records, 15 housing programs, 40 guides');
