// Preview-first whole-resume AI writer. Candidate-only, explicit third-party
// consent, never stores source documents or model responses in D1/R2.
// No artificial 5-suggestion/3-per-day product cap. External abuse controls
// and authenticated access remain mandatory before any production rollout.
import {sessionOfBearer,getUserByPhone} from '../_lib/real-auth.js';
import {generateTailoredResume,REWRITE_KIND} from '../_lib/resume-rewrite-provider.js';
const MAX_BODY=1024*1024;
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}
});
const reject=(error,status)=>json({ok:false,error},status);
const active=env=>env?.HHBA_RESUME_REWRITE_ENABLED==='1'&&
 ((env?.HHBA_AUTH_ROLLOUT==='preview')||
  (env?.HHBA_MATCH_RUNTIME_MODE==='production'&&
   env?.HHBA_RESUME_REWRITE_PRODUCTION_ALLOWED==='1'))&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
function originOK(request){
 const url=new URL(request.url);
 return request.headers.get('Origin')===url.origin&&
  request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function boundedJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('INVALID_REQUEST');
 const declared=request.headers.get('Content-Length');
 if(!request.body||declared!==null&&
  (!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))
  throw Error('INVALID_REQUEST');
 const reader=request.body.getReader(),chunks=[];let total=0;
 try{for(;;){
  const chunk=await reader.read();if(chunk.done)break;
  total+=chunk.value.byteLength;
  if(total>MAX_BODY){await reader.cancel();throw Error('INVALID_REQUEST');}
  chunks.push(chunk.value);
 }}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('INVALID_REQUEST');}
}
export async function onRequestGet({env}){
 let configured=false;
 try{
  const {selectProvider}=await import('../_lib/resume-ai-provider.js');
  selectProvider(env,'resume_rewrite');configured=true;
 }catch{}
 return json({ok:true,kind:REWRITE_KIND,enabled:active(env)&&configured,
  configured,mode:'full_document_draft',requires_user_approval:true});
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return reject('ORIGIN_REQUIRED',403);
 if(!active(env))return reject('RESUME_REWRITE_NOT_ENABLED',503);
 let session;
 try{
  session=await sessionOfBearer(env.HHBA_PNVS_AUTH_DB,request,Date.now());
  if(!session)return reject('SESSION_INVALID',401);
  const user=await getUserByPhone(env.HHBA_PNVS_AUTH_DB,session.phone);
  if(user?.role!=='candidate')return reject('FORBIDDEN',403);
 }catch{return reject('SESSION_INVALID',401);}
 let body;
 try{body=await boundedJson(request);}
 catch{return reject('INVALID_REQUEST',400);}
 if(body?.consent_ai!==true)return reject('AI_CONSENT_REQUIRED',400);
 try{
  const result=await generateTailoredResume({
   env,blocks:body.blocks,job:body.job,
   signal:AbortSignal.timeout(150000)
  });
  return json(result);
 }catch(e){
  const allowed=new Set(['INVALID_REWRITE_INPUT','AI_PROVIDER_NOT_CONFIGURED',
   'AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_RATE_LIMITED',
   'AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
   'AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_UPSTREAM_ERROR',
   'AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK_ERROR',
   'AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY',
   'AI_PROVIDER_RESPONSE_JSON_INVALID','AI_PROVIDER_RESPONSE_TRUNCATED',
   'AI_PROVIDER_RESPONSE_HTTP_INVALID','AI_PROVIDER_UNEXPECTED_REDIRECT']);
  const code=allowed.has(e?.message)?e.message:'AI_RESUME_REWRITE_FAILED';
  // Never log resume text, provider payloads, credentials or private names.
  console.warn('HHBA_FULL_REWRITE_FAILED',code);
  return reject(code,code==='INVALID_REWRITE_INPUT'?400:
   code==='AI_PROVIDER_RATE_LIMITED'?429:code==='AI_PROVIDER_NOT_CONFIGURED'?503:502);
 }
}
