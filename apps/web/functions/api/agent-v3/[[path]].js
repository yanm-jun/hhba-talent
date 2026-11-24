/**
 * HHBA Agent V3 endpoint. Entirely independent of the retired matching
 * backends. Never makes a paid call during a status request.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {resolveAgentProvider,probeAgentV3} from '../../_lib/agent-v3-provider.js';
import {analyzeCandidateResume} from '../../_lib/agent-v3-understanding.js';

const headers={'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-robots-tag':'noindex'};
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const error=(code,status)=>send({ok:false,error:code},status);
const previewHost=request=>{
 try{
  const h=new URL(request.url).hostname.toLowerCase();
  return h.endsWith('.hhba-talent.pages.dev')&&h!=='hhba-talent.pages.dev';
 }catch{return false}
};
const sameOrigin=request=>{
 try{return request.headers.get('origin')===new URL(request.url).origin&&
  request.headers.get('sec-fetch-site')!=='cross-site'}catch{return false}
};
const enabled=(env,request)=>previewHost(request)&&env?.HHBA_AGENT_V3_ENABLED==='1';
async function candidate(env,request){
 try{
  const db=env.HHBA_PNVS_AUTH_DB;
  if(typeof db?.prepare!=='function')return null;
  const session=await sessionOfBearer(db,request,Date.now());
  if(!session)return null;
  const user=await getUserByPhone(db,session.phone);
  return user?.role==='candidate'?session:null;
 }catch{return null}
}
async function readJson(request,limit=26000){
 const size=Number(request.headers.get('content-length')||0);
 if(size>limit)throw Error('INVALID_BODY');
 const raw=await request.text();
 if(raw.length>limit)throw Error('INVALID_BODY');
 return JSON.parse(raw);
}
export async function onRequest({request,env}){
 const pathname=new URL(request.url).pathname;
 const tail=pathname.slice('/api/agent-v3'.length).replace(/\/$/,'')||'/';
 const provider=resolveAgentProvider(env);
 if(tail==='/status'&&request.method==='GET')
  return send({kind:'HHBA_AGENT_V3',enabled:enabled(env,request),
   provider:provider?.name||'not_configured',model:provider?.model||null,
   review_model:provider?.reviewModel||null,
   relay_mode:provider?.name==='relay',protocol:'responses',
   stage:'INDEPENDENT_PREVIEW_ONLY',real_provider_verified:false});
 if(!['/analyze','/provider-check'].includes(tail)||request.method!=='POST')
  return error('NOT_FOUND',404);
 if(!previewHost(request))return error('NOT_FOUND',404);
 if(!sameOrigin(request))return error('ORIGIN_REQUIRED',403);
 const available=tail==='/provider-check'?
  env?.HHBA_AGENT_V3_DIAGNOSTICS_ENABLED==='1':enabled(env,request);
 if(!available)return error('AGENT_V3_NOT_ENABLED',503);
 if(!provider)return error('AI_PROVIDER_NOT_CONFIGURED',503);
 if(!await candidate(env,request))return error('SESSION_INVALID',401);
 let input;
 try{input=await readJson(request)}catch{return error('INVALID_INPUT',400)}
 if(input?.consent!==true)return error('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
 if(tail==='/provider-check'){
  if(input.scenario!=='synthetic_provider_probe'||Object.keys(input)
   .some(k=>!['consent','scenario'].includes(k)))
   return error('INVALID_DIAGNOSTIC_INPUT',400);
  try{
   const result=await probeAgentV3(fetch,provider,{signal:request.signal});
   return send({ok:true,...result});
  }catch(e){return error(e?.code||'AI_PROVIDER_UNAVAILABLE',502)}
 }
 if(typeof input.resume_text!=='string'||input.resume_text.length>24000||
  Object.keys(input).some(k=>!['consent','resume_text'].includes(k)))
  return error('INVALID_RESUME_TEXT',400);
 try{
  const profile=await analyzeCandidateResume(fetch,provider,input.resume_text,
   {signal:request.signal});
  return send({ok:true,status:'ANALYZED',profile,
   next:'USER_CHOOSE_DIRECTIONS',
   note:'这只是理解阶段。AI不在此阶段提前查询招聘或修改简历。'});
 }catch(e){
  const code=typeof e?.code==='string'?e.code:'AI_PROFILE_UNAVAILABLE';
  // Only safe error codes; no tokens, URLs, CV or provider response bodies.
  console.warn('HHBA_AGENT_V3_ANALYZE_FAILED',code);
  return error(code,code==='INVALID_RESUME_TEXT'||code==='AI_PROFILE_INCOMPLETE'?422:502);
 }
}
