// One-time, user-approved structured profile handoff from the first-party HHBA
// site to the specifically paired extension. Never move R2 document bytes here.
// No raw profile is stored in D1: AES-256-GCM, 5-minute TTL and atomic claim.
export const PROFILE_CONSENT_VERSION='extension-structured-profile-sync-v1';
const MAX_PAYLOAD=20000;
const MAX_FIELD_LENGTHS=Object.freeze({
 fullName:80,phone:40,email:160,school:180,major:150,education:50,
 degree:50,enrollment:20,graduation:20,city:100,skills:2000,
 experience:12000,projects:12000,summary:4000
});
const ISO_MS=5*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY=/^[a-f0-9]{64}$/i;
const toHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=str=>new Uint8Array((str.match(/.{2}/g)||[]).map(a=>parseInt(a,16)));
export function syncKeyConfigured(env){
 return typeof env?.HHBA_APPLY_PROFILE_TRANSFER_KEY==='string'&&
  KEY.test(env.HHBA_APPLY_PROFILE_TRANSFER_KEY);
}
export function normalizedSyncProfile(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const keys=Object.keys(input);
 if(keys.some(key=>!Object.hasOwn(MAX_FIELD_LENGTHS,key)))return null;
 const out={};let nonempty=0;
 for(const [key,max] of Object.entries(MAX_FIELD_LENGTHS)){
  const value=input[key]??'';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))return null;
  const clean=value.trim();
  if(clean)nonempty++;
  out[key]=clean;
 }
 if(!nonempty||out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))return null;
 if(JSON.stringify(out).length>MAX_PAYLOAD)return null;
 return out;
}
export function validateSyncRequest(body){
 if(!body||body.consent!==true||body.consentVersion!==PROFILE_CONSENT_VERSION||
  typeof body.resumeId!=='string'||!UUID.test(body.resumeId))return null;
 return normalizedSyncProfile(body.profile);
}
async function aesKey(env){
 if(!syncKeyConfigured(env))throw Error('PROFILE_TRANSFER_NOT_CONFIGURED');
 return crypto.subtle.importKey('raw',fromHex(env.HHBA_APPLY_PROFILE_TRANSFER_KEY),
  {name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function purgeExpiredProfileTransfers(db,now=Date.now()){
 // Opportunistic expiry cleanup on every prepare/claim. Add scheduled cleanup
 // before production to bound physical retention even without any traffic.
 const cutoff=new Date(now).toISOString();
 return db.prepare('DELETE FROM hhba_apply_profile_transfers WHERE expires_at<=? OR claimed_at IS NOT NULL')
  .bind(cutoff).run();
}
export async function prepareProfileTransfer(db,env,phone,body,now=Date.now()){
 const profile=validateSyncRequest(body);
 if(!profile)return {ok:false,error:'INVALID_PROFILE_SYNC_REQUEST',status:400};
 if(!syncKeyConfigured(env))return {ok:false,error:'PROFILE_TRANSFER_NOT_CONFIGURED',status:503};
 await purgeExpiredProfileTransfers(db,now);
 const resume=await db.prepare('SELECT id FROM hhba_candidate_resumes WHERE id=? AND phone=?')
  .bind(body.resumeId,phone).first();
 if(!resume)return {ok:false,error:'RESUME_NOT_FOUND',status:404};
 const active=await db.prepare(
  'SELECT COUNT(*) AS n FROM hhba_apply_extension_sessions WHERE phone=? AND revoked_at IS NULL AND expires_at>?'
 ).bind(phone,new Date(now).toISOString()).first();
 if(!Number(active?.n))return {ok:false,error:'PAIRING_REQUIRED',status:409};
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=new TextEncoder().encode(JSON.stringify(profile));
 const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(env),plain);
 const issued=new Date(now).toISOString(),expiresAt=new Date(now+ISO_MS).toISOString();
 // Encrypt profile before writing it, replace previous unclaimed version per
 // owner. No plaintext, document text, phone number, filename or AI output logged.
 const saved=await db.prepare(
  `INSERT INTO hhba_apply_profile_transfers(phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at,claimed_at)
   VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(phone) DO UPDATE SET
   resume_id=excluded.resume_id,nonce_hex=excluded.nonce_hex,
   cipher_hex=excluded.cipher_hex,created_at=excluded.created_at,
   expires_at=excluded.expires_at,claimed_at=NULL`
 ).bind(phone,body.resumeId,toHex(iv),toHex(new Uint8Array(sealed)),issued,expiresAt).run();
 if(saved?.success!==true)return {ok:false,error:'PROFILE_TRANSFER_UNAVAILABLE',status:503};
 return {ok:true,expiresAt,fieldsWithValue:Object.values(profile).filter(Boolean).length};
}
export async function claimProfileTransfer(db,env,phone,now=Date.now()){
 if(!syncKeyConfigured(env))return {ok:false,error:'PROFILE_TRANSFER_NOT_CONFIGURED',status:503};
 const stamp=new Date(now).toISOString();
 await purgeExpiredProfileTransfers(db,now);
 // D1 supports UPDATE ... RETURNING. Two simultaneous extension claims cannot
 // both receive the same profile; only the winning claim returns ciphertext.
 const row=await db.prepare(
  `UPDATE hhba_apply_profile_transfers SET claimed_at=?
   WHERE phone=? AND claimed_at IS NULL AND expires_at>? RETURNING nonce_hex,cipher_hex`
 ).bind(stamp,phone,stamp).first();
 if(!row)return {ok:false,error:'PROFILE_TRANSFER_NOT_READY',status:404};
 try{
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromHex(row.nonce_hex)},
   await aesKey(env),fromHex(row.cipher_hex));
  const payload=JSON.parse(new TextDecoder().decode(decrypted));
  const profile=normalizedSyncProfile(payload);
  if(!profile)throw Error('INVALID_PROFILE');
  // Delete ciphertext immediately after the one-time claim succeeds.
  await db.prepare('DELETE FROM hhba_apply_profile_transfers WHERE phone=? AND claimed_at=?')
   .bind(phone,stamp).run();
  return {ok:true,profile};
 }catch{
  // Never return damaged or unverifiable personal information.
  return {ok:false,error:'PROFILE_TRANSFER_CORRUPT',status:503};
 }
}
export async function revokeProfileTransfer(db,phone){
 const removed=await db.prepare('DELETE FROM hhba_apply_profile_transfers WHERE phone=?')
  .bind(phone).run();
 return {ok:removed?.success===true};
}
