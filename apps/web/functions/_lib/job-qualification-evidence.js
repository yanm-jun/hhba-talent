/**
 * Eligibility evaluation is three-valued, NOT a yes/no estimate of hiring.
 *
 * ELIGIBLE: every verified explicit hard requirement has resume evidence.
 * NEEDS_INFORMATION: a required fact has not been established by the resume.
 * INELIGIBLE: a verified, explicit numerical minimum is disproved by the
 * applicant's evidenced value, or the work location is outside Mainland China.
 *
 * Missing a certificate/skill in a resume is UNKNOWN, not proof of absence.
 * Never treat unstructured employer prose or preferences as a hard gate.
 */
import {isMainlandJobLocation} from './mainland-job-location.js';
import {credentialLabel} from './professional-credentials.js';

const DEGREE_RANK=Object.freeze({HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5});
const DEGREES=Object.freeze({HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'});
const norm=v=>String(v||'').normalize('NFKC').trim().toLowerCase()
 .replace(/[\s\-_.()（）【】[\]]+/g,'');
const unknown=(code,label,field)=>({code,label,field});
const failed=(code,label)=>({code,label});
const supportedIds=new Set(['NURSE_PRACTICE','NURSE_QUALIFICATION','DOCTOR_PRACTICE',
 'DOCTOR_QUALIFICATION','TEACHER_QUALIFICATION','LAWYER_PRACTICE',
 'LEGAL_QUALIFICATION','CPA_QUALIFICATION']);
function groupsOf(source,validKind){
 if(!Array.isArray(source))return [];
 return source.slice(0,20).filter(g=>g&&typeof g==='object'&&
  ['ALL_OF','ANY_OF','AT_LEAST'].includes(g.operator)&&
  Array.isArray(g.values)&&g.values.length>0&&g.values.length<=12&&
  g.values.every(v=>typeof v==='string'&&v.length>0&&v.length<=60&&validKind(v))&&
  (g.operator!=='AT_LEAST'||(Number.isInteger(g.min_count)&&
    g.min_count>=1&&g.min_count<=g.values.length)));
}
/** Returns a safe, displayable summary without resume or source excerpts. */
export function assessJobQualification(profile={},job={}){
 const missing=[],failedConditions=[];
 if(!isMainlandJobLocation(job.location))
  failedConditions.push(failed('NOT_MAINLAND_JOB','实际工作地点无法确认位于中国大陆'));
 const years=Number.isFinite(profile.experience_years)&&
  profile.experience_years>=0&&profile.experience_years<=50?profile.experience_years:null;
 const minYears=Number.isInteger(job.min_experience_years)&&
  job.min_experience_years>0&&job.min_experience_years<=50?job.min_experience_years:null;
 if(minYears!==null){
  if(years===null)missing.push(unknown('EXPERIENCE_NOT_EVIDENCED',
    '请补充可以核实的全职工作年限（岗位最低 '+minYears+' 年）','experience_years'));
  else if(years<minYears)failedConditions.push(failed('EXPERIENCE_NOT_MET',
    '简历已证实的工作年限低于岗位要求的 '+minYears+' 年'));
 }
 const degree=typeof job.minimum_education==='string'?job.minimum_education:null;
 if(degree&&DEGREE_RANK[degree]){
  if(!DEGREE_RANK[profile.education])
   missing.push(unknown('DEGREE_NOT_EVIDENCED',
    '请补充最高学历与毕业证据（岗位最低 '+DEGREES[degree]+'）','education'));
  else if(DEGREE_RANK[profile.education]<DEGREE_RANK[degree])
   failedConditions.push(failed('DEGREE_NOT_MET','学历低于岗位明确要求的'+DEGREES[degree]));
 }
 const haveSkills=new Set((Array.isArray(profile.skills)?profile.skills:[])
  .slice(0,40).map(x=>norm(typeof x==='string'?x:x?.name)).filter(Boolean));
 // For older ATS metadata, mandatory_skills is ALWAYS evidence-backed, never
 // inferred from a job title. Structured groups cover alternatives and "N of".
 const mandatory=[...new Set((Array.isArray(job.mandatory_skills)?job.mandatory_skills:[])
  .filter(s=>typeof s==='string'&&s.length<60).map(norm).filter(Boolean))];
 const skillGroups=groupsOf(job.skill_conditions,()=>true);
 const covered=new Set(skillGroups.flatMap(g=>g.values.filter(x=>g.operator==='ALL_OF').map(norm)));
 for(const skill of mandatory){
  if(!covered.has(skill)&&!haveSkills.has(skill))
   missing.push(unknown('MANDATORY_SKILL_NOT_EVIDENCED',
    '请补充必备技能 '+skill+' 的项目或工作证据','skills'));
 }
 for(const g of skillGroups){
  const all=g.values.map(norm),has=all.filter(v=>haveSkills.has(v)).length;
  const min=g.operator==='ALL_OF'?all.length:
   g.operator==='ANY_OF'?1:g.min_count;
  if(has<min){
   const readable=g.values.slice(0,5).join(' / ');
   missing.push(unknown('MANDATORY_SKILL_GROUP_NOT_EVIDENCED',
    '需证明技能条件：'+readable+'（'+
     (g.operator==='ALL_OF'?'全部':g.operator==='ANY_OF'?'至少一项':'至少'+min+'项')+'）','skills'));
  }
 }
 const held=new Set((Array.isArray(profile.professional_credentials)?profile.professional_credentials:[])
  .filter(id=>supportedIds.has(id)));
 const required=[...new Set((Array.isArray(job.professional_credential_requirements)?
  job.professional_credential_requirements:[]).filter(id=>supportedIds.has(id)))];
 const credentialGroups=groupsOf(job.credential_conditions,id=>supportedIds.has(id));
 const grouped=new Set(credentialGroups.filter(g=>g.operator==='ALL_OF').flatMap(g=>g.values));
 for(const id of required){
  if(!grouped.has(id)&&!held.has(id))
   missing.push(unknown('PROFESSIONAL_CREDENTIAL_NOT_EVIDENCED',
    '请补充'+credentialLabel(id)+'的持有情况（自述不代表注册核验）','professional_credentials'));
 }
 for(const g of credentialGroups){
  const count=g.values.filter(id=>held.has(id)).length;
  const min=g.operator==='ALL_OF'?g.values.length:
   g.operator==='ANY_OF'?1:g.min_count;
  if(count<min)
   missing.push(unknown('PROFESSIONAL_CREDENTIAL_GROUP_NOT_EVIDENCED',
    '请确认职业资格要求：'+g.values.map(credentialLabel).join(' / ')+'（'+
    (g.operator==='ALL_OF'?'均需':g.operator==='ANY_OF'?'任一项':'至少'+min+'项')+'）',
    'professional_credentials'));
 }
 const status=failedConditions.length?'INELIGIBLE':
  missing.length?'NEEDS_INFORMATION':'ELIGIBLE';
 return {
  status,
  eligible:status==='ELIGIBLE',
  reason:failedConditions[0]?.code||missing[0]?.code||null,
  missing:missing.slice(0,12),
  failed:failedConditions.slice(0,8),
  // A review badge is not a prediction of job offer or credential validity.
  verification:'RESUME_EVIDENCE_ONLY'
 };
}
