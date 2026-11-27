// Aggregate observations of independent verification / report invocations.
// Never persist task/user IDs, employer names, links, resume text or model
// responses here. These are job-invocation counts, NOT unique jobs.
const lanes=new Set(['verification','reporting']);
const outcomes=new Set(['DONE','CACHED','CONTINUE','RETRY','STALE','FAILED']);
const safeError=v=>typeof v==='string'&&/^AI_[A-Z0-9_]{4,72}$/.test(v)?v:'-';
const safeMillis=v=>Number.isFinite(v)&&v>=0?Math.min(86400000,Math.floor(v)):0;
const count=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
export function v4JobMetricSample({started,finished=Date.now(),lane,status,error,evidence={},cached=false}={}){
 if(!lanes.has(lane)||!outcomes.has(status))return null;
 const outcome=status==='DONE'&&cached?'CACHED':status;
 const confirmed=outcome==='DONE';
 const duration=safeMillis(finished-started);
 return {day:new Date(finished).toISOString().slice(0,10),lane,outcome,
  error_code:['RETRY','FAILED'].includes(outcome)?safeError(error):'-',
  executions:1,elapsed_ms_total:duration,elapsed_ms_max:duration,
  verified_jds:confirmed&&evidence.verified_jd===true?1:0,
  scored_jobs:confirmed&&evidence.scored===true?1:0,
  completed_reports:confirmed&&evidence.report===true?1:0};
}
const columns=['day','lane','outcome','error_code','executions','elapsed_ms_total','elapsed_ms_max','verified_jds','scored_jobs','completed_reports'];
export async function recordV4JobOps(db,sample){
 if(!db?.prepare||!sample)return false;
 try{
  const sql='INSERT INTO hhba_v4_job_ops_daily('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+') ON CONFLICT(day,lane,outcome,error_code) DO UPDATE SET '+columns.slice(4).map(k=>k==='elapsed_ms_max'?k+'=MAX('+k+',excluded.'+k+')':k+'='+k+'+excluded.'+k).join(',');
  return (await db.prepare(sql).bind(...columns.map(k=>sample[k])).run())?.success!==false;
 }catch{console.warn('HHBA_V4_JOB_OPS_METRIC_WRITE_UNAVAILABLE');return false;}
}
export async function readV4JobOps(db,since,until){
 if(!db?.prepare)return {quality:'unavailable'};
 try{
  const r=await db.prepare('SELECT * FROM hhba_v4_job_ops_daily WHERE day>=? AND day<=? ORDER BY day,lane,outcome,error_code').bind(since,until).all();
  const rows=r?.results||[];
  if(!rows.length)return {quality:'no_records',scope:'INDEPENDENT_JOB_INVOCATIONS_AGGREGATED_ONLY',summary:null,stages:[],errors:[]};
  const sum=(arr,key)=>arr.reduce((t,x)=>t+count(x[key]),0);
  const calc=arr=>{
   const all=sum(arr,'executions'),time=sum(arr,'elapsed_ms_total');
   return {attempts:all,done:sum(arr.filter(r=>r.outcome==='DONE'),'executions'),
    cached:sum(arr.filter(r=>r.outcome==='CACHED'),'executions'),
    continued:sum(arr.filter(r=>r.outcome==='CONTINUE'),'executions'),
    retries:sum(arr.filter(r=>r.outcome==='RETRY'),'executions'),
    stale:sum(arr.filter(r=>r.outcome==='STALE'),'executions'),
    failed:sum(arr.filter(r=>r.outcome==='FAILED'),'executions'),
    verifiedJds:sum(arr,'verified_jds'),scoredJobs:sum(arr,'scored_jobs'),completedReports:sum(arr,'completed_reports'),
    averageMs:all?Math.round(time/all):null,maxMs:Math.max(0,...arr.map(r=>count(r.elapsed_ms_max)))};
  };
  const stages=[...new Set(rows.map(x=>x.lane))].map(lane=>({lane,...calc(rows.filter(x=>x.lane===lane))}));
  const errors=rows.filter(x=>['RETRY','FAILED'].includes(x.outcome)).map(x=>({lane:x.lane,code:x.error_code,count:count(x.executions)})).sort((a,b)=>b.count-a.count).slice(0,20);
  return {quality:'collected',scope:'INDEPENDENT_JOB_INVOCATIONS_AGGREGATED_ONLY',summary:calc(rows),stages,errors};
 }catch{return {quality:'unavailable'};}
}
