import test from 'node:test';
import assert from 'node:assert/strict';
import {mergedCatalog,appendCatalogDelta,calculateCatalogSummary} from '../functions/_lib/library-snapshot-cache.js';

const base=[
 {source_key:'old:001',industry_id:'automotive',enterprise:'汽车集团甲',recruitment_url:'https://jobs.auto.example/',source_kind:'candidate',status:'candidate'},
 {source_key:'old:002',industry_id:'automotive',enterprise:'汽车集团乙',recruitment_url:'https://jobs.auto.example',source_kind:'candidate',status:'candidate'},
 {source_key:'old:003',industry_id:'internet-ai',enterprise:'互联网公司',recruitment_url:null,status:'missing'}
];
function mockKV(){
 const store=new Map();
 return {store,reads:0,writes:0,async list({prefix,cursor}){
  this.reads++;
  const keys=[...store.keys()].filter(x=>x.startsWith(prefix)).sort();
  if(cursor)throw Error('unnecessary cursor');
  return {keys:keys.map(name=>({name})),list_complete:true};
 },async get(key,mode){this.reads++;const s=store.get(key);return s===undefined?null:mode==='json'?JSON.parse(s):s},
 async put(key,data){this.writes++;if(store.has(key))throw Error('hot-key collision');store.set(key,data)}};
}
test('Cloudflare KV catalog serves base directory with no D1 queries or fake companies',async()=>{
 const kv=mockKV();
 const result=await mergedCatalog(base,kv);
 assert.equal(result.rows.length,3);
 assert.equal(result.overlayCount,0);
 assert.equal(kv.writes,0);
 const summary=calculateCatalogSummary(result.rows,[['automotive','汽车馆'],['internet-ai','互联网与AI馆']]);
 assert.equal(summary.total.records,3);
 assert.equal(summary.total.unique_urls,2,'URL with a trailing slash remains distinct by the existing full-DB trim rule');
 assert.equal(summary.total.missing,1);
});
test('Immutable KV change batches overlay inserts edits and deletes without altering source baseline',async()=>{
 const kv=mockKV();
 await mergedCatalog(base,kv);
 await appendCatalogDelta(kv,{upserts:[
  {source_key:'admin:004',industry_id:'finance',enterprise:'金融新公司',recruitment_url:'https://jobs.finance.example',status:'candidate'}
 ]});
 await appendCatalogDelta(kv,{upserts:[
  {source_key:'old:001',industry_id:'automotive',enterprise:'汽车集团甲',recruitment_url:'https://new.auto.example',status:'candidate'}
 ],deletes:['old:003']});
 assert.equal(kv.writes,2);
 const result=await mergedCatalog(base,kv);
 assert.equal(result.rows.length,3);
 assert.equal(result.overlayCount,2);
 assert.equal(result.rows.find(x=>x.source_key==='old:003'),undefined);
 assert.equal(result.rows.find(x=>x.source_key==='old:001').recruitment_url,'https://new.auto.example');
 assert.ok(result.rows.find(x=>x.enterprise==='金融新公司'));
 assert.equal(base[0].recruitment_url,'https://jobs.auto.example/','baseline is never mutated');
 const summary=calculateCatalogSummary(result.rows,[['automotive','汽车馆'],['finance','金融馆']]);
 assert.equal(summary.total.records,3);
 assert.equal(summary.total.missing,0);
 assert.equal(summary.industries.find(x=>x.id==='finance').unique_urls,1);
});
test('Each imported batch writes its own KV key (avoids one-write-per-second hot key)',async()=>{
 const kv=mockKV();
 for(let i=0;i<38;i++)await appendCatalogDelta(kv,{upserts:[
  {source_key:'upload:'+i,industry_id:'automotive',enterprise:'新增企业'+i,recruitment_url:'https://careers'+i+'.example.com'}
 ]});
 assert.equal(kv.store.size,38);
 const result=await mergedCatalog(base,kv);
 assert.equal(result.rows.length,base.length+38);
 assert.equal(result.overlayCount,38);
});
test('Corrupted delta cannot silently erase or impersonate directory entries',async()=>{
 const kv=mockKV();
 kv.store.set('catalog:delta:0000000000000:bad',JSON.stringify({upserts:[{source_key:'bad'}],deletes:[]}));
 await assert.rejects(mergedCatalog(base,kv),/LIBRARY_KV_ROW_INVALID/);
});
test('KV writes are rejected when no authenticated private catalog cache is bound',async()=>{
 await assert.rejects(appendCatalogDelta(null,{upserts:base}),/LIBRARY_KV_NOT_BOUND/);
});
