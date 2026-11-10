// Private, user-scoped history of AI-recommended jobs. Not an application tracker.
// Creation is server-owned by /api/match-native; the client cannot upload results.
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {listMatchHistory,getMatchHistory,deleteMatchHistory,linkSavedResumeToHistory} from '../../_lib/match-history.js';
const KIND='HHBA_ACCOUNT_MATCH_HISTORY_V1';
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex',
 'Referrer-Policy':'no-referrer'
}});
const error=(code,status)=>send({ok:false,error:code},status);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sameSite(request){
 const u=new URL(request.url);
 return request.headers.get('Origin')===u.origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export async function onRequest({request,env}){
 const db=env.HHBA_PNVS_AUTH_DB;
 if(typeof db?.prepare!=='function')return error('MATCH_HISTORY_DB_UNAVAILABLE',503);
 const route=new URL(request.url).pathname.slice('/api/match-history'.length).replace(/\/$/,'');
 const method=request.method;
 if(['DELETE','POST'].includes(method)&&!sameSite(request))return error('ORIGIN_REQUIRED',403);
 let session;
 try{
  session=await sessionOfBearer(db,request,Date.now());
  if(!session)return error('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return error('FORBIDDEN',403);
 }catch{return error('SESSION_INVALID',401);}
 const id=route.match(/^\/([0-9a-f-]{36})$/i)?.[1];
 const link=route.match(/^\/([0-9a-f-]{36})\/link$/i)?.[1];
 try{
  if((route===''||route==='/')&&method==='GET')
   return send({ok:true,kind:KIND,items:await listMatchHistory(db,session.phone)});
  if(id&&uuid.test(id)&&method==='GET'){
   const item=await getMatchHistory(db,session.phone,id);
   return item?send({ok:true,kind:KIND,item}):error('MATCH_HISTORY_NOT_FOUND',404);
  }
  if(id&&uuid.test(id)&&method==='DELETE'){
   const removed=await deleteMatchHistory(db,session.phone,id);
   return removed?send({ok:true,deleted:true,id}):error('MATCH_HISTORY_NOT_FOUND',404);
  }
  if(link&&uuid.test(link)&&method==='POST'){
   let body;
   try{const raw=await request.text();if(raw.length>320)throw Error('size');body=JSON.parse(raw);}
   catch{return error('INVALID_HISTORY_LINK',400);}
   if(typeof body?.resume_id!=='string'||!uuid.test(body.resume_id))
    return error('INVALID_HISTORY_LINK',400);
   try{
    const ok=await linkSavedResumeToHistory(db,session.phone,link,body.resume_id);
    return ok?send({ok:true,id:link,resume_id:body.resume_id}):error('MATCH_HISTORY_NOT_FOUND',404);
   }catch(e){return error(e?.message==='RESUME_NOT_OWNED'?'RESUME_NOT_OWNED':'INVALID_HISTORY_LINK',404);}
  }
  return error('NOT_FOUND',404);
 }catch(e){
  // Missing additive D1 migration must fail visibly, never masquerade as "0 history".
  console.warn('HHBA_MATCH_HISTORY_UNAVAILABLE',e?.name||'UnknownError');
  return error('MATCH_HISTORY_DB_NOT_READY',503);
 }
}
