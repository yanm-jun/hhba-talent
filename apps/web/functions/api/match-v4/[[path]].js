/**
 * HHBA V4 single-purpose authenticated endpoint.
 * GET /api/match-v4/status and POST /api/match-v4/resume.
 * Reuses existing resume upload and results modal. Preview only until tested.
 */
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {qualifiedReport} from '../../_lib/v4-curated-reports.js';
import {isCommercialRecruitmentBoard} from '../../_lib/match-employer-source.js';
import {v4Provider,v4JobProvider,v4Match,isV4RetryableProviderError} from '../../_lib/simple-match-v4.js';
import {v4ParallelResearchEnabled} from '../../_lib/v4-parallel-discovery.js';
import {saveMatchHistory} from '../../_lib/match-history.js';
import {recognizeV4Resume} from '../../_lib/v4-resume-ocr.js';
import {v4CheckpointSecret,checkpointStorageReady,storeMatchCheckpoint,loadMatchCheckpoint,deleteMatchCheckpoint,matchTaskKey,saveMatchTask,readMatchTask,startMatchPhaseHeartbeat,saveMatchProgress,readMatchProgress,matchProfileCacheKey,readMatchProfileCache,saveMatchProfileCache} from '../../_lib/v4-match-checkpoint-storage.js';
import {claimAiCheckpoint,leaseMatchTask} from '../../_lib/ai-checkpoint-claim.js';
import {issueCheckpoint,verifyCheckpoint} from '../../_lib/resume-rewrite-checkpoint.js';
import {getSessionTask,updateSessionTask,assertSessionTaskActive,renewActiveSessionTask} from '../../_lib/v4-session-match-task.js';
import {backgroundEnabled,tryScheduleBackgroundMatch,loadBackgroundMatch,isV4RetryableTaskFailure} from '../../_lib/v4-background-match.js';

import {phaseResourceBudget,phaseModelReplay,PHASE_YIELD} from '../../_lib/v4-phase-budget.js';
import {createV4ProgressPublisher} from '../../_lib/v4-progress-publisher.js';
import {createV4DeliveryTelemetry} from '../../_lib/v4-live-delivery-telemetry.js';
import {v4DiscoveryCandidateKey} from '../../_lib/v4-discovery-candidate-events.js';
import {discoveryRecoverySnapshot,restoreDiscoveryRecovery} from '../../_lib/v4-discovery-recovery.js';
import {reportRecoverySnapshot,restoreReportRecovery} from '../../_lib/v4-report-recovery.js';

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
const matchEnabled=(env,request)=>enabled(env,request)&&Boolean(v4JobProvider(env));
const sanitize=(raw)=>{
 if(typeof raw!=='string')return null;
 const text=redactForModel(raw.trim(),Infinity);
 return text.replace(/\s/g,'').length>=30?text:null;
};
const checkpointEnv=env=>{
 const secret=v4CheckpointSecret(env);
 return typeof secret==='string'&&secret.length>=32?{HHBA_RESUME_AGENT_CHECKPOINT_SECRET:'hhba-v4-match:'+secret}:null;
};
const checkpointArgs=(env,input,draft)=>({env:checkpointEnv(env),account:input.phone,blocks:[input.text],job:{role:input.role_hint,excludeUrls:input.excludeUrls,resume_id:input.resume_id,policy:'curated-500-50-research-v5'},draft});
function events(env,request,input,waitUntil){
 const encoder=new TextEncoder();let closed=false,phase=input.savedProgress?.stage||'preparing';
 const started=Date.now();
 const budget=input.managed?phaseResourceBudget({progressReserve:input.background?4:0}):null;
 const replay=budget?phaseModelReplay(input.phaseReplay):null;
 const researchEnv=budget?budget.env(env):{...env};
 // Only a managed existing task can use the opt-in shared asset path.
 if(!input.managed)researchEnv.HHBA_V4_PUBLIC_ASSETS_ENABLED='0';
 const trace=input.taskKey?input.taskKey.slice(0,16):crypto.randomUUID();
 const delivery=createV4DeliveryTelemetry({started,trace,log:(event,data)=>console.info('HHBA_V4_DELIVERY_'+event.toUpperCase(),JSON.stringify(data))});
 const stream=new ReadableStream({
  start(controller){
   const send=(type,payload)=>{
    if(closed||input.background&&!['heartbeat','complete','failure'].includes(type))return;
    try{
     const serialized=JSON.stringify(payload);
     if(serialized.length>500000&&type!=='heartbeat'){
      const parts=Math.ceil(serialized.length/500000);
      for(let i=0;i<parts;i++)controller.enqueue(encoder.encode('event: hhba_event_piece\ndata: '+JSON.stringify({type,index:i,total:parts,text:serialized.slice(i*500000,(i+1)*500000)})+'\n\n'));
     }else controller.enqueue(encoder.encode('event: '+type+'\ndata: '+serialized+'\n\n'));
    }catch{closed=true;}
   };
   const heart=setInterval(()=>send('heartbeat',{stage:phase,
    elapsed_ms:Date.now()-started}),12000);
   const progress=stage=>{phase=stage;send('progress',{stage});queueProgress();};
   const activity=(stage,message)=>{if(latestActivity?.stage===stage&&latestActivity?.message===message)return;latestActivity={stage,message};send('activity',latestActivity);queueProgress();};
   const sendJobs=(kind,matches)=>{
    if(input.background)return;
    send(kind+'_begin',{count:matches.length});
    for(const job of matches)send(kind+'_job',{job});
    send(kind+'_end',{count:matches.length});
   };
   const allowedJob=j=>j&&!j.excluded_board&&!isCommercialRecruitmentBoard(j.official_url,j);
   const officialJob=j=>allowedJob(j)&&qualifiedReport(j);
   let lastReport=input.savedProgress?.report,latestActivity=input.savedProgress?.activity,lastJobs=input.savedProgress?.jobs||[];
   const snapshotProgress=()=>({stage:phase,activity:latestActivity,report:lastReport,jobs:[...lastJobs]});
    let reportRecovery;
    const captureTime=()=>Date.now();
   const seenResults={candidate:new Set(lastJobs.map(j=>j.official_url)),jd:new Set(lastJobs.filter(j=>j.jd_source_status==='VERIFIED_JD').map(j=>j.official_url)),score:new Set(lastJobs.filter(j=>Number.isInteger(j.match_score)).map(j=>j.official_url)),report:new Set(lastJobs.filter(officialJob).map(j=>j.official_url))};
   const observeResult=(kind,url)=>{if(url&&!seenResults[kind].has(url)){seenResults[kind].add(url);delivery.result(kind);}};
   async function publishProgress(status='PENDING',failure=null,kind=null){
     if(!input.background||!input.taskKey)return false;
     // Optional writes reserve capacity atomically at the actual write. A
     // phase-end/terminal write uses the existing mandatory recovery headroom.
     if(kind){if(leaseAbort.signal.aborted||!budget?.tryProgress(kind)){delivery.blocked(kind);return false;}}
     else budget?.observe('progress');
     const write=delivery.write(kind||'terminal',{candidateCount:lastJobs.length,reportCount:lastJobs.filter(officialJob).length});
     try{
      // The recovery supplement is private: polling exposes only .progress.
      const discovery_recovery=status==='PENDING'?discoveryRecoverySnapshot(input.checkpoint,input.recoveryState?.()):undefined;
      if(status==='PENDING'&&kind==='report')reportRecovery=reportRecoverySnapshot(input.recoveryState?.(),replay?.snapshot(),captureTime())||reportRecovery;
       await saveMatchProgress(env,input.taskKey,{generation:input.generation||0,status,progress:{...snapshotProgress(),delivery_stamp:write.stamp,delivery_summary:delivery.snapshot()},failure,discovery_recovery,...(status==='PENDING'&&reportRecovery?{report_recovery:reportRecovery}:{})});write.finish(true);return true;}
     catch(e){write.finish(false);console.warn('HHBA_V4_PROGRESS_WRITE_FAILED',JSON.stringify({trace,error:e?.code||'PROGRESS_WRITE_FAILED'}));return false;}
    }
   const publisher=createV4ProgressPublisher({
    publish:kind=>publishProgress('PENDING',null,kind),
    canPublish:kind=>{const allowed=!!(input.background&&input.taskKey&&leaseHeartbeat&&!leaseAbort.signal.aborted&&budget?.canPublishProgress(kind));if(!allowed&&input.background)delivery.blocked(kind);return allowed;}
   });
   const queueProgress=kind=>publisher.queue(kind);
   const stopProgress=()=>publisher.stop();
   const sendResearch=r=>{if(r){lastReport=r;send('research_report',r);queueProgress();}};
   const reportSignature=jobs=>JSON.stringify(jobs.filter(officialJob).map(j=>[j.official_url,j.match_score,j.jd_sha256,j.research_detail,j.reference_jd]));
   let lastReportSignature=reportSignature(lastJobs);
   const publishedCandidateKeys=new Set(lastJobs.map(j=>v4DiscoveryCandidateKey(j.official_url)).filter(Boolean));
   let currentCandidateKeys=new Set(publishedCandidateKeys);
   const rememberJobs=matches=>{
    for(const j of matches.filter(allowedJob)){const u=j.official_url;observeResult('candidate',u);if(j.jd_source_status==='VERIFIED_JD')observeResult('jd',u);if(Number.isInteger(j.match_score))observeResult('score',u);if(officialJob(j))observeResult('report',u);}
    // The progress object is encrypted and bound to this authorized task.
    // Keep complete reports lossless; compact only non-deliverable leads.
    lastJobs=matches.filter(allowedJob).map(j=>officialJob(j)?structuredClone(j):({
     id:j.id,company:j.company,title:j.title,title_zh:j.title_zh,location:j.location,official_url:j.official_url,platform:j.platform,source:j.source,remote:j.remote,
     matched:[],not_evidenced:[],needs_verification:[],requirements_basis:'',salary:j.salary,source_status:j.source_status,
     source_type:j.source_type,jd_source_status:j.jd_source_status,evidence_status:j.evidence_status,reference_vacancy_verified:j.reference_vacancy_verified,
     availability_status:j.availability_status,report_status:j.report_status
    }));
    const signature=reportSignature(lastJobs),changed=signature!==lastReportSignature;lastReportSignature=signature;
    currentCandidateKeys=new Set(lastJobs.map(j=>v4DiscoveryCandidateKey(j.official_url)).filter(Boolean));
    let newCandidate=false;
    for(const j of lastJobs){const key=v4DiscoveryCandidateKey(j.official_url);if(key&&!publishedCandidateKeys.has(key)){publishedCandidateKeys.add(key);newCandidate=true;}}
    queueProgress(changed?'report':newCandidate?'candidate':'routine');
   };
   // The authenticated background route can append one compact, unverified
   // preview in O(1), leaving full evidence reconciliation to onPartial.
   // Terminal-only provider responses still use their authoritative batch.
   const rememberDiscovery=(event,meta)=>{
    if(!input.background){send('discovery_candidate',event);return;}
    if(!['delta','done','source_read'].includes(meta?.source))return;
    const j=event?.candidate,key=v4DiscoveryCandidateKey(j?.official_url);
    if(!key||!allowedJob(j)||currentCandidateKeys.has(key)||leaseAbort.signal.aborted)return;
    currentCandidateKeys.add(key);publishedCandidateKeys.add(key);observeResult('candidate',key);
    lastJobs.push({
     id:'v4-live:'+key,company:j.company,title:j.title,location:j.location,official_url:key,
     platform:'招聘来源（企业官网待核实）',source:meta?.source==='source_read'?'公开招聘页读取候选':'AI搜索候选',remote:false,reference_score:0,match_score:null,
     matched:[],not_evidenced:[],needs_verification:[],requirements_basis:'',
     source_type:'站外招聘职位',source_status:'MODEL_SEARCH_REPORTED',evidence_status:'RESEARCH_PENDING',availability_status:'UNKNOWN'
    });
    if(lastReport&&Number.isSafeInteger(meta.discovered))lastReport={...lastReport,discovered:Math.max(lastReport.discovered||0,meta.discovered)};
    queueProgress('candidate');
   };
   const sendFinal=result=>{
    if(input.background){send('complete',{status:'COMPLETE'});return;}
    const matches=result.matches.filter(officialJob),leads=(result.research_leads||[]).filter(allowedJob);
    sendResearch(result.research_report);
    sendJobs('research',leads);
    sendJobs('final',matches);
    send('complete',{...result,research_leads:[],matches:[],matches_streamed:true,match_count:matches.length,research_leads_streamed:true,research_lead_count:leads.length});
   };
   send('progress',{stage:phase});
   const leaseAbort=new AbortController();
   let leaseHeartbeat=null;
   // Managed tasks are not cancelled simply because a browser transport closes.
   // Pages waitUntil is best effort; durable checkpoints still provide recovery.
   const executionSignal=input.managed?leaseAbort.signal:input.lease?AbortSignal.any([request.signal,leaseAbort.signal]):request.signal;
   const guard=async()=>{if(input.managed){budget?.observe('authorization',2);await renewActiveSessionTask(env,input.session,input.taskId,input.generation);}};
   let guardBusy=false;
   const guardTimer=input.managed?setInterval(()=>{if(guardBusy)return;guardBusy=true;guard().catch(e=>leaseAbort.abort(e)).finally(()=>{guardBusy=false});},45000):null;
   if(input.lease)leaseHeartbeat=startMatchPhaseHeartbeat({
     renew:()=>{budget?.observe('lease');return input.lease.renew();},
     getCheckpoint:()=>input.taskKey&&!leaseAbort.signal.aborted&&(!budget||budget.canPublish())?{checkpoint:input.recoveryState?.()||input.checkpoint||null,progress:snapshotProgress(),phaseReplay:replay?.snapshot(),checkpoint_captured_at:captureTime()}:null,
     persist:async state=>{if(!leaseAbort.signal.aborted){budget?.observe('checkpoint');await saveMatchTask(env,input.taskKey,{...state,generation:input.generation||0});}},
     onError:e=>leaseAbort.abort(e),
     onSaveError:e=>{if(e?.code==='AI_AGENT_CANCELLED')leaseAbort.abort(e);else console.warn('HHBA_V4_PERIODIC_PROGRESS_SAVE_FAILED');}
    });
    async function releaseTask(){await stopProgress();await leaseHeartbeat?.stop();if(input.lease){const lease=input.lease;input.lease=null;await lease.release().catch(()=>console.warn('HHBA_TASK_LEASE_RELEASE_FAILED'));}}
   const execution=(async()=>{
    let succeeded=false,committedResult=null;
    try{
     await guard();
     if(input.cachedResult){
      const cached=input.cachedResult;
      await stopProgress();await publishProgress('COMPLETE');await releaseTask();
      sendFinal(cached);
      succeeded=true;return;
     }
     let recoveryState=()=>null;
     input.recoveryState=()=>recoveryState();
     // Keep one durable phase per Pages invocation. The hosting platform's
     // subrequest budget resets on the next continuation, not on a JS loop.
          const provider=v4JobProvider(researchEnv);if(provider){provider.deliveryTelemetry=delivery;
      // Request actual provider SSE by default on managed background research.
      // Honor an explicit opt-out; the existing adapter handles JSON fallback.
      if(input.background&&env.HHBA_AGENT_RELAY_STREAM!=='0')provider.stream=true;
     }if(provider&&replay){provider.phaseReplay=replay;provider.phaseResourceBudget=budget;provider.usageDb=env.HHBA_METRICS_DB;}
      let profileCache=null;
      if(input.managed&&!input.checkpoint&&provider&&input.resume_id&&input.session?.token_hash&&budget?.canPublish()){
       const id=await matchProfileCacheKey(env,input.phone,input.session.token_hash,{resume_id:input.resume_id,text:input.text,role:input.role_hint,model:provider.model,base:provider.baseUrl,effort:provider.reasoningEffort||'medium'}).catch(()=>null);
       if(id)profileCache={load:async()=>{if(!budget.canPublish())return null;budget.observe('profile_cache');return readMatchProfileCache(env,id);},save:async profile=>{if(!budget.canPublish()||executionSignal.aborted)return;budget.observe('profile_cache');await saveMatchProfileCache(env,id,profile);}};
      }
      const result=await v4Match(budget?budget.fetch(fetch):fetch,provider,input.text,input.role_hint,{
      signal:executionSignal,onProgress:progress,onActivity:activity,env:researchEnv,resourceBudget:budget,profileCache,excludeUrls:input.excludeUrls,
      stepMode:!!checkpointEnv(env),checkpoint:input.checkpoint||null,officialOnly:true,curated:true,parallelResearch:v4ParallelResearchEnabled(env),allowContinue:!!input.taskKey,onRecoveryState:get=>{recoveryState=get;},
      onResearch:sendResearch,
      // Managed background publication is compact and coalesced; direct SSE
      // retains the existing complete research callbacks.
      deferDiscoverySnapshots:!!input.background,onDiscoveryCandidate:rememberDiscovery,
      onPartial:matches=>{rememberJobs(matches);sendJobs('research',matches.filter(allowedJob));sendJobs('partial',matches.filter(officialJob));}});
     await stopProgress();await leaseHeartbeat?.stop();
      if(budget?.denied)throw Object.assign(Error(PHASE_YIELD),{code:PHASE_YIELD});
      if(executionSignal.aborted)throw executionSignal.reason||Object.assign(Error('AI_AGENT_CANCELLED'),{code:'AI_AGENT_CANCELLED'});
     await guard();
     if(result.status==='CONTINUE'){
      console.info('HHBA_V4_STAGE',JSON.stringify({trace,phase:result.checkpoint.phase,round:result.checkpoint.round,candidates:result.checkpoint.rows?.length,processed:result.checkpoint.next,scored:result.checkpoint.scored,diagnostics:result.checkpoint.diagnostics}));
      if(input.taskKey){
       await input.lease.renew();
       await saveMatchTask(env,input.taskKey,{checkpoint:result.checkpoint,generation:input.generation||0,progress:snapshotProgress(),checkpoint_captured_at:captureTime()});
       await publishProgress();await releaseTask();
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
     // Keep the private continuation state server-side; never include it in a client event or history.
     const resumeCheckpoint=result.resume_checkpoint;delete result.resume_checkpoint;
     if(input.taskKey)result.research_generation=input.generation||0;
     // Persist completed research first. A history-service failure must not repeat paid model calls.
     if(input.taskKey){await guard();await input.lease.renew();await saveMatchTask(env,input.taskKey,{result:{...result,history_status:'UNAVAILABLE'},checkpoint:resumeCheckpoint,generation:input.generation||0});committedResult={...result,history_status:'UNAVAILABLE'};}
     // Store only result metadata, never the resume or raw model prompt.
     await guard();
     try{
      const saved=await saveMatchHistory(researchEnv.HHBA_PNVS_AUTH_DB,input.phone,input.resume_id,input.role_hint,result.matches.map(job=>({...job,v4_source:true})),result.research_report,(result.research_leads||[]).map(job=>({...job,v4_source:true})));
      Object.assign(result,saved?{history_status:'SAVED',history_id:saved.id,new_job_count:saved.new_job_count,improved_job_count:saved.improved_job_count}:{history_status:'EMPTY'});
     }catch{result.history_status='UNAVAILABLE';console.warn('HHBA_V4_HISTORY_UNAVAILABLE');}
     if(input.taskKey){
      await input.lease.renew();
      await saveMatchTask(env,input.taskKey,{result,checkpoint:resumeCheckpoint,generation:input.generation||0});
      await publishProgress('COMPLETE');await releaseTask();
     }
     sendFinal(result);
     succeeded=true;
    }catch(e){
     await stopProgress();await leaseHeartbeat?.stop();
     const reason=leaseAbort.signal.reason;
     const code=typeof reason?.code==='string'?reason.code:typeof e?.code==='string'?e.code:leaseAbort.signal.aborted?'AI_CHECKPOINT_LEASE_LOST':/^[A-Z][A-Z0-9_]{5,80}$/.test(e?.message||'')?e.message:'AI_PROVIDER_UNAVAILABLE';
     // A later history/progress failure must not replace an already committed
     // completed result with an old checkpoint and repeat paid model calls.
     if(committedResult){
      await releaseTask();
      if(code==='AI_AGENT_CANCELLED'){send('failure',{error:code,phase,elapsed_ms:Date.now()-started,retryable:false});return;}
      await publishProgress('COMPLETE');sendFinal(committedResult);succeeded=true;return;
     }
     if((code===PHASE_YIELD||budget?.denied)&&input.taskKey&&input.lease&&!leaseAbort.signal.aborted){
      try{
       await guard();await input.lease.renew();
       const checkpoint=input.recoveryState?.()||input.checkpoint||null;
       if(checkpoint){checkpoint.diagnostics={...checkpoint.diagnostics,EDGE_RESOURCE_YIELDS:(checkpoint.diagnostics?.EDGE_RESOURCE_YIELDS||0)+1};}
       latestActivity={stage:phase,message:'已保存本段研究成果，正在接续下一段执行。'};
       await saveMatchTask(env,input.taskKey,{checkpoint,generation:input.generation||0,progress:snapshotProgress(),phaseReplay:replay?.snapshot(),checkpoint_captured_at:captureTime()});
       await publishProgress();
        console.info('HHBA_V4_RESOURCE_YIELD',JSON.stringify({trace,stage:phase,...budget?.snapshot()}));
       await releaseTask();send('complete',{status:'CONTINUE',continuation:{state:{task:true},token:'server-task'}});succeeded=true;return;
      }catch(recoveryError){console.warn('HHBA_V4_RESOURCE_YIELD_SAVE_FAILED',JSON.stringify({trace,error:recoveryError?.code||'CHECKPOINT_SAVE_FAILED'}));}
     }
     const retryable=code!=='AI_AGENT_CANCELLED'&&!!input.taskKey&&(isV4RetryableProviderError(code)||isV4RetryableTaskFailure(code)||leaseAbort.signal.aborted&&!request.signal.aborted);
      if(input.taskKey&&input.lease&&!leaseAbort.signal.aborted&&code!=='AI_AGENT_CANCELLED'){try{await guard();await input.lease.renew();await saveMatchTask(env,input.taskKey,{checkpoint:input.recoveryState?.()||input.checkpoint||null,generation:input.generation||0,progress:snapshotProgress(),phaseReplay:replay?.snapshot(),checkpoint_captured_at:captureTime(),failure:{error:code,phase,elapsed_ms:Date.now()-started,retryable}});}catch{console.warn('HHBA_V4_RECOVERY_SAVE_FAILED');}}
      if(code!=='AI_AGENT_CANCELLED'&&!leaseAbort.signal.aborted)await publishProgress(retryable?'PENDING':'FAILED',{error:code,phase,elapsed_ms:Date.now()-started,retryable});
       console.warn('HHBA_V4_MATCH_ERROR',JSON.stringify({trace,error:code,stage:phase,elapsed_ms:Date.now()-started,resources:budget?.snapshot()}));
      send('failure',{error:code,phase,elapsed_ms:Date.now()-started,retryable});
    }finally{
     delivery.finish();
     clearInterval(heart);if(guardTimer)clearInterval(guardTimer);
     await releaseTask().catch(()=>console.warn('HHBA_TASK_LEASE_RELEASE_FAILED'));
     if(input.claim&&(!succeeded||closed))await input.claim.release().catch(()=>console.warn('HHBA_CHECKPOINT_RELEASE_FAILED'));
     if(succeeded&&!closed&&input.pointer)await deleteMatchCheckpoint(env,input.pointer).catch(()=>console.warn('HHBA_CHECKPOINT_CLEANUP_FAILED'));
     if(!closed){closed=true;try{controller.close()}catch{}}
    }
   })();
   if(input.managed&&typeof waitUntil==='function')waitUntil(execution);
  },
  cancel(){closed=true;}
 });
 return new Response(stream,{status:200,headers:{
  'Content-Type':'text/event-stream; charset=utf-8',
  'Cache-Control':'private, no-store, no-transform',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex','X-Accel-Buffering':'no'}});
}
// Read the candidate recovery view only under the existing exclusive task
// lease. It is account-bound by the same encrypted task key and generation.
// An optional view read failing must not prevent normal checkpoint recovery.
async function recoverSavedDiscovery(env,input,saved,view){
 if(!saved?.checkpoint||saved.generation!==input.generation||saved.result||saved.failure&&!saved.failure.retryable)return saved;
 const record=view??await readMatchProgress(env,input.taskKey).catch(()=>null);
 const reportRecovered=restoreReportRecovery(saved,record,input.generation);
 if(reportRecovered){await saveMatchTask(env,input.taskKey,reportRecovered);saved=reportRecovered;console.info('HHBA_V4_REPORT_CHECKPOINT_RECOVERED');}
 const recovered=restoreDiscoveryRecovery(saved,record,input.generation,input.excludeUrls);
 if(recovered.restored||recovered.restoredSources){
  // Persist once before starting a new invocation. Otherwise a second
  // crash could replace the progress supplement with an empty delta.
  await saveMatchTask(env,input.taskKey,recovered.saved);
  console.info('HHBA_V4_DISCOVERY_RECOVERED',JSON.stringify({count:recovered.restored,sources:recovered.restoredSources||0,round:saved.checkpoint.round}));
 }
 return recovered.saved;
}
// Private orchestration entrypoint: a ticket can advance only the already
// authorized active session and generation, and returns no research content.
// Each invocation uses the exact same D1 lease and encrypted checkpoint as
// the browser. A second driver can never run the same leased phase in parallel.
async function backgroundStep(env,request,waitUntil){
 if(!backgroundEnabled(env,request)||request.method!=='POST')return fail('NOT_FOUND',404);
 if(!matchEnabled(env,request))return fail('MATCH_NOT_ENABLED',503);
 let ticket;
 try{const raw=await request.text();if(raw.length>256)return fail('INVALID_REQUEST',400);ticket=JSON.parse(raw)?.ticket;}catch{return fail('INVALID_REQUEST',400);}
 let input;
 try{
  const {session,task,taskKey}=await loadBackgroundMatch(env,ticket);
  input={managed:true,background:true,session,taskId:task.id,taskKey,generation:task.generation,text:task.text,role_hint:task.role,excludeUrls:task.excludeUrls,phone:session.phone,resume_id:task.resume_id};
  input.lease=await leaseMatchTask(env.HHBA_PNVS_AUTH_DB,taskKey);
  if(!input.lease)return fail('AI_TASK_IN_PROGRESS',409);
  const durable=await readMatchTask(env,taskKey,Date.now(),{renewGeneration:task.generation});
   const saved=await recoverSavedDiscovery(env,input,durable);
  if(saved?.generation===task.generation){input.savedProgress=saved.progress;input.phaseReplay=saved.phaseReplay;if(saved.failure&&!saved.failure.retryable){await input.lease.release();return fail(saved.failure.error,422);}}
  if(saved?.generation===task.generation&&saved?.result?.status==='COMPLETE')input.cachedResult=saved.result;
  else if(saved?.generation===task.generation&&saved?.checkpoint)input.checkpoint=saved.checkpoint;
  else if(saved?.result?.status==='COMPLETE'&&saved.checkpoint&&saved.generation+1===task.generation){
   input.checkpoint=saved.checkpoint;await saveMatchTask(env,taskKey,{checkpoint:input.checkpoint,generation:task.generation});
  }else if(task.generation>0){await input.lease.release();return fail('AI_CHECKPOINT_EXPIRED',409);}
  return events(env,request,input,waitUntil);
 }catch(e){if(input?.lease)await input.lease.release().catch(()=>{});return fail(e?.code||'AI_CHECKPOINT_DB_UNAVAILABLE',e?.status||503);}
}
export async function onRequest(context){
 const {request,env}=context;
 const waitUntil=typeof context.waitUntil==='function'?context.waitUntil.bind(context):undefined;
 const path=new URL(request.url).pathname;
 const suffix=path.slice('/api/match-v4'.length).replace(/\/$/,'')||'/';
 if(suffix==='/status'&&request.method==='GET'){
  // Expose only coarse readiness flags, never credentials or user information.
  const readiness={host:allowedHost(request),service:env?.HHBA_MATCH_V4_READY==='1',provider:Boolean(v4Provider(env)),job_provider:Boolean(v4JobProvider(env)),database:typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function',checkpoint_key:!!checkpointEnv(env),checkpoint_storage:checkpointStorageReady(env)};
  return reply({kind:KIND,engine:'HHBA_SIMPLE_AI_V4',enabled:matchEnabled(env,request),
   scope:'CN_MAINLAND_ONLY',formats:['pdf','docx'],resumable:readiness.checkpoint_key,encrypted_checkpoint_storage:readiness.checkpoint_storage,dynamic_page_reader:typeof env.BROWSER?.quickAction==='function'||typeof env.BROWSER?.script==='function',readiness});
 }
 if(suffix==='/background-step')return backgroundStep(env,request,waitUntil);
 const activeTaskRoute=suffix==='/active-task';
 if(!(activeTaskRoute&&['GET','POST'].includes(request.method))&&(!['/resume','/ocr'].includes(suffix)||request.method!=='POST'))return fail('NOT_FOUND',404);
 if(!enabled(env,request)&&!(activeTaskRoute&&allowedHost(request)&&typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function'))return fail('MATCH_NOT_ENABLED',503);
 const origin=new URL(request.url).origin;
 if((request.method!=='GET'&&request.headers.get('Origin')!==origin)||
  request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('ORIGIN_REQUIRED',403);
 if(request.method!=='GET'&&suffix!=='/ocr'&&!(request.headers.get('Content-Type')||'').startsWith('application/json'))
  return fail('INVALID_REQUEST',415);
 if(suffix!=='/ocr'&&Number(request.headers.get('Content-Length')||0)>8000000)return fail('INVALID_RESUME_TEXT',413);
 const db=env.HHBA_PNVS_AUTH_DB;
 let session;
 try{session=await sessionOfBearer(db,request,Date.now())}catch{return fail('SESSION_INVALID',401)}
 if(!session)return fail('SESSION_INVALID',401);
 let candidate;
 try{candidate=await getUserByPhone(db,session.phone)}catch{return fail('SESSION_INVALID',401)}
 if(candidate?.role!=='candidate')return fail('FORBIDDEN',403);
 if(activeTaskRoute&&request.method==='GET'){
  if(!checkpointStorageReady(env))return fail('AI_CHECKPOINT_DB_UNAVAILABLE',503);
  try{const task=await getSessionTask(env,session);const background_scheduled=await tryScheduleBackgroundMatch(env,request,session,task);return reply({ok:true,task,background_scheduled});}catch(e){return fail(e?.code||'AI_CHECKPOINT_DB_UNAVAILABLE',503);}
 }
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
 if(activeTaskRoute){
  if(!checkpointStorageReady(env))return fail('AI_CHECKPOINT_DB_UNAVAILABLE',503);
  const action=body?.action;
  if(!['start','continue','close','cancel'].includes(action))return fail('INVALID_REQUEST',400);
  if(action==='start'&&!matchEnabled(env,request))return fail('AI_PROVIDER_NOT_CONFIGURED',503);
  if(action==='start'&&(body?.consent!==true||body?.recovery_consent!==true||body?.options?.country!=='CN'))return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',403);
  const text=action==='start'?sanitize(body.text):null;
  if(action==='start'&&!text)return fail('INVALID_RESUME_TEXT',400);
  const entry=action==='start'?{id:body.task_id,text,role:typeof body.options.role_hint==='string'?body.options.role_hint.trim():'',excludeUrls:[],resume_id:body.resume_id||null}:{id:body.task_id,generation:body.generation};
  try{const task=await updateSessionTask(env,session,action,entry);const background_scheduled=await tryScheduleBackgroundMatch(env,request,session,task);return reply({ok:true,task,background_scheduled});}catch(e){return fail(e?.code||'AI_CHECKPOINT_DB_UNAVAILABLE',e?.status||503);}
 }
 if(!matchEnabled(env,request))return fail('AI_PROVIDER_NOT_CONFIGURED',503);
 // The third-party relay is not OpenAI or Google official infrastructure.
 if(body?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',403);
 if(body?.options?.country!=='CN')return fail('INVALID_REQUEST',400);
 const resume=sanitize(body.text);
 if(!resume)return fail('INVALID_RESUME_TEXT',400);
 const role=typeof body?.options?.role_hint==='string'?
  body.options.role_hint.trim():'';
 const excludeUrls=Array.isArray(body?.options?.exclude_urls)?body.options.exclude_urls.filter(x=>typeof x==='string'):[];
 // Do not store raw resume, query, job results, or model output in server logs.
 const input={text:resume,role_hint:role,excludeUrls,phone:session.phone,resume_id:body.resume_id||null};
 if(body.task_managed===true){
  try{
   const task=await assertSessionTaskActive(env,session,body.task_id,body.research_generation??0);
   if(task.text!==resume||task.role!==role||task.resume_id!==input.resume_id||JSON.stringify(task.excludeUrls)!==JSON.stringify(excludeUrls))return fail('AI_CHECKPOINT_INVALID',409);
   Object.assign(input,{managed:true,session,taskId:task.id,sessionTask:task});
  }catch(e){return fail(e?.code||'AI_CHECKPOINT_DB_UNAVAILABLE',e?.status||503);}
 }
 if(checkpointStorageReady(env)&&body.task_id!==undefined){
  try{
   input.taskKey=await matchTaskKey(env,session.phone,body.task_id,{text:resume,role,excludeUrls,resume_id:input.resume_id,policy:'curated-500-50-research-v5'});
   const generation=body.research_generation??0;
   let view;
   if(input.managed&&backgroundEnabled(env,request)){
    view=await readMatchProgress(env,input.taskKey).catch(()=>null);
    // While the driver is active, use the lightweight view rather than
    // decrypting the multi-hundred-KB evidence/replay checkpoint on each poll.
    let scheduled;
    if(view?.generation===generation&&view.status==='PENDING'){
     scheduled=await tryScheduleBackgroundMatch(env,request,session,input.sessionTask,{diagnostic:true});
     if(scheduled===true||scheduled?.status==='RECOVERING')return reply({status:'PENDING',progress:view.progress||null,failure:scheduled?.status==='RECOVERING'?(view.failure?.retryable?view.failure:{error:scheduled.error,retryable:true}):view.failure||null});
    }
    const saved=await readMatchTask(env,input.taskKey);
    if(saved?.generation===generation&&saved?.result?.status==='COMPLETE'){input.generation=generation;input.cachedResult=saved.result;return events(env,request,input,waitUntil);}
    if(saved?.generation===generation&&saved.failure&&!saved.failure.retryable)return reply({status:'FAILED',progress:saved.progress||null,failure:saved.failure});
    if(scheduled===undefined)scheduled=await tryScheduleBackgroundMatch(env,request,session,input.sessionTask,{diagnostic:true});
    if(scheduled==='FAILED'||scheduled?.status==='FAILED')return reply({status:'FAILED',progress:view?.generation===generation?view.progress||null:saved?.generation===generation?saved.progress||null:null,failure:{error:saved?.failure?.error||scheduled?.error||'AI_BACKGROUND_EXECUTION_FAILED',retryable:false}});
    if(scheduled)return reply({status:'PENDING',progress:view?.generation===generation?view.progress||null:saved?.generation===generation?saved.progress||null:null,failure:scheduled?.status==='RECOVERING'?(saved?.generation===generation&&saved.failure?.retryable?saved.failure:{error:scheduled.error,retryable:true}):saved?.generation===generation?saved.failure||null:null});
    // Fallback continues the same persisted task under its exclusive lease.
   }
   input.lease=await leaseMatchTask(db,input.taskKey);
   if(!input.lease)return fail('AI_TASK_IN_PROGRESS',409);
   const durable=await readMatchTask(env,input.taskKey,Date.now(),input.managed?{renewGeneration:generation}:{});
   if(!Number.isSafeInteger(generation)||generation<0||generation>(durable?.generation||0)+1){await input.lease.release();return fail('AI_CHECKPOINT_INVALID',409);}
   input.generation=generation;
   const saved=await recoverSavedDiscovery(env,input,durable,view);
    if(saved?.generation===generation){input.savedProgress=saved.progress;input.phaseReplay=saved.phaseReplay;if(saved.failure&&!saved.failure.retryable){await input.lease.release();return reply({status:'FAILED',progress:saved.progress||null,failure:saved.failure});}}
   if(generation===(saved?.generation||0)&&saved?.result?.status==='COMPLETE')input.cachedResult=saved.result;
   else if(saved?.checkpoint&&generation===(saved.generation||0))input.checkpoint=saved.checkpoint;
   else if(saved?.result?.status==='COMPLETE'&&saved.checkpoint&&generation===(saved.generation||0)+1){input.checkpoint=saved.checkpoint;await saveMatchTask(env,input.taskKey,{checkpoint:input.checkpoint,generation});}
   else if(generation>0){await input.lease.release();return fail('AI_CHECKPOINT_EXPIRED',409);}
   else if(body.continuation!==undefined){await input.lease.release();return fail('AI_CHECKPOINT_EXPIRED',409);}
  }catch(e){if(input.lease)await input.lease.release().catch(()=>{});return fail(e?.message==='AI_CHECKPOINT_INVALID'?'AI_CHECKPOINT_INVALID':'AI_CHECKPOINT_DB_UNAVAILABLE',503);}
  return events(env,request,input,waitUntil);
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
 return events(env,request,input,waitUntil);
}
