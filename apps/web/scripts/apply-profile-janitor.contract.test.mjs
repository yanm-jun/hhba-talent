import test from 'node:test';
import assert from 'node:assert/strict';
import janitor from '../workers/apply-profile-transfer-janitor.js';
const stamp=Date.parse('2026-11-07T00:00:00Z');
function fixture(){
 let calls=[];
 const db={prepare(sql){
  assert.equal(sql,'DELETE FROM hhba_apply_profile_transfers WHERE expires_at<=? OR claimed_at IS NOT NULL');
  return {bind(cutoff){return {async run(){calls.push(cutoff);return {success:true,meta:{changes:3}}}}}};
 }};
 return {db,calls};
}
test('scheduled janitor does nothing unless explicitly enabled with dedicated D1 binding',async()=>{
 const x=fixture();
 await janitor.scheduled({scheduledTime:stamp},{HHBA_PNVS_AUTH_DB:x.db});
 await janitor.scheduled({scheduledTime:stamp},{HHBA_APPLY_CLEANUP_ENABLED:'1'});
 assert.deepEqual(x.calls,[]);
});
test('scheduled janitor only deletes expired/claimed ciphertext, never reads profiles',async()=>{
 const x=fixture();
 await janitor.scheduled({scheduledTime:stamp},{HHBA_APPLY_CLEANUP_ENABLED:'1',HHBA_PNVS_AUTH_DB:x.db});
 assert.deepEqual(x.calls,[new Date(stamp).toISOString()]);
});
