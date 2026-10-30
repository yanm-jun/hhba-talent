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
const scopedIds=['bj-jobseeker-grant','bj-flex-insurance','tj-2027-jobseek-grant','tj-grad-business-loan','tj-graduate-flex-insurance',
 'sh-2026-jobseek-grant','sh-2026-flex-insurance','sh-2026-first-startup',
 'cq-2026-jobseek','cq-2026-shortage-job','cq-2025-twelve-counties'];
for(const id of scopedIds){
 const start=policy.indexOf("id:'"+id+"'");
 assert.ok(start>=0,'Missing newly researched official municipal policy '+id);
 const next=policy.indexOf("},",start);
 const row=policy.slice(start,next);
 assert.ok(row.includes('scope:')&&row.includes('targetGroup:')&&row.includes('reviewNote:'),'Municipal policy must identify scope and qualifications: '+id);
 const source=/sourceUrl:\s*"([^"]+)"/.exec(row);
 assert.ok(source&&new URL(source[1]).hostname.endsWith('.gov.cn'),'Each new policy must link to an official Chinese government site: '+id);
}
for(const city of ['北京','天津','上海','重庆']){
 assert.ok([...policy.matchAll(new RegExp("city:'"+city+"'","g"))].length>=4,'Insufficient researched policy coverage for '+city);
}
assert.ok(policy.includes('deadline:"2026-10-31"'),'Tianjin 2027 application cut-off must be explicit');
assert.ok(policy.includes('deadline:"2025-12-31"'),'Expired Chongqing 12-county recognition window must be explicit');

assert.ok(housingIds.length>=10 && policyIds.length>=16,'Insufficient source-backed records');
const housingProjectIds=['bj-yiliangma-2026','bj-hongxin-2026','tj-ruixin-2026','tj-hechuang-2026','tj-songyu-2026','tj-jintie-liyu-2026','sh-zhangjiang-2026','cq-sanyu-2026','cq-wufeng-2026','cq-longsheng-2026'];
assert.ok(housingIds.length>=23,'Expected previous 13 housing records plus 10 new concrete official projects');
for(const id of housingProjectIds){
 const start=housing.indexOf('id:"'+id+'"');
 assert.ok(start>=0,'New housing project missing: '+id);
 const end=housing.indexOf('},',start);
 const record=housing.slice(start,end);
 assert.ok(record.includes('kind:"project"'),'Real site must not be confused with generic program: '+id);
 for(const field of ['address:','units:','rent:','eligibility:','published:','statusNote:','steps:','reviewedAt:']){
  assert.ok(record.includes(field),'Missing source-required field '+field+' for '+id);
 }
 const official=record.match(/sourceUrl:"(https:\/\/[^"]+)"/)?.[1];
 assert.ok(official&&new URL(official).hostname.endsWith('.gov.cn'),'Project must have government source '+id);
 assert.ok(/当前|现时|实时|不等于|需向|待/.test(record),'Project must warn against assuming live inventory '+id);
}
for(const municipality of ['北京','天津','上海','重庆']){
 const records=[...housing.matchAll(new RegExp('city:"'+municipality+'"','g'))].length;
 assert.ok(records>=3,'Every municipality must have multiple actual housing sources '+municipality);
}

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
const approved=['htl-intro','htl-quick','htl-city-grid','htl-housing-grid','htl-policy-list','htl-match'];
let lastIndex=-1;
for(const block of approved){
 const current=landing.indexOf(block);
 assert.ok(current>lastIndex,'Approved V4 homepage section order or section missing: '+block);
 lastIndex=current;
}
for(const entry of ["'housing' as const","'policies' as const","'benefits' as const","'guide' as const"]){
 assert.ok(landing.includes(entry),'Approved four quick entries must remain: '+entry);
}
assert.ok(landing.includes("const featured=['杭州','深圳','青岛']"),'Preserve approved three prominent city images');
assert.ok(landing.includes("const apartmentIds=['hz-xiyue','sz-young']"),'Housing preview must use existing named records');
assert.ok(landing.includes('项目实景待官方核验'),'Do not pass stock apartment interiors as real listings');
assert.ok(landing.includes('htl-match-panel'),'Keep the bottom matching entry point without false eligibility claims');
const cityRegistry=readFileSync(new URL('data/talentCityRegistry.ts',root),'utf8');
for(const c of ['北京','天津','上海','重庆']){
 assert.ok(cityRegistry.includes("name:'"+c+"'")&&cityRegistry.includes("official:'"+c+"市'"),'Municipality missing: '+c);
 assert.ok(policy.includes("city:'"+c+"'"),'No sourced policy record for '+c);
 assert.ok(housing.includes('city:"'+c+'"'),'No sourced housing record for '+c);
}
assert.ok(landing.includes('suggestTalentCities(keyword)'),'Search autocomplete must be connected');
assert.ok(landing.includes('parseTalentCityQuery(keyword,city)'),'City alias matcher must be connected');
assert.ok(details.includes('ts-v4-two-kinds'),'City pages must have exactly two core service entrances');
assert.ok(details.includes('ts-housing-districts')&&details.includes('shownHomes.map(h=>'),'Housing list must support region filters and render filtered results');
assert.ok(details.includes('h.contactPhone')&&details.includes('h.photoEvidence'),'Housing detail must separate sourced contact info and official media from generic images');
assert.ok(details.includes('housingFirst'),'Specific verified projects must be listed before general housing programs');

assert.ok(details.includes('policyStatus(data)')&&details.includes('data.targetGroup'),'Policy listings must expose application status and eligible population');
assert.ok(details.includes('p.deadline')&&details.includes('p.reviewNote')&&details.includes('p.scope'),'Policy detail page must show cutoffs and territorial limitations');

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
