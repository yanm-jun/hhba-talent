// HHBA source index consistency check. Does not claim live eligibility or availability.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../src/',import.meta.url);
const housing=readFileSync(new URL('data/talentHousingRecords.ts',root),'utf8');
const policy=readFileSync(new URL('data/talentPolicyRecords.ts',root),'utf8');
const landing=readFileSync(new URL('pages/TalentServicePage.tsx',root),'utf8');
const housingView=readFileSync(new URL('components/TalentHousingSection.tsx',root),'utf8');
const policyView=readFileSync(new URL('components/TalentPolicySearch.tsx',root),'utf8');
const housingIds=[...housing.matchAll(/id:"([^"]+)"/g)].map(m=>m[1]);
const policyIds=[...policy.matchAll(/id:'([^']+)'/g)].map(m=>m[1]);
assert.ok(housingIds.length>=10 && policyIds.length>=16,'Insufficient source-backed records');
assert.equal(new Set(housingIds).size,housingIds.length,'Duplicate housing IDs');
assert.equal(new Set(policyIds).size,policyIds.length,'Duplicate policy IDs');
const urls=[...housing.matchAll(/sourceUrl:"(https:\/\/[^"]+)"/g)].map(m=>m[1]);
assert.equal(urls.length,housingIds.length,'Missing housing source links');
for(const raw of urls){
 const domain=new URL(raw).hostname;
 assert.ok(domain.endsWith('.gov.cn')||domain==='www.hzzx.gov.cn','Non-government source: '+domain);
}
for(const city of ['杭州','深圳','青岛','上海','北京','济南']){
 assert.ok(housing.includes('city:"'+city+'"'),'Missing housing city '+city);
}
const details=readFileSync(new URL('pages/TalentServiceRoutes.tsx',root),'utf8');
const entry=readFileSync(new URL('main.tsx',root),'utf8');
assert.ok(!landing.includes('<TalentHousingSection')&&!landing.includes('<TalentPolicySearch'),'Portal must not render full policy or housing lists');
assert.ok(landing.includes('talentCityUrl(c.name)')&&landing.includes('talentSearchUrl(parsed.city,q)'),'Homepage city cards and search must use separate routes');
assert.ok(landing.includes('talentListUrl(item.kind'),'Home navigation tiles must open independent list pages');
const cityRegistry=readFileSync(new URL('data/talentCityRegistry.ts',root),'utf8');
for(const c of ['北京','天津','上海','重庆']){
 assert.ok(cityRegistry.includes("name:'"+c+"'")&&cityRegistry.includes("official:'"+c+"市'"),'Municipality missing: '+c);
 assert.ok(policy.includes("city:'"+c+"'"),'No sourced policy record for '+c);
 assert.ok(housing.includes('city:"'+c+'"'),'No sourced housing record for '+c);
}
assert.ok(landing.includes('suggestTalentCities(keyword)'),'Search autocomplete must be connected');
assert.ok(landing.includes('parseTalentCityQuery(keyword,city)'),'City alias matcher must be connected');
assert.ok(details.includes('ts-v4-two-kinds'),'City pages must have exactly two core service entrances');
assert.ok(!landing.includes('ts-match-form'),'Old generic matching UI should not return');

assert.ok(details.includes('function CityHub(')&&details.includes('function ListPage(')&&details.includes('function DetailPage('),'City/list/detail page hierarchy missing');
assert.ok(details.includes('talentPolicyUrl(data.id)')&&details.includes('talentHousingUrl(data.id)'),'Detail deep-links missing');
assert.ok(details.includes('TALENT_POLICY_RECORDS')&&details.includes('TALENT_HOUSING_RECORDS'),'Historic official data must be preserved');
assert.ok(entry.includes("route.startsWith('/talent-service/')"),'SPA deep-link route handling missing');
assert.ok(!landing.includes('images.unsplash.com'),'Stock photos cannot represent real projects');
assert.ok(housingView.includes('today>r.applicationEnd'),'Expired application windows must be flagged');
assert.ok(policyView.includes('TALENT_POLICY_RECORDS'),'Policy source index missing');
const date=/HOUSING_REVIEW_DATE='(\d{4}-\d\d-\d\d)'/.exec(housing)?.[1];
assert.ok(date,'Housing review date required');
const age=Math.floor((Date.now()-Date.parse(date+'T00:00:00Z'))/86400000);
if(age>30)console.log('::warning title=Housing review overdue::Last manual verification '+age+' days ago. Recheck official sources.');
const expired=[...housing.matchAll(/applicationEnd:"(\d{4}-\d\d-\d\d)"/g)].map(m=>m[1]).filter(v=>v<new Date().toISOString().slice(0,10));
console.log(JSON.stringify({housingRecords:housingIds.length,policyRecords:policyIds.length,verifiedSourceURLs:urls.length,lastReviewed:date,reviewAgeDays:age,endedWindows:expired.length},null,2));
