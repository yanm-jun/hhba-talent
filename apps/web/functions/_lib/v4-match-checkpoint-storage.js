// Short-lived, encrypted server-side research checkpoints. Never store the
// original resume, account identifiers, or model credentials. Existing
// signed checkpoint validation still binds the state to the requesting user,
// exact resume and search parameters. R2 lifecycle removes abandoned objects.
const PREFIX='v4-match-continuations/';
const enc=new TextEncoder(),dec=new TextDecoder();
const TTL=60*60*1000;
const refOK=ref=>typeof ref==='string'&&/^[a-f0-9-]{36}$/.test(ref);
function secret(env){return env?.HHBA_MATCH_V4_CHECKPOINT_SECRET||env?.HHBA_RESUME_AGENT_CHECKPOINT_SECRET;}
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
export async function readMatchTask(env,id,now=Date.now()){
 if(!checkpointStorageReady(env)||! /^[a-f0-9]{64}$/.test(id))throw Error('AI_CHECKPOINT_INVALID');
 const object=await env.HHBA_PRIVATE_RESUMES.get(PREFIX+'tasks/'+id);
 if(!object)return null;
 const bytes=new Uint8Array(await object.arrayBuffer());
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:enc.encode('task:'+id)},await key(env),bytes.subarray(12));
 const data=JSON.parse(dec.decode(raw));
 return data.until>=now?data.value:null;
}
