// Short-lived, encrypted server-side research checkpoints. Never store the
// original resume, account identifiers, or model credentials. Existing
// signed checkpoint validation still binds the state to the requesting user,
// exact resume and search parameters. R2 lifecycle removes abandoned objects.
const PREFIX='v4-match-continuations/';
const enc=new TextEncoder(),dec=new TextDecoder();
const TTL=60*60*1000;
const refOK=ref=>typeof ref==='string'&&/^[a-f0-9-]{36}$/.test(ref);
export function v4CheckpointSecret(env){
 // A malformed primary binding must not shadow the existing usable fallback.
 return [env?.HHBA_MATCH_V4_CHECKPOINT_SECRET,env?.HHBA_RESUME_AGENT_CHECKPOINT_SECRET].find(value=>typeof value==='string'&&value.length>=32);
}
const secret=v4CheckpointSecret;
export function checkpointStorageReady(env){
 return env?.HHBA_V4_MATCH_CHECKPOINT_STORAGE==='1'&&typeof secret(env)==='string'&&secret(env).length>=32&&
  typeof env?.HHBA_PRIVATE_RESUMES?.put==='function'&&typeof env.HHBA_PRIVATE_RESUMES.get==='function';
}
async function key(env){
 const digest=await crypto.subtle.digest('SHA-256',enc.encode('hhba:v4:checkpoint-storage:'+secret(env)));
 return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function storeMatchCheckpoint(env,state,now=Date.now()){
 if(!checkpointStorageReady(env))throw Error('AI_CHECKPOINT_STORAGE_UNAVAILABLE');
 const ref=crypto.randomUUID(),iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(ref)},await key(env),
  enc.encode(JSON.stringify({until:now+TTL,state})));
 const packed=new Uint8Array(12+bytes.byteLength);packed.set(iv);packed.set(new Uint8Array(bytes),12);
 await env.HHBA_PRIVATE_RESUMES.put(PREFIX+ref,packed,{httpMetadata:{contentType:'application/octet-stream'}});
 return {ref};
}
export async function loadMatchCheckpoint(env,pointer,now=Date.now()){
 if(!checkpointStorageReady(env)||!refOK(pointer?.ref))throw Error('AI_CHECKPOINT_INVALID');
 const object=await env.HHBA_PRIVATE_RESUMES.get(PREFIX+pointer.ref);
 if(!object)throw Error('AI_CHECKPOINT_EXPIRED');
 try{
  const bytes=new Uint8Array(await object.arrayBuffer());
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:enc.encode(pointer.ref)},await key(env),bytes.subarray(12));
  const value=JSON.parse(dec.decode(raw));
  if(!Number.isFinite(value.until)||value.until<now||!value.state)throw Error('AI_CHECKPOINT_EXPIRED');
  return value.state;
 }catch(e){throw Error(e?.message==='AI_CHECKPOINT_EXPIRED'?e.message:'AI_CHECKPOINT_INVALID');}
}
export async function deleteMatchCheckpoint(env,pointer){
 if(checkpointStorageReady(env)&&refOK(pointer?.ref))await env.HHBA_PRIVATE_RESUMES.delete(PREFIX+pointer.ref);
}

// Account-bound recovery record. The browser only keeps a random task UUID;
// no CV or model response is persisted on the client. The same authorized
// resume and options must be provided again to recover a task.
export async function matchTaskKey(env,account,taskId,input){
 if(!checkpointStorageReady(env)||!refOK(taskId)||typeof account!=='string')throw Error('AI_CHECKPOINT_INVALID');
 const k=await crypto.subtle.importKey('raw',enc.encode(secret(env)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',k,enc.encode(JSON.stringify(['v4-recovery',account,taskId,input])));
 return Array.from(new Uint8Array(mac),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function saveMatchTask(env,id,value,now=Date.now()){
 if(!checkpointStorageReady(env)||! /^[a-f0-9]{64}$/.test(id))throw Error('AI_CHECKPOINT_INVALID');
 const iv=crypto.getRandomValues(new Uint8Array(12)),aad='task:'+id;
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},await key(env),
  enc.encode(JSON.stringify({until:now+23*3600000,value})));
 const packed=new Uint8Array(12+bytes.byteLength);packed.set(iv);packed.set(new Uint8Array(bytes),12);
 await env.HHBA_PRIVATE_RESUMES.put(PREFIX+'tasks/'+id,packed,{httpMetadata:{contentType:'application/octet-stream'}});
}
export async function readMatchTask(env,id,now=Date.now(),{renewGeneration}={}){
 if(!checkpointStorageReady(env)||! /^[a-f0-9]{64}$/.test(id))throw Error('AI_CHECKPOINT_INVALID');
 const object=await env.HHBA_PRIVATE_RESUMES.get(PREFIX+'tasks/'+id);
 if(!object)return null;
 const bytes=new Uint8Array(await object.arrayBuffer());
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:enc.encode('task:'+id)},await key(env),bytes.subarray(12));
 const data=JSON.parse(dec.decode(raw));
 if(data.until<now)return null;
 // Callers may opt in only while owning the research lease and an authorized
 // active generation. Completed/abandoned tasks retain ordinary expiry.
 if(Number.isSafeInteger(renewGeneration)&&data.value?.generation===renewGeneration&&data.value?.checkpoint&&!data.value?.result&&data.until-now<22*3600000)await saveMatchTask(env,id,data.value,now);
 return data.value;
}

 // Serialize lease renewals and in-phase progress writes. Drain before the
 // terminal save so a stale heartbeat cannot overwrite newer research.
 export function startMatchPhaseHeartbeat({renew,getCheckpoint,persist,onError=()=>{},onSaveError=()=>{},interval=60000}){
  let active=true,pending=null,last=null;
  const tick=()=>{
   if(!active||pending)return pending||Promise.resolve();
   pending=(async()=>{
    try{await renew();}catch(e){active=false;onError(e);return;}
    if(!active)return;
    try{
     const snapshot=getCheckpoint();if(!snapshot)return;
     const serialized=JSON.stringify(snapshot);if(serialized===last)return;
     await persist(JSON.parse(serialized));last=serialized;
    }catch(e){onSaveError(e);}
   })().finally(()=>{pending=null;});
   return pending;
  };
  const timer=setInterval(tick,interval);
  return {tick,async stop(){active=false;clearInterval(timer);if(pending)await pending;}};
 }

// Browser polling must not decrypt the entire growing research checkpoint.
// A separately authenticated private record stores only the UI view and status.
const progressId=async id=>{
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('AI_CHECKPOINT_INVALID');
 const digest=await crypto.subtle.digest('SHA-256',enc.encode('hhba:v4:progress:'+id));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
};
export async function saveMatchProgress(env,id,value){return saveMatchTask(env,await progressId(id),{...value,updated_at:Date.now()});}
export async function readMatchProgress(env,id){return readMatchTask(env,await progressId(id));}

// Short-lived exact-input profile reuse, isolated to one authenticated session.
// Reuses encrypted task storage and existing lifecycle; no raw resume or prompt
// is written. The HMAC covers all inputs that can change the career analysis.
export async function matchProfileCacheKey(env,account,sessionHash,input){
 if(!checkpointStorageReady(env)||typeof account!=='string'||!account||typeof sessionHash!=='string'||!sessionHash||!input?.resume_id||typeof input.text!=='string')return null;
 const k=await crypto.subtle.importKey('raw',enc.encode(secret(env)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',k,enc.encode(JSON.stringify(['v4-profile-cache-v1',account,sessionHash,input])));
 return Array.from(new Uint8Array(mac),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function readMatchProfileCache(env,id,now=Date.now()){
 if(!id)return null;
 const record=await readMatchTask(env,id,now);
 return record?.kind==='V4_PROFILE_CACHE_V1'&&record.expires_at>now?record.profile:null;
}
export async function saveMatchProfileCache(env,id,profile,now=Date.now()){
 if(!id||!profile)return;
 await saveMatchTask(env,id,{kind:'V4_PROFILE_CACHE_V1',expires_at:now+3600000,profile},now);
}
