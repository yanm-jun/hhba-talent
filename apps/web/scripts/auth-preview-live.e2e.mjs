import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// Synthetic-only tests against a fixed immutable Cloudflare Pages preview.
// Do not send real account data, and do not log passwords or cookies.
const root=process.argv[2];
assert(root&&/^https:\/\/[a-f0-9]{8}\.hhba-talent\.pages\.dev$/.test(root),'requires immutable HHBA preview host');
const stamp=randomUUID().slice(0,12),pass='HHBA-PREVIEW-ONLY-'+randomUUID()+'!';
async function call(path,method='GET',data,headers={}){
 const result=await fetch(root+path,{method,headers:{origin:root,'content-type':'application/json',...headers},body:data?JSON.stringify(data):undefined,redirect:'manual'});
 const body=await result.json().catch(()=>null);
 return {status:result.status,body,cookie:result.headers.get('set-cookie')?.split(';')[0]};
}
const status=await call('/api/v1/auth/status');
assert.equal(status.status,200,'status endpoint unavailable');
assert.equal(status.body.preview_test_email_enabled,true);
assert.equal(status.body.email_delivery_configured,false,'No real sender should be configured in this isolated test');
assert.equal((await call('/api/v1/auth/me')).status,401);
for(const role of ['candidate','recruiter']){
 const email='ci-'+stamp+'-'+role+'@example.test';
 const register=await call('/api/v1/auth/register','POST',{email,password:pass,display_name:'SyntheticCI',account_type:role});
 assert.equal(register.status,201,role+' registration failed '+register.status+' '+String(register.body?.detail||'').slice(0,180));
 assert.equal(register.body.email_verified,true);
 const other=role==='candidate'?'recruiter':'candidate';
 assert.equal((await call('/api/v1/auth/session','POST',{email,password:pass,account_type:other})).status,403,'cross-role denial');
 const login=await call('/api/v1/auth/session','POST',{email,password:pass,account_type:role});
 assert.equal(login.status,200,'login '+role);
 assert.match(login.cookie||'',/__Host-hhba_session=[a-f0-9]{64}/);
 const profile=await call('/api/v1/auth/me','GET',null,{cookie:login.cookie});
 assert.equal(profile.status,200);
 assert(profile.body.account_types.includes(role));
 assert.equal(profile.body.email_verified,true);
 assert.equal((await call('/api/v1/auth/session','DELETE',null,{cookie:login.cookie})).status,403);
 const logout=await call('/api/v1/auth/session','DELETE',null,{cookie:login.cookie,'x-csrf-token':login.body.csrf_token});
 assert.equal(logout.status,200);
 assert.equal((await call('/api/v1/auth/me','GET',null,{cookie:login.cookie})).status,401);
 console.log('HHBA_EMAIL_AUTH_E2E_OK',role);
}
for(const domain of ['qq.com','163.com','gmail.com']){
 const register=await call('/api/v1/auth/register','POST',{email:'ci-'+stamp+'@'+domain,password:pass,display_name:'SyntheticCI',account_type:'candidate'});
 assert.equal(register.status,503,domain+' must not collect credentials before mail service ready');
}
console.log('HHBA_EMAIL_AUTH_E2E_PROVIDER_GUARD_OK');
