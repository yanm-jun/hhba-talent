import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {jdArchiveReady} from './job-jd-archive.js';
import {enrichSearchMatchesWithJD,matchJdEnrichmentEnabled} from './match-jd-enrichment.js';
import {isMainlandEmployerJobUrl} from './match-employer-source.js';

export const matchPostingKey=url=>safeOfficialJobLocator(url)?.url||url;

/**
 * Verify postings while the search Agent is still discovering employers.
 * Each exact public posting is reviewed once per run. Only verified results
 * count toward the requested number of recommendations.
 */
export async function createMatchJdReview(env,resume,options,dependencies={}){
 const ready=dependencies.ready||jdArchiveReady;
 if(!matchJdEnrichmentEnabled(env)||!await ready(env))return null;
 const enrich=dependencies.enrich||enrichSearchMatchesWithJD;
 const deadline=AbortSignal.timeout(210000);
 const signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline;
 const records=new Map(),queue=[],running=new Set(),closed=new Set();
 let verified=0,scored=0,failed=0;

 function markClosed(url){
  const key=matchPostingKey(url);
  if(!key||closed.has(key))return;
  closed.add(key);
  const record=records.get(key);
  if(!record?.match)return;
  verified--;
  if(Number.isInteger(record.match.match_score))scored--;
  record.match=null;
 }

 function summarize(leads=[]){
  const candidates=new Map();
  for(const job of [...leads,...Array.from(records.values(),record=>record.job)]){
   const key=matchPostingKey(job.official_url);
   if(!key||!isMainlandEmployerJobUrl(key)||options.exclude?.has(key))continue;
   const record=records.get(key);
   if(closed.has(key))continue;
   const match=record?.match;
   if(candidates.has(key)&&!match)continue;
   candidates.set(key,match||job);
  }
  return [...candidates.values()].sort((a,b)=>
   Number(b.jd_source_status==='VERIFIED_JD')-Number(a.jd_source_status==='VERIFIED_JD')||
   (b.match_score??-1)-(a.match_score??-1)).slice(0,options.limit);
 }
 function pump(){
  if(signal.aborted||verified>=options.limit)return;
  while(running.size<2&&queue.length&&verified+running.size<options.limit){
   const record=queue.shift();
   const key=matchPostingKey(record.job.official_url);
   if(closed.has(key))continue;
   const task=(async()=>{
    try{
     const result=await enrich(env,[record.job],resume,{
      ...options,signal,domesticOnly:true,compareEvidence:jd=>options.compareEvidence(jd,signal)
     },{ready:async()=>true});
     if(result.diagnostic.closed>0)markClosed(key);
     if(closed.has(key))return;
     const job=result.matches.find(item=>item.jd_source_status==='VERIFIED_JD');
     if(!job){failed++;return;}
     record.match=job;verified++;
     if(Number.isInteger(job.match_score))scored++;
    }catch{failed++;}
   })().finally(()=>{
    running.delete(task);
    if(!signal.aborted)options.onUpdate?.(summarize());
    pump();
   });
   running.add(task);
  }
 }
 function add(jobs,closedUrls=[]){
  if(signal.aborted)return;
  for(const url of closedUrls)markClosed(url);
  for(const job of jobs){
   const locator=safeOfficialJobLocator(job?.official_url);
   if(!locator||closed.has(locator.url)||records.has(locator.url)||options.exclude?.has(locator.url))continue;
   const record={job,match:null};
   records.set(locator.url,record);queue.push(record);
  }
  pump();
 }
 return {
  add,preview:summarize,
  verifiedCount:()=>verified,
  async finish(jobs){
   add(jobs);
   while(running.size){await Promise.allSettled([...running]);}
   return {matches:summarize(jobs),diagnostic:{
    mode:'continuous_official_jd_review',eligible:records.size,verified,scored,failed,closed:closed.size
   }};
  }
 };
}
