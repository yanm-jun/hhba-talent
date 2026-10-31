import assert from 'node:assert/strict';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_CITY_INDEX,queryTalentCities,findTalentCity} from '../src/data/talentCityRegistry.ts';
import {buildYunnanGuide} from '../src/data/yunnanGuides.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {readFileSync} from 'node:fs';
const regions=["昆明","曲靖","玉溪","保山","昭通","丽江","普洱","临沧","楚雄","红河","文山","西双版纳","大理","德宏","怒江","迪庆"];
assert.equal(regions.length,16);
const all=new Set(TALENT_CITY_INDEX.map(x=>x.name));
assert.equal(TALENT_CITY_INDEX.length,306,'293 prefecture cities + 4 municipalities + 8 Yunnan prefectures + 1 Hubei Enshi autonomous prefecture');
assert.equal(new Set(queryTalentCities('','云南省').map(x=>x.name)).size,16);
const policies=TALENT_POLICY_RECORDS.filter(x=>x.id.startsWith('yn-'));
const housing=TALENT_HOUSING_RECORDS.filter(x=>x.id.startsWith('yn-'));
assert.equal(policies.length,51,'16x3 province policies plus 3 city-specific');
assert.equal(housing.length,37,'16x2 provincial programs plus 3 local programs and 2 located rental projects');
assert.equal(new Set([...policies,...housing].map(x=>x.id)).size,88);
for(const city of regions){
 assert.ok(all.has(city),'City index missing '+city);
 assert.equal(findTalentCity(city)?.name,city);
 assert.ok(policies.filter(x=>x.city===city).length>=3,'Province policy coverage '+city);
 assert.ok(housing.filter(x=>x.city===city).length>=2,'Province housing coverage '+city);
 for(const p of policies.filter(x=>x.city===city)){
  assert.equal(talentSourceKind(p.sourceUrl),'government',p.id);
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,p.id+' incomplete');
  assert.ok(p.reviewNote?.includes('办理入口待核实'),p.id+' portal status missing');
  assert.ok(!p.id.includes('provincial-')||p.title.includes('云南省统一政策'),p.id+' provincial scope must be clear');
  assert.ok(['B','C'].includes(assessPolicy(p,'2026-10-31').grade),p.id+' must not claim certified A');
  const g=buildYunnanGuide(p.id);assert.ok(g&&g.steps.length>=4&&g.faq.length>=3&&g.qualityLevel!=='A',p.id+' guide missing');
 }
 for(const h of housing.filter(x=>x.city===city)){
  assert.equal(talentSourceKind(h.sourceUrl),'government',h.id);
  if(h.id.includes('qujing-'))assert.equal(h.kind,'project'); else assert.equal(h.kind,'program');
  assert.ok(h.statusNote.includes('非实时'),h.id);
  assert.ok(h.applyUrl||h.statusNote.includes('申报入口未公布'),h.id+' portal evidence');
  if(h.id.includes('provincial-'))assert.equal(h.housingCategory,h.id.includes('public-rental')?'公共租赁住房':'保障性租赁住房');
  assert.ok(h.steps.length>=4&&h.units.includes('非实时'),h.id);
  assert.equal(assessHousing(h,'2026-10-31').grade,'B',h.id);
 }
}
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("fragments[2]==='yunnan'"));
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("p.id.startsWith('yn-')"));
assert.ok(read('pages/TalentCityDirectory.tsx').includes('totals.autonomous'));
assert.ok(!policies.some(x=>x.sourceUrl.includes('example.com')||x.sourceUrl.startsWith('http:')));
assert.ok(![...policies,...housing].some(x=>JSON.stringify(x).includes('${')),'Uninterpolated template variable in published text');
assert.equal(policies.filter(p=>p.id.includes('-provincial-grassroots-2026')).length,16);
for(const key of ['yn-533400-diqing-purchase-affordable','yn-530900-lincang-purchase-affordable','yn-532500-honghe-talent-apartment-service','yn-530300-qujing-zefujia','yn-530300-qujing-kangjurui'])assert.ok(housing.some(h=>h.id===key),key);
console.log('PASS Yunnan V5.1: 16 prefectures/cities, 51 policy records, 37 housing records, 51 shared B/C guides, government source gates.');
