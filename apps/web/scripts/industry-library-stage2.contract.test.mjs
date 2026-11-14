import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../public/recruitment-library/v1/manifest.json'));
const src=read('../src/pages/IndustryLibraryPage.tsx');
const home=read('../src/pages/HomePage.tsx');
const shell=read('../src/components/Shell.tsx');
const main=read('../src/main.tsx');
const expectedIds=[
 'automotive','semiconductor','internet-ai','energy','manufacturing','finance','telecom','biomed',
 'aerospace','logistics','construction','consumer-hardware','chem-materials','retail',
 'agri-food','culture-media','education-research'
];

test('17 public halls use the actual scoped D1 export and source numbers',()=>{
 assert.equal(manifest.kind,'HHBA_INDUSTRY_LIBRARY_MANIFEST_V1');
 assert.equal(manifest.halls.length,17);
 assert.deepEqual(manifest.halls.map(h=>h.id),expectedIds);
 assert.equal(new Set(manifest.halls.map(h=>h.label)).size,17);
 assert.equal(manifest.asOf,'2026-11-14');
 assert.equal(manifest.halls.reduce((n,h)=>n+h.sourceRecords,0),5288);
 assert.equal(manifest.halls.reduce((n,h)=>n+h.sourceLinked,0),3555);
 assert.equal(manifest.halls.reduce((n,h)=>n+h.published,0),2959);
 for(const hall of manifest.halls){
  assert.ok(hall.sourceRecords>=hall.sourceLinked);
  assert.ok(hall.sourceLinked>=hall.published);
  assert.equal(hall.unlinked,hall.sourceRecords-hall.sourceLinked);
 }
});

test('each hall publishes only safe non-duplicated recruitment links, no private fields',()=>{
 for(const h of manifest.halls){
  const raw=read('../public/recruitment-library/v1/'+h.id+'.json');
  const content=JSON.parse(raw);
  assert.equal(content.kind,'HHBA_INDUSTRY_LIBRARY_HALL_V1',h.id);
  assert.equal(content.hall,h.id);
  assert.equal(content.asOf,manifest.asOf);
  assert.ok(Array.isArray(content.records));
  assert.equal(content.records.length,h.published);
  const unique=new Set();
  for(const record of content.records){
   assert.deepEqual(Object.keys(record).sort(),['company','review','url'],h.id);
   assert.ok(typeof record.company==='string'&&record.company.trim(),h.id);
   assert.ok(record.company.length<=120,h.id);
   assert.ok(['candidate','reviewed_history'].includes(record.review),h.id);
   const url=new URL(record.url);
   assert.equal(url.protocol,'https:',record.url);
   assert.equal(url.username,'',record.url);
   assert.equal(url.password,'',record.url);
   assert.equal(url.port,'',record.url);
   assert.ok(url.hostname.includes('.'),record.url);
   assert.ok(!record.url.includes('@'),record.url);
   for(const key of url.searchParams.keys()){
    assert.doesNotMatch(key,/(?:^|[_-])(token|password|secret|signature|session|sessionid|apikey|api_key|access_key|refresh_token|jwt|credential|id_card)(?:$|[_-])/i);
   }
   const key=record.company.toLowerCase()+'|'+record.url.replace(/\/$/,'').toLowerCase();
   assert.ok(!unique.has(key),'duplicated '+h.id+' '+key);
   unique.add(key);
  }
  assert.equal(new Set(content.records.map(x=>x.company)).size,h.enterprises);
  assert.equal(content.records.filter(x=>x.review==='reviewed_history').length,h.reviewed);
  for(const privateField of ['source_key','source_batch','source_sequence','actor_email','before_json','after_json'])
   assert.ok(!raw.includes('"'+privateField+'"'),'private source field exposed '+h.id+' '+privateField);
 }
});

test('second-stage navigation uses the new public directory, retains existing resources',()=>{
 assert.ok(main.includes('IndustryLibraryPage=lazy'));
 const routeIdx=main.indexOf("route==='/companies/library'");
 const legacyIdx=main.indexOf("route==='/companies/discover'");
 assert.ok(routeIdx>0&&legacyIdx>routeIdx,'new route must precede legacy company routes');
 assert.ok(home.includes(":'/companies/library'"));
 assert.equal(shell.split('to="/companies/library">企业招聘导航</Link>').length-1,2);
 assert.ok(home.includes('title="我要应聘"'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(home.includes('<HomeCompanyMarquee/>'));
 assert.ok(!home.includes('HomeLiveDrawer'));
 assert.ok(!home.includes('我要招人'));
 assert.ok(!src.includes('/admin-preview/api/library'));
});

test('static files load one hall at a time, with search, filters and safe outbound guard',()=>{
 assert.ok(src.includes("fetch(ROOT+'manifest.json'"));
 assert.ok(src.includes("fetch(ROOT+hallId+'.json'"));
 assert.ok(src.includes('const PAGE_SIZE=25'));
 assert.ok(src.includes('setPage(1)'));
 assert.ok(src.includes('item.company'));
 assert.ok(src.includes('item.url'));
 assert.doesNotMatch(src,/候选·待复核|曾有来源核对|hhba-library-tag|网址来源状态/);
 assert.ok(src.includes('部分招聘网址仍待复核'));
 assert.ok(src.includes('data-hhba-recruitment-outbound="true"'));
 assert.ok(src.includes('rel="noopener noreferrer"'));
 assert.ok(src.includes("url.protocol!=='https:'"));
 assert.ok(src.includes('aria-label="行业馆列表分页"'));
 assert.ok(!src.includes('hhba_industry_employer_links'));
});
