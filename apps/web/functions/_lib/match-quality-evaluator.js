/**
 * Offline aggregate evaluation of a manually labelled, consented/synthetic
 * benchmark. Does NOT ingest raw resumes, certificates, names or contact info.
 * Labels are caller-owned test fixtures; results are NOT a hiring success rate.
 */
export function summarizeMatchEvaluation(cases){
 if(!Array.isArray(cases)||!cases.length)throw Error('QUALITY_CASES_REQUIRED');
 let top1=0,withRelevant=0,recommended=0,relevantRecommended=0;
 let hardViolation=0,duplicate=0,missingLinks=0;
 let roleCoverage=0;
 const groups=new Map();
 for(const row of cases){
  if(!row||typeof row.group!=='string'||row.group.length>60||
   !Array.isArray(row.relevant_ids)||!Array.isArray(row.recommended))
   throw Error('QUALITY_INVALID_CASE');
  const relevant=new Set(row.relevant_ids.filter(x=>typeof x==='string'));
  const jobs=row.recommended;
  const seen=new Set();
  const right=jobs.filter(job=>relevant.has(job?.id));
  if(jobs.length&&relevant.has(jobs[0]?.id))top1++;
  if(right.length)withRelevant++;
  relevantRecommended+=right.length;recommended+=jobs.length;
  if(relevant.size)roleCoverage++;
  for(const job of jobs){
   if(!job||typeof job.id!=='string'||typeof job.official_url!=='string')
    throw Error('QUALITY_INVALID_JOB');
   if(seen.has(job.id))duplicate++;else seen.add(job.id);
   if(job.hard_gate_violation===true)hardViolation++;
   if(!job.official_url.startsWith('https://'))missingLinks++;
  }
  const g=groups.get(row.group)||{cases:0,top1:0,covered:0};
  g.cases++;g.top1+=Number(jobs.length>0&&relevant.has(jobs[0]?.id));
  g.covered+=Number(right.length>0);
  groups.set(row.group,g);
 }
 const round=(a,b)=>b?Math.round(a/b*10000)/100:0;
 return {
  type:'OFFLINE_LABELED_RELEVANCE_ONLY',
  case_count:cases.length,
  precision_at_returned:round(relevantRecommended,recommended),
  top1_relevance:round(top1,cases.length),
  recall_coverage:round(withRelevant,cases.length),
  synthetic_or_reviewed_labels_only:true,
  labeled_cases_with_expected_matches:roleCoverage,
  hard_gate_violations:hardViolation,
  duplicate_ids:duplicate,
  unsafe_or_missing_links:missingLinks,
  by_group:Object.fromEntries([...groups.entries()].sort(([a],[b])=>a.localeCompare(b))
   .map(([group,g])=>[group,{cases:g.cases,top1_relevance:round(g.top1,g.cases),
    coverage:round(g.covered,g.cases)}]))
 };
}
