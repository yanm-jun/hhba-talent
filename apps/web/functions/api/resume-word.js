// Private original DOCX display, exact-node editing, verified Word downloads.
// No public source URLs, no "template rebuild" and no unchecked format exports.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {configured,wordRequest} from '../_lib/private-word-service.js';
import {
 inspectOriginalDocxStrict,prepareVerifiedOriginalDocxExport
} from '../../src/services/resumeDocxPreserve.mjs';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LIMIT=3072,DAILY={preview:4,export:6};
const common={
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex'
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...common,'Content-Type':'application/json; charset=utf-8'}
});
const fail=(code,status)=>json({ok:false,error:code},status);
const sameOrigin=request=>request.headers.get('Origin')===new URL(request.url).origin&&
 request.headers.get('Sec-Fetch-Site')!=='cross-site';
const prefix=row=>row.storage_key+'.hhba-word-preserved-v1-'+row.sha256;
const shaBytes=async bytes=>{
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
};
const validRow=row=>row?.media_type===DOCX_MIME&&
 Number.isInteger(row.size_bytes)&&row.size_bytes>=100&&row.size_bytes<=3*1024*1024&&
 typeof row.sha256==='string'&&/^[0-9a-f]{64}$/.test(row.sha256);
const replyFile=(bytes,media,filename)=>new Response(bytes,{
 headers:{...common,'Content-Type':media,'Content-Disposition':
  'attachment; filename="'+filename+'"','Content-Length':String(bytes.length)}
});
async function owner(db,request){
 const session=await sessionOfBearer(db,request,Date.now());
 if(!session)return {error:'SESSION_INVALID',status:401};
 const user=await getUserByPhone(db,session.phone);
 if(user?.role!=='candidate')return {error:'FORBIDDEN',status:403};
 return {phone:session.phone};
}
async function rowFor(db,id,phone){
 return db.prepare('SELECT id,media_type,size_bytes,storage_key,sha256 FROM hhba_candidate_resumes '+
  'WHERE id=? AND phone=?').bind(id,phone).first();
}
async function stillOwned(db,row,phone){
 const current=await rowFor(db,row.id,phone);
 return current?.sha256===row.sha256&&current?.storage_key===row.storage_key;
}
async function loadBytes(bucket,row){
 const item=await bucket.get(row.storage_key);
 if(!item)throw Error('RESUME_NOT_FOUND');
 const bytes=new Uint8Array(await item.arrayBuffer());
 if(bytes.length!==row.size_bytes)throw Error('RESUME_BYTES_MISMATCH');
 return bytes;
}
async function quotaReady(db){
 const found=await db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_word_attempts'"
 ).first();
 return found?.name==='hhba_resume_word_attempts';
}
async function reserve(db,env,phone,action){
 const now=new Date(),date=now.toISOString().slice(0,10);
 if(typeof env.HHBA_MATCH_LIMIT_PEPPER!=='string'||env.HHBA_MATCH_LIMIT_PEPPER.length<24)
  return false;
 const hash=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':word-layout:'+phone);
 const result=await db.prepare(
  'INSERT INTO hhba_resume_word_attempts(request_id,day_utc,account_hash,action,created_at) '+
  'SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_resume_word_attempts '+
  'WHERE day_utc=? AND account_hash=? AND action=?)<?'
 ).bind(crypto.randomUUID(),date,hash,action,now.toISOString(),
  date,hash,action,DAILY[action]).run();
 return result?.success===true&&result?.meta?.changes===1;
}
async function readSmall(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('INVALID_REQUEST');
 const claimed=request.headers.get('Content-Length');
 if(claimed!==null&&(!/^\d+$/.test(claimed)||Number(claimed)>LIMIT))
  throw Error('INVALID_REQUEST');
 const reader=request.body?.getReader();
 if(!reader)throw Error('INVALID_REQUEST');
 const chunks=[];let length=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;
  length+=chunk.value.byteLength;
  if(length>LIMIT){await reader.cancel();throw Error('INVALID_REQUEST');}
  chunks.push(chunk.value);
 }}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let i=0;
 for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('INVALID_REQUEST');}
}
async function approved(bucket,row){
 const key=prefix(row);
 const ref=await bucket.get(key+'.json');
 if(!ref)return null;
 const saved=await ref.json();
 if(saved?.schema!=='HHBA_ORIGINAL_WORD_EDIT_V1'||
  saved.source_sha256!==row.sha256||
  typeof saved.original!=='string'||typeof saved.text!=='string')return null;
 return {key, saved};
}
function code(error){
 const known=new Set(['WORD_EDIT_TOO_LONG','WORD_EDIT_AMBIGUOUS','WORD_EDIT_UNSAFE',
  'WORD_FILE_UNSUPPORTED','WORD_EDIT_CORRUPTED','WORD_LAYOUT_NOT_VERIFIED',
  'WORD_RENDERER_REQUIRED','WORD_EDIT_TOO_LARGE','WORD_RENDER_FAILED',
  'WORD_INVALID_FILE','WORD_INVALID_REQUEST','WORD_RENDER_TOO_LARGE',
  'WORD_PAGE_LIMIT','WORD_BUSY','RESUME_NOT_FOUND','RESUME_BYTES_MISMATCH']);
 return known.has(error?.message)?error.message:'WORD_PROCESSING_UNAVAILABLE';
}
function errorStatus(value){
 return value==='RESUME_NOT_FOUND'?404:
  value==='WORD_RENDER_FAILED'||value==='WORD_PROCESSING_UNAVAILABLE'||
  value==='WORD_BUSY'?503:
  value==='RESUME_BYTES_MISMATCH'?409:422;
}
export async function onRequestGet({request,env}){
 const action=new URL(request.url).searchParams.get('action')||'preview';
 if(action==='status')
  return json({ok:true,enabled:configured(env)});
 if(!configured(env))return fail('WORD_NOT_READY',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let candidate;
 try{candidate=await owner(db,request);}catch{return fail('SESSION_INVALID',401);}
 if(candidate.error)return fail(candidate.error,candidate.status);
 const id=new URL(request.url).searchParams.get('resume_id');
 if(!id||!ID.test(id))return fail('INVALID_REQUEST',400);
 let row;
 try{
  row=await rowFor(db,id,candidate.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(!validRow(row))return fail('WORD_INVALID_FILE',422);
  if(action==='inspect'){
   const original=await loadBytes(bucket,row);
   const data=await inspectOriginalDocxStrict(original);
   const existing=await approved(bucket,row);
   return json({ok:true,editable_text:existing?[]:data.editable_text,
    saved:existing?existing.saved:null});
  }
  if(action==='download'||action==='edited-preview'){
   const state=await approved(bucket,row);
   if(!state)return fail('WORD_NOT_EDITED',404);
   const item=await bucket.get(state.key+(action==='download'?'.docx':'.edited.pdf'));
   if(!item)return fail('WORD_NOT_EDITED',404);
   const bytes=new Uint8Array(await item.arrayBuffer());
   const expected=action==='download'?state.saved.docx_sha256:state.saved.preview_sha256;
   if(typeof expected!=='string'||!/^[0-9a-f]{64}$/.test(expected)||
    await shaBytes(bytes)!==expected)return fail('WORD_NOT_EDITED',409);
   return replyFile(bytes,action==='download'?DOCX_MIME:'application/pdf',
    action==='download'?'HHBA-resume-edited.docx':'HHBA-resume-edited-preview.pdf');
  }
  if(action!=='preview')return fail('INVALID_REQUEST',400);
  const key=prefix(row)+'.source.pdf';
  const cached=await bucket.get(key);
  if(cached){
   const bytes=new Uint8Array(await cached.arrayBuffer());
   if(bytes.length>=500&&bytes.length<=12*1024*1024)
    return replyFile(bytes,'application/pdf','HHBA-resume-original-preview.pdf');
  }
  if(!await quotaReady(db))return fail('WORD_DB_NOT_READY',503);
  if(!await reserve(db,env,candidate.phone,'preview'))
   return fail('WORD_DAILY_LIMIT',429);
  const original=await loadBytes(bucket,row);
  const rendered=await wordRequest(env,'render',{original});
  if(!await stillOwned(db,row,candidate.phone))return fail('RESUME_NOT_FOUND',404);
  await bucket.put(key,rendered,{httpMetadata:{contentType:'application/pdf'}});
  if(!await stillOwned(db,row,candidate.phone)){
   await bucket.delete(key).catch(()=>{});
   return fail('RESUME_NOT_FOUND',404);
  }
  return replyFile(rendered,'application/pdf','HHBA-resume-original-preview.pdf');
 }catch(error){const c=code(error);return fail(c,errorStatus(c));}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!configured(env))return fail('WORD_NOT_READY',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let candidate;
 try{candidate=await owner(db,request);}catch{return fail('SESSION_INVALID',401);}
 if(candidate.error)return fail(candidate.error,candidate.status);
 let body;
 try{body=await readSmall(request);}catch{return fail('INVALID_REQUEST',400);}
 const id=body?.resume_id;
 if(!ID.test(String(id||''))||body?.confirmed_real!==true||
  body?.consent_word_processing!==true||
  typeof body?.original!=='string'||typeof body?.text!=='string'||
  body.original.length>300||body.text.length>300)
  return fail('INVALID_REQUEST',400);
 let row,key;
 try{
  row=await rowFor(db,id,candidate.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(!validRow(row))return fail('WORD_INVALID_FILE',422);
  if(!await quotaReady(db))return fail('WORD_DB_NOT_READY',503);
  if(!await reserve(db,env,candidate.phone,'export'))
   return fail('WORD_DAILY_LIMIT',429);
  const original=await loadBytes(bucket,row);
  const selected=[{original:body.original,text:body.text}];
  const result=await prepareVerifiedOriginalDocxExport({
   original,edits:selected,
   verifyLayout:async({original,edited,oldText,newText})=>
    wordRequest(env,'verify',{original,edited,oldText,newText})
  });
  // Renderer actually opens the revised DOCX and produces the truthful preview.
  const updatedPdf=await wordRequest(env,'render',{original:result.bytes});
  if(!await stillOwned(db,row,candidate.phone))return fail('RESUME_NOT_FOUND',404);
  key=prefix(row);
  const meta={schema:'HHBA_ORIGINAL_WORD_EDIT_V1',source_sha256:row.sha256,
   original:body.original,text:body.text,page_count:result.pageCount,
   docx_sha256:await shaBytes(result.bytes),preview_sha256:await shaBytes(updatedPdf),
   updated_at:new Date().toISOString()};
  await bucket.put(key+'.docx',result.bytes,{httpMetadata:{contentType:DOCX_MIME}});
  await bucket.put(key+'.edited.pdf',updatedPdf,
   {httpMetadata:{contentType:'application/pdf'}});
  await bucket.put(key+'.json',JSON.stringify(meta),
   {httpMetadata:{contentType:'application/json'}});
  if(!await stillOwned(db,row,candidate.phone)){
   await Promise.all([key+'.docx',key+'.edited.pdf',key+'.json']
    .map(file=>bucket.delete(file).catch(()=>{})));
   return fail('RESUME_NOT_FOUND',404);
  }
  return json({ok:true,saved:true,page_count:result.pageCount});
 }catch(error){const c=code(error);return fail(c,errorStatus(c));}
}
