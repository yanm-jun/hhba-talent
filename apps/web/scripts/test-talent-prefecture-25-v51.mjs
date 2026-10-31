import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX,TALENT_NEW_PREFECTURES_20261031,findTalentCity,queryTalentCities} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
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
 assert.equal(TALENT_POLICY_RECORDS.filter(x=>x.city===c.name).length,0,'no fake policy: '+c.name);
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.city===c.name).length,0,'no fake housing: '+c.name);
}
assert.equal(findTalentCity('海南藏族自治州')?.name,'海南州');
assert.equal(findTalentCity('五指山市'),null);
assert.equal(findTalentCity('济源市'),null);
console.log('PASS 25 prefecture-level autonomous/district directory entries; no fabricated policies');
