// Private resume vault. Files never enter public Pages assets, device cookies,
// analytics or AI pipelines. A verified PNVS bearer session owns every action.
import {getUserByPhone,sessionOfBearer,sha256Hex} from '../../_lib/real-auth.js';
import {
 RESUME_LIMIT_BYTES,RESUME_MAX_PER_ACCOUNT,STORAGE_CONSENT_VERSION,
 normalizeResumeName,validateResumeBytes,ResumeValidationError,
} from '../../_lib/private-resume-validation.js';

const stamp=()=>new Date().toISOString();
const routePrefix='/api/resumes';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const safeJson=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
});
const err=(code,status=400)=>safeJson({ok:false,error:code},status);
const summary=row=>({
 id:row.id,name:row.filename,type:row.media_type,size:row.size_bytes,
 createdAt:row.created_at,
});
const errorCode={
 INVALID_FILENAME:400,INVALID_RESUME_SIZE:413,INVALID_PDF_CONTAINER:400,
 INVALID_DOCX_CONTAINER:400,UNSAFE_DOCX_CONTENT:400,DOCX_EXPANSION_LIMIT:400,
};
function sameSiteMutation(request){
 const origin=request.headers.get('Origin');
 const url=new URL(request.url);
 return origin===url.origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function boundedBytes(request){
 if(!request.body)throw new ResumeValidationError('INVALID_RESUME_SIZE');
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>RESUME_LIMIT_BYTES))
  throw new ResumeValidationError('INVALID_RESUME_SIZE');
 const chunks=[],reader=request.body.getReader();let total=0;
 try{
  while(true){
   const next=await reader.read();
   if(next.done)break;
   total+=next.value.byteLength;
   if(total>RESUME_LIMIT_BYTES){await reader.cancel();throw new ResumeValidationError('INVALID_RESUME_SIZE');}
   chunks.push(next.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
export async function onRequest({request,env}){
 const db=env.HHBA_PNVS_AUTH_DB,bucket=env.HHBA_PRIVATE_RESUMES;
 if(!db)return err('ACCOUNT_DATABASE_NOT_CONNECTED',503);
 let session,user;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return err('SESSION_INVALID',401);
  user=await getUserByPhone(db,session.phone);
  if(!user||user.role!=='candidate')return err('FORBIDDEN',403);
 }catch{return err('ACCOUNT_AUTH_UNAVAILABLE',503);}
 if(!bucket||typeof bucket.put!=='function'||typeof bucket.get!=='function'||typeof bucket.delete!=='function')
  return err('PRIVATE_STORAGE_NOT_ENABLED',503);
 const phone=session.phone,method=request.method;
 const pathname=new URL(request.url).pathname;
 const tail=pathname.slice(routePrefix.length).replace(/\/$/,'');
 if(['POST','DELETE','PUT'].includes(method)&&!sameSiteMutation(request))
  return err('ORIGIN_REQUIRED',403);
 try{
  if(tail===''&&method==='GET'){
   const rows=await db.prepare(
    'SELECT id,filename,media_type,size_bytes,created_at FROM hhba_candidate_resumes WHERE phone=? ORDER BY created_at DESC LIMIT 3'
   ).bind(phone).all();
   return safeJson({kind:'HHBA_PRIVATE_RESUME_VAULT_V1',
    maxFiles:RESUME_MAX_PER_ACCOUNT,items:(rows.results||[]).map(summary)});
  }
  if(tail===''&&method==='POST'){
   if(request.headers.get('X-HHBA-Storage-Consent')!==STORAGE_CONSENT_VERSION)
    return err('STORAGE_CONSENT_REQUIRED',400);
   const filename=normalizeResumeName(request.headers.get('X-HHBA-Resume-Name'));
   const bytes=await boundedBytes(request),format=validateResumeBytes(bytes,filename);
   const inputMime=(request.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
   if(inputMime!==format.mime&&inputMime!=='application/octet-stream')
    return err('FILE_TYPE_MISMATCH',415);
   const count=await db.prepare(
    'SELECT COUNT(*) AS n FROM hhba_candidate_resumes WHERE phone=?'
   ).bind(phone).first();
   if(Number(count?.n)>=RESUME_MAX_PER_ACCOUNT)return err('RESUME_LIMIT_REACHED',409);
   const dayAgo=new Date(Date.now()-24*3600000).toISOString();
   const uploads=await db.prepare(
    'SELECT COUNT(*) AS n FROM hhba_candidate_resume_upload_events WHERE phone=? AND created_at>=?'
   ).bind(phone,dayAgo).first();
   if(Number(uploads?.n)>=15)return err('UPLOAD_RATE_LIMITED',429);
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
   const hash=Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
   const existing=await db.prepare(
    'SELECT id FROM hhba_candidate_resumes WHERE phone=? AND sha256=?'
   ).bind(phone,hash).first();
   if(existing)return err('RESUME_ALREADY_EXISTS',409);
   const id=crypto.randomUUID(),owner=await sha256Hex('candidate-resume:'+phone);
   const key='candidates/'+owner.slice(0,24)+'/'+id+'.'+format.ext;
   const createdAt=stamp();
   await bucket.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
   let inserted=false;
   try{
    const saved=await db.prepare(
     'INSERT OR IGNORE INTO hhba_candidate_resumes '+
     '(id,phone,storage_key,filename,media_type,size_bytes,sha256,storage_consent_version,storage_consent_at,created_at) '+
     'SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_candidate_resumes WHERE phone=?)<?'
    ).bind(id,phone,key,filename,format.mime,format.size,hash,
      STORAGE_CONSENT_VERSION,createdAt,createdAt,phone,RESUME_MAX_PER_ACCOUNT).run();
    inserted=saved?.success===true&&saved?.meta?.changes===1;
    if(!inserted){await bucket.delete(key);return err('RESUME_ALREADY_EXISTS_OR_LIMIT',409);}
    const event=await db.prepare(
     'INSERT INTO hhba_candidate_resume_upload_events(phone,created_at) VALUES(?,?)'
    ).bind(phone,createdAt).run();
    if(event?.success!==true)throw Error('UPLOAD_LEDGER_FAILED');
   }catch(e){
    if(inserted)await db.prepare('DELETE FROM hhba_candidate_resumes WHERE id=? AND phone=?')
      .bind(id,phone).run().catch(()=>{});
    await bucket.delete(key).catch(()=>{});
    return err('RESUME_SAVE_UNAVAILABLE',503);
   }
   return safeJson({ok:true,kind:'HHBA_PRIVATE_RESUME_VAULT_V1',
     item:{id,name:filename,type:format.mime,size:format.size,createdAt}},201);
  }
  const download=tail.match(/^\/([0-9a-f-]{36})\/download$/);
  const removal=tail.match(/^\/([0-9a-f-]{36})$/);
  const id=download?.[1]||removal?.[1];
  if(id&&uuidPattern.test(id)&&((download&&method==='GET')||(removal&&method==='DELETE'))){
   const row=await db.prepare(
    'SELECT id,filename,media_type,size_bytes,storage_key FROM hhba_candidate_resumes WHERE phone=? AND id=?'
   ).bind(phone,id).first();
   if(!row)return err('RESUME_NOT_FOUND',404);
   if(download){
    const object=await bucket.get(row.storage_key);
    if(!object)return err('RESUME_NOT_FOUND',404);
    const name=encodeURIComponent(row.filename);
    const ext=row.media_type==='application/pdf'?'pdf':'docx';
    return new Response(object.body,{
     status:200,headers:{
      'Content-Type':'application/octet-stream',
      'Content-Disposition':'attachment; filename="hhba-resume.'+ext+'"; filename*=UTF-8'+"'"+ "'"+name,
      'Content-Length':String(row.size_bytes),
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
      'X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'none'; sandbox",
     }
    });
   }
   await bucket.delete(row.storage_key);
   const deleted=await db.prepare(
    'DELETE FROM hhba_candidate_resumes WHERE phone=? AND id=?'
   ).bind(phone,id).run();
   if(deleted?.success!==true)return err('RESUME_DELETE_UNAVAILABLE',503);
   return safeJson({ok:true,id,deleted:true});
  }
  return err('NOT_FOUND',404);
 }catch(e){
  if(e instanceof ResumeValidationError)return err(e.code,errorCode[e.code]||400);
  // Never log raw filenames, phone numbers, document bytes or uploaded text.
  console.error('HHBA_PRIVATE_RESUME_FAILURE',e?.name||'unknown');
  return err('PRIVATE_RESUME_SERVICE_UNAVAILABLE',503);
 }
}
