import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {prepareProfileTransfer,claimProfileTransfer,revokeProfileTransfer,
 validateSyncRequest,normalizedSyncProfile,PROFILE_CONSENT_VERSION,syncKeyConfigured} from '../functions/_lib/apply-profile-sync.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const ref='00000000-0000-4000-8000-000000000001';
const phoneA='13000000001',phoneB='13000000002';
const env={HHBA_APPLY_PROFILE_TRANSFER_KEY:'a'.repeat(64)};
const now=Date.parse('2026-11-07T01:00:00Z');
const profile={fullName:'示例候选人',phone:'13900000000',email:'sample@example.invalid',
 school:'示例学院',major:'视觉传达设计',education:'本科',degree:'学士',
 enrollment:'',graduation:'',city:'',skills:'图文整理',experience:'',projects:'',summary:''};
const input={resumeId:ref,profile,consent:true,consentVersion:PROFILE_CONSENT_VERSION};
function dbMock(){
 let transfer=null;
 let owner=phoneA;
 let active=true;
 return {
  snapshot(){return transfer&&{...transfer}},
  changeOwner(x){owner=x},
  setPaired(x){active=x},
  prepare(sql){
   let values=[];
   const statement={
    bind(...args){values=args;return statement},
    async first(){
     if(sql.includes('SELECT id FROM hhba_candidate_resumes'))return values[1]===owner?{id:ref}:null;
     if(sql.includes('COUNT(*) AS n FROM hhba_apply_extension_sessions'))return {n:active?1:0};
     if(sql.includes('UPDATE hhba_apply_profile_transfers SET claimed_at=')){
      const [time,phone,deadline]=values;
      if(!transfer||transfer.phone!==phone||transfer.claimed_at||transfer.expires_at<=deadline)return null;
      transfer.claimed_at=time;
      return {nonce_hex:transfer.nonce_hex,cipher_hex:transfer.cipher_hex};
     }
     throw Error('Unexpected SELECT: '+sql);
    },
    async run(){
     if(sql.includes('INSERT INTO hhba_apply_profile_transfers')){
      const [phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at]=values;
      transfer={phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at,claimed_at:null};
      return {success:true};
     }
     if(sql.includes('DELETE FROM hhba_apply_profile_transfers')){
      const [phone,time]=values;
      if(transfer?.phone===phone&&(time===undefined||transfer.claimed_at===time))transfer=null;
      return {success:true};
     }
     throw Error('Unexpected RUN: '+sql);
    }
   };return statement;
  }
 };
}
test('explicit separate consent, owner and narrow profile required',()=>{
 assert.equal(validateSyncRequest({...input,consent:false}),null);
 assert.equal(validateSyncRequest({...input,consentVersion:'ai-consent'}),null);
 assert.equal(validateSyncRequest({...input,resumeId:'anything'}),null);
 assert.equal(normalizedSyncProfile({fullName:'张三',invalid:'unexpected'}),null);
 assert.equal(normalizedSyncProfile({fullName:'A',email:'not-email'}),null);
 assert.equal(normalizedSyncProfile({}),null);
 assert.equal(syncKeyConfigured({}),false);
 assert.equal(syncKeyConfigured(env),true);
});
test('prepared profile stored as ciphertext and may be claimed once by same paired owner',async()=>{
 const db=dbMock();
 const issued=await prepareProfileTransfer(db,env,phoneA,input,now);
 assert.equal(issued.ok,true);
 assert.equal(issued.fieldsWithValue,7);
 assert.equal(issued.expiresAt,new Date(now+300000).toISOString());
 const persisted=db.snapshot();
 assert.ok(!persisted.cipher_hex.includes('示例候选人'));
 assert.ok(!persisted.cipher_hex.includes('13900000000'));
 assert.ok(/^[0-9a-f]{24}$/.test(persisted.nonce_hex));
 const other=await claimProfileTransfer(db,env,phoneB,now+1000);
 assert.equal(other.error,'PROFILE_TRANSFER_NOT_READY');
 const received=await claimProfileTransfer(db,env,phoneA,now+2000);
 assert.equal(received.ok,true);
 assert.equal(received.profile.fullName,'示例候选人');
 assert.equal(received.profile.school,'示例学院');
 assert.equal(db.snapshot(),null);
 assert.equal((await claimProfileTransfer(db,env,phoneA,now+3000)).error,'PROFILE_TRANSFER_NOT_READY');
});
test('expired transfer, revoked transfer and unpaired user fail closed',async()=>{
 const db=dbMock();
 db.setPaired(false);
 assert.equal((await prepareProfileTransfer(db,env,phoneA,input,now)).error,'PAIRING_REQUIRED');
 db.setPaired(true);
 db.changeOwner(phoneB);
 assert.equal((await prepareProfileTransfer(db,env,phoneA,input,now)).error,'RESUME_NOT_FOUND');
 db.changeOwner(phoneA);
 await prepareProfileTransfer(db,env,phoneA,input,now);
 assert.equal((await claimProfileTransfer(db,env,phoneA,now+300001)).error,'PROFILE_TRANSFER_NOT_READY');
 assert.equal((await revokeProfileTransfer(db,phoneA)).ok,true);
 assert.equal(db.snapshot(),null);
 assert.equal((await prepareProfileTransfer(db,{},phoneA,input,now)).error,'PROFILE_TRANSFER_NOT_CONFIGURED');
});
test('website endpoints and extension endpoint enforce distinct identities and consent',()=>{
 const api=readFileSync(new URL('../functions/api/apply/[[path]].js',import.meta.url),'utf8');
 assert.ok(api.includes("path==='/extension/profile/claim'"));
 assert.ok(api.includes('extensionSession(db,env,request)'));
 assert.ok(api.includes('validExtensionOrigin(request,env)'));
 assert.ok(api.includes("path==='/profile-transfer/prepare'"));
 assert.ok(api.includes('if(!sameOrigin(request))'));
 assert.ok(api.includes('sessionOfBearer(db,request'));
 assert.ok(api.includes('revokeProfileTransfer(db,phone)'));
 assert.ok(!api.includes('PROFILE_TRANSFER_KEY='+String('a'.repeat(64))));
});
