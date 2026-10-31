import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {getTalentCitySnapshot} from '../src/data/talentCitySnapshot.ts';
const dist=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
assert.ok(existsSync(resolve(dist,'index.html')),'run after the static site build');
const data={
 schema:'hhba-talent-city-release-v1',commit:process.env.GITHUB_SHA||'local',
 generatedAt:new Date().toISOString(),regions:TALENT_CITY_INDEX.length,
 note:'Static data snapshot; does not guarantee live application status, individual eligibility, or vacancies.',
 cities:Object.fromEntries(TALENT_CITY_INDEX.map(c=>{
  const v=getTalentCitySnapshot(c.name);
  return [c.name,{province:c.province,policies:v.policyCount,housing:v.housingCount}];
 }))
};
writeFileSync(resolve(dist,'talent-city-release.json'),JSON.stringify(data,null,2)+'\n');
console.log('HHBA_TALENT_RELEASE_MANIFEST',data.commit,'total',data.regions,'Chengdu',JSON.stringify(data.cities['成都']));
