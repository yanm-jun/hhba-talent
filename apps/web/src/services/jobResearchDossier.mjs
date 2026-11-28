// Present factual job research milestones; never infer work from elapsed time,
// provider rounds, preliminary match scores, or an unverified application URL.
const filled=v=>typeof v==='string'&&v.trim().length>0;
const validScore=v=>Number.isInteger(v)&&v>=0&&v<=100;
export function jobResearchDossier(job){
 const officialJd=job?.jd_source_status==='VERIFIED_JD'&&job?.source_type==='站外官方招聘'&&filled(job?.evidence_excerpt);
 const identityVerified=officialJd||job?.reference_vacancy_verified===true;
 const referenceJd=job?.reference_jd_kind==='AI_GENERATED_REFERENCE'&&filled(job?.reference_jd);
 const factualJd=filled(job?.evidence_excerpt)||!!job?.jd_research?.facts?.some(f=>filled(f?.quote));
 const groundedScore=job?.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&validScore(job?.match_score);
 const referenceScore=job?.evidence_score_status==='AI_REFERENCE_JD_SCORED'&&referenceJd&&validScore(job?.match_score);
 const reportFinished=job?.report_status==='COMPLETE'&&!!job?.research_detail&&Array.isArray(job.research_detail.comparisons);
 const comparisons=reportFinished?job.research_detail.comparisons.length:Array.isArray(job?.jd_comparisons)?job.jd_comparisons.length:0;
 const stages=[
  {id:'identity',title:'企业与岗位身份调查',state:identityVerified?'complete':'pending',
   label:identityVerified?'已核验':'待核验',
   summary:identityVerified?'已取得该岗位的官方招聘归属证据。':filled(job?.official_url)?'已收录具体岗位链接，官方归属仍待独立确认。':'尚未取得可核对的岗位页面。'},
  {id:'jd',title:'岗位 JD 深度解读',state:officialJd?'complete':referenceJd?'reference':factualJd?'partial':'pending',
   label:officialJd?'官方原文':referenceJd?'AI 参考 JD':factualJd?'部分公开资料':'待研究',
   summary:officialJd?'已取得完整官方 JD，职责与资格以原文为准。':referenceJd?'已整理明确标注的 AI 参考 JD，不代表企业真实招聘要求。':factualJd?'已有部分公开招聘资料，不能视为完整官方 JD。':'尚未取得可靠 JD 原文或参考研究结果。'},
  {id:'evidence',title:'简历经历与岗位证据比对',state:groundedScore?'complete':referenceScore?'reference':comparisons?'partial':'pending',
   label:groundedScore?'证据评分完成':referenceScore?'参考评分完成':comparisons?'已取得部分对照':'待比对',
   summary:groundedScore?'已依据完整 JD 与简历真实原文进行对照评分。':referenceScore?'已基于明确标注的 AI 参考 JD 形成适配评分。':comparisons?'已有逐项对照资料，可靠的完整评分仍待确认。':'尚无可靠的简历与岗位证据评分。',
   ...(comparisons?{count:comparisons}:{})},
  {id:'judgement',title:'职业竞争力综合研判',state:reportFinished?'complete':['DECLINED','UNAVAILABLE'].includes(job?.report_status)?'attention':job?.report_status==='RETRY_PENDING'?'partial':'pending',
   label:reportFinished?'深度报告完成':job?.report_status==='DECLINED'?'不建议正式推荐':job?.report_status==='UNAVAILABLE'?'未取得可靠报告':job?.report_status==='RETRY_PENDING'?'等待补充复核':'待形成',
   summary:reportFinished?'已形成有证据支持的职业优势、风险与优化建议。':job?.report_status==='DECLINED'?'现有研究认为不适合正式推荐，保留原始资料。':job?.report_status==='UNAVAILABLE'?'报告未通过可靠性核验，保留已取得的研究资料。':job?.report_status==='RETRY_PENDING'?'部分报告证据仍需补充核对，不提前宣称完成。':'完整职业研判尚未形成。'}
 ];
 return {stages,finished:stages.filter(s=>s.state==='complete'||s.state==='reference').length,officialJd,identityVerified,referenceJd,groundedScore,referenceScore,reportFinished};
}
