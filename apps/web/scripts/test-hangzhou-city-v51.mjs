import fs from 'node:fs';
import assert from 'node:assert/strict';
const get=name=>fs.readFileSync(new URL('../src/data/'+name,import.meta.url),'utf8');
const policy=get('hangzhouPolicyRecords.ts');
const housing=get('hangzhouHousingRecords.ts');
const policyIndex=get('talentPolicyRecords.ts');
const housingIndex=get('talentHousingRecords.ts');
const city=get('talentCityRegistry.ts');
for(const [haystack,needles] of [
 [policyIndex,['HANGZHOU_POLICY_RECORDS','...HANGZHOU_POLICY_RECORDS']],
 [housingIndex,['HANGZHOU_HOUSING_RECORDS','...HANGZHOU_HOUSING_RECORDS']],
 [city,['330100|杭州市|浙江省']],
 [policy,['hz-2026-graduate-rent','hz-2026-high-purchase','hz-2026-high-rental','hz-2026-talent-rental-policy','hz-2023-2025-graduate-living-base','ql.hangzhou.gov.cn','zfgb.hangzhou.gov.cn','"temporal": "historical"']],
 [housing,['hz-2026-talent-rental-program','hz-2026-graduate-rental-program','不是房源项目地址','不是具体公寓地址']]
])for(const needle of needles)assert.ok(haystack.includes(needle),'Missing '+needle);
for(const value of [policy,housing]){
 assert.ok(!value.includes('example.com'));
 assert.ok(value.includes('2026-10-31'));
}
const ids=[...policy.matchAll(/"id": "([^"]+)"/g),...housing.matchAll(/"id": "([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,7);
assert.equal(ids.length,new Set(ids).size);
console.log('HANGZHOU_V51_SOURCE_AND_REGISTRY_OK',ids.length);
