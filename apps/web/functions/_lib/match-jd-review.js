import {jdArchiveReady,safeJDSourceLocator} from './job-jd-archive.js';
import {enrichSearchMatchesWithJD,matchJdEnrichmentEnabled} from './match-jd-enrichment.js';
import {isMainlandEmployerJobUrl} from './match-employer-source.js';
import {safePublicAtsJobLocator} from './public-ats-jd.js';

export const matchPostingKey=url=>safeJDSourceLocator(url)?.url||url;

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
 let verified=0,scored=0,failed=0,atsEnqueued=0;

 function markClosed(url){
  const key=matchPostingKey(url);
  if(!key||closed.has(key))return;
  closed.add(key);
  const record=records.get(key);
  if(!record?.verified)return;
  verified--;
  if(Number.isInteger(record.match?.match_score))scored--;
  record.verified=false;
  record.match=null;
 }

 function summarize(leads=[]){
  const candidates=new Map();
  for(const job of [...leads,...Array.from(records.values(),record=>
   record.resolvePostingIdentity?record.match:record.job).filter(Boolean)]){
   const key=matchPostingKey(job.official_url);
   const record=records.get(key);
   // Foreign-hosted ATS links are NEVER shown from Search alone. A complete
   // public employer ATS JD, with independently verified Mainland workplace
   // and a genuine resume comparison, is required to display the posting.
   const verifiedAts=Boolean(safePublicAtsJobLocator(key)&&
    record?.match?.jd_source_status==='VERIFIED_JD'&&
    record.match.jd_proof_method==='PUBLIC_EMPLOYER_ATS_V1');
   if(!key||(!isMainlandEmployerJobUrl(key)&&!verifiedAts)||options.exclude?.has(key))continue;
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
  if(signal.aborted||scored>=options.limit)return;
  while(running.size<3&&queue.length&&scored+running.size<options.limit){
   const record=queue.shift();
   const key=matchPostingKey(record.job.official_url);
   if(closed.has(key))continue;
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
 function add(jobs,closedUrls=[],postingUrls=[]){
  if(signal.aborted)return;
  for(const url of closedUrls)markClosed(url);
  function enqueue(locator,job){
   if(!locator||closed.has(locator.url)||records.has(locator.url)||options.exclude?.has(locator.url))return;
   // Public ATS endpoints are valuable, but ten pages of rate limits must
   // never delay a candidate's entire result stream for minutes.
   if(locator.kind&&atsEnqueued>=12)return;
   if(locator.kind)atsEnqueued++;
   const record={job:job||{
    id:'external-'+locator.id.replace(/[:.]/g,'-'),official_url:locator.url,
    platform:'企业官网',source:locator.domain,source_type:'站外官方招聘',
    application_status:'NEEDS_OFFICIAL_CONFIRMATION',
    recruitment_source_kind:locator.kind?'EMPLOYER_ATS':'EMPLOYER_DOMAIN_CANDIDATE'
   },match:null,
    // An AI shortlist / Search snippet is NOT a trusted posting identity.
    // Always bind employer, exact role and work city to the independently
    // fetched JD before scoring; this also repairs generic "职位详情" titles.
    resolvePostingIdentity:job?.jd_source_status!=='VERIFIED_JD'};
   records.set(locator.url,record);queue.push(record);
  }
  for(const job of jobs)enqueue(safeJDSourceLocator(job?.official_url),job);
  for(const url of postingUrls)enqueue(safeJDSourceLocator(url));
  pump();
 }
 return {
  add,preview:summarize,
  verifiedCount:()=>scored,
  async finish(jobs){
   add(jobs);
   while(running.size){await Promise.allSettled([...running]);}
   return {matches:summarize(jobs),diagnostic:{
    mode:'continuous_official_jd_review',eligible:records.size,verified,scored,failed,closed:closed.size
   }};
  }
 };
}
