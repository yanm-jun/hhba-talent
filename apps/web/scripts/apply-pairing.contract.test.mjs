import test from 'node:test';
import assert from 'node:assert/strict';
import {
 pairingConfigured,pairingOrigin,validExtensionOrigin,extensionCors,newPairCode,
 createPairCode,claimPairCode,extensionSession,revokeExtensions,normalizedPairCode
} from '../functions/_lib/apply-extension-pairing.js';
const id='abcdefghijklmnopabcdefghijklmnop';
const env={HHBA_APPLY_PAIRING_ENABLED:'1',HHBA_APPLY_EXTENSION_ID:id,
 HHBA_APPLY_PAIRING_PEPPER:'a-secret-that-is-40-characters-long-ok'};
const origin='chrome-extension://'+id;
function makeDb(){
 const codes=new Map(),sessions=new Map(),attempts=[];
 const db={codes,sessions,attempts,prepare(sql){
  return {bind(...args){
   return {
    async first(){
     if(sql.startsWith('SELECT COUNT(*) AS n FROM hhba_apply_pair_codes'))
      return {n:[...codes.values()].filter(x=>x.phone===args[0]&&x.created_at>=args[1]).length};
     if(sql.startsWith('SELECT phone FROM hhba_apply_pair_codes')){
      const row=codes.get(args[0]);return row?.used_at===args[1]?{phone:row.phone}:null;
     }
     if(sql.startsWith('SELECT phone,extension_id,expires_at,revoked_at FROM hhba_apply_extension_sessions'))
      return sessions.get(args[0])||null;
     throw Error('Unknown first SQL '+sql);
    },
    async run(){
     let changes=0;
     if(sql.startsWith('UPDATE hhba_apply_pair_codes SET used_at=? WHERE phone=?')){
      for(const row of codes.values())if(row.phone===args[1]&&!row.used_at){row.used_at=args[0];changes++}
     }else if(sql.startsWith('INSERT INTO hhba_apply_pair_codes')){
      codes.set(args[0],{code_hash:args[0],phone:args[1],created_at:args[2],expires_at:args[3],used_at:null});changes=1;
     }else if(sql.startsWith('INSERT INTO hhba_apply_pair_attempts')){
      const count=attempts.filter(x=>x.ip_hash===args[3]&&x.created_at>=args[4]).length;
      if(count<10){attempts.push({id:args[0],ip_hash:args[1],created_at:args[2]});changes=1}
     }else if(sql.startsWith('UPDATE hhba_apply_pair_codes SET used_at=? WHERE code_hash=?')){
      const row=codes.get(args[1]);
      if(row&&!row.used_at&&row.expires_at>args[2]){row.used_at=args[0];changes=1}
     }else if(sql.startsWith('INSERT INTO hhba_apply_extension_sessions')){
      sessions.set(args[0],{phone:args[1],extension_id:args[2],created_at:args[3],expires_at:args[4],revoked_at:null});changes=1;
     }else if(sql.startsWith('UPDATE hhba_apply_extension_sessions SET last_seen_at=?')){
      const row=sessions.get(args[1]);if(row){row.last_seen_at=args[0];changes=1}
     }else if(sql.startsWith('UPDATE hhba_apply_extension_sessions SET revoked_at=?')){
      for(const row of sessions.values())if(row.phone===args[1]&&!row.revoked_at){row.revoked_at=args[0];changes++}
     }else throw Error('Unknown run SQL '+sql);
     return {success:true,meta:{changes}};
    }
   };
  }};
 }};
 return db;
}
test('pairing requires explicit opt-in, stable extension ID and nontrivial secret',()=>{
 assert.equal(pairingConfigured({}),false);
 assert.equal(pairingConfigured({...env,HHBA_APPLY_EXTENSION_ID:'wrong'}),false);
 assert.equal(pairingConfigured({...env,HHBA_APPLY_PAIRING_PEPPER:'short'}),false);
 assert.equal(pairingConfigured(env),true);
 assert.equal(pairingOrigin(env),origin);
 assert.equal(validExtensionOrigin(new Request('https://hhba.work/api/apply/extension/wallet',{headers:{Origin:origin}}),env),true);
 const evil=new Request('https://hhba.work/api/apply/extension/wallet',{headers:{Origin:'https://bad.example'}});
 assert.equal(validExtensionOrigin(evil,env),false);
 assert.deepEqual(extensionCors(evil,env),{});
 assert.equal(extensionCors(new Request('https://hhba.work/api/apply/extension/wallet',{headers:{Origin:origin}}),env)['Access-Control-Allow-Origin'],origin);
});
test('one-time random pairing code is 12 chars, only hashed in D1, and cannot replay',async()=>{
 const db=makeDb(),phone='13800138000',now=Date.now();
 const start=await createPairCode(db,env,phone,now);
 assert.equal(start.ok,true);assert.match(start.code,/^[A-HJ-NP-Z2-9]{12}$/);
 assert.equal(normalizedPairCode(start.code.slice(0,6)+'-'+start.code.slice(6)),start.code);
 assert.equal(db.codes.size,1);
 assert.ok(![...db.codes.keys()][0].includes(start.code),'raw code must not be stored');
 const first=await claimPairCode(db,env,start.code,'127.0.0.1',now+1000);
 assert.equal(first.ok,true);assert.match(first.token,/^hhbaext_[a-f0-9]{64}$/);
 const again=await claimPairCode(db,env,start.code,'127.0.0.1',now+1100);
 assert.equal(again.error,'PAIR_CODE_INVALID_OR_EXPIRED');
 const extRequest=new Request('https://hhba.work/api/apply/extension/wallet',
  {headers:{Origin:origin,Authorization:'Bearer '+first.token}});
 assert.equal((await extensionSession(db,env,extRequest,now+3000)).phone,phone);
 assert.equal(await extensionSession(db,env,new Request(extRequest.url,{headers:{Origin:'https://bad.example',Authorization:'Bearer '+first.token}}),now+3000),null);
 await revokeExtensions(db,phone,now+5000);
 assert.equal(await extensionSession(db,env,extRequest,now+6000),null);
});
test('expired code, brute-force limit and revoked devices are inaccessible',async()=>{
 const db=makeDb(),now=Date.now();
 const start=await createPairCode(db,env,'13800138000',now);
 const expired=await claimPairCode(db,env,start.code,'127.0.0.1',now+5*60*1000+1);
 assert.equal(expired.error,'PAIR_CODE_INVALID_OR_EXPIRED');
 for(let i=0;i<9;i++)await claimPairCode(db,env,newPairCode(),'127.0.0.1',now+2000+i);
 const blocked=await claimPairCode(db,env,newPairCode(),'127.0.0.1',now+3000);
 assert.equal(blocked.error,'PAIR_RATE_LIMITED');
});
