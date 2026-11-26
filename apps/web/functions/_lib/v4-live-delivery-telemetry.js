// Timing only: no prompts, model text, URLs, names, credentials or reasoning.
// Store a bounded summary in the existing encrypted progress view; emit
// aggregate operational logs without creating additional database writes.
const stages=new Set(['discovery','profile','jd_search','jd_extract','jd_coverage','jd_reference','partial','identity','score','report','reference','format','rank','other','probe']);
const milestones=new Set(['headers','first_chunk','first_frame','first_search_complete','first_text','first_source','first_candidate','terminal','fallback','replay']);
const transports=new Set(['sse','json','unknown']);
const resultStages=new Set(['candidate','jd','score','report','jd_engine','score_engine','report_engine']);
const kinds=new Set(['routine','candidate','report','terminal']);
export function createV4DeliveryTelemetry({now=Date.now,started=now(),trace='',log=()=>{}}={}){
 let serial=0,version=0,first={},counts={},lastWrite=null,lastProvider=null;
 const elapsed=()=>Math.max(0,now()-started);
 const count=k=>{counts[k]=(counts[k]||0)+1;};
 const emit=(event,data)=>{try{log(event,{trace,...data});}catch{}};
 const mark=(name)=>{if(!Object.hasOwn(first,name))first[name]=elapsed();count(name);};
 return {
  provider(stage){
   stage=stages.has(stage)?stage:'other';
   const id=++serial,began=now(),times={},events={};let transport='unknown',finished=false;
   const observe=(name,kind)=>{
    if(finished||!milestones.has(name))return;
    if(transports.has(kind))transport=kind;
    events[name]=(events[name]||0)+1;
    if(!Object.hasOwn(times,name))times[name]=Math.max(0,now()-began);
    if(stage==='discovery'){
     if(name==='first_source'||name==='first_candidate'||name==='first_text'||name==='first_frame'||name==='first_chunk'||name==='headers'||name==='first_search_complete')mark('provider_'+name);
     // First actual output is visible in logs even if the request stalls.
     if(events[name]===1)emit('provider_milestone',{id,stage,name,transport,elapsed_ms:elapsed(),call_elapsed_ms:times[name]});
    }
   };
   return {observe,finish(status){
    if(finished)return;finished=true;
    lastProvider={id,stage,transport,status:['completed','incomplete','failed','replayed'].includes(status)?status:'failed',elapsed_ms:Math.max(0,now()-began),times:{...times},counts:{...events}};
    emit('provider_complete',lastProvider);
   }};
  },
  result(kind){if(resultStages.has(kind)){const name='result_'+kind;const unseen=!Object.hasOwn(first,name);mark(name);if(unseen)emit('result_milestone',{kind,elapsed_ms:first[name]});}},
  blocked(kind){if(kinds.has(kind))count('blocked_'+kind);},
  write(kind,{candidateCount=0,reportCount=0}={}){
   kind=kinds.has(kind)?kind:'terminal';const id=++version,began=now();
   const stamp={version:id,phase_started_at:started,prepared_at:began,candidates:candidateCount,reports:reportCount};
   return {stamp,finish(ok){
    count(ok?'write_ok':'write_failed');
    lastWrite={...stamp,kind,ok:!!ok,elapsed_ms:Math.max(0,now()-began)};
    if(ok){if(candidateCount>0&&!Object.hasOwn(first,'saved_candidate'))first.saved_candidate=elapsed();if(reportCount>0&&!Object.hasOwn(first,'saved_report'))first.saved_report=elapsed();}
    emit('progress_write',lastWrite);
   }};
  },
  snapshot(){return {first:{...first},counts:{...counts},last_provider:lastProvider,last_write:lastWrite};},
  finish(){emit('phase_summary',this.snapshot());}
 };
}
