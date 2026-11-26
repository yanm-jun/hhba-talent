// Private task progress records the first *observed* unique concrete candidates.
// Aggregate storage uses only an unrelated random run ID, day, counts and elapsed
// time: never a phone number, applicant/task ID, CV, employer URL or search term.
import {v4DiscoveryCandidateKey} from './v4-discovery-candidate-events.js';
import {concreteCandidate} from './v4-curated-reports.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';

export const V4_SEARCH_MILESTONES=Object.freeze([1,50,100,300,500]);
const elapsed=v=>Number.isSafeInteger(v)&&v>=0&&v<=30*86400000?v:null;
const count=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const keyOf=job=>{
 const url=v4DiscoveryCandidateKey(job?.official_url||job?.research_candidate_url||job?.url);
 return url&&concreteCandidate(job)&&!isCommercialRecruitmentBoard(url,job)?url:null;
};
export function createV4SearchSpeedTracker({previous=null,savedJobs=[],now=Date.now,newId=()=>crypto.randomUUID()}={}){
 const started=Number.isSafeInteger(previous?.started_at_ms)&&previous.started_at_ms>0?previous.started_at_ms:now();
 const id=typeof previous?.run_id==='string'&&/^[0-9a-f-]{36}$/i.test(previous.run_id)?previous.run_id:newId();
 const keys=new Set((savedJobs||[]).map(keyOf).filter(Boolean));
 let observed=Math.max(keys.size,count(previous?.observed_unique));
 const milestoneMs={};
 for(const threshold of V4_SEARCH_MILESTONES){
  const v=elapsed(previous?.milestones?.[threshold]);
  if(v!==null)milestoneMs[threshold]=v;
 }
 return {
  observe(job){
   const key=keyOf(job);
   if(!key||keys.has(key))return false;
   keys.add(key);
   const beforeCount=observed;
   observed=Math.max(observed+1,keys.size);
   const ms=Math.max(0,now()-started);
   // Missing past observations stay unknown; never backdate historical milestones.
   for(const n of V4_SEARCH_MILESTONES)if(beforeCount<n&&observed>=n&&!Object.hasOwn(milestoneMs,n))milestoneMs[n]=ms;
   return true;
  },
  snapshot:()=>({run_id:id,started_at_ms:started,observed_unique:observed,milestones:{...milestoneMs}})
 };
}

const column=n=>'milestone_'+n+'_ms';
export async function recordV4SearchSpeed(db,snapshot,status,now=Date.now()){
 if(!db?.prepare||!snapshot||typeof snapshot.run_id!=='string')return false;
 if(!/^[0-9a-f-]{36}$/i.test(snapshot.run_id))return false;
 try{
  const columns=['run_id','day','status','observed_unique',...V4_SEARCH_MILESTONES.map(column),'updated_at_ms'];
  const validStatus=['CONTINUE','COMPLETE','RESOURCE_YIELD','RETRYABLE_FAILURE','TERMINAL_FAILURE','CACHED'];
  const state=validStatus.includes(status)?status:'RETRYABLE_FAILURE';
  const day=new Date(snapshot.started_at_ms).toISOString().slice(0,10);
  const values=[snapshot.run_id,day,state,count(snapshot.observed_unique),...V4_SEARCH_MILESTONES.map(n=>elapsed(snapshot.milestones?.[n])),now];
  const update=['observed_unique=MAX(observed_unique,excluded.observed_unique)',
   "status=CASE WHEN status='COMPLETE' THEN 'COMPLETE' ELSE excluded.status END",
   ...V4_SEARCH_MILESTONES.map(n=>column(n)+'=COALESCE('+column(n)+',excluded.'+column(n)+')'),
   'updated_at_ms=MAX(updated_at_ms,excluded.updated_at_ms)'];
  const sql='INSERT INTO hhba_v4_search_speed_runs ('+columns.join(',')+') VALUES ('+columns.map(()=>'?').join(',')+') ON CONFLICT(run_id) DO UPDATE SET '+update.join(',');
  const result=await db.prepare(sql).bind(...values).run();
  return result?.success!==false;
 }catch{console.warn('HHBA_V4_SEARCH_SPEED_WRITE_UNAVAILABLE');return false;}
}

export async function readV4SearchSpeed(db,since,until){
 if(!db?.prepare)return {quality:'unavailable'};
 try{
  const columns=['status','observed_unique',...V4_SEARCH_MILESTONES.map(column)];
  const result=await db.prepare('SELECT '+columns.join(',')+' FROM hhba_v4_search_speed_runs WHERE day>=? AND day<=?').bind(since,until).all();
  const rows=result?.results||[];
  const percentile=(values,p)=>values.length?values[Math.ceil(p*values.length)-1]:null;
  const milestones=V4_SEARCH_MILESTONES.map(target=>{
   const times=rows.map(r=>elapsed(r[column(target)])).filter(v=>v!==null).sort((a,b)=>a-b);
   return {target,samples:times.length,averageMs:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null,
    medianMs:percentile(times,0.5),p95Ms:percentile(times,0.95),
    reachRatePct:rows.length?Math.round(times.length*10000/rows.length)/100:null};
  });
  return {quality:rows.length?'collected':'no_records',scope:'ANONYMOUS_OBSERVED_CONCRETE_CANDIDATES_NOT_FULL_JD_VERIFICATION',
   runs:rows.length,completed:rows.filter(x=>x.status==='COMPLETE').length,
   activeOrRecovering:rows.filter(x=>['CONTINUE','RESOURCE_YIELD','RETRYABLE_FAILURE'].includes(x.status)).length,
   maxObservedCandidates:rows.length?Math.max(...rows.map(x=>count(x.observed_unique))):null,
   milestones};
 }catch{return {quality:'unavailable'};}
}
