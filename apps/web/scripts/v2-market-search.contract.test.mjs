import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const directory='public/data/employer-v2-search-index.json';
assert(existsSync(directory),'Pages MUST create V2 employer index before building the real main search');
const data=JSON.parse(read(directory));
assert.equal(data.schemaVersion,1);
const company=data.employers.find(p=>p.id==='cn-autumn-027');
assert(company,'Guangzhilv cn-autumn-027 MUST be indexed in MAIN Pages search');
assert.equal(company.name,'广之旅');
assert.equal(company.jobs.length,8,'8 campus job directions MUST be included');
assert.equal(new Set(company.jobs.map(j=>j.id)).size,8);
assert.equal(data.employers.length,16,'Main HHBA V2 catalog must include all 16 new employers');
assert.equal(data.employers.reduce((sum,p)=>sum+p.jobs.length,0),124,'Preserve all 124 reviewed job directions');
assert(data.employers.some(p=>p.id==='cn-autumn-026'&&p.name==='南方传媒'&&p.jobs.length===6),'Southern Publishing must be indexed');
for(const p of data.employers){
 assert(existsSync('public/data/employer-v2-profiles/'+p.id+'.json'),'Missing main-site profile: '+p.id);
 assert(p.jobs.length>0,'Unreviewed company in V2 index: '+p.id);
}
assert(existsSync('src/pages/UnifiedV2CompanyPage.tsx'),'Missing unified V2 detail route');
const names=[company.name,company.englishName,...company.aliases].map(s=>s.normalize('NFKC').toLowerCase());
for(const term of ['广之','广之旅','gzl','广州广之旅国际旅行社']){
 assert(names.some(s=>s.includes(term.toLowerCase())),'Missing searchable alias: '+term);
}
const component=read('src/components/V2EmployerSearchResults.tsx');
const market=read('src/components/UnifiedJobMarket.tsx');
assert(market.includes('<V2EmployerSearchResults query={draft}'),'V2 results must appear inside ACTUAL market input');
assert(market.includes('onMatchChange={setV2SearchMatched}'),'Do not show misleading no-results warning after V2 hit');
assert(component.includes('p.jobs.map(job=>'),'Every V2 direction must appear in search result');
assert(component.includes('src={root+p.media.logo}'),'Search result must include brand logo');
assert(component.includes("root+'companies/autumn/'+p.id+'/'"),'Search card must lead to canonical unified employer profile');
assert(!component.includes('previewRoot.startsWith'),'Market must never rely on separate V2 preview');
assert(component.includes('schemaVersion!==1'),'Dynamic search index needs a verified schema');
console.log('HHBA_MAIN_MARKET_GZL_SEARCH_INTEGRATION_OK',company.name,company.jobs.length,names.length);
