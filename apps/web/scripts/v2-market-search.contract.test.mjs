import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const ids=Array.from({length:16},(_,i)=>'cn-autumn-'+String(i+12).padStart(3,'0'));
const rows=ids.map(id=>{
 const file='src/data/employerProfiles/'+id+'.json';
 assert(existsSync(file),'V2 source must be IN main: '+file);
 const p=JSON.parse(read(file));
 assert.equal(p.id,id);
 assert.equal(p.schemaVersion,1);
 assert.equal(p.media.photos.length,2);
 for(const image of [p.media.logo,...p.media.photos.map(x=>x.path)]){
  if(id!=='cn-autumn-027')assert(existsSync('public/'+image),'V2 main-site photo missing: '+image);
 }
 return p;
});
assert.equal(rows.length,16,'Missing a reviewed employer');
assert.equal(rows.reduce((sum,p)=>sum+p.jobs.length,0),124,'Preserve 124 V2 role directions');
assert(rows.some(p=>p.id==='cn-autumn-026'&&p.name==='南方传媒'&&p.jobs.length===6));
assert(rows.some(p=>p.id==='cn-autumn-027'&&p.name==='广之旅'&&p.jobs.length===8));
const names=p=>[p.name,p.englishName,...p.aliases].map(s=>s.normalize('NFKC').toLocaleLowerCase());
const match=q=>rows.filter(p=>names(p).some(n=>n.includes(q.normalize('NFKC').toLowerCase())));
for(const [q,id] of [
 ['南方传媒','cn-autumn-026'],['南方','cn-autumn-026'],
 ['广之','cn-autumn-027'],['广之旅','cn-autumn-027'],
 ['广州广之旅国际旅行社','cn-autumn-027'],['GZL','cn-autumn-027']
])assert(match(q).some(p=>p.id===id),'Search does not match '+q);
for(const p of rows){
 assert(match(p.name).some(c=>c.id===p.id),'Unsearchable V2 company '+p.name);
 assert(p.jobs.every(j=>j.id&&j.title),'Incomplete role list '+p.id);
}
const market=read('src/components/UnifiedJobMarket.tsx');
const component=read('src/components/V2EmployerSearchResults.tsx');
const detail=read('src/pages/UnifiedV2CompanyPage.tsx');
const entry=read('src/main.tsx');
assert(market.includes('<V2EmployerSearchResults query={draft}'),'All V2 companies must use original market input');
assert(component.includes("import {employerProfiles} from '../services/employerProfiles'"),'Search must use bundled main catalog');
assert(!component.includes('previewRoot'),'No company-specific sub-sites');
assert(detail.includes('employerProfileById.get(id)'),'All detail pages use one bundled catalog');
assert(entry.includes('UnifiedV2CompanyPage'),'Main route missing');
console.log('HHBA_ONE_MAIN_BRANCH_V2_SEARCH_PASS',rows.length,rows.reduce((s,p)=>s+p.jobs.length,0));
