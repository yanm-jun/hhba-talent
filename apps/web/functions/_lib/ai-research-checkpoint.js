/**
 * Same-account, same-resume research recovery. Only PUBLIC employer evidence
 * survives the request; no résumé text, extracted CV, model prompt or secrets.
 *
 * A keyed fingerprint prevents raw résumé hashes becoming a dictionary leak.
 * Checkpoints expire in 24 h and are deleted opportunistically on write.
 */
import {isMainlandEmployerJobUrl} from './match-employer-source.js';
const MAX_JSON=125000;
const removePII=value=>String(value||'')
 .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[邮箱]')
 .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[手机号]')
 .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[证件号]')
 .replace(/(?:微信号|微信|QQ号|QQ)\s*[:：]\s*[A-Za-z0-9_-]{5,32}/gi,'[即时通讯]')
 .replace(/[\u0000-\u001f]/g,' ').trim();
const text=(value,length)=>removePII(value).slice(0,length);
const publicHit=source=>{
 if(!source||!isMainlandEmployerJobUrl(source.url))return null;
 const availability=['UNKNOWN','OPEN_LISTED','POSSIBLY_CLOSED','CLOSED_LISTED']
  .includes(source.availability?.status)?source.availability.status:'UNKNOWN';
 return {id:text(source.id,48),url:source.url,title:text(source.title,150),
  source:text(source.source,95),summary:text(source.summary,650),
  snippet:text(source.snippet,300),content:text(source.content,1000),
  availability:{status:availability},
  recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE'};
};
export function sanitizePublicResearchCheckpoint(input){
 if(!input||typeof input!=='object')return null;
 const pool=[],urls=new Set();
 for(const row of Array.isArray(input.pool)?input.pool:[]){
  const hit=publicHit(row);
  if(!hit||urls.has(hit.url)||!hit.id)continue;
  urls.add(hit.url);pool.push(hit);
  if(pool.length>=180)break;
 }
 const rawQueries=Array.isArray(input.usedQueries)?input.usedQueries:[];
 const usedQueries=rawQueries.filter(x=>typeof x==='string'&&x.length<=128)
  .map(x=>text(x,128)).slice(-100);
 const shortlistIds=Array.isArray(input.shortlistIds)?input.shortlistIds
  .filter(x=>typeof x==='string'&&pool.some(j=>j.id===x)).slice(0,20):[];
 const history=Array.isArray(input.history)?input.history.slice(-16).map(entry=>({
  type:text(entry?.type,32),code:text(entry?.code,60),
  found:Number.isInteger(entry?.found)?entry.found:undefined,
  read:Number.isInteger(entry?.read)?entry.read:undefined,
  finish:entry?.finish===true
 })):[];
 const state={version:1,pool,usedQueries,shortlistIds,history};
 while(JSON.stringify(state).length>MAX_JSON-500&&state.pool.length)state.pool.pop();
 return state;
}
export async function resumeFingerprint(secret,phone,redactedResume,roleHint){
 if(typeof secret!=='string'||secret.length<16)throw Error('CHECKPOINT_SECRET_MISSING');
 const data='HHBA_RESEARCH_CHECKPOINT_V1\n'+String(phone)+'\n'+
  String(roleHint||'')+'\n'+String(redactedResume||'');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function createAccountResearchCheckpoint(db,phone,redactedResume,roleHint,secret){
 if(!db?.prepare||!phone||!secret)return null;
 const fingerprint=await resumeFingerprint(secret,phone,redactedResume,roleHint);
 return {
  async load(){
   try{
    const row=await db.prepare('SELECT state_json FROM hhba_ai_research_checkpoints WHERE fingerprint=? AND phone=? AND expires_at>?')
     .bind(fingerprint,phone,new Date().toISOString()).first();
    return row?.state_json?sanitizePublicResearchCheckpoint(JSON.parse(row.state_json)):null;
   }catch{return null}
  },
  async save(raw){
   const state=sanitizePublicResearchCheckpoint(raw);
   if(!state||!state.pool.length)return false;
   const encoded=JSON.stringify(state);
   const now=new Date(),expires=new Date(now.getTime()+86400000).toISOString();
   try{
    await db.prepare('DELETE FROM hhba_ai_research_checkpoints WHERE expires_at<=?')
     .bind(now.toISOString()).run();
    const result=await db.prepare(
     'INSERT INTO hhba_ai_research_checkpoints(fingerprint,phone,state_json,updated_at,expires_at) VALUES(?,?,?,?,?) '+
     'ON CONFLICT(fingerprint) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at,expires_at=excluded.expires_at WHERE phone=excluded.phone'
    ).bind(fingerprint,phone,encoded,now.toISOString(),expires).run();
    return result?.success===true;
   }catch{return false}
  },
  async clear(){
   try{await db.prepare('DELETE FROM hhba_ai_research_checkpoints WHERE fingerprint=? AND phone=?')
    .bind(fingerprint,phone).run()}catch{}
  }
 };
}
