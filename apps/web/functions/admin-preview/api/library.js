// Protected HHBA original admin console: one endpoint for library browse + <=100 upserts.
// D1 writes are disabled until explicit migration; never expose open public write routes.
import {verifyAdmin} from '../../../_lib/admin-access.js';
import {readEmployerLibrary,normalizeEmployerInput,mergeEmployerRecord} from '../../../_lib/employer-library.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(error,status=400)=>json({ok:false,error},status);
async function authorize(request,env){
 const actor=await verifyAdmin(request,env);
 return actor.ok?{actor}:{error:fail(actor.code,actor.status)};
}
export async function onRequestGet({request,env}){
 const a=await authorize(request,env);if(a.error)return a.error;
 try{
  const lib=await readEmployerLibrary(env,request);
  return json({ok:true,kind:'HHBA_EMPLOYER_LIBRARY_V1',...lib,stats:{
   entities:lib.items.length,
   portals:lib.items.reduce((n,x)=>n+(x.portals?.length||0),0),
   unique_urls:new Set(lib.items.flatMap(x=>(x.portals||[]).map(p=>p.url))).size,
   automotive_research_nodes:266,
   automotive_research_brands:lib.brand_index?.length||0,
   groups:lib.items.filter(x=>x.parent_name).length,
   pending:lib.items.filter(x=>x.portals?.some(p=>p.status==='collected_unverified')).length
  }});
 }catch{return fail('LIBRARY_SOURCE_UNAVAILABLE',503);}
}
export async function onRequestPost({request,env}){
 const a=await authorize(request,env);if(a.error)return a.error;
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  return fail('SAME_ORIGIN_REQUIRED',403);
 const len=request.headers.get('Content-Length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>220000))return fail('BATCH_TOO_LARGE',413);
 let input;
 try{
  const text=await request.text();
  if(text.length>220000)return fail('BATCH_TOO_LARGE',413);
  input=JSON.parse(text);
 }catch{return fail('INVALID_JSON',400);}
 if(!input||!Array.isArray(input.items)||input.items.length<1||input.items.length>100)
  return fail('BATCH_LIMIT_100',400);
 let entries;
 try{
  entries=input.items.map(normalizeEmployerInput);
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('DUPLICATE_NAMES_IN_BATCH');
 }catch(e){return fail(e.message||'INVALID_EMPLOYER',400);}
 let library;
 try{library=await readEmployerLibrary(env,request);}catch{return fail('LIBRARY_SOURCE_UNAVAILABLE',503);}
 if(!library.editable||!env.HHBA_METRICS_DB?.batch)return fail('LIBRARY_D1_MIGRATION_REQUIRED',503);
 // Idempotent batch upsert: another hall is an extra tag, not a duplicate company.
 // Keep reviewed links, earlier imports, and the original primary classification.
 const originals=new Map(library.items.map(x=>[x.id,x]));
 entries=entries.map(item=>mergeEmployerRecord(originals.get(item.id),item));
 const actor=a.actor.email;
 const now=new Date().toISOString(),batchId=crypto.randomUUID();
 const db=env.HHBA_METRICS_DB;
 const queries=entries.map(item=>db.prepare(
   'INSERT INTO hhba_employer_library(id,name,industry_id,data_json,updated_at,updated_by) VALUES(?,?,?,?,?,?) '+
   'ON CONFLICT(id) DO UPDATE SET name=excluded.name,industry_id=excluded.industry_id,'+
   'data_json=excluded.data_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by'
  ).bind(item.id,item.name,item.industry_id,JSON.stringify(item),now,actor));
 queries.push(db.prepare(
  'INSERT INTO hhba_employer_library_audit(batch_id,actor,operation,item_count,item_ids_json,created_at) VALUES(?,?,?,?,?,?)'
 ).bind(batchId,actor,'upsert',entries.length,JSON.stringify(entries.map(x=>x.id)),now));
 try{
  const output=await db.batch(queries);
  if(!Array.isArray(output)||output.some(x=>x.success===false))throw Error('BATCH_FAILED');
  return json({ok:true,kind:'HHBA_EMPLOYER_IMPORT_V1',imported:entries.length,batch_id:batchId});
 }catch{
  console.warn('HHBA_EMPLOYER_LIBRARY_WRITE_FAILED');
  return fail('LIBRARY_WRITE_FAILED',503);
 }
}
