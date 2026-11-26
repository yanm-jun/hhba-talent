// One event per observed complete candidate within a discovery response.
 // Cross-agent merging, task-wide deduplication and durable publication are
 // separate consumers of this event contract, not responsibilities of it.
import {normalizeV4StreamCandidate} from './v4-stream-job-parser.js';

export function createV4DiscoveryCandidateEvents({round,lane=0,signal,onCandidate,allow=()=>true}={}){
 const seen=new Set();let sequence=0;
 return raw=>{
  if(signal?.aborted||typeof onCandidate!=='function')return;
  const candidate=normalizeV4StreamCandidate(raw);
  if(!candidate||!allow(candidate)||seen.has(candidate.url))return;
  seen.add(candidate.url);
  // The identity is stable across replay of the same round/lane, regardless
  // of arrival order. Sequence is local to this response only.
  const event={
   event_id:JSON.stringify([round,lane,candidate.url]),
   round,lane,sequence:++sequence,
   candidate:{
    company:candidate.company,title:candidate.title,location:candidate.location,
    official_url:candidate.url,source_status:'MODEL_SEARCH_REPORTED',
    evidence_status:'RESEARCH_PENDING',match_score:null
   }
  };
  // An observer cannot fail the research request or trigger a second AI call.
  try{onCandidate(event);}catch{}
 };
}
