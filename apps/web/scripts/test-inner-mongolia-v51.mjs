import assert from 'node:assert/strict';
import {TALENT_CITY_INDEX,findTalentCity,queryTalentCities,findTalentProvince} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {buildInnerMongoliaGuide} from '../src/data/innerMongoliaGuides.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
import {readFileSync} from 'node:fs';
const cities=["呼和浩特","包头","乌海","赤峰","通辽","鄂尔多斯","呼伦贝尔","巴彦淖尔","乌兰察布","兴安盟","锡林郭勒盟","阿拉善盟"];
assert.equal(cities.length,12);
assert.equal(TALENT_CITY_INDEX.length,312);
assert.equal(findTalentProvince('内蒙古')?.official,'内蒙古自治区');
assert.equal(queryTalentCities('内蒙古').length,12);
assert.equal(queryTalentCities('','内蒙古自治区').length,12);
for(const q of ['兴安盟','锡林郭勒盟','阿拉善盟'])assert.equal(findTalentCity(q)?.name,q);
const policies=TALENT_POLICY_RECORDS.filter(p=>p.id.startsWith('nm-'));
const houses=TALENT_HOUSING_RECORDS.filter(h=>h.id.startsWith('nm-'));
assert.equal(policies.length,37);
assert.equal(houses.length,33);
assert.equal(new Set([...policies,...houses].map(x=>x.id)).size,70);
for(const city of cities){
 assert.equal(findTalentCity(city)?.name,city);
 const pr=policies.filter(p=>p.city===city),hr=houses.filter(h=>h.city===city);
 assert.equal(pr.length,city==='赤峰'?4:3,'2 region-wide + city-specific records: '+city);
 assert.ok(hr.length>=2,'housing records '+city);
 assert.equal(pr.filter(x=>x.id.includes('-province-')).length,2);
 for(const p of pr){
   assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' official government source only');
   assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,p.id+' incomplete guide');
   assert.ok(p.reviewNote?.includes('办理入口待核实'),p.id+' application must remain unverified');
   assert.ok(p.eligibility.length>=45,p.id+' eligibility too short');
   const grade=assessPolicy(p,'2026-10-31').grade;assert.ok(['B','C'].includes(grade),p.id+' false A or D');
   const guide=buildInnerMongoliaGuide(p.id);assert.ok(guide&&guide.steps.length>=4&&guide.faq.length>=5,p.id+' no actual linked guide');
 }
 for(const h of hr){
   assert.equal(talentSourceKind(h.sourceUrl),'government',h.id);
   assert.ok(h.steps.length>=4&&h.statusNote.includes('非实时'),h.id+' housing disclosure');
   assert.ok(h.statusNote.includes('申报入口未公布')||h.statusNote.includes('申请入口未公布'),h.id+' portal caveat');
   assert.ok(['B','C'].includes(assessHousing(h,'2026-10-31').grade),h.id+' incorrect housing quality');
   assert.equal(h.kind,'program','Housing program != apartment building: '+h.id);
 }
}
assert.equal(policies.filter(x=>x.id.includes('-province-')).length,24);
assert.equal(houses.filter(x=>x.id.includes('-autonomous-')).length,24);
assert.ok(![...policies,...houses].some(x=>JSON.stringify(x).includes('${')),'Unrendered template variable');
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
assert.ok(read('pages/TalentServiceRoutes.tsx').includes("fragments[2]==='inner-mongolia'"));
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("'nm-'"));
assert.ok(read('pages/TalentCityDirectory.tsx').includes('totals.leagues'));
console.log('PASS Inner Mongolia V5.1 12 regions, 37 policies (24 province shared), 33 housing reference programs, 37 B/C guides and 308 national entries.');
