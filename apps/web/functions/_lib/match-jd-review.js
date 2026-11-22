import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {jdArchiveReady} from './job-jd-archive.js';
import {enrichSearchMatchesWithJD,matchJdEnrichmentEnabled} from './match-jd-enrichment.js';
import {isMainlandEmployerJobUrl,matchEmployerHost,rankEmployerMatches,MATCH_POSTINGS_PER_EMPLOYER} from './match-employer-source.js';

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
 const activeByEmployer=new Map(),scoredByEmployer=new Map();
 let verified=0,scored=0,failed=0;
 const adjust=(counts,employer,delta)=>{
  const count=(counts.get(employer)||0)+delta;
  if(count>0)counts.set(employer,count);
  else counts.delete(employer);
 };

 function markClosed(url){
  const key=matchPostingKey(url);
  if(!key||closed.has(key))return;
  closed.add(key);
  const record=records.get(key);
  if(!record?.verified)return;
  verified--;
  if(Number.isInteger(record.match?.match_score)){
   scored--;
   adjust(scoredByEmployer,record.employer,-1);
  }
  record.verified=false;
  record.match=null;
 }

 function summarize(leads=[]){
  const candidates=new Map();
  for(const job of [...leads,...Array.from(records.values(),record=>
   record.resolvePostingIdentity?record.match:record.job).filter(Boolean)]){
   const key=matchPostingKey(job.official_url);
   if(!key||!isMainlandEmployerJobUrl(key)||options.exclude?.has(key))continue;
   const record=records.get(key);
   if(closed.has(key))continue;
   const match=record?.match;
   if(candidates.has(key)&&!match)continue;
   candidates.set(key,match||job);
  }
  return rankEmployerMatches([...candidates.values()],options.limit,options.previousEmployerCounts);
 }
 function pump(){
  if(signal.aborted||scored>=options.limit)return;
  while(running.size<3&&queue.length&&scored+running.size<options.limit){
   const workFor=record=>(scoredByEmployer.get(record.employer)||0)+(activeByEmployer.get(record.employer)||0)+
    (options.previousEmployerCounts?.get(record.employer)||0);
   const available=record=>!closed.has(matchPostingKey(record.job.official_url));
   let index=queue.findIndex(record=>available(record)&&workFor(record)===0);
   if(index<0)index=queue.findIndex(record=>available(record)&&workFor(record)<MATCH_POSTINGS_PER_EMPLOYER);
   if(index<0)break;
   const [record]=queue.splice(index,1);
   const key=matchPostingKey(record.job.official_url);
   adjust(activeByEmployer,record.employer,1);
   const task=(async()=>{
    try{
     const result=await enrich(env,[record.job],resume,{
      ...options,signal,domesticOnly:true,resolvePostingIdentity:record.resolvePostingIdentity,
      compareEvidence:jd=>options.compareEvidence(jd,signal)
     },{ready:async()=>true});
     if(result.diagnostic.closed>0)markClosed(key);
     if(closed.has(key))return;
     const job=result.matches.find(item=>item.jd_source_status==='VERIFIED_JD');
     if(!job){failed++;return;}
     record.verified=true;verified++;
     // Search text can omit the city and job title. Only the verified employer
     // detail may supply those fields. An unscored URL-only lead stays hidden.
     if(record.resolvePostingIdentity&&!Number.isInteger(job.match_score))return;
     record.match=job;
     if(Number.isInteger(job.match_score)){
      scored++;
      adjust(scoredByEmployer,record.employer,1);
     }
    }catch{failed++;}
   })().finally(()=>{
    running.delete(task);
    adjust(activeByEmployer,record.employer,-1);
    if(!signal.aborted)options.onUpdate?.(summarize());
    pump();
   });
   running.add(task);
  }
 }
 function add(jobs,closedUrls=[],postingUrls=[]){
  if(signal.aborted)return;
  for(const url of closedUrls)markClosed(url);
  function enqueue(locator,job){
   if(!locator||closed.has(locator.url)||records.has(locator.url)||options.exclude?.has(locator.url))return;
   const record={job:job||{
    id:'external-'+locator.id.replace(/[:.]/g,'-'),official_url:locator.url,
    platform:'企业官网',source:locator.domain,source_type:'站外官方招聘',
    application_status:'NEEDS_OFFICIAL_CONFIRMATION',recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE'
   },employer:matchEmployerHost(locator.url),match:null,resolvePostingIdentity:!job};
   records.set(locator.url,record);queue.push(record);
  }
  for(const job of jobs)enqueue(safeOfficialJobLocator(job?.official_url),job);
  for(const url of postingUrls)enqueue(safeOfficialJobLocator(url));
  pump();
 }
 return {
  add,preview:summarize,
  verifiedCount:()=>scored,
  scoredEmployerCount:()=>scoredByEmployer.size,
  async finish(jobs){
   add(jobs);
   while(running.size){await Promise.allSettled([...running]);}
   return {matches:summarize(jobs),diagnostic:{
    mode:'continuous_official_jd_review',eligible:records.size,verified,scored,failed,closed:closed.size
   }};
  }
 };
}
