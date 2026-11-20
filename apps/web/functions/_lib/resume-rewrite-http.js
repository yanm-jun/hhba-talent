/** Shared security boundary for the two private candidate AI editing routes. */
import {sessionOfBearer,getUserByPhone} from './real-auth.js';

const MAX_BODY=2*1024*1024;
export const responseJson=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}
});
export const rejectJson=(error,status)=>responseJson({ok:false,error},status);
export const rewriteActive=env=>env?.HHBA_RESUME_REWRITE_ENABLED==='1'&&
 ((env?.HHBA_AUTH_ROLLOUT==='preview')||
  (env?.HHBA_MATCH_RUNTIME_MODE==='production'&&
   env?.HHBA_RESUME_REWRITE_PRODUCTION_ALLOWED==='1'))&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
/** Production continuation remains separately gated until idempotency and
 * per-account anti-replay accounting are deployed. Preview works on Free. */
export const rewriteContinuationActive=env=>rewriteActive(env)&&
 env?.HHBA_RESUME_AGENT_ENABLED!=='0'&&
 typeof env?.HHBA_RESUME_AGENT_CHECKPOINT_SECRET==='string'&&
 env.HHBA_RESUME_AGENT_CHECKPOINT_SECRET.length>=32&&
 (env?.HHBA_AUTH_ROLLOUT==='preview'||
  env?.HHBA_RESUME_AGENT_CONTINUE_PRODUCTION_ALLOWED==='1');
export function rewriteOriginOK(request){
 const url=new URL(request.url);
 return request.headers.get('Origin')===url.origin&&
  request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export async function rewriteRequestJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  throw Error('INVALID_REQUEST');
 const declared=request.headers.get('Content-Length');
 if(!request.body||declared!==null&&
  (!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))
  throw Error('INVALID_REQUEST');
 const reader=request.body.getReader(),chunks=[];let total=0;
 try{
  for(;;){
   const chunk=await reader.read();if(chunk.done)break;
   total+=chunk.value.byteLength;
   if(total>MAX_BODY){await reader.cancel();throw Error('INVALID_REQUEST');}
   chunks.push(chunk.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('INVALID_REQUEST');}
}
export async function candidateIdentity(request,env){
 const session=await sessionOfBearer(env.HHBA_PNVS_AUTH_DB,request,Date.now());
 if(!session)throw Error('SESSION_INVALID');
 const user=await getUserByPhone(env.HHBA_PNVS_AUTH_DB,session.phone);
 if(user?.role!=='candidate')throw Error('FORBIDDEN');
 return session.phone;
}
