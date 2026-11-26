import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {MATCH_PRICE_FEN,matchPaymentRequired,matchPaymentConfigured,matchOrderId,currentMatchOrder,ownedMatchOrder,publicMatchOrder,createOrResumeMatchOrder,reconcileMatchOrder,closeUnpaidMatchOrder,acceptMatchPaymentNotification} from '../../_lib/v4-match-payment.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
const fail=(error,status=400)=>json({ok:false,error},status);
export async function onRequest({request,env}){
 const u=new URL(request.url),path=u.pathname.slice('/api/match-payment'.length).replace(/\/$/,'')||'/',method=request.method;
 const host=u.protocol==='https:'&&['hhba.work','www.hhba.work'].includes(u.hostname),db=env.HHBA_PNVS_AUTH_DB;
 if(!host||!db?.prepare)return fail('NOT_FOUND',404);
 if(path==='/alipay/notify'){
  if(method!=='POST'||u.hostname!=='hhba.work'||!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('Content-Type')||''))return new Response('failure',{status:400});
  try{const raw=await request.text();if(raw.length>8192)return new Response('failure',{status:413});const ok=await acceptMatchPaymentNotification(env,new URLSearchParams(raw));return new Response(ok?'success':'failure',{status:ok?200:400,headers:{'Cache-Control':'no-store','Content-Type':'text/plain'}});}catch{return new Response('failure',{status:500});}
 }
 if(request.headers.get('Sec-Fetch-Site')==='cross-site'||method!=='GET'&&request.headers.get('Origin')!==u.origin)return fail('ORIGIN_REQUIRED',403);
 let session;
 try{session=await sessionOfBearer(db,request,Date.now());if(!session)return fail('SESSION_INVALID',401);if((await getUserByPhone(db,session.phone))?.role!=='candidate')return fail('FORBIDDEN',403);}catch{return fail('SESSION_CHECK_FAILED',503);}
 const required=matchPaymentRequired(env),enabled=matchPaymentConfigured(env)&&required;
 try{
  if(method==='GET'&&path==='/status')return json({ok:true,required,enabled,amountFen:MATCH_PRICE_FEN,order:required?publicMatchOrder(await currentMatchOrder(db,session.phone)):null});
  if(method!=='POST'||!enabled)return fail('MATCH_PAYMENT_NOT_ENABLED',503);
  if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return fail('INVALID_REQUEST',415);
  const raw=await request.text();if(raw.length>512)return fail('INVALID_REQUEST',413);
  let body;try{body=JSON.parse(raw);}catch{return fail('INVALID_REQUEST');}
  if(path==='/order')return json({ok:true,required,enabled,amountFen:MATCH_PRICE_FEN,order:publicMatchOrder(await createOrResumeMatchOrder(env,session.phone))});
  if(!matchOrderId(body?.id))return fail('INVALID_ORDER_ID');
  const own=await ownedMatchOrder(db,session.phone,body.id);if(!own)return fail('ORDER_NOT_FOUND',404);
  if(path==='/order/status'||path==='/order/close'){
   const next=path.endsWith('/close')?await closeUnpaidMatchOrder(env,own):await reconcileMatchOrder(env,own);
   return json({ok:true,required,enabled,amountFen:MATCH_PRICE_FEN,order:publicMatchOrder(next)});
  }
  return fail('NOT_FOUND',404);
 }catch(e){return fail(e?.code||'MATCH_PAYMENT_GATEWAY_UNCERTAIN',e?.status||503);}
}
