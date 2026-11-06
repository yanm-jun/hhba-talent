import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/apply/[[path]].js';
import {sha256Hex} from '../functions/_lib/real-auth.js';
import {cleanPairCode,accountApi} from '../../browser-extension/account.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const DOMAIN='https://hhba-preview-test.invalid';
const EDGE_ID='abcdefghijklmnopabcdefghijklmnop';
const EXT_ORIGIN='chrome-extension://'+EDGE_ID;
const PHONE='13900009991';
const WEBSITE_TOKEN='synthetic-site-auth-token-for-nonproduction-test';
const RESUME='00000000-0000-4000-8000-000000000001';
const ENV={HHBA_APPLY_PAIRING_ENABLED:'1',HHBA_APPLY_EXTENSION_ID:EDGE_ID,
 HHBA_APPLY_PAIRING_PEPPER:'test-only-secure-len-over-32-characters-1234567890',
 HHBA_APPLY_PROFILE_TRANSFER_KEY:'7'.repeat(64)};
function responseFor(path,method='GET',bearer='',body=null,origin=DOMAIN){
 return new Request(DOMAIN+'/api/apply'+path,{
  method,
  headers:{
   Origin:origin,
   'Sec-Fetch-Site':path.startsWith('/extension/')?'cross-site':'same-origin',
   'CF-Connecting-IP':'203.0.113.73',
   ...(bearer?{Authorization:'Bearer '+bearer}:{}),
   ...(body?{'Content-Type':'application/json'}:{})
  },
  ...(body?{body:JSON.stringify(body)}:{})
 });
}
async function dispatch(env,path,method='GET',bearer='',body=null,origin=DOMAIN){
 const response=await onRequest({env,request:responseFor(path,method,bearer,body,origin)});
 let payload;try{payload=await response.json()}catch{payload=null}
 return {status:response.status,...payload};
}
async function dbFixture(){
 const tokenHash=await sha256Hex(WEBSITE_TOKEN);
 const now=new Date().toISOString();
 const sessions=new Map([[tokenHash,{phone:PHONE,expires_at:new Date(Date.now()+3600000).toISOString(),revoked:0}]]);
 const pairCodes=new Map(), attempts=[],devices=new Map();
 let transfer=null;
 const ops=[];
 return {ops,peek:()=>transfer,devices,
  db:{prepare(sql){
   let args=[];
   const stmt={
    bind(...values){args=values;return stmt},
    async first(){
     ops.push('first:'+sql.slice(0,85));
     if(sql.startsWith('SELECT * FROM hhba_auth_sessions'))return sessions.get(args[0])||null;
     if(sql.startsWith('SELECT * FROM hhba_auth_users'))return args[0]===PHONE?{phone:PHONE,role:'candidate'}:null;
     if(sql.startsWith('SELECT COUNT(*) AS n FROM hhba_apply_pair_codes'))return {n:[...pairCodes.values()].filter(v=>v.phone===args[0]&&v.created_at>=args[1]).length};
     if(sql.startsWith('SELECT phone FROM hhba_apply_pair_codes')){
      const row=pairCodes.get(args[0]);return row?.used_at===args[1]?{phone:row.phone}:null;
     }
     if(sql.startsWith('SELECT phone,extension_id,expires_at,revoked_at FROM hhba_apply_extension_sessions'))return devices.get(args[0])||null;
     if(sql.startsWith('SELECT id FROM hhba_candidate_resumes'))return args[0]===RESUME&&args[1]===PHONE?{id:RESUME}:null;
     if(sql.includes('COUNT(*) AS n FROM hhba_apply_extension_sessions'))
      return {n:[...devices.values()].filter(d=>d.phone===args[0]&&d.revoked_at===null&&d.expires_at>args[1]).length};
     if(sql.startsWith('SELECT (SELECT COALESCE(SUM(package_uses)'))return {purchased:0,consumed:0,reserved:0};
     if(sql.startsWith('UPDATE hhba_apply_profile_transfers SET claimed_at=')){
      const [timestamp,phone,deadline]=args;
      if(!transfer||transfer.phone!==phone||transfer.claimed_at||transfer.expires_at<=deadline)return null;
      transfer.claimed_at=timestamp;return {nonce_hex:transfer.nonce_hex,cipher_hex:transfer.cipher_hex};
     }
     throw new Error('Unexpected first: '+sql);
    },
    async run(){
     ops.push('run:'+sql.slice(0,85));
     if(sql.startsWith('UPDATE hhba_auth_sessions SET last_seen_at'))return {success:true,meta:{changes:1}};
     if(sql.startsWith('UPDATE hhba_apply_pair_codes SET used_at=? WHERE phone=')){
      let count=0;for(const row of pairCodes.values())if(row.phone===args[1]&&row.used_at===null){row.used_at=args[0];count++}
      return {success:true,meta:{changes:count}};
     }
     if(sql.startsWith('INSERT INTO hhba_apply_pair_codes')){
      pairCodes.set(args[0],{phone:args[1],created_at:args[2],expires_at:args[3],used_at:null});return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('INSERT INTO hhba_apply_pair_attempts')){
      const [id,ip_hash,created_at,ip_key,cutoff]=args;
      const n=attempts.filter(a=>a.ip_hash===ip_key&&a.created_at>=cutoff).length;
      if(n>=10)return {success:true,meta:{changes:0}};
      attempts.push({id,ip_hash,created_at});return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('UPDATE hhba_apply_pair_codes SET used_at=? WHERE code_hash=')){
      const row=pairCodes.get(args[1]);
      if(!row||row.used_at||row.expires_at<=args[2])return {success:true,meta:{changes:0}};
      row.used_at=args[0];return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('INSERT INTO hhba_apply_extension_sessions')){
      devices.set(args[0],{phone:args[1],extension_id:args[2],created_at:args[3],expires_at:args[4],revoked_at:null});
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('UPDATE hhba_apply_extension_sessions SET last_seen_at')){
      const row=devices.get(args[1]);if(row)row.last_seen_at=args[0];
      return {success:true,meta:{changes:row?1:0}};
     }
     if(sql.startsWith('UPDATE hhba_apply_extension_sessions SET revoked_at=')){
      let count=0;for(const row of devices.values())if(row.phone===args[1]&&row.revoked_at===null){row.revoked_at=args[0];count++}
      return {success:true,meta:{changes:count}};
     }
     if(sql.startsWith('DELETE FROM hhba_apply_profile_transfers WHERE expires_at<=')){
      if(transfer&&(transfer.expires_at<=args[0]||transfer.claimed_at!==null))transfer=null;
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('INSERT INTO hhba_apply_profile_transfers')){
      const [phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at]=args;
      transfer={phone,resume_id,nonce_hex,cipher_hex,created_at,expires_at,claimed_at:null};
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('DELETE FROM hhba_apply_profile_transfers WHERE phone=')){
      if(transfer&&transfer.phone===args[0]&&(args.length===1||transfer.claimed_at===args[1]))transfer=null;
      return {success:true,meta:{changes:1}};
     }
     throw new Error('Unexpected run: '+sql);
    }
   };return stmt;
  }}
 };
}
test('full real onRequest flow: website login -> pair code -> Edge redeem -> wallet -> resume sync -> replay/revoke',async()=>{
 const mock=await dbFixture(),env={...ENV,HHBA_PNVS_AUTH_DB:mock.db};
 const site=WEBSITE_TOKEN;
 const cfg=await dispatch(env,'/config');
 assert.equal(cfg.profileSyncEnabled,true);
 const start=await dispatch(env,'/pair/start','POST',site);
 assert.equal(start.status,200,JSON.stringify(start));
 assert.match(start.code,/^[A-HJ-NP-Z2-9]{12}$/);
 assert.equal(cleanPairCode(start.code),start.code);
 const invalid=await dispatch(env,'/extension/claim','POST','',{code:'bad'},EXT_ORIGIN);
 assert.equal(invalid.status,400);
 const forged=await dispatch(env,'/extension/claim','POST','',{code:start.code},'https://evil.invalid');
 assert.equal(forged.status,403);
 const redeemed=await dispatch(env,'/extension/claim','POST','',{code:start.code},EXT_ORIGIN);
 assert.equal(redeemed.status,200,JSON.stringify(redeemed));
 assert.match(redeemed.token,/^hhbaext_[0-9a-f]{64}$/);
 assert.equal((await dispatch(env,'/extension/claim','POST','',{code:start.code},EXT_ORIGIN)).status,400,'pair code is one time');
 const dev={token:redeemed.token,expiresAt:redeemed.expiresAt};
 const realApiFetch=async(url,opts)=>{
  assert.equal(url,'https://hhba.work/api/apply/extension/wallet');
  const req=responseFor('/extension/wallet','GET',dev.token,null,EXT_ORIGIN);
  return onRequest({request:req,env});
 };
 const deviceWallet=await accountApi(realApiFetch,'/wallet',dev);
 assert.equal(deviceWallet.wallet.available,0);
 const active=await dispatch(env,'/pair/status','GET',site);
 assert.equal(active.connectedDevices,1);
 const form={
  resumeId:RESUME,consentVersion:'extension-structured-profile-sync-v1',consent:true,
  profile:{fullName:'虚构求职者',email:'only-test@example.invalid',major:'设计学',school:'样例大学'}
 };
 const submitted=await dispatch(env,'/profile-transfer/prepare','POST',site,form);
 assert.equal(submitted.status,200,JSON.stringify(submitted));
 assert.equal(mock.peek().phone,PHONE);
 assert.match(mock.peek().cipher_hex,/^[0-9a-f]+$/);
 const preview=await dispatch(env,'/extension/profile/claim','POST',dev.token,null,EXT_ORIGIN);
 assert.equal(preview.status,200,JSON.stringify(preview));
 assert.equal(preview.profile.fullName,'虚构求职者');
 assert.equal(preview.profile.school,'样例大学');
 assert.equal(mock.peek(),null);
 assert.equal((await dispatch(env,'/extension/profile/claim','POST',dev.token,null,EXT_ORIGIN)).status,404,'second claim denied');
 const again=await dispatch(env,'/profile-transfer/prepare','POST',site,form);
 assert.equal(again.status,200);
 const revoked=await dispatch(env,'/pair/revoke','POST',site);
 assert.equal(revoked.status,200);
 assert.equal(mock.peek(),null);
 assert.equal((await dispatch(env,'/extension/wallet','GET',dev.token,null,EXT_ORIGIN)).status,401,'revoked device cannot read');
 assert.equal((await dispatch(env,'/profile-transfer/prepare','POST',site,form)).status,409,'no active paired devices');
 assert.equal(mock.ops.filter(x=>/INSERT INTO hhba_apply_orders|UPDATE hhba_apply_orders|INSERT INTO hhba_apply_tasks/.test(x)).length,0,'sync never charges users');
});
