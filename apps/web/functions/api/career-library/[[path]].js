// Preview-only, public taxonomy browser. NEVER returns resumes or inferred job vacancies.
import {careerLibraryIndex,automotiveLibrary,libraryReadable} from '../../_lib/hhba-career-library-v1.js';
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
export async function onRequest({request,env}){
 if(request.method!=='GET')return send({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 if(!libraryReadable(env))return send({ok:false,error:'CAREER_LIBRARY_PREVIEW_ONLY'},404);
 const url=new URL(request.url);
 const route=url.pathname.slice('/api/career-library'.length).replace(/\/$/,'');
 if(!['','/automotive'].includes(route))return send({ok:false,error:'HALL_NOT_YET_OPEN'},404);
 try{
  const result=route===''?
   await careerLibraryIndex(env.HHBA_PNVS_AUTH_DB):
   await automotiveLibrary(env.HHBA_PNVS_AUTH_DB,{
    major:url.searchParams.get('major')||'',
    role:url.searchParams.get('role')||''
   });
  if(result?.error)return send({ok:false,...result},result.status||500);
  return send({ok:true,...result});
 }catch(error){
  console.error('HHBA_LIBRARY_READ_FAILED',error?.name||'Error');
  return send({ok:false,error:'CAREER_LIBRARY_UNAVAILABLE'},503);
 }
}
