// Only backend-delivered formal recommendations may enter the report pager.
export function isVerifiedMatchReport(job){
 const score=job?.match_score;
 const original=job?.jd_source_status==='VERIFIED_JD'&&job.evidence_status==='VERIFIED_FULL_JD'&&typeof job.evidence_excerpt==='string'&&!!job.evidence_excerpt.trim()&&job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES';
 const reference=job?.reference_vacancy_verified===true&&job.reference_jd_kind==='AI_GENERATED_REFERENCE'&&job.evidence_score_status==='AI_REFERENCE_JD_SCORED'&&!!job.reference_jd?.trim()&&!!job.reference_jd_basis?.trim();
 return !!job&&job.source_type==='站外官方招聘'&&(original||reference)&&Number.isInteger(score)&&score>=0&&score<=100&&job.curated_suitable!==false&&(!job.report_status||job.report_status==='COMPLETE')&&!!job.research_detail?.score_explanation?.trim()&&Array.isArray(job.research_detail.comparisons)&&job.availability_status!=='CLOSED_LISTED'&&job.availability_status!=='POSSIBLY_CLOSED'&&job.excluded_closed!==true&&job.excluded_board!==true;
}
export function verifiedMatchReports(jobs){
 const seen=new Set();
 return (Array.isArray(jobs)?jobs:[]).filter(j=>{
  if(!isVerifiedMatchReport(j)||seen.has(j.official_url))return false;
  seen.add(j.official_url);return true;
 });
}

// Optional view ordering only; the backend's selected recommendation set is unchanged.
export function orderVerifiedMatchReports(jobs,mode='recommendation'){
 const selected=verifiedMatchReports(jobs);
 return mode==='score'?[...selected].sort((a,b)=>b.match_score-a.match_score):selected;
}
