// Independent discovery lanes. Scheduling width is a per-invocation
// transport/concurrency control, not a model or research-volume limit.
// The coordinator retains exclusive authority over research tools and stopping.
const throttle=new Set(['AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_CONTEXT_TOO_LARGE']);
export const initialDiscoveryWidth=3;
// Full pipeline for both providers; zero is an explicit emergency rollback.
export const v4ParallelResearchEnabled=(env={})=>env.HHBA_V4_PARALLEL_RESEARCH!=='0';
export function nextDiscoveryWidth(previous,codes=[],{maxConnections=6,elapsed,previousElapsed}={}){
 const width=Math.min(maxConnections,Number.isSafeInteger(previous)&&previous>0?previous:initialDiscoveryWidth);
 if(codes.some(c=>throttle.has(c)))return Math.max(1,Math.floor(width/2));
 if(codes.length)return width;
 // Worker connection ceiling applies to an invocation, never to total research.
 if(Number.isFinite(elapsed)&&Number.isFinite(previousElapsed)&&previousElapsed>0&&elapsed/width>1.5*previousElapsed/Math.max(1,width-1))return Math.max(1,Math.min(maxConnections,width-1));
 return Math.min(maxConnections,width+1);
}
export function discoveryLaneContext({profile,roleHint,round,lane,width,previousJobs,candidateTarget,remainingCandidates}){
 const roles=Array.isArray(profile?.target_roles)?profile.target_roles.filter(x=>typeof x==='string'&&x.trim()):[];
 // Roles are hints for diversity, never an allowlist. Rotate hints over waves.
 const roleHintForLane=roles.length?roles[(Math.max(0,round-1)*(width-1)+lane-1)%roles.length]:null;
 return {profile,preferred_job_or_city:roleHint,search_wave:round,parallel_lane:lane,parallel_width:width,
  independent_direction_hint:roleHintForLane,
  previously_discovered_jobs:previousJobs,candidate_target:candidateTarget,remaining_candidates:remainingCandidates};
}
export async function runDiscoveryWave(primary,extra,width,signal,onReady=()=>{}){
 const started=Date.now();
 // A completed lane is observable before the slowest sibling. Final merge
 // and coordinator authority remain unchanged.
 let remaining=width;
 const run=(work,lane)=>Promise.resolve().then(work).then(value=>{remaining--;if(!signal?.aborted){try{onReady(value,lane,remaining);}catch{/* observer cannot invalidate completed work */}}return value;},error=>{remaining--;throw error;});
 const calls=[run(primary,0)];
 for(let lane=1;lane<width;lane++)calls.push(run(()=>extra(lane),lane));
 const [coordinator,...independent]=await Promise.allSettled(calls);
 if(signal?.aborted)throw Object.assign(Error('AI_AGENT_CANCELLED'),{code:'AI_AGENT_CANCELLED'});
 return {coordinator,independent,elapsed:Date.now()-started,codes:[coordinator,...independent].filter(x=>x.status==='rejected').map(x=>x.reason?.code||'AI_PROVIDER_RESPONSE_INVALID')};
}
// Keep the coordinator's tool actions and reviewed-source decisions isolated.
// All lane leads and actual response output are retained for ordinary V4
// deduplication, source filtering and independent JD verification.
export function combineDiscovery(coordinator,lanes,{hasNewEvidence=false,coordinatorFailed=false}={}){
 const primary=coordinator?.data||{};
 const jobs=lanes.flatMap(x=>Array.isArray(x.data?.jobs)?x.data.jobs:[]);
 const source_leads=[...(Array.isArray(primary.source_leads)?primary.source_leads:[]),...lanes.flatMap(x=>x.sources||[])];
 const output=[...(coordinator?.response?.output||[]),...lanes.flatMap(x=>x.response?.output||[])];
 const data={...primary,jobs:[...(Array.isArray(primary.jobs)?primary.jobs:[]),...jobs],source_leads};
 if(coordinatorFailed||hasNewEvidence){data.research_complete=false;data.continue_search=true;}
 return {data,response:{status:coordinator?.response?.status||'completed',output}};
}

 // A bounded durable work window is distinct from the number of open lanes.
 // Idle lanes pull the next independent item immediately; no sibling barrier.
 // On a rejected lane or transport pressure, finish in-flight work and leave
 // unstarted items for the next checkpoint. Never discard or fake completion.
export async function runReadyWork(items,width,work,{signal,canStart=()=>true}={}){
 let cursor=0,paused=false;
 const settled=[];
 const lane=async()=>{
  while(cursor<items.length&&!paused&&!signal?.aborted&&canStart()){
   const index=cursor++;
   try{const value=await work(items[index]);settled.push({index,status:'fulfilled',value});}
   catch(reason){settled.push({index,status:'rejected',reason});paused=true;}
  }
 };
 await Promise.all(Array.from({length:Math.min(Math.max(1,width),items.length)},lane));
 return settled.sort((a,b)=>a.index-b.index);
}
