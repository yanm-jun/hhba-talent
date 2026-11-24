import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {backgroundStorageReady,backgroundReady,createBackground,uploadBackgroundPart,queueBackground,backgroundState,cancelBackground,resumeBackground,advanceBackground} from '../../_lib/v4-background-match.js';
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
const fail=(error,status)=>send({ok:false,error},status);
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0;};
export async function onRequest({request,env}){
 const url=new URL(request.url),route=url.pathname.slice('/api/match-background'.length).replace(/\/$/,'');
 const ready=backgroundReady(env);
 if(route==='/status'&&request.method==='GET')return send({ok:true,enabled:ready});
 if(!ready&&!(backgroundStorageReady(env)&&(/^\/[0-9a-f-]{36}(?:\/cancel)?$/i.test(route))))return fail('BACKGROUND_NOT_ENABLED',503);
 if(route==='/tick'&&request.method==='POST'){
  if(!same(request.headers.get('X-HHBA-Background-Secret'),env.HHBA_V4_BACKGROUND_SECRET))return fail('FORBIDDEN',403);
  const result=await advanceBackground(env);return send({ok:true,...result});
 }
 if(request.method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))return fail('ORIGIN_REQUIRED',403);
 const db=env.HHBA_PNVS_AUTH_DB;
 let session;try{session=await sessionOfBearer(db,request,Date.now());if(!session)return fail('SESSION_INVALID',401);if((await getUserByPhone(db,session.phone))?.role!=='candidate')return fail('FORBIDDEN',403);}catch{return fail('SESSION_INVALID',401);}
 const phone=session.phone;
 const json=async()=>{const reader=request.body?.getReader();if(!reader)throw Error('INVALID_REQUEST');let n=0,parts=[];try{for(;;){const p=await reader.read();if(p.done)break;n+=p.value.byteLength;if(n>65536){await reader.cancel();throw Error('INVALID_REQUEST');}parts.push(p.value);}}finally{reader.releaseLock();}return JSON.parse(await new Blob(parts).text());};
 try{
  if(route==='/start'&&request.method==='POST')return send({ok:true,task:await createBackground(env,phone,await json())});
  const part=route.match(/^\/([0-9a-f-]{36})\/parts\/(\d+)$/i);
  if(part&&request.method==='PUT')return send({ok:true,task:await uploadBackgroundPart(env,phone,part[1],Number(part[2]),request)});
  const m=route.match(/^\/([0-9a-f-]{36})(?:\/(queue|cancel|resume))?$/i);
  if(!m)return fail('NOT_FOUND',404);
  if(!m[2]&&request.method==='GET'){const task=await backgroundState(env,phone,m[1]);return task?send({ok:true,task}):fail('BACKGROUND_NOT_FOUND',404);}
  if(request.method!=='POST')return fail('NOT_FOUND',404);
  if(m[2]==='queue')return send({ok:true,task:await queueBackground(env,phone,m[1],await json())});
  if(m[2]==='cancel')return await cancelBackground(env,phone,m[1])?send({ok:true}):fail('BACKGROUND_NOT_FOUND',404);
  if(m[2]==='resume')return await resumeBackground(env,phone,m[1])?send({ok:true}):fail('BACKGROUND_NOT_PAUSED',409);
  return fail('NOT_FOUND',404);
 }catch(e){const code=/^[A-Z0-9_]+$/.test(e?.message||'')?e.message:'BACKGROUND_UNAVAILABLE';return fail(code,code==='BACKGROUND_NOT_FOUND'?404:code==='BACKGROUND_UNAVAILABLE'?503:400);}
}
