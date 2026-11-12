import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sha256,handleConsoleAuth,verifyPasswordAdmin,SESSION_SECONDS,PASSWORD_ITERATIONS} from '../functions/_lib/console-password.js';

const ownerEmail='owner@example.com';
const b64=b=>Buffer.from(b).toString('base64url');
function database(){
 let account=null;
 const sessions=new Map(),limits=new Map();
 const db={sessions,limits,
  prepare(sql){return {args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.startsWith('SELECT * FROM hhba_console_owner'))return account;
    if(sql.startsWith('SELECT s.owner_id')){const s=sessions.get(this.args[0]);return s&&s.expires_at>Math.floor(Date.now()/1000)?{owner_id:'owner',expires_at:s.expires_at,email:ownerEmail}:null}
    if(sql.startsWith('SELECT failures'))return limits.get(this.args[0])||null;
    return null;
   },
   async run(){
    const a=this.args;
    if(sql.startsWith('INSERT OR IGNORE INTO hhba_console_owner')){
     if(account)return {meta:{changes:0}};
     account={id:a[0],username:'huifanghhba001',email:a[1],salt_b64:a[2],hash_b64:a[3],iterations:a[4],created_at:a[5],updated_at:a[6]};return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO hhba_console_sessions')){sessions.set(a[0],{expires_at:a[2],owner_id:a[1]});return {meta:{changes:1}}}
    if(sql.startsWith('DELETE FROM hhba_console_sessions WHERE token_hash')){sessions.delete(a[0]);return {meta:{changes:1}}}
    if(sql.startsWith('DELETE FROM hhba_console_login_limits')){limits.delete(a[0]);return {meta:{changes:1}}}
    if(sql.startsWith('INSERT INTO hhba_console_login_limits')){
     const old=limits.get(a[0])||{failures:0,lock_until:0,updated_at:0};
     const fresh=old.updated_at<a[2],failures=fresh?1:old.failures+1;
     limits.set(a[0],{failures,lock_until:!fresh&&old.failures>=6?a[4]:0,updated_at:a[5]});return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE hhba_console_owner SET')){account.salt_b64=a[0];account.hash_b64=a[1];account.iterations=a[2];return {meta:{changes:1}}}
    if(sql.startsWith('DELETE FROM hhba_console_sessions WHERE owner_id')){sessions.clear();return {meta:{changes:1}}}
    throw Error('unknown SQL '+sql);
   }
  }},
  async batch(statements){return Promise.all(statements.map(s=>s.run()))}
 };
 return db;
}
const origin='https://admin.hhba.work';
function req(path,method='GET',body,session){
 const headers={};if(method==='POST'){headers['Content-Type']='application/json';headers.Origin=origin;headers['Sec-Fetch-Site']='same-origin';headers['CF-Connecting-IP']='192.0.2.45'}
 if(session)headers.Cookie=session;
 return new Request(origin+path,{method,headers,body:method==='POST'?JSON.stringify(body):undefined});
}
function env(db,hash,expires){return {HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_DB:db,
 HHBA_METRICS_ADMIN_EMAIL:ownerEmail,HHBA_ADMIN_SETUP_SHA256:hash,HHBA_ADMIN_SETUP_EXPIRES:String(expires)}}
const token=b64(randomBytes(32));
const expiry=()=>Math.floor(Date.now()/1000)+3600;
test('owner setup is one-time, requires secure invite and hashes password before storage',async()=>{
 const db=database(),e=env(db,await sha256(token),expiry());
 const wrong=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{token:'x'.repeat(43),password:'SaferKey#1234Secret'}),env:e},'setup');
 assert.equal(wrong.status,403);
 const short=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{token,password:'123'}),env:e},'setup');
 assert.equal(short.status,400);
 const ok=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{token,password:'SaferKey#1234Secret'}),env:e},'setup');
 assert.equal(ok.status,200);
 const cookie=ok.headers.get('set-cookie');assert.match(cookie,/__Host-hhba_admin=/);
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 assert.match(cookie,new RegExp('Max-Age='+SESSION_SECONDS));
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/', 'GET',undefined,cookie.split(';')[0]),e)).ok,true);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/'),e)).status,401);
 const second=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{token,password:'AnotherStrongPassword#1234'}),env:e},'setup');
 assert.equal(second.status,409);
 const logout=await handleConsoleAuth({request:req('/api/console-auth/logout','POST',{},cookie.split(';')[0]),env:e},'logout');
 assert.equal(logout.status,200);
 assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/', 'GET',undefined,cookie.split(';')[0]),e)).status,401);
 const wrongUser=await handleConsoleAuth({request:req('/api/console-auth/login','POST',{username:'admin',password:'SaferKey#1234Secret'}),env:e},'login');
 assert.equal(wrongUser.status,401,'former default admin username must no longer work');
 const wrongPass=await handleConsoleAuth({request:req('/api/console-auth/login','POST',{username:'huifanghhba001',password:'wrong-password'}),env:e},'login');
 assert.equal(wrongPass.status,401);
 const login=await handleConsoleAuth({request:req('/api/console-auth/login','POST',{username:'huifanghhba001',password:'SaferKey#1234Secret'}),env:e},'login');
 assert.equal(login.status,200);
 const c=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/', 'GET',undefined,c),e)).ok,true);
 const changed=await handleConsoleAuth({request:req('/api/console-auth/change','POST',{password:'SaferKey#1234Secret',newPassword:'NewSuperSecure#2026!!'},c),env:e},'change');
 assert.equal(changed.status,200);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/', 'GET',undefined,c),e)).status,401);
});
test('expired bootstrap and cross-origin posts cannot create owner',async()=>{
 const db=database(),e=env(db,await sha256(token),Math.floor(Date.now()/1000)-1);
 const exp=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{token,password:'MySecurePassword#2026!!'}),env:e},'setup');
 assert.equal(exp.status,403);
 const bad=new Request(origin+'/api/console-auth/setup',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:JSON.stringify({token,password:'MySecurePassword#2026!!'})});
 assert.equal((await handleConsoleAuth({request:bad,env:e},'setup')).status,403);
});
test('password session is host-only, never authenticates other HHBA domains',async()=>{
 const e=env(database(),await sha256(token),expiry());
 assert.equal((await verifyPasswordAdmin(new Request('https://hhba.work/admin-preview/'),e)).status,401);
 assert.equal((await verifyPasswordAdmin(new Request('https://hhba-admin-console.pages.dev/admin-preview/'),e)).status,401);
});

test('Cloudflare Workers PBKDF2 100,000 iteration ceiling is respected during account setup',()=>{
 assert.equal(PASSWORD_ITERATIONS,100000);
});


test('KV administrator login/session survives complete D1 read outage',async()=>{
 const entries=new Map();
 const kv={
  async get(key,type){const x=entries.get(key);return x===undefined?null:(type==='json'?JSON.parse(x):x)},
  async put(key,value){entries.set(key,value)},
  async delete(key){entries.delete(key)}
 };
 const outage={prepare(){throw Error("Your account has exceeded D1's free tier daily row read limit")}};
 const freshToken=b64(randomBytes(32));
 const configuredEnv={...env(outage,await sha256(freshToken),expiry()),
  HHBA_ADMIN_AUTH_MODE:'kv',HHBA_ADMIN_AUTH_KV:kv};
 const setup=await handleConsoleAuth({request:req('/api/console-auth/setup','POST',{
  token:freshToken,password:'SafeOwnPassword#2468'
 }),env:configuredEnv},'setup');
 assert.equal(setup.status,200,'password bootstrap must not touch D1');
 assert.equal((await handleConsoleAuth({request:req('/api/console-auth/status'),env:configuredEnv},'status')).status,200);
 const firstCookie=setup.headers.get('set-cookie')?.split(';')[0];
 assert.ok(firstCookie);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/','GET',undefined,firstCookie),configuredEnv)).ok,true);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/','GET',undefined,'__Host-hhba_admin=bogus'),configuredEnv)).status,401);
 const exit=await handleConsoleAuth({request:req('/api/console-auth/logout','POST',{},firstCookie),env:configuredEnv},'logout');
 assert.equal(exit.status,200);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/','GET',undefined,firstCookie),configuredEnv)).status,401);
 const wrong=await handleConsoleAuth({request:req('/api/console-auth/login','POST',{
  username:'huifanghhba001',password:'wrong'
 }),env:configuredEnv},'login');
 assert.equal(wrong.status,401);
 const login=await handleConsoleAuth({request:req('/api/console-auth/login','POST',{
  username:'huifanghhba001',password:'SafeOwnPassword#2468'
 }),env:configuredEnv},'login');
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/','GET',undefined,cookie),configuredEnv)).ok,true);
 const rotate=await handleConsoleAuth({request:req('/api/console-auth/change','POST',{
  password:'SafeOwnPassword#2468',newPassword:'AnotherSafeSecret#2468'
 },cookie),env:configuredEnv},'change');
 assert.equal(rotate.status,200);
 assert.equal((await verifyPasswordAdmin(req('/admin-preview/','GET',undefined,cookie),configuredEnv)).status,401,'old sessions must be invalidated after password change');
});
test('KV-only security mode fails closed instead of silently falling back to D1',async()=>{
 const e={...env(database(),await sha256(token),expiry()),HHBA_ADMIN_AUTH_MODE:'kv'};
 const r=await handleConsoleAuth({request:req('/api/console-auth/status'),env:e},'status');
 assert.equal(r.status,404);
});
