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


/**
 * An OFFLINE graded-relevance evaluator; uses human-labelled job IDs only.
 * Recall@20 is relative to the supplied reviewed labels, not the entire
 * national job market. Never call this an interview or hiring success rate.
 */
export function summarizeRankedRelevance(cases){
 if(!Array.isArray(cases)||cases.length===0)throw Error('RANKING_CASES_REQUIRED');
 const agg={p3:0,p10:0,r20:0,ndcg10:0,candidateRecall:0};
 const byGroup=new Map(),round=v=>Math.round(v*10000)/100;
 for(const row of cases){
  if(!row||typeof row.group!=='string'||row.group.length>60||
   !Array.isArray(row.recommended_ids)||row.recommended_ids.length>100||
   !Array.isArray(row.candidate_ids)||row.candidate_ids.length>2500||
   !row.relevance_grades||typeof row.relevance_grades!=='object'||
   Array.isArray(row.relevance_grades))throw Error('RANKING_INVALID_CASE');
  const labels=Object.entries(row.relevance_grades);
  if(labels.length>2500||labels.some(([id,grade])=>
   !id||id.length>150||!Number.isInteger(grade)||grade<0||grade>3))
   throw Error('RANKING_INVALID_GRADE');
  const score=id=>Number(row.relevance_grades[id])||0;
  const relevant=labels.filter(([,v])=>v>0).map(([id])=>id);
  const ranking=row.recommended_ids.filter(id=>typeof id==='string');
  if(ranking.length!==row.recommended_ids.length||
   ranking.some(id=>id.length>150)||new Set(ranking).size!==ranking.length)
   throw Error('RANKING_INVALID_IDS');
  const precision=k=>ranking.slice(0,k).filter(id=>score(id)>0).length/k;
  const recall=k=>relevant.length?
   ranking.slice(0,k).filter(id=>score(id)>0).length/relevant.length:0;
  const dcg=xs=>xs.reduce((sum,grade,index)=>
   sum+(Math.pow(2,grade)-1)/Math.log2(index+2),0);
  const ideal=dcg(labels.map(x=>x[1]).sort((a,b)=>b-a).slice(0,10));
  const actual=dcg(ranking.slice(0,10).map(score));
  const stats={
   p3:precision(3),p10:precision(10),r20:recall(20),
   ndcg10:ideal?actual/ideal:0,
   candidateRecall:relevant.length?row.candidate_ids.filter(id=>score(id)>0).length/relevant.length:0
  };
  for(const k of Object.keys(agg))agg[k]+=stats[k];
  const group=byGroup.get(row.group)||{n:0,ndcg:0,recall:0};
  group.n++;group.ndcg+=stats.ndcg10;group.recall+=stats.r20;
  byGroup.set(row.group,group);
 }
 const n=cases.length;
 return {kind:'OFFLINE_GRADED_LABELS_ONLY',sample_count:n,
  precision_at_3:round(agg.p3/n),precision_at_10:round(agg.p10/n),
  recall_at_20_labeled:round(agg.r20/n),ndcg_at_10:round(agg.ndcg10/n),
  candidate_recall_labeled:round(agg.candidateRecall/n),
  by_group:Object.fromEntries([...byGroup.entries()].sort(([a],[b])=>a.localeCompare(b))
   .map(([k,v])=>[k,{cases:v.n,ndcg_at_10:round(v.ndcg/v.n),
    recall_at_20_labeled:round(v.recall/v.n)}])),
  privacy:'NO_RESUME_OR_PERSONAL_IDENTIFIERS',
  caveat:'Only against supplied human-reviewed labels; not all available jobs or hiring success'
 };
}
