import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/apply/[[path]].js';
import {sha256Hex} from '../functions/_lib/real-auth.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const id='abcdefghijklmnopabcdefghijklmnop';
const website='https://preview.hhba.test';
const extOrigin='chrome-extension://'+id; // Edge Chromium uses this protocol too.
const owner='13911112222'; // synthetic fixture, never a real account
const other='13922223333';
const resumeId='00000000-0000-4000-8000-000000000001';
const siteToken='synthetic-site-session-token-for-contract-test';
const extToken='hhbaext_'+'c'.repeat(64);
const otherExtToken='hhbaext_'+'d'.repeat(64);
const consent='extension-structured-profile-sync-v1';
const now=Date.now();
const stamp=offset=>new Date(now+offset).toISOString();
const envKeys={
 HHBA_APPLY_PAIRING_ENABLED:'1',HHBA_APPLY_EXTENSION_ID:id,
 HHBA_APPLY_PAIRING_PEPPER:'only-a-synthetic-pepper-for-unit-tests-long-123456',
 HHBA_APPLY_PROFILE_TRANSFER_KEY:'f'.repeat(64)
};
async function fixtureDb(){
 const siteHash=await sha256Hex(siteToken);
 const extHash=await sha256Hex(extToken);
 const otherHash=await sha256Hex(otherExtToken);
 const siteSessions=new Map([[siteHash,{phone:owner,expires_at:stamp(3600000),revoked:0}]]);
 const devices=new Map([
  [extHash,{phone:owner,extension_id:id,expires_at:stamp(3600000),revoked_at:null}],
  [otherHash,{phone:other,extension_id:id,expires_at:stamp(3600000),revoked_at:null}]
 ]);
 let pending=null;
 const events=[];
 return {events,peek:()=>pending&&{...pending},db:{prepare(sql){
  const query=sql.replace(/\s+/g,' ').trim();
  let params=[];
  const statement={
   bind(...vals){params=vals;return statement;},
   async first(){
    events.push({operation:'first',sql:query});
    if(query.startsWith('SELECT * FROM hhba_auth_sessions WHERE token_hash='))return siteSessions.get(params[0])||null;
    if(query.startsWith('SELECT * FROM hhba_auth_users WHERE phone='))return [owner,other].includes(params[0])?{phone:params[0],role:'candidate'}:null;
    if(query.startsWith('SELECT phone,extension_id,expires_at,revoked_at FROM hhba_apply_extension_sessions'))return devices.get(params[0])||null;
    if(query.startsWith('SELECT id FROM hhba_candidate_resumes'))return params[0]===resumeId&&params[1]===owner?{id:resumeId}:null;
    if(query.includes('COUNT(*) AS n FROM hhba_apply_extension_sessions'))return {n:[...devices.values()].filter(d=>d.phone===params[0]&&!d.revoked_at&&d.expires_at>params[1]).length};
    if(query.startsWith('UPDATE hhba_apply_profile_transfers SET claimed_at=')){
     const [claimed,phone,before]=params;
     if(!pending||pending.phone!==phone||pending.claimed_at||pending.expires_at<=before)return null;
     pending.claimed_at=claimed;
     return {nonce_hex:pending.nonce_hex,cipher_hex:pending.cipher_hex};
    }
    throw Error('Unexpected D1 first: '+query);
   },
   async run(){
    events.push({operation:'run',sql:query});
    if(query.startsWith('UPDATE hhba_auth_sessions SET last_seen_at'))return {success:true,meta:{changes:1}};
    if(query.startsWith('UPDATE hhba_apply_extension_sessions SET last_seen_at'))return {success:true,meta:{changes:1}};
    if(query.startsWith('DELETE FROM hhba_apply_profile_transfers WHERE expires_at<=')){
     if(pending&&(pending.expires_at<=params[0]||pending.claimed_at))pending=null;
     return {success:true,meta:{changes:1}};
    }
    if(query.startsWith('INSERT INTO hhba_apply_profile_transfers')){
     const [phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at]=params;
     pending={phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at,claimed_at:null};
     return {success:true,meta:{changes:1}};
    }
    if(query.startsWith('DELETE FROM hhba_apply_profile_transfers WHERE phone=')){
     const [phone,claimedAt]=params;
     if(pending&&pending.phone===phone&&(claimedAt===undefined||pending.claimed_at===claimedAt))pending=null;
     return {success:true,meta:{changes:1}};
    }
    throw Error('Unexpected D1 run: '+query);
   }
  };return statement;
 }}};
}
function makeRequest(path,method='GET',token='',origin=website,body){
 const extension=path.startsWith('/extension/');
 const full=website+'/api/apply'+path;
 return new Request(full,{method,headers:{
  Origin:origin,'Sec-Fetch-Site':extension?'cross-site':'same-origin',
  ...(token?{'Authorization':'Bearer '+token}:{}),
  ...(body?{'Content-Type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
}
async function call(env,req){
 const response=await onRequest({request:req,env});
 return {status:response.status,body:await response.json()};
}
test('full HHBA website-to-Edge extension handoff: consent, ciphertext, account isolation, single claim',async()=>{
 const {db,peek,events}=await fixtureDb(),env={...envKeys,HHBA_PNVS_AUTH_DB:db};
 const ready=await call(env,makeRequest('/config'));
 assert.equal(ready.body.profileSyncEnabled,true);
 const input={resumeId,consent:true,consentVersion:consent,
  profile:{fullName:'示例申请人',email:'example@example.invalid',school:'示例学院',major:'艺术设计'}};
 const noConsent=await call(env,makeRequest('/profile-transfer/prepare','POST',siteToken,website,{...input,consent:false}));
 assert.equal(noConsent.status,400);
 assert.equal(peek(),null);
 const wrongOrigin=await call(env,makeRequest('/profile-transfer/prepare','POST',siteToken,'https://other.invalid',input));
 assert.equal(wrongOrigin.status,403);
 const extCannotPrepare=await call(env,makeRequest('/profile-transfer/prepare','POST',extToken,website,input));
 assert.equal(extCannotPrepare.status,401);
 const wrongResume=await call(env,makeRequest('/profile-transfer/prepare','POST',siteToken,website,{...input,resumeId:'00000000-0000-4000-8000-000000000002'}));
 assert.equal(wrongResume.status,404);
 const created=await call(env,makeRequest('/profile-transfer/prepare','POST',siteToken,website,input));
 assert.equal(created.status,200);
 assert.equal(created.body.ok,true);
 assert.match(peek().cipher_hex,/^[0-9a-f]+$/);
 assert.ok(!peek().cipher_hex.includes('示例申请人'));
 const forgedOrigin=await call(env,makeRequest('/extension/profile/claim','POST',extToken,'https://other.invalid'));
 assert.equal(forgedOrigin.status,403);
 const otherAccount=await call(env,makeRequest('/extension/profile/claim','POST',otherExtToken,extOrigin));
 assert.equal(otherAccount.status,404);
 assert.ok(peek());
 const claimed=await call(env,makeRequest('/extension/profile/claim','POST',extToken,extOrigin));
 assert.equal(claimed.status,200);
 assert.equal(claimed.body.profile.fullName,'示例申请人');
 assert.equal(claimed.body.profile.school,'示例学院');
 assert.equal(peek(),null);
 const replay=await call(env,makeRequest('/extension/profile/claim','POST',extToken,extOrigin));
 assert.equal(replay.status,404);
 const used=events.map(e=>e.sql);
 assert.ok(used.some(x=>x.includes('UPDATE hhba_apply_profile_transfers SET claimed_at=')),'must claim atomically');
 assert.ok(!used.some(x=>/INSERT INTO hhba_apply_tasks|UPDATE hhba_apply_orders/.test(x)),'sync cannot spend credits');
});
test('feature remains OFF without Edge identity, pairing switch or transfer key',async()=>{
 const {db}=await fixtureDb();
 for(const missing of ['HHBA_APPLY_PAIRING_ENABLED','HHBA_APPLY_EXTENSION_ID','HHBA_APPLY_PAIRING_PEPPER','HHBA_APPLY_PROFILE_TRANSFER_KEY']){
  const env={...envKeys,HHBA_PNVS_AUTH_DB:db};delete env[missing];
  const result=await call(env,makeRequest('/config'));
  assert.equal(result.status,200);
  assert.equal(result.body.profileSyncEnabled,false,missing+' must fail closed');
 }
});
