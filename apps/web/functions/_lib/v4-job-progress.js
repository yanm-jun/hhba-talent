// Authenticated task-local progress. An incomplete batch cannot erase an
// already observed vacancy, JD, score or report. Explicit exclusions and
// the final authoritative result can remove outdated candidates.
import {preserveJobEvidence} from './v4-jd-research.js';
const key=j=>j?.research_candidate_url||j?.official_url;
const excluded=j=>!!(j?.excluded_closed||j?.excluded_board||j?.availability_status==='CLOSED_LISTED');
const identity=j=>JSON.stringify([j?.company,j?.title,j?.location]);
export function mergeLiveJobProgress(previous=[],incoming=[],{final=false}={}){
 const result=new Map();
 if(!final)for(const job of previous){const url=key(job);if(url&&!excluded(job))result.set(url,job);}
 for(const job of incoming){
  const url=key(job);if(!url)continue;
  if(excluded(job)){result.delete(url);continue;}
  const existing=result.get(url);
  result.set(url,existing&&identity(existing)===identity(job)?preserveJobEvidence(existing,job):job);
 }
 return [...result.values()];
}
// Metadata only: actual JD text and the user's resume are not duplicated in
// the event journal. Event rows stay in the private encrypted task record.
export function createV4JobEventJournal(initial=[],{now=Date.now,limit=200}={}){
 const items=Array.isArray(initial)?initial.filter(e=>e&&Number.isSafeInteger(e.seq)&&['candidate','jd','score','report'].includes(e.kind)&&typeof e.url==='string').slice(-limit):[];
 const events=[...items],seen=new Set(items.map(e=>JSON.stringify([e.kind,e.url])));
 let seq=events.reduce((n,e)=>Math.max(n,e.seq),0);
 return {record(kind,url){
  if(!['candidate','jd','score','report'].includes(kind)||typeof url!=='string'||!url)return false;
  const k=JSON.stringify([kind,url]);if(seen.has(k))return false;
  seen.add(k);events.push({seq:++seq,kind,url,at:now()});
  if(events.length>limit)events.shift();
  return true;
 },snapshot:()=>events.map(e=>({...e}))};
}
