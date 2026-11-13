// Free-only AI orchestration. No DeepSeek, no paid model IDs, no paid fallback.
// Fail closed unless the administrator verified the provider's FREE plan.
// D1 reservations are conservative and never refunded after ambiguous failures.
export const FREE_PROVIDER_VERSION='HHBA_FREE_PROVIDER_V1';
export const CF_MODEL='@cf/zai-org/glm-4.7-flash';
export const GROQ_MODEL='openai/gpt-oss-20b';
const PROVIDER_CAPS={
 cloudflare:{daily:7200,units:145,maxCalls:48},
 groq:{daily:120000,units:7500,maxCalls:16},
 openrouter:{daily:30,units:1,maxCalls:30}
};
function problem(code,status=503){
 const e=new Error(code);e.code=code;e.status=status;return e;
}
export function eligibleProviders(env){
 const cf=env?.HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED==='1'&&typeof env.AI?.run==='function';
 const groq=env?.HHBA_FREE_AI_GROQ_FREE_PLAN_VERIFIED==='1'&&
  env?.HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED==='1'&&
  typeof env?.HHBA_FREE_GROQ_KEY==='string'&&env.HHBA_FREE_GROQ_KEY.length>=20;
 const or=env?.HHBA_FREE_AI_OPENROUTER_FREE_PLAN_VERIFIED==='1'&&
  env?.HHBA_FREE_AI_OPENROUTER_ENABLED==='1'&&
  env?.HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED==='1'&&
  typeof env?.HHBA_FREE_OPENROUTER_KEY==='string'&&env.HHBA_FREE_OPENROUTER_KEY.length>=20&&
  typeof env?.HHBA_FREE_OPENROUTER_MODEL==='string'&&
  /^[a-z0-9._/-]{3,110}:free$/i.test(env.HHBA_FREE_OPENROUTER_MODEL);
 return [...(cf?['cloudflare']:[]),...(groq?['groq']:[]),...(or?['openrouter']:[])];
}
export function freeAIReady(env){
 return env?.HHBA_ZERO_PAID_AI_ENFORCED==='1'&&eligibleProviders(env).length>0&&
  typeof env.HHBA_PNVS_AUTH_DB?.prepare==='function'&&
  typeof env.HHBA_MATCH_LIMIT_PEPPER==='string'&&env.HHBA_MATCH_LIMIT_PEPPER.length>=24;
}
const dayUtc=()=>new Date().toISOString().slice(0,10);
async function reserveProvider(env,provider,ownerHash){
 const db=env.HHBA_PNVS_AUTH_DB,cap=PROVIDER_CAPS[provider];
 const day=dayUtc(),id=crypto.randomUUID(),now=new Date().toISOString();
 const minuteAgo=new Date(Date.now()-60000).toISOString();
 const sql='INSERT INTO hhba_free_ai_provider_calls '+
  '(id,day_utc,owner_hash,provider,budget_units,created_at) '+
  'SELECT ?,?,?,?,?,? WHERE '+
  '(SELECT COALESCE(SUM(budget_units),0) FROM hhba_free_ai_provider_calls WHERE day_utc=? AND provider=?)+?<=? AND '+
  '(SELECT COUNT(*) FROM hhba_free_ai_provider_calls WHERE day_utc=? AND provider=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_free_ai_provider_calls WHERE day_utc=? AND owner_hash=?)<6 AND '+
  '(SELECT COUNT(*) FROM hhba_free_ai_provider_calls WHERE provider=? AND created_at>=?)<3';
 try{
  const r=await db.prepare(sql).bind(id,day,ownerHash,provider,cap.units,now,
   day,provider,cap.units,cap.daily,day,provider,cap.maxCalls,day,ownerHash,
   provider,minuteAgo).run();
  if(r?.success!==true)throw problem('FREE_AI_LEDGER_UNAVAILABLE');
  if(r.meta?.changes!==1)throw problem('FREE_AI_BUDGET_EXHAUSTED',429);
 }catch(e){
  if(e?.code)throw e;
  throw problem('FREE_AI_LEDGER_UNAVAILABLE');
 }
}
async function jsonCompletion(response){
 let answer=response?.response??response?.choices?.[0]?.message?.content;
 if(answer&&typeof answer==='object'&&!Array.isArray(answer))return answer;
 if(typeof answer!=='string'||answer.length>24000)throw problem('FREE_AI_RESPONSE_INVALID',502);
 answer=answer.trim().replace(/^``(?:json)?\s*/i,'').replace(/\s*``$/,'').trim();
 try{
  const obj=JSON.parse(answer);
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('not object');
  return obj;
 }catch{throw problem('FREE_AI_RESPONSE_INVALID',502);}
}
async function cloudflareCall(env,messages,maxTokens){
 try{
  return jsonCompletion(await env.AI.run(CF_MODEL,{
   messages,temperature:0,stream:false,max_completion_tokens:maxTokens,
   chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'}
  }));
 }catch(e){if(e?.code)throw e;throw problem('FREE_AI_PROVIDER_UNAVAILABLE',503);}
}
async function externalCall(provider,env,messages,maxTokens){
 const endpoint=provider==='groq'?
  'https://api.groq.com/openai/v1/chat/completions':
  'https://openrouter.ai/api/v1/chat/completions';
 const key=provider==='groq'?env.HHBA_FREE_GROQ_KEY:env.HHBA_FREE_OPENROUTER_KEY;
 const model=provider==='groq'?GROQ_MODEL:env.HHBA_FREE_OPENROUTER_MODEL;
 const body={model,messages,temperature:0,max_tokens:maxTokens,
  response_format:{type:'json_object'},stream:false};
 if(provider==='openrouter')body.provider={allow_fallbacks:false};
 let res;
 try{
  res=await fetch(endpoint,{method:'POST',redirect:'manual',
   signal:AbortSignal.timeout(18000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(body)});
 }catch{throw problem('FREE_AI_PROVIDER_UNAVAILABLE',503);}
 if(!res.ok){
  if(res.status===429)throw problem('FREE_AI_PROVIDER_LIMIT',429);
  if([401,402,403].includes(res.status))throw problem('FREE_AI_PROVIDER_ACCOUNT_NOT_FREE',503);
  throw problem('FREE_AI_PROVIDER_UNAVAILABLE',503);
 }
 let value;
 try{value=await res.json();}catch{throw problem('FREE_AI_RESPONSE_INVALID',502);}
 return jsonCompletion(value);
}
// Allows only tightly bounded prompts and hard-whitelisted free models.
// Fallback is on provider outage/limit only. Never retries paid providers.
export async function runFreeAIJson(env,{system,user,ownerHash,maxTokens=700,exclude=[]}){
 if(!freeAIReady(env))throw problem('FREE_AI_NOT_CONFIGURED');
 if(typeof system!=='string'||system.length>3600||
    typeof user!=='string'||user.length>13500||
    !Number.isInteger(maxTokens)||maxTokens<50||maxTokens>1250||
    !/^[a-f0-9]{64}$/.test(ownerHash))throw problem('FREE_AI_INPUT_INVALID',400);
 const providers=eligibleProviders(env).filter(p=>!exclude.includes(p));
 if(!providers.length)throw problem('FREE_AI_NOT_CONFIGURED');
 const messages=[{role:'system',content:system},{role:'user',content:user}];
 let finalCode='FREE_AI_BUDGET_EXHAUSTED',finalStatus=429;
 for(const provider of providers){
  try{
   await reserveProvider(env,provider,ownerHash);
   const data=provider==='cloudflare'?
    await cloudflareCall(env,messages,maxTokens):
    await externalCall(provider,env,messages,maxTokens);
   return {data,provider};
  }catch(e){
   finalCode=e?.code||'FREE_AI_PROVIDER_UNAVAILABLE';
   finalStatus=Number.isInteger(e?.status)?e.status:503;
   // Unsafe data or unavailable D1 protection cannot be worked around.
   if(['FREE_AI_INPUT_INVALID','FREE_AI_LEDGER_UNAVAILABLE'].includes(finalCode))throw e;
   // Keep the reservation on failures since the provider may have generated/billed tokens.
  }
 }
 throw problem(finalCode,finalStatus);
}
