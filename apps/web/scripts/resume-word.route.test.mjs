import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createResumeDocx} from '../src/services/resumeDocx.ts';
import {editOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';
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
function fixture({enabled=true,docxOnly=false,owner='account-A',role='candidate'}={}){
 const saved=new Map([[store,original]]);
 const env={
  HHBA_WORD_RENDER_ENABLED:enabled?'1':'0',
  HHBA_WORD_DOCX_ONLY_ENABLED:docxOnly?'1':'0',
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
const req=(action='status',{auth=true,method='GET',body=null,foreign=false,jobId}={})=>
 new Request(origin+'/api/resume-word?action='+action+'&resume_id='+id+
  (jobId===undefined?'':'&job_id='+encodeURIComponent(jobId)),{
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

test('production DOCX editor can use a dedicated Word secret without activating match-wide limits',async()=>{
 const x=fixture({enabled:false,docxOnly:true});
 delete x.env.HHBA_MATCH_LIMIT_PEPPER;
 delete x.env.HHBA_AUTH_ROLLOUT;
 x.env.HHBA_MATCH_RUNTIME_MODE='production';
 x.env.HHBA_WORD_LIMIT_PEPPER='word-only-qa-'+('z'.repeat(48));
 const status=await (await onRequestGet({request:req('status'),env:x.env})).json();
 assert.equal(status.enabled,true);
 assert.equal(status.docx_only_enabled,true);
 assert.equal(status.renderer_enabled,false);
 const patched=await editOriginalDocxStrict(original,
  [{original:'测试用户',text:'岗位甲运营督导'}],{allowExpansion:true});
 const response=await onRequestPost({request:req('export',{method:'POST',jobId:'production-role',
  body:{resume_id:id,job_id:'production-role',action:'edit',original:'测试用户',
   text:'岗位甲运营督导',expected_revision:0,
   client_docx_sha256:createHash('sha256').update(patched).digest('hex'),
   confirmed_real:true,consent_word_processing:true}}),env:x.env});
 assert.equal(response.status,200,await response.clone().text());
 const downloaded=await onRequestGet({request:req('download',{jobId:'production-role'}),env:x.env});
 assert.equal(downloaded.status,200);
 assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),patched);
 assert.deepEqual(x.saved.get(store),original);
});

test('opt-in renderer-free flow saves original DOCX structure without inventing PDF or verified pages',async()=>{
 const x=fixture({enabled:false,docxOnly:true});
 const status=await (await onRequestGet({request:req(),env:x.env})).json();
 assert.equal(status.enabled,true);
 assert.equal(status.renderer_enabled,false);
 assert.equal(status.docx_only_enabled,true);
 assert.equal((await onRequestGet({request:req('preview'),env:x.env})).status,422);
 const initial=await onRequestGet({request:req('source-docx',{jobId:'role-A'}),env:x.env});
 assert.equal(initial.status,200);
 assert.deepEqual(new Uint8Array(await initial.arrayBuffer()),original);
 assert.equal((await onRequestGet({request:req('source-docx',{auth:false}),env:x.env})).status,401);
 assert.equal((await onRequestGet({request:req('source-docx'),env:fixture({
  enabled:false,docxOnly:true,owner:'other'
 }).env})).status,404);
 const post=async(job,oldText,text,rev=0,digest)=>onRequestPost({
  request:req('export',{method:'POST',jobId:job,body:{
   resume_id:id,job_id:job,action:'edit',original:oldText,text,
   expected_revision:rev,client_docx_sha256:digest,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env
 });
 const a='role-A',b='role-B';
 const aBytes=await editOriginalDocxStrict(original,[{original:'测试用户',text:'岗位甲'}]);
 const aHash=createHash('sha256').update(aBytes).digest('hex');
 assert.equal((await post(a,'测试用户','岗位甲',0)).status,400,
  'the browser must prove it ran the patcher before publishing');
 assert.equal((await post(a,'测试用户','岗位甲',0,'a'.repeat(64))).status,409,
  'a mismatching proposed DOCX hash is never saved');
 assert.equal((await post(a,'测试用户','岗位甲',0,aHash)).status,200);
 const bBytes=await editOriginalDocxStrict(original,[{original:'测试用户',text:'岗位乙'}]);
 const bHash=createHash('sha256').update(bBytes).digest('hex');
 assert.equal((await post(b,'测试用户','岗位乙',0,bHash)).status,200);
 const infoA=await (await onRequestGet({request:req('inspect',{jobId:a}),env:x.env})).json();
 const infoB=await (await onRequestGet({request:req('inspect',{jobId:b}),env:x.env})).json();
 assert.equal(infoA.revision,1);assert.equal(infoB.revision,1);
 assert.equal(infoA.layout_verified,false);
 assert.equal(infoA.pdf_available,false);
 assert.equal(infoA.history[0].layout_verified,false);
 assert.equal(infoA.history[0].page_count,null);
 assert.equal((await onRequestGet({request:req('download-pdf',{jobId:a}),env:x.env})).status,422);
 const wordA=new Uint8Array(await (await onRequestGet({request:req('download',{jobId:a}),env:x.env})).arrayBuffer());
 const wordB=new Uint8Array(await (await onRequestGet({request:req('download',{jobId:b}),env:x.env})).arrayBuffer());
 assert.deepEqual(wordA,aBytes);assert.deepEqual(wordB,bBytes);
 assert.notDeepEqual(wordA,wordB);
 assert.equal((await onRequestGet({request:req('source-docx',{jobId:a}),env:x.env})).status,200);
 assert.equal((await onRequestPost({request:req('export',{method:'POST',body:{
  resume_id:id,job_id:a,action:'undo',expected_revision:1,
  confirmed_real:true,consent_word_processing:true
 }}),env:x.env})).status,200);
 assert.equal((await (await onRequestGet({request:req('inspect',{jobId:a}),env:x.env})).json()).revision,0);
 assert.equal((await (await onRequestGet({request:req('inspect',{jobId:b}),env:x.env})).json()).revision,1);
 assert.deepEqual(new Uint8Array(await (await onRequestGet({request:req('source-docx',{jobId:a}),env:x.env})).arrayBuffer()),original);
 assert.deepEqual(x.saved.get(store),original,'original private R2 object is untouched');
});

test('DOCX-only permits user-confirmed longer wording while strict renderer mode refuses unverified expansion',async()=>{
 const x=fixture({enabled:false,docxOnly:true});
 const expanded='负责山东区域多家门店运营管理、员工培训及客户体验持续改善';
 await assert.rejects(
  editOriginalDocxStrict(original,[{original:'测试用户',text:expanded}]),
  /WORD_EDIT_TOO_LONG/);
 const bytes=await editOriginalDocxStrict(original,
  [{original:'测试用户',text:expanded}],{allowExpansion:true});
 const digest=createHash('sha256').update(bytes).digest('hex');
 const response=await onRequestPost({request:req('export',{method:'POST',jobId:'supervisor-expansion',body:{
  resume_id:id,job_id:'supervisor-expansion',action:'edit',original:'测试用户',text:expanded,
  client_docx_sha256:digest,expected_revision:0,
  confirmed_real:true,consent_word_processing:true
 }}),env:x.env});
 assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();
 assert.equal(result.layout_verified,false);
 assert.equal(result.pdf_available,false);
 assert.equal(result.page_count,null);
 const stored=new Uint8Array(await (await onRequestGet({
  request:req('download',{jobId:'supervisor-expansion'}),env:x.env
 })).arrayBuffer());
 assert.deepEqual(stored,bytes);
 assert.deepEqual(x.saved.get(store),original);
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
  assert.equal((await onRequestGet({request:req('edited-preview&revision=1'),env:x.env})).status,409,
   'old page coordinates must not be combined with newly edited text nodes');
  assert.equal((await onRequestGet({request:req('edited-preview&revision=2'),env:x.env})).status,200);
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

test('legacy V1 verified Word files remain readable, editable and reversible',async()=>{
 const x=fixture();
 const base=store+'.hhba-word-preserved-v1-'+sha;
 const legacy=await editOriginalDocxStrict(original,[
  {original:'测试用户',text:'测试名'}
 ]);
 x.saved.set(base+'.docx',legacy);
 x.saved.set(base+'.edited.pdf',pdf);
 x.saved.set(base+'.json',JSON.stringify({
  schema:'HHBA_ORIGINAL_WORD_EDIT_V1',source_sha256:sha,
  original:'测试用户',text:'测试名',page_count:1,
  docx_sha256:createHash('sha256').update(legacy).digest('hex'),
  preview_sha256:createHash('sha256').update(pdf).digest('hex'),
  updated_at:'2026-11-19T00:00:00Z'
 }));
 const before=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
 assert.equal(before.revision,1);
 assert.ok(before.editable_text.includes('测试名'));
 const old=globalThis.fetch;
 globalThis.fetch=async url=>url.endsWith('/v1/verify')?
  Response.json({ok:true,verified:true,report:{
   passed:true,page_count:1,changed_pixels:25,
   changed_region:{page:1,x:40,y:40,width:80,height:20}
  }}):new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 try{
  const next=await onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,action:'edit',original:'测试名',text:'新名',expected_revision:1,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env});
  assert.equal(next.status,200,await next.clone().text());
  const state=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(state.revision,2);
  assert.equal(state.total_revisions,2);
  assert.ok(state.editable_text.includes('新名'));
  const undo=await onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,action:'undo',expected_revision:2,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env});
  assert.equal(undo.status,200);
  const restored=Buffer.from(await (await onRequestGet({
   request:req('download'),env:x.env})).arrayBuffer());
  assert.deepEqual(restored,Buffer.from(legacy));
 }finally{globalThis.fetch=old;}
});

test('competing edits use compare-and-swap; one writer wins and the other is rejected',async()=>{
 const x=fixture();
 const prior=globalThis.fetch;
 let ready=0,release;
 const barrier=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async url=>{
  if(url.endsWith('/v1/verify')){
   if(++ready===2)release();
   await barrier;
   return Response.json({ok:true,verified:true,report:{
    passed:true,page_count:1,changed_pixels:25,
    changed_region:{page:1,x:50,y:40,width:80,height:20}
   }});
  }
  return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 try{
  const make=text=>onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,action:'edit',original:'测试用户',text,
   expected_revision:0,confirmed_real:true,consent_word_processing:true
  }}),env:x.env});
  const responses=await Promise.all([make('测试名'),make('测试人')]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const current=await (await onRequestGet({request:req('inspect'),env:x.env})).json();
  assert.equal(current.revision,1);
  assert.equal(current.total_revisions,1);
  const manifest=JSON.parse(x.saved.get(store+'.hhba-word-preserved-v1-'+sha+'.json'));
  assert.equal(manifest.items.length,1);
  assert.equal(x.saved.size,4,'losing writer must remove its unused Word/PDF revision');
 }finally{globalThis.fetch=prior;}
});


test('one owned Word is isolated into independent per-job DOCX/PDF revisions, including undo/redo and legacy vault',async()=>{
 const x=fixture(),beforeFetch=globalThis.fetch;
 const jobA='greenhouse-test-job-A',jobB='lever-test-job-B',jobC='supervisor-test-job-C';
 const renderCalls=[];
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/v1/verify')){
   renderCalls.push([body.old_text,body.new_text]);
   return Response.json({ok:true,verified:true,report:{
    passed:true,page_count:1,changed_pixels:65,
    changed_region:{page:1,x:40,y:35,width:90,height:17}
   }});
  }
  return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
 };
 const edit=async(jobId,oldText,text,rev=0)=>onRequestPost({
  request:req('export',{method:'POST',body:{
   resume_id:id,job_id:jobId,action:'edit',original:oldText,text,
   expected_revision:rev,confirmed_real:true,consent_word_processing:true
  }}),env:x.env
 });
 const inspect=async jobId=>(await onRequestGet({request:req('inspect',
  jobId===undefined?{}:{jobId}),env:x.env})).json();
 const shift=async(jobId,action,rev)=>onRequestPost({
  request:req('export',{method:'POST',body:{
   resume_id:id,job_id:jobId,action,expected_revision:rev,
   confirmed_real:true,consent_word_processing:true
  }}),env:x.env
 });
 try{
  // The existing unscoped Word/vault record is deliberately populated first.
  assert.equal((await edit(undefined,'测试用户','旧版',0)).status,200);
  const old=await inspect();assert.equal(old.revision,1);
  assert.ok(old.editable_text.includes('旧版'));
  for(const job of [jobA,jobB,jobC]){
   const fresh=await inspect(job);
   assert.equal(fresh.revision,0,'new job starts from ORIGINAL, not the older vault revision');
   assert.equal(fresh.saved,null);
   assert.ok(fresh.editable_text.includes('测试用户'));
   assert.ok(!fresh.editable_text.includes('旧版'));
  }
  const a=await edit(jobA,'测试用户','岗位甲',0);
  assert.equal(a.status,200,await a.clone().text());
  const b=await edit(jobB,'测试用户','岗位乙',0);
  assert.equal(b.status,200,await b.clone().text());
  const c=await edit(jobC,'测试用户','岗位丁',0);
  assert.equal(c.status,200,await c.clone().text());
  assert.ok((await inspect(jobA)).editable_text.includes('岗位甲'));
  assert.ok((await inspect(jobB)).editable_text.includes('岗位乙'));
  assert.ok((await inspect(jobC)).editable_text.includes('岗位丁'));
  assert.equal((await inspect(jobA)).revision,1);
  assert.equal((await inspect(jobB)).revision,1);
  assert.equal((await inspect(jobC)).revision,1);
  assert.ok((await inspect()).editable_text.includes('旧版'));
  const base=store+'.hhba-word-preserved-v1-'+sha;
  const manifests=[...x.saved.keys()].filter(k=>k.startsWith(base+'.job-')&&k.endsWith('.json'));
  assert.equal(manifests.length,3,'three target jobs need three private manifests');
  const uniqueScopes=new Set(manifests.map(k=>JSON.parse(x.saved.get(k)).job_scope_sha256));
  assert.equal(uniqueScopes.size,3);
  for(const job of [jobA,jobB,jobC]){
   assert.equal((await onRequestGet({request:req('download',{jobId:job}),env:x.env})).status,200);
   assert.equal((await onRequestGet({request:req('download-pdf',{jobId:job}),env:x.env})).status,200);
  }
  const wordA=Buffer.from(await (await onRequestGet({
   request:req('download',{jobId:jobA}),env:x.env})).arrayBuffer());
  const wordB=Buffer.from(await (await onRequestGet({
   request:req('download',{jobId:jobB}),env:x.env})).arrayBuffer());
  const wordC=Buffer.from(await (await onRequestGet({
   request:req('download',{jobId:jobC}),env:x.env})).arrayBuffer());
  assert.notDeepEqual(wordA,wordB,'each job exports its own reviewed DOCX bytes');
  assert.notDeepEqual(wordA,wordC);
  assert.notDeepEqual(wordB,wordC);
  assert.ok(wordA.includes(Buffer.from('岗位甲')));
  assert.ok(wordB.includes(Buffer.from('岗位乙')));
  assert.ok(wordC.includes(Buffer.from('岗位丁')));
  assert.equal((await shift(jobA,'undo',1)).status,200);
  assert.equal((await inspect(jobA)).revision,0);
  assert.equal((await onRequestGet({request:req('download',{jobId:jobA}),env:x.env})).status,404);
  assert.equal((await inspect(jobB)).revision,1,'undo in A must not affect B');
  assert.ok((await inspect(jobB)).editable_text.includes('岗位乙'));
  assert.equal((await inspect(jobC)).revision,1,'undo in A must not affect C');
  assert.ok((await inspect(jobC)).editable_text.includes('岗位丁'));
  assert.equal((await shift(jobA,'redo',0)).status,200);
  assert.equal((await inspect(jobA)).revision,1);
  assert.equal((await edit(jobA,'测试用户','覆盖',0)).status,409,
   'stale A tab must never overwrite A or B');
  assert.equal((await edit(jobB,'岗位乙','岗位丙',1)).status,200);
  assert.ok((await inspect(jobB)).editable_text.includes('岗位丙'));
  assert.ok((await inspect(jobA)).editable_text.includes('岗位甲'),
   'continued edits in B must never update A');
  assert.ok((await inspect(jobC)).editable_text.includes('岗位丁'),
   'continued edits in B must never update C');
  assert.ok((await inspect()).editable_text.includes('旧版'),
   'legacy vault remains an independent document branch');
  assert.equal((await onRequestGet({request:req('inspect',{jobId:jobA}),
   env:fixture({owner:'not-account-A'}).env})).status,404);
  assert.equal(renderCalls.length,5);
 }finally{globalThis.fetch=beforeFetch;}
});

test('job scopes cannot be malformed or swap an already verified manifest across jobs',async()=>{
 const x=fixture(),jobA='job-A',jobB='job-B',originalFetch=globalThis.fetch;
 const invalid=['', ' x', 'x ', '\n', 'x'.repeat(513)];
 try{
  for(const jobId of invalid){
   const response=await onRequestGet({request:req('inspect',{jobId}),env:x.env});
   assert.equal(response.status,400,'invalid GET job scope rejected');
   assert.equal((await onRequestPost({request:req('export',{method:'POST',body:{
    resume_id:id,job_id:jobId,original:'测试用户',text:'修改',
    expected_revision:0,confirmed_real:true,consent_word_processing:true
   }}),env:x.env})).status,400,'invalid POST scope rejected');
  }
  assert.equal((await onRequestGet({request:req('inspect&job_id=duplicate',{jobId:jobA}),
   env:x.env})).status,400,'duplicate job ID parameters rejected');
  globalThis.fetch=async(url,options)=>url.endsWith('/v1/verify')?
   Response.json({ok:true,verified:true,report:{
    passed:true,page_count:1,changed_pixels:65,
    changed_region:{page:1,x:40,y:35,width:90,height:17}
   }}):new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}});
  assert.equal((await onRequestPost({request:req('export',{method:'POST',body:{
   resume_id:id,job_id:jobA,action:'edit',original:'测试用户',text:'甲岗位',
   expected_revision:0,confirmed_real:true,consent_word_processing:true
  }}),env:x.env})).status,200);
  const key=[...x.saved.keys()].find(k=>k.endsWith('.json')&&k.includes('.job-'));
  assert.ok(key);
  const body=JSON.parse(x.saved.get(key));
  assert.match(body.job_scope_sha256,/^[0-9a-f]{64}$/);
  // A corrupted/swapped job-manifest cannot turn another job's edits into its own.
  const targetHash=createHash('sha256').update('hhba-word-target-job-v1:'+jobB).digest('hex');
  const crossKey=store+'.hhba-word-preserved-v1-'+sha+'.job-'+targetHash+'.json';
  x.saved.set(crossKey,x.saved.get(key));
  const swapped=await onRequestGet({request:req('inspect',{jobId:jobB}),env:x.env});
  assert.equal(swapped.status,409);
  assert.equal((await swapped.json()).error,'WORD_REVISION_CORRUPT');
  assert.ok((await (await onRequestGet({request:req('inspect',{jobId:jobA}),env:x.env})).json())
   .editable_text.includes('甲岗位'));
 }finally{globalThis.fetch=originalFetch;}
});


test('V4 accepts long confirmed Word text through authenticated save, inspect and download without truncation',async()=>{
 const x=fixture({enabled:false,docxOnly:true});
 x.env.HHBA_MATCH_V4_READY='1';
 const proposed='虚构的长段落测试内容。'.repeat(2300);
 assert.ok(proposed.length>1600);
 assert.ok(new TextEncoder().encode(proposed).length>65536);
 const expected=await editOriginalDocxStrict(original,[{original:'测试用户',text:proposed}],{allowExpansion:true});
 const saved=await onRequestPost({request:req('export',{method:'POST',jobId:'long-v4-role',body:{
  resume_id:id,job_id:'long-v4-role',action:'edit',original:'测试用户',text:proposed,
  expected_revision:0,confirmed_real:true,consent_word_processing:true,
  client_docx_sha256:createHash('sha256').update(expected).digest('hex')
 }}),env:x.env});
 assert.equal(saved.status,200,await saved.clone().text());
 assert.equal((await saved.json()).revision,1);
 const inspection=await onRequestGet({request:req('inspect',{jobId:'long-v4-role'}),env:x.env});
 assert.ok((await inspection.json()).editable_text.includes(proposed));
 const download=await onRequestGet({request:req('download',{jobId:'long-v4-role'}),env:x.env});
 assert.deepEqual(new Uint8Array(await download.arrayBuffer()),expected);
 assert.deepEqual(x.saved.get(store),original);
});


test('V4 saves new real Word paragraphs and returns the exact downloaded private revision',async()=>{
 const x=fixture({enabled:false,docxOnly:true});x.env.HHBA_MATCH_V4_READY='1';
 const target='测试用户',text='测试用户\n虚构工作内容新增段落\n虚构工作成果新增段落';
 const info=await onRequestGet({request:req('inspect',{jobId:'multi-role'}),env:x.env});
 assert.ok((await info.json()).paragraph_text.includes(target));
 const expected=await editOriginalDocxStrict(original,[{original:target,text}],{allowExpansion:true});
 const response=await onRequestPost({request:req('export',{method:'POST',jobId:'multi-role',body:{
  resume_id:id,job_id:'multi-role',action:'edit',original:target,text,expected_revision:0,
  client_docx_sha256:createHash('sha256').update(expected).digest('hex'),
  confirmed_real:true,consent_word_processing:true
 }}),env:x.env});
 assert.equal(response.status,200,await response.clone().text());
 const download=await onRequestGet({request:req('download',{jobId:'multi-role'}),env:x.env});
 assert.deepEqual(new Uint8Array(await download.arrayBuffer()),expected);
 assert.deepEqual(x.saved.get(store),original);
 const inspect=await onRequestGet({request:req('inspect',{jobId:'multi-role'}),env:x.env});
 assert.ok((await inspect.json()).editable_text.includes('虚构工作成果新增段落'));
});
