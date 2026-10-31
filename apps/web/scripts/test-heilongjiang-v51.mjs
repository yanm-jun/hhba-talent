import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,findTalentCity,findTalentProvince,queryTalentCities,TALENT_HEILONGJIANG_DISTRICTS} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {buildHeilongjiangGuide} from '../src/data/heilongjiangGuides.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
const cities=["哈尔滨","齐齐哈尔","鸡西","鹤岗","双鸭山","大庆","伊春","佳木斯","七台河","牡丹江","黑河","绥化","大兴安岭"];
assert.equal(cities.length,13,'12地级市+大兴安岭地区');
assert.equal(TALENT_CITY_INDEX.length,337,'national 305 + 大兴安岭地区');
assert.equal(TALENT_HEILONGJIANG_DISTRICTS.length,1);
assert.equal(findTalentProvince('黑龙江省')?.name,'黑龙江');
assert.equal(queryTalentCities('','黑龙江省').length,13);
assert.equal(queryTalentCities('黑龙江').length,13);
assert.equal(findTalentCity('大兴安岭地区')?.name,'大兴安岭');
assert.equal(findTalentCity('daxinganling')?.code,'232700');
const policies=TALENT_POLICY_RECORDS.filter(x=>x.id.startsWith('hlj-'));
const housing=TALENT_HOUSING_RECORDS.filter(x=>x.id.startsWith('hlj-'));
assert.equal(policies.length,52);
assert.equal(housing.length,32);
assert.equal(new Set([...policies,...housing].map(x=>x.id)).size,84);
assert.equal(policies.filter(x=>x.id.includes('-prov-')).length,39);
assert.equal(policies.filter(x=>x.id.includes('-local-')).length,13);
assert.equal(housing.filter(x=>x.id.includes('-housing-')).length,26);
assert.equal(housing.filter(x=>x.id.includes('-local-')).length,4);
assert.equal(housing.filter(x=>x.kind==='project').length,2);
assert.ok(housing.some(x=>x.address.includes('学府路56号'))&&housing.some(x=>x.address.includes('师专路98-1号')),'Known project locations missing');
for(const city of cities){
 assert.equal(findTalentCity(city)?.name,city);
 assert.equal(policies.filter(x=>x.city===city).length,4,city+' missing provincial or local item');
 assert.ok(housing.filter(x=>x.city===city).length>=2,city+' missing housing program');
 for(const p of policies.filter(x=>x.city===city)){
   assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' government URL required');
   assert.ok(p.summary?.length>=60&&p.eligibility?.length>=70&&p.benefit?.length>=35,p.id+' thin record');
   assert.ok(p.applicationSteps?.length>=5&&p.materials?.length>=3,p.id+' incomplete steps/materials');
   assert.ok(p.reviewNote?.includes('办理入口待核实'),p.id+' direct application status');
   assert.ok(assessPolicy(p,'2026-10-31').grade!=='A',p.id+' must not be certified A');
   const guide=buildHeilongjiangGuide(p.id);
   assert.ok(guide&&guide.steps?.length>=5&&guide.faq?.length>=5&&guide.qualityLevel!=='A',p.id+' guide path');
 }
 for(const h of housing.filter(x=>x.city===city)){
   assert.equal(talentSourceKind(h.sourceUrl),'government',h.id+' government primary location evidence');
   if(h.id.includes('xuefu56'))assert.ok(h.statusNote.includes('高校而非政府来源')&&h.statusNote.includes('jgj')===false,'Separation of government location and university internal eligibility');
   assert.ok(['program','project'].includes(h.kind),h.id+' invalid housing kind');
   if(h.kind==='project')assert.equal(h.city,'哈尔滨');
   assert.ok(h.statusNote.includes('非实时')&&h.statusNote.includes('申报入口未公布'),h.id+' availability disclosure');
   assert.ok(h.steps.length>=5,h.id+' incomplete housing guide');
   assert.ok(assessHousing(h,'2026-10-31').grade!=='A',h.id+' not certified A');
 }
}
for(const p of policies.filter(x=>x.city==='鸡西'||x.city==='绥化'||x.city==='大兴安岭').filter(x=>x.id.includes('-local-'))){assert.equal(p.temporal,'past-window');assert.equal(p.deadline,'2026-10-26');}
for(const p of policies.filter(x=>x.id.includes('-prov-'))){assert.ok(p.sourceUrl.includes('/202606/'),'2026 not old 2024 source');}
assert.ok(![...policies,...housing].some(x=>JSON.stringify(x).includes('${')),'Unsubstituted template variable');
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
assert.ok(read('components/talent/UnifiedPolicyList.tsx').includes("'hlj-'"));
assert.ok(read('pages/TalentServiceRoutes.tsx').includes('buildHeilongjiangGuide('));
assert.ok(read('pages/TalentCityDirectory.tsx').includes('totals.otherPrefectures'));
console.log('PASS Heilongjiang V5.1: 13 regions, 52 policy entries, 32 housing references, 52 shared guides, 337 national entries.');
