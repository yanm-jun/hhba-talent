// Product-specific quantities, not limits on model reasoning or search rounds.
export const CANDIDATE_TARGET=500,FINAL_TARGET=50;
const str=v=>typeof v==='string'?v.trim():'';
const norm=v=>str(v).replace(/\s+/g,' ').trim();
const canonical=v=>norm(v).normalize('NFKC').toLowerCase();
export function curatedUrl(raw){
 try{const u=new URL(raw);for(const k of [...u.searchParams.keys()])if(/^(utm_.+|gclid|fbclid|msclkid|spm|referrer)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return raw;}
}
export function candidateSummary(job,url){
 return {url,company:str(job.company),title:str(job.title||job.role),location:str(job.location||job.city),salary:str(job.salary)||null,
  source_kind:str(job.source_kind),site_name:str(job.site_name),employer_proof_url:str(job.employer_proof_url),employer_proof_urls:Array.isArray(job.employer_proof_urls)?job.employer_proof_urls.filter(v=>typeof v==='string'&&v.trim()):[],
  preliminary_score:Number.isInteger(job.score)&&job.score>=0&&job.score<=100?job.score:null,
  fit_summary:str(job.fit_summary||job.reason||job.recommendation_reason),requirements:str(job.requirements)};
}
export function candidateKey(job){
 return [job.company,job.title||job.role,job.location||job.city].map(canonical).join('\n');
}
export function concreteCandidate(job){
 return [job.company,job.title||job.role,job.location||job.city].every(x=>str(x)&&!/(?:待核实|待确认|未知|招聘来源|职位详情待|^unknown$|^n\/a$)/i.test(x));
}
// Exact independent quotations on both sides are required for supported claims.
// Missing requirements are allowed and must never be represented as experience.
export function validateCuratedReport(value,resume,jd){
 const errors=[];
 if(value?.suitable!==true) return {ok:false,declined:value?.suitable===false,errors:['suitable']};
 if(!str(value.reason))errors.push('reason');
 const comparisons=Array.isArray(value.comparisons)?value.comparisons:[];
 // Optional report structure is not an eligibility gate; validate any supplied claims.
 const has=(source,quote)=>!!str(quote)&&norm(source).includes(norm(quote));

 for(const c of comparisons){
  if(!['supported','partial','missing'].includes(c?.status)||!has(jd,c?.jd_quote)||!str(c?.analysis)){errors.push('comparison_jd_or_analysis');continue;}
  if(c.status!=='missing'){if(!has(resume,c.resume_quote))errors.push('comparison_resume');}
  else if(str(c.resume_quote)&&!has(resume,c.resume_quote))errors.push('comparison_resume');
 }

 if(!Number.isInteger(value.score)||value.score<0||value.score>100)errors.push('score');
 if(!has(resume,value.resume_quote)||!has(jd,value.jd_quote))errors.push('score_quotes');
 if(errors.length)return {ok:false,errors:[...new Set(errors)]};
 return {ok:true,report:{comparisons:comparisons.map(c=>({requirement:str(c.jd_quote),resume_evidence:str(c.resume_quote)||null,status:c.status,analysis:str(c.analysis)})),
  strengths:str(value.strengths),risks:str(value.risks),career_development:str(value.career_development),optimization_advice:str(value.optimization_advice),competition:str(value.competition),score_explanation:str(value.reason),
  extra_sections:Array.isArray(value.extra_sections)?value.extra_sections.filter(x=>str(x?.title)&&str(x?.content)).map(x=>({title:str(x.title),content:str(x.content)})):[]}};
}
export function rankCandidateUrls(payload,rows){
 const ordered=Array.isArray(payload?.ordered_urls)?payload.ordered_urls:[];
 const keys=new Set(rows.map(([url])=>url)),seen=new Set();
 const valid=ordered.filter(u=>keys.has(u)&&!seen.has(u)&&(seen.add(u),true));
 return valid.length===keys.size?valid:null;
}
export function qualifiedReport(job){return job?.curated_suitable!==false&&job?.source_type==='站外官方招聘'&&job.jd_source_status==='VERIFIED_JD'&&job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&Number.isInteger(job.match_score)&&!!job.research_detail;}

// Only independently verified, evidence-scored and suitable jobs enter the global report ranking.
export function eligibleCuratedScore(job){return job?.curated_suitable===true&&job.source_type==='站外官方招聘'&&job.jd_source_status==='VERIFIED_JD'&&job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&Number.isInteger(job.match_score)&&job.match_score>=0&&job.match_score<=100&&!!str(job.evidence_excerpt);}
