// Private original DOCX display, exact-node editing, verified Word downloads.
// No public source URLs, no "template rebuild" and no unchecked format exports.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {configured,wordRequest} from '../_lib/private-word-service.js';
import {
 inspectOriginalDocxStrict,prepareVerifiedOriginalDocxExport
} from '../../src/services/resumeDocxPreserve.mjs';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LIMIT=3072,DAILY={preview:4,export:6},MAX_REVISIONS=8;
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
 // The owner-scoped DB SHA is authoritative. A same-size but tampered R2
 // object must never be rendered or used to create a downloadable resume.
 if(bytes.length!==row.size_bytes||await shaBytes(bytes)!==row.sha256)
  throw Error('RESUME_BYTES_MISMATCH');
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
// Each verified edit is immutable. The small manifest is updated with an R2
// conditional write (ETag compare-and-swap) so two tabs cannot silently race.
function revisionKey(key,entry,format){
 return entry.id==='legacy'?key+(format==='docx'?'.docx':'.edited.pdf'):
  key+'.revision-'+entry.id+(format==='docx'?'.docx':'.pdf');
}
const hashIsValid=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
function validEntry(entry){
 return entry&&
  (entry.id==='legacy'||typeof entry.id==='string'&&ID.test(entry.id))&&
  typeof entry.original==='string'&&typeof entry.text==='string'&&
  hashIsValid(entry.docx_sha256)&&hashIsValid(entry.preview_sha256)&&
  Number.isInteger(entry.page_count)&&entry.page_count>=1&&entry.page_count<=20;
}
async function approved(bucket,row){
 const key=prefix(row);
 const ref=await bucket.get(key+'.json');
 if(!ref)return {key,etag:null,revision:0,items:[],saved:null};
 const raw=await ref.json();
 if(raw?.source_sha256!==row.sha256)throw Error('WORD_REVISION_CORRUPT');
 let items,revision;
 if(raw.schema==='HHBA_ORIGINAL_WORD_EDIT_V1'){
  const legacy={...raw,id:'legacy'};
  if(!validEntry(legacy))throw Error('WORD_REVISION_CORRUPT');
  items=[legacy];revision=1;
 }else if(raw.schema==='HHBA_ORIGINAL_WORD_VERSIONS_V2'){
  items=raw.items;revision=raw.revision;
  if(!Array.isArray(items)||items.length<1||items.length>MAX_REVISIONS||
   !Number.isInteger(revision)||revision<0||revision>items.length||
   items.some(x=>!validEntry(x))||
   new Set(items.map(x=>x.id)).size!==items.length)
   throw Error('WORD_REVISION_CORRUPT');
 }else throw Error('WORD_REVISION_CORRUPT');
 return {key,etag:ref.etag||null,revision,items,saved:revision>0?items[revision-1]:null};
}
async function versionBytes(bucket,key,entry,format){
 const file=await bucket.get(revisionKey(key,entry,format));
 if(!file)throw Error('WORD_REVISION_CORRUPT');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const expected=format==='docx'?entry.docx_sha256:entry.preview_sha256;
 if(await shaBytes(bytes)!==expected)throw Error('WORD_REVISION_CORRUPT');
 return bytes;
}
async function commitManifest(bucket,state,row,revision,items){
 if(state.items.length&&!state.etag)throw Error('WORD_REVISION_LOCK_UNAVAILABLE');
 const newState={schema:'HHBA_ORIGINAL_WORD_VERSIONS_V2',
  source_sha256:row.sha256,revision,items,updated_at:new Date().toISOString()};
 const written=await bucket.put(state.key+'.json',JSON.stringify(newState),{
  httpMetadata:{contentType:'application/json'},
  onlyIf:state.etag?{etagMatches:state.etag}:{etagDoesNotMatch:'*'}
 });
 if(!written)throw Error('WORD_REVISION_CONFLICT');
 return newState;
}
function code(error){
 const known=new Set(['WORD_EDIT_TOO_LONG','WORD_EDIT_AMBIGUOUS','WORD_EDIT_UNSAFE',
  'WORD_FILE_UNSUPPORTED','WORD_EDIT_CORRUPTED','WORD_LAYOUT_NOT_VERIFIED',
  'WORD_RENDERER_REQUIRED','WORD_EDIT_TOO_LARGE','WORD_RENDER_FAILED',
  'WORD_INVALID_FILE','WORD_INVALID_REQUEST','WORD_FONT_UNAVAILABLE',
  'WORD_FONT_UNVERIFIED','WORD_LAYOUT_MOVED','WORD_TEXT_NOT_VERIFIED',
  'WORD_RENDER_TOO_LARGE',
  'WORD_PAGE_LIMIT','WORD_BUSY','RESUME_NOT_FOUND','RESUME_BYTES_MISMATCH',
  'WORD_REVISION_CORRUPT','WORD_REVISION_CONFLICT','WORD_REVISION_LIMIT',
  'WORD_REVISION_LOCK_UNAVAILABLE']);
 return known.has(error?.message)?error.message:'WORD_PROCESSING_UNAVAILABLE';
}
function errorStatus(value){
 return value==='RESUME_NOT_FOUND'?404:
  value==='WORD_RENDER_FAILED'||value==='WORD_PROCESSING_UNAVAILABLE'||
  value==='WORD_BUSY'?503:
  value==='RESUME_BYTES_MISMATCH'||value==='WORD_REVISION_CONFLICT'||
  value==='WORD_REVISION_CORRUPT'?409:
  value==='WORD_REVISION_LOCK_UNAVAILABLE'?503:422;
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
   const state=await approved(bucket,row);
   const current=state.saved?
    await versionBytes(bucket,state.key,state.saved,'docx'):original;
   const data=await inspectOriginalDocxStrict(current);
   return json({ok:true,editable_text:data.editable_text,
    saved:state.saved?{original:state.saved.original,text:state.saved.text,
     updated_at:state.saved.updated_at}:null,
    revision:state.revision,total_revisions:state.items.length,
    max_revisions:MAX_REVISIONS,max_daily_edits:DAILY.export,
    history:state.items.map((entry,index)=>({
     revision:index+1,original:entry.original,text:entry.text,
     updated_at:entry.updated_at||'',page_count:entry.page_count
    }))});
  }
  if(action==='download'||action==='edited-preview'||action==='download-pdf'){
   await loadBytes(bucket,row);
   const state=await approved(bucket,row);
   const requested=new URL(request.url).searchParams.get('revision');
   if(requested!==null&&(!/^(?:0|[1-9][0-9]?)$/.test(requested)||
    Number(requested)!==state.revision))
    return fail('WORD_REVISION_CONFLICT',409);
   if(!state.saved)return fail('WORD_NOT_EDITED',404);
   const word=action==='download';
   const bytes=await versionBytes(bucket,state.key,state.saved,word?'docx':'pdf');
   return replyFile(bytes,word?DOCX_MIME:'application/pdf',
    word?'HHBA-resume-edited.docx':
     action==='download-pdf'?'HHBA-resume-edited.pdf':'HHBA-resume-edited-preview.pdf');
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
 const id=body?.resume_id,action=body?.action||'edit';
 if(!ID.test(String(id||''))||!['edit','undo','redo'].includes(action)||
  body?.confirmed_real!==true||body?.consent_word_processing!==true||
  (body.expected_revision!==undefined&&
   (!Number.isInteger(body.expected_revision)||body.expected_revision<0||
    body.expected_revision>MAX_REVISIONS))||
  (action==='edit'&&(typeof body?.original!=='string'||
   typeof body?.text!=='string'||body.original.length>300||body.text.length>300)))
  return fail('INVALID_REQUEST',400);
 let row,created=[];
 try{
  row=await rowFor(db,id,candidate.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(!validRow(row))return fail('WORD_INVALID_FILE',422);
  // Verify owner-bound original even when editing a previously saved revision.
  const original=await loadBytes(bucket,row);
  const state=await approved(bucket,row);
  if(body.expected_revision!==undefined&&body.expected_revision!==state.revision)
   return fail('WORD_REVISION_CONFLICT',409);
  if(state.items.length&&!state.etag)return fail('WORD_REVISION_LOCK_UNAVAILABLE',503);
  if(action==='undo'||action==='redo'){
   const next=state.revision+(action==='undo'?-1:1);
   if(next<0||next>state.items.length)return fail('WORD_REVISION_CONFLICT',409);
   await commitManifest(bucket,state,row,next,state.items);
   if(!await stillOwned(db,row,candidate.phone)){
    await bucket.delete(state.key+'.json').catch(()=>{});
    return fail('RESUME_NOT_FOUND',404);
   }
   return json({ok:true,saved:next>0,revision:next,total_revisions:state.items.length});
  }
  if(state.revision>=MAX_REVISIONS) return fail('WORD_REVISION_LIMIT',422);
  if(!await quotaReady(db))return fail('WORD_DB_NOT_READY',503);
  if(!await reserve(db,env,candidate.phone,'export'))
   return fail('WORD_DAILY_LIMIT',429);
  const current=state.saved?
   await versionBytes(bucket,state.key,state.saved,'docx'):original;
  const selected=[{original:body.original,text:body.text}];
  // Every increment must pass a real Word renderer geometry comparison.
  const result=await prepareVerifiedOriginalDocxExport({
   original:current,edits:selected,
   verifyLayout:async({original,edited,oldText,newText})=>
    wordRequest(env,'verify',{original,edited,oldText,newText})
  });
  const pdf=await wordRequest(env,'render',{original:result.bytes});
  if(!await stillOwned(db,row,candidate.phone))return fail('RESUME_NOT_FOUND',404);
  const entry={id:crypto.randomUUID(),original:body.original,text:body.text,
   page_count:result.pageCount,docx_sha256:await shaBytes(result.bytes),
   preview_sha256:await shaBytes(pdf),updated_at:new Date().toISOString()};
  const wordKey=revisionKey(state.key,entry,'docx');
  const pdfKey=revisionKey(state.key,entry,'pdf');
  created=[wordKey,pdfKey];
  // Publish immutable, verified bytes first; the CAS manifest becomes the
  // authoritative active revision only after both blobs are stored.
  await bucket.put(wordKey,result.bytes,{httpMetadata:{contentType:DOCX_MIME}});
  await bucket.put(pdfKey,pdf,{httpMetadata:{contentType:'application/pdf'}});
  if(!await stillOwned(db,row,candidate.phone))throw Error('RESUME_NOT_FOUND');
  const dropped=state.items.slice(state.revision).filter(x=>x.id!=='legacy');
  const items=[...state.items.slice(0,state.revision),entry];
  await commitManifest(bucket,state,row,items.length,items);
  created=[];
  // Branching after Undo discards unused future revisions, not the original.
  for(const item of dropped){
   await bucket.delete(revisionKey(state.key,item,'docx')).catch(()=>{});
   await bucket.delete(revisionKey(state.key,item,'pdf')).catch(()=>{});
  }
  if(!await stillOwned(db,row,candidate.phone)){
   await Promise.all([wordKey,pdfKey,state.key+'.json'].map(key=>
    bucket.delete(key).catch(()=>{})));
   return fail('RESUME_NOT_FOUND',404);
  }
  return json({ok:true,saved:true,revision:items.length,
   total_revisions:items.length,page_count:result.pageCount});
 }catch(error){
  await Promise.all(created.map(key=>bucket.delete(key).catch(()=>{})));
  const c=code(error);return fail(c,errorStatus(c));
 }
}
