import assert from 'node:assert/strict';
import {queryTalentCities,parseTalentCityQuery} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
const cities=['济南','青岛','淄博','枣庄','东营','烟台','潍坊','济宁','泰安','威海','日照','临沂','德州','聊城','滨州','菏泽'];
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)};
// Regression protects original V4.6 16 IDs; V4.7 deeper records are checked separately.
const originalSixteen=new Set(['sd-jinan-2026-talent-living','sd-qingdao-2026-free-housing','sd-zibo-2026-training','sd-zaozhuang-2026-first-startup','sd-dongying-talent-2026','sd-yantai-2026-youth-living','sd-weifang-2025-subsidy','sd-jining-2026-introduction','sd-taian-2025-youth','sd-weihai-youth-2025','sd-rizhao-youth-2026','sd-linyi-youth-2025','sd-dezhou-2026-startup','sd-liaocheng-2026-living','sd-binzhou-2026-flex','sd-heze-2026-startup']);
// Keep the original city coverage contract fixed; later independently sourced records must not break this baseline.
const added=TALENT_POLICY_RECORDS.filter(r=>originalSixteen.has(r.id));
check('All 16 Shandong prefectures present',()=>{assert.deepEqual(new Set(queryTalentCities('','山东省').map(c=>c.name)),new Set(cities))});
check('Exactly one new sourced item for each Shandong city',()=>{
 assert.equal(added.length,16);
 assert.equal(new Set(added.map(r=>r.city)).size,16);
 for(const c of cities)assert.equal(added.filter(r=>r.city===c).length,1,c);
});
check('Extra 2026 Weifang records preserve historical IDs and distinguish recipients',()=>{
 const expansion=TALENT_POLICY_RECORDS.find(r=>r.id==='sd-weifang-2026-expansion');
 const skill=TALENT_POLICY_RECORDS.find(r=>r.id==='sd-weifang-2026-skills');
 assert.ok(expansion&&skill);
 assert.equal(expansion.payoutTo,'用人单位');
 assert.equal(skill.payoutTo,'个人');
 assert.ok(expansion.applicationSteps?.length>=4&&skill.applicationSteps?.length>=4);
 assert.ok(expansion.sourceUrl.includes('.gov.cn')&&skill.sourceUrl.includes('.gov.cn'));
});
check('Source links are government or National Graduate Employment Service',()=>{
 for(const row of added){
  const url=new URL(row.sourceUrl);
  assert.equal(url.protocol,'https:');
  assert.ok(url.hostname.endsWith('.gov.cn')||url.hostname.endsWith('.ncss.cn'),row.city);
  for(const k of ['title','benefit','summary','eligibility','application','department','targetGroup','reviewNote','sourceName','published'])assert.ok(row[k]?.length>6,'Missing '+k+' in '+row.city);
  assert.match(row.published,/^\d{4}-\d{2}-\d{2}$/);
 }
});
check('Expired historical batch must remain noncurrent',()=>{
 assert.equal(added.find(r=>r.city==='威海')?.temporal,'historical');
 assert.equal(added.find(r=>r.city==='潍坊')?.temporal,'historical');
 assert.equal(added.find(r=>r.city==='威海')?.deadline,'2025-12-19');
});
check('Distinguish employer subsidy, startup loan and private support',()=>{
 assert.ok(added.find(r=>r.city==='济宁')?.reviewNote.includes('用人单位'));
 assert.ok(added.find(r=>r.city==='德州')?.reviewNote.includes('贷款不能写为无偿补贴'));
 assert.ok(added.find(r=>r.city==='枣庄')?.eligibility.includes('30%'));
});
check('City policy query recognizes selected city without redirecting Beijing',()=>{
 for(const [q,c]of [['临沂硕士补贴','临沂'],['聊城','聊城'],['滨州本科','滨州'],['山东省日照市','日照'],['烟台生活补贴','烟台']]){
  const r=parseTalentCityQuery(q,'北京');assert.equal(r.city,c,q);assert.equal(r.matchedCity,true,q);
 }
});
check('Keep four municipalities data intact',()=>{
 for(const c of ['北京','天津','上海','重庆'])assert.ok(TALENT_POLICY_RECORDS.some(x=>x.city===c));
});
console.log(JSON.stringify({passed,citiesCovered:16,newPolicies:added.length},null,2));
