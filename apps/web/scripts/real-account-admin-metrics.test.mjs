import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {onRequestGet as realMetrics} from '../functions/api/admin/metrics.js';

const team='hhba-unit.cloudflareaccess.com',aud='admin-console-test-audience';
const email='admin@example.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'hhba-metrics-unit-key',alg:'RS256'};
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt(overrides={}){
 const now=Math.floor(Date.now()/1000);
 const payload={iss:'https://'+team,aud,email,iat:now-15,exp:now+300,...overrides};
 const data=b64({alg:'RS256',kid:jwk.kid,typ:'JWT'})+'.'+b64(payload);
 return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
}
function metricDb(){
 return {prepare(sql){
  return {bind(){
   return {all:async()=>({results:[]}),first:async()=>({n:0})};
  },first:async()=>sql.includes('metadata')?{value:'2026-11-01T00:00:00Z'}:{n:0}};
 }};
}
function authDb(n,throwError=false){
 return {prepare(sql){
  assert.match(sql,/FROM hhba_auth_users WHERE role='candidate'/);
  return {first:async()=>{if(throwError)throw Error('AUTH_DB_UNREACHABLE');return {n}}};
 }};
}
function env(n=17){
 return {
  HHBA_ACCESS_TEAM_DOMAIN:team,
  HHBA_ACCESS_CONSOLE_AUD:aud,
  HHBA_ACCESS_AUD:'legacy-api-audience',
  HHBA_METRICS_ADMIN_EMAIL:email,
  HHBA_METRICS_SECRET:'long-metrics-secret-at-least-32-characters-1234',
  HHBA_METRICS_DB:metricDb(),
  HHBA_PNVS_AUTH_DB:authDb(n)
 };
}
const path='https://hhba.work/admin-preview/api/metrics?days=1';
async function read(headers,envArg){
 const r=await realMetrics({request:new Request(path,{headers}),env:envArg});
 return {status:r.status,data:await r.json(),headers:r.headers};
}
test('protected original admin aggregates genuine PNVS registered candidate count and never invents DAU/MAU',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{
  const r=await read({'cf-access-jwt-assertion':jwt()},env(17));
  assert.equal(r.status,200);
  assert.equal(r.data.kind,'HHBA_CLOUDFLARE_PRIVATE_METRICS_V1');
  assert.equal(r.data.account.quality,'collected');
  assert.equal(r.data.account.registeredUsers,17);
  assert.equal(r.data.account.dau,null);
  assert.equal(r.data.account.mau,null);
  assert.equal(r.data.account.scope,'VERIFIED_PNVS_CANDIDATE_USERS_ONLY');
  assert.match(r.data.account.reason,/DAU\/MAU/);
  assert.doesNotMatch(JSON.stringify(r.data),/admin@example\.test/);
 }finally{globalThis.fetch=oldFetch;}
});
test('private account counts refuse unsigned and wrong-audience token, even with real D1 binding',async()=>{
 const noAuth=await read({},env(18));
 assert.equal(noAuth.status,403);
 const wrong=await read({'cf-access-jwt-assertion':jwt({aud:'legacy-api-audience'})},env(18));
 assert.equal(wrong.status,403);
});
test('missing/unreachable auth D1 never substitutes device UV for account count',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{
  const noDb=env(0);delete noDb.HHBA_PNVS_AUTH_DB;
  const a=await read({'cf-access-jwt-assertion':jwt()},noDb);
  assert.equal(a.status,200);
  assert.equal(a.data.account.quality,'not_connected');
  assert.equal(a.data.account.registeredUsers,null);
  const broken=env(5);broken.HHBA_PNVS_AUTH_DB=authDb(5,true);
  const b=await read({'cf-access-jwt-assertion':jwt()},broken);
  assert.equal(b.status,200);
  assert.equal(b.data.account.quality,'not_connected');
  assert.equal(b.data.account.registeredUsers,null);
 }finally{globalThis.fetch=oldFetch;}
});
