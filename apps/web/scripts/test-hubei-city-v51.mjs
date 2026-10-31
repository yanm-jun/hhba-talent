import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUBEI_POLICY_RECORDS} from '../src/data/hubeiPolicyRecords.ts';
import {HUBEI_HOUSING_RECORDS} from '../src/data/hubeiHousingRecords.ts';
import {HUBEI_CITIES,getHubeiGuide,HUBEI_GUIDE_COUNT} from '../src/data/hubeiGuides.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_PREFECTURE_CITIES,findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind,assessPolicy,assessHousing} from '../src/data/talentQuality.ts';
const cities=HUBEI_CITIES.map(x=>x[0]);
assert.equal(cities.length,13);
assert.equal(queryTalentCities('','湖北省').length,13);
assert.equal(TALENT_PREFECTURE_CITIES.filter(x=>x.province==='湖北省').length,12);
assert.equal(findTalentCity('恩施土家族苗族自治州')?.name,'恩施');
assert.equal(HUBEI_POLICY_RECORDS.length,59);
assert.equal(HUBEI_HOUSING_RECORDS.length,16);
assert.equal(HUBEI_GUIDE_COUNT,75);
assert.equal(new Set(HUBEI_POLICY_RECORDS.map(x=>x.id)).size,59);
assert.equal(new Set(HUBEI_HOUSING_RECORDS.map(x=>x.id)).size,16);
for(const city of cities){
 assert.equal(findTalentCity(city==='恩施'?'恩施土家族苗族自治州':city+'市')?.name,city);
 const ps=TALENT_POLICY_RECORDS.filter(x=>x.city===city&&x.id.startsWith('hb-'));
 const hs=TALENT_HOUSING_RECORDS.filter(x=>x.city===city&&x.id.startsWith('hb-'));
 assert.ok(ps.length>=4,city+' 4 province-wide policy topics');
 assert.ok(hs.length>=1,city+' one housing program');
 for(const p of ps){
  assert.equal(talentSourceKind(p.sourceUrl),'government',p.id);
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4&&p.reviewNote,p.id);
  assert.notEqual(assessPolicy(p).grade,'A',p.id);
  const guide=getHubeiGuide('policy',p.id);
  assert.ok(guide&&guide.qualityLevel!=='A'&&guide.steps.length>=4&&guide.faq.length>=6,p.id);
 }
 for(const h of hs){
  assert.equal(talentSourceKind(h.sourceUrl),'government',h.id);
  assert.ok(h.steps?.length>=4&&h.statusNote.includes('申报入口待核实'),h.id);
  assert.notEqual(assessHousing(h).grade,'A');
  assert.ok(getHubeiGuide('housing',h.id)?.steps.length>=4);
 }
}
assert.ok(HUBEI_POLICY_RECORDS.find(x=>x.id==='hb-ezhou-2026-purchase-stop')?.benefit.includes('不再发放'));
assert.ok(HUBEI_HOUSING_RECORDS.find(x=>x.id==='hb-huangshi-gangyou-2026')?.address.includes('环湖路'));
const r=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const d=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(r.includes("fragments[2]==='hubei'")&&r.includes('getHubeiGuide('));
assert.ok(d.includes("hubeiGuideUrl('policy'")&&d.includes("hubeiGuideUrl('housing'"));
console.log('HUBEI V5.1 OK 13 cities 59 policies 16 housing 75 shared B/C guides');
