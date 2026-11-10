// Authenticated recommendation consent and aggregate co-save signals.
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {bad,json,sameOrigin} from '../../_lib/metric-utils.js';
import {optInStatus,coSavedJobs,RECOMMENDATION_VERSION} from '../../_lib/recommendation-collab.js';
const reply=(data,status=200)=>json(data,status);
export async function onRequest({request,env}){
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!db)return bad('RECOMMENDATION_DATABASE_UNAVAILABLE');
 const route=new URL(request.url).pathname.replace(/\/$/,'');
 const tail=route.slice('/api/recommendations'.length);
 const method=request.method;
 if(!['/consent','/similar'].includes(tail))return bad('NOT_FOUND',404);
 if(!['GET','PUT','DELETE'].includes(method))return bad('METHOD_NOT_ALLOWED',405);
 if(tail==='/similar'&&method!=='GET')return bad('METHOD_NOT_ALLOWED',405);
 if(method!=='GET'&&!sameOrigin(request))return bad('ORIGIN_REQUIRED',403);
 try{
  const session=await sessionOfBearer(db,request,Date.now());
  if(!session)return bad('SESSION_REQUIRED',401);
  const user=await getUserByPhone(db,session.phone);
  if(!user||user.role!=='candidate')return bad('FORBIDDEN',403);
  if(tail==='/consent'){
   if(method==='GET')return reply({kind:'HHBA_RECOMMENDATION_CONSENT_V1',enabled:await optInStatus(db,session.phone)});
   if(method==='DELETE'){
    await db.prepare('DELETE FROM hhba_recommendation_consents WHERE phone=?').bind(session.phone).run();
    return reply({ok:true,enabled:false});
   }
   if(!(request.headers.get('content-type')||'').includes('application/json')||
     Number(request.headers.get('content-length')||0)>128)return bad('INVALID_BODY',400);
   const data=await request.json().catch(()=>null);
   if(!data||Object.keys(data).length!==1||data.enabled!==true)return bad('EXPLICIT_OPT_IN_REQUIRED',400);
   await db.prepare('INSERT INTO hhba_recommendation_consents(phone,enabled,updated_at) VALUES(?,1,?) ON CONFLICT(phone) DO UPDATE SET enabled=1,updated_at=excluded.updated_at')
    .bind(session.phone,new Date().toISOString()).run();
   return reply({ok:true,enabled:true});
  }
  const result=await coSavedJobs(db,session.phone);
  return reply({kind:'HHBA_HOME_COLLABORATIVE_V1',version:RECOMMENDATION_VERSION,...result});
 }catch(e){
  console.error('HHBA_RECOMMENDATION_QUERY_FAILED',e?.name||'error');
  return bad('RECOMMENDATION_STORAGE_NOT_READY');
 }
}
