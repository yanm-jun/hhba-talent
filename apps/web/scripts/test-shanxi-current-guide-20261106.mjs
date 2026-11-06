import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHANXI_CITIES,getShanxiGuide,shanxiGuideUrl} from '../src/data/shanxiGuides.ts';
import {SHANXI_POLICY_RECORDS} from '../src/data/shanxiPolicyRecords.ts';
import {SHANXI_HOUSING_RECORDS} from '../src/data/shanxiHousingRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
assert.equal(SHANXI_CITIES.length,11);
assert.equal(SHANXI_POLICY_RECORDS.length,22,'must preserve existing 22 current policies rather than old 25');
assert.equal(SHANXI_HOUSING_RECORDS.length,12,'must preserve existing 12 current housing rather than old 15');
assert.equal(new Set(SHANXI_POLICY_RECORDS.map(x=>x.id)).size,22);
assert.equal(new Set(SHANXI_HOUSING_RECORDS.map(x=>x.id)).size,12);
for(const city of SHANXI_CITIES){
 assert.equal(findTalentCity(city)?.name,city);
 const policies=SHANXI_POLICY_RECORDS.filter(x=>x.city===city), housing=SHANXI_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.ok(policies.length>=2&&housing.length>=1,city+' must remain indexed');
 for(const p of policies){
  assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.id===p.id).length,1);
  const g=getShanxiGuide('policy',p.id);
  assert.ok(g?.steps.length>=4&&g.faq.length>=6&&g.qualityLevel!=='A',p.id);
  assert.equal(g?.sources[0][1],p.sourceUrl);
  assert.ok(shanxiGuideUrl('policy',p.id).includes(p.id));
 }
 for(const h of housing){
  assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.id===h.id).length,1);
  const g=getShanxiGuide('housing',h.id);
  assert.ok(g?.steps.length>=4&&g.faq.length>=6&&g.qualityLevel!=='A',h.id);
  assert.equal(g?.sources[0][1],h.sourceUrl);
 }
}
assert.equal(getShanxiGuide('policy','missing'),undefined);
const r=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const d=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
const l=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(r.includes("fragments[2]==='shanxi'")&&r.includes('getShanxiGuide('));
assert.ok(d.includes("id.startsWith('sx-')")&&d.includes('shanxiGuideUrl('));
assert.ok(l.includes("id.startsWith('sx-')")&&l.includes('policy-guide-preview/shanxi'));
console.log('SHANXI_CURRENT_GUIDES_OK: 11 cities, 22 current policies, 12 current housing, conservative B/C routes');
