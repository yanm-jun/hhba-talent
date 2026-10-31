import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,findTalentCity,findTalentProvince,queryTalentCities,TALENT_HUNAN_AUTONOMOUS_PREFECTURES} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {buildHunanGuide} from '../src/data/hunanGuides.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
const cities=["长沙","株洲","湘潭","衡阳","邵阳","岳阳","常德","张家界","益阳","郴州","永州","怀化","娄底","湘西"];
assert.equal(cities.length,14);
assert.equal(TALENT_CITY_INDEX.length,306);
assert.equal(TALENT_HUNAN_AUTONOMOUS_PREFECTURES.length,1);
assert.equal(findTalentProvince('湖南')?.official,'湖南省');
assert.equal(queryTalentCities('湖南').length,14);
assert.equal(queryTalentCities('','湖南省').length,14);
assert.equal(findTalentCity('湘西土家族苗族自治州')?.name,'湘西');
assert.equal(findTalentCity('xiangxi')?.code,'433100');
const policies=TALENT_POLICY_RECORDS.filter(x=>x.id.startsWith('hn-'));
const housing=TALENT_HOUSING_RECORDS.filter(x=>x.id.startsWith('hn-'));
assert.equal(policies.length,56,'14x3 province policies +14 locally oriented records');
assert.equal(housing.length,28,'14x2 province housing policy references');
assert.equal(new Set([...policies,...housing].map(x=>x.id)).size,84);
assert.equal(policies.filter(x=>x.id.includes('-prov-')).length,42);
assert.equal(policies.filter(x=>x.id.includes('-local-')).length,14);
const early=new Set(['长沙','株洲','湘潭','衡阳','岳阳']);
for(const city of cities){
 assert.equal(findTalentCity(city)?.name,city,city);
 const cp=policies.filter(p=>p.city===city),ch=housing.filter(h=>h.city===city);
 assert.equal(cp.length,4,city+' missing province or local policies');
 assert.equal(ch.length,2,city+' missing provincial one-room/youth-station housing');
 assert.equal(cp.filter(p=>p.id.includes('-prov-')).length,3);
 for(const p of cp){
   assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' government primary source');
   assert.ok(p.summary?.length>=45&&p.eligibility?.length>=70&&p.benefit?.length>=50,p.id+' insufficient evidence or qualification');
   assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=5,p.id+' steps/materials missing');
   assert.ok(p.reviewNote?.includes('办理入口待核实'),p.id+' real apply caveat absent');
   assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A',p.id+' cannot be A');
   const guide=buildHunanGuide(p.id);
   assert.ok(guide&&guide.steps.length>=5&&guide.faq.length>=5&&guide.qualityLevel!=='A',p.id+' guide broken');
 }
 for(const h of ch){
   assert.equal(talentSourceKind(h.sourceUrl),'government',h.id);
   assert.equal(h.kind,'program','program cannot impersonate a live apartment');
   assert.ok(h.steps.length>=5&&h.statusNote.includes('非实时')&&h.statusNote.includes('申报入口未公布'),h.id);
   assert.notEqual(assessHousing(h,'2026-10-31').grade,'A',h.id);
   if(h.id.includes('one-room'))assert.ok(h.statusNote.includes(early.has(city)?'首批5市':'其余9市州'),h.id);
 }
}
const changsha=policies.find(p=>p.city==='长沙'&&p.id.includes('-local-'));
assert.ok(changsha?.benefit.includes('3万元'),'Changsha locally relevant support absent');
const zhuzhou=policies.find(p=>p.city==='株洲'&&p.id.includes('-local-'));
assert.equal(zhuzhou?.deadline,'2026-10-26');
assert.equal(zhuzhou?.temporal,'past-window');
const financing=policies.find(p=>p.id.includes('prov-finance-'));
assert.equal(financing?.payoutTo,'非现金贷款');
assert.ok(![...policies,...housing].some(x=>JSON.stringify(x).includes('${')),'Uninterpolated template text');
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("p.id.startsWith('hn-')"));
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("fragments[2]==='hunan'"));
assert.ok(read('pages/TalentCityDirectory.tsx').includes('totals.hunan'));
console.log('PASS Hunan V5.1: 14 regions, 56 policy records, 28 housing programmes, 56 real routed B/C guides, 306 nationwide index entries.');
