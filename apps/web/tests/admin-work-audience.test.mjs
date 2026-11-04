import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAdmin} from '../functions/_lib/admin-access.js';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const env={HHBA_ACCESS_TEAM_DOMAIN:'example.cloudflareaccess.com',HHBA_ACCESS_CONSOLE_AUD:'aud-pages',
 HHBA_ACCESS_WORK_ADMIN_AUD:'aud-work',HHBA_ACCESS_AUD:'aud-legacy',HHBA_METRICS_ADMIN_EMAIL:'owner@example.com'};
const jwt=aud=>{
 const t=Math.floor(Date.now()/1000);
 return b64({alg:'RS256',kid:'test'})+'.'+b64({iss:'https://example.cloudflareaccess.com',aud,iat:t,exp:t+3600,email:'owner@example.com'})+'.'+Buffer.from('not-signed').toString('base64url');
};
test('official admin rejects a pages.dev audience before fetching certificates',async()=>{
 const request=new Request('https://hhba.work/admin-preview/api/metrics',{headers:{'cf-access-jwt-assertion':jwt('aud-pages')}});
 const result=await verifyAdmin(request,env);
 assert.equal(result.ok,false);
 assert.equal(result.status,403);
});
test('pages.dev admin rejects a custom-domain audience before fetching certificates',async()=>{
 const request=new Request('https://hhba-talent.pages.dev/admin-preview/api/metrics',{headers:{'cf-access-jwt-assertion':jwt('aud-work')}});
 const result=await verifyAdmin(request,env);
 assert.equal(result.ok,false);
 assert.equal(result.status,403);
});
test('official admin requires explicit separate Access audience configuration',async()=>{
 const request=new Request('https://hhba.work/admin-preview/api/metrics');
 const result=await verifyAdmin(request,{...env,HHBA_ACCESS_WORK_ADMIN_AUD:undefined});
 assert.equal(result.ok,false);assert.equal(result.status,503);
});
