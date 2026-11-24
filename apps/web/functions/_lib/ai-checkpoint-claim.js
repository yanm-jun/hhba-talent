import {sha256Hex} from './real-auth.js';
// Claim only an already cryptographically verified account-bound token.
// An unsuccessful model operation releases the claim; completed paid work
// cannot be submitted repeatedly with the same continuation token.
export async function claimAiCheckpoint(db,token,now=Date.now()){
 const hash=await sha256Hex('hhba-v4-checkpoint:'+token);
 const stamp=new Date(now).toISOString(),until=new Date(now+24*3600000).toISOString();
 await db.prepare('DELETE FROM hhba_ai_checkpoint_claims WHERE expires_at<=?').bind(stamp).run();
 const result=await db.prepare('INSERT OR IGNORE INTO hhba_ai_checkpoint_claims(token_hash,expires_at) VALUES(?,?)').bind(hash,until).run();
 if(result?.success!==true)throw Error('AI_CHECKPOINT_DB_UNAVAILABLE');
 if(result?.meta?.changes!==1)return null;
 return {async release(){await db.prepare('DELETE FROM hhba_ai_checkpoint_claims WHERE token_hash=?').bind(hash).run();}};
}

// Renewable request lease. Unlike a one-time continuation token this can
// recover after a worker/browser disconnect. Compare the exact expiry when
// releasing or renewing so a stale worker cannot unlock its successor.
export async function leaseMatchTask(db,taskKey,now=Date.now()){
 const hash=await sha256Hex('hhba-v4-task-lease:'+taskKey);
 let until=new Date(now+180000).toISOString();
 const stamp=new Date(now).toISOString();
 await db.prepare('DELETE FROM hhba_ai_checkpoint_claims WHERE token_hash=? AND expires_at<=?').bind(hash,stamp).run();
 const row=await db.prepare('INSERT OR IGNORE INTO hhba_ai_checkpoint_claims(token_hash,expires_at) VALUES(?,?)').bind(hash,until).run();
 if(row?.success!==true)throw Error('AI_CHECKPOINT_DB_UNAVAILABLE');
 if(row?.meta?.changes!==1)return null;
 return {async renew(){
  const next=new Date(Date.now()+180000).toISOString();
  const updated=await db.prepare('UPDATE hhba_ai_checkpoint_claims SET expires_at=? WHERE token_hash=? AND expires_at=? AND expires_at>?').bind(next,hash,until,new Date().toISOString()).run();
  if(updated?.meta?.changes!==1)throw Error('AI_CHECKPOINT_LEASE_LOST');
  until=next;
 },async release(){
  await db.prepare('DELETE FROM hhba_ai_checkpoint_claims WHERE token_hash=? AND expires_at=?').bind(hash,until).run();
 }};
}
