import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const data=p=>readFileSync(path.join(here,'../src/data',p),'utf8');
const policies=['guangdongPolicyRecords.ts','guangdongExpandedPolicyRecords.ts','guangdongFinalCitiesPolicyRecords.ts','guangdongProvincialPolicyRecords.ts'].map(data);
const housing=['guangdongHousingRecords.ts','guangdongExpandedHousingRecords.ts'].map(data);
const policyIndex=data('talentPolicyRecords.ts'),housingIndex=data('talentHousingRecords.ts'),registry=data('talentCityRegistry.ts');
const guide=data('guangdongGuides.ts');
const routes=readFileSync(path.join(here,'../src/pages/TalentServiceRoutes.tsx'),'utf8');
const list=readFileSync(path.join(here,'../src/components/talent/UnifiedPolicyList.tsx'),'utf8');
const cities=['广州','深圳','佛山','东莞','珠海','中山','惠州','江门','肇庆','汕头','潮州','揭阳','汕尾','湛江','茂名','阳江','韶关','清远','云浮','河源','梅州'];
const ids=s=>[...s.matchAll(/['"]?id['"]?\s*:\s*['"](gd-[^'"]+)['"]/g)].map(m=>m[1]);
const cityNames=s=>[...s.matchAll(/['"]?city['"]?\s*:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
const P=policies.flatMap(ids),H=housing.flatMap(ids);
assert.equal(cities.length,21);
for(const city of cities){
 assert.ok(registry.includes('|'+city+'市|广东省|'),'Guangdong missing from city index: '+city);
 assert.ok(policies.some(s=>cityNames(s).includes(city)),'No source-backed Guangdong policy for '+city);
}
assert.equal(P.length,57,'24 municipal + 21 provincial startup + 12 region-limited employment');
assert.equal(H.length,10,'2 initial + 8 researched housing sources');
assert.equal(new Set([...P,...H]).size,P.length+H.length,'Duplicate IDs');
for(const s of [...policies,...housing]){
 assert.ok(!s.includes('https://example.com'));
 assert.ok(!s.includes('http://'),'Only https sources supported by V5.1');
}
for(const id of [...P,...H])assert.ok(id.startsWith('gd-'));
for(const fragment of ['...GUANGDONG_POLICY_RECORDS','...GUANGDONG_EXPANDED_POLICY_RECORDS','...GUANGDONG_FINAL_CITIES_POLICY_RECORDS','...GUANGDONG_PROVINCIAL_POLICY_RECORDS'])assert.ok(policyIndex.includes(fragment));
for(const fragment of ['...GUANGDONG_HOUSING_RECORDS','...GUANGDONG_EXPANDED_HOUSING_RECORDS'])assert.ok(housingIndex.includes(fragment));
assert.ok(guide.includes('qualityLevel:expired?\'C\':\'B\''),'No auto A-guide certification');
assert.ok(routes.includes("fragments[2]==='guangdong'")&&routes.includes('buildGuangdongGuide('),'Guangdong shared guide route missing');
assert.ok(list.includes("p.id.startsWith('gd-')"),'Guangdong card-to-guide links missing');
assert.ok(housing.some(s=>s.includes('非实时')),'Must distinguish historical supply vs real-time housing');
for(const id of ['gd-sz-high-talent-rent-202608','gd-dg-guanai-home-202609','gd-hz-house-voucher-202604','gd-mz-free-entrepreneur-housing-202506','gd-cz-public-rental-202501','gd-mm-haoxin-card-202501'])assert.ok(P.includes(id),id);
const province=data('guangdongProvincialPolicyRecords.ts');
const regionalRecords=ids(province).filter(id=>id.includes('-yddxb-youth-'));
assert.equal(regionalRecords.length,12);
// Region ID list must match exact eastern/western/northern 12 cities, not any GBA/Pearl Delta cities.
assert.ok(!regionalRecords.some(id=>['gz','sz','fs','dg','zh','zs','hz','jm','zq'].some(x=>id.endsWith('-'+x))));
console.log('PASS Guangdong V5.1: '+cities.length+' cities, '+P.length+' sourced municipal/provincial policy records, '+H.length+' housing records, 12 region-specific graduation grants, 6-section shared B/C guides');
