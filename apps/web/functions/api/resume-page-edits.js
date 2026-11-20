// Candidate-owned reviewable modifications to a *copy* of an original PDF.
// This endpoint never changes the PDF bytes and does not create a fake
// "layout-preserving export". The cache is deleted with its source resume.
import {sessionOfBearer,getUserByPhone} from '../_lib/real-auth.js';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BYTES=120000,MAX_CHANGES=60;
const send=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}
});
const fail=(code,status=400)=>send({ok:false,error:code},status);
function enabled(env){
 return env?.HHBA_RESUME_VISION_ENABLED==='1'&&
  (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function'&&
  typeof env?.HHBA_PRIVATE_RESUMES?.get==='function'&&
  typeof env?.HHBA_PRIVATE_RESUMES?.put==='function'&&
  typeof env?.HHBA_PRIVATE_RESUMES?.delete==='function';
}
const sameOrigin=request=>request.headers.get('Origin')===new URL(request.url).origin&&
 request.headers.get('Sec-Fetch-Site')!=='cross-site';
async function smallJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('INVALID_BODY');
 const length=request.headers.get('Content-Length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))
  throw Error('INVALID_BODY');
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_BODY');
 const chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;
  total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw Error('INVALID_BODY');}
  chunks.push(value);
 }}finally{reader.releaseLock();}
 const combined=new Uint8Array(total);let off=0;
 for(const chunk of chunks){combined.set(chunk,off);off+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(combined));}
 catch{throw Error('INVALID_BODY');}
}
const toKey=storageKey=>storageKey+'.hhba-page-edits-v1.json';
const layoutKey=storageKey=>storageKey+'.hhba-vision-layout-v1.json';
async function getCandidate(db,request){
 const session=await sessionOfBearer(db,request,Date.now());
 if(!session)return {error:'SESSION_INVALID',status:401};
 const user=await getUserByPhone(db,session.phone);
 if(user?.role!=='candidate')return {error:'FORBIDDEN',status:403};
 return {phone:session.phone};
}
async function getRow(db,id,phone){
 return db.prepare(
  'SELECT id,storage_key,sha256,media_type FROM hhba_candidate_resumes WHERE id=? AND phone=?'
 ).bind(id,phone).first();
}
async function cachedLayout(bucket,row){
 const cached=await bucket.get(layoutKey(row.storage_key));
 if(!cached)return null;
 const result=await cached.json();
 return result?.schema==='HHBA_RESUME_VISUAL_LAYOUT_V1'&&
  result.source_sha256===row.sha256&&Array.isArray(result.regions)?result:null;
}
function validChanges(body,layout){
 if(!body||Array.isArray(body)||typeof body!=='object'||
  body.confirmed_real!==true||!Array.isArray(body.changes)||
  body.changes.length>MAX_CHANGES)return null;
 const regions=new Map(layout.regions.map(r=>[r.id,r]));
 const seen=new Set(),changes=[];
 for(const item of body.changes){
  if(!item||typeof item!=='object'||Array.isArray(item)||
   typeof item.id!=='string'||seen.has(item.id))return null;
  const source=regions.get(item.id);
  if(!source||typeof item.original!=='string'||item.original!==source.text||
   typeof item.text!=='string'||!item.text.trim()||item.text.length>1600||
   item.confirmed!==true)return null;
  // Empty changes are allowed only by omitting this region from the array.
  seen.add(item.id);
  changes.push({id:item.id,page:source.page,original:source.text,
   text:item.text.trim(),confirmed:true});
 }
 return changes;
}
export async function onRequestGet({request,env}){
 if(!enabled(env))return fail('EDITS_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let session;
 try{session=await getCandidate(db,request);}
 catch{return fail('SESSION_INVALID',401);}
 if(session.error)return fail(session.error,session.status);
 const id=new URL(request.url).searchParams.get('resume_id');
 if(!id||!ID.test(id))return fail('INVALID_RESUME',400);
 try{
  const row=await getRow(db,id,session.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  const obj=await bucket.get(toKey(row.storage_key));
  if(!obj)return send({ok:true,changes:[]});
  const doc=await obj.json();
  if(doc?.source_sha256!==row.sha256||!Array.isArray(doc?.changes))
   return fail('EDITS_STALE',409);
  return send({ok:true,changes:doc.changes.slice(0,MAX_CHANGES)});
 }catch{return fail('EDITS_UNAVAILABLE',503);}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!enabled(env))return fail('EDITS_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let session;
 try{session=await getCandidate(db,request);}
 catch{return fail('SESSION_INVALID',401);}
 if(session.error)return fail(session.error,session.status);
 let body;
 try{body=await smallJson(request);}
 catch{return fail('INVALID_REQUEST',400);}
 if(!ID.test(String(body?.resume_id||'')))return fail('INVALID_RESUME',400);
 try{
  const row=await getRow(db,body.resume_id,session.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(row.media_type!=='application/pdf')return fail('FORMAT_NOT_EDITABLE',422);
  const layout=await cachedLayout(bucket,row);
  if(!layout)return fail('LAYOUT_NOT_READY',409);
  const changes=validChanges(body,layout);
  if(!changes)return fail('INVALID_CHANGES',400);
  const now=new Date().toISOString();
  await bucket.put(toKey(row.storage_key),
   JSON.stringify({schema:'HHBA_RESUME_PAGE_EDITS_V1',source_sha256:row.sha256,
    changes,updated_at:now}),
   {httpMetadata:{contentType:'application/json'}});
  return send({ok:true,changes,updated_at:now});
 }catch{return fail('EDITS_UNAVAILABLE',503);}
}
export async function onRequestDelete({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!enabled(env))return fail('EDITS_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let session;
 try{session=await getCandidate(db,request);}
 catch{return fail('SESSION_INVALID',401);}
 if(session.error)return fail(session.error,session.status);
 const id=new URL(request.url).searchParams.get('resume_id');
 if(!id||!ID.test(id))return fail('INVALID_RESUME',400);
 try{
  const row=await getRow(db,id,session.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  await bucket.delete(toKey(row.storage_key));
  return send({ok:true,deleted:true});
 }catch{return fail('EDITS_UNAVAILABLE',503);}
}
