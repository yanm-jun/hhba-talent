/**
 * HHBA V4 single-purpose authenticated endpoint.
 * GET /api/match-v4/status and POST /api/match-v4/resume.
 * Reuses existing resume upload and results modal. Preview only until tested.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {v4Provider,v4Match} from '../../_lib/simple-match-v4.js';

const KIND='HHBA_NATIVE_WEB_MATCH_V1';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex'}});
const fail=(code,status=400)=>reply({ok:false,error:code},status);
const preview=request=>{
 const u=new URL(request.url);
 return u.protocol==='https:'&&u.hostname.endsWith('.hhba-talent.pages.dev')&&
  u.hostname!=='hhba-talent.pages.dev';
};
const allowedHost=request=>{
 const u=new URL(request.url);
 return preview(request)||(u.protocol==='https:'&&
  ['hhba.work','www.hhba.work'].includes(u.hostname));
};
const enabled=(env,request)=>allowedHost(request)&&env?.HHBA_MATCH_V4_READY==='1'&&
 Boolean(v4Provider(env))&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
const sanitize=(raw)=>{
 if(typeof raw!=='string'||raw.length>250000)return null;
 const text=redactForModel(raw.trim(),Infinity);
 return text.replace(/\s/g,'').length>=30?text:null;
};
function events(env,request,input){
 const encoder=new TextEncoder();let closed=false,phase='preparing';
 const started=Date.now();
 const stream=new ReadableStream({
  start(controller){
   const send=(type,payload)=>{
    if(closed)return;
    try{controller.enqueue(encoder.encode('event: '+type+'\ndata: '+JSON.stringify(payload)+'\n\n'))}
    catch{closed=true;}
   };
   const heart=setInterval(()=>send('heartbeat',{stage:phase,
    elapsed_ms:Date.now()-started}),12000);
   const progress=stage=>{phase=stage;send('progress',{stage})};
   const activity=(stage,message)=>send('activity',{stage,message});
   const sendJobs=(kind,matches)=>{
    send(kind+'_begin',{count:matches.length});
    for(const job of matches)send(kind+'_job',{job});
    send(kind+'_end',{count:matches.length});
   };
   send('progress',{stage:'preparing'});
   void (async()=>{
    try{
     const result=await v4Match(fetch,v4Provider(env),input.text,input.role_hint,{
      signal:request.signal,onProgress:progress,onActivity:activity,env,excludeUrls:input.excludeUrls,
      onPartial:matches=>sendJobs('partial',matches)});
     console.info('HHBA_V4_MATCH',JSON.stringify({result:'COMPLETE',
      found:result.matches.length,official:result.matched_official_jobs,
      duration_ms:Date.now()-started}));
     sendJobs('final',result.matches);
     send('complete',{...result,matches:[],matches_streamed:true,match_count:result.matches.length});
    }catch(e){
     const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
     console.warn('HHBA_V4_MATCH_ERROR',JSON.stringify({error:code,stage:phase,
      elapsed_ms:Date.now()-started}));
     send('failure',{error:code,phase,elapsed_ms:Date.now()-started});
    }finally{
     clearInterval(heart);
     if(!closed){closed=true;try{controller.close()}catch{}}
    }
   })();
  },
  cancel(){closed=true;}
 });
 return new Response(stream,{status:200,headers:{
  'Content-Type':'text/event-stream; charset=utf-8',
  'Cache-Control':'private, no-store, no-transform',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex','X-Accel-Buffering':'no'}});
}
export async function onRequest({request,env}){
 const path=new URL(request.url).pathname;
 const suffix=path.slice('/api/match-v4'.length).replace(/\/$/,'')||'/';
 if(suffix==='/status'&&request.method==='GET')
  return reply({kind:KIND,engine:'HHBA_SIMPLE_AI_V4',enabled:enabled(env,request),
   scope:'CN_MAINLAND_ONLY',formats:['pdf','docx']});
 if(suffix!=='/resume'||request.method!=='POST')return fail('NOT_FOUND',404);
 if(!enabled(env,request))return fail('MATCH_NOT_ENABLED',503);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||
  request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('ORIGIN_REQUIRED',403);
 if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))
  return fail('INVALID_REQUEST',415);
 if(Number(request.headers.get('Content-Length')||0)>1200000)return fail('INVALID_RESUME_TEXT',413);
 const db=env.HHBA_PNVS_AUTH_DB;
 let session;
 try{session=await sessionOfBearer(db,request,Date.now())}catch{return fail('SESSION_INVALID',401)}
 if(!session)return fail('SESSION_INVALID',401);
 let candidate;
 try{candidate=await getUserByPhone(db,session.phone)}catch{return fail('SESSION_INVALID',401)}
 if(candidate?.role!=='candidate')return fail('FORBIDDEN',403);
 let body;
 try{
  const text=await request.text();
  if(text.length>1200000)return fail('INVALID_RESUME_TEXT',413);
  body=JSON.parse(text);
 }catch{return fail('INVALID_REQUEST',400)}
 // The third-party relay is not OpenAI official infrastructure.
 if(body?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',403);
 if(body?.options?.country!=='CN')return fail('INVALID_REQUEST',400);
 const resume=sanitize(body.text);
 if(!resume)return fail('INVALID_RESUME_TEXT',400);
 const role=typeof body?.options?.role_hint==='string'?
  body.options.role_hint.trim():'';
 const excludeUrls=Array.isArray(body?.options?.exclude_urls)?body.options.exclude_urls.filter(x=>typeof x==='string'):[];
 // Do not store raw resume, query, job results, or model output in server logs.
 return events(env,request,{text:resume,role_hint:role,excludeUrls});
}
