// Pipeline scheduling operates on durable snapshots, never on shared mutable
// discovery/verification maps. Candidate input revisions determine whether
// an earlier independent scoring attempt is reusable.
export const candidateRevision=j=>JSON.stringify([j.company,j.title,j.location,j.employer_proof_url,j.employer_proof_urls,j.requirements]);
// Scoped, revision-bound notes never cross vacancies. Public-source research
// and CV-dependent assessment use separate channels. No raw resume pages.
export function candidateResearchMemory(checkpoint=[]){
 const records=new Map(checkpoint);
 const notes=(url,revision,channel='publicNotes')=>{
  let entry=records.get(url);
  if(!entry||entry.revision!==revision){entry={revision,publicNotes:[],analysisNotes:[]};records.set(url,entry);}
  if(channel==='analysisNotes')for(const n of entry.publicNotes)if(!entry.analysisNotes.includes(n))entry.analysisNotes.push(n);
  return entry[channel];
 };
 return {notes,snapshot:()=>[...records]};
}
export function mergeCandidateResearchMemory(discovery=[],verification=[],rows=[]){
 const current=new Map(rows.map(([url,j])=>[url,candidateRevision(j)]));
 const merged=new Map();
 for(const [url,entry] of [...discovery,...verification]){
  if(!entry||current.get(url)!==entry.revision)continue;
  const prev=merged.get(url);
  merged.set(url,{revision:entry.revision,publicNotes:[...new Set([...(prev?.publicNotes||[]),...(entry.publicNotes||[])])],analysisNotes:[...new Set([...(prev?.analysisNotes||[]),...(entry.analysisNotes||[])])]});
 }
 return [...merged];
}
export function pendingVerification(checkpoint){
 const done=new Set(checkpoint.processedEarlier||[]),evidence=new Map(checkpoint.processedEvidence||[]),recheck=new Set(checkpoint.explicitRechecks||[]),rejected=new Set(checkpoint.rejectedBoards||[]);
 const pending=(checkpoint.rows||[]).filter(([u,j])=>!rejected.has(u)&&(!done.has(u)||evidence.get(u)!==candidateRevision(j)||recheck.has(u)));
 const deferred=new Set(checkpoint.verificationDeferred||[]);
 return [...pending.filter(([u])=>!deferred.has(u)),...pending.filter(([u])=>deferred.has(u))];
}
export function pipelineWidths(checkpoint,pending){
 // Reserve one of six simultaneous outgoing connections for storage/auth.
 // Divide the remaining slots by actual backlog; no total job cap.
 const width=Math.max(1,Math.min(4,checkpoint.discoveryWidth||3));
 const desired=pending>=48&&checkpoint.pipelineVerificationWidth>=4?4:pending>=12?3:pending>=2?2:1;
 const previous=Number.isSafeInteger(checkpoint.pipelineVerificationWidth)?checkpoint.pipelineVerificationWidth:desired;
 const verification=Math.max(1,Math.min(pending,desired,previous));
 return {verification,discovery:Math.max(1,Math.min(width,5-verification))};
}
// A window can refill idle lanes while the discovery sibling is still running.
// Only grow on measured cheap work; connection width remains independently bounded.
export function pipelineVerificationWindow(checkpoint,pending,width){
 const cost=checkpoint.pipelineVerificationCost;
 if(!Number.isFinite(cost)||cost<=0||cost>4||pending<=width)return Math.min(pending,width);
 return Math.min(pending,width*2,Math.max(width,Math.floor(20/cost)));
}
export function verificationSnapshot(checkpoint,width=1,window=width){
 const prior=checkpoint.priorState||{};
 return {...structuredClone(checkpoint),phase:'verification',next:0,
  // Share transport slots with discovery; final verification has its own batches.
  verificationBatch:window,verificationLaneWidth:width,matches:structuredClone(prior.matches||[]),read:prior.read||0,scored:prior.scored||0,archived:prior.archived||0,scoreFailures:prior.scoreFailures||0,reportFailures:prior.reportFailures||0,priorState:null};
}
const counters=['read','scored','archived','scoreFailures','reportFailures'];
export function mergePipelineCheckpoint(original,discovery,verification,attempted,{verificationIncomplete=false}={}){
 const next=structuredClone(discovery);
 if(!verification)return next;
 // Each lane may have produced public-only records while storage was unavailable.
 next.pendingPublicAssets=[...new Map([...(next.pendingPublicAssets||[]),...(verification.pendingPublicAssets||[])].map(r=>[r.identity.url+'|'+r.kind,r])).values()];
 const processed=new Set(next.processedEarlier||[]),revisions=new Map(next.processedEvidence||[]);
 const rechecks=new Set(next.explicitRechecks||[]);
 const originalRechecks=new Set(original.explicitRechecks||[]);
 const verifiedRevisions=new Map(verification.processedEvidence||[]);
 // A successful phase may yield before the whole window is admitted. Its next
 // cursor is the actual completed prefix. A failed phase uses only durable
 // evidence; explicit rechecks still pending must not be counted as completed.
 const completed=verificationIncomplete?attempted.filter(([u,j])=>(verification.processedEarlier||[]).includes(u)&&verifiedRevisions.get(u)===candidateRevision(j)&&!(verification.explicitRechecks||[]).includes(u)):verification.phase==='verification'&&Number.isSafeInteger(verification.next)&&verification.next>0?attempted.slice(0,verification.next):attempted;
 const completedUrls=new Set(completed.map(([u])=>u)),deferred=new Set(next.verificationDeferred||[]);
 for(const [u] of attempted){if(completedUrls.has(u))deferred.delete(u);else if(verificationIncomplete)deferred.add(u);}
 next.verificationDeferred=[...deferred];
 for(const [u,j] of completed){
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
 const keys=new Set(ledger.map(r=>JSON.stringify([r.type,r.url,r.mode,r.document_url,r.offset,r.text])));
 for(const record of verification.publicEvidence||[]){const k=JSON.stringify([record.type,record.url,record.mode,record.document_url,record.offset,record.text]);if(!keys.has(k)){keys.add(k);ledger.push(record);}}
 next.publicEvidence=ledger;
 const discoveryNotes=next.researchNotes||[];
 next.researchNotes=[...new Set([...discoveryNotes,...(verification.researchNotes||[])])];
 // New notes from another lane must not disappear behind an older digest.
 if(next.researchNotes.length!==discoveryNotes.length)next.researchDigest='';
 next.candidateResearchMemory=mergeCandidateResearchMemory(next.candidateResearchMemory,verification.candidateResearchMemory,next.rows);
 const reads=new Map([...(next.verificationReads||[]),...(verification.verificationReads||[])]);
 for(const [u] of completed)reads.delete(u);
 next.verificationReads=[...reads];
 const diag={...(next.diagnostics||{})};
 for(const [k,v] of Object.entries(verification.diagnostics||{})){const delta=v-(original.diagnostics?.[k]||0);if(delta>0)diag[k]=(diag[k]||0)+delta;}
 diag.PIPELINE_VERIFICATION_ATTEMPTS=(diag.PIPELINE_VERIFICATION_ATTEMPTS||0)+completed.length;
 next.diagnostics=diag;
 if(next.phase==='research')next.priorState={matches,...totals};
 else if(next.phase==='verification'){Object.assign(next,{matches,...totals,next:0,priorState:null});}
 else throw Error('PIPELINE_DISCOVERY_PHASE_INVALID');
 return next;
}

// Optional one-lane read-ahead. Pending jobs stay in the ordinary candidate
// pool when admission closes. Never make this optimization a completion gate.
export function discoveryReadAhead(read,{canStart=()=>true,signal}={}){
 const queue=new Map(),seen=new Set();let active=null,closed=false;
 function pump(){
  if(active||closed||signal?.aborted||!canStart()||!queue.size)return;
  const [key,item]=queue.entries().next().value;queue.delete(key);seen.add(key);
  active=Promise.resolve().then(()=>read(item)).catch(()=>{}).finally(()=>{active=null;pump();});
 }
 return {offer(key,item){if(closed||seen.has(key))return;queue.set(key,item);pump();},
  async close(){closed=true;queue.clear();if(active)await active;}};
}
