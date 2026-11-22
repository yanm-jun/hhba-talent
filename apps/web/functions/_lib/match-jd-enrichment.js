/**
 * Exact employer JD verification for candidate matching.
 * Search results are provisional until their exact employer posting is read.
 * Never store resume text in the shared JD archive.
 */
import {safeJDSourceLocator,jdArchiveConfigured,jdArchiveReady,readFreshJobJdByUrl,saveVerifiedJobJd}
 from './job-jd-archive.js';
import {directOfficialJobEvidence} from './official-job-evidence.js';
import {fetchPublicAtsJd} from './public-ats-jd.js';
import {archivedJDToScoreJob} from './resume-reassessment.js';
import {scoreCandidateFit} from './match-ranking.js';
import {explainFinalJobScore} from './match-explanation.js';
import {deriveDocumentedWorkTenure} from './resume-tenure.js';
import {groundedCareerDirections} from './resume-role-evidence.js';
import {extractSelfReportedProfessionalCredentials} from './professional-credentials.js';
import {readJdPostingState,isClosedPosting,noteJdSourceFailure} from './jd-posting-lifecycle.js';

export const MATCH_JD_PIPELINE='HHBA_SEARCH_TO_VERIFIED_JD_V1';
export function matchJdEnrichmentEnabled(env){
 if(env?.HHBA_MATCH_JD_ENRICH_ENABLED==='0')return false;
 if(env?.HHBA_MATCH_JD_ENRICH_ENABLED==='1')return true;
 return jdArchiveConfigured(env)&&env?.HHBA_MATCH_SERVICE_ENABLED==='1';
}
const MAX_JOBS=10,CONCURRENCY=3;
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s._\-()（）]+/g,'');
function degreeInResume(source){
 const match=String(source||'').slice(0,20000).match(/(?:^|\n)\s*(?:最高学历|学历|学位)\s*[：:]\s*(博士|硕士|研究生|本科|学士|大专|专科|高中)(?:\s|$|[，。,;；])/im);
 if(!match)return null;
 const d=match[1];
 return /博士/.test(d)?'PHD':/(?:硕士|研究生)/.test(d)?'MASTER':
  /(?:本科|学士)/.test(d)?'BACHELOR':/(?:大专|专科)/.test(d)?'ASSOCIATE':'HIGH_SCHOOL';
}
function resumeMentionsSkill(source,skill){
 const term=normalize(skill);
 if(term.length<2)return false;
 return String(source||'').split(/[\n。；;]/).slice(0,250).some(line=>{
  const normalized=normalize(line);
  return normalized.includes(term)&&
   !/(?:不会|不熟悉|未掌握|没有|尚未|正在学习|计划学习|learning|noexperience)/i.test(normalized);
 });
}
export function resumeJDProfile(resume,requirements,roleHint=''){
 const text=String(resume||'').slice(0,20000);
 const tenure=deriveDocumentedWorkTenure(text);
 const terms=[...new Set([...(requirements.required_skills||[]),
  ...(requirements.preferred_skills||[]),...(requirements.unclassified_skills||[]),
  ...(requirements.mandatory_skills||[])].filter(x=>typeof x==='string'&&x.length<60))];
 return {
  education:degreeInResume(text),
  experience_years:tenure?.years??null,
  skills:terms.filter(s=>resumeMentionsSkill(text,s)).map(name=>({name})).slice(0,20),
  target_roles:groundedCareerDirections([],text),
  professional_credentials:extractSelfReportedProfessionalCredentials(text),
  requested_role:String(roleHint||'').slice(0,80)
 };
}
function samePostedRole(found,verified){
 const a=normalize(found),b=normalize(verified);
 if(!a||!b)return false;
 if(a===b||a.includes(b)||b.includes(a))return true;
 const chinese=/[\u4e00-\u9fff]/;
 if(chinese.test(a)||chinese.test(b)){
  const bigrams=value=>new Set(Array.from({length:Math.max(0,value.length-1)},
   (_,i)=>value.slice(i,i+2)));
  const x=bigrams(a),y=bigrams(b);
  const overlap=[...x].filter(t=>y.has(t)).length;
  return overlap>=2&&overlap/Math.min(x.size||1,y.size||1)>=.5;
 }
 const words=value=>new Set(value.split(/[^a-z0-9]+/i).filter(x=>x.length>=3));
 const x=words(found.toLowerCase()),y=words(verified.toLowerCase());
 const overlap=[...x].filter(w=>y.has(w)).length;
 return overlap>=2&&overlap/Math.min(x.size||1,y.size||1)>=.5;
}
export function scoreVerifiedJDSearchJob(original,archived,resume,options={}){
 const reportedLocation=normalize(original?.location);
 const verifiedCities=String(archived?.location||'').split(/[、，,|/；;]/).map(city=>normalize(city).replace(/市$/,''));
 if(!samePostedRole(original?.title,archived?.title)||
  !verifiedCities.some(city=>city&&reportedLocation.includes(city)))return null;
 const job=archivedJDToScoreJob(archived);
 if(!job)return null;
 const profile=resumeJDProfile(resume,job,options.role_hint);
 // User-selected role hints alone are not job skills and cannot justify
 // numeric scoring. Require independently documented resume evidence.
 const evidence=profile.skills.length>0||
  (Number.isFinite(profile.experience_years)&&job.min_experience_years>0)||
  Boolean(profile.education&&job.minimum_education)||
  profile.target_roles.some(role=>samePostedRole(role,job.title));
 const fit=evidence?scoreCandidateFit(profile,job,{role_hint:profile.requested_role}):
  {eligible:false,reason:'RESUME_EVIDENCE_MISSING',score:null};
 const linked={
  ...original,location:archived.location,official_url:archived.canonical_url,
  jd_version_id:archived.id,jd_sha256:archived.jd_sha256,
  jd_checked_at:archived.checked_at,jd_proof_method:archived.proof_method,
  jd_source_status:'VERIFIED_JD',source_status:'OFFICIAL_JD_VERIFIED',
  evidence_status:'VERIFIED_FULL_JD',
  jd_employer_identity_status:archived.proof_method==='PUBLIC_EMPLOYER_ATS_V1'?
   'ATS_TENANT_NOT_LEGAL_ENTITY_VERIFIED':'DIRECT_EMPLOYER_SOURCE',
  ranking_version:'HHBA_MATCH_RANKING_V2',
  requirements_basis:archived.sections.filter(s=>s.kind==='requirements')
   .map(s=>s.text).join(' ').slice(0,220),
  needs_verification:['已获取该公开岗位 JD；是否仍在招、公司法定名称和投递资格仍以企业官网为准。']
 };
 if(!fit.eligible||!Number.isInteger(fit.score)){
  return {...linked,match_score:null,reference_score:0,score_basis:'',
   score_breakdown:null,jd_score_status:'INSUFFICIENT_RESUME_EVIDENCE',
   not_evidenced:['已核验岗位要求，但简历缺少足够证据，无法可靠打分。']};
 }
 const rationale=explainFinalJobScore(profile,job,fit);
 return {...linked,match_score:fit.score,reference_score:fit.score,
  score_basis:rationale.score_reasoning||'',score_breakdown:fit.breakdown,
  jd_score_status:'V2_JD_EVIDENCE_SCORED',matched:rationale.matched,
  not_evidenced:rationale.not_evidenced,score_reasoning:rationale.score_reasoning,
  evidence_quality:fit.evidence_quality};
}
export async function enrichSearchMatchesWithJD(env,matches,resume,options={},deps={}){
 const source=Array.isArray(matches)?matches.slice(0,MAX_JOBS):[];
 const disabled={matches:source,diagnostic:{mode:'disabled',eligible:0,verified:0,scored:0,failed:0}};
 if(!matchJdEnrichmentEnabled(env)||!jdArchiveConfigured(env))return disabled;
 const ready=deps.ready||jdArchiveReady;
 try{if(!await ready(env))return {...disabled,diagnostic:{...disabled.diagnostic,mode:'not-ready'}};}
 catch{return {...disabled,diagnostic:{...disabled.diagnostic,mode:'not-ready'}};}
 const getCached=deps.getCached||readFreshJobJdByUrl;
 const save=deps.save||saveVerifiedJobJd;
 const fetchDirect=deps.fetchDirect||directOfficialJobEvidence;
 const fetchAts=deps.fetchAts||fetchPublicAtsJd;
 const out=[...source],candidates=source.map((job,i)=>({job,i,locator:safeJDSourceLocator(job?.official_url)}))
  .filter(x=>x.locator&&!(options.domesticOnly&&x.locator.kind));
 let cursor=0,verified=0,scored=0,failed=0,closed=0;
 const inFlight=new Map();
 const load=locator=>{
  let promise=inFlight.get(locator.url);
  if(!promise){
   promise=(async()=>{
    // A confirmed closed JD must disappear from active recommendations even
    // when a model's earlier Search response still points at the same URL.
    const posting=await readJdPostingState(env,locator.url);
    if(isClosedPosting(posting)){
     const err=new Error('JD_POSTING_CONFIRMED_CLOSED');
     err.isKnownClosed=true;
     throw err;
    }
    const cached=await getCached(env,locator.url);
    if(cached)return cached;
    let fetched;
    try{
    fetched=locator.kind?await fetchAts(locator.url):
     await fetchDirect(locator.url,{signal:options.signal});
    }catch(error){
     await noteJdSourceFailure(env,locator.url,error);
     throw error;
    }
    if(!fetched?.full_jd||fetched.canonical_url!==locator.url)throw Error('JD_SOURCE_NOT_VERIFIED');
    return save(env,fetched);
   })();
   inFlight.set(locator.url,promise);
  }
  return promise;
 };
 const work=async()=>{
  while(cursor<candidates.length){
   if(options.signal?.aborted)return;
   const {job,i,locator}=candidates[cursor++];
   try{
    const jd=await load(locator);
    if(!jd?.fresh||!jd.id||jd.canonical_url!==locator.url||
     !jd.sections?.some(s=>s.kind==='requirements'))throw Error('JD_INCOMPLETE');
    const linked=scoreVerifiedJDSearchJob(job,jd,resume,options);
    if(!linked)throw Error('JD_SCORE_NOT_AVAILABLE');
    verified++;
    if(options.compareEvidence){
     const analysis=await options.compareEvidence(jd).catch(()=>null);
     const score=analysis?.score??null;
     out[i]={...linked,match_score:score,reference_score:score??0,
      score_breakdown:undefined,score_reasoning:undefined,ranking_version:undefined,
      score_basis:score===null?'':'依据这份岗位 JD 与简历证据逐项对照。',
      recommendation_reason:!analysis?'已取得完整岗位 JD，本次暂未生成匹配分。':
       score===null?'简历中能与这份岗位 JD 对照的证据不足，暂未评分。':'下面是这份岗位 JD 与简历原文的具体对应。',
      matched:[],not_evidenced:[],jd_comparisons:analysis?.comparisons??[],
      jd_score_status:score===null?'INSUFFICIENT_RESUME_EVIDENCE':'AI_VERIFIED_JD_SCORED'};
     if(score!==null)scored++;
    }else{
     out[i]=linked;
     if(linked.jd_score_status==='V2_JD_EVIDENCE_SCORED')scored++;
    }
    options.onVerified?.(out.filter(Boolean));
   }catch(error){
    // A repeated verified 404/410 can CLOSE a posting during this very
    // request, not just on an earlier search. Re-read persisted state after
    // the error so even the second 404 never leaks a stale recommendation.
    let confirmed=Boolean(error?.isKnownClosed);
    if(!confirmed){
     try{confirmed=isClosedPosting(await readJdPostingState(env,locator.url))}
     catch{ /* an unavailable lifecycle store is not closure evidence */ }
    }
    if(confirmed){out[i]=null;closed++;options.onVerified?.(out.filter(Boolean));}
    else failed++;
   }
  }
 };
 await Promise.all(Array.from({length:Math.min(CONCURRENCY,candidates.length)},()=>work()));
 return {matches:out.filter(Boolean),
  diagnostic:{mode:MATCH_JD_PIPELINE,eligible:candidates.length,verified,scored,failed,closed}};
}
