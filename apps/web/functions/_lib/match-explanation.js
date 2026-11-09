/**
 * Build user-facing match reasons from the FINAL V2 score, never from legacy
 * preliminary string-matching scores. Every positive claim uses documented
 * resume facts or verified official JD facets passed by the match pipeline.
 * Human-readable reasons do not independently change scores or eligibility.
 */
import {credentialLabel,professionalPracticeReview} from './professional-credentials.js';
import {relevantWorkEvidence} from './resume-work-evidence.js';
const DEGREE={HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'};
const SHORT_MAX=6;
const safe=(s,max=55)=>typeof s==='string'?s.slice(0,max).trim():'';
const norm=s=>safe(s).normalize('NFKC').toLowerCase().replace(/[\s_.\-()（）]+/g,'');
function originalName(profile,key){
 for(const item of Array.isArray(profile?.skills)?profile.skills:[]){
  const candidate=safe(typeof item==='string'?item:item?.name,45);
  if(norm(candidate)===key)return candidate;
 }
 return safe(key,40);
}
const unique=items=>[...new Set(items.filter(Boolean))].slice(0,SHORT_MAX);
export function explainFinalJobScore(profile,job,fit){
 if(!fit||fit.eligible!==true||!Number.isFinite(fit.score)||!fit.breakdown)
  return {matched:[],not_evidenced:[],score_reasoning:null};
 const b=fit.breakdown;
 const max=Object.values(b).reduce((sum,v)=>sum+v,0);
 const summary='匹配参考分 '+fit.score+'/100：岗位方向 '+b.role+'/30，技能 '+b.skills+
  '/30，经验 '+b.experience+'/20，学历 '+b.education+'/10，地点 '+b.location+'/10'+
  (fit.score_adjustment<0?'；职业方向证据不足，综合分已限制上限':'');
 const matched=[summary];
 if(b.role>0){
  if(fit.career_alignment?.transition)
   matched.push('岗位符合您表达的求职意向；目前的职责证据更偏向其他方向，属于跨方向尝试');
  else matched.push('岗位方向与简历记录的职责或求职目标相关');
 }
 const skillNames=unique([
  ...(fit.matched_required_skills||[]),
  ...(fit.matched_preferred_skills||[]),
  ...(fit.matched_unclassified_skills||[])
 ]).map(name=>originalName(profile,name));
 if(skillNames.length)matched.push('简历有对应技能证据：'+skillNames.join('、'));
 if(Number.isFinite(job.min_experience_years)&&job.min_experience_years>0&&
  Number.isFinite(profile.experience_years))
  matched.push('工作经验 '+profile.experience_years+' 年，达到岗位明确要求的最低 '+
   job.min_experience_years+' 年');
 if(typeof job.minimum_education==='string'&&DEGREE[job.minimum_education]&&DEGREE[profile.education])
  matched.push('已核验的'+DEGREE[profile.education]+'学历符合该岗位最低学历要求');
 if(typeof job.location==='string')matched.push('实际工作地点位于中国大陆：'+safe(job.location,55));
 const gaps=[];
 const credentials=Array.isArray(job.professional_credential_requirements)?
  job.professional_credential_requirements:[];
 if(credentials.length)
  gaps.push('官方任职要求明确列出'+credentials.map(credentialLabel).filter(Boolean).join('、')+
   '；简历只有自行陈述的证书线索，尚未核验原件、注册状态、有效期和适用范围');
 else if(professionalPracticeReview(job.title))
  gaps.push(professionalPracticeReview(job.title).warning+
   '；当前职位数据未提取到明确证书条件，不等于免除执业资格要求');
 if(fit.skill_evidence_status==='UNCLASSIFIED_JD_SKILLS')
  gaps.push('岗位技能来源只有已审核的技能标签，未明确区分必备和加分项；请以官网原文为准');
 if(fit.skill_evidence_status==='NOT_DISCLOSED')
  gaps.push('岗位没有提供可确认的详细技能要求，不代表无技能门槛');
 if(fit.skill_evidence_status==='PREFERRED_ONLY')
  gaps.push('仅识别到加分技能；实际必备条件尚待官网核对');
 if(fit.evidence_quality?.experience==='NOT_DISCLOSED')
  gaps.push('官方职位未披露可确认的最低工作年限，不等于经验不限');
 if(fit.evidence_quality?.education==='NOT_DISCLOSED')
  gaps.push('官方职位未披露可确认的最低学历，不等于学历不限');
 if(fit.score_cap_applied)
  gaps.push('职位职业方向的证据有限，匹配分已设置上限');
 return {matched,not_evidenced:gaps,score_reasoning:summary};
}


/**
 * A compact, applicant-specific explanation for the shortlist.
 * Use facts from the verified profile and authenticated job facets only.
 * Career preferences are interests, never represented as past work.
 */
export function whyThisJob(profile={},job={},fit={}){
 const reasons=[],gaps=[];
 const roles=(Array.isArray(profile.demonstrated_roles)?
   profile.demonstrated_roles:[])
  .filter(x=>typeof x==='string').slice(0,6);
 const wishes=(Array.isArray(profile.career_intents)?profile.career_intents:[])
  .filter(x=>typeof x==='string').slice(0,6);
 const title=safe(job.title,75);
 const normTitle=norm(title);
 const demonstrated=roles.find(x=>normTitle.includes(norm(x))||norm(x).includes(normTitle)&&normTitle.length>=4);
 const interested=wishes.find(x=>normTitle.includes(norm(x))||norm(x).includes(normTitle)&&normTitle.length>=4);
 if(demonstrated)reasons.push('简历记录的「'+safe(demonstrated,32)+'」经历，与该岗位方向直接相关');
 else if(interested)reasons.push('你希望从事「'+safe(interested,32)+'」，这一岗位符合求职方向；这不代表已经具有相同岗位经历');
 else if(fit.breakdown?.role>0)reasons.push('岗位方向与你简历体现的能力或职业目标存在关联');
 const skills=[...(fit.matched_required_skills||[]),
  ...(fit.matched_preferred_skills||[]),...(fit.matched_unclassified_skills||[])]
  .map(x=>norm(x)).filter(Boolean);
 const has=new Set(skills);
 const used=new Set();
 const skillNames=[];
 for(const x of Array.isArray(profile.skills)?profile.skills:[]){
  const name=safe(typeof x==='string'?x:x?.name,40),key=norm(name);
  if(!key||!has.has(key)||used.has(key))continue;
  used.add(key);skillNames.push(name);
  if(skillNames.length>=3)break;
 }
 if(skillNames.length)reasons.push('你的简历明确记录「'+skillNames.join('、')+'」，与岗位公开技能要求对应');
 const examples=relevantWorkEvidence(profile.work_evidence,job,2);
 for(const example of examples)reasons.push('简历原文：「'+example.quote+'」；'+example.rationale);
 const education=DEGREE[profile.education],minimum=DEGREE[job.minimum_education];
 if(education&&minimum&&fit.breakdown?.education>0)
  reasons.push('简历记录'+education+'学历，达到岗位已明确的'+minimum+'最低学历要求');
 if(Number.isFinite(job.min_experience_years)&&job.min_experience_years>0&&
  Number.isFinite(profile.experience_years)&&profile.experience_years>=job.min_experience_years)
  reasons.push('简历可确认的工作年限为'+profile.experience_years+
   '年，达到岗位明确的'+job.min_experience_years+'年最低要求；行业经历仍需官网核对');
 if(!reasons.length){
  if(Array.isArray(profile.target_roles)&&profile.target_roles.length)
   reasons.push('此岗位与你的目标职业方向有关，但尚无足够简历证据可进一步确认契合点');
  else reasons.push('已找到相关岗位；简历可核实的契合证据有限，建议查看官方任职条件');
 }
 if(!skillNames.length)gaps.push('尚未从简历和岗位要求中确认明确对应的技能');
 if(!minimum)gaps.push('公开资料未明确最低学历，需以企业职位页为准');
 if(job.application_status==='NEEDS_OFFICIAL_CONFIRMATION')
  gaps.push('当前是否开放投递仍需在企业招聘页确认');
 // A shortlist card has room for one line: lead with verifiable,
 // specific fit evidence before generic direction similarity.
 const ordered=[...reasons].sort((a,b)=>{
  const importance=v=>v.startsWith('简历原文：')?5:
   v.startsWith('你的简历明确记录')?4:
   v.startsWith('简历记录的「')?3:
   v.startsWith('简历记录')?2:
   v.startsWith('你希望从事')?1:0;
  return importance(b)-importance(a);
 });
 return {
  summary:ordered[0],
  evidence:ordered.slice(0,3),
  to_check:gaps.slice(0,2)
 };
}

/** Recruitment entry links have no confirmed JD: explain the career lead, not a job fit. */
export function whyThisCareerEntry(profile={},item={}){
 const role=safe(item.role,60);
 const stated=(Array.isArray(profile.career_intents)?profile.career_intents:[])
  .filter(x=>typeof x==='string').slice(0,6);
 const hinted=(Array.isArray(profile.target_roles)?profile.target_roles:[])
  .filter(x=>typeof x==='string').slice(0,6);
 const focused=[...stated,...hinted].some(x=>norm(x)===norm(role));
 return focused?
  '根据你的求职方向「'+role+'」找到这家企业的招聘渠道；具体岗位及适配条件需要打开官网确认':
  '找到与你的职业方向「'+role+'」相关的招聘入口；尚未核实具体岗位要求';
}
