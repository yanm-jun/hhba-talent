/**
 * Evidence-quality metrics for a single completed search.
 * Descriptive counters only: never claim model accuracy, job availability or
 * an independent benchmark without a human-validated ground truth sample.
 */
export function jobResearchQuality(matches=[],diagnostic={}){
 const jobs=Array.isArray(matches)?matches:[];
 const count=jobs.length;
 const scoreCount=jobs.filter(j=>Number.isInteger(j?.match_score)&&
  j.match_score>=0&&j.match_score<=100).length;
 const sourceEvidence=jobs.filter(j=>j?.jd_source_status==='VERIFIED_JD'||
  j?.evidence_status==='PARTIAL_SOURCE').length;
 const detailedReasons=jobs.filter(j=>j?.evidence_reason_status==='AI_INDIVIDUAL_ANALYSIS'||
  j?.jd_source_status==='VERIFIED_JD').length;
 const verifiedFullJds=jobs.filter(j=>j?.jd_source_status==='VERIFIED_JD').length;
 const directionScores=jobs.filter(j=>j?.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED').length;
 const knownOpen=jobs.filter(j=>j?.availability_status==='OPEN_LISTED').length;
 return {
  label:'single_run_descriptive_not_ground_truth',
  shortlisted:count,scored:scoreCount,source_evidence:sourceEvidence,
  detailed_reasons:detailedReasons,verified_full_jds:verifiedFullJds,
  direction_reference_scores:directionScores,
  listed_open_unconfirmed:knownOpen,
  unsupported_scores:jobs.filter(j=>j?.evidence_status==='INSUFFICIENT_EVIDENCE'&&
   Number.isInteger(j?.match_score)).length,
  score_coverage_pct:count?Math.round(100*scoreCount/count):null,
  evidence_coverage_pct:count?Math.round(100*sourceEvidence/count):null,
  reason_coverage_pct:count?Math.round(100*detailedReasons/count):null,
  agent_searches:Number(diagnostic?.searches||0),
  agent_decisions:Number(diagnostic?.agent_decisions||0),
  agent_checkpoint_recovered:Boolean(diagnostic?.checkpoint_restored),
  feedback_research_rounds:Number(diagnostic?.score_feedback?.feedback_rounds||0),
  feedback_refined_jobs:Number(diagnostic?.score_feedback?.feedback_refined_jobs||0)
 };
}
