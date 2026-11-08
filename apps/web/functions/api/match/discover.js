// HHBA Preview-only Search/Fetch: role text only; no resumes/PII/provider keys in output.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../../_lib/real-auth.js';
import {sanitizedJobIntent,discoverExternalOfficialJobs,EXTERNAL_DISCOVERY_VERSION,ExternalSearchError,
 SEARCH_LIMIT,FETCH_LIMIT,MAX_SEARCH_FETCH_COST_CNY,CACHE_TTL_MS,safeOfficialJobLocator} from '../../_lib/domestic-search-fetch.js';
const respond=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status=400)=>respond({ok:false,error:code},status);
function enabled(env){
 // Preview uses the existing test-auth rollout; production requires an
 // independent explicit environment marker so existing login is unaffected.
 return (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  env.HHBA_MATCH_SERVICE_ENABLED==='1'&&
  env.HHBA_MATCH_EXTERNAL_SEARCH_ENABLED==='1'&&
  typeof env.HHBA_MATCH_DEEPSEEK_KEY==='string'&&env.HHBA_MATCH_DEEPSEEK_KEY.length>=16&&
  typeof env.HHBA_MATCH_LIMIT_PEPPER==='string'&&env.HHBA_MATCH_LIMIT_PEPPER.length>=24&&
  typeof env.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
async function dbReady(db){
 try{
  const quota=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_external_search_requests'").first();
  const cache=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_external_search_cache'").first();
  return quota?.name==='hhba_external_search_requests'&&cache?.name==='hhba_external_search_cache';
 }catch{return false;}
}
async function smallJson(request){
 const length=request.headers.get('Content-Length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>1024)||!request.body)throw Error('BAD_BODY');
 const reader=request.body.getReader(),parts=[];let size=0;
 try{
  while(true){
   const next=await reader.read();
   if(next.done)break;
   size+=next.value.byteLength;
   if(size>1024){await reader.cancel();throw Error('BAD_BODY');}
   parts.push(next.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('BAD_BODY');}
}
async function reserve(db,identity){
 const created=new Date().toISOString(),day=created.slice(0,10),id=crypto.randomUUID();
 const row=await db.prepare(
  'INSERT INTO hhba_external_search_requests(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_external_search_requests WHERE day_utc=?)<12 AND '+
  '(SELECT COUNT(*) FROM hhba_external_search_requests WHERE day_utc=? AND account_hash=?)<2'
 ).bind(id,day,identity,created,day,day,identity).run();
 return row?.success===true&&row?.meta?.changes===1?{day,id}:null;
}
// Cache only public job evidence, never the user's resume or their search text.
async function cachedOfficialJobs(db,key,now){
 const row=await db.prepare(
  'SELECT payload_json,checked_at FROM hhba_external_search_cache WHERE cache_key=? AND expires_at>?'
 ).bind(key,new Date(now).toISOString()).first();
 if(!row||typeof row.payload_json!=='string'||row.payload_json.length>64000)return null;
 const timestamp=Date.parse(row.checked_at||'');
 if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>CACHE_TTL_MS)return null;
 let payload;
 try{payload=JSON.parse(row.payload_json);}catch{return null;}
 if(payload.kind!==EXTERNAL_DISCOVERY_VERSION||payload.scope!=='CN_MAINLAND_ONLY'||
  !Array.isArray(payload.candidates)||payload.candidates.length>FETCH_LIMIT)return null;
 for(const candidate of payload.candidates){
  const official=safeOfficialJobLocator(candidate.official_url);
  if(!official||official.id!==candidate.id||candidate.official_domain!==official.domain||
   candidate.company!==official.company||candidate.source_level!==official.source_level||
   candidate.application_status!=='NEEDS_OFFICIAL_CONFIRMATION')return null;
 }
 return payload;
}
async function storeOfficialJobs(db,key,data,now){
 const content=JSON.stringify(data);
 if(content.length>60000)return;
 await db.prepare(
  'INSERT OR REPLACE INTO hhba_external_search_cache(cache_key,payload_json,checked_at,expires_at) VALUES(?,?,?,?)'
 ).bind(key,content,new Date(now).toISOString(),new Date(now+CACHE_TTL_MS).toISOString()).run();
}
export async function onRequestGet({env}){
 return respond({kind:EXTERNAL_DISCOVERY_VERSION,enabled:enabled(env)&&await dbReady(env.HHBA_PNVS_AUTH_DB),
  scope:'CN_MAINLAND_ONLY',max_search_requests:SEARCH_LIMIT,max_fetch_requests:FETCH_LIMIT,
  theoretical_search_fetch_cost_cap_cny:MAX_SEARCH_FETCH_COST_CNY,cache_ttl_hours:24,
  per_account_daily_limit:2,global_daily_limit:12,integrated_into_top10:true,
  disclaimer:'仅允许登录求职者主动搜索；开放状态与 ATS 租户企业归属可能需要额外核实。'});
}
export async function onRequestPost({request,env}){
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  return fail('ORIGIN_REQUIRED',403);
 if(!enabled(env))return fail('EXTERNAL_SEARCH_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!await dbReady(db))return fail('EXTERNAL_SEARCH_DB_NOT_READY',503);
 let session;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(!user||user.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let input;
 try{input=await smallJson(request);}catch{return fail('INVALID_SEARCH_INTENT',400);}
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).some(k=>!['role_hint','consent_search'].includes(k))||
  input.consent_search!==true)return fail('SEARCH_CONSENT_REQUIRED',400);
 const role=sanitizedJobIntent(input.role_hint);
 if(!role)return fail('INVALID_SEARCH_INTENT',400);
 let hash,cacheKey,record;
 try{
  hash=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':search:'+session.phone);
  cacheKey=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':public-role-v2:'+role.toLowerCase());
  // Cached public results incur zero provider requests and use no new quota.
  const cached=await cachedOfficialJobs(db,cacheKey,Date.now());
  if(cached)return respond({ok:true,...cached,cache_hit:true,
   usage:{search:0,fetch:0},attempts:{search:0,fetch:0}});
  record=await reserve(db,hash);
 }catch{return fail('EXTERNAL_SEARCH_DB_NOT_READY',503);}
 if(!record){
  try{
   const row=await db.prepare('SELECT COUNT(*) AS n FROM hhba_external_search_requests WHERE day_utc=?')
    .bind(new Date().toISOString().slice(0,10)).first();
   if(Number(row?.n)>=12)return fail('EXTERNAL_SEARCH_GLOBAL_LIMIT',429);
  }catch{return fail('EXTERNAL_SEARCH_DB_NOT_READY',503);}
  return fail('EXTERNAL_SEARCH_PERSONAL_LIMIT',429);
 }
 try{
  const data=await discoverExternalOfficialJobs(role,env.HHBA_MATCH_DEEPSEEK_KEY);
  // Cache writes are best-effort: never turn a successful search into a
  // double-charge retry because the public-result cache is unavailable.
  try{await storeOfficialJobs(db,cacheKey,data,Date.now());}
  catch{console.warn('HHBA_EXTERNAL_SEARCH_CACHE_WRITE_FAILED');}
  return respond({ok:true,...data,cache_hit:false});
 }catch(e){
  // Ambiguous/partial provider calls may have already been charged.
  // The independent pilot attempt is retained; no automatic retry or refund.
  const code=e instanceof ExternalSearchError?e.code:'SEARCH_PROVIDER_ERROR';
  console.warn('HHBA_EXTERNAL_SEARCH_FAILURE',code);
  return fail(code,code==='SEARCH_PROVIDER_RATE_LIMIT'?429:502);
 }
}
