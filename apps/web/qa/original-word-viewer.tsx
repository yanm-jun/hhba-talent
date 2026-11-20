// Local-only fictional DOCX visual test; no user content or real credentials.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {OriginalWordViewer} from '../src/components/OriginalWordViewer';
import {REAL_AUTH_TOKEN_KEY} from '../src/services/realAuth';
import type {PrivateResume} from '../src/services/privateResumes';

if(import.meta.env.PROD)throw Error('Word synthetic fixture must not ship');
const id='11111111-2222-4333-8444-555555555555';
function pdfFor(text:string){
 const stream='BT /F1 18 Tf 45 760 Td ('+text+') Tj ET';
 const parts=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
 ];
 let output='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<parts.length;i++){
  offsets.push(output.length);
  output+=(i+1)+' 0 obj\n'+parts[i]+'\nendobj\n';
 }
 const xref=output.length;output+='xref\n0 6\n0000000000 65535 f \n';
 for(const start of offsets.slice(1))output+=String(start).padStart(10,'0')+' 00000 n \n';
 return new TextEncoder().encode(output+'trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+xref+'\n%%EOF');
}
const originalPdf=pdfFor('ORIGINAL WORD RESUME');
const editedPdf=pdfFor('EDITED WORD RESUME');
const resume:PrivateResume={id,name:'虚构原样式简历.docx',
 type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 size:2048,createdAt:'2026-11-20T00:00:00Z'};
let saved=false;
localStorage.setItem(REAL_AUTH_TOKEN_KEY,'word-synthetic-qa-token');
const genuine=window.fetch.bind(window);
window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,location.origin);
 if(url.pathname==='/api/resume-word'){
  const action=url.searchParams.get('action');
  if(action==='status')return Promise.resolve(Response.json({ok:true,enabled:true}));
  if(action==='inspect')return Promise.resolve(Response.json({
   ok:true,editable_text:saved?[]:['ORIGINAL WORD RESUME'],
   saved:saved?{original:'ORIGINAL WORD RESUME',text:'EDITED WORD RESUME',updated_at:'2026-11-20T00:00:00Z'}:null
  }));
  if(action==='preview'||action==='edited-preview'||action==='download-pdf')
   return Promise.resolve(new Response(action==='preview'?originalPdf:editedPdf,{
    status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(originalPdf.length)}
   }));
  if(action==='download'){
   const simulatedDocx=new Uint8Array(1250);
   simulatedDocx.set([80,75,3,4]); // Synthetic ZIP header for client-side signature guard.
   return Promise.resolve(new Response(simulatedDocx,{
    status:200,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
   }));
  }
  if(init?.method==='POST'){
   const request=JSON.parse(String(init.body||'{}'));
   if(request.confirmed_real!==true||request.consent_word_processing!==true)
    return Promise.resolve(Response.json({ok:false,error:'INVALID_REQUEST'},{status:400}));
   saved=true;
   return Promise.resolve(Response.json({ok:true,saved:true,page_count:1}));
  }
 }
 if(url.pathname==='/api/resumes/'+id+'/download')
  return Promise.resolve(new Response(new Uint8Array(2048),{
   status:200,headers:{'Content-Length':'2048'}
  }));
 return genuine(input,init);
}) as typeof window.fetch;
createRoot(document.getElementById('root')!).render(
 <div style={{maxWidth:760,margin:'18px auto'}}>
  <OriginalWordViewer resume={resume} onClose={()=>{}}/>
 </div>
);
