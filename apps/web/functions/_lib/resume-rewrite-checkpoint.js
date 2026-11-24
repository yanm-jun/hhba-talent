/**
 * Authenticated, browser-carried, tamper-evident checkpoint.
 * Keeps confidential CV content only in the POST body; the checkpoint stores
 * a digest, the account-bound HMAC and an expiry, not resume plaintext.
 * No KV, D1, R2 or paid container is required.
 *
 * Replay is not prevented by a stateless signature: production should add
 * per-account abuse protection before enabling spending-intensive models.
 */
const encoder=new TextEncoder();
const MAX_TTL_MS=60*60*1000;
// V4 checkpoints are still account-bound and signed. Give long editorial
// tasks a longer recovery window; every successful step renews the token.
const ttl=env=>env?.HHBA_MATCH_V4_READY==='1'?24*MAX_TTL_MS:MAX_TTL_MS;
const MAX_TOKEN_LENGTH=4000;
const base64url=bytes=>btoa(String.fromCharCode(...bytes))
 .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function fromBase64url(input){
 if(!/^[A-Za-z0-9_-]+$/.test(input))throw Error('AI_CHECKPOINT_INVALID');
 const base64=input.replaceAll('-','+').replaceAll('_','/')+
  '='.repeat((4-input.length%4)%4);
 return Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
}
async function importKey(env){
 const secret=env?.HHBA_RESUME_AGENT_CHECKPOINT_SECRET;
 if(typeof secret!=='string'||secret.length<32)
  throw Error('AI_CHECKPOINT_NOT_CONFIGURED');
 return crypto.subtle.importKey('raw',encoder.encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const digest=async data=>base64url(new Uint8Array(await crypto.subtle.digest(
 'SHA-256',encoder.encode(JSON.stringify(data))
)));
export function publicDraft(draft){
 const {continuation,...rest}=draft;
 return rest;
}
async function accountBinding(key,user){
 if(typeof user!=='string'||!user.trim())throw Error('AI_CHECKPOINT_INVALID');
 return base64url(new Uint8Array(await crypto.subtle.sign(
 'HMAC',key,encoder.encode('candidate:'+user)
 )));
}
export async function issueCheckpoint({env,account,blocks,job,draft,now=Date.now()}){
 const key=await importKey(env);
 const payload={
  v:1,account:await accountBinding(key,account),
  content:await digest({blocks,job,draft:publicDraft(draft)}),
  until:now+ttl(env)
 };
 const message=base64url(encoder.encode(JSON.stringify(payload)));
 const signature=base64url(new Uint8Array(await crypto.subtle.sign(
  'HMAC',key,encoder.encode(message))));
 return 'h1.'+message+'.'+signature;
}
export async function verifyCheckpoint({
 env,account,blocks,job,draft,token,now=Date.now()
}){
 if(typeof token!=='string'||token.length>MAX_TOKEN_LENGTH)
  throw Error('AI_CHECKPOINT_INVALID');
 const parts=token.split('.');
 if(parts.length!==3||parts[0]!=='h1')
  throw Error('AI_CHECKPOINT_INVALID');
 const key=await importKey(env);
 let valid=false;
 try{valid=await crypto.subtle.verify('HMAC',key,
  fromBase64url(parts[2]),encoder.encode(parts[1]));}
 catch{throw Error('AI_CHECKPOINT_INVALID');}
 if(!valid)throw Error('AI_CHECKPOINT_INVALID');
 let payload;
 try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true})
  .decode(fromBase64url(parts[1])));}
 catch{throw Error('AI_CHECKPOINT_INVALID');}
 if(payload?.v!==1||!Number.isFinite(payload.until)||
  payload.until<now||payload.until>now+ttl(env)+3000)
  throw Error('AI_CHECKPOINT_EXPIRED');
 const accountId=await accountBinding(key,account);
 if(payload.account!==accountId||
  payload.content!==await digest({blocks,job,draft:publicDraft(draft)}))
  throw Error('AI_CHECKPOINT_INVALID');
 return true;
}
