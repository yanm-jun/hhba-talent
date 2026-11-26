// Recover candidates from the encrypted lightweight progress record if the
// invocation dies before its normal phase checkpoint. This is not an evidence
// or scoring cache: only concrete, unverified public candidate fields survive.
import {normalizeV4StreamCandidate} from './v4-stream-job-parser.js';
import {v4DiscoveryCandidateKey} from './v4-discovery-candidate-events.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';

const keys=values=>new Set((values||[]).map(v4DiscoveryCandidateKey).filter(Boolean));
const isRound=v=>Number.isSafeInteger(v)&&v>=0;

export function discoveryRecoverySnapshot(base,current){
 if(base?.phase!=='research'||current?.phase!=='research'||!isRound(base.round??0)||!isRound(current.round??0))return undefined;
 const before=base.round??0,round=current.round??0;
 if(round<before||round>before+1)return undefined;
 const existing=keys((base.rows||[]).map(([url])=>url));
 const rejected=keys(current.rejectedBoards);
 const rows=[];
 for(const [url,raw] of current.rows||[]){
  const key=v4DiscoveryCandidateKey(url);
  if(!key||existing.has(key)||rejected.has(key))continue;
  const candidate=normalizeV4StreamCandidate({...raw,url:key,official_url:key});
  if(candidate){existing.add(key);rows.push([key,candidate]);}
 }
 const knownSources=keys([...(base.sourceLeads||[]),...(base.rows||[]).map(([url])=>url)]);
 const newSources=[...keys(current.sourceLeads)].filter(u=>!knownSources.has(u)&&!rejected.has(u)&&!isCommercialRecruitmentBoard(u)&&!existing.has(u));
 const priorObserved=keys(base.observedSearchSources),observed=[...keys(current.observedSearchSources)].filter(u=>!priorObserved.has(u));
 const priorRejected=keys(base.rejectedBoards),newRejected=[...rejected].filter(u=>!priorRejected.has(u)&&isCommercialRecruitmentBoard(u));
 return rows.length||newSources.length||observed.length||newRejected.length?{round,rows,...(newSources.length?{sources:newSources}:{}),...(observed.length?{observed}:{}),...(newRejected.length?{rejected:newRejected}:{})}:undefined;
}

export function restoreDiscoveryRecovery(saved,view,generation,excludeUrls=[]){
 const base=saved?.checkpoint,recovery=view?.discovery_recovery;
 // Never cross an account-bound task's generation, resurrect a terminal
 // result, or modify verification/reporting checkpoint evidence.
 if(saved?.generation!==generation||view?.generation!==generation||view?.status!=='PENDING'||
  saved.result||saved.failure&&!saved.failure.retryable||base?.phase!=='research'||!recovery||
  !isRound(base.round??0)||!isRound(recovery.round)||!Array.isArray(recovery.rows))return {saved,restored:0};
 const round=base.round??0;
 if(recovery.round<round||recovery.round>round+1)return {saved,restored:0};
 const rejected=keys(base.rejectedBoards);for(const u of keys(recovery.rejected))if(isCommercialRecruitmentBoard(u))rejected.add(u);
 const observed=keys(base.observedSearchSources);for(const u of keys(recovery.observed))observed.add(u);
 const statsRestored=observed.size>keys(base.observedSearchSources).size||rejected.size>keys(base.rejectedBoards).size;
 const rows=new Map(base.rows||[]),existing=keys([...rows.keys()]),blocked=keys([...excludeUrls,...rejected]);
 const sources=new Set(base.sourceLeads||[]);
 const knownSources=keys([...sources,...rows.keys()]);
 let restored=0,restoredSources=0;
 for(const entry of recovery.rows){
  if(!Array.isArray(entry)||entry.length!==2)continue;
  const [url,raw]=entry,key=v4DiscoveryCandidateKey(url);
  if(!key||existing.has(key)||blocked.has(key)||!raw||typeof raw!=='object')continue;
  const candidate=normalizeV4StreamCandidate({...raw,url:key,official_url:key});
  if(!candidate)continue;
  rows.set(key,candidate);sources.add(key);existing.add(key);restored++;
 }
 for(const url of Array.isArray(recovery.sources)?recovery.sources:[]){
  const key=v4DiscoveryCandidateKey(url);
  if(!key||blocked.has(key)||knownSources.has(key)||existing.has(key)||isCommercialRecruitmentBoard(key))continue;
  sources.add(key);knownSources.add(key);restoredSources++;
 }
 if(!restored&&!restoredSources&&!statsRestored)return {saved,restored};
 // Do not advance the round or claim that its search completed. Retry the
 // incomplete round from the saved profile/rows and preserve original evidence.
 return {restored,...(restoredSources?{restoredSources}:{}),saved:{...saved,progress:view.progress||saved.progress,checkpoint:{...base,
  rows:[...rows],sourceLeads:[...sources],observedSearchSources:[...observed],rejectedBoards:[...rejected],
  diagnostics:{...base.diagnostics,LIVE_DISCOVERY_RECOVERED:(base.diagnostics?.LIVE_DISCOVERY_RECOVERED||0)+restored,...(restoredSources?{LIVE_PUBLIC_SOURCE_RECOVERED:(base.diagnostics?.LIVE_PUBLIC_SOURCE_RECOVERED||0)+restoredSources}:{})},
  recoveryHint:'上一段搜索中断，已恢复真实返回的候选岗位和公开来源；这些岗位及来源仍需独立核验。请继续未完成的研究，避免重复已发现的网址。'
 }}};
}
