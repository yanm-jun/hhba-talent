// Dev-only synthetic PDF viewer QA. This never ships to production or uses PII.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {OriginalResumeViewer} from '../src/components/OriginalResumeViewer';
import type {PrivateResume} from '../src/services/privateResumes';
import {REAL_AUTH_TOKEN_KEY} from '../src/services/realAuth';

function fakePdf(){
 const stream='BT /F1 18 Tf 45 760 Td (ORIGINAL RESUME VIEW) Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
 ];
 let source='%PDF-1.4\n';const offset=[0];
 for(const [i,item] of objects.entries()){
  offset.push(source.length);
  source+=(i+1)+' 0 obj\n'+item+'\nendobj\n';
 }
 const xref=source.length;
 source+='xref\n0 6\n0000000000 65535 f \n';
 for(const pos of offset.slice(1))source+=String(pos).padStart(10,'0')+' 00000 n \n';
 source+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new TextEncoder().encode(source);
}
if(import.meta.env.PROD)throw Error('synthetic PDF QA must never ship to production');
const bytes=fakePdf();
const resume:PrivateResume={
 id:'11111111-2222-4333-8444-555555555555',
 name:'虚构测试简历.pdf',type:'application/pdf',size:bytes.length,
 createdAt:'2026-11-19T00:00:00.000Z'
};
localStorage.setItem(REAL_AUTH_TOKEN_KEY,'synthetic-browser-qa-token');
const original=window.fetch.bind(window);
let savedChanges:any[]=[];
const sampleLayout={
 schema:'HHBA_RESUME_VISUAL_LAYOUT_V1',
 source_sha256:'a'.repeat(64),format:'pdf',page_count:1,
 regions:[{id:'p1-r1',page:1,kind:'experience',
  text:'ORIGINAL RESUME VIEW',bbox:[55,55,530,80],
  confidence:.98,placement_verified:false}],
 reading_order:[0],needs_review:true,editable_in_original:false
};
const asJson=(value:unknown)=>Promise.resolve(new Response(JSON.stringify(value),
 {status:200,headers:{'Content-Type':'application/json'}}));

window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,location.origin);
 if(url.pathname==='/api/resume-layout'){
  if(init?.method==='POST')return asJson({ok:true,cached:false,layout:sampleLayout});
  return asJson({kind:'HHBA_RESUME_VISUAL_LAYOUT_V1',enabled:true,formats:['pdf'],word_conversion_ready:false});
 }
 if(url.pathname==='/api/resume-page-edits'){
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body||'{}'));
   savedChanges=(body.changes||[]).map((c:any)=>({...c,page:1}));
   return asJson({ok:true,changes:savedChanges,updated_at:'2026-11-20T00:00:00Z'});
  }
  return asJson({ok:true,changes:savedChanges});
 }
 if(url.pathname==='/api/resumes/'+resume.id+'/download')
  return Promise.resolve(new Response(bytes,{status:200,headers:{
   'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)
  }}));
 return original(input,init);
}) as typeof window.fetch;
createRoot(document.getElementById('root')!).render(
 <div style={{maxWidth:760,margin:'20px auto'}}>
  <OriginalResumeViewer resume={resume} onClose={()=>{}}/>
 </div>
);
