// The client carries its selected match snapshot. It is advisory, never a
// replacement for a verified JD, a current resume, or independent scoring.
export function preparePriorMatchAnalysis(snapshot,verifiedJob,redact){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
  !verifiedJob?.jd_version_id||typeof snapshot.official_url!=='string'||
  snapshot.official_url!==verifiedJob.official_url)return undefined;
 const sameJd=snapshot.jd_version_id===verifiedJob.jd_version_id&&
  snapshot.jd_sha256===verifiedJob.jd_sha256;
 const analysis=JSON.parse(redact(JSON.stringify(snapshot)));
 // Explicitly distinguish historical/reference scores and verified matching
 // evidence. A client snapshot is not trusted proof of a score or qualification.
 const score=Number.isInteger(snapshot.match_score)&&snapshot.match_score>=0&&snapshot.match_score<=100?snapshot.match_score:null;
 const reference=Number.isInteger(snapshot.reference_score)&&snapshot.reference_score>0&&snapshot.reference_score<=100?snapshot.reference_score:null;
 return {...analysis,match_score:score,reference_score:reference,
  jd_version_matches_current:sameJd,
  provenance:'CLIENT_MATCH_SNAPSHOT_ADVISORY',
  review_note:sameJd?'同一岗位JD版本的历史匹配分析；当前简历可能已经修改，请独立复核。':
   '同一岗位的历史研究，JD版本可能已更新。只作为研究线索，重新核对当前JD及当前简历。'};
}
