/**
 * HHBA V4 single-purpose authenticated endpoint.
 * GET /api/match-v4/status and POST /api/match-v4/resume.
 * Reuses existing resume upload and results modal. Preview only until tested.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {qualifiedReport} from '../../_lib/v4-curated-reports.js';
import {isCommercialRecruitmentBoard} from '../../_lib/match-employer-source.js';
import {v4Provider,v4Match,isV4RetryableProviderError} from '../../_lib/simple-match-v4.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {recognizeV4Resume} from '../../_lib/v4-resume-ocr.js';
import {checkpointStorageReady,storeMatchCheckpoint,loadMatchCheckpoint,deleteMatchCheckpoint,matchTaskKey,saveMatchTask,readMatchTask} from '../../_lib/v4-match-checkpoint-storage.js';
import {claimAiCheckpoint,leaseMatchTask} from '../../_lib/ai-checkpoint-claim.js';
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
const checkpointArgs=(env,input,draft)=>({env:checkpointEnv(env),account:input.phone,blocks:[input.text],job:{role:input.role_hint,excludeUrls:input.excludeUrls,resume_id:input.resume_id,policy:'curated-500-50-research-v5'},draft});
function events(env,request,input){
 const encoder=new TextEncoder();let closed=false,phase='preparing';
 const started=Date.now();
 const trace=input.taskKey?input.taskKey.slice(0,16):crypto.randomUUID();
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
   const allowedJob=j=>j&&!j.excluded_board&&!isCommercialRecruitmentBoard(j.official_url,j);
   const officialJob=j=>allowedJob(j)&&qualifiedReport(j);
   const sendResearch=r=>{if(r)send('research_report',r);};
   const sendFinal=result=>{
    const matches=result.matches.filter(officialJob),leads=(result.research_leads||[]).filter(allowedJob);
    sendResearch(result.research_report);
    sendJobs('research',leads);
    sendJobs('final',matches);
    send('complete',{...result,research_leads:[],matches:[],matches_streamed:true,match_count:matches.length,research_leads_streamed:true,research_lead_count:leads.length});
   };
   send('progress',{stage:'preparing'});
   const leaseAbort=new AbortController();
   const leaseTimer=input.lease?setInterval(()=>input.lease.renew().catch(()=>leaseAbort.abort()),60000):null;
   const executionSignal=input.lease?AbortSignal.any([request.signal,leaseAbort.signal]):request.signal;
   async function releaseTask(){if(input.lease){const lease=input.lease;input.lease=null;await lease.release();}}
   void (async()=>{
    let succeeded=false;
    try{
     if(input.cachedResult){
      const cached=input.cachedResult;
      await releaseTask();
      sendFinal(cached);
      succeeded=true;return;
     }
     const result=await v4Match(fetch,v4Provider(env),input.text,input.role_hint,{
      signal:executionSignal,onProgress:progress,onActivity:activity,env,excludeUrls:input.excludeUrls,
      stepMode:!!checkpointEnv(env),checkpoint:input.checkpoint||null,officialOnly:true,curated:true,
      onResearch:sendResearch,
      onPartial:matches=>{sendJobs('research',matches.filter(allowedJob));sendJobs('partial',matches.filter(officialJob));}});
     if(executionSignal.aborted)throw Object.assign(Error('AI_AGENT_CANCELLED'),{code:'AI_AGENT_CANCELLED'});
     if(result.status==='CONTINUE'){
      console.info('HHBA_V4_STAGE',JSON.stringify({trace,phase:result.checkpoint.phase,round:result.checkpoint.round,candidates:result.checkpoint.rows?.length,processed:result.checkpoint.next,scored:result.checkpoint.scored,diagnostics:result.checkpoint.diagnostics}));
      if(input.taskKey){
       await input.lease.renew();
       await saveMatchTask(env,input.taskKey,{checkpoint:result.checkpoint});
       await releaseTask();
       send('complete',{status:'CONTINUE',continuation:{state:{task:true},token:'server-task'}});
       succeeded=true;return;
      }
      // Store derived research state only when a private encrypted checkpoint
      // bucket with lifecycle management has been enabled by the operator.
      const state=checkpointStorageReady(env)?await storeMatchCheckpoint(env,result.checkpoint):result.checkpoint;
      const token=await issueCheckpoint(checkpointArgs(env,input,state));
      send('complete',{status:'CONTINUE',continuation:{state,token}});
      succeeded=true;
      return;
     }
     console.info('HHBA_V4_MATCH',JSON.stringify({trace,result:result.native_search?.stage==='partial'?'PARTIAL':'COMPLETE',
      found:result.matches.length,official:result.matched_official_jobs,candidates:result.native_search?.candidate_links,searches:result.native_search?.searches,verification:result.native_search?.jd_verification,diagnostics:result.native_search?.diagnostics,research_error:result.native_search?.research_error,
      duration_ms:Date.now()-started}));
     // Persist completed research first. A history-service failure must not repeat paid model calls.
     if(input.taskKey){await input.lease.renew();await saveMatchTask(env,input.taskKey,{result:{...result,history_status:'UNAVAILABLE'}});}
     // Store only result metadata, never the resume or raw model prompt.
     try{
      const saved=await saveMatchHistory(env.HHBA_PNVS_AUTH_DB,input.phone,input.resume_id,input.role_hint,result.matches.map(job=>({...job,v4_source:true})),result.research_report,(result.research_leads||[]).map(job=>({...job,v4_source:true})));
      Object.assign(result,saved?{history_status:'SAVED',history_id:saved.id,new_job_count:saved.new_job_count,improved_job_count:saved.improved_job_count}:{history_status:'EMPTY'});
     }catch{result.history_status='UNAVAILABLE';console.warn('HHBA_V4_HISTORY_UNAVAILABLE');}
     if(input.taskKey){
      await input.lease.renew();
      await saveMatchTask(env,input.taskKey,{result});
      await releaseTask();
     }
     sendFinal(result);
     succeeded=true;
    }catch(e){
     const code=typeof e?.code==='string'?e.code:leaseAbort.signal.aborted?'AI_CHECKPOINT_LEASE_LOST':'AI_PROVIDER_UNAVAILABLE';
     console.warn('HHBA_V4_MATCH_ERROR',JSON.stringify({trace,error:code,stage:phase,
      elapsed_ms:Date.now()-started}));
     send('failure',{error:code,phase,elapsed_ms:Date.now()-started,retryable:!!input.taskKey&&(isV4RetryableProviderError(code)||leaseAbort.signal.aborted&&!request.signal.aborted)});
    }finally{
     clearInterval(heart);if(leaseTimer)clearInterval(leaseTimer);
     await releaseTask().catch(()=>console.warn('HHBA_TASK_LEASE_RELEASE_FAILED'));
     if(input.claim&&(!succeeded||closed))await input.claim.release().catch(()=>console.warn('HHBA_CHECKPOINT_RELEASE_FAILED'));
     if(succeeded&&!closed&&input.pointer)await deleteMatchCheckpoint(env,input.pointer).catch(()=>console.warn('HHBA_CHECKPOINT_CLEANUP_FAILED'));
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
   scope:'CN_MAINLAND_ONLY',formats:['pdf','docx'],resumable:!!checkpointEnv(env),encrypted_checkpoint_storage:checkpointStorageReady(env),dynamic_page_reader:typeof env.BROWSER?.quickAction==='function'});
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
 if(checkpointStorageReady(env)&&body.task_id!==undefined){
  try{
   input.taskKey=await matchTaskKey(env,session.phone,body.task_id,{text:resume,role,excludeUrls,resume_id:input.resume_id,policy:'curated-500-50-research-v5'});
   input.lease=await leaseMatchTask(db,input.taskKey);
   if(!input.lease)return fail('AI_TASK_IN_PROGRESS',409);
   const saved=await readMatchTask(env,input.taskKey);
   if(saved?.result?.status==='COMPLETE')input.cachedResult=saved.result;
   else if(saved?.checkpoint)input.checkpoint=saved.checkpoint;
   else if(body.continuation!==undefined){await input.lease.release();return fail('AI_CHECKPOINT_EXPIRED',409);}
  }catch(e){if(input.lease)await input.lease.release().catch(()=>{});return fail(e?.message==='AI_CHECKPOINT_INVALID'?'AI_CHECKPOINT_INVALID':'AI_CHECKPOINT_DB_UNAVAILABLE',503);}
  return events(env,request,input);
 }
 if(body.continuation!==undefined){
  if(!checkpointEnv(env)||!body.continuation?.state||typeof body.continuation.token!=='string')return fail('AI_CHECKPOINT_INVALID',409);
  try{
   await verifyCheckpoint({...checkpointArgs(env,input,body.continuation.state),token:body.continuation.token});
  }catch{return fail('AI_CHECKPOINT_INVALID',409)}
  if(env?.HHBA_V4_CHECKPOINT_REPLAY_PROTECTION==='1'){
   try{input.claim=await claimAiCheckpoint(db,body.continuation.token);if(!input.claim)return fail('AI_CHECKPOINT_ALREADY_USED',409);}
   catch{return fail('AI_CHECKPOINT_DB_UNAVAILABLE',503);}
  }
  try{
   if(body.continuation.state.ref){
    input.pointer=body.continuation.state;
    input.checkpoint=await loadMatchCheckpoint(env,input.pointer);
   }else input.checkpoint=body.continuation.state;
  }catch(e){
   if(input.claim)await input.claim.release().catch(()=>{});
   return fail(e?.message==='AI_CHECKPOINT_EXPIRED'?'AI_CHECKPOINT_EXPIRED':'AI_CHECKPOINT_INVALID',409);
  }
 }
 return events(env,request,input);
}
