// TEMPORARY ONE-SHOT LIVE V8 TEST. REMOVE ROUTE & WORKFLOW AFTER AUDIT.
import {runDeepSeekOfficialJobAgent} from '../../_lib/deepseek-official-job-agent.js';
const VERSION='HHBA_V8_POSTPASS_EVAL_20261108_V3';
const AUDIENCE='hhba-v8-postpass-20261108';
const BRANCH='refs/heads/feature/match-v8-deepseek-dynamic-official-discovery-20261108';
const WORKFLOW='yanm-jun/hhba-talent/.github/workflows/hhba-v8-structured-live-eval.yml@'+BRANCH;
const ORIGIN='https://token.actions.githubusercontent.com';
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'
}});
const fail=(reason,status=400)=>respond({ok:false,error:reason},status);
function ready(env,request){
 const u=new URL(request.url);
 return env?.HHBA_AUTH_ROLLOUT==='preview'&&env.HHBA_MATCH_SERVICE_ENABLED==='1'&&
  u.protocol==='https:'&&u.hostname.endsWith('.hhba-talent.pages.dev')&&
  typeof env.HHBA_MATCH_DEEPSEEK_KEY==='string'&&env.HHBA_MATCH_DEEPSEEK_KEY.length>=16&&
  typeof env.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
function decode64url(input){
 if(typeof input!=='string'||!input||!/^[A-Za-z0-9_-]+$/.test(input))throw Error('BAD_TOKEN');
 const raw=input.replace(/-/g,'+').replace(/_/g,'/');
 const value=atob(raw+'='.repeat((4-raw.length%4)%4));
 return Uint8Array.from(value,byte=>byte.charCodeAt(0));
}
function jwtPart(input){
 return JSON.parse(new TextDecoder().decode(decode64url(input)));
}
async function authorized(request){
 const auth=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]{100,8000}$/.test(auth))return false;
 try{
  const token=auth.slice(7);
  const parts=token.split('.');
  if(parts.length!==3)return false;
  const h=jwtPart(parts[0]),p=jwtPart(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(h.alg!=='RS256'||typeof h.kid!=='string'||h.kid.length>150||
   p.iss!==ORIGIN||p.aud!==AUDIENCE||p.repository!=='yanm-jun/hhba-talent'||
   String(p.repository_id)!=='1416885458'||p.ref!==BRANCH||
   p.workflow_ref!==WORKFLOW||p.event_name!=='push'||
   p.runner_environment!=='github-hosted'||
   !Number.isInteger(p.exp)||p.exp<now||p.exp>now+900||
   !Number.isInteger(p.iat)||p.iat>now+60||p.iat<now-900)return false;
  const response=await fetch(ORIGIN+'/.well-known/jwks',{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/json'}
  });
  if(!response.ok)return false;
  const jwks=await response.json();
  const jwk=Array.isArray(jwks?.keys)?jwks.keys.find(k=>k.kid===h.kid&&k.kty==='RSA'&&
   k.alg==='RS256'&&k.use==='sig'):null;
  if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode64url(parts[2]),
   new TextEncoder().encode(parts[0]+'.'+parts[1]));
 }catch{return false;}
}

async function reserveOnce(db){
 const marker='HHBA_V8_POSTPASS_ONCE_20261108';
 const stamp=new Date().toISOString();
 const r=await db.prepare(
  'INSERT INTO hhba_resume_match_requests(request_id,day_utc,account_hash,created_at) '+
  'SELECT ?,?,?,? WHERE NOT EXISTS '+
  '(SELECT 1 FROM hhba_resume_match_requests WHERE account_hash=?)'
 ).bind(crypto.randomUUID(),stamp.slice(0,10),marker,stamp,marker).run();
 return r?.success===true&&r?.meta?.changes===1;
}
export async function onRequestGet({request,env}){
 if(!ready(env,request))return fail('NOT_FOUND',404);
 return respond({kind:VERSION,status:'PROTECTED_DYNAMIC_EVAL_ONLY'});
}
export async function onRequestPost({request,env}){
 if(!ready(env,request))return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)
  return fail('ORIGIN_BLOCKED',403);
 if(!await authorized(request))return fail('GITHUB_IDENTITY_INVALID',403);
 let input;
 try{
  if(Number(request.headers.get('Content-Length')||0)>45)throw Error('TOO_LARGE');
  const body=await request.text();if(body.length>45)throw Error('TOO_LARGE');
  input=JSON.parse(body);
 }catch{return fail('INVALID_TEST_MODE',400);}
 if(input?.mode!=='postpass'||Object.keys(input).length!==1)
  return fail('INVALID_TEST_MODE',400);
 try{
  if(!await reserveOnce(env.HHBA_PNVS_AUTH_DB))return fail('TEST_ALREADY_EXECUTED',409);
  // A single bounded live probe, with a synthetic occupation only.
  // No private resume data is sent to DeepSeek Search / Fetch / model.
  // One-shot reservation above prevents repeated paid requests.
  // One single call; the server can use at most six extra Fetch requests
  // against the already observed Search URLs after the model is done.
  const got=await runDeepSeekOfficialJobAgent('内容运营',env.HHBA_MATCH_DEEPSEEK_KEY,
   {targetCount:2});
  const usage=got.usage||{},cost=got.accounting||null;
  if(!cost)throw Error('V8_ACCOUNTING_MISSING');
  const stamp=new Date().toISOString(),day=stamp.slice(0,10);
  const requestId='HHBA_V8_POSTPASS_TEST_'+crypto.randomUUID();
  const audit=await env.HHBA_PNVS_AUTH_DB.prepare(
   'INSERT INTO hhba_match_discovery_accounting('+
   'request_id,day_utc,account_hash,model_attempts,search_attempts,fetch_attempts,'+
   'billable_search,billable_fetch,model_input_tokens,model_cached_input_tokens,'+
   'model_output_tokens,model_estimated_cny,tools_estimated_cny,total_estimated_cny,'+
   'peak_price_upper_estimate_cny,pricing_basis,estimate_complete,status,created_at)'+
   ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(requestId,day,'HHBA_V8_POSTPASS_ONCE_20261108',
   cost.attempts.model,cost.attempts.search,cost.attempts.fetch,
   cost.billable.search,cost.billable.fetch,
   cost.tokens.input,cost.tokens.cached_input,cost.tokens.output,
   cost.model_estimated_cny,cost.search_fetch_estimated_cny,
   cost.estimated_total_cny,cost.peak_price_upper_estimate_cny,cost.basis,
   cost.complete?1:0,got.status==='PARTIAL'?'PARTIAL':'COMPLETE',stamp).run();
  if(audit?.success!==true||audit?.meta?.changes!==1)
   throw Error('V8_ACCOUNTING_SAVE_FAILED');
  return respond({kind:VERSION,real_provider:true,
   query_scope:'CONTENT_OPERATIONS_MAINLAND',status:got.status,quality_status:got.quality_status,usage,
   max_budget:got.limit,stats:got.stats,cost_estimate:cost,
   candidates:got.candidates.map(x=>({
    company:x.company,title:x.title,location:x.location,
    official_domain:x.official_domain,official_url:x.official_url,
    employer_site:x.employer_site,source_verification:x.source_verification,
    application_status:x.application_status
   }))});
 }catch(e){
  return fail(typeof e?.code==='string'?e.code:'RECALL_EVALUATION_FAILED',502);
 }
}
