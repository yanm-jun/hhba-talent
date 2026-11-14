import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../public/recruitment-library/v1/manifest.json'));
const search=JSON.parse(read('../public/recruitment-library/v1/search.json'));
const home=read('../src/pages/IndustryLibraryPage.tsx');
const component=read('../src/components/GlobalCompanySearch.tsx');
const css=read('../src/styles/industry-library.css');
const normal=value=>value.normalize('NFKC').trim().toLocaleLowerCase();
const key=(name,url)=>normal(name)+'|'+url.replace(/\/$/,'').toLocaleLowerCase();

test('static global enterprise index covers 17 halls without duplicates or secret fields',()=>{
 assert.equal(search.kind,'HHBA_DIRECTORY_GLOBAL_SEARCH_V1');
 assert.equal(search.asOf,manifest.asOf);
 assert.equal(manifest.halls.length,17);
 assert.ok(search.records.length>0);
 const halls=new Set(manifest.halls.map(x=>x.id));
 const index=new Map();
 for(const r of search.records){
  assert.deepEqual(Object.keys(r).sort(),['company','halls','review','url']);
  assert.ok(r.company.trim());
  assert.ok(['candidate','reviewed_history'].includes(r.review));
  const url=new URL(r.url);
  assert.equal(url.protocol,'https:');
  assert.equal(url.username,'');
  assert.equal(url.password,'');
  assert.equal(url.port,'');
  assert.ok(!r.url.includes('@'));
  assert.ok(r.halls.length>=1&&r.halls.every(h=>halls.has(h)));
  const k=key(r.company,r.url);
  assert.ok(!index.has(k),'duplicate '+k);
  index.set(k,r);
 }
 let original=0;
 const expectedKeys=new Set();
 for(const h of manifest.halls){
  const source=JSON.parse(read('../public/recruitment-library/v1/'+h.id+'.json'));
  assert.equal(source.records.length,h.published);
  for(const entry of source.records){
   original++;
   expectedKeys.add(key(entry.company,entry.url));
   const r=index.get(key(entry.company,entry.url));
   assert.ok(r,'missing '+h.id+' '+entry.company);
   assert.ok(r.halls.includes(h.id));
  }
 }
 assert.equal(original,manifest.halls.reduce((sum,h)=>sum+h.published,0));
 assert.equal(index.size,expectedKeys.size);
 for(const oldPrivateField of ['source_key','source_batch','source_sequence','actor_email','before_json','after_json'])
  assert.ok(!JSON.stringify(search).includes('"'+oldPrivateField+'"'));
});

test('candidate directory replaces business metrics with professional and company entrances',()=>{
 const start=home.indexOf('function HallSelection(');
 const end=home.indexOf('function HallDetails(',start);
 const section=home.slice(start,end);
 assert.ok(section.includes('寻找你想加入的企业'));
 assert.ok(section.includes('按专业找企业'));
 assert.ok(section.includes('直接搜索目标企业')||section.includes('<GlobalCompanySearch'));
 assert.ok(section.includes('按行业浏览'));
 assert.ok(section.includes('manifest.halls.map'));
 assert.doesNotMatch(section,/hhba-library-overview|数据快照日期|条整理后可浏览的网址记录|item\.enterprises|item\.published/);
 assert.ok(!section.includes('查找行业馆，如汽车'));
 assert.ok(home.includes('候选·待复核'));
 assert.ok(home.includes('曾有来源核对'));
 assert.ok(home.includes('部分招聘网址仍待复核'));
});

test('global search is a single user-triggered static fetch with safe direct links',()=>{
 assert.ok(component.includes("fetch(ROOT+'search.json'"));
 assert.ok(component.includes('if(!query.trim()||index)return'));
 assert.ok(component.includes('let cachedSearch:Promise<SearchIndex>|null=null'));
 assert.ok(component.includes("setPage(1)"));
 assert.ok(component.includes('normalizeName(row.company).includes(q)'));
 assert.ok(component.includes('const groups=new Map<string,CompanyResult>()'));
 assert.ok(component.includes('const PAGE_SIZE=8'));
 assert.ok(component.includes('rel="noopener noreferrer"'));
 assert.ok(component.includes('data-hhba-recruitment-outbound="true"'));
 assert.ok(component.includes("url.protocol==='https:'"));
 assert.ok(component.includes('候选·待复核'));
 assert.ok(component.includes('曾有来源核对'));
 assert.ok(component.includes('当前正在招聘'));
 assert.ok(!component.includes('/admin-preview/api/'));
 assert.ok(!component.includes('/api/ai/'));
 assert.ok(css.includes('@media(max-width:620px)'));
 assert.ok(css.includes('.hhba-company-result-card'));
});
