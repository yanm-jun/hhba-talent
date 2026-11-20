import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createResumeDocx} from '../src/services/resumeDocx.ts';
import {onRequestGet,onRequestPost} from '../functions/api/resume-word.js';
const origin='https://preview.hhba.example';
const id='11111111-2222-4333-8444-555555555555';
const store='candidate/test/'+id+'.docx';
const original=createResumeDocx({
 details:{fullName:'测试用户',headline:'',phone:'',email:'',location:'',summary:''},
 experiences:[],education:[],skills:[],sourceParagraphs:[]
});
const sha=createHash('sha256').update(original).digest('hex');
const pdf=new Uint8Array(600);pdf.set(new TextEncoder().encode('%PDF-1.4'));
const data=Buffer.from(original).buffer.slice(
 Buffer.from(original).byteOffset,Buffer.from(original).byteOffset+original.length);
function fixture({enabled=true,owner='account-A',role='candidate'}={}){
 const saved=new Map([[store,original]]);
 const env={
  HHBA_WORD_RENDER_ENABLED:enabled?'1':'0',
  HHBA_AUTH_ROLLOUT:'preview',HHBA_WORD_RENDER_SHARED_SECRET:'x'.repeat(50),
  HHBA_WORD_RENDER_ENDPOINT:'https://private-word.hhba.invalid/',
  HHBA_MATCH_LIMIT_PEPPER:'y'.repeat(30),
  HHBA_PRIVATE_RESUMES:{
   async get(key){if(!saved.has(key))return null;
    const bytes=saved.get(key);
    return {etag:createHash('sha256').update(bytes).digest('hex'),
     arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),
     json:async()=>JSON.parse(String(bytes))};},
   async put(key,data,options={}){
    const prior=saved.get(key);
    if(options.onlyIf){
     const expected=options.onlyIf;
     if(expected.etagMatches&&(!prior||
       createHash('sha256').update(prior).digest('hex')!==expected.etagMatches))return null;
     if(expected.etagDoesNotMatch==='*'&&prior)return null;
    }
    const bytes=typeof data==='string'?data:new Uint8Array(data);
    saved.set(key,bytes);
    return {etag:createHash('sha256').update(bytes).digest('hex')};
   },
   async delete(key){saved.delete(key);}
  },
  HHBA_PNVS_AUTH_DB:{prepare(sql){return {
   async first(){
    if(sql.includes('sqlite_master'))return {name:'hhba_resume_word_attempts'};
    throw Error('unbound query: '+sql);
   },
   bind(...args){return {
    async first(){
     if(sql.includes('FROM hhba_auth_sessions'))return {
      phone:'account-A',revoked:0,
      expires_at:new Date(Date.now()+3600000).toISOString()
     };
     if(sql.includes('FROM hhba_auth_users'))return {phone:'account-A',role};
     if(sql.includes('FROM hhba_candidate_resumes')){
      if(args[0]!==id||args[1]!==owner)return null;
      return {id,media_type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       size_bytes:original.byteLength,storage_key:store,sha256:sha};
     }
     throw Error('unsupported query '+sql);
    },
    async run(){
     if(sql.includes('hhba_resume_word_attempts'))return {
      success:true,meta:{changes:1}};
     if(sql.includes('UPDATE hhba_auth_sessions'))return {
      success:true,meta:{changes:1}};
     throw Error('unsupported update '+sql);
    }
   };}
  }}}
 };
 return {env,saved};
}
const req=(action='status',{auth=true,method='GET',body=null,foreign=false}={})=>
 new Request(origin+'/api/resume-word?action='+action+'&resume_id='+id,{
 method,headers:{
  ...(auth?{Authorization:'Bearer synthetic-session'}:{}),
  Origin:foreign?'https://malicious.example':origin,
  ...(body?{'Content-Type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{})
 });
test('Word render feature defaults disabled and never opens any account file',async()=>{
 const x=fixture({enabled:false});
 assert.equal((await (await onRequestGet({request:req(),env:x.env})).json()).enabled,false);
 assert.equal((await onRequestGet({request:req('preview'),env:x.env})).status,503);
 assert.equal(x.saved.size,1);
});
test('only authenticated candidate owner can inspect original Word run text',async()=>{
 const x=fixture();
 const response=await onRequestGet({request:req('inspect'),env:x.env});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.ok(result.editable_text.includes('测试用户'));
 assert.equal(result.saved,null);
 assert.equal((await onRequestGet({request:req('inspect',{auth:false}),env:x.env})).status,401);
 assert.equal((await onRequestGet({request:req('inspect'),env:fixture({owner:'other-account'}).env})).status,404);
 assert.equal((await onRequestGet({request:req('inspect'),env:fixture({role:'employer'}).env})).status,403);
});
test('preview requires private authenticated upstream and is cached in private R2',async()=>{
 const x=fixture();let calls=0;
 const old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,'https://private-word.hhba.invalid/v1/render');
  assert.match(options.headers.Authorization,/^Bearer x{50}$/);
  assert.equal(options.redirect,'manual');
  const payload=JSON.parse(options.body);
  assert.equal(Buffer.from(payload.original_b64,'base64').length,original.length);
  return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 try{
  const a=await onRequestGet({request:req('preview'),env:x.env});
  assert.equal(a.status,200);
  assert.equal((await a.arrayBuffer()).byteLength,600);
  const b=await onRequestGet({request:req('preview'),env:x.env});
  assert.equal(b.status,200);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old;}
});
test('Word edit is blocked without explicit consent or if source is not owned',async()=>{
 const x=fixture(),body={resume_id:id,original:'测试用户',text:'测试名',
  confirmed_real:true,consent_word_processing:true};
 assert.equal((await onRequestPost({request:req('export',{method:'POST',
  body:{...body,confirmed_real:false}}),env:x.env})).status,400);
 assert.equal((await onRequestPost({request:req('export',{method:'POST',
  body,foreign:true}),env:x.env})).status,403);
 assert.equal((await onRequestPost({request:req('export',{method:'POST',
  body}),env:fixture({owner:'other-account'}).env})).status,404);
});
test('only renderer-proven exact Word text is saved for downloadable edits',async()=>{
 const x=fixture(),body={resume_id:id,original:'测试用户',text:'测试名',
  confirmed_real:true,consent_word_processing:true};
 const prior=globalThis.fetch;let verified=false;
 globalThis.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body);
  if(url.endsWith('/v1/verify')){
   verified=true;
   assert.equal(payload.old_text,'测试用户');
   assert.equal(payload.new_text,'测试名');
   assert.ok(Buffer.from(payload.edited_b64,'base64').length>500);
   return Response.json({ok:true,verified:true,report:{
    passed:true,page_count:1,changed_pixels:821,
    changed_region:{page:1,x:90,y:90,width:80,height:25}
   }});
  }
  return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 try{
  const response=await onRequestPost({
   request:req('export',{method:'POST',body}),env:x.env
  });
  assert.equal(response.status,200,await response.clone().text());
  assert.equal(verified,true);
  const state=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(state.saved.text,'测试名');
  assert.ok(state.editable_text.includes('测试名'));
  assert.equal(state.revision,1);
  assert.equal(state.total_revisions,1);
  const downloaded=await onRequestGet({request:req('download'),env:x.env});
  assert.equal(downloaded.status,200);
  assert.ok((await downloaded.arrayBuffer()).byteLength>500);
  const editedPage=await onRequestGet({request:req('edited-preview'),env:x.env});
  assert.equal(editedPage.status,200);
  const pdfDownload=await onRequestGet({request:req('download-pdf'),env:x.env});
  assert.equal(pdfDownload.status,200);
  assert.equal(pdfDownload.headers.get('Content-Type'),'application/pdf');
  assert.match(pdfDownload.headers.get('Content-Disposition'),/HHBA-resume-edited\.pdf/);
  assert.deepEqual(Buffer.from(await pdfDownload.arrayBuffer()),Buffer.from(await editedPage.arrayBuffer()),
   'PDF download must be the exact bytes of the verified Word-rendered preview');
  assert.equal((await onRequestGet({request:req('download-pdf'),env:fixture({owner:'other-account'}).env})).status,404,
   'another account cannot download the PDF derivative');
  const stateBytes=JSON.parse(x.saved.get(store+'.hhba-word-preserved-v1-'+sha+'.json'));
  assert.equal(stateBytes.schema,'HHBA_ORIGINAL_WORD_VERSIONS_V2');
  const base=store+'.hhba-word-preserved-v1-'+sha+
   '.revision-'+stateBytes.items[0].id;
  x.saved.set(base+'.pdf',new Uint8Array([37,80,68,70,45,0]));
  const alteredPdf=await onRequestGet({request:req('download-pdf'),env:x.env});
  assert.equal(alteredPdf.status,409,'a corrupted PDF derivative must never download');
  x.saved.set(base+'.docx',new Uint8Array([0,1,2]));
  const corrupted=await onRequestGet({request:req('download'),env:x.env});
  assert.equal(corrupted.status,409,'never download a damaged or partially written Word');
 }finally{globalThis.fetch=prior;}
});
test('Word route rejects replaced same-length R2 original bytes before private service call',async()=>{
 const x=fixture();
 const replaced=new Uint8Array(original);
 replaced[42]^=1;
 x.saved.set(store,replaced);
 const seen=[];
 const before=globalThis.fetch;
 globalThis.fetch=async url=>{seen.push(url);throw Error('should not be called');};
 try{
  const response=await onRequestGet({request:req('preview'),env:x.env});
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'RESUME_BYTES_MISMATCH');
  assert.deepEqual(seen,[],'untrusted bytes never reach renderer');
 }finally{globalThis.fetch=before;}
});
test('when renderer cannot verify changed layout the draft is not saved',async()=>{
 const x=fixture(),prior=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({ok:false,error:'WORD_LAYOUT_MOVED'},{status:422});
 try{
  const response=await onRequestPost({
   request:req('export',{method:'POST',body:{
    resume_id:id,original:'测试用户',text:'测试名',
    confirmed_real:true,consent_word_processing:true
   }}),env:x.env
  });
  assert.notEqual(response.status,200);
  assert.equal(x.saved.size,1);
 }finally{globalThis.fetch=prior;}
});

test('multiple Word edits persist; undo/redo restore every verified DOCX and PDF revision',async()=>{
 const x=fixture(),previous=globalThis.fetch;
 const verification=[];
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/v1/verify')){
   const request=JSON.parse(options.body);
   verification.push({oldText:request.old_text,newText:request.new_text});
   return Response.json({ok:true,verified:true,report:{
    passed:true,page_count:1,changed_pixels:72,
    changed_region:{page:1,x:40,y:35,width:100,height:18}
   }});
  }
  return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 const write=async(original,text,revision)=>
  onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,action:'edit',original,text,expected_revision:revision,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env});
 const shift=async(action,revision)=>
  onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,action,expected_revision:revision,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env});
 try{
  const first=await write('测试用户','测试名',0);
  assert.equal(first.status,200,await first.clone().text());
  const second=await write('测试名','新名',1);
  assert.equal(second.status,200,await second.clone().text());
  assert.deepEqual(verification,[{oldText:'测试用户',newText:'测试名'},
   {oldText:'测试名',newText:'新名'}]);
  const current=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(current.revision,2);
  assert.equal(current.total_revisions,2);
  assert.ok(current.editable_text.includes('新名'));
  const latest=Buffer.from(await (await onRequestGet({
   request:req('download'),env:x.env})).arrayBuffer());
  assert.ok(latest.includes(Buffer.from('新名')));
  assert.equal((await write('新名','名字',0)).status,409,'stale browser cannot overwrite revision');
  assert.equal((await shift('undo',2)).status,200);
  const firstVersion=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(firstVersion.revision,1);
  assert.equal(firstVersion.total_revisions,2);
  assert.ok(firstVersion.editable_text.includes('测试名'));
  assert.equal((await shift('undo',1)).status,200);
  const initial=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(initial.revision,0);
  assert.equal(initial.total_revisions,2);
  assert.equal(initial.saved,null);
  assert.equal((await onRequestGet({request:req('download-pdf'),env:x.env})).status,404);
  assert.equal((await shift('redo',0)).status,200);
  assert.equal((await shift('redo',1)).status,200);
  const restored=Buffer.from(await (await onRequestGet({
   request:req('download'),env:x.env})).arrayBuffer());
  assert.deepEqual(restored,latest,'redo must restore identical Word bytes, not rerender a template');
  const restoredPdf=await onRequestGet({request:req('download-pdf'),env:x.env});
  assert.equal(restoredPdf.status,200);
  assert.equal((await restoredPdf.arrayBuffer()).byteLength,600);
  assert.equal((await shift('redo',2)).status,409);
  assert.equal((await shift('undo',2)).status,200);
  const branch=await write('测试名','名号',1);
  assert.equal(branch.status,200,await branch.clone().text());
  assert.equal((await shift('redo',2)).status,409,'new edit must discard obsolete redo history');
  const branched=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.ok(branched.editable_text.includes('名号'));
 }finally{globalThis.fetch=previous;}
});
