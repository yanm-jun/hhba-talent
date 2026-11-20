// QA-only owner-scoped synthetic endpoint wrapper around a real embedded
// Chinese-font original. No credentials, uploaded user files or production DB.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {OriginalResumeViewer} from '../src/components/OriginalResumeViewer';
import type {PrivateResume} from '../src/services/privateResumes';
import {REAL_AUTH_TOKEN_KEY} from '../src/services/realAuth';

if(import.meta.env.PROD)throw Error('Chinese-font synthetic QA may not ship');
const actualFetch=window.fetch.bind(window);
const response=await actualFetch('/qa/generated-cjk-original.pdf');
if(!response.ok)throw Error('Chinese PDF QA fixture missing');
const bytes=new Uint8Array(await response.arrayBuffer());
const id='11111111-2222-4333-8444-666666666666';
const resume:PrivateResume={id,name:'虚构中文经历简历.pdf',
 type:'application/pdf',size:bytes.byteLength,
 createdAt:'2026-11-20T00:00:00.000Z'};
localStorage.setItem(REAL_AUTH_TOKEN_KEY,'synthetic-cjk-qa-session');
let savedChanges:any[]=[];
const text='中国测试工作经历';
const layout={
 schema:'HHBA_RESUME_VISUAL_LAYOUT_V1',
 source_sha256:'b'.repeat(64),format:'pdf',page_count:1,
 regions:[{id:'p1-r1',page:1,kind:'experience',
  text,bbox:[55,55,490,85],confidence:.98,placement_verified:false}],
 reading_order:[0],needs_review:true,editable_in_original:false
};
const asJson=(value:unknown)=>Promise.resolve(new Response(JSON.stringify(value),
 {status:200,headers:{'Content-Type':'application/json'}}));
window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,location.origin);
 if(url.pathname==='/api/resume-layout'){
  if(init?.method==='POST')return asJson({ok:true,cached:true,layout});
  return asJson({enabled:true,formats:['pdf'],word_conversion_ready:false});
 }
 if(url.pathname==='/api/resume-page-edits'){
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body||'{}'));
   savedChanges=(body.changes||[]).map((item:any)=>({...item,page:1}));
   return asJson({ok:true,changes:savedChanges,updated_at:'2026-11-20T00:00:00Z'});
  }
  return asJson({ok:true,changes:savedChanges});
 }
 if(url.pathname==='/api/resumes/'+id+'/download')
  return Promise.resolve(new Response(new Uint8Array(bytes),{status:200,headers:{
   'Content-Type':'application/octet-stream',
   'Content-Length':String(bytes.byteLength)
  }}));
 return actualFetch(input,init);
}) as typeof window.fetch;
createRoot(document.getElementById('root')!).render(
 <div style={{maxWidth:760,margin:'20px auto'}}>
  <OriginalResumeViewer resume={resume} onClose={()=>{}}/>
 </div>
);
