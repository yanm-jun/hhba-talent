// HHBA real candidate workspace API. Every request is bound to a verified
// PNVS bearer session; no device ID, caller-supplied phone or mock identity
// may select another user's profile, preferences or saved jobs.
import {getUserByPhone,sessionOfBearer} from '../../_lib/real-auth.js';
import {assetJson} from '../../_lib/metric-utils.js';

const response=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
});
const fail=(code,status)=>response({ok:false,error:code},status);
const jobPattern=/^[A-Za-z0-9_-]{1,180}$/;
const fields={
 profile:{display_name:32,headline:110,city:70,intro:380,skills:150},
 preferences:{preferred_role:70,preferred_city:70}
};
const workModes=new Set(['不限','远程','现场','混合办公']);
function validInputs(body,section){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const allowed=fields[section],result={};
 for(const [field,max] of Object.entries(allowed)){
  const value=body[field];
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return null;
  result[field]=value.trim();
 }
 if(section==='preferences'){
  if(!workModes.has(body.work_mode))return null;
  result.work_mode=body.work_mode;
 }
 return result;
}
async function postedJson(request){
 try{const body=await request.json();return body&&typeof body==='object'?body:null;}catch{return null;}
}
const profileDefaults={display_name:'',headline:'',city:'',intro:'',skills:'',
 preferred_role:'',preferred_city:'',work_mode:'不限'};
// Validate against published, source-audited IDs rather than the browser's
// displayed job object. The old snapshot alone omits curated + V2 positions.
async function inPublishedJobIndex(env,request,id){
 let checked=false;
 const sources=[
  ['/data/jobs.json','snapshot'],
  ['/data/saveable-domestic-job-ids.json','domestic'],
  ['/curated/v1/jobs.json','curated']
 ];
 for(const [path,type] of sources){
  let data;
  try{data=await assetJson(env,request,path);}catch{continue}
  if(type==='snapshot'&&Array.isArray(data?.jobs)){
   checked=true;
   if(data.jobs.some(job=>job?.id===id))return true;
  }
  if(type==='domestic'&&data?.kind==='HHBA_SAVEABLE_DOMESTIC_JOBS_V1'&&
     Array.isArray(data.ids)&&data.ids.length===data.count&&data.ids.length>0){
   checked=true;
   if(data.ids.includes(id))return true;
  }
  if(type==='curated'&&data?.kind==='HHBA_CURATED_JOBS_V1'&&Array.isArray(data.jobs)){
   checked=true;
   if(data.jobs.some(job=>job?.id==='curated-'+id))return true;
  }
 }
 if(!checked)throw Error('BOOKMARK_INDEX_NOT_DEPLOYED');
 return false;
}
export async function onRequest({request,env}){
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!db)return fail('WORKSPACE_DB_NOT_CONFIGURED',503);
 const session=await sessionOfBearer(db,request,Date.now());
 if(!session)return fail('SESSION_INVALID',401);
 const user=await getUserByPhone(db,session.phone);
 if(!user||user.role!=='candidate')return fail('FORBIDDEN',403);
 const phone=session.phone;
 const path=new URL(request.url).pathname;
 const tail=path.slice('/api/account'.length).replace(/\/$/,'')||'/';
 const method=request.method;
 if(['PUT','POST','DELETE'].includes(method)){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return fail('ORIGIN_REQUIRED',403);
 }
 try{
  if(tail==='/profile'||tail==='/preferences'){
   if(method==='GET'){
    const row=await db.prepare('SELECT * FROM hhba_candidate_profiles WHERE phone=?').bind(phone).first();
    return response({ok:true,kind:'HHBA_AUTHENTICATED_CANDIDATE_V1',
     data:{...profileDefaults,...(row?Object.fromEntries(Object.keys(profileDefaults).map(k=>[k,row[k]??profileDefaults[k]])):{}),
      display_name:row?.display_name||user.username||''}});
   }
   if(method==='PUT'){
    const input=validInputs(await postedJson(request),tail.slice(1));
    if(!input)return fail('INVALID_ACCOUNT_FIELDS',400);
    const columns=Object.keys(input),values=Object.values(input);
    // Upsert only caller-owned fields, preserve other section on update.
    const now=new Date().toISOString();
    const sql='INSERT INTO hhba_candidate_profiles (phone,'+columns.join(',')+',updated_at) VALUES ('+
      ['?',...columns.map(()=>'?'),'?'].join(',')+
      ') ON CONFLICT(phone) DO UPDATE SET '+
      columns.map(k=>k+'=excluded.'+k).join(',')+',updated_at=excluded.updated_at';
    await db.prepare(sql).bind(phone,...values,now).run();
    return response({ok:true,updated_at:now});
   }
  }
  if(tail==='/saved'&&method==='GET'){
   const result=await db.prepare('SELECT job_id AS jobId,saved_at AS savedAt FROM hhba_candidate_saved_jobs WHERE phone=? ORDER BY saved_at DESC LIMIT 300').bind(phone).all();
   return response({kind:'HHBA_ACCOUNT_SAVED_JOBS_V1',items:result.results||[]});
  }
  const match=tail.match(/^\/saved\/([A-Za-z0-9_-]{1,180})$/);
  if(match&&['PUT','DELETE'].includes(method)){
   const id=match[1];
   if(!jobPattern.test(id))return fail('INVALID_JOB_ID',400);
   if(method==='PUT'){
    if(!await inPublishedJobIndex(env,request,id))
      return fail('JOB_NOT_IN_VERIFIED_INDEX',404);
    const total=await db.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_saved_jobs WHERE phone=?').bind(phone).first();
    const previous=await db.prepare('SELECT job_id FROM hhba_candidate_saved_jobs WHERE phone=? AND job_id=?').bind(phone,id).first();
    if(!previous&&Number(total?.n)>=300)return fail('SAVED_LIMIT_REACHED',409);
    await db.prepare('INSERT OR IGNORE INTO hhba_candidate_saved_jobs(phone,job_id,saved_at) VALUES(?,?,?)')
      .bind(phone,id,new Date().toISOString()).run();
   }else{
    await db.prepare('DELETE FROM hhba_candidate_saved_jobs WHERE phone=? AND job_id=?').bind(phone,id).run();
   }
   return response({kind:'HHBA_ACCOUNT_SAVED_JOBS_V1',jobId:id,saved:method==='PUT'});
  }
  return fail('METHOD_NOT_ALLOWED',405);
 }catch(e){
  console.error('HHBA_ACCOUNT_WORKSPACE_FAILED',e?.name||'error');
  return fail('WORKSPACE_UNAVAILABLE',503);
 }
}
