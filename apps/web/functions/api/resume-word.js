// Private original DOCX display, exact-node editing, verified Word downloads.
// No public source URLs, no "template rebuild" and no unchecked format exports.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {configured,docxOnlyConfigured,wordLimitPepper,wordRequest} from '../_lib/private-word-service.js';
import {
 inspectOriginalDocxStrict,editOriginalDocxStrict,prepareVerifiedOriginalDocxExport
} from '../../src/services/resumeDocxPreserve.mjs';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LIMIT=65536,DAILY={preview:4,export:6},MAX_REVISIONS=8;
const v4=env=>env?.HHBA_MATCH_V4_READY==='1';
// V4 is bounded by the actual request and OOXML package, not an arbitrary character count.
const editLimit=env=>v4(env)?Infinity:300;
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
// Unscoped = existing private-vault history. Targeted edits use a separate
// hashed branch, never silently inheriting edits from another job.
const validJobId=value=>value===undefined||(typeof value==='string'&&
 value.length>0&&value.length<=512&&value===value.trim()&&
 !/[\u0000-\u001f\u007f]/.test(value));
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
async function accountHash(env,phone){
 const secret=wordLimitPepper(env);
 if(typeof secret!=='string'||secret.length<24)return null;
 return sha256Hex(secret+':word-layout:'+phone);
}
async function reserve(db,env,phone,action){
 const now=new Date(),date=now.toISOString().slice(0,10);
 const hash=await accountHash(env,phone);
 if(!hash)return false;
 const result=await db.prepare(
  'INSERT INTO hhba_resume_word_attempts(request_id,day_utc,account_hash,action,created_at) '+
  'SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_resume_word_attempts '+
  'WHERE day_utc=? AND account_hash=? AND action=?)<?'
 ).bind(crypto.randomUUID(),date,hash,action,now.toISOString(),
  date,hash,action,DAILY[action]).run();
 return result?.success===true&&result?.meta?.changes===1;
}
async function readSmall(request,limit=LIMIT){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('INVALID_REQUEST');
 const claimed=request.headers.get('Content-Length');
 if(claimed!==null&&(!/^\d+$/.test(claimed)||Number(claimed)>limit))
  throw Error('INVALID_REQUEST');
 const reader=request.body?.getReader();
 if(!reader)throw Error('INVALID_REQUEST');
 const chunks=[];let length=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;
  length+=chunk.value.byteLength;
  if(length>limit){await reader.cancel();throw Error('INVALID_REQUEST');}
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
  key+'.revision-'+entry.id+(format==='docx'?'.docx':entry.pdf_object_id?'.'+entry.pdf_object_id+'.pdf':'.pdf');
}
const hashIsValid=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const vaultScope=/^vault-scope-v1-([0-9a-f]{64})$/;
const safeJobLabel=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,180):'';
function validEntry(entry){
 return entry&&
  (entry.id==='legacy'||typeof entry.id==='string'&&ID.test(entry.id))&&
  typeof entry.original==='string'&&typeof entry.text==='string'&&
  hashIsValid(entry.docx_sha256)&&
  (entry.pdf_object_id===undefined||typeof entry.pdf_object_id==='string'&&ID.test(entry.pdf_object_id))&&(
   entry.verification==='docx_structure_only'?
    entry.preview_sha256===null&&entry.page_count===null:
    (entry.verification===undefined||entry.verification==='layout_verified')&&
    hashIsValid(entry.preview_sha256)&&Number.isInteger(entry.page_count)&&
    entry.page_count>=1&&entry.page_count<=20);
}
async function approved(bucket,row,jobId,env){
 const alias=typeof jobId==='string'?vaultScope.exec(jobId):null;
 const jobHash=jobId===undefined?null:alias?alias[1]:
  await sha256Hex('hhba-word-target-job-v1:'+jobId);
 const key=prefix(row)+(jobHash?'.job-'+jobHash:'');
 const ref=await bucket.get(key+'.json');
 if(!ref){if(alias)throw Error('RESUME_NOT_FOUND');return {key,jobHash,etag:null,revision:0,items:[],saved:null,jobLabel:''};}
 const raw=await ref.json();
 if(raw?.source_sha256!==row.sha256||
  (raw?.job_scope_sha256??null)!==jobHash)
  throw Error('WORD_REVISION_CORRUPT');
 let items,revision;
 if(raw.schema==='HHBA_ORIGINAL_WORD_EDIT_V1'){
  const legacy={...raw,id:'legacy'};
  if(!validEntry(legacy))throw Error('WORD_REVISION_CORRUPT');
  items=[legacy];revision=1;
 }else if(raw.schema==='HHBA_ORIGINAL_WORD_VERSIONS_V2'){
  items=raw.items;revision=raw.revision;
  if(!Array.isArray(items)||items.length<1||(!v4(env)&&items.length>MAX_REVISIONS)||
   !Number.isInteger(revision)||revision<0||revision>items.length||
   items.some(x=>!validEntry(x))||
   new Set(items.map(x=>x.id)).size!==items.length)
   throw Error('WORD_REVISION_CORRUPT');
 }else throw Error('WORD_REVISION_CORRUPT');
 return {key,jobHash,etag:ref.etag||null,revision,items,saved:revision>0?items[revision-1]:null,jobLabel:safeJobLabel(raw.job_label)};
}
async function versionBytes(bucket,key,entry,format){
 const file=await bucket.get(revisionKey(key,entry,format));
 if(!file)throw Error('WORD_REVISION_CORRUPT');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const expected=format==='docx'?entry.docx_sha256:entry.preview_sha256;
 if(!hashIsValid(expected))throw Error('WORD_PDF_NOT_READY');
 if(await shaBytes(bytes)!==expected)throw Error('WORD_REVISION_CORRUPT');
 return bytes;
}
async function commitManifest(bucket,state,row,revision,items,jobLabel=state.jobLabel){
 if(state.items.length&&!state.etag)throw Error('WORD_REVISION_LOCK_UNAVAILABLE');
 const newState={schema:'HHBA_ORIGINAL_WORD_VERSIONS_V2',
  source_sha256:row.sha256,
  ...(state.jobHash?{job_scope_sha256:state.jobHash,job_label:safeJobLabel(jobLabel)}:{}),
  revision,items,updated_at:new Date().toISOString()};
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
  'WORD_RENDERER_REQUIRED','WORD_EDIT_TOO_LARGE','WORD_RENDER_FAILED','WORD_PDF_NOT_READY',
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
async function tasksReady(db){
 const found=await db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_word_render_tasks'"
 ).first();
 return found?.name==='hhba_resume_word_render_tasks';
}
async function readRenderTask(db,hash,resumeId,jobHash,entryId){
 return db.prepare('SELECT status,error_code,attempts,updated_at FROM hhba_resume_word_render_tasks '+
  'WHERE account_hash=? AND resume_id=? AND job_scope_hash=? AND entry_id=?')
  .bind(hash,resumeId,jobHash,entryId).first();
}
// A stale lease is retryable; the attempt counter fences an old worker.
const RENDER_LEASE_MS=5*60*1000;
const liveRender=task=>Boolean(task&&['pending','running'].includes(task.status)&&
 Number.isFinite(Date.parse(task.updated_at))&&Date.now()-Date.parse(task.updated_at)<RENDER_LEASE_MS);
async function setRenderTask(db,hash,resumeId,jobHash,entryId,attempt,status,errorCode){
 const result=await db.prepare('UPDATE hhba_resume_word_render_tasks SET status=?,error_code=?,updated_at=? '+
  "WHERE account_hash=? AND resume_id=? AND job_scope_hash=? AND entry_id=? AND attempts=? AND status IN ('pending','running')")
  .bind(status,errorCode||null,new Date().toISOString(),hash,resumeId,jobHash,entryId,attempt).run();
 return result?.success===true&&result?.meta?.changes===1;
}
async function openRenderTask(db,hash,resumeId,jobHash,entryId,now){
 const existing=await readRenderTask(db,hash,resumeId,jobHash,entryId);
 if(liveRender(existing))return null;
 if(existing){
  const result=await db.prepare('UPDATE hhba_resume_word_render_tasks SET status=?,error_code=NULL,attempts=attempts+1,updated_at=? '+
   'WHERE account_hash=? AND resume_id=? AND job_scope_hash=? AND entry_id=? AND status=? AND updated_at=? AND attempts=?')
   .bind('pending',now,hash,resumeId,jobHash,entryId,existing.status,existing.updated_at,existing.attempts).run();
  return result?.success===true&&result?.meta?.changes===1?existing.attempts+1:null;
 }
 const result=await db.prepare('INSERT OR IGNORE INTO hhba_resume_word_render_tasks(account_hash,resume_id,job_scope_hash,entry_id,status,error_code,attempts,created_at,updated_at) '+
  'VALUES (?,?,?,?,?,NULL,0,?,?)')
  .bind(hash,resumeId,jobHash,entryId,'pending',now,now).run();
 return result?.success===true&&result?.meta?.changes===1?0:null;
}
function renderTaskPayload(task){
 if(!task)return {ok:true,status:'idle',pdf_available:false,attempts:0,updated_at:''};
 const interrupted=['pending','running'].includes(task.status)&&!liveRender(task);
 return {ok:true,status:interrupted||task.status==='done'?'failed':task.status,pdf_available:false,
  ...(interrupted?{error_code:'WORD_RENDER_INTERRUPTED'}:task.error_code?{error_code:task.error_code}:{}),
  attempts:task.attempts,updated_at:task.updated_at};
}
// Each worker writes its own PDF object. A failed or superseded worker can
// never remove another worker's PDF or a PDF already published by the manifest.
async function runLateRender(db,bucket,env,phone,hash,row,jobId,jobHash,entry,attempt){
 let pdfKey=null,published=false;
 const setStatus=(status,error)=>setRenderTask(db,hash,row.id,jobHash,entry.id,attempt,status,error);
 try{
  if(!await setStatus('running',null))return;
  const fresh=await approved(bucket,row,jobId,env);
  if(fresh.saved?.id!==entry.id)throw Error('WORD_REVISION_CONFLICT');
  const previous=fresh.items[fresh.revision-2];
  const original=previous?await versionBytes(bucket,fresh.key,previous,'docx'):await loadBytes(bucket,row);
  const edited=await versionBytes(bucket,fresh.key,fresh.saved,'docx');
  const report=await wordRequest(env,'verify',{original,edited,oldText:entry.original,newText:entry.text});
  if(!await setStatus('running',null))return;
  const pdf=await wordRequest(env,'render',{original:edited});
  if(!await stillOwned(db,row,phone))throw Error('RESUME_NOT_FOUND');
  if(!await setStatus('running',null))return;
  const nextEntry={...entry,pdf_object_id:crypto.randomUUID(),verification:'layout_verified',
   page_count:report.page_count,preview_sha256:await shaBytes(pdf)};
  pdfKey=revisionKey(fresh.key,nextEntry,'pdf');
  await bucket.put(pdfKey,pdf,{httpMetadata:{contentType:'application/pdf'}});
  // Re-read after rendering: the user may have switched or replaced revisions.
  const latest=await approved(bucket,row,jobId,env);
  if(latest.saved?.id!==entry.id||latest.saved.verification!=='docx_structure_only')
   throw Error('WORD_REVISION_CONFLICT');
  if(!await stillOwned(db,row,phone))throw Error('RESUME_NOT_FOUND');
  await commitManifest(bucket,latest,row,latest.revision,latest.items.map(item=>item.id===entry.id?nextEntry:item));
  published=true;
  await setStatus('done',null);
 }catch(error){
  // A manifest write can have succeeded even if the response was lost.
  // Never delete a published object on an ambiguous storage failure.
  if(pdfKey&&!published){
   try{
    const latest=await approved(bucket,row,jobId,env);
    if(!latest.items.some(item=>revisionKey(latest.key,item,'pdf')===pdfKey))
     await bucket.delete(pdfKey);
   }catch{/* leave private orphan for storage maintenance */}
  }
  await setStatus('failed',code(error)).catch(()=>{});
 }
}
export async function onRequestGet({request,env}){
 const action=new URL(request.url).searchParams.get('action')||'preview';
 const renderer=configured(env),docxOnly=docxOnlyConfigured(env);
 if(action==='status')return json({ok:true,enabled:renderer||docxOnly,
  renderer_enabled:renderer,docx_only_enabled:docxOnly});
 if(!renderer&&!docxOnly)return fail('WORD_NOT_READY',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let candidate;
 try{candidate=await owner(db,request);}catch{return fail('SESSION_INVALID',401);}
 if(candidate.error)return fail(candidate.error,candidate.status);
 const params=new URL(request.url).searchParams;
 const id=params.get('resume_id'),jobs=params.getAll('job_id');
 if(!id||!ID.test(id)||jobs.length>1||
  !validJobId(jobs.length?jobs[0]:undefined))
  return fail('INVALID_REQUEST',400);
 const jobId=jobs[0];
 let row;
 try{
  row=await rowFor(db,id,candidate.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(!validRow(row))return fail('WORD_INVALID_FILE',422);
  if(action==='versions'){
   if(jobs.length)return fail('INVALID_REQUEST',400);
   const root=prefix(row)+'.job-',cursor=params.get('cursor')||undefined;
   // Group all revisions of each posting by the first dot after the hash.
   // Cursor pagination bounds storage requests, not the number of saved jobs.
   const page=await bucket.list({prefix:root,delimiter:'.',limit:20,...(cursor?{cursor}:{})});
   const groups=new Set((page.delimitedPrefixes||[]).map(key=>key.slice(root.length).replace(/\.$/,'')));
   for(const object of page.objects||[]){
    if(!object.key.startsWith(root))continue;
    const suffix=object.key.slice(root.length).split('.')[0];if(hashIsValid(suffix))groups.add(suffix);
   }
   const items=[];
   for(const hash of groups){
    if(!hashIsValid(hash))continue;
    const scope='vault-scope-v1-'+hash;
    try{
     const state=await approved(bucket,row,scope,env);
     if(state.saved)items.push({scope,jobLabel:state.jobLabel||'岗位专属简历 · '+hash.slice(0,8),revision:state.revision,
      updatedAt:state.saved.updated_at||'',pdfAvailable:state.saved.verification!=='docx_structure_only'});
    }catch(error){if(error?.message==='RESUME_NOT_FOUND')continue;throw error;}
   }
   if(page.truncated&&!page.cursor)throw Error('WORD_PROCESSING_UNAVAILABLE');
   return json({ok:true,items,nextCursor:page.truncated?page.cursor:null});
  }
  if(action==='inspect'){
   const original=await loadBytes(bucket,row);
   const state=await approved(bucket,row,jobId,env);
   const current=state.saved?
    await versionBytes(bucket,state.key,state.saved,'docx'):original;
   const data=await inspectOriginalDocxStrict(current,{allowParagraphRuns:v4(env)&&!renderer});
   return json({ok:true,editable_text:data.editable_text,paragraph_text:data.paragraph_text,duplicate_paragraphs:data.duplicate_paragraphs,
    saved:state.saved?{id:state.saved.id,original:state.saved.original,text:state.saved.text,
     updated_at:state.saved.updated_at}:null,
    revision:state.revision,total_revisions:state.items.length,
    layout_verified:Boolean(state.saved&&state.saved.verification!=='docx_structure_only'),
    pdf_available:Boolean(state.saved&&state.saved.verification!=='docx_structure_only'),
    max_revisions:v4(env)?null:MAX_REVISIONS,max_daily_edits:v4(env)?null:DAILY.export,
    history:state.items.map((entry,index)=>({
     revision:index+1,original:entry.original,text:entry.text,
     updated_at:entry.updated_at||'',page_count:entry.page_count,
     layout_verified:entry.verification!=='docx_structure_only'
    }))});
  }
  if(action==='source-docx'){
   const original=await loadBytes(bucket,row);
   const state=await approved(bucket,row,jobId,env);
   const requested=params.get('revision');
   if(requested!==null&&(!/^(?:0|[1-9][0-9]*)$/.test(requested)||
    Number(requested)!==state.revision))return fail('WORD_REVISION_CONFLICT',409);
   const current=state.saved?
    await versionBytes(bucket,state.key,state.saved,'docx'):original;
   return replyFile(current,DOCX_MIME,'HHBA-private-current.docx');
  }
  if(action==='download'||action==='edited-preview'||action==='download-pdf'){
   await loadBytes(bucket,row);
   const state=await approved(bucket,row,jobId,env);
   const requested=new URL(request.url).searchParams.get('revision');
   if(requested!==null&&(!/^(?:0|[1-9][0-9]*)$/.test(requested)||
    Number(requested)!==state.revision))
    return fail('WORD_REVISION_CONFLICT',409);
   if(!state.saved)return fail('WORD_NOT_EDITED',404);
   const word=action==='download';
   if(!word&&state.saved.verification==='docx_structure_only')
    return fail('WORD_PDF_NOT_READY',422);
   const bytes=await versionBytes(bucket,state.key,state.saved,word?'docx':'pdf');
   return replyFile(bytes,word?DOCX_MIME:'application/pdf',
    word?'HHBA-resume-edited.docx':
     action==='download-pdf'?'HHBA-resume-edited.pdf':'HHBA-resume-edited-preview.pdf');
  }
  if(action==='convert-status'){
   const state=await approved(bucket,row,jobId,env);
   if(!state.saved)return fail('WORD_NOT_EDITED',404);
   const entry=state.saved;
   const requested=params.get('revision'),entryId=params.get('entry_id');
   if(requested!==null&&String(state.revision)!==requested||entryId!==null&&entry.id!==entryId)return fail('WORD_REVISION_CONFLICT',409);
   if(entry.verification!=='docx_structure_only')
    return json({ok:true,status:'done',pdf_available:true,attempts:0,updated_at:entry.updated_at||''});
   const hash=await accountHash(env,candidate.phone);
   if(!hash)return fail('WORD_DB_NOT_READY',503);
   if(!await tasksReady(db))return fail('WORD_DB_NOT_READY',503);
   const task=await readRenderTask(db,hash,row.id,state.jobHash??'',entry.id);
   return json(renderTaskPayload(task));
  }
  if(action!=='preview')return fail('INVALID_REQUEST',400);
  if(!renderer)return fail('WORD_PDF_NOT_READY',422);
  const key=prefix(row)+'.source.pdf';
  const cached=await bucket.get(key);
  if(cached){
   const bytes=new Uint8Array(await cached.arrayBuffer());
   if(bytes.length>=500&&bytes.length<=12*1024*1024)
    return replyFile(bytes,'application/pdf','HHBA-resume-original-preview.pdf');
  }
  if(!v4(env)&&!await quotaReady(db))return fail('WORD_DB_NOT_READY',503);
  if(!v4(env)&&!await reserve(db,env,candidate.phone,'preview'))
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
export async function onRequestPost({request,env,waitUntil}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 const renderer=configured(env),docxOnly=docxOnlyConfigured(env);
 if(!renderer&&!docxOnly)return fail('WORD_NOT_READY',503);
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 let candidate;
 try{candidate=await owner(db,request);}catch{return fail('SESSION_INVALID',401);}
 if(candidate.error)return fail(candidate.error,candidate.status);
 let body;
 try{body=await readSmall(request,v4(env)?2*1024*1024:LIMIT);}catch{return fail('INVALID_REQUEST',400);}
 const id=body?.resume_id,action=body?.action||'edit',jobId=body?.job_id;
 if(!ID.test(String(id||''))||!validJobId(jobId)||
  !['edit','undo','redo','convert-pdf'].includes(action)||
  body?.confirmed_real!==true||body?.consent_word_processing!==true||
  (body.expected_revision!==undefined&&
   (!Number.isInteger(body.expected_revision)||body.expected_revision<0||
    (!v4(env)&&body.expected_revision>MAX_REVISIONS)))||
  (action==='edit'&&(typeof body?.original!=='string'||
   typeof body?.text!=='string'||body.original.length>editLimit(env)||body.text.length>editLimit(env))))
  return fail('INVALID_REQUEST',400);
 let row,created=[];
 try{
  row=await rowFor(db,id,candidate.phone);
  if(!row)return fail('RESUME_NOT_FOUND',404);
  if(!validRow(row))return fail('WORD_INVALID_FILE',422);
  // Verify owner-bound original even when editing a previously saved revision.
  const original=await loadBytes(bucket,row);
  const state=await approved(bucket,row,jobId,env);
  if(body.expected_revision!==undefined&&body.expected_revision!==state.revision)
   return fail('WORD_REVISION_CONFLICT',409);
  if(state.items.length&&!state.etag)return fail('WORD_REVISION_LOCK_UNAVAILABLE',503);
  if(action==='convert-pdf'){
   if(!state.saved)return fail('WORD_NOT_EDITED',404);
   const entry=state.saved;
   if(body.expected_entry_id!==undefined&&body.expected_entry_id!==entry.id)return fail('WORD_REVISION_CONFLICT',409);
   if(entry.verification!=='docx_structure_only')
    return json({ok:true,status:'done',pdf_available:true,revision:state.revision,
     total_revisions:state.items.length});
   if(!renderer)return fail('WORD_RENDERER_REQUIRED',422);
   const hash=await accountHash(env,candidate.phone);
   if(!hash)return fail('WORD_DB_NOT_READY',503);
   if(!await tasksReady(db))return fail('WORD_DB_NOT_READY',503);
   const jobHash=state.jobHash??'';
   const existing=await readRenderTask(db,hash,row.id,jobHash,entry.id);
   if(liveRender(existing))return json(renderTaskPayload(existing));
   if(!v4(env)&&!await reserve(db,env,candidate.phone,'export'))
    return fail('WORD_DAILY_LIMIT',429);
   const now=new Date().toISOString();
   const attempt=await openRenderTask(db,hash,row.id,jobHash,entry.id,now);
   if(attempt===null){
    const concurrent=await readRenderTask(db,hash,row.id,jobHash,entry.id);
    return liveRender(concurrent)?json(renderTaskPayload(concurrent)):fail('WORD_BUSY',503);
   }
   // The conversion continues after the response when the platform offers
   // background work, so leaving the page does not cancel it; otherwise it
   // runs inline and the response carries the final status.
   const work=runLateRender(db,bucket,env,candidate.phone,hash,row,jobId,jobHash,entry,attempt);
   if(typeof waitUntil==='function')waitUntil(work.catch(()=>{}));
   // The current UI keeps this request alive while independently polling.
   // Do not rely solely on the short post-response Pages waitUntil window.
   if(typeof waitUntil!=='function'||body.await_completion===true)await work;
   const latest=await approved(bucket,row,jobId,env);
   if(latest.saved?.id===entry.id&&latest.saved.verification!=='docx_structure_only'){
    const task=await readRenderTask(db,hash,row.id,jobHash,entry.id).catch(()=>null);
    return json({ok:true,status:'done',pdf_available:true,attempts:task?.attempts??attempt,updated_at:latest.saved.updated_at||now});
   }
   return json(renderTaskPayload(await readRenderTask(db,hash,row.id,jobHash,entry.id)));
  }
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
  if(!v4(env)&&state.revision>=MAX_REVISIONS) return fail('WORD_REVISION_LIMIT',422);
  if(!renderer&&!hashIsValid(body.client_docx_sha256))return fail('INVALID_REQUEST',400);
  if(!v4(env)&&!await quotaReady(db))return fail('WORD_DB_NOT_READY',503);
  if(!v4(env)&&!await reserve(db,env,candidate.phone,'export'))
   return fail('WORD_DAILY_LIMIT',429);
  const current=state.saved?
   await versionBytes(bucket,state.key,state.saved,'docx'):original;
  if(body.occurrence!==undefined&&(!v4(env)||renderer||body.expected_revision===undefined||!Number.isSafeInteger(body.occurrence)||!Number.isSafeInteger(body.occurrenceCount)))return fail('INVALID_REQUEST',400);
  const selected=[{original:body.original,text:body.text,occurrence:body.occurrence,occurrenceCount:body.occurrenceCount}];
  // Exact OOXML patching preserves the original ZIP members. A renderer-free
  // revision NEVER claims to preserve the visible Word page geometry.
  const result=renderer?await prepareVerifiedOriginalDocxExport({
   original:current,edits:selected,
   verifyLayout:async({original,edited,oldText,newText})=>
    wordRequest(env,'verify',{original,edited,oldText,newText})
  }):{bytes:await editOriginalDocxStrict(current,selected,{allowExpansion:true}),pageCount:null};
  if(!renderer&&await shaBytes(result.bytes)!==body.client_docx_sha256)
   return fail('WORD_EDIT_CORRUPTED',409);
  const pdf=renderer?await wordRequest(env,'render',{original:result.bytes}):null;
  if(!await stillOwned(db,row,candidate.phone))return fail('RESUME_NOT_FOUND',404);
  const entry={id:crypto.randomUUID(),original:body.original,text:body.text,
   verification:renderer?'layout_verified':'docx_structure_only',
   page_count:result.pageCount,docx_sha256:await shaBytes(result.bytes),
   preview_sha256:pdf?await shaBytes(pdf):null,updated_at:new Date().toISOString()};
  const wordKey=revisionKey(state.key,entry,'docx');
  const pdfKey=revisionKey(state.key,entry,'pdf');
  created=pdf?[wordKey,pdfKey]:[wordKey];
  // Publish immutable, verified bytes first; the CAS manifest becomes the
  // authoritative active revision only after both blobs are stored.
  await bucket.put(wordKey,result.bytes,{httpMetadata:{contentType:DOCX_MIME}});
  if(pdf)await bucket.put(pdfKey,pdf,{httpMetadata:{contentType:'application/pdf'}});
  if(!await stillOwned(db,row,candidate.phone))throw Error('RESUME_NOT_FOUND');
  const dropped=state.items.slice(state.revision).filter(x=>x.id!=='legacy');
  const items=[...state.items.slice(0,state.revision),entry];
  await commitManifest(bucket,state,row,items.length,items,state.jobLabel||safeJobLabel(body.job_label));
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
   total_revisions:items.length,page_count:result.pageCount,
   layout_verified:renderer,pdf_available:renderer});
 }catch(error){
  await Promise.all(created.map(key=>bucket.delete(key).catch(()=>{})));
  const c=code(error);return fail(c,errorStatus(c));
 }
}
