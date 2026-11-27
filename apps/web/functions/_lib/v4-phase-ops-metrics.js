// A single aggregated D1 row per authorized phase invocation. Nothing
// applicant-identifying enters this table: no task IDs, URLs, private text,
// search terms, session data or provider output.
const lanes=new Set(['discovery','verification','reporting','mixed']);
const outcomes=new Set(['CONTINUE','WAIT_JOBS','COMPLETE','RESOURCE_YIELD','RETRYABLE_FAILURE','TERMINAL_FAILURE','CACHED']);
const stage=v=>lanes.has(v)?v:'mixed';
const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{2,72}$/.test(v)?v:'-';
const millis=v=>Number.isFinite(v)&&v>=0?Math.min(Math.floor(v),86400000):0;
const sample=v=>Number.isFinite(v)&&v>=0?Math.min(Math.floor(v),86400000):null;
export function v4PhaseMetricSample({started,finished=Date.now(),lane,outcome,error,recovering=false,first={},events=[],resources=null}={}){
 const counts={candidate:0,jd:0,score:0,report:0};
 for(const e of events)if(e&&Object.hasOwn(counts,e.kind))counts[e.kind]++;
 const seen={candidate:sample(first.result_candidate),jd:sample(first.result_jd),report:sample(first.result_report)};
 const success=['CONTINUE','WAIT_JOBS','COMPLETE','RESOURCE_YIELD','CACHED'].includes(outcome);
 const observed=resources?.mode==='classified';
 const number=x=>observed&&Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):0;
 const resourceCounts={resource_samples:observed?1:0,
  external_calls:number(resources?.external_subrequests?.used),service_calls:number(resources?.service_subrequests?.used),
  d1_calls:number(resources?.classes?.database),r2_calls:number(resources?.classes?.storage),
  browser_calls:number(resources?.classes?.browser),maintenance_calls:number(resources?.classes?.maintenance),
  d1_statements:number(resources?.operations?.d1Statements)};
 return {day:new Date(finished).toISOString().slice(0,10),lane:stage(lane),outcome:outcomes.has(outcome)?outcome:'RETRYABLE_FAILURE',
  error_code:outcome==='RETRYABLE_FAILURE'||outcome==='TERMINAL_FAILURE'?code(error):'-',
  executions:1,recovered_attempts:recovering?1:0,recovered_successes:recovering&&success?1:0,elapsed_ms_total:millis(finished-started),elapsed_ms_max:millis(finished-started),
  candidates:counts.candidate,jds:counts.jd,scores:counts.score,reports:counts.report,
  first_candidate_ms_total:seen.candidate??0,first_candidate_known:seen.candidate!==null?1:0,
  first_jd_ms_total:seen.jd??0,first_jd_known:seen.jd!==null?1:0,
  first_report_ms_total:seen.report??0,first_report_known:seen.report!==null?1:0,...resourceCounts};
}
const values=['day','lane','outcome','error_code','executions','recovered_attempts','recovered_successes','elapsed_ms_total','elapsed_ms_max','candidates','jds','scores','reports','first_candidate_ms_total','first_candidate_known','first_jd_ms_total','first_jd_known','first_report_ms_total','first_report_known','resource_samples','external_calls','service_calls','d1_calls','r2_calls','browser_calls','maintenance_calls','d1_statements'];
export async function recordV4PhaseOps(db,sample){
 if(!db?.prepare||!sample)return false;
 try{
  const sql='INSERT INTO hhba_v4_phase_ops_daily('+values.join(',')+') VALUES('+values.map(()=>'?').join(',')+') ON CONFLICT(day,lane,outcome,error_code) DO UPDATE SET '+values.slice(4).map(k=>k==='elapsed_ms_max'?k+'=MAX('+k+',excluded.'+k+')':k+'='+k+'+excluded.'+k).join(',');
  const r=await db.prepare(sql).bind(...values.map(k=>sample[k])).run();
  return r?.success!==false;
 }catch{console.warn('HHBA_V4_OPS_METRIC_WRITE_UNAVAILABLE');return false;}
}
export async function readV4PhaseOps(db,since,until){
 if(!db?.prepare)return {quality:'unavailable'};
 try{
  const r=await db.prepare('SELECT * FROM hhba_v4_phase_ops_daily WHERE day>=? AND day<=? ORDER BY day,lane,outcome,error_code').bind(since,until).all();
  const rows=r?.results||[];
  if(!rows.length)return {quality:'no_records',scope:'OBSERVED_AUTHORIZED_CLOUD_PHASE_INVOCATIONS_ONLY',rows:[],summary:null,stages:[]};
  const sum=(records,key)=>records.reduce((a,b)=>a+(Number.isSafeInteger(Number(b[key]))?Number(b[key]):0),0);
  const calc=records=>{
   const attempts=sum(records,'executions'),retries=sum(records.filter(r=>r.outcome==='RETRYABLE_FAILURE'),'executions');
   const terminal=sum(records.filter(r=>r.outcome==='TERMINAL_FAILURE'),'executions');
   const recovery=sum(records,'recovered_attempts'),resolved=sum(records,'recovered_successes');
   const time=sum(records,'elapsed_ms_total');
   const sampleMean=(total,count)=>count?Math.round(total/count):null;
   return {attempts,continued:sum(records.filter(r=>r.outcome==='CONTINUE'),'executions'),waitingJobs:sum(records.filter(r=>r.outcome==='WAIT_JOBS'),'executions'),completed:sum(records.filter(r=>r.outcome==='COMPLETE'),'executions'),
    yields:sum(records.filter(r=>r.outcome==='RESOURCE_YIELD'),'executions'),retryableFailures:retries,terminalFailures:terminal,
    failureRate:attempts?Math.round((retries+terminal)*10000/attempts)/100:null,
    recoveredAttempts:recovery,recoveredSuccesses:resolved,recoveryCompletionRate:recovery?Math.round(resolved*10000/recovery)/100:null,
    averageElapsedMs:sampleMean(time,attempts),maxElapsedMs:Math.max(0,...records.map(r=>Number(r.elapsed_ms_max)||0)),
    firstCandidateMs:sampleMean(sum(records,'first_candidate_ms_total'),sum(records,'first_candidate_known')),
    firstJdMs:sampleMean(sum(records,'first_jd_ms_total'),sum(records,'first_jd_known')),
    firstReportMs:sampleMean(sum(records,'first_report_ms_total'),sum(records,'first_report_known')),
    candidates:sum(records,'candidates'),jds:sum(records,'jds'),scores:sum(records,'scores'),reports:sum(records,'reports'),
    resourceSamples:sum(records,'resource_samples'),externalCalls:sum(records,'external_calls'),serviceCalls:sum(records,'service_calls'),
    d1Calls:sum(records,'d1_calls'),r2Calls:sum(records,'r2_calls'),browserCalls:sum(records,'browser_calls'),
    maintenanceCalls:sum(records,'maintenance_calls'),d1Statements:sum(records,'d1_statements')};
  };
  const stages=[...new Set(rows.map(x=>x.lane))].map(lane=>({lane,...calc(rows.filter(x=>x.lane===lane))}));
  const errors=rows.filter(x=>['RETRYABLE_FAILURE','TERMINAL_FAILURE'].includes(x.outcome)).reduce((all,row)=>{const key=row.lane+':'+row.error_code;all.set(key,(all.get(key)||0)+Number(row.executions||0));return all;},new Map());
  return {quality:'collected',scope:'OBSERVED_AUTHORIZED_CLOUD_PHASE_INVOCATIONS_ONLY',rows,summary:calc(rows),stages,
   errors:[...errors].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([key,count])=>({lane:key.split(':')[0],code:key.split(':')[1],count}))};
 }catch{return {quality:'unavailable'};}
}
