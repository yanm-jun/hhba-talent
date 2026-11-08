/**
 * Build user-facing match reasons from the FINAL V2 score, never from legacy
 * preliminary string-matching scores. Every positive claim uses documented
 * resume facts or verified official JD facets passed by the match pipeline.
 * Human-readable reasons do not independently change scores or eligibility.
 */
import {credentialLabel,professionalPracticeReview} from './professional-credentials.js';
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
 if(b.role>0)matched.push('岗位名称与简历的求职方向存在明确或可迁移的职业关联');
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
