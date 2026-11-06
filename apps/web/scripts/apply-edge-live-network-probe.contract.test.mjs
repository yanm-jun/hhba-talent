import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../workers/apply-edge-lab-live-network-probe.js',import.meta.url),'utf8');
test('live probe is one-shot, scheduled only and can never become a public trigger',()=>{
 assert.ok(worker.includes('async fetch(){return new Response(\'Not found\',{status:404})}'));
 assert.ok(worker.includes('async scheduled(_event,env)'));
 assert.ok(worker.includes('HHBA_EDGE_LAB_NETWORK_PROBE_ENABLED'));
 assert.ok(worker.includes('INSERT OR IGNORE INTO hhba_apply_lab_e2e_runs'));
 assert.ok(worker.includes("if(created?.meta?.changes!==1)return"));
 assert.ok(!worker.includes('ALIPAY_PRIVATE_KEY'));
 assert.ok(!worker.includes('DEEPSEEK_API_KEY'));
 assert.ok(!worker.includes('https://hhba.work/api/'));
});
test('site and extension tokens are ephemeral; Owner/consent/revoke flows are real HTTPS',()=>{
 assert.ok(worker.includes("const LAB='https://hhba-edge-p0-lab.pages.dev'"));
 assert.ok(worker.includes("const EXT='chrome-extension://fjkcpgikachmfhajlghgekeicgbdagej'"));
 for(const endpoint of ['/pair/start','/extension/claim','/extension/wallet',
  '/profile-transfer/prepare','/extension/profile/claim','/pair/revoke']){
  assert.ok(worker.includes("'"+endpoint+"'"),'missing '+endpoint);
 }
 for(const step of ['UNAUTH_DENIED','PAIR_START','WRONG_ORIGIN','PAIR_REDEEM',
  'REPLAY_DENIED','DEVICE_WALLET','BAD_CONSENT','ENCRYPTED_PREPARE',
  'WRONG_DEVICE_DENIED','ONCE_CLAIM','REPLAY_PROFILE_DENIED','REVOKE']){
  assert.ok(worker.includes("'"+step+"'"),'missing '+step);
 }
 assert.ok(worker.includes('const token=randomHex(32)'));
 assert.ok(worker.includes("const hash=await sha256(token)"));
 assert.ok(worker.includes("consentVersion:'extension-structured-profile-sync-v1'"));
 assert.ok(worker.includes("await fetch(LAB+'/api/apply'+path"));
 assert.ok(!worker.includes('console.log'));
 assert.ok(!worker.includes('console.error'));
});
test('test identities and resume metadata are removed in finally, and audit stores no bearer or pair code',()=>{
 assert.ok(worker.includes('}finally{'));
 for(const table of ['hhba_apply_profile_transfers','hhba_apply_extension_sessions',
   'hhba_apply_pair_codes','hhba_candidate_resumes','hhba_auth_sessions','hhba_auth_users']){
  assert.ok(worker.includes('DELETE FROM '+table+' WHERE phone=?'),'no cleanup for '+table);
 }
 assert.ok(worker.includes('cleanup_verified'));
 assert.ok(worker.includes('result.lastStep,result.checks,result.error||null'));
 assert.ok(!worker.includes('INSERT INTO hhba_apply_lab_e2e_runs(run_id,started_at,status,token'));
 assert.ok(worker.includes("status:'passed'"));
});
