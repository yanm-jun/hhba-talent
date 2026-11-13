// Private HHBA employer-directory overlay. This module never creates public
// assets and must only run after verifyAdmin succeeds on admin.hhba.work.
// Baseline: verified production D1 export bundled into a protected Pages Function.
// Deltas: immutable KV entries, 1 write per committed SQL group (no hot KV keys).
const PREFIX='catalog:delta:';
export const MAX_DELTAS=600;
const TTL=12_000;
const cache=new WeakMap();
const safe=v=>typeof v==='string'?v:'';
function readableRow(row){
 return !!row&&typeof row==='object'&&!Array.isArray(row)&&
  typeof row.source_key==='string'&&row.source_key.length>0&&row.source_key.length<=256&&
  typeof row.industry_id==='string'&&typeof row.enterprise==='string'&&
  (row.recruitment_url==null||typeof row.recruitment_url==='string');
}
export async function mergedCatalog(base,kv){
 if(!kv?.list||!kv?.get)return {rows:base,overlayCount:0,cached:true};
 const memo=cache.get(kv);
 if(memo&&Date.now()<memo.until&&memo.base===base)return memo.value;
 const keys=[];
 let cursor;
 do{
  const options={prefix:PREFIX,limit:1000};
  if(cursor)options.cursor=cursor;
  const page=await kv.list(options);
  if(!page||!Array.isArray(page.keys))throw Error('LIBRARY_KV_LIST_MALFORMED');
  keys.push(...page.keys.map(x=>x.name).filter(x=>x.startsWith(PREFIX)));
  if(keys.length>MAX_DELTAS)throw Error('LIBRARY_KV_COMPACTION_REQUIRED');
  cursor=page.list_complete?null:page.cursor;
  if(!page.list_complete&&!cursor)throw Error('LIBRARY_KV_CURSOR_MISSING');
 }while(cursor);
 if(!keys.length){
  const value={rows:base,overlayCount:0,cached:true};
  cache.set(kv,{base,until:Date.now()+TTL,value});
  return value;
 }
 keys.sort();
 const merged=new Map(base.map(row=>[row.source_key,row]));
 for(let start=0;start<keys.length;start+=20){
  const slice=keys.slice(start,start+20);
  const deltas=await Promise.all(slice.map(key=>kv.get(key,'json')));
  for(const d of deltas){
   if(!d||!Array.isArray(d.upserts)||!Array.isArray(d.deletes))throw Error('LIBRARY_KV_DELTA_MALFORMED');
   for(const key of d.deletes){
    if(typeof key!=='string'||key.length>256)throw Error('LIBRARY_KV_DELETE_KEY_INVALID');
    merged.delete(key);
   }
   for(const row of d.upserts){
    if(!readableRow(row))throw Error('LIBRARY_KV_ROW_INVALID');
    merged.set(row.source_key,row);
   }
  }
 }
 const rows=[...merged.values()].sort((a,b)=>a.enterprise.localeCompare(b.enterprise,'zh-CN')||a.source_key.localeCompare(b.source_key));
 const value={rows,overlayCount:keys.length,cached:true};
 cache.set(kv,{base,until:Date.now()+TTL,value});
 return value;
}
export async function appendCatalogDelta(kv,{upserts=[],deletes=[]}={}){
 if(!kv?.put)throw Error('LIBRARY_KV_NOT_BOUND');
 if(!Array.isArray(upserts)||!Array.isArray(deletes)||!upserts.every(readableRow)||
  !deletes.every(k=>typeof k==='string'&&k.length>0&&k.length<=256))
  throw Error('LIBRARY_KV_DELTA_INVALID');
 if(!upserts.length&&!deletes.length)return;
 // Immutable unique key: avoids the KV same-key 1-write/second limit and lost
 // concurrent updates. Entries are compacted into a new export periodically.
 const key=PREFIX+String(Date.now()).padStart(13,'0')+':'+crypto.randomUUID();
 await kv.put(key,JSON.stringify({upserts,deletes,at:new Date().toISOString()}));
 cache.delete(kv);
}
export function calculateCatalogSummary(rows,industries,{asOf=null,overlayCount=0}={}){
 const stats=new Map(industries.map(([id])=>[id,{records:0,linked:0,missing:0,verified:0,historical_verified:0,candidate:0,urls:new Set(),companies:new Map()}]));
 const urls=new Set(),companies=new Map();let linked=0,verified=0,historicalVerified=0,candidate=0;
 for(const row of rows){
  const x=stats.get(row.industry_id);
  if(x)x.records++;
  const name=safe(row.enterprise).trim(),url=safe(row.recruitment_url).trim().toLowerCase(),hasUrl=!!url;
  if(name){
   companies.set(name,companies.get(name)===true||hasUrl);
   if(x)x.companies.set(name,x.companies.get(name)===true||hasUrl);
  }
  if(hasUrl){
   linked++;urls.add(url);
   if(x){x.linked++;x.urls.add(url)}
   // 'Collected' is not 'verified': verification is a separately recorded state.
   if(row.source_kind==='admin_verified_official'){
    verified++;if(x)x.verified++;
   }else if(row.source_kind==='previously_reviewed_official'){
    historicalVerified++;if(x)x.historical_verified++;
   }else{
    candidate++;if(x)x.candidate++;
   }
  }else if(x)x.missing++;
 }
 const linkedCompanies=[...companies.values()].filter(Boolean).length;
 return {
  asOf,overlayCount,
  total:{records:rows.length,linked,missing:rows.length-linked,unique_urls:urls.size,
   verified,historical_verified:historicalVerified,candidate,
   enterprises:companies.size,enterprises_linked:linkedCompanies,enterprises_missing:companies.size-linkedCompanies},
  industries:industries.map(([id,label])=>{
   const s=stats.get(id),companiesLinked=[...s.companies.values()].filter(Boolean).length;
   return {id,label,records:s.records,linked:s.linked,missing:s.missing,unique_urls:s.urls.size,
    verified:s.verified,historical_verified:s.historical_verified,candidate:s.candidate,
    enterprises:s.companies.size,enterprises_linked:companiesLinked,enterprises_missing:s.companies.size-companiesLinked};
  })
 };
}
