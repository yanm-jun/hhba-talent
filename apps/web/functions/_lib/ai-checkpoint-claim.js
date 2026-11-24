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
