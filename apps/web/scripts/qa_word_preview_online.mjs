import assert from 'node:assert/strict';

const base=process.env.HHBA_WORD_PREVIEW_TEST_URL;
assert.match(base||'',/^https:\/\/[a-z0-9-]+\.hhba-talent\.pages\.dev$/,
 'Only a pinned, publicly deployed HHBA Preview is permitted');
const tests=[
 ['/api/resume-word?action=status','status'],
 ['/api/resume-word?action=source-docx&resume_id=00000000-0000-4000-8000-000000000000&job_id=synthetic-test','private'],
 ['/vendor/jszip.min.js','zip'],
 ['/vendor/docx-preview.min.js','preview'],
 ['/candidate/match','page']
];
const output=async(path)=>{
 const isPublicRoute=path==='/candidate/match';
 const response=await fetch(base+path,{method:'GET',
  redirect:isPublicRoute?'follow':'manual',
  cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(isPublicRoute){
  const final=new URL(response.url);
  assert.equal(final.origin,new URL(base).origin,'SPA must not leave the preview origin');
  assert.ok(final.pathname.startsWith('/candidate/match'),
   'SPA must remain on the candidate matcher route');
 }
 const type=response.headers.get('content-type')||'';
 const bytes=path.includes('vendor')?new Uint8Array(await response.arrayBuffer()):null;
 return {status:response.status,type,
  body:bytes?null:await response.text(),
  bytes:bytes?.length};
};
let pending='Preview is not responding with enabled Word capability';
for(let attempt=0;attempt<28;attempt++){
 try{
  const status=await output(tests[0][0]);
  if(status.status===200&&status.type.includes('application/json')){
   const json=JSON.parse(status.body);
   if(json.ok===true&&json.enabled===true&&json.docx_only_enabled===true&&
    json.renderer_enabled===false){pending='';break;}
   pending='Preview Word capability is not enabled yet: '+
    JSON.stringify({ok:json.ok,enabled:json.enabled,
     docx_only_enabled:json.docx_only_enabled,renderer_enabled:json.renderer_enabled});
  }else pending='Preview status HTTP '+status.status+' type='+status.type;
 }catch(error){pending=String(error).slice(0,180)}
 if(attempt<27)await new Promise(resolve=>setTimeout(resolve,12000));
}
assert.equal(pending,'','Preview never reached enabled DOCX-only status');
const privateResponse=await output(tests[1][0]);
assert.equal(privateResponse.status,401,'Anonymous users may not retrieve private source DOCX');
assert.ok(privateResponse.type.includes('application/json'),'Private route must reject with JSON not SPA HTML');
for(const [path,name] of tests.slice(2)){
 const response=await output(path);
 assert.equal(response.status,200,'Preview '+name+' must be available');
 if(name==='zip'||name==='preview'){
  assert.ok(response.bytes>=10000,'self-hosted document renderer must have real JS bytes: '+name);
  assert.ok(/(?:javascript|octet-stream)/i.test(response.type),'javascript content type required');
 }else{
  assert.ok(response.type.includes('text/html'),'candidate matcher should serve the SPA HTML');
  assert.ok(response.body.includes('html'),'candidate matcher is not a redirect or error');
 }
}
console.log('HHBA_REMOTE_WORD_PREVIEW_SMOKE_PASS',JSON.stringify({
 preview:base,docxOnlyEnabled:true,rendererEnabled:false,
 anonymousPrivateDocxStatus:privateResponse.status,
 staticAssets:['jszip','docx-preview'],candidateMatchShell:true,
 note:'HTTP smoke only; NOT a logged-in user DOCX save/download acceptance'
}));
