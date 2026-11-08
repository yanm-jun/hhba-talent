// TEMPORARY V7 ONLY — authenticated, one-shot, synthetic live API acceptance.
// Remove this route and the corresponding workflow before merging to main.
import {aiExtract,officialJobs} from './[[path]].js';
import {selectAuditedMatches,redactForModel} from '../../_lib/resume-match-core.js';
import {fuseDomesticJobRecommendations} from '../../_lib/domestic-match-fusion.js';
import {discoverExternalOfficialJobs,ExternalSearchError} from '../../_lib/domestic-search-fetch.js';
import {isMainlandJobLocation} from '../../_lib/mainland-job-location.js';

const VERSION='HHBA_V7_GITHUB_OIDC_EVAL_20261108_V1';
const AUDIENCE='hhba-v7-acceptance-20261108';
const BRANCH='refs/heads/feature/match-v7-qualification-recall-eval-20261108';
const WORKFLOW='yanm-jun/hhba-talent/.github/workflows/hhba-v7-oidc-live-eval.yml@'+BRANCH;
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
async function reserveOnce(db,mode){
 const marker='HHBA_V7_GITHUB_OIDC_EVAL_'+mode;
 const stamp=new Date().toISOString();
 const attempt=await db.prepare(
  'INSERT INTO hhba_resume_match_requests(request_id,day_utc,account_hash,created_at) '+
  'SELECT ?,?,?,? WHERE NOT EXISTS '+
  '(SELECT 1 FROM hhba_resume_match_requests WHERE account_hash=?)'
 ).bind(crypto.randomUUID(),stamp.slice(0,10),marker,stamp,marker).run();
 return attempt?.success===true&&attempt?.meta?.changes===1;
}
const FIXTURES={
 software:{role:'Python 开发工程师',text:[
  '学历：软件工程专业本科。','2022年7月至2025年7月，全职担任软件开发工程师，累计全职工作3年。',
  '主要负责后端接口开发、SQL数据查询、应用部署和故障定位。','技能：Python、SQL、Git、Linux。',
  '求职意向：Python开发工程师；希望在中国大陆北京或上海工作。'
 ].join('\n')},
 transfer:{role:'内容运营',text:[
  '学历：市场营销专业本科。','2022年7月至2025年7月，全职担任汽车销售顾问，累计全职工作3年。',
  '负责客户咨询、销售数据分析、线下营销活动执行和项目管理。',
  '技能：项目管理、数据分析、Excel、客户沟通。','求职意向：内容运营，愿意转岗，从事内容策划与用户增长相关工作。',
  '未担任过内容运营岗位，没有声称有内容运营任职经验。'
 ].join('\n')}
};
async function checkBalance(key){
 const r=await fetch('https://api.deepseek.com/user/balance',{
  method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000),
  headers:{Authorization:'Bearer '+key,Accept:'application/json'}
 });
 if(!r.ok)return {state:'PROVIDER_HTTP_'+r.status};
 const b=await r.json();
 return {state:b?.is_available===true?'READY':b?.is_available===false?'NO_BALANCE':'INVALID_REPLY'};
}
async function matchSynthetic(env,origin,which){
 const fx=FIXTURES[which];
 const profile=await aiExtract(env.HHBA_MATCH_DEEPSEEK_KEY,redactForModel(fx.text),fx.role);
 const docs=await officialJobs(env,origin);
 const candidates=selectAuditedMatches(docs.snapshot,docs.audit,docs.facets,profile,
  {role_hint:fx.role,country:'CN',remote_only:false,candidate_pool_limit:1200},Date.now());
 const fusion=fuseDomesticJobRecommendations(candidates.matches,[],profile,
  {role_hint:fx.role,country:'CN',remote_only:false,limit:10},Date.now());
 const jobs=fusion.matches||[];
 return {kind:'SYNTHETIC_MODEL_MATCH',fixture:which,
  extraction:{education:profile.education,experience_years:profile.experience_years,
   skills:profile.skills.map(x=>x.name).slice(0,12),
   career_intents:profile.career_intents,demonstrated_roles:profile.demonstrated_roles},
  candidate_count:candidates.matches.length,matched_count:jobs.length,
  all_mainland:jobs.every(x=>isMainlandJobLocation(x.location)),
  score_sorted:jobs.every((j,i)=>!i||jobs[i-1].reference_score>=j.reference_score),
  top10:jobs.map(x=>({company:x.company,title:x.title,city:x.location,
   score:x.reference_score,source:x.source_type})),
  needs_information:fusion.qualification_review_count};
}
export async function onRequestGet({request,env}){
 if(!ready(env,request))return fail('NOT_FOUND',404);
 return respond({kind:VERSION,status:'AUTHENTICATED_TEST_ONLY'});
}
export async function onRequestPost({request,env}){
 if(!ready(env,request))return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)
  return fail('ORIGIN_BLOCKED',403);
 if(!await authorized(request))return fail('UNAUTHORIZED_GITHUB_IDENTITY',403);
 let body;
 try{
  if(Number(request.headers.get('Content-Length')||0)>100)throw Error('BODY_TOO_LARGE');
  const raw=await request.text();
  if(raw.length>100)throw Error('BODY_TOO_LARGE');
  body=JSON.parse(raw);
 }catch{return fail('INVALID_TEST_REQUEST',400);}
 const mode=body?.mode;
 if(!['check','software','transfer','search'].includes(mode)||Object.keys(body).length!==1)
  return fail('INVALID_TEST_MODE',400);
 try{
  const db=env.HHBA_PNVS_AUTH_DB;
  if(!await reserveOnce(db,mode))return fail('TEST_ALREADY_EXECUTED',409);
  if(mode==='check')return respond({kind:VERSION,mode,provider:await checkBalance(env.HHBA_MATCH_DEEPSEEK_KEY)});
  if(mode==='search'){
   const found=await discoverExternalOfficialJobs('Python 开发',env.HHBA_MATCH_DEEPSEEK_KEY,{expanded:true});
   return respond({kind:VERSION,mode,discovery:{status:found.status,usage:found.usage,
    failures:found.failures,candidate_count:found.candidate_count,
    candidates:found.candidates.slice(0,8).map(x=>({company:x.company,title:x.title,
     city:x.location,status:x.application_status,domain:x.official_domain}))}});
  }
  return respond({kind:VERSION,mode,result:await matchSynthetic(env,new URL(request.url).origin,mode)});
 }catch(e){
  const error=e instanceof ExternalSearchError?e.code:
   typeof e?.matchCode==='string'?e.matchCode:
   e?.message==='OFFICIAL_JOB_INDEX_UNAVAILABLE'?'OFFICIAL_JOB_INDEX_UNAVAILABLE':'EVALUATION_FAILED';
  return fail(error,502);
 }
}
