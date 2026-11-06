// Limited extension pairing: one-time code, separate short-lived READ-ONLY
// bearer token, strict Origin allowlist. NEVER expose the website login token.
import {randomToken,sha256Hex} from './real-auth.js';
const EXT_ID=/^[a-p]{32}$/;
const CODE=/^[A-HJ-NP-Z2-9]{12}$/; // excludes ambiguous 0, 1, I and O
const ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PAIR_TTL_MS=5*60*1000;
export const DEVICE_TTL_MS=12*60*60*1000;
const iso=ms=>new Date(ms).toISOString();
export function pairingConfigured(env){
 return env?.HHBA_APPLY_PAIRING_ENABLED==='1'&&
  EXT_ID.test(String(env.HHBA_APPLY_EXTENSION_ID||''))&&
  typeof env.HHBA_APPLY_PAIRING_PEPPER==='string'&&env.HHBA_APPLY_PAIRING_PEPPER.length>=32;
}
export function pairingOrigin(env){return pairingConfigured(env)?'chrome-extension://'+env.HHBA_APPLY_EXTENSION_ID:null}
export function validExtensionOrigin(request,env){
 const expected=pairingOrigin(env);
 return !!expected&&request.headers.get('Origin')===expected;
}
export function extensionCors(request,env){
 const origin=pairingOrigin(env);
 if(!origin||request.headers.get('Origin')!==origin)return {};
 return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Authorization, Content-Type',
  'Access-Control-Max-Age':'300','Vary':'Origin'};
}
export function newPairCode(){
 const b=crypto.getRandomValues(new Uint8Array(12));
 return Array.from(b,x=>ABC[x%ABC.length]).join('');
}
export const normalizedPairCode=v=>String(v||'').trim().replace(/[\s-]+/g,'').toUpperCase();
export async function pairCodeHash(code,env){
 return sha256Hex('hhba-apply-pair:'+env.HHBA_APPLY_PAIRING_PEPPER+':'+code);
}
export async function createPairCode(db,env,phone,now=Date.now()){
 if(!pairingConfigured(env))return {ok:false,error:'PAIRING_NOT_ENABLED'};
 const cutoff=iso(now-3600000),created=iso(now),expires=iso(now+PAIR_TTL_MS);
 const recent=await db.prepare('SELECT COUNT(*) AS n FROM hhba_apply_pair_codes WHERE phone=? AND created_at>=?')
  .bind(phone,cutoff).first();
 if(Number(recent?.n||0)>=3)return {ok:false,error:'PAIR_RATE_LIMITED'};
 const code=newPairCode(),hash=await pairCodeHash(code,env);
 // Do not leave multiple simultaneous valid codes for one account.
 await db.prepare('UPDATE hhba_apply_pair_codes SET used_at=? WHERE phone=? AND used_at IS NULL')
  .bind(created,phone).run();
 await db.prepare('INSERT INTO hhba_apply_pair_codes(code_hash,phone,created_at,expires_at) VALUES(?,?,?,?)')
  .bind(hash,phone,created,expires).run();
 return {ok:true,code,expiresAt:expires};
}
export async function claimPairCode(db,env,codeInput,ip,now=Date.now()){
 if(!pairingConfigured(env))return {ok:false,error:'PAIRING_NOT_ENABLED'};
 const code=normalizedPairCode(codeInput);
 if(!CODE.test(code))return {ok:false,error:'PAIR_CODE_INVALID'};
 // An attacker cannot enumerate codes indefinitely; store only a salted IP
 // digest, not the raw IP, and rate-limit BEFORE looking up the pairing code.
 if(typeof ip!=='string'||ip.length<3||ip.length>128)return {ok:false,error:'PAIR_NETWORK_REQUIRED'};
 const ipHash=await sha256Hex('hhba-apply-ip:'+env.HHBA_APPLY_PAIRING_PEPPER+':'+ip);
 const cutoff=iso(now-3600000),created=iso(now),expired=iso(now+DEVICE_TTL_MS);
 const limit=await db.prepare(
  'INSERT INTO hhba_apply_pair_attempts(id,ip_hash,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM hhba_apply_pair_attempts WHERE ip_hash=? AND created_at>=?) < 10'
 ).bind(crypto.randomUUID(),ipHash,created,ipHash,cutoff).run();
 if(limit?.success!==true||limit?.meta?.changes!==1)return {ok:false,error:'PAIR_RATE_LIMITED'};
 const codeHash=await pairCodeHash(code,env);
 const consumed=await db.prepare(
  'UPDATE hhba_apply_pair_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL AND expires_at>?'
 ).bind(created,codeHash,created).run();
 if(consumed?.success!==true||consumed?.meta?.changes!==1)return {ok:false,error:'PAIR_CODE_INVALID_OR_EXPIRED'};
 const row=await db.prepare('SELECT phone FROM hhba_apply_pair_codes WHERE code_hash=? AND used_at=?')
  .bind(codeHash,created).first();
 if(!row?.phone)return {ok:false,error:'PAIR_CODE_INVALID_OR_EXPIRED'};
 const token='hhbaext_'+randomToken();
 const tokenHash=await sha256Hex(token);
 await db.prepare(
  'INSERT INTO hhba_apply_extension_sessions(token_hash,phone,extension_id,created_at,expires_at) VALUES(?,?,?,?,?)'
 ).bind(tokenHash,row.phone,env.HHBA_APPLY_EXTENSION_ID,created,expired).run();
 return {ok:true,token,expiresAt:expired};
}
export async function extensionSession(db,env,request,now=Date.now()){
 if(!validExtensionOrigin(request,env))return null;
 const auth=request.headers.get('Authorization')||'';
 const token=/^Bearer (hhbaext_[a-f0-9]{64})$/.exec(auth)?.[1];
 if(!token)return null;
 const hash=await sha256Hex(token);
 const record=await db.prepare(
  'SELECT phone,extension_id,expires_at,revoked_at FROM hhba_apply_extension_sessions WHERE token_hash=?'
 ).bind(hash).first();
 if(!record||record.revoked_at||record.extension_id!==env.HHBA_APPLY_EXTENSION_ID||
  Date.parse(record.expires_at)<=now)return null;
 await db.prepare('UPDATE hhba_apply_extension_sessions SET last_seen_at=? WHERE token_hash=?')
  .bind(iso(now),hash).run();
 return {...record,tokenHash:hash};
}
export async function revokeExtensions(db,phone,now=Date.now()){
 const time=iso(now);
 await db.prepare('UPDATE hhba_apply_extension_sessions SET revoked_at=? WHERE phone=? AND revoked_at IS NULL')
  .bind(time,phone).run();
 await db.prepare('UPDATE hhba_apply_pair_codes SET used_at=? WHERE phone=? AND used_at IS NULL')
  .bind(time,phone).run();
 return {ok:true};
}
