// TEMPORARY one-shot OIDC production-safe preview trial. DELETE after completed.
import {previewJobBrowserRenderer} from '../../_lib/cf-job-browser-preview.js';
import {runDeepSeekOfficialJobAgent} from '../../_lib/deepseek-official-job-agent.js';
const VERSION='HHBA_V8_CORPORATE_PROOF_EVAL_20261109';
const AUDIENCE='hhba-v8-corporate-proof-20261109';
const BRANCH='refs/heads/feature/match-v8-deepseek-dynamic-official-discovery-20261108';
const WORKFLOW='yanm-jun/hhba-talent/.github/workflows/hhba-v8-corporate-proof-eval.yml@'+BRANCH;
const ORIGIN='https://token.actions.githubusercontent.com';
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'
}});
const fail=(reason,status=400)=>respond({ok:false,error:reason},status);
function ready(env,request){
 const u=new URL(request.url);
 return env?.HHBA_AUTH_ROLLOUT==='preview'&&env.HHBA_MATCH_SERVICE_ENABLED==='1'&&
  u.protocol==='https:'&&u.hostname==='feature-match-v8-deepseek-dy.hhba-talent.pages.dev'&&
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



const DB='HHBA_PNVS_AUTH_DB';
const ACCOUNTING='hhba_match_discovery_accounting';
const BROWSER_AUDIT='hhba_match_browser_render_accounting';
const E2E='HHBA_V8_CORPORATE_PROOF_E2E_ONCE_20261109';
const fakeRole='内容运营';

async function ensureTables(db){
 for(const name of [ACCOUNTING,BROWSER_AUDIT,'hhba_resume_match_requests']){
  const row=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
  if(row?.name!==name)return false;
 }
 return true;
}
async function reserveOnce(db,marker){
 const stamp=new Date().toISOString();
 const r=await db.prepare(
  'INSERT INTO hhba_resume_match_requests(request_id,day_utc,account_hash,created_at) '+
  'SELECT ?,?,?,? WHERE NOT EXISTS '+
  '(SELECT 1 FROM hhba_resume_match_requests WHERE account_hash=?)'
 ).bind(crypto.randomUUID(),stamp.slice(0,10),marker,stamp,marker).run();
 return r?.success===true&&r?.meta?.changes===1;
}
async function auditBrowser(db,marker,id,{attempts=0,recovered=0,failures=0}={}){
 const stamp=new Date().toISOString();
 const q=await db.prepare(
  'INSERT INTO hhba_match_browser_render_accounting('+
  'request_id,day_utc,account_hash,render_attempts,render_recovered,'+
  'render_failures,browser_fee_estimate_complete,created_at) VALUES(?,?,?,?,?,?,?,?)'
 ).bind(id,stamp.slice(0,10),marker,attempts,recovered,failures,0,stamp).run();
 if(q?.success!==true||q?.meta?.changes!==1)throw Error('BROWSER_AUDIT_FAILED');
}
async function auditDeepSeek(db,marker,id,got){
 const cost=got.accounting;if(!cost)throw Error('DEEPSEEK_COST_NOT_OBSERVED');
 const now=new Date().toISOString();
 const q=await db.prepare(
  'INSERT INTO hhba_match_discovery_accounting('+
  'request_id,day_utc,account_hash,model_attempts,search_attempts,fetch_attempts,'+
  'billable_search,billable_fetch,model_input_tokens,model_cached_input_tokens,'+
  'model_output_tokens,model_estimated_cny,tools_estimated_cny,total_estimated_cny,'+
  'peak_price_upper_estimate_cny,pricing_basis,estimate_complete,status,created_at)'+
  ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
 ).bind(id,now.slice(0,10),marker,
  cost.attempts.model,cost.attempts.search,cost.attempts.fetch,
  cost.billable.search,cost.billable.fetch,
  cost.tokens.input,cost.tokens.cached_input,cost.tokens.output,
  cost.model_estimated_cny,cost.search_fetch_estimated_cny,
  cost.estimated_total_cny,cost.peak_price_upper_estimate_cny,
  cost.basis,cost.complete?1:0,got.status==='PARTIAL'?'PARTIAL':'COMPLETE',now).run();
 if(q?.success!==true||q?.meta?.changes!==1)throw Error('DISCOVERY_COST_AUDIT_FAILED');
}
function oneShotBrowser(env){
 return previewJobBrowserRenderer({
  HHBA_AUTH_ROLLOUT:env.HHBA_AUTH_ROLLOUT,
  HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  BROWSER:env.BROWSER
 });
}
export async function onRequestGet({request,env}){
 if(!ready(env,request)||typeof env?.BROWSER?.quickAction!=='function')
  return fail('NOT_FOUND',404);
 return respond({kind:VERSION,status:'PROTECTED_ONE_SHOT_PREVIEW_ONLY'});
}
export async function onRequestPost({request,env}){
 if(!ready(env,request)||typeof env?.BROWSER?.quickAction!=='function')
  return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)
  return fail('ORIGIN_BLOCKED',403);
 if(!await authorized(request))return fail('GITHUB_IDENTITY_INVALID',403);
 let input;
 try{
  if(Number(request.headers.get('Content-Length')||0)>50)throw Error('TOO_LARGE');
  const body=await request.text();if(body.length>50)throw Error('TOO_LARGE');
  input=JSON.parse(body);
 }catch{return fail('INVALID_TEST_MODE',400);}
 if(!input||Object.keys(input).length!==1||input.mode!=='full_e2e')
  return fail('INVALID_TEST_MODE',400);
 try{
  if(!await ensureTables(env.HHBA_PNVS_AUTH_DB))return fail('ACCOUNTING_NOT_READY',503);
  const browserRenderer=oneShotBrowser(env);
  if(!browserRenderer)return fail('BROWSER_BINDING_NOT_READY',503);
  const marker=E2E;
  if(!await reserveOnce(env.HHBA_PNVS_AUTH_DB,marker))return fail('TEST_ALREADY_EXECUTED',409);
  const requestId='HHBA_V8_NATIVE_BROWSER_'+crypto.randomUUID();
  const got=await runDeepSeekOfficialJobAgent(fakeRole,env.HHBA_MATCH_DEEPSEEK_KEY,
   {targetCount:2,auditPublicEvidence:true,browserRenderer});
  await auditDeepSeek(env.HHBA_PNVS_AUTH_DB,marker,requestId,got);
  await auditBrowser(env.HHBA_PNVS_AUTH_DB,marker,requestId,got.stats?.browser_render);
  return respond({kind:VERSION,mode:'full_e2e',real_provider:true,
   status:got.status,quality_status:got.quality_status,usage:got.usage,
   max_budget:got.limit,stats:got.stats,cost_estimate:got.accounting,
   candidates:got.candidates.map(x=>({
    company:x.company,title:x.title,location:x.location,
    official_domain:x.official_domain,official_url:x.official_url,
    employer_site:x.employer_site,source_verification:x.source_verification,
    application_status:x.application_status
   }))});
 }catch{
  return fail('REAL_PROVIDER_EVALUATION_FAILED',502);
 }
}
