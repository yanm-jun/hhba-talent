import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FUJIAN_POLICY_RECORDS} from '../src/data/fujianPolicyRecords.ts';
import {FUJIAN_HOUSING_RECORDS} from '../src/data/fujianHousingRecords.ts';
import {FUJIAN_9_CITIES,getFujianGuide,FUJIAN_GUIDE_COUNT} from '../src/data/fujianGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {assessPolicy,assessHousing,talentSourceKind} from '../src/data/talentQuality.ts';
const cities=[...FUJIAN_9_CITIES];
assert.equal(cities.length,9);
assert.equal(new Set(cities).size,9);
assert.equal(queryTalentCities('','福建省').length,9);
assert.equal(FUJIAN_POLICY_RECORDS.length,33);
assert.equal(FUJIAN_HOUSING_RECORDS.length,14);
assert.equal(FUJIAN_GUIDE_COUNT,47);
assert.equal(new Set(FUJIAN_POLICY_RECORDS.map(x=>x.id)).size,FUJIAN_POLICY_RECORDS.length);
assert.equal(new Set(FUJIAN_HOUSING_RECORDS.map(x=>x.id)).size,FUJIAN_HOUSING_RECORDS.length);
assert.deepEqual(new Set(FUJIAN_POLICY_RECORDS.filter(x=>x.id.endsWith('2026-entrepreneurship')).map(x=>x.city)),new Set(cities));
for(const city of cities){
 assert.equal(findTalentCity(city+'市')?.name,city);
 assert.ok(findTalentCity(city)?.intro.includes('福建')||findTalentCity(city)?.intro.includes('人才'));
 const ps=TALENT_POLICY_RECORDS.filter(x=>x.city===city&&x.id.startsWith('fj-'));
 const hs=TALENT_HOUSING_RECORDS.filter(x=>x.city===city&&x.id.startsWith('fj-'));
 assert.ok(ps.length>=3,city+' needs 3 provincial policy views');
 assert.ok(hs.length>=1,city+' needs valid housing program');
 for(const p of ps){
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=5,p.id+' actionable record fields');
  assert.notEqual(talentSourceKind(p.sourceUrl),'unverified',p.id);
  assert.ok(p.reviewNote&&p.targetGroup);
  assert.notEqual(assessPolicy(p).grade,'A',p.id+' must not autocertify');
  const g=getFujianGuide('policy',p.id);
  assert.ok(g&&g.qualityLevel!=='A'&&g.faq.length>=6&&g.steps.length>=5&&g.sources.length>=1);
  if(p.id.endsWith('2026-entrepreneurship')){assert.equal(p.deadline,'2026-04-15');assert.equal(assessPolicy(p,'2026-10-31').grade,'C');}
 }
 for(const h of hs){
  assert.equal(h.kind,'program',h.id+' must not fabricate rentable housing project');
  assert.ok(h.steps.length>=4&&h.statusNote&&h.sourceUrl.startsWith('https://'));
  assert.equal(talentSourceKind(h.sourceUrl),'government',h.id);
  assert.notEqual(assessHousing(h).grade,'A');
  const g=getFujianGuide('housing',h.id);
  assert.ok(g&&g.qualityLevel!=='A'&&g.steps.length>=4);
 }
}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const details=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("fragments[2]==='fujian'")&&routes.includes('getFujianGuide('));
assert.ok(details.includes("fujianGuideUrl('policy'")&&details.includes("fujianGuideUrl('housing'"));
assert.ok(routes.includes("fragments[2]==='jiangsu'")&&routes.includes("fragments[2]==='yunnan'"));
console.log('Fujian V5.1 PASS: 9 cities, 33 policy records, 14 housing programs, 47 B/C six-part guides; no fake real-time vacancy.');
