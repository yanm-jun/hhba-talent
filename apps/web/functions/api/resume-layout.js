// Opt-in visual-first original-document layout. The UI is intentionally
// unaware of model internals. Private R2 source bytes are never made public.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {VISION_SCHEMA,analyzeOriginalPdf,visualProviderConfigured} from '../_lib/resume-visual-layout.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY=2048,PER_DAY=2;
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status)=>send({ok:false,error:code},status);
const allowed=env=>env?.HHBA_RESUME_VISION_ENABLED==='1'&&
 (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function'&&
 typeof env?.HHBA_PRIVATE_RESUMES?.get==='function'&&
 typeof env?.HHBA_PRIVATE_RESUMES?.put==='function'&&
 typeof env?.HHBA_MATCH_LIMIT_PEPPER==='string'&&
 env.HHBA_MATCH_LIMIT_PEPPER.length>=24&&visualProviderConfigured(env);
const sameOrigin=request=>{
 const origin=request.headers.get('Origin');
 return origin===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
};
async function readInput(request){
 const type=request.headers.get('Content-Type')||'';
 if(!type.toLowerCase().startsWith('application/json'))throw Error('BAD_INPUT');
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw Error('BAD_INPUT');
 const reader=request.body?.getReader();if(!reader)throw Error('BAD_INPUT');
 let count=0;const parts=[];
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;
  count+=chunk.value.byteLength;if(count>MAX_BODY){await reader.cancel();throw Error('BAD_INPUT');}
  parts.push(chunk.value);}
 }finally{reader.releaseLock();}
 const data=new Uint8Array(count);let position=0;
 for(const part of parts){data.set(part,position);position+=part.byteLength;}
 let input;
 try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}
 catch{throw Error('BAD_INPUT');}
 if(!input||typeof input!=='object'||Array.isArray(input)||
  typeof input.resume_id!=='string'||!uuid.test(input.resume_id)||
  input.consent_ai_vision!==true)throw Error('BAD_INPUT');
 return input;
}
async function quotaTableReady(db){
 const result=await db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_visual_attempts'"
 ).first();
 return result?.name==='hhba_resume_visual_attempts';
}
async function reserveAttempt(db,accountHash,resumeSha){
 const day=new Date().toISOString().slice(0,10);
 const result=await db.prepare(
  'INSERT INTO hhba_resume_visual_attempts(request_id,day_utc,account_hash,resume_sha256,created_at) '+
  'SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_resume_visual_attempts WHERE day_utc=? AND account_hash=?)<?'
 ).bind(crypto.randomUUID(),day,accountHash,resumeSha,new Date().toISOString(),
  day,accountHash,PER_DAY).run();
 return result?.success===true&&result?.meta?.changes===1;
}
function cacheKey(storageKey){return storageKey+'.hhba-vision-layout-v1.json';}
export async function onRequestGet({env}){
 return send({kind:VISION_SCHEMA,enabled:allowed(env)&&await quotaTableReady(env.HHBA_PNVS_AUTH_DB).catch(()=>false),
  formats:['pdf'],word_conversion_ready:false});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!allowed(env))return fail('VISUAL_LAYOUT_DISABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 try{if(!await quotaTableReady(db))return fail('VISUAL_LAYOUT_DB_NOT_READY',503);}
 catch{return fail('VISUAL_LAYOUT_DB_NOT_READY',503);}
 let session,user;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let input;
 try{input=await readInput(request);}
 catch{return fail('INVALID_REQUEST',400);}
 let row;
 try{
  row=await db.prepare(
   'SELECT id,media_type,size_bytes,sha256,storage_key FROM hhba_candidate_resumes WHERE id=? AND phone=?'
  ).bind(input.resume_id,session.phone).first();
 }catch{return fail('PRIVATE_RESUME_DB_UNAVAILABLE',503);}
 if(!row)return fail('RESUME_NOT_FOUND',404);
 // DOCX requires a trustworthy private server-side page renderer. Uploads and
 // text-only understanding continue to work, but never claim visual fidelity.
 if(row.media_type!=='application/pdf')return fail('WORD_VISUAL_RENDERER_NOT_READY',422);
 if(!Number.isInteger(row.size_bytes)||row.size_bytes<32||row.size_bytes>3*1024*1024)
  return fail('RESUME_TOO_LARGE',413);
 const key=cacheKey(row.storage_key);
 try{
  const cached=await bucket.get(key);
  if(cached){
   const layout=await cached.json();
   if(layout?.schema===VISION_SCHEMA&&layout.source_sha256===row.sha256&&
    Array.isArray(layout.regions)&&layout.regions.length)return send({ok:true,cached:true,layout});
  }
 }catch{return fail('PRIVATE_RESUME_CACHE_UNAVAILABLE',503);}
 let source;
 try{
  const item=await bucket.get(row.storage_key);
  if(!item)return fail('RESUME_NOT_FOUND',404);
  const bytes=new Uint8Array(await item.arrayBuffer());
  if(bytes.byteLength!==row.size_bytes)return fail('RESUME_BYTES_MISMATCH',409);
  source=bytes;
 }catch{return fail('PRIVATE_RESUME_READ_UNAVAILABLE',503);}
 let accountHash;
 try{
  accountHash=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':resume-vision:'+session.phone);
  if(!await reserveAttempt(db,accountHash,row.sha256))return fail('VISUAL_LAYOUT_DAILY_LIMIT',429);
 }catch{return fail('VISUAL_LAYOUT_DB_UNAVAILABLE',503);}
 let layout;
 try{
  layout=await analyzeOriginalPdf({env,bytes:source,sha256:row.sha256,signal:AbortSignal.timeout(40000)});
 }catch(error){
  const known=new Set(['VISION_PROVIDER_TIMEOUT','VISION_PROVIDER_RATE_LIMITED',
   'VISION_PROVIDER_AUTH_ERROR','VISION_RESPONSE_INVALID','VISION_PROVIDER_UNAVAILABLE',
   'VISION_PROVIDER_NETWORK_ERROR','VISION_PROVIDER_REDIRECT_BLOCKED','VISION_NOT_PDF']);
  const code=known.has(error?.message)?error.message:'VISUAL_LAYOUT_FAILED';
  console.warn('HHBA_RESUME_VISION_FAILED',code);
  return fail(code,code==='VISION_PROVIDER_RATE_LIMITED'?429:502);
 }
 // Analysis is slow enough that a user may delete the source mid-request.
 // Re-check source ownership before AND after caching to avoid a retained PII
 // sidecar for a file that no longer belongs to this account.
 const stillOwned=async()=>{
  const current=await db.prepare(
   'SELECT sha256 FROM hhba_candidate_resumes WHERE id=? AND phone=?'
  ).bind(row.id,session.phone).first();
  return current?.sha256===row.sha256;
 };
 try{
  if(!await stillOwned())return fail('RESUME_NOT_FOUND',404);
  await bucket.put(key,JSON.stringify(layout),{
   httpMetadata:{contentType:'application/json'}});
  if(!await stillOwned()){
   await bucket.delete(key).catch(()=>{});
   return fail('RESUME_NOT_FOUND',404);
  }
 }catch{return fail('PRIVATE_RESUME_CACHE_UNAVAILABLE',503);}
 return send({ok:true,cached:false,layout});
}
