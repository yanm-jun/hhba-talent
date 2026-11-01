import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../functions/_lib/auth.js';
class DB {
 constructor(){this.users=new Map();this.roles=[];this.sessions=new Map();this.limits=new Map();this.codes=[];}
 prepare(sql){let a=[],db=this;
  const self={
   bind(...args){a=args;return self;},
   async run(){
    if(sql.startsWith('INSERT INTO auth_rate_limits')){const row=db.limits.get(a[0]);db.limits.set(a[0],{window_start:a[1],hits:row?row.hits+1:1});return {meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO auth_users')){const [id,email,password_salt,password_hash,password_iterations,display_name,email_verified_at,created_at]=a;db.users.set(email,{id,email,password_salt,password_hash,password_iterations,display_name,email_verified_at,created_at});return {meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO auth_roles')){db.roles.push({user_id:a[0],account_type:a[1]});return {meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO auth_email_challenges')){const [id,email,purpose,code_hash,expires_at,created_at]=a;db.codes.push({id,email,purpose,code_hash,expires_at,created_at,attempts:0,used_at:null});return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE auth_email_challenges SET attempts')){const c=db.codes.find(x=>x.id===a[0]);c.attempts++;return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE auth_email_challenges SET used_at')){const c=db.codes.find(x=>x.id===a[1]);if(c.used_at!==null)return {meta:{changes:0}};c.used_at=a[0];return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM auth_email_challenges')){db.codes=db.codes.filter(x=>x.id!==a[0]);return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE auth_users SET email_verified_at')){db.users.get(a[1]).email_verified_at=a[0];return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE auth_users SET password_salt')){const u=[...db.users.values()].find(x=>x.id===a[3]);Object.assign(u,{password_salt:a[0],password_hash:a[1],password_iterations:a[2]});return {meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO auth_sessions')){db.sessions.set(a[0],{token_hash:a[0],user_id:a[1],csrf_token:a[2],created_at:a[3],expires_at:a[4]});return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM auth_sessions WHERE user_id')){for(const [key,v] of db.sessions)if(v.user_id===a[0])db.sessions.delete(key);return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM auth_sessions WHERE token_hash')){db.sessions.delete(a[0]);return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM auth_roles')){db.roles=db.roles.filter(x=>x.user_id!==a[0]);return {meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM auth_users')){for(const [key,v] of db.users)if(v.id===a[0])db.users.delete(key);return {meta:{changes:1}};}
    throw Error('UNSUPPORTED RUN '+sql);
   },
   async first(){
    if(sql.startsWith('SELECT hits FROM auth_rate_limits'))return db.limits.get(a[0])||null;
    if(sql.startsWith('SELECT id FROM auth_users WHERE email=?'))return db.users.has(a[0])?{id:db.users.get(a[0]).id}:null;
    if(sql.startsWith('SELECT id,email_verified_at FROM auth_users')){const u=db.users.get(a[0]);return u?{id:u.id,email_verified_at:u.email_verified_at}:null;}
    if(sql.startsWith('SELECT id FROM auth_users WHERE email=? AND')){const u=db.users.get(a[0]);return u?.email_verified_at?{id:u.id}:null;}
    if(sql.startsWith('SELECT * FROM auth_users'))return db.users.get(a[0])||null;
    if(sql.startsWith('SELECT * FROM auth_email_challenges'))return db.codes.filter(x=>x.email===a[0]&&x.purpose===a[1]&&x.used_at===null).at(-1)||null;
    if(sql.startsWith('SELECT s.token_hash')){const s=db.sessions.get(a[0]);if(!s||s.expires_at<=a[1])return null;const u=[...db.users.values()].find(x=>x.id===s.user_id);return {...s,email:u.email,display_name:u.display_name,disabled_at:null};}
    throw Error('UNSUPPORTED FIRST '+sql);
   },
   async all(){if(sql.startsWith('SELECT account_type FROM auth_roles'))return {results:db.roles.filter(x=>x.user_id===a[0])};throw Error('UNSUPPORTED ALL '+sql);}
  };
  return self;
 }
 async batch(items){for(const x of items)await x.run();}
}
const root='https://verification.hhba-talent.pages.dev';
const call=(env,path,body,method='POST',headers={})=>route({env,request:new Request(root+'/api/v1/'+path,{method,headers:{'content-type':'application/json',origin:root,...headers},body:body?JSON.stringify(body):undefined})});
test('real Gmail registration is verification-gated and password recovery revokes sessions',async()=>{
 const db=new DB(),sent=[];
 const env={HHBA_AUTH_DB:db,HHBA_AUTH_ROLLOUT:'preview',HHBA_MAIL_FROM:'notifications@example.com',
  HHBA_AUTH_CODE_PEPPER:'testing-only-private-pepper-string-must-be-long',
  EMAIL:{send:async m=>{sent.push(m);return {messageId:'mock-'+sent.length}}}};
 const email='some-person@gmail.com',password='preview-only-long-password-2026';
 let r=await call(env,'auth/register',{email,password,display_name:'Test Individual',account_type:'candidate'});
 assert.equal(r.status,201);assert.equal((await r.json()).verification_required,true);
 r=await call(env,'auth/session',{email,password,account_type:'candidate'});assert.equal(r.status,403);
 assert.equal(sent[0].to,email);
 const code=sent[0].text.match(/\d{6}/)?.[0];assert.ok(code);
 r=await call(env,'auth/email/verify',{email,code});assert.equal(r.status,200);
 r=await call(env,'auth/email/verify',{email,code});assert.equal(r.status,400);
 r=await call(env,'auth/session',{email,password,account_type:'candidate'});assert.equal(r.status,200);
 assert.equal(db.sessions.size,1);
 r=await call(env,'auth/password/request',{email});assert.equal(r.status,200);
 const resetCode=sent.at(-1).text.match(/\d{6}/)?.[0];assert.ok(resetCode);
 r=await call(env,'auth/password/reset',{email,code:resetCode,password:'another-long-password-2026'});assert.equal(r.status,200);
 assert.equal(db.sessions.size,0);
 r=await call(env,'auth/session',{email,password,account_type:'candidate'});assert.equal(r.status,401);
 r=await call(env,'auth/session',{email,password:'another-long-password-2026',account_type:'candidate'});assert.equal(r.status,200);
});
