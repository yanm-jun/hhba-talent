import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {XINJIANG_POLICY_RECORDS,XINJIANG_14_PREFECTURES} from '../src/data/xinjiangPolicyRecords.ts';
import {XINJIANG_HOUSING_RECORDS} from '../src/data/xinjiangHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {buildXinjiangGuide,xinjiangGuideUrl,XINJIANG_CORPS_CITIES_2026} from '../src/data/xinjiangGuides.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const cities=['乌鲁木齐','克拉玛依','吐鲁番','哈密','昌吉','博尔塔拉','巴音郭楞','阿克苏','克孜勒苏','喀什','和田','伊犁','塔城','阿勒泰'];
assert.deepEqual([...XINJIANG_14_PREFECTURES],cities);
assert.equal(queryTalentCities('','新疆维吾尔自治区').length,14,'must cover exactly all existing Xinjiang prefectures');
assert.equal(XINJIANG_CORPS_CITIES_2026.length,13,'2026 Corps direct-admin counties require independent scheme and must never be conflated with 14 prefectures');
assert.equal(XINJIANG_POLICY_RECORDS.length,40);
assert.equal(XINJIANG_HOUSING_RECORDS.length,43);
assert.equal(new Set(XINJIANG_POLICY_RECORDS.map(x=>x.id)).size,40);
assert.equal(new Set(XINJIANG_HOUSING_RECORDS.map(x=>x.id)).size,43);
for(const city of cities){
 assert.ok(findTalentCity(city),city+' should already exist in nationwide registry');
 const p=XINJIANG_POLICY_RECORDS.filter(x=>x.city===city);
 const h=XINJIANG_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.ok(p.length>=2,'missing region policy research '+city);
 assert.ok(h.length>=1,'missing independent housing evidence '+city);
 assert.equal(getTalentCitySnapshot(city).policyCount,p.length,city+' policy not indexed in national city view');
 assert.equal(getTalentCitySnapshot(city).housingCount,h.length,city+' housing not indexed in national city view');
 for(const x of p){
  assert.ok(x.summary.length>=60&&x.eligibility.length>=80,x.id+' unacceptably short');
  assert.ok(x.materials?.length>=4&&x.applicationSteps?.length>=5,x.id+' missing applicant guide');
  assert.ok(x.targetGroup&&x.payoutTo&&x.reviewNote?.includes('办理入口待核实'),x.id);
  assert.equal(talentSourceKind(x.sourceUrl),'government',x.id+' must use primary government evidence, not unattributed web sources');
  assert.equal(TALENT_POLICY_RECORDS.filter(y=>y.id===x.id).length,1,x.id+' missing/duplicate in nationwide registry');
  const g=buildXinjiangGuide('policy',x.id);
  assert.ok(g&&g.faq.length>=10&&g.steps.length>=5&&Object.keys(g.branches).length===3,x.id);
  assert.ok(xinjiangGuideUrl('policy',x.id).includes(x.id));
 }
 for(const x of h){
  assert.ok(x.sourceUrl.startsWith('https://')&&x.title&&x.address&&x.units&&x.eligibility.length>=80,x.id);
  assert.ok(x.steps?.length>=5&&x.statusNote?.includes('非实时空房')&&x.statusNote?.includes('申报入口待核实'),x.id);
  assert.ok(talentSourceKind(x.sourceUrl)==='government'||x.city==='阿克苏'&&x.sourceUrl.includes('aksxw.com'),x.id+' must be government verified or explicitly labeled local secondary source');
  assert.equal(TALENT_HOUSING_RECORDS.filter(y=>y.id===x.id).length,1,x.id+' missing/duplicate nationwide housing index');
  const g=buildXinjiangGuide('housing',x.id);
  assert.ok(g&&g.faq.length>=10&&g.steps.length>=5&&g.branches.verify,x.id+' missing housing eligibility/FAQ');
  assert.ok(xinjiangGuideUrl('housing',x.id).includes(x.id));
 }
}
assert.equal(XINJIANG_HOUSING_RECORDS.filter(x=>x.city==='克拉玛依'&&x.kind==='project').length,5,'all five individual official 2026 Karamay housing projects required');
assert.ok(XINJIANG_HOUSING_RECORDS.some(x=>x.title.includes('佳福小居')&&x.city==='克拉玛依'));
assert.ok(XINJIANG_POLICY_RECORDS.some(x=>x.city==='昌吉'&&x.deadline==='2026-11-10'),'must preserve 2026-11-10 deadline');
assert.ok(XINJIANG_HOUSING_RECORDS.some(x=>x.city==='伊犁'&&x.units.includes('1148套')&&x.units.includes('2027年6月')),'unfinished Yining Phase II must not look like current vacant houses');
assert.ok(XINJIANG_HOUSING_RECORDS.some(x=>x.city==='和田'&&x.title.includes('于田县')));
assert.ok(XINJIANG_HOUSING_RECORDS.some(x=>x.city==='巴音郭楞'&&x.title.includes('和硕县')));
assert.ok(XINJIANG_POLICY_RECORDS.every(x=>!x.title.includes('兵团师市现金补贴')),'XPCC subsidies not attributable to prefectural government');
const page=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const listing=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(page.includes("fragments[2]==='xinjiang'")&&page.includes('新疆维吾尔自治区14地州V6人才政策与住房保障分类目录'));
assert.ok(detail.includes('policy-guide-preview/xinjiang')&&listing.includes('policy-guide-preview/xinjiang'));
console.log('XINJIANG_2026_V6_OK: 14 prefectures, 40 policy/service records, 43 housing evidence records, 5 Karamay projects, source grade/caveats/guide/nationwide search checked. Corps 13 direct-admin cities separately scoped.');
