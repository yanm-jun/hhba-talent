import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,TALENT_NEW_PREFECTURES_20261031,findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';
const pca=JSON.parse(readFileSync(new URL('../src/data/china_pca_2026.json',import.meta.url),'utf8'));
const pcaMap=new Map(pca.flatMap(p=>(p.ch||[]).map(c=>[c.n,{province:p.n,code:String(c.c)}])));
assert.equal(TALENT_NEW_PREFECTURES_20261031.length,25);
assert.equal(TALENT_CITY_INDEX.length,337);
assert.equal(new Set(TALENT_CITY_INDEX.map(c=>c.name)).size,337);
assert.equal(new Set(TALENT_CITY_INDEX.map(c=>c.code)).size,337);
for(const c of TALENT_NEW_PREFECTURES_20261031){
 const src=pcaMap.get(c.official);
 assert.ok(src,'PCA missing '+c.official);
 assert.equal(c.province,src.province);
 assert.equal(c.code,src.code+'00');
 assert.equal(c.level,'prefecture');
 assert.equal(findTalentCity(c.official)?.name,c.name);
 assert.equal(findTalentCity(c.name)?.code,c.code);
 assert.ok(queryTalentCities('',c.province).some(r=>r.name===c.name));
 assert.ok(c.intro.includes('尚待核验'));
 // The 2026-10-31 baseline had no records, but later development must be permitted
 // when a real government source and non-fabricated application constraints exist.
 for(const p of TALENT_POLICY_RECORDS.filter(x=>x.city===c.name)){
  assert.equal(talentSourceKind(p.sourceUrl),'government','prefecture policy source unverified: '+p.id);
  assert.ok(p.applicationSteps?.length>=4&&p.materials?.length>=2&&p.reviewNote,'incomplete evidence: '+p.id);
 }
 for(const h of TALENT_HOUSING_RECORDS.filter(x=>x.city===c.name)){
  assert.equal(talentSourceKind(h.sourceUrl),'government','prefecture housing source unverified: '+h.id);
  assert.ok(h.steps?.length>=4&&h.statusNote?.match(/空房|房源|非实时/),'missing vacancy caveat: '+h.id);
 }
}
assert.equal(findTalentCity('海南藏族自治州')?.name,'海南州');
assert.equal(findTalentCity('五指山市'),null);
assert.equal(findTalentCity('济源市'),null);
console.log('PASS 25 prefecture-level regions: directory coverage + evidence gating for newly sourced policies');
