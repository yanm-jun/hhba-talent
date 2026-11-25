// Pipeline scheduling operates on durable snapshots, never on shared mutable
// discovery/verification maps. Candidate input revisions determine whether
// an earlier independent scoring attempt is reusable.
export const candidateRevision=j=>JSON.stringify([j.company,j.title,j.location,j.employer_proof_url,j.employer_proof_urls,j.requirements]);
export function pendingVerification(checkpoint){
 const done=new Set(checkpoint.processedEarlier||[]),evidence=new Map(checkpoint.processedEvidence||[]),recheck=new Set(checkpoint.explicitRechecks||[]),rejected=new Set(checkpoint.rejectedBoards||[]);
 return (checkpoint.rows||[]).filter(([u,j])=>!rejected.has(u)&&(!done.has(u)||evidence.get(u)!==candidateRevision(j)||recheck.has(u)));
}
export function verificationSnapshot(checkpoint){
 const prior=checkpoint.priorState||{};
 return {...structuredClone(checkpoint),phase:'verification',next:0,
  // A single early verification slot shares the Workers connection budget
  // with discovery. The final verification phase retains its adaptive batches.
  verificationBatch:1,matches:structuredClone(prior.matches||[]),read:prior.read||0,scored:prior.scored||0,archived:prior.archived||0,scoreFailures:prior.scoreFailures||0,reportFailures:prior.reportFailures||0,priorState:null};
}
const counters=['read','scored','archived','scoreFailures','reportFailures'];
export function mergePipelineCheckpoint(original,discovery,verification,attempted){
 const next=structuredClone(discovery);
 if(!verification)return next;
 const processed=new Set(next.processedEarlier||[]),revisions=new Map(next.processedEvidence||[]);
 const rechecks=new Set(next.explicitRechecks||[]);
 const originalRechecks=new Set(original.explicitRechecks||[]);
 for(const [u,j] of attempted){
  processed.add(u);revisions.set(u,candidateRevision(j));
  // A request to recheck newly discovered during the concurrent search
  // is intentionally preserved; the next verification will handle it.
  if(originalRechecks.has(u))rechecks.delete(u);
 }
 next.processedEarlier=[...processed];next.processedEvidence=[...revisions];next.explicitRechecks=[...rechecks];
 const rejected=new Set([...(next.rejectedBoards||[]),...(verification.rejectedBoards||[])]);
 next.rejectedBoards=[...rejected];
 next.rows=(next.rows||[]).filter(([u])=>!rejected.has(u));next.toolUrls=(next.toolUrls||[]).filter(u=>!rejected.has(u));
 const matches=(verification.matches||[]).filter(j=>!rejected.has(j.research_candidate_url||j.official_url)&&!rejected.has(j.official_url));
 const totals=Object.fromEntries(counters.map(k=>[k,verification[k]||0]));
 // Keep discovery's evidence indices stable for its outstanding tool result.
 const ledger=next.publicEvidence||[];
 const keys=new Set(ledger.map(r=>JSON.stringify([r.url,r.mode,r.offset,r.text])));
 for(const record of verification.publicEvidence||[]){const k=JSON.stringify([record.url,record.mode,record.offset,record.text]);if(!keys.has(k)){keys.add(k);ledger.push(record);}}
 next.publicEvidence=ledger;
 next.researchNotes=[...new Set([...(next.researchNotes||[]),...(verification.researchNotes||[])])];
 const diag={...(next.diagnostics||{})};
 for(const [k,v] of Object.entries(verification.diagnostics||{})){const delta=v-(original.diagnostics?.[k]||0);if(delta>0)diag[k]=(diag[k]||0)+delta;}
 diag.PIPELINE_VERIFICATION_ATTEMPTS=(diag.PIPELINE_VERIFICATION_ATTEMPTS||0)+attempted.length;
 next.diagnostics=diag;
 if(next.phase==='research')next.priorState={matches,...totals};
 else if(next.phase==='verification'){Object.assign(next,{matches,...totals,next:0,priorState:null});}
 else throw Error('PIPELINE_DISCOVERY_PHASE_INVALID');
 return next;
}
