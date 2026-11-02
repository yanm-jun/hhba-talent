import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyAdmin} from '../functions/_lib/admin-access.js';

const team='hhba-test.cloudflareaccess.com';
const email='owner@example.com';
const consoleAud='console-test-audience';
const apiAud='api-test-audience';
const env={
 HHBA_ACCESS_TEAM_DOMAIN:team,
 HHBA_ACCESS_CONSOLE_AUD:consoleAud,
 HHBA_ACCESS_AUD:apiAud,
 HHBA_METRICS_ADMIN_EMAIL:email
};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'unit-test-key',alg:'RS256'};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function token(aud,user=email,override={}){
 const now=Math.floor(Date.now()/1000);
 const payload={iss:'https://'+team,aud,email:user,iat:now-60,exp:now+600,...override};
 const data=b64({alg:'RS256',kid:jwk.kid,typ:'JWT'})+'.'+b64(payload);
 return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
}
function request(path,jwt){
 const headers=jwt?{'cf-access-jwt-assertion':jwt}:{};
 return new Request('https://hhba-talent.pages.dev'+path,{headers});
}
test('original admin and legacy API require route-specific, signed Cloudflare Access JWTs',async()=>{
 const priorFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{
  const admin='/admin-preview/api/metrics',legacy='/api/admin/metrics';
  for(const [path,aud] of [[admin,consoleAud],[legacy,apiAud]]){
   assert.equal((await verifyAdmin(request(path,token(aud)),env)).ok,true);
   assert.equal((await verifyAdmin(request(path),env)).status,403);
   assert.equal((await verifyAdmin(request(path,token(aud,'other@example.com')),env)).status,403);
   const parts=token(aud).split('.');
   parts[1]=b64({...JSON.parse(Buffer.from(parts[1],'base64url').toString()),email:'attacker@example.com'});
   assert.equal((await verifyAdmin(request(path,parts.join('.')),env)).ok,false);
   const broken=token(aud).split('.');
   const bytes=Buffer.from(broken[2],'base64url');bytes[0]^=1;
   broken[2]=bytes.toString('base64url');
   assert.equal((await verifyAdmin(request(path,broken.join('.')),env)).status,403);
   assert.equal((await verifyAdmin(request(path,token(aud,email,{exp:Math.floor(Date.now()/1000)-1})),env)).status,403);
  }
  assert.equal((await verifyAdmin(request(admin,token(apiAud)),env)).status,403);
  assert.equal((await verifyAdmin(request(legacy,token(consoleAud)),env)).status,403);
  assert.equal((await verifyAdmin(request(admin,token(consoleAud)),{...env,HHBA_ACCESS_CONSOLE_AUD:''})).status,503);
  assert.equal((await verifyAdmin(request('/candidate/jobs',token(consoleAud)),env)).status,403);
 }finally{globalThis.fetch=priorFetch;}
});
