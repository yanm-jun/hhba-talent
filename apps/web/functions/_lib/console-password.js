// HHBA standalone administrator password sessions. Only used on admin.hhba.work.
export const ADMIN_HOST='admin.hhba.work';
export const COOKIE='__Host-hhba_admin';
export const SESSION_SECONDS=7*24*60*60;
// Workers WebCrypto PBKDF2 deriveBits rejects iteration counts above 100,000.
export const PASSWORD_ITERATIONS=100000;
const encoder=new TextEncoder();
const utf8=v=>encoder.encode(v);
const now=()=>Math.floor(Date.now()/1000);
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const base64url=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=x=>Uint8Array.from(atob(String(x).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(x).length/4)*4,'=')),s=>s.charCodeAt(0));
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
export const isConsoleHost=request=>new URL(request.url).hostname===ADMIN_HOST;
export const noStore={'Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
export function authJson(obj,status=200,headers={}){
 return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json;charset=utf-8',...noStore,...headers}});
}
export function authError(code,status=401){return authJson({ok:false,error:code},status)}
export function tokenCookie(token,maxAge=SESSION_SECONDS){
 return COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;
}
export function clearCookie(){return tokenCookie('',0)}
function strongPassword(p){
 if(typeof p!=='string'||p.length<14||p.length>128||p.trim()!==p)return false;
 if(/[\u0000-\u001f\u007f]/.test(p)||/^(.)\1{13,}$/.test(p))return false;
 if(/^(?:password|123456789|admin|qwerty)/i.test(p))return false;
 return true;
}
export function hasOrigin(request){
 const expected='https://'+ADMIN_HOST;
 const origin=request.headers.get('Origin');
 const site=request.headers.get('Sec-Fetch-Site');
 return origin===expected&&(!site||site==='same-origin')&&request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json');
}
export async function sha256(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof s==='string'?utf8(s):s)))}
export function equalConstantTime(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=utf8(a),y=utf8(b);
 let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
}
async function derive(password,salt,iterations=PASSWORD_ITERATIONS){
 const raw=await crypto.subtle.importKey('raw',utf8(password),{name:'PBKDF2'},false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},raw,256);
 return base64url(new Uint8Array(bits));
}
async function verifyPassword(owner,password){
 const expected=await derive(password,from64(owner.salt_b64),Number(owner.iterations));
 return equalConstantTime(expected,owner.hash_b64);
}
function dbOf(env){return env.HHBA_ADMIN_AUTH_MODE==='kv'?env.HHBA_ADMIN_AUTH_KV:(env.HHBA_ADMIN_AUTH_KV||env.HHBA_ADMIN_AUTH_DB)}
function isKv(db){return typeof db?.get==='function'&&typeof db?.put==='function'}
function configured(env){return env.HHBA_ADMIN_CONSOLE_ENABLED==='1'&&!!dbOf(env)}
async function generateSession(db,ownerId='owner',authVersion=null){
 const token=base64url(bytes(32)),hash=await sha256(token),issued=now(),expires=issued+SESSION_SECONDS;
 if(isKv(db)){
  if(!authVersion)throw Error('KV_SESSION_REQUIRES_AUTH_VERSION');
  await db.put('session:'+hash,JSON.stringify({owner_id:ownerId,expires_at:expires,auth_version:authVersion}),{expirationTtl:SESSION_SECONDS});
 }else{
  await db.prepare('INSERT INTO hhba_console_sessions(token_hash,owner_id,expires_at,issued_at) VALUES(?,?,?,?)')
   .bind(hash,ownerId,expires,issued).run();
 }
 return token;
}
async function sessionRecord(request,env){
 if(!isConsoleHost(request)||!configured(env))return null;
 const header=request.headers.get('Cookie')||'';
 const token=header.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
 if(!/^[a-zA-Z0-9_-]{43}$/.test(token))return null;
 const hash=await sha256(token);
 const db=dbOf(env),expected=(env.HHBA_METRICS_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!expected)return null;
 if(isKv(db)){
  const [record,current]=await Promise.all([db.get('session:'+hash,'json'),db.get('admin:owner','json')]);
  if(!record||!current||record.expires_at<=now()||record.owner_id!=='owner'||
     !record.auth_version||record.auth_version!==current.auth_version||
     String(current.email||'').toLowerCase()!==expected)return null;
  return {owner:'owner',email:expected,hash};
 }
 const record=await db.prepare('SELECT s.owner_id,s.expires_at,o.email FROM hhba_console_sessions s JOIN hhba_console_owner o ON o.id=s.owner_id WHERE s.token_hash=? LIMIT 1').bind(hash).first();
 if(!record||record.expires_at<=now()||record.owner_id!=='owner')return null;
 if(String(record.email).toLowerCase()!==expected)return null;
 return {owner:'owner',email:expected,hash};
}
export async function verifyPasswordAdmin(request,env){
 try{
  const record=await sessionRecord(request,env);
  return record?{ok:true,email:record.email,provider:'password'}:
   {ok:false,code:'ADMIN_PASSWORD_LOGIN_REQUIRED',status:401};
 }catch(e){
  console.error('ADMIN_SESSION_CHECK_UNAVAILABLE',e?.name, /quota|7500/i.test(String(e?.message||''))?'quota':'' );
  return {ok:false,code:'ADMIN_SESSION_STORE_UNAVAILABLE',status:503};
 }
}
async function owner(db){
 return isKv(db)?db.get('admin:owner','json'):
  db.prepare('SELECT * FROM hhba_console_owner WHERE id=? LIMIT 1').bind('owner').first();
}
async function bodyOf(request){
 const contentLength=Number(request.headers.get('content-length')||0);
 if(contentLength>5000)throw Error('BODY_TOO_LARGE');
 const raw=await request.text();
 if(raw.length>5000)throw Error('BODY_TOO_LARGE');
 return JSON.parse(raw);
}
async function throttleKey(request,env){
 const ip=request.headers.get('cf-connecting-ip')||'unattributed';
 return sha256((env.HHBA_ADMIN_THROTTLE_PEPPER||'')+'|'+ip);
}
async function getThrottle(db,key){
 const rec=isKv(db)?await db.get('limit:'+key,'json'):
  await db.prepare('SELECT failures,lock_until,updated_at FROM hhba_console_login_limits WHERE identity_hash=?').bind(key).first();
 return rec&&rec.lock_until>now()?{locked:true,until:rec.lock_until}:{locked:false,failures:rec?.failures||0,updated:rec?.updated_at||0};
}
async function failedLogin(db,key){
 const t=now();
 if(isKv(db)){
  const prior=await db.get('limit:'+key,'json');
  const failures=prior?.updated_at>=t-900?(prior.failures||0)+1:1;
  await db.put('limit:'+key,JSON.stringify({failures,lock_until:failures>=7?t+900:0,updated_at:t}),{expirationTtl:900});
  return;
 }
 const sql='INSERT INTO hhba_console_login_limits(identity_hash,failures,lock_until,updated_at) VALUES(?,1,0,?) '+
  'ON CONFLICT(identity_hash) DO UPDATE SET '+
  'failures=CASE WHEN updated_at<? THEN 1 ELSE failures+1 END, '+
  'lock_until=CASE WHEN updated_at>=? AND failures>=6 THEN ? ELSE 0 END, updated_at=?';
 await db.prepare(sql).bind(key,t,t-900,t-900,t+900,t).run();
}
async function clearThrottle(db,key){
 if(isKv(db))await db.delete('limit:'+key);
 else await db.prepare('DELETE FROM hhba_console_login_limits WHERE identity_hash=?').bind(key).run();
}
function privateResponse(result,session){
 const headers=session?{'Set-Cookie':tokenCookie(session)}:{};
 return authJson(result,200,headers);
}
export async function handleConsoleAuth({request,env},action){
 if(!isConsoleHost(request)||!configured(env))return authError('ADMIN_HOST_NOT_CONFIGURED',404);
 const db=dbOf(env);
 try{
  if(action==='status'&&request.method==='GET'){
   const configuredOwner=!!await owner(db);
   const current=await sessionRecord(request,env);
   return authJson({ok:true,configured:configuredOwner,authenticated:!!current,
    email:current?.email||null,sessionDays:7});
  }
  if(action==='logout'&&request.method==='POST'){
   if(!hasOrigin(request))return authError('INVALID_ORIGIN',403);
   const s=await sessionRecord(request,env);
   if(s){
    if(isKv(db))await db.delete('session:'+s.hash);
    else await db.prepare('DELETE FROM hhba_console_sessions WHERE token_hash=?').bind(s.hash).run();
   }
   return authJson({ok:true},200,{'Set-Cookie':clearCookie()});
  }
  if(!['setup','login','change'].includes(action)||request.method!=='POST')return authError('NOT_FOUND',404);
  if(!hasOrigin(request))return authError('INVALID_ORIGIN',403);
  const data=await bodyOf(request);
  if(action==='setup'){
   const stored=await owner(db);
   if(stored)return authError('ADMIN_ALREADY_CONFIGURED',409);
   const proof=typeof data.token==='string'?data.token:'';
   const password=data.password;
   if(!/^[a-zA-Z0-9_-]{43}$/.test(proof)||!strongPassword(password))return authError('INVALID_SETUP_INPUT',400);
   const deadline=Number(env.HHBA_ADMIN_SETUP_EXPIRES||0);
   if(deadline<=now()||!env.HHBA_ADMIN_SETUP_SHA256)return authError('SETUP_LINK_EXPIRED',403);
   const digest=await sha256(proof);
   if(!equalConstantTime(digest,env.HHBA_ADMIN_SETUP_SHA256))return authError('SETUP_NOT_AUTHORIZED',403);
   const salt=bytes(16),hash=await derive(password,salt),t=now();
   const email=String(env.HHBA_METRICS_ADMIN_EMAIL||'').trim().toLowerCase();
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return authError('ADMIN_EMAIL_NOT_CONFIGURED',503);
   const authVersion=base64url(bytes(16));
   if(isKv(db)){
    await db.put('admin:owner',JSON.stringify({
     id:'owner',username:'huifanghhba001',email,salt_b64:base64url(salt),
     hash_b64:hash,iterations:PASSWORD_ITERATIONS,created_at:t,updated_at:t,auth_version:authVersion
    }));
   }else{
    const inserted=await db.prepare('INSERT OR IGNORE INTO hhba_console_owner(id,email,salt_b64,hash_b64,iterations,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
     .bind('owner',email,base64url(salt),hash,PASSWORD_ITERATIONS,t,t).run();
    if(inserted.meta?.changes!==1)return authError('ADMIN_ALREADY_CONFIGURED',409);
   }
   const token=await generateSession(db,'owner',authVersion);
   return privateResponse({ok:true,message:'PASSWORD_CONFIGURED'},token);
  }
  const session=action==='change'?await sessionRecord(request,env):null;
  if(action==='change'&&!session)return authError('ADMIN_PASSWORD_LOGIN_REQUIRED',401);
  const identifier=String(data.username||'').trim().toLowerCase();
  if(typeof data.password!=='string'||data.password.length>128)return authError('LOGIN_INVALID',401);
  const key=await throttleKey(request,env);
  const state=await getThrottle(db,key);
  if(state.locked)return authError('LOGIN_RATE_LIMITED',429);
  const account=await owner(db);
  if(!account)return authError('SETUP_REQUIRED',409);
  const verified=(action!=='login'||identifier===String(account.username||'').trim().toLowerCase())&&await verifyPassword(account,data.password);
  if(!verified){await failedLogin(db,key);return authError('LOGIN_INVALID',401)}
  if(action==='change'){
   const next=data.newPassword;
   if(!strongPassword(next)||equalConstantTime(data.password,next))return authError('INVALID_NEW_PASSWORD',400);
   const salt=bytes(16),hash=await derive(next,salt),t=now();
   if(isKv(db)){
    account.salt_b64=base64url(salt);account.hash_b64=hash;
    account.iterations=PASSWORD_ITERATIONS;account.updated_at=t;
    account.auth_version=base64url(bytes(16));
    await db.put('admin:owner',JSON.stringify(account));
   }else{
    await db.batch([
     db.prepare('UPDATE hhba_console_owner SET salt_b64=?,hash_b64=?,iterations=?,updated_at=? WHERE id=?')
      .bind(base64url(salt),hash,PASSWORD_ITERATIONS,t,'owner'),
     db.prepare('DELETE FROM hhba_console_sessions WHERE owner_id=?').bind('owner')
    ]);
   }
  }
  await clearThrottle(db,key);
  const token=await generateSession(db,'owner',account.auth_version||null);
  return privateResponse({ok:true,message:action==='change'?'PASSWORD_CHANGED':'LOGIN_OK'},token);
 }catch(e){
  if(e instanceof SyntaxError||String(e).includes('BODY_TOO_LARGE'))return authError('INVALID_REQUEST_BODY',400);
  console.error('HHBA_ADMIN_AUTH_BACKEND_UNAVAILABLE',e?.name||'Error');
  if(/quota|row read limit|exceeded|7500/i.test(String(e?.message||'')))return authError('D1_DAILY_LIMIT_REACHED',503);
  return authError('ADMIN_AUTH_SERVICE_UNAVAILABLE',503);
 }
}
