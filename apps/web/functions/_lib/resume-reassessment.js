// Inspectable same-engine reassessment of an existing verified mainland ATS job.
// Both snapshots are scored using HHBA_MATCH_RANKING_V2, not a keyword-derived UI score.
import {safeJobLink,isVerifiedMainlandLocation} from './resume-match-core.js';
import {scoreCandidateFit,RANKING_VERSION} from './match-ranking.js';
import {extractSkillRequirements} from './job-skill-evidence.js';
import {experienceMinRequirement,degreeMinRequirement} from './domestic-match-fusion.js';
import {extractMandatoryProfessionalCredentials} from './professional-credentials.js';

const simplify=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\-_.()（）【】\[\]]+/g,'');
const credentials=['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'];
const MAX_AGE=24*3600*1000;
export function validatedAuditedJob(sources,id,now=Date.now()){
 const {snapshot,audit,facets}=sources||{};
 if(!Array.isArray(snapshot?.jobs)||!Array.isArray(audit?.jobs)||!Array.isArray(facets?.jobs)||
  audit.jobs.length!==snapshot.jobs.length||facets.jobs.length!==snapshot.jobs.length||
  audit?.summary?.kind!=='HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1'||
  audit.summary.indexed_as_of!==snapshot.updated||facets.indexed_as_of!==snapshot.updated)
  return null;
 for(const time of [snapshot.updated,audit.summary.checked_at,facets.verified_at]){
  const elapsed=now-Date.parse(time||'');
  if(!Number.isFinite(elapsed)||elapsed < -300000||elapsed>MAX_AGE)return null;
 }
 const job=snapshot.jobs.find(x=>x?.id===id);
 const proof=audit.jobs.find(x=>x?.job_id===id&&x.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'&&
  x.full_original_jd_verified===true&&x.requirements_evidence===true&&typeof x.jd_sha256==='string');
 const f=facets.jobs.find(x=>x?.id===id&&x.original_source_hash===proof?.jd_sha256);
 if(!job||!proof||proof.platform!==job.platform||!f||
  !safeJobLink(job)||!isVerifiedMainlandLocation(job,f))return null;
 const skills=Array.isArray(f.skills)?[...new Set(f.skills.filter(s=>typeof s==='string'&&s.length>=2&&s.length<=60))].slice(0,20):[];
 return {id:job.id,title:job.title,company:job.company,location:job.location,
  platform:job.platform,official_url:job.url,
  required_skills:[],mandatory_skills:[],preferred_skills:[],unclassified_skills:skills,
  min_experience_years:Number.isFinite(f.experienceMinYears)?f.experienceMinYears:null,
  minimum_education:typeof f.education==='string'?f.education:null,
  proof_hash:proof.jd_sha256,updated_at:snapshot.updated};
}
/**
 * Translate only a cryptographically verified, FRESH employer JD archive
 * into deterministic V2 score facets. Requirements come from the posted
 * qualifications section, never a model-written recommendation. This
 * remains a resume-evidence comparison, NOT an employer assessment.
 */
export function archivedJDToScoreJob(jd){
 if(!jd?.fresh||typeof jd.id!=='string'||!/^jd_[a-f0-9]{32}$/.test(jd.id)||
  !Array.isArray(jd.sections)||typeof jd.jd_sha256!=='string'||
  !jd.sections.some(s=>s?.kind==='requirements'))return null;
 const rq=jd.sections.filter(s=>s?.kind==='requirements')
  .map(s=>s.text).join('\n').slice(0,6000);
 if(rq.length<25)return null;
 const skills=extractSkillRequirements(rq);
 const degree=degreeMinRequirement(rq);
 const degrees=['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'];
 return {
  id:jd.id,title:jd.title,company:jd.company,location:jd.location,
  official_url:jd.canonical_url,
  required_skills:skills.required,mandatory_skills:skills.mandatory,
  preferred_skills:skills.preferred,unclassified_skills:skills.unclassified,
  professional_credential_requirements:extractMandatoryProfessionalCredentials(rq).mandatory,
  min_experience_years:experienceMinRequirement(rq),
  minimum_education:degree===null?null:degrees[degree-1],
  proof_hash:jd.jd_sha256,updated_at:jd.checked_at,
  source_label:jd.proof_method==='PUBLIC_EMPLOYER_ATS_V1'?
   '企业专属公开 ATS 招聘接口及其核验 JD 版本':
   '企业官网直接核验及归档的 JD 版本'
 };
}
export function validReassessmentInput(body,{v4=false}={}){
 if(!body||typeof body!=='object'||Array.isArray(body)||body.consent_reassessment!==true||
  body.confirm_real!==true||typeof body.job_id!=='string'||body.job_id.length<5||
  body.job_id.length>180||!/^[A-Za-z0-9_-]+$/.test(body.job_id))return false;
 if(!Array.isArray(body.before_blocks)||!Array.isArray(body.after_blocks)||
  body.before_blocks.length<1||(!v4&&body.before_blocks.length>12)||
  body.after_blocks.length!==body.before_blocks.length)return false;
 const validBlock=b=>b&&typeof b.id==='string'&&/^[a-z0-9_-]{1,64}$/i.test(b.id)&&
  ['experience','skills','summary','education','projects'].includes(b.section)&&
  typeof b.text==='string'&&b.text.trim().length>=2&&(v4||b.text.length<=1600);
 if(!body.before_blocks.every(validBlock)||!body.after_blocks.every(validBlock))return false;
 const originals=new Map(body.before_blocks.map(b=>[b.id,b.section]));
 if(originals.size!==body.before_blocks.length||body.after_blocks.some(b=>originals.get(b.id)!==b.section))return false;
 const p=body.profile;
 if(!p||typeof p!=='object'||Array.isArray(p))return false;
 if(!v4&&p.education!==null&&p.education!==undefined&&!credentials.includes(p.education))return false;
 if(p.experience_years!==null&&p.experience_years!==undefined&&
  (!Number.isFinite(p.experience_years)||p.experience_years<0||p.experience_years>(v4?60:50)))return false;
 if(!Array.isArray(p.target_roles)||(!v4&&p.target_roles.length>7)||p.target_roles.some(x=>typeof x!=='string'||(!v4&&x.length>80)))return false;
 if(!Array.isArray(p.skills)||(!v4&&p.skills.length>30)||p.skills.some(x=>typeof x?.name!=='string'||(!v4&&x.name.length>60)))return false;
 return true;
}
const exactTextMention=(text,term)=>{
 const haystack=simplify(text),needle=simplify(term);
 return needle.length>=2&&haystack.includes(needle);
};
export function sameEngineReassessment(job,profile,beforeBlocks,afterBlocks){
 const terms=[...new Set([...job.required_skills,...job.preferred_skills,...job.unclassified_skills])]
  .filter(x=>typeof x==='string'&&x.length>=2);
 const originalNames=profile.skills.map(s=>s.name).filter(x=>typeof x==='string');
 const make=blocks=>{
  const text=blocks.map(b=>b.text).join('\n');
  // Original parsed skills are held constant across both snapshots. Newly named
  // skills only count when they occur *in the user's confirmed current resume*.
  const names=[...new Set([...originalNames,...terms.filter(t=>exactTextMention(text,t))])];
  return {education:profile.education??null,experience_years:profile.experience_years??null,
   target_roles:profile.target_roles,skills:names.map(name=>({name}))};
 };
 // Selecting a job is a declared target direction, not a verified work skill.
 // Search-first profiles may contain no target roles at all; keep the same
 // explicit intent for both V2 runs, never grant an employment credential.
 const selectionRoleHint=profile.target_roles.some(t=>typeof t==='string'&&t.trim().length>=2)?'':job.title;
 const before=scoreCandidateFit(make(beforeBlocks),job,{role_hint:selectionRoleHint});
 const after=scoreCandidateFit(make(afterBlocks),job,{role_hint:selectionRoleHint});
 if(!before.eligible||!after.eligible)return {
  supported:false,reason:before.reason||after.reason||'SCORING_NOT_ELIGIBLE',ranking_version:RANKING_VERSION
 };
 const initialTerms=new Set(terms.filter(t=>exactTextMention(beforeBlocks.map(x=>x.text).join('\n'),t)));
 const afterTerms=terms.filter(t=>exactTextMention(afterBlocks.map(x=>x.text).join('\n'),t));
 return {supported:true,ranking_version:RANKING_VERSION,
  original_score:before.score,updated_score:after.score,delta:after.score-before.score,
  selected_job_as_target_direction:Boolean(selectionRoleHint),
  before_breakdown:before.breakdown,after_breakdown:after.breakdown,
  newly_visible_terms:afterTerms.filter(t=>!initialTerms.has(t)),
  lost_visible_terms:[...initialTerms].filter(t=>!afterTerms.includes(t)),
  important_notice:'两个分数都基于当前官方岗位快照、同一V2规则和用户自述资料重新计算；不等于原历史卡片分数或企业录用概率。新增技能未经第三方核实；缺少目标方向时，仅以本人选定岗位作为求职意向，不视为已有任职资格。'};
}
