// Remote, no-credential/no-PII HTTP acceptance. Does not invoke paid AI models.
import assert from 'node:assert/strict';
const root=process.env.HHBA_PREVIEW_URL?.replace(/\/$/,'');
if(!root||!/^https:\/\/[a-z0-9-]+\.hhba-talent\.pages\.dev$/i.test(root))
 throw Error('Provide an immutable Cloudflare Pages Preview URL');
const origin=new URL(root).origin;
const checks=[];
async function call(path,opts={}){
 const r=await fetch(root+path,{redirect:'manual',signal:AbortSignal.timeout(15000),...opts});
 const ct=r.headers.get('content-type')||'';
 const data=ct.includes('application/json')?await r.json().catch(()=>({})):null;
 checks.push({path,method:opts.method||'GET',status:r.status,
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
const old=await call('/api/preview-deepseek-diagnostic',{method:'GET'});
assert.equal(old.r.status,404,'retired diagnostic route must be absent from Preview');
console.log(JSON.stringify({result:'PASS',preview:origin,checks}));
