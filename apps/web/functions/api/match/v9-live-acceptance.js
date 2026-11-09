// TEMPORARY one-shot OIDC production-safe preview trial. DELETE after completed.
import {discoverOfficialRecruitmentLinks,LINK_DISCOVERY_LIMITS} from '../../_lib/official-recruitment-link-navigation.js';
const VERSION='HHBA_V9_LINK_NAV_REAL_ACCEPTANCE_20261109';
const AUDIENCE='hhba-v9-live-link-20261109-1';
const BRANCH='refs/heads/feature/match-v8-deepseek-dynamic-official-discovery-20261108';
const WORKFLOW='yanm-jun/hhba-talent/.github/workflows/hhba-v9-live-link-acceptance.yml@'+BRANCH;
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




const MARKER='HHBA_V9_LINK_NAV_LIVE_ONCE_20261109_V1';
const ROLE='内容运营';
async function tablesReady(db){
 for(const n of ['hhba_resume_match_requests','hhba_match_discovery_accounting']){
  const v=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(n).first();
  if(v?.name!==n)return false;
 }
 return true;
}
async function reserveOnce(db){
 const now=new Date().toISOString();
 const out=await db.prepare(
  'INSERT INTO hhba_resume_match_requests(request_id,day_utc,account_hash,created_at) '+
  'SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM hhba_resume_match_requests WHERE account_hash=?)'
 ).bind(crypto.randomUUID(),now.slice(0,10),MARKER,now,MARKER).run();
 return out?.success===true&&out?.meta?.changes===1;
}
async function saveAccounting(db,report,status){
 const stamp=new Date().toISOString(),id='HHBA_V9_LINK_'+crypto.randomUUID();
 const r=await db.prepare(
  'INSERT INTO hhba_match_discovery_accounting('+
  'request_id,day_utc,account_hash,model_attempts,search_attempts,fetch_attempts,'+
  'billable_search,billable_fetch,model_input_tokens,model_cached_input_tokens,'+
  'model_output_tokens,model_estimated_cny,tools_estimated_cny,total_estimated_cny,'+
  'peak_price_upper_estimate_cny,pricing_basis,estimate_complete,status,created_at)'+
  ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
 ).bind(id,stamp.slice(0,10),MARKER,
  report.attempts.model,report.attempts.search,report.attempts.fetch,
  report.billable.search,report.billable.fetch,
  report.tokens.input,report.tokens.cached_input,report.tokens.output,
  report.model_estimated_cny,report.search_fetch_estimated_cny,report.estimated_total_cny,
  report.peak_price_upper_estimate_cny,report.basis,report.complete?1:0,
  status==='PARTIAL'?'PARTIAL':'COMPLETE',stamp).run();
 return r?.success===true&&r?.meta?.changes===1;
}
export async function onRequestGet({request,env}){
 if(!ready(env,request)||env.HHBA_MATCH_LINK_NAV_ENABLED!=='1')
  return fail('NOT_FOUND',404);
 return respond({kind:VERSION,status:'PROTECTED_PREVIEW_ONLY'});
}
export async function onRequestPost({request,env}){
 if(!ready(env,request)||env.HHBA_MATCH_LINK_NAV_ENABLED!=='1')
  return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)
  return fail('ORIGIN_BLOCKED',403);
 if(!await authorized(request))return fail('GITHUB_IDENTITY_INVALID',403);
 const declared=Number(request.headers.get('Content-Length')||0);
 if(declared>36||declared<0)return fail('INVALID_BODY',400);
 const raw=await request.text().catch(()=>null);
 if(raw!=='{"mode":"discover"}')return fail('INVALID_BODY',400);
 try{
  const db=env.HHBA_PNVS_AUTH_DB;
  if(!await tablesReady(db))return fail('ACCOUNTING_NOT_READY',503);
  if(!await reserveOnce(db))return fail('ALREADY_TESTED',409);
  const data=await discoverOfficialRecruitmentLinks(ROLE,env.HHBA_MATCH_DEEPSEEK_KEY,{limit:10});
  if(data.usage.model!==0||data.usage.search>3||data.usage.fetch>6)
   throw Error('BUDGET_VIOLATION');
  if(!await saveAccounting(db,data.accounting,data.status))
   throw Error('ACCOUNTING_WRITE_FAILED');
  return respond({
   kind:VERSION,real_provider:true,role:ROLE,status:data.status,
   quality_status:data.quality_status,usage:data.usage,limits:LINK_DISCOVERY_LIMITS,
   stats:data.stats,estimated_cost:data.accounting,accounted:true,
   opportunities:data.opportunities.map(x=>({kind:x.kind,company:x.company,
    url:x.url,role:x.role,source_url:x.source_url,source_evidence:x.source_evidence,
    qualification_status:x.qualification_status,hiring_status:x.hiring_status}))
  });
 }catch{
  return fail('LIVE_PROBE_FAILED',502);
 }
}
