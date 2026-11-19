// Inspectable same-engine reassessment of an existing verified mainland ATS job.
// Both snapshots are scored using HHBA_MATCH_RANKING_V2, not a keyword-derived UI score.
import {safeJobLink,isVerifiedMainlandLocation} from './resume-match-core.js';
import {scoreCandidateFit,RANKING_VERSION} from './match-ranking.js';

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
export function validReassessmentInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||body.consent_reassessment!==true||
  body.confirm_real!==true||typeof body.job_id!=='string'||body.job_id.length<5||
  body.job_id.length>180||!/^[A-Za-z0-9_-]+$/.test(body.job_id))return false;
 if(!Array.isArray(body.before_blocks)||!Array.isArray(body.after_blocks)||
  body.before_blocks.length<1||body.before_blocks.length>12||
  body.after_blocks.length!==body.before_blocks.length)return false;
 const validBlock=b=>b&&typeof b.id==='string'&&/^[a-z0-9_-]{1,64}$/i.test(b.id)&&
  ['experience','skills','summary','education','projects'].includes(b.section)&&
  typeof b.text==='string'&&b.text.trim().length>=2&&b.text.length<=1600;
 if(!body.before_blocks.every(validBlock)||!body.after_blocks.every(validBlock))return false;
 const originals=new Map(body.before_blocks.map(b=>[b.id,b.section]));
 if(originals.size!==body.before_blocks.length||body.after_blocks.some(b=>originals.get(b.id)!==b.section))return false;
 const p=body.profile;
 if(!p||typeof p!=='object'||Array.isArray(p))return false;
 if(p.education!==null&&p.education!==undefined&&!credentials.includes(p.education))return false;
 if(p.experience_years!==null&&p.experience_years!==undefined&&
  (!Number.isFinite(p.experience_years)||p.experience_years<0||p.experience_years>50))return false;
 if(!Array.isArray(p.target_roles)||p.target_roles.length>7||p.target_roles.some(x=>typeof x!=='string'||x.length>80))return false;
 if(!Array.isArray(p.skills)||p.skills.length>30||p.skills.some(x=>typeof x?.name!=='string'||x.name.length>60))return false;
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
 const before=scoreCandidateFit(make(beforeBlocks),job,{});
 const after=scoreCandidateFit(make(afterBlocks),job,{});
 if(!before.eligible||!after.eligible)return {
  supported:false,reason:before.reason||after.reason||'SCORING_NOT_ELIGIBLE',ranking_version:RANKING_VERSION
 };
 const initialTerms=new Set(terms.filter(t=>exactTextMention(beforeBlocks.map(x=>x.text).join('\n'),t)));
 const afterTerms=terms.filter(t=>exactTextMention(afterBlocks.map(x=>x.text).join('\n'),t));
 return {supported:true,ranking_version:RANKING_VERSION,
  original_score:before.score,updated_score:after.score,delta:after.score-before.score,
  before_breakdown:before.breakdown,after_breakdown:after.breakdown,
  newly_visible_terms:afterTerms.filter(t=>!initialTerms.has(t)),
  lost_visible_terms:[...initialTerms].filter(t=>!afterTerms.includes(t)),
  important_notice:'两个分数都基于当前官方岗位快照、同一V2规则和用户自述资料重新计算；不等于原历史卡片分数或企业录用概率。新增技能未经第三方核实。'};
}
