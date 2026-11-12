import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {employerSearchHints,normalizeEmployerInput,mergeEmployerRecord} from '../functions/_lib/employer-library.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const indexPath=join(root,'public/data/employer-library.json');
const read=name=>JSON.parse(readFileSync(join(root,'src/data',name),'utf8'));
const seed=JSON.parse(readFileSync(indexPath,'utf8'));
const batches=read('employerLibraryCandidateBatches.json');
const baseRecovered=read('employerLibraryRecoveredChatNames.json');
const supplementalRecovered=read('employerLibraryRecoveredChatNamesSupplement.json');
const recovered={...baseRecovered,batches:[...baseRecovered.batches,...supplementalRecovered.batches]};
const restoredCount=recovered.batches.reduce((n,b)=>n+b.entries.length,0);
const norm=s=>String(s).normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();

test('17 stable industry halls and unique cross-hall employer identities',()=>{
 assert.equal(seed.schema_version,1);
 assert.equal(seed.halls.length,17);
 assert.equal(new Set(seed.halls.map(x=>x.id)).size,17);
 assert.ok(seed.items.length>=882);
 assert.equal(new Set(seed.items.map(e=>norm(e.name))).size,seed.items.length);
 assert.equal(seed.statistics.entities,seed.items.length);
 for(const item of seed.items){
  assert.ok(seed.halls.some(h=>h.id===item.industry_id),item.name);
  assert.ok((item.related_hall_ids||[]).every(id=>seed.halls.some(h=>h.id===id)),item.name);
 }
});
test('collected draft PR records are present as unverified search hints, not approved vacancies',()=>{
 const imported=batches.batches.reduce((n,b)=>n+b.entries.length,0);
 assert.ok(imported>=700);
 assert.equal(seed.collection_coverage.target_total,3800);
 assert.equal(seed.collection_coverage.imported_batch_records,imported+restoredCount);
 assert.equal(seed.collection_coverage.unimported_batch_records,3800-imported-restoredCount);
 assert.equal(Object.values(seed.collection_coverage.imported_by_hall).reduce((a,b)=>a+b,0),imported+restoredCount);
 assert.equal(Object.values(seed.collection_coverage.target_by_hall).reduce((a,b)=>a+b,0),3800);
 for(const hall of seed.halls){
  const id=hall.id;
  assert.ok(seed.collection_coverage.imported_by_hall[id]<=seed.collection_coverage.target_by_hall[id],id);
  assert.equal(seed.collection_coverage.unimported_by_hall[id],
   seed.collection_coverage.target_by_hall[id]-seed.collection_coverage.imported_by_hall[id]);
 }
 assert.equal(seed.statistics.legacy_portals,130);
 assert.ok(seed.statistics.candidate_portals>=685);
 assert.ok(seed.items.reduce((n,e)=>n+e.portals.length,0)>=815);
 for(const b of batches.batches){
  for(const tuple of b.entries){
   const item=seed.items.find(e=>e.id===norm(tuple[1]));
   assert.ok(item,tuple[1]);
   const portal=item.portals.find(p=>p.url===tuple[2]);
   assert.ok(portal,tuple[1]+' '+tuple[2]);
   assert.ok(portal.status==='collected_unverified'||portal.status==='legacy_reviewed');
  }
 }
});
test('150 prior Preview audit rows are preserved separately from chat collection targets',()=>{
 const audits=read('employerLibraryPriorAudit150.json');
 assert.equal(audits.records.length,150);
 assert.equal(new Set(audits.records.map(r=>r.batch+'-'+r.sequence)).size,150);
 assert.equal(audits.records.filter(r=>r.status==='preview_verified').length,136);
 assert.equal(audits.records.filter(r=>r.status==='pending').length,14);
 assert.equal(seed.statistics.prior_audit_source_rows,150);
 assert.equal(seed.collection_coverage.imported_batch_records,700+restoredCount);
 for(const row of audits.records){
  const company=seed.items.find(e=>e.id===norm(row.name));
  assert.ok(company,row.name);
  const source=company.portals.find(p=>p.url===row.url);
  assert.ok(source,row.name+': '+row.url);
  if(source.source_batch===row.batch){
   assert.equal(source.status,'collected_unverified');
   assert.equal(source.historical_preview_status,row.status);
  }
 }
});
test('recovered historical chat source rows remain traceable without fabricated portals',()=>{
 assert.equal(restoredCount,recovered.batches.reduce((n,b)=>n+b.entries.length,0));
 assert.equal(new Set(recovered.batches.map(b=>b.batch_key)).size,recovered.batches.length);
 assert.equal(seed.statistics.recovered_name_rows,restoredCount);
 const units=recovered.batches.flatMap(b=>b.entries).filter(x=>x.record_type==='business_unit');
 assert.ok(units.length>=28);
 assert.equal(seed.historical_non_employer_index.length,units.length);
 assert.equal(seed.collection_coverage.imported_by_hall['consumer-hardware'],200);
 assert.equal(seed.collection_coverage.unimported_by_hall['consumer-hardware'],0);
 assert.equal(seed.collection_coverage.imported_by_hall['internet-ai'],200);
 assert.equal(seed.collection_coverage.imported_by_hall['manufacturing'],400);
 assert.equal(seed.collection_coverage.imported_by_hall['chem-materials'],200);
 assert.equal(seed.collection_coverage.imported_by_hall['biomed'],300);
 assert.equal(seed.collection_coverage.imported_by_hall['retail'],200);
 assert.equal(seed.collection_coverage.imported_by_hall['manufacturing'],400);
 assert.equal(seed.collection_coverage.imported_by_hall['education-research'],100);
 assert.equal(seed.collection_coverage.imported_by_hall['finance'],100);
 assert.equal(seed.collection_coverage.unimported_by_hall['finance'],0);
 assert.equal(seed.collection_coverage.imported_by_hall['telecom'],100);
 assert.equal(seed.collection_coverage.unimported_by_hall['telecom'],0);
 assert.equal(seed.collection_coverage.imported_by_hall['culture-media'],200);
 assert.equal(seed.collection_coverage.unimported_by_hall['culture-media'],0);
 const seqs=recovered.batches.flatMap(b=>b.entries.map(x=>x.sequence));
 assert.ok(seqs.length===restoredCount);
 for(const group of recovered.batches){
  assert.ok(group.entries.length>=1&&group.entries.length<=100);
  for(const item of group.entries){
   assert.equal(item.url,null);
   assert.equal(item.url_status,'not_recorded');
   if(item.record_type==='business_unit'){
    assert.ok(seed.historical_non_employer_index.some(x=>x.sequence===item.sequence),item.name);
   }else{
    const row=seed.items.find(x=>x.historical_source_records?.some(z=>
     z.batch_key===group.batch_key&&z.sequence===item.sequence));
    assert.ok(row,item.name);
    assert.ok(row.historical_source_records.every(x=>x.has_original_url===false));
   }
  }
 }
});
test('first-party careers evidence is preserved but never marked as real vacancy',()=>{
 const sites=read('employerLibraryWebFoundPortals.json');
 assert.equal(sites.records.length,4);
 assert.equal(seed.statistics.web_found_portals,4);
 for(const item of sites.records){
  const employer=seed.items.find(e=>e.id===norm(item.name));
  assert.ok(employer,item.name);
  const portal=employer.portals.find(p=>p.url===item.url);
  assert.ok(portal,item.url);
  assert.equal(portal.status,'collected_unverified');
  assert.equal(portal.scope,'search_candidate');
  assert.equal(portal.evidence_url,item.evidence_url);
 }
});
test('group-shared and HTTP candidates never become DeepSeek trusted job links',()=>{
 const shared={name:'国网子公司',industry_id:'energy',aliases:[],portals:[
  {url:'https://zhaopin.sgcc.com.cn/',scope:'group_shared_candidate',status:'collected_unverified'}]};
 const forbidden={name:'某企业',industry_id:'energy',aliases:[],portals:[
  {url:'http://example.com/careers',scope:'search_candidate',status:'collected_unverified'}]};
 assert.deepEqual(employerSearchHints([shared,forbidden],'电力工程师','电力工程师'),[]);
 const named=employerSearchHints([shared],'曾在国网子公司从事电力项目','电力工程师');
 assert.equal(named.length,1);
 assert.match(named[0],/国网子公司/);
 assert.match(named[0],/集团招聘平台/);
 const safe={name:'电力设备制造公司',industry_id:'energy',aliases:[],portals:[
  {url:'https://careers.example.com/',scope:'search_candidate',status:'collected_unverified'}]};
 const hints=employerSearchHints([shared,forbidden,safe],'电力设备制造','电力工程师');
 assert.equal(hints.length,1);
 assert.match(hints[0],/site:careers\.example\.com/);
 assert.doesNotMatch(hints[0],/http:\/\//);
});
test('missing career URL is searchable by an explicitly named employer only',()=>{
 const item={id:'测试培训企业',name:'测试培训企业',industry_id:'education-research',
  aliases:[],portals:[],historical_source_records:[{batch_key:'education-research-001-100',sequence:9,has_original_url:false}]};
 const named=employerSearchHints([item],'曾在测试培训企业任职','教育运营',2);
 assert.equal(named.length,1);
 assert.match(named[0],/测试培训企业.*企业官网 官方招聘/);
 assert.doesNotMatch(named[0],/(?:^|\\s)site:/);
 assert.deepEqual(employerSearchHints([item],'教育培训行业从业','教育运营',2),[]);
});
test('admin input enforces sector and https with no invented verification',()=>{
 assert.throws(()=>normalizeEmployerInput({name:'示例公司',industry_id:'other'}),/INVALID/);
 assert.throws(()=>normalizeEmployerInput({name:'示例公司',industry_id:'automotive',portals:[{url:'http://example.com/jobs'}]}),/INVALID/);
 const row=normalizeEmployerInput({name:'测试汽车有限公司',industry_id:'automotive',
  parent_name:'上汽集团',portals:[{url:'https://careers.example.com/'}]});
 assert.equal(row.portals[0].status,'collected_unverified');
 assert.equal(row.parent_name,'上汽集团');
});
test('same company imported into another hall keeps its original hall and audited portals',()=>{
 const first=normalizeEmployerInput({name:'汇方测试科技',industry_id:'automotive',
  portals:[{url:'https://careers.example.cn/openings'}]});
 first.portals[0].status='legacy_reviewed';first.portals[0].reviewed_on='2026-10-21';
 const other=normalizeEmployerInput({name:'汇方测试科技',industry_id:'semiconductor',
  portals:[{url:'https://jobs.example.cn/'}]});
 const merged=mergeEmployerRecord(first,other);
 assert.equal(merged.industry_id,'automotive');
 assert.deepEqual(merged.related_hall_ids,['semiconductor']);
 assert.equal(merged.portals.length,2);
 assert.equal(merged.portals[0].status,'legacy_reviewed');
 const again=mergeEmployerRecord(merged,other);
 assert.deepEqual(again.related_hall_ids,['semiconductor']);
 assert.equal(again.portals.length,2);
 assert.deepEqual(again.source_datasets,['admin_import']);
});
test('source hints prefer matching employers and reject normal third-party job boards',()=>{
 const base=name=>({name,industry_id:'automotive',aliases:[],portals:[{
  url:'https://careers.example.com/jobs',scope:'search_candidate',status:'collected_unverified'}]});
 const rows=[base('其他车企'),{...base('比亚迪'),portals:[{
  url:'https://job.byd.com/',scope:'employer_portal',status:'legacy_reviewed'}]},
  {...base('无效来源'),portals:[{
  url:'https://www.zhipin.com/abc',scope:'employer_portal',status:'legacy_reviewed'}]}];
 const hints=employerSearchHints(rows,'曾在比亚迪任职','汽车运营',2);
 assert.ok(hints.length>=1);
 assert.match(hints[0],/比亚迪/);
 assert.ok(hints.every(x=>!x.includes('zhipin.com')));
 assert.throws(()=>normalizeEmployerInput({name:'招聘站公司',industry_id:'automotive',
  portals:['https://www.zhipin.com/jobs/']}),/INVALID_EMPLOYER_PORTAL_URL/);
});
test('266 automotive research nodes preserve brand-vs-employer identities',()=>{
 const research=read('employerLibraryAutomotiveResearch266.json');
 assert.equal(research.nodes.length,266);
 assert.equal(seed.statistics.automotive_research_nodes,266);
 assert.equal(seed.statistics.automotive_research_brands,36);
 assert.equal(seed.research_brand_index.length,36);
 assert.ok(seed.research_brand_index.every(x=>x.is_employer===false));
 for(const node of research.nodes.filter(x=>x.entity_type!=='品牌/产品线')){
  const company=seed.items.find(e=>e.id===norm(node.name));
  assert.ok(company,node.name);
  assert.ok(company.research_relationships?.some(x=>x.sequence===node.sequence),node.name);
 }
 const foreign=seed.items.filter(e=>e.research_scope==='overseas_entity_not_mainland_search');
 assert.equal(foreign.length,4);
 assert.deepEqual(employerSearchHints([{
  ...foreign[0],portals:[{url:'https://careers.example.com/',scope:'search_candidate',status:'collected_unverified'}]
 }],foreign[0].name,'汽车研发'),[]);
 assert.equal(seed.collection_coverage.imported_batch_records,700+restoredCount);
});
test('named subsidiary falls back to parent careers as a search hint only',()=>{
 const parent={id:'集团',name:'集团',industry_id:'automotive',aliases:[],portals:[{
  url:'https://careers.example.com/jobs',scope:'employer_portal',status:'legacy_reviewed'}]};
 const child={id:'集团子公司',name:'集团子公司',parent_name:'集团',industry_id:'automotive',
  aliases:[],portals:[],research_relationships:[{parent_name:'集团',group_name:'集团'}]};
 const hints=employerSearchHints([parent,child],'在集团子公司任职','汽车项目运营',2);
 assert.ok(hints.some(x=>x.includes('集团子公司')&&x.includes('site:careers.example.com')));
 assert.ok(hints.every(x=>!x.includes('http://')));
});
test('automotive brand is only an evidence-backed search alias, never its own employer',()=>{
 const parent={id:'汽车集团',name:'汽车集团',industry_id:'automotive',aliases:[],portals:[{
  url:'https://careers.example.com/',scope:'employer_portal',status:'legacy_reviewed'}]};
 const hints=employerSearchHints([parent],'从事坦克品牌营销','市场运营',2,[{
  name:'坦克',parent_name:'汽车集团',group_name:'汽车集团',is_employer:false}]);
 assert.equal(hints.length,1);
 assert.match(hints[0],/品牌坦克/);
 assert.match(hints[0],/用人主体待核/);
});
test('build script regenerates checked-in company catalog exactly',()=>{
 const before=readFileSync(indexPath,'utf8');
 execFileSync(process.execPath,[join(root,'scripts/build-employer-library.mjs')],{cwd:root,stdio:'pipe'});
 const after=readFileSync(indexPath,'utf8');
 if(before!==after){
  const b=JSON.parse(before),a=JSON.parse(after);
  const oldItems=new Map(b.items.map(x=>[x.id,x])),newItems=new Map(a.items.map(x=>[x.id,x]));
  const added=[...newItems.keys()].filter(x=>!oldItems.has(x)),removed=[...oldItems.keys()].filter(x=>!newItems.has(x));
  const changed=[...oldItems.keys()].filter(x=>newItems.has(x)&&JSON.stringify(oldItems.get(x))!==JSON.stringify(newItems.get(x)));
  console.error('HHBA_INDEX_DRIFT_DETAIL',JSON.stringify({added:added.slice(0,20),removed:removed.slice(0,20),changed:changed.slice(0,20),
   expectedCount:b.items.length,actualCount:a.items.length,statsExpected:b.statistics,statsActual:a.statistics,
   firstChanged:changed.length?{old:oldItems.get(changed[0]),new:newItems.get(changed[0])}:null}).slice(0,5000));
 }
 assert.equal(after,before,'Index drift: builder output differs from committed source');
});

test('historical-chat batch provenance and numbering cannot silently double-count',()=>{
 const keys=new Set();
 for(const batch of recovered.batches){
  assert.match(batch.batch_key,/^[-a-z0-9]+-\d{3}-\d{3}$/);
  assert.ok(batch.batch_key.startsWith((batch.hall_id||recovered.hall_id)+'-'));
  assert.ok(!keys.has(batch.batch_key),'duplicate source batch '+batch.batch_key);
  keys.add(batch.batch_key);
  const matches=batch.batch_key.match(/-(\d{3})-(\d{3})$/);
  const first=Number(matches[1]),last=Number(matches[2]);
  assert.equal(last-first,99);
  const missing=batch.missing_sequences||[];
  assert.ok(missing.length===0||batch.incomplete_source===true);
  assert.equal(batch.entries.length,100-missing.length);
  assert.deepEqual(batch.entries.map(r=>r.sequence),Array.from({length:100},(_,i)=>first+i).filter(n=>!missing.includes(n)));
 }
});

test('publicly researched education brands are indexed without inflating chat recovery',()=>{
 const research=read('employerLibraryEducationResearch100.json');
 assert.equal(research.entries.length,100);
 assert.equal(research.source_kind,'new_public_research_not_historical_chat_recovery');
 assert.equal(seed.statistics.education_public_research_candidates,100);
 assert.equal(seed.collection_coverage.imported_batch_records,700+restoredCount);
 for(const candidate of research.entries){
  assert.equal(candidate.url,null);
  const entry=seed.items.find(e=>norm(e.name)===norm(candidate.name));
  assert.ok(entry,'education brand missing from discovery '+candidate.name);
  assert.ok(entry.public_research_evidence?.some(x=>x.batch_key===research.batch_key&&x.sequence===candidate.sequence));
 }
});
