import {mailReady,sendMail,testAddress,validEmail} from './mail.js';
const enc = new TextEncoder();
const MAX_BODY_BYTES = 8192;
const SESSION_SECONDS = 604800;
// Cloudflare workerd limits an individual WebCrypto PBKDF2 call to 100000 iterations.
// Pair with server-managed HMAC pepper for production and enforce MFA/rate-limiting.
const HASH_ITERATIONS = 100000;
const COOKIE_NAME = '__Host-hhba_session';
const ROLES = new Set(['candidate', 'recruiter']);
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const fail=(status,detail)=>reply({detail},status);
const now=()=>Math.floor(Date.now()/1000);
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=value=>Uint8Array.from(value.match(/.{2}/g)||[],v=>parseInt(v,16));
const randomHex=bytes=>hex(crypto.getRandomValues(new Uint8Array(bytes)));
async function sha256(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));}
function safeEqual(a,b){
 const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
}
async function passwordHash(password,salt,iterations=HASH_ITERATIONS,pepper=''){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(salt),iterations},key,256));
 // Server-side HMAC pepper protects against offline cracking from a D1-only leak.
 if(!pepper)return hex(bits); // preview-only: production requires HHBA_AUTH_PASSWORD_PEPPER
 const hmac=await crypto.subtle.importKey('raw',enc.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',hmac,bits)));
}
const emailValid=validEmail;
const passwordValid=v=>typeof v==='string'&&v.length>=12&&v.length<=128&&enc.encode(v).length<=512;
function enabled(context){
 const host=new URL(context.request.url).hostname;
 if(!context.env.HHBA_AUTH_DB)return false;
 if(context.env.HHBA_AUTH_ROLLOUT==='preview')return host.endsWith('.hhba-talent.pages.dev')&&host!=='hhba-talent.pages.dev';
 return context.env.HHBA_AUTH_ROLLOUT==='production'&&host==='hhba-talent.pages.dev'&&typeof context.env.HHBA_AUTH_PASSWORD_PEPPER==='string'&&context.env.HHBA_AUTH_PASSWORD_PEPPER.length>=32;
}
async function mutation(req){
 if(req.headers.get('origin')!==new URL(req.url).origin)return {error:fail(403,'请求来源无效。')};
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return {error:fail(415,'请使用 JSON 请求。')};
 if(Number(req.headers.get('content-length')||0)>MAX_BODY_BYTES)return {error:fail(413,'请求过大。')};
 const raw=await req.text();
 if(enc.encode(raw).length>MAX_BODY_BYTES)return {error:fail(413,'请求过大。')};
 try{const data=JSON.parse(raw);if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return {data};}
 catch{return {error:fail(400,'请求格式不正确。')};}
}
async function throttle(db,req,email,kind){
 const ip=req.headers.get('cf-connecting-ip')||'unknown',ts=now(),cutoff=ts-900;
 const entries=[['ip:'+kind+':'+await sha256(ip),kind==='register'?8:40]];
 if(email)entries.push(['user:'+kind+':'+await sha256(email),kind==='register'?4:10]);
 for(const [key,max] of entries){
  await db.prepare('INSERT INTO auth_rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN window_start<? THEN 1 ELSE hits+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END').bind(key,ts,cutoff,cutoff,ts).run();
  const row=await db.prepare('SELECT hits FROM auth_rate_limits WHERE rate_key=?').bind(key).first();
  if(row&&row.hits>max)return fail(429,'操作过于频繁，请稍后再试。');
 }
 return null;
}
function cookie(req){const raw=req.headers.get('cookie')||'';const item=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='));return item?.slice(COOKIE_NAME.length+1)||'';}
async function sessionFor(db,req){
 const token=cookie(req);if(!/^[0-9a-f]{64}$/.test(token))return null;
 const hash=await sha256(token);
 const s=await db.prepare('SELECT s.token_hash,s.user_id,s.csrf_token,s.expires_at,u.email,u.display_name,u.email_verified_at,u.disabled_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(hash,now()).first();
 if(!s||s.disabled_at)return null;
 const r=await db.prepare('SELECT account_type FROM auth_roles WHERE user_id=? ORDER BY account_type').bind(s.user_id).all();
 return {...s,account_types:(r.results||[]).map(x=>x.account_type)};
}
async function newSession(db,userId){
 const token=randomHex(32),csrf=randomHex(24),ts=now();
 await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,csrf_token,created_at,expires_at) VALUES(?,?,?,?,?)').bind(await sha256(token),userId,csrf,ts,ts+SESSION_SECONDS).run();
 return reply({csrf_token:csrf},200,{'set-cookie':COOKIE_NAME+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+SESSION_SECONDS});
}
// One-time email challenges: send only through verified server-side mail service.
const CHALLENGE_TTL = 600;
const challengeHash=async (env,email,purpose,code) => {
 const key=await crypto.subtle.importKey('raw',enc.encode(env.HHBA_AUTH_CODE_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(email+'|'+purpose+'|'+code))));
};
const sixDigit=()=>String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6,'0');
const canSendCode=env=>mailReady(env)&&typeof env.HHBA_AUTH_CODE_PEPPER==='string'&&env.HHBA_AUTH_CODE_PEPPER.length>=32;
async function sendChallenge(env,db,email,purpose) {
 if(!canSendCode(env))throw Error('mail_not_configured');
 const code=sixDigit(),ts=now(),id=crypto.randomUUID(),hash=await challengeHash(env,email,purpose,code);
 await db.prepare('INSERT INTO auth_email_challenges(id,email,purpose,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)')
   .bind(id,email,purpose,hash,ts+CHALLENGE_TTL,ts).run();
 try {
  await sendMail(env,{to:email,subject:purpose==='verify'?'HHBA 邮箱验证代码':'HHBA 密码重置代码',
   text:'你的 HHBA '+(purpose==='verify'?'注册验证':'密码重置')+'验证码为：'+code+'。有效期 10 分钟。如果不是你本人操作，请忽略此邮件。'});
 } catch(e) {
  await db.prepare('DELETE FROM auth_email_challenges WHERE id=?').bind(id).run();
  throw e;
 }
}
async function checkChallenge(env,db,email,purpose,code) {
 const item=await db.prepare('SELECT * FROM auth_email_challenges WHERE email=? AND purpose=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(email,purpose).first();
 if(!item||item.expires_at<=now()||item.attempts>=5)return false;
 await db.prepare('UPDATE auth_email_challenges SET attempts=attempts+1 WHERE id=?').bind(item.id).run();
 if(!safeEqual(item.code_hash,await challengeHash(env,email,purpose,code)))return false;
 const result=await db.prepare('UPDATE auth_email_challenges SET used_at=? WHERE id=? AND used_at IS NULL AND attempts<=5').bind(now(),item.id).run();
 return (result?.meta?.changes??1)>0;
}
const emailReply=()=>reply({ok:true,message:'如果账户存在且邮件服务已接通，验证邮件将发送到该地址。'});
async function verifyEmail(env,db,req) {
 const parsed=await mutation(req);if(parsed.error)return parsed.error;
 const {email,code}=parsed.data,normalized=typeof email==='string'?email.trim().toLowerCase():'';
 if(!emailValid(normalized)||!/^\d{6}$/.test(code||''))return fail(400,'请填写邮箱和六位验证码。');
 const limited=await throttle(db,req,normalized,'verify');if(limited)return limited;
 if(!canSendCode(env))return fail(503,'邮件验证服务尚未接通。');
 if(!await checkChallenge(env,db,normalized,'verify',code))return fail(400,'验证码不正确、已过期或超过尝试次数。');
 await db.prepare('UPDATE auth_users SET email_verified_at=? WHERE email=?').bind(now(),normalized).run();
 return reply({verified:true});
}
async function resendEmail(env,db,req) {
 const parsed=await mutation(req);if(parsed.error)return parsed.error;
 const email=typeof parsed.data.email==='string'?parsed.data.email.trim().toLowerCase():'';
 if(!emailValid(email))return fail(400,'邮箱格式不正确。');
 if(!canSendCode(env))return fail(503,'邮件发送服务尚未接通。');
 const limited=await throttle(db,req,email,'mail');if(limited)return limited;
 const u=await db.prepare('SELECT id,email_verified_at FROM auth_users WHERE email=?').bind(email).first();
 if(u&&!u.email_verified_at)await sendChallenge(env,db,email,'verify');
 return emailReply();
}
async function passwordResetRequest(env,db,req){
 const parsed=await mutation(req);if(parsed.error)return parsed.error;
 const email=typeof parsed.data.email==='string'?parsed.data.email.trim().toLowerCase():'';
 if(!emailValid(email))return fail(400,'邮箱格式不正确。');
 if(!canSendCode(env))return fail(503,'邮件发送服务尚未接通。');
 const limited=await throttle(db,req,email,'reset');if(limited)return limited;
 const u=await db.prepare('SELECT id,email_verified_at FROM auth_users WHERE email=?').bind(email).first();
 if(u?.email_verified_at)await sendChallenge(env,db,email,'reset');
 return emailReply();
}
async function resetPassword(env,db,req) {
 const parsed=await mutation(req);if(parsed.error)return parsed.error;
 const {email,code,password}=parsed.data,normalized=typeof email==='string'?email.trim().toLowerCase():'';
 if(!emailValid(normalized)||!/^\d{6}$/.test(code||'')||!passwordValid(password))return fail(400,'请检查邮箱、验证码和不少于 12 位的新密码。');
 if(!canSendCode(env))return fail(503,'邮件发送服务尚未接通。');
 const limited=await throttle(db,req,normalized,'verify');if(limited)return limited;
 if(!await checkChallenge(env,db,normalized,'reset',code))return fail(400,'验证码不正确、已过期或超过尝试次数。');
 const user=await db.prepare('SELECT id FROM auth_users WHERE email=? AND email_verified_at IS NOT NULL').bind(normalized).first();
 if(!user)return fail(400,'验证码无效。');
 const salt=randomHex(16),hash=await passwordHash(password,salt,HASH_ITERATIONS,env.HHBA_AUTH_PASSWORD_PEPPER||'');
 await db.batch([
  db.prepare('UPDATE auth_users SET password_salt=?,password_hash=?,password_iterations=? WHERE id=?').bind(salt,hash,HASH_ITERATIONS,user.id),
  db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)
 ]);
 return reply({updated:true});
}
async function register(env,db,req){
 const input=await mutation(req);if(input.error)return input.error;
 const {email,password,display_name,account_type}=input.data;
 const normalized=typeof email==='string'?email.trim().toLowerCase():'';
 if(!emailValid(normalized)||!passwordValid(password)||typeof display_name!=='string'||display_name.trim().length<2||display_name.trim().length>60||!ROLES.has(account_type))return fail(400,'请检查邮箱、展示名称（2—60 字）和至少 12 位的密码。');
 const synthetic=env.HHBA_AUTH_ROLLOUT==='preview' && env.HHBA_AUTH_ALLOW_TEST_EMAIL==='1' && testAddress(normalized);
 if(testAddress(normalized) && !synthetic)return fail(400,'正式注册请使用可接收验证码的有效邮箱。');
 if(!synthetic && !canSendCode(env))return fail(503,'真实邮箱验证暂未开通，请勿提交个人资料。');
 const limit=await throttle(db,req,normalized,'register');if(limit)return limit;
 if(await db.prepare('SELECT id FROM auth_users WHERE email=?').bind(normalized).first())return fail(409,'该邮箱已注册，请直接登录或找回密码。');
 const id=crypto.randomUUID(),salt=randomHex(16),ts=now();
 let hash;
 try {hash=await passwordHash(password,salt,HASH_ITERATIONS,env.HHBA_AUTH_PASSWORD_PEPPER||'');}
 catch(e) {
   console.error('HHBA_PASSWORD_DERIVATION_ERROR',e?.name||'UnknownError');
   return fail(503,'密码安全处理暂不可用'+(env.HHBA_AUTH_ROLLOUT==='preview'&&env.HHBA_AUTH_DEBUG_ENABLED==='1'?' ['+String(e?.name||'unknown').slice(0,45)+']':'')+'。');
 }
 try{
  await db.batch([
   db.prepare('INSERT INTO auth_users(id,email,password_salt,password_hash,password_iterations,display_name,email_verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,normalized,salt,hash,HASH_ITERATIONS,display_name.trim(),synthetic?ts:null,ts),
   db.prepare('INSERT INTO auth_roles(user_id,account_type,created_at) VALUES(?,?,?)').bind(id,account_type,ts)
  ]);
 }catch{return fail(409,'注册未完成，该邮箱可能已经存在。');}
 if(!synthetic) {
   try { await sendChallenge(env,db,normalized,'verify'); }
   catch (e) { console.error('HHBA_AUTH_MAIL_SEND_FAILED',String(e).slice(0,150)); await db.prepare('DELETE FROM auth_roles WHERE user_id=?').bind(id).run();
           await db.prepare('DELETE FROM auth_users WHERE id=?').bind(id).run();
           return fail(503,'验证码邮件未被发送服务接受，注册未完成。'); }
 }
 return reply({id,account_type,email_verified:synthetic,verification_required:!synthetic},201);
}
async function login(env,db,req){
 const input=await mutation(req);if(input.error)return input.error;
 const {email,password,account_type}=input.data,normalized=typeof email==='string'?email.trim().toLowerCase():'';
 if(!emailValid(normalized)||typeof password!=='string'||password.length>128||(account_type!==undefined&&!ROLES.has(account_type)))return fail(400,'登录信息无效。');
 const limit=await throttle(db,req,normalized,'login');if(limit)return limit;
 const u=await db.prepare('SELECT * FROM auth_users WHERE email=?').bind(normalized).first();
 const hash=await passwordHash(password,u?.password_salt||'00000000000000000000000000000000',u?.password_iterations||HASH_ITERATIONS,env.HHBA_AUTH_PASSWORD_PEPPER||'');
 if(!u||!safeEqual(u.password_hash,hash)||u.disabled_at)return fail(401,'邮箱或密码不正确。');
 if(!u.email_verified_at)return fail(403,'请先验证注册邮箱。');
 const roles=await db.prepare('SELECT account_type FROM auth_roles WHERE user_id=?').bind(u.id).all();
 if(account_type&&!(roles.results||[]).some(x=>x.account_type===account_type))return fail(403,'当前账户没有该身份权限。');
 return newSession(db,u.id);
}
async function me(db,req){
 const s=await sessionFor(db,req);if(!s)return fail(401,'请先登录。');
 return reply({id:s.user_id,email:s.email,display_name:s.display_name,role:s.account_types[0],account_types:s.account_types,csrf_token:s.csrf_token,email_verified:!!s.email_verified_at});
}
async function logout(db,req){
 if(req.headers.get('origin')!==new URL(req.url).origin)return fail(403,'请求来源无效。');
 const s=await sessionFor(db,req);if(!s)return fail(401,'请先登录。');
 if(!safeEqual(req.headers.get('x-csrf-token')||'',s.csrf_token))return fail(403,'会话校验失败。');
 await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(s.token_hash).run();
 return reply({ok:true},200,{'set-cookie':COOKIE_NAME+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
}
export async function route(context){
 if(!enabled(context))return fail(503,'HHBA 真实认证仅在隔离预览环境测试，正式服务尚未开放。');
 const req=context.request,p=new URL(req.url).pathname.replace(/^\/api\/v1\/?/,'');
 try{
  const db=context.env.HHBA_AUTH_DB;
  if(p==='auth/status'&&req.method==='GET')return reply({
    email_delivery_configured:canSendCode(context.env),
    preview_test_email_enabled:context.env.HHBA_AUTH_ROLLOUT==='preview'&&context.env.HHBA_AUTH_ALLOW_TEST_EMAIL==='1',
    password_recovery_available:canSendCode(context.env),
    phone_login_available:false
  });
  if(p==='auth/register'&&req.method==='POST')return await register(context.env,db,req);
  if(p==='auth/email/verify'&&req.method==='POST')return await verifyEmail(context.env,db,req);
  if(p==='auth/email/resend'&&req.method==='POST')return await resendEmail(context.env,db,req);
  if(p==='auth/password/request'&&req.method==='POST')return await passwordResetRequest(context.env,db,req);
  if(p==='auth/password/reset'&&req.method==='POST')return await resetPassword(context.env,db,req);
  if(p==='auth/session'&&req.method==='POST')return await login(context.env,db,req);
  if(p==='auth/session'&&req.method==='DELETE')return await logout(db,req);
  if(p==='auth/me'&&req.method==='GET')return await me(db,req);
  return fail(404,'该接口尚未开放。');
 }catch(err){console.error('HHBA_AUTH_API_ERROR',String(err));return fail(503,'认证服务暂时不可用，请稍后重试。');}
}
