// Only backend-delivered formal recommendations may enter the report pager.
export function isVerifiedMatchReport(job){
 const score=job?.match_score;
 return !!job&&job.source_type==='站外官方招聘'&&job.jd_source_status==='VERIFIED_JD'&&job.evidence_status==='VERIFIED_FULL_JD'&&typeof job.evidence_excerpt==='string'&&!!job.evidence_excerpt.trim()&&job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&Number.isInteger(score)&&score>=0&&score<=100&&job.curated_suitable!==false&&(!job.report_status||job.report_status==='COMPLETE')&&!!job.research_detail?.score_explanation?.trim()&&Array.isArray(job.research_detail.comparisons)&&job.availability_status!=='CLOSED_LISTED'&&job.availability_status!=='POSSIBLY_CLOSED'&&job.excluded_closed!==true&&job.excluded_board!==true;
}
export function verifiedMatchReports(jobs){
 const seen=new Set();
 return (Array.isArray(jobs)?jobs:[]).filter(j=>{
  if(!isVerifiedMatchReport(j)||seen.has(j.official_url))return false;
  seen.add(j.official_url);return true;
 });
}
