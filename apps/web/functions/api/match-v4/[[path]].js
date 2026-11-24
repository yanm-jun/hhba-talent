/**
 * HHBA V4 single-purpose authenticated endpoint.
 * GET /api/match-v4/status and POST /api/match-v4/resume.
 * Reuses existing resume upload and results modal. Preview only until tested.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {v4Provider,v4Match} from '../../_lib/simple-match-v4.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {recognizeV4Resume} from '../../_lib/v4-resume-ocr.js';
import {claimAiCheckpoint} from '../../_lib/ai-checkpoint-claim.js';
import {issueCheckpoint,verifyCheckpoint} from '../../_lib/resume-rewrite-checkpoint.js';

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
const checkpointEnv=env=>{
 const secret=env?.HHBA_MATCH_V4_CHECKPOINT_SECRET||env?.HHBA_RESUME_AGENT_CHECKPOINT_SECRET;
 return typeof secret==='string'&&secret.length>=32?{HHBA_RESUME_AGENT_CHECKPOINT_SECRET:'hhba-v4-match:'+secret}:null;
};
const checkpointArgs=(env,input,draft)=>({env:checkpointEnv(env),account:input.phone,blocks:[input.text],job:{role:input.role_hint,excludeUrls:input.excludeUrls,resume_id:input.resume_id},draft});
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
    let succeeded=false;
    try{
     const result=await v4Match(fetch,v4Provider(env),input.text,input.role_hint,{
      signal:request.signal,onProgress:progress,onActivity:activity,env,excludeUrls:input.excludeUrls,
      stepMode:!!checkpointEnv(env),checkpoint:input.checkpoint||null,
      onPartial:matches=>sendJobs('partial',matches)});
     if(result.status==='CONTINUE'){
      const token=await issueCheckpoint(checkpointArgs(env,input,result.checkpoint));
      send('complete',{status:'CONTINUE',continuation:{state:result.checkpoint,token}});
      succeeded=true;
      return;
     }
     console.info('HHBA_V4_MATCH',JSON.stringify({result:'COMPLETE',
      found:result.matches.length,official:result.matched_official_jobs,
      duration_ms:Date.now()-started}));
     // Store only result metadata, never the resume or raw model prompt.
     try{
      const saved=await saveMatchHistory(env.HHBA_PNVS_AUTH_DB,input.phone,input.resume_id,input.role_hint,result.matches.map(job=>({...job,v4_source:true})));
      Object.assign(result,saved?{history_status:'SAVED',history_id:saved.id,new_job_count:saved.new_job_count,improved_job_count:saved.improved_job_count}:{history_status:'EMPTY'});
     }catch{result.history_status='UNAVAILABLE';console.warn('HHBA_V4_HISTORY_UNAVAILABLE');}
     sendJobs('final',result.matches);
     send('complete',{...result,matches:[],matches_streamed:true,match_count:result.matches.length});
     succeeded=true;
    }catch(e){
     const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
     console.warn('HHBA_V4_MATCH_ERROR',JSON.stringify({error:code,stage:phase,
      elapsed_ms:Date.now()-started}));
     send('failure',{error:code,phase,elapsed_ms:Date.now()-started});
    }finally{
     clearInterval(heart);
     if(input.claim&&!succeeded)await input.claim.release().catch(()=>console.warn('HHBA_CHECKPOINT_RELEASE_FAILED'));
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
   scope:'CN_MAINLAND_ONLY',formats:['pdf','docx'],resumable:!!checkpointEnv(env)});
 if(!['/resume','/ocr'].includes(suffix)||request.method!=='POST')return fail('NOT_FOUND',404);
 if(!enabled(env,request))return fail('MATCH_NOT_ENABLED',503);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||
  request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('ORIGIN_REQUIRED',403);
 if(suffix!=='/ocr'&&!(request.headers.get('Content-Type')||'').startsWith('application/json'))
  return fail('INVALID_REQUEST',415);
 if(suffix!=='/ocr'&&Number(request.headers.get('Content-Length')||0)>8000000)return fail('INVALID_RESUME_TEXT',413);
 const db=env.HHBA_PNVS_AUTH_DB;
 let session;
 try{session=await sessionOfBearer(db,request,Date.now())}catch{return fail('SESSION_INVALID',401)}
 if(!session)return fail('SESSION_INVALID',401);
 let candidate;
 try{candidate=await getUserByPhone(db,session.phone)}catch{return fail('SESSION_INVALID',401)}
 if(candidate?.role!=='candidate')return fail('FORBIDDEN',403);
 if(suffix==='/ocr'){
  try{return reply({ok:true,...await recognizeV4Resume(request,v4Provider(env))});}
  catch(e){return fail(e?.code||'OCR_SERVICE_UNAVAILABLE',e?.status||502);}
 }
 let body;
 try{
  const text=await request.text();
  if(text.length>8000000)return fail('INVALID_RESUME_TEXT',413);
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
 const input={text:resume,role_hint:role,excludeUrls,phone:session.phone,resume_id:body.resume_id||null};
 if(body.continuation!==undefined){
  if(!checkpointEnv(env)||!body.continuation?.state||typeof body.continuation.token!=='string')return fail('AI_CHECKPOINT_INVALID',409);
  try{
   await verifyCheckpoint({...checkpointArgs(env,input,body.continuation.state),token:body.continuation.token});
  }catch{return fail('AI_CHECKPOINT_INVALID',409)}
  if(env?.HHBA_V4_CHECKPOINT_REPLAY_PROTECTION==='1'){
   try{input.claim=await claimAiCheckpoint(db,body.continuation.token);if(!input.claim)return fail('AI_CHECKPOINT_ALREADY_USED',409);}
   catch{return fail('AI_CHECKPOINT_DB_UNAVAILABLE',503);}
  }
  input.checkpoint=body.continuation.state;
 }
 return events(env,request,input);
}
