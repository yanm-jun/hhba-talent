import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../functions/_lib/auth.js';
class Db {
 constructor(){this.users=new Map();this.roles=[];this.sessions=new Map();this.limits=new Map();}
 prepare(sql){const db=this;let a=[];
  return {bind(...values){a=values;return this},async run(){
   if(sql.startsWith('INSERT INTO auth_rate_limits')){const [key,ts,cutoff]=a;const old=db.limits.get(key);db.limits.set(key,{hits:old&&old.window_start>=cutoff?old.hits+1:1,window_start:old&&old.window_start>=cutoff?old.window_start:ts});return {};}
   if(sql.startsWith('INSERT INTO auth_users')){const [id,email,salt,hash,iterations,name,verifiedAt,ts]=a;if(db.users.has(email))throw Error('unique');db.users.set(email,{id,email,password_salt:salt,password_hash:hash,password_iterations:iterations,display_name:name,email_verified_at:verifiedAt,created_at:ts});return {};}
   if(sql.startsWith('INSERT INTO auth_roles')){const [id,account_type]=a;db.roles.push({user_id:id,account_type});return {};}
   if(sql.startsWith('INSERT INTO auth_sessions')){const [hash,id,csrf,created,expires]=a;db.sessions.set(hash,{token_hash:hash,user_id:id,csrf_token:csrf,created_at:created,expires_at:expires});return {};}
   if(sql.startsWith('DELETE FROM auth_sessions')){db.sessions.delete(a[0]);return {};}
   throw Error('unexpected run: '+sql);
  },async first(){
   if(sql.startsWith('SELECT hits FROM auth_rate_limits'))return db.limits.get(a[0])||null;
   if(sql.startsWith('SELECT id FROM auth_users'))return db.users.has(a[0])?{id:db.users.get(a[0]).id}:null;
   if(sql.startsWith('SELECT * FROM auth_users'))return db.users.get(a[0])||null;
   if(sql.startsWith('SELECT s.token_hash')){const session=db.sessions.get(a[0]);if(!session||session.expires_at<=a[1])return null;const user=[...db.users.values()].find(u=>u.id===session.user_id);return {...session,email:user.email,display_name:user.display_name,disabled_at:null};}
   throw Error('unexpected first: '+sql);
  },async all(){
   if(sql.startsWith('SELECT account_type FROM auth_roles'))return {results:db.roles.filter(x=>x.user_id===a[0])};
   throw Error('unexpected all: '+sql);
  }};
 }
 async batch(items){for(const x of items)await x.run();}
}
const db=new Db(),host='https://auth-preview.hhba-talent.pages.dev';
const ctx=(path,method='GET',body,extra={})=>({env:{HHBA_AUTH_DB:db,HHBA_AUTH_ROLLOUT:'preview'},request:new Request(host+path,{method,headers:{origin:host,'content-type':'application/json',...extra},body:body?JSON.stringify(body):undefined})});
test('candidate registration, recruiter role denial, session restore and CSRF-protected logout',async()=>{
 const registration=await route(ctx('/api/v1/auth/register','POST',{email:'candidate@example.test',display_name:'Candidate',password:'long-example-password-2026',account_type:'candidate'}));
 assert.equal(registration.status,201);
 assert.equal(db.users.size,1);
 const mismatch=await route(ctx('/api/v1/auth/session','POST',{email:'candidate@example.test',password:'long-example-password-2026',account_type:'recruiter'}));
 assert.equal(mismatch.status,403);
 const login=await route(ctx('/api/v1/auth/session','POST',{email:'candidate@example.test',password:'long-example-password-2026',account_type:'candidate'}));
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrf_token;
 assert.match(login.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
 const me=await route(ctx('/api/v1/auth/me','GET',null,{cookie}));
 assert.equal(me.status,200);
 assert.deepEqual((await me.json()).account_types,['candidate']);
 assert.equal((await route(ctx('/api/v1/auth/session','DELETE',null,{cookie}))).status,403);
 assert.equal((await route(ctx('/api/v1/auth/session','DELETE',null,{cookie,'x-csrf-token':csrf}))).status,200);
 assert.equal((await route(ctx('/api/v1/auth/me','GET',null,{cookie}))).status,401);
});
test('isolated recruiter account and unverified email guardrails',async()=>{
 const r=await route(ctx('/api/v1/auth/register','POST',{email:'company@example.test',display_name:'Recruiter',password:'other-long-password-2026',account_type:'recruiter'}));
 assert.equal(r.status,201);
 assert.equal((await route(ctx('/api/v1/auth/session','POST',{email:'company@example.test',password:'other-long-password-2026',account_type:'candidate'}))).status,403);
 assert.equal((await route(ctx('/api/v1/auth/register','POST',{email:'user@real.com',display_name:'Real',password:'not-for-testing',account_type:'candidate'}))).status,403);
 assert.equal((await route(ctx('/api/v1/auth/register','POST',{email:'attacker@example.test',display_name:'Other',password:'long-example-password-2026',account_type:'candidate'},{origin:'https://attacker.invalid'}))).status,403);
 const prod={env:{HHBA_AUTH_DB:db,HHBA_AUTH_ROLLOUT:'preview'},request:new Request('https://hhba-talent.pages.dev/api/v1/auth/me')};
 assert.equal((await route(prod)).status,503);
});
