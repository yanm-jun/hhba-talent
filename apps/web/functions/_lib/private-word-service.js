// Private Cloudflare→HHBA Word renderer transport. Never expose document URLs.
export const WORD_MAX_BYTES=3*1024*1024;
const base64=(bytes)=>{
 let output='';
 for(let i=0;i<bytes.length;i+=8192)
  output+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(output);
};
export const configured=env=>{
 if(env?.HHBA_WORD_RENDER_ENABLED!=='1'||
  !(env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')||
  typeof env.HHBA_WORD_RENDER_SHARED_SECRET!=='string'||
  env.HHBA_WORD_RENDER_SHARED_SECRET.length<32||
  typeof env?.HHBA_MATCH_LIMIT_PEPPER!=='string'||
  env.HHBA_MATCH_LIMIT_PEPPER.length<24||
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function'||
  typeof env?.HHBA_PRIVATE_RESUMES?.get!=='function'||
  typeof env?.HHBA_PRIVATE_RESUMES?.put!=='function')return false;
 try{
  const url=new URL(env.HHBA_WORD_RENDER_ENDPOINT);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&
   url.pathname==='/'&&url.hostname.length>=4;
 }catch{return false;}
};
export async function wordRequest(env,action,{original,edited,oldText,newText,fetchImpl=fetch}){
 if(!configured(env))throw Error('WORD_RENDERER_NOT_CONFIGURED');
 if(!(original instanceof Uint8Array)||original.length<100||original.length>WORD_MAX_BYTES)
  throw Error('WORD_INVALID_FILE');
 const payload={original_b64:base64(original)};
 if(action==='verify'){
  if(!(edited instanceof Uint8Array)||edited.length<100||edited.length>WORD_MAX_BYTES||
   typeof oldText!=='string'||typeof newText!=='string')
   throw Error('WORD_INVALID_REQUEST');
  payload.edited_b64=base64(edited);
  payload.old_text=oldText;payload.new_text=newText;
 }else if(action!=='render')throw Error('WORD_INVALID_REQUEST');
 const url=new URL(action==='render'?'/v1/render':'/v1/verify',env.HHBA_WORD_RENDER_ENDPOINT);
 let response;
 try{
  response=await fetchImpl(url.href,{
   method:'POST',redirect:'manual',signal:AbortSignal.timeout(115000),
   headers:{'Content-Type':'application/json',
    Authorization:'Bearer '+env.HHBA_WORD_RENDER_SHARED_SECRET},
   body:JSON.stringify(payload)
  });
 }catch{throw Error('WORD_RENDER_FAILED');}
 if(response.status>=300&&response.status<400)throw Error('WORD_RENDER_FAILED');
 if(!response.ok){
  // Forward only known, non-sensitive format-fidelity error codes.
  // The renderer must not leak document content, arbitrary network details,
  // URLs, or internal stack traces into candidate-facing responses.
  if(response.status===422){
   const body=await response.json().catch(()=>null);
   if(['WORD_FONT_UNAVAILABLE','WORD_FONT_UNVERIFIED',
    'WORD_LAYOUT_MOVED','WORD_TEXT_NOT_VERIFIED'].includes(body?.error))
    throw Error(body.error);
  }
  throw Error('WORD_RENDER_FAILED');
 }
 if(action==='render'){
  const contentType=response.headers.get('Content-Type')||'';
  if(!contentType.startsWith('application/pdf'))throw Error('WORD_RENDER_FAILED');
  const declared=response.headers.get('Content-Length');
  if(declared!==null&&Number(declared)>12*1024*1024)throw Error('WORD_RENDER_FAILED');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<500||bytes.length>12*1024*1024||
   bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70)
   throw Error('WORD_RENDER_FAILED');
  return bytes;
 }
 let body;
 try{body=await response.json();}catch{throw Error('WORD_LAYOUT_NOT_VERIFIED');}
 const report=body?.report;
 if(body?.ok!==true||body.verified!==true||report?.passed!==true||
  !Number.isInteger(report.page_count)||report.page_count<1||report.page_count>20||
  !Number.isInteger(report.changed_pixels)||report.changed_pixels<5||
  !Number.isInteger(report.changed_region?.page)||
  report.changed_region.page<1||report.changed_region.page>report.page_count)
  throw Error('WORD_LAYOUT_NOT_VERIFIED');
 return report;
}
