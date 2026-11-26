// Browser-only candidate reception. Every new row comes from an authenticated
// server event or snapshot; no animation, extrapolation or fabricated jobs.
function candidateKey(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password)return null;
  u.hash='';
  for(const k of [...u.searchParams.keys()])if(/^(utm_.+|gclid|fbclid|msclkid|spm|referrer)$/i.test(k))u.searchParams.delete(k);
  u.searchParams.sort();return u.href;
 }catch{return null;}
}
const closed=j=>!!(j?.excluded_closed||j?.excluded_board||j?.availability_status==='CLOSED_LISTED');
const identity=j=>JSON.stringify([j?.company,j?.title,j?.location]);
const rank=j=>j?.report_status==='COMPLETE'&&j?.research_detail?5:Number.isInteger(j?.match_score)?4:j?.jd_source_status==='VERIFIED_JD'&&j?.evidence_excerpt?3:j?.reference_jd_kind==='AI_GENERATED_REFERENCE'&&j?.reference_jd?2:j?.jd_research?.facts?.length?1:0;
const prefer=(previous,next)=>!previous||identity(previous)!==identity(next)||rank(next)>=rank(previous)?next:previous;
function preview(event){
 const j=event?.candidate;
 if(!j||j.evidence_status!=='RESEARCH_PENDING'||j.match_score!==null||
  typeof event.event_id!=='string'||!event.event_id||
  ![j.company,j.title,j.location].every(x=>typeof x==='string'&&x.trim()))return null;
 const key=candidateKey(j.official_url);
 if(!key)return null;
 return {id:'live:'+key,company:j.company,title:j.title,location:j.location,
  official_url:key,platform:'企业招聘',source:'AI搜索候选',remote:false,
  reference_score:0,match_score:null,matched:[],not_evidenced:[],needs_verification:[],
  requirements_basis:'',source_status:'MODEL_SEARCH_REPORTED',evidence_status:'RESEARCH_PENDING'};
}
export function createLiveCandidateReception(onJobs){
 let known=new Map(),unacknowledged=new Map();
 const publish=()=>onJobs?.([...known.values()]);
 return {
  jobs:()=>[...known.values()],
  receive(event){
   const job=preview(event),key=job&&candidateKey(job.official_url);
   if(!key||known.has(key))return false;
   known.set(key,job);unacknowledged.set(key,job);publish();return true;
  },
  snapshot(jobs,{final=false}={}){
   if(!Array.isArray(jobs))return 0;
   const next=final?new Map():new Map(known);
   for(const job of jobs){
    const key=candidateKey(job?.official_url);
    if(!key)continue;
    unacknowledged.delete(key);
    if(closed(job))next.delete(key);
    else next.set(key,prefer(next.get(key),job));
   }
   // An incremental event can arrive before the authoritative batch that
   // includes it. Preserve those observed leads until reconciliation.
   if(final)unacknowledged.clear();
   for(const [key,job] of unacknowledged)if(!next.has(key))next.set(key,job);
   let added=0;
   for(const key of next.keys())if(!known.has(key))added++;
   // Keep actual arrival order even if a snapshot is returned in rank order.
   known=new Map([...known.keys()].filter(key=>next.has(key)).map(key=>[key,next.get(key)]).concat([...next].filter(([key])=>!known.has(key))));
   publish();return added;
  }
 };
}
