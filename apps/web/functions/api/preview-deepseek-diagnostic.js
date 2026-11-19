// Preview-only, opt-in, zero-generation-cost diagnostic. This endpoint is OFF
// unless the short-lived Preview flag is explicitly enabled by an operator.
// It never returns API credentials, account balances or upstream response text.
import {selectProvider} from '../_lib/resume-ai-provider.js';
const KIND='HHBA_PREVIEW_DEEPSEEK_DIAGNOSTIC_V1';
const send=(result,status=200)=>new Response(JSON.stringify({kind:KIND,...result}),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}
});
function permitted(request,env){
 const url=new URL(request.url);
 return env?.HHBA_AUTH_ROLLOUT==='preview'&&env?.HHBA_PREVIEW_AI_DIAG_ENABLED==='1'&&
  /^[a-z0-9-]+\.hhba-talent\.pages\.dev$/i.test(url.hostname)&&
  request.headers.get('Origin')===url.origin&&
  request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function reserve(db){
 const row=await db.prepare(
  "INSERT INTO hhba_resume_optimization_attempts(request_id,day_utc,account_hash,created_at) "+
  "SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM hhba_resume_optimization_attempts "+
  "WHERE day_utc=? AND account_hash=?)<3"
 ).bind(crypto.randomUUID(),new Date().toISOString().slice(0,10),
  'hhba-preview-health-probe',new Date().toISOString(),
  new Date().toISOString().slice(0,10),'hhba-preview-health-probe').run();
 return row?.success===true&&row?.meta?.changes===1;
}
export async function onRequestPost({request,env}){
 if(!permitted(request,env))return send({ok:false,code:'PROBE_DISABLED'},404);
 if(typeof env.HHBA_PNVS_AUTH_DB?.prepare!=='function')
  return send({ok:false,code:'PROBE_DB_UNAVAILABLE'},503);
 let provider;
 try{provider=selectProvider(env);}catch{return send({ok:false,code:'PROVIDER_NOT_CONFIGURED'},503);}
 if(provider.name!=='deepseek')return send({ok:false,code:'PROVIDER_NOT_DEEPSEEK'},409);
 try{if(!await reserve(env.HHBA_PNVS_AUTH_DB))return send({ok:false,code:'PROBE_LIMIT'},429);}
 catch{return send({ok:false,code:'PROBE_DB_UNAVAILABLE'},503);}
 let response;
 try{
  response=await fetch('https://api.deepseek.com/user/balance',{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{Authorization:'Bearer '+provider.key,Accept:'application/json'}
  });
 }catch{return send({ok:false,code:'PROVIDER_NETWORK_ERROR'},502);}
 if(response.status===401||response.status===403)return send({ok:false,code:'PROVIDER_KEY_REJECTED'},200);
 if(response.status===402)return send({ok:false,code:'PROVIDER_BALANCE_EMPTY'},200);
 if(!response.ok)return send({ok:false,code:'PROVIDER_BALANCE_HTTP_'+response.status},200);
 let data;
 try{data=await response.json();}catch{return send({ok:false,code:'PROVIDER_BALANCE_INVALID'},200);}
 if(data?.is_available===false)return send({ok:false,code:'PROVIDER_BALANCE_EMPTY'},200);
 if(data?.is_available===true)return send({ok:true,code:'PROVIDER_BALANCE_AVAILABLE'},200);
 return send({ok:false,code:'PROVIDER_BALANCE_UNKNOWN'},200);
}
export async function onRequestGet(){return send({ok:false,code:'PROBE_DISABLED'},404);}
