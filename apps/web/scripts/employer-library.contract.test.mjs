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
const norm=s=>String(s).normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();

test('17 stable industry halls and unique cross-hall employer identities',()=>{
 assert.equal(seed.schema_version,1);
 assert.equal(seed.halls.length,17);
 assert.equal(new Set(seed.halls.map(x=>x.id)).size,17);
 assert.equal(seed.items.length,882);
 assert.equal(new Set(seed.items.map(e=>norm(e.name))).size,seed.items.length);
 assert.equal(seed.statistics.entities,seed.items.length);
 for(const item of seed.items){
  assert.ok(seed.halls.some(h=>h.id===item.industry_id),item.name);
  assert.ok((item.related_hall_ids||[]).every(id=>seed.halls.some(h=>h.id===id)),item.name);
 }
});
test('700 draft PR records are present as unverified search hints, not approved vacancies',()=>{
 assert.equal(batches.batches.reduce((n,b)=>n+b.entries.length,0),700);
 assert.equal(seed.statistics.legacy_portals,130);
 assert.equal(seed.statistics.candidate_portals,685);
 assert.equal(seed.items.reduce((n,e)=>n+e.portals.length,0),815);
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
test('build script regenerates checked-in 882 company catalog exactly',()=>{
 const before=readFileSync(indexPath,'utf8');
 execFileSync(process.execPath,[join(root,'scripts/build-employer-library.mjs')],{cwd:root,stdio:'pipe'});
 assert.equal(readFileSync(indexPath,'utf8'),before,
  'Index drift: run node apps/web/scripts/build-employer-library.mjs and commit the result');
});
