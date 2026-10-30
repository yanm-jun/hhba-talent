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
assert.ok(landing.includes('<TalentHousingSection city={city} query={submittedQuery}'),'Housing not wired to selected city');
assert.ok(landing.includes('<TalentPolicySearch city={city} query={submittedQuery}'),'Policy not wired to selected city');
assert.ok(!landing.includes('images.unsplash.com'),'Stock photos cannot represent real projects');
assert.ok(housingView.includes('today>r.applicationEnd'),'Expired application windows must be flagged');
assert.ok(policyView.includes('TALENT_POLICY_RECORDS'),'Policy source index missing');
const date=/HOUSING_REVIEW_DATE='(\d{4}-\d\d-\d\d)'/.exec(housing)?.[1];
assert.ok(date,'Housing review date required');
const age=Math.floor((Date.now()-Date.parse(date+'T00:00:00Z'))/86400000);
if(age>30)console.log('::warning title=Housing review overdue::Last manual verification '+age+' days ago. Recheck official sources.');
const expired=[...housing.matchAll(/applicationEnd:"(\d{4}-\d\d-\d\d)"/g)].map(m=>m[1]).filter(v=>v<new Date().toISOString().slice(0,10));
console.log(JSON.stringify({housingRecords:housingIds.length,policyRecords:policyIds.length,verifiedSourceURLs:urls.length,lastReviewed:date,reviewAgeDays:age,endedWindows:expired.length},null,2));
