// New research tasks have NO numeric source or candidate target. Count every
// observed search source, then independently validate and rank genuine jobs.
// A 30-report delivery target is not a cap on discovery, reasoning or research.
export const CANDIDATE_TARGET=null,FINAL_TARGET=30;
export const PREVIOUS_CANDIDATE_TARGET=300,PREVIOUS_FINAL_TARGET=30;
export const LEGACY_CANDIDATE_TARGET=500,LEGACY_FINAL_TARGET=50;
export const SOURCE_POOL_MODE='source_pool';
// Existing authorized research stays on the immutable contract on which it
// started. Never reinterpret a paid 300→30 / 500→50 continuation at deploy.
export function v4TaskTargets(checkpoint=null){
 if(checkpoint?.search_mode===SOURCE_POOL_MODE)
  return {candidateTarget:null,finalTarget:FINAL_TARGET,sourceDriven:true};
 if(checkpoint?.candidate_target===PREVIOUS_CANDIDATE_TARGET&&checkpoint?.final_target===PREVIOUS_FINAL_TARGET)
  return {candidateTarget:PREVIOUS_CANDIDATE_TARGET,finalTarget:PREVIOUS_FINAL_TARGET,sourceDriven:false};
 if(checkpoint&&(
  typeof checkpoint.phase==='string'||Number.isSafeInteger(checkpoint.round)||
  Array.isArray(checkpoint.rows)||checkpoint?.candidate_target===LEGACY_CANDIDATE_TARGET))
  return {candidateTarget:LEGACY_CANDIDATE_TARGET,finalTarget:LEGACY_FINAL_TARGET,sourceDriven:false};
 return {candidateTarget:null,finalTarget:FINAL_TARGET,sourceDriven:true};
}
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
  fit_summary:str(job.fit_summary||job.reason||job.recommendation_reason),requirements:str(job.requirements),jd_quote:str(job.jd_quote)};
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
 const compared=new Map();

 for(const c of comparisons){
  if(!['supported','partial','missing'].includes(c?.status)||!has(jd,c?.jd_quote)||!str(c?.analysis)){errors.push('comparison_jd_or_analysis');continue;}
  const requirement=norm(c.jd_quote),prior=compared.get(requirement);
  if(prior&&prior!==c.status)errors.push('comparison_conflicting_status');
  compared.set(requirement,c.status);
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
// Completeness is about meaningful coverage, not a word count or a fixed
// number of bullets. The model reviews its own output against the full input;
// evidence validation remains independent of that self-assessment.
export function reportCoverageErrors(value,jd,{reference=false}={}){
 if(value?.suitable!==true)return [];
 const errors=[],review=value.quality_review;
 if(!review||review.status!=='complete'||!str(review.explanation)||!Array.isArray(review.missing)||review.missing.length)errors.push('quality_review_incomplete');
 if(!Array.isArray(value.comparisons)||!value.comparisons.length)errors.push('missing_requirement_comparisons');
 if(reference){
  const coverage=value.reference_coverage;
  const duties=norm(coverage?.duties_quote),capabilities=norm(coverage?.capabilities_quote),original=norm(jd);
  if(!duties||!capabilities||duties===capabilities||duties.includes(capabilities)||capabilities.includes(duties)||!original.includes(duties)||!original.includes(capabilities))errors.push('reference_duties_and_capabilities_coverage');
 }
 return errors;
}

// Reference duties/capability advice must point to actual inputs, not to
// self-generated text. An exact role title is usable only as direction
// evidence, never as proof of a specific employer requirement.
export function referenceSourceErrors(value,job){
 const facts=Array.isArray(job?.jd_research?.facts)?job.jd_research.facts:[];
 const anchors=value?.reference_source_anchors;
 const errors=[];
 for(const field of ['duties','capabilities']){
  const a=anchors?.[field],quote=norm(a?.quote);
  const source=typeof a?.url==='string'?a.url:'';
  const validFact=!!quote&&facts.some(f=>f.url===source&&norm(f.quote).includes(quote));
  const validTitle=!!quote&&a?.kind==='title_direction'&&!source&&quote===norm(job?.title);
  if(!((a?.kind==='public_excerpt'&&validFact)||validTitle))errors.push('reference_source_'+field);
 }
 // Where real excerpts are available, at least one must actually inform the
 // output; title alone is a fallback, not a replacement for public material.
 if(facts.length&&!['duties','capabilities'].some(k=>anchors?.[k]?.kind==='public_excerpt'&&!errors.includes('reference_source_'+k)))errors.push('reference_public_material_unused');
 return errors;
}

// Evaluate the material independently of the candidate's assessment. A good
// public-source reference does not become invalid just because scoring failed.
export function referenceMaterialErrors(value,job){
 const reference=str(value?.reference_jd),basis=str(value?.reference_basis);
 if(!reference||!basis)return ['reference_material_missing'];
 const review=value.reference_material_review||value.quality_review;
 // Reuse the existing exact duties/capabilities span and self-review checks;
 // comparison evidence belongs to the separate score/report gate.
 return [...reportCoverageErrors({...value,suitable:true,quality_review:review,comparisons:[{}]},reference,{reference:true}),...referenceSourceErrors(value,job)];
}

export function rankCandidateUrls(payload,rows){
 const ordered=Array.isArray(payload?.ordered_urls)?payload.ordered_urls:[];
 const keys=new Set(rows.map(([url])=>url)),seen=new Set();
 const valid=ordered.filter(u=>keys.has(u)&&!seen.has(u)&&(seen.add(u),true));
 return valid.length===keys.size?valid:null;
}
export function qualifiedReport(job){return eligibleCuratedScore(job)&&job.report_status==='COMPLETE'&&!!str(job.research_detail?.score_explanation)&&Array.isArray(job.research_detail?.comparisons)&&!job.excluded_closed&&!job.excluded_board&&job.availability_status!=='CLOSED_LISTED'&&job.availability_status!=='POSSIBLY_CLOSED';}

// Only independently verified, evidence-scored and suitable jobs enter the global report ranking.
export function eligibleCuratedScore(job){
 if(job?.curated_suitable!==true||job.source_type!=='站外官方招聘'||!Number.isInteger(job.match_score)||job.match_score<0||job.match_score>100||job.excluded_closed||job.excluded_board||['CLOSED_LISTED','POSSIBLY_CLOSED'].includes(job.availability_status))return false;
 const original=job.jd_source_status==='VERIFIED_JD'&&job.evidence_status==='VERIFIED_FULL_JD'&&job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&!!str(job.evidence_excerpt);
 const reference=job.reference_vacancy_verified===true&&job.reference_jd_kind==='AI_GENERATED_REFERENCE'&&job.evidence_score_status==='AI_REFERENCE_JD_SCORED'&&!!str(job.reference_jd)&&!!str(job.reference_jd_basis)&&job.report_status==='COMPLETE'&&!!str(job.research_detail?.score_explanation)&&Array.isArray(job.research_detail?.comparisons);
 return original||reference;
}

// The model must order every eligible candidate exactly once. No model-created
// job or unverified candidate can enter the recommendation list.
export function validateGlobalOrder(value,jobs){
 const ids=new Set(jobs.map(j=>j.official_url));
 const urls=value?.ordered_urls;
 if(!Array.isArray(urls)||urls.length!==ids.size||new Set(urls).size!==ids.size||urls.some(u=>!ids.has(u)))return null;
 return urls;
}
export function applyGlobalOrder(jobs,order){
 const positions=new Map((order||[]).map((u,i)=>[u,i]));
 return [...jobs].sort((a,b)=>(positions.get(a.official_url)??Infinity)-(positions.get(b.official_url)??Infinity)||(b.match_score??-1)-(a.match_score??-1)||a.official_url.localeCompare(b.official_url));
}

// Accept durable rank progress without inventing IDs or losing earlier work.
// Compact IDs are scoped to the exact pool snapshot, never used as public URLs.
export function mergeGlobalRankProgress(value,prior,ids){
 const allowed=new Set(ids),old=new Set(prior);
 const proposed=value?.ordered_ids;
 if(Array.isArray(proposed)&&proposed.length===new Set(proposed).size&&proposed.every(id=>allowed.has(id))&&prior.every(id=>proposed.includes(id))&&proposed.length>prior.length)return proposed;
 const insertions=value?.insertions;
 if(!Array.isArray(insertions)||!insertions.length)return null;
 const next=[...prior],seen=new Set(old);
 for(const item of insertions){
  if(!item||!allowed.has(item.id)||seen.has(item.id)||(item.after_id!==null&&!seen.has(item.after_id)))return null;
  next.splice(item.after_id===null?0:next.indexOf(item.after_id)+1,0,item.id);seen.add(item.id);
 }
 return next;
}

export function carryGlobalRankProgress(order,oldRevisions,pool,revisions){
 const old=new Map(oldRevisions||[]),current=new Map(revisions),ids=new Map(pool.map(j=>[j.url,j.id]));
 return [...new Set(order||[])].filter(url=>ids.has(url)&&old.has(url)&&old.get(url)===current.get(url)).map(url=>ids.get(url));
}
