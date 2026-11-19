// Remote, no-credential/no-PII HTTP acceptance. Does not invoke paid AI models.
import assert from 'node:assert/strict';
const root=process.env.HHBA_PREVIEW_URL?.replace(/\/$/,'');
if(!root||!/^https:\/\/[a-z0-9-]+\.hhba-talent\.pages\.dev$/i.test(root))
 throw Error('Provide an immutable Cloudflare Pages Preview URL');
const origin=new URL(root).origin;
const checks=[];
async function call(path,opts={}){
 let address=new URL(path,root),r;
 for(let i=0;i<3;i++){
  r=await fetch(address,{redirect:'manual',signal:AbortSignal.timeout(15000),...opts});
  // Pages may canonicalize SPA paths by adding a trailing slash. Only GET
  // is permitted to follow redirects, and NEVER outside the immutable Preview.
  if((opts.method||'GET')!=='GET'||![301,302,307,308].includes(r.status))break;
  const location=r.headers.get('location');
  if(!location)break;
  const next=new URL(location,address);
  assert.equal(next.origin,origin,'Preview must not redirect to the production website');
  address=next;
 }
 const ct=r.headers.get('content-type')||'';
 const data=ct.includes('application/json')?await r.json().catch(()=>({})):null;
 checks.push({path,method:opts.method||'GET',status:r.status,finalPath:address.pathname,
  kind:data?.kind||null,error:data?.error||null});
 return {r,data};
}
const page=await call('/candidate/match');
assert.equal(page.r.status,200,`matching route returned ${page.r.status}; redirect=${page.r.headers.get('location')||'none'}`);
const expected=[
 ['/api/resume-optimize','HHBA_RESUME_OPTIMIZATION_V1'],
 ['/api/resume-reassess','HHBA_RESUME_REASSESS_V2'],
 ['/api/official-job-verify','HHBA_OFFICIAL_JOB_VERIFY_V1']
];
for(const [path,kind] of expected){
 const x=await call(path);
 assert.equal(x.r.status,200,path+' status must respond');
 assert.equal(x.data?.kind,kind,path+' must run the deployed Pages Function');
 assert.equal(x.data?.enabled,true,path+' must be enabled in isolated Preview');
}
for(const item of [
 ['/api/resume-optimize',{consent_ai:true,blocks:[{id:'source-0',section:'summary',text:'虚构合成测试工作经历'}],job:{title:'QA运营',requirements:'日常管理'}}],
 ['/api/resume-versions',{job_id:'qa-preview',job_title:'QA运营',company:'虚构测试企业',blocks:[{id:'source-0',section:'summary',text:'虚构合成测试工作经历'}],accepted_ids:[],confirmed_real:true}],
 ['/api/resume-reassess',{job_id:'verified-official-00000000000000000000000000000000',consent_reassessment:true,confirm_real:true}],
 ['/api/official-job-verify',{official_url:'https://example.invalid',consent_verify:true}]
]){
 const [path,body]=item;
 const x=await call(path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':'same-origin'},body:JSON.stringify(body)});
 assert.equal(x.r.status,401,'unauthenticated POST cannot access '+path);
 assert.equal(x.data?.error,'SESSION_INVALID',path+' must reject anonymous users');
}
const retired=await call('/api/preview-deepseek-diagnostic',{method:'GET'});
// SPA fallbacks return HTML/200 for unknown routes; neither this nor 404 means
// the removed API handler exists. An active probe would return structured JSON.
assert.ok(retired.r.status===404||(retired.r.status===200&&
 (retired.r.headers.get('content-type')||'').includes('text/html')),
 'retired diagnostic API must be absent, not an active JSON endpoint');
assert.notEqual(retired.data?.kind,'HHBA_PREVIEW_DEEPSEEK_DIAGNOSTIC_V1');
console.log(JSON.stringify({result:'PASS',preview:origin,checks}));
