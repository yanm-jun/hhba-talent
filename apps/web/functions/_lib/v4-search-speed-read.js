// Read-only mirror for the independent password-admin production branch.
// The matching runtime owns collection/writes; this branch must not import
// main-only V4 discovery modules or change match execution.
const thresholds=[1,50,100,300,500];
const elapsed=v=>Number.isSafeInteger(v)&&v>=0&&v<=30*86400000?v:null;
export async function readV4SearchSpeed(db,since,until){
 if(!db?.prepare)return {quality:'unavailable'};
 try{
  const fields=['status','observed_unique',...thresholds.map(n=>'milestone_'+n+'_ms')];
  const response=await db.prepare('SELECT '+fields.join(',')+' FROM hhba_v4_search_speed_runs WHERE day>=? AND day<=?').bind(since,until).all();
  const records=response?.results||[];
  const percentile=(xs,p)=>xs.length?xs[Math.ceil(p*xs.length)-1]:null;
  const milestones=thresholds.map(target=>{
   const samples=records.map(row=>elapsed(row['milestone_'+target+'_ms'])).filter(x=>x!==null).sort((a,b)=>a-b);
   return {target,samples:samples.length,averageMs:samples.length?Math.round(samples.reduce((a,b)=>a+b,0)/samples.length):null,
    medianMs:percentile(samples,0.5),p95Ms:percentile(samples,0.95),
    reachRatePct:records.length?Math.round(samples.length*10000/records.length)/100:null};
  });
  return {quality:records.length?'collected':'no_records',
   scope:'ANONYMOUS_OBSERVED_CONCRETE_CANDIDATES_NOT_FULL_JD_VERIFICATION',
   runs:records.length,completed:records.filter(row=>row.status==='COMPLETE').length,
   activeOrRecovering:records.filter(row=>['CONTINUE','RESOURCE_YIELD','RETRYABLE_FAILURE'].includes(row.status)).length,
   maxObservedCandidates:records.length?Math.max(...records.map(row=>Number.isSafeInteger(row.observed_unique)?row.observed_unique:0)):null,
   milestones};
 }catch{return {quality:'unavailable'};}
}
