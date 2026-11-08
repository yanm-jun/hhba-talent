// TEMPORARY PREVIEW-ONLY TEST. MUST be deleted before main merge.
import {discoverExternalOfficialJobs} from '../../_lib/domestic-search-fetch.js';
const VERSION='HHBA_V7_RECALL_OIDC_EVAL_20261108_V1';
const AUDIENCE='hhba-v7-recall-20261108';
const BRANCH='refs/heads/feature/match-v7-qualification-recall-eval-20261108';
const WORKFLOW='yanm-jun/hhba-talent/.github/workflows/hhba-v7-recall-live-eval.yml@'+BRANCH;
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
 const marker='HHBA_V7_RECALL_CONTENT_SEARCH_20261108';
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
 return respond({kind:VERSION,status:'PROTECTED_RECALL_EVAL_ONLY'});
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
 if(input?.mode!=='content'||Object.keys(input).length!==1)
  return fail('INVALID_TEST_MODE',400);
 try{
  if(!await reserveOnce(env.HHBA_PNVS_AUTH_DB))return fail('TEST_ALREADY_EXECUTED',409);
  // Exactly 4 bounded Search and at most 8 Fetch calls, with the Preview-owned
  // key. Only this static, non-PII occupation is sent to the provider.
  const got=await discoverExternalOfficialJobs('内容运营',env.HHBA_MATCH_DEEPSEEK_KEY,
   {expanded:true});
  return respond({kind:VERSION,real_provider:true,
   query_scope:'CONTENT_OPERATIONS_MAINLAND',
   status:got.status,usage:got.usage,failures:got.failures,
   max_search_requests:got.max_search_requests,max_fetch_requests:got.max_fetch_requests,
   official_candidate_count:got.candidate_count,
   candidates:got.candidates.slice(0,8).map(x=>({
    company:x.company,title:x.title,location:x.location,
    official_domain:x.official_domain,official_url:x.official_url,
    application_status:x.application_status
   }))});
 }catch(e){
  return fail(typeof e?.code==='string'?e.code:'RECALL_EVALUATION_FAILED',502);
 }
}
