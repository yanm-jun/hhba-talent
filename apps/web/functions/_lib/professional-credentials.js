/**
 * License/credential EVIDENCE, not licensing authority validation.
 * JD requirements are extracted only from previously verified official
 * job-detail requirements; resume statements are self-reported text.
 * Never collect license numbers or claim validity/registration is confirmed.
 */
const DEFINITIONS=Object.freeze([
 {id:'NURSE_PRACTICE',name:'护士执业证书',
  pattern:/(?:护士执业证书|护士执业证(?!书?考试)|护士执业注册证)/i},
 {id:'NURSE_QUALIFICATION',name:'护士执业资格证书',
  pattern:/(?:护士执业资格证书?|护士资格证书?)/i},
 {id:'DOCTOR_PRACTICE',name:'医师执业证书',
  pattern:/(?:医师执业证书?|医生执业证书?)/i},
 {id:'DOCTOR_QUALIFICATION',name:'医师资格证书',
  pattern:/(?:医师资格证书?|执业医师资格证书?)/i},
 {id:'TEACHER_QUALIFICATION',name:'教师资格证书',
  pattern:/(?:教师资格证书?|中小学教师资格证书?)/i},
 {id:'LAWYER_PRACTICE',name:'律师执业证书',
  pattern:/(?:律师执业证书?|律师执业证)/i},
 {id:'LEGAL_QUALIFICATION',name:'法律职业资格证书',
  pattern:/(?:法律职业资格证书?|法律职业资格证)/i},
 {id:'CPA_QUALIFICATION',name:'注册会计师证书',
  pattern:/(?:注册会计师证书?|注册会计师资格证书?)/i}
]);
const REQUIRED=/(?:必须|必需|必备|须|需(?!求了解)|要求|持有|持证|具备|具有|取得|应有|应具备|须取得|需持|must|required|mandatory)/i;
const OPTIONAL=/(?:优先|加分|更佳|不要求|无需|可不|没有要求|非必需|非必须|入职后(?:可|再)?(?:取得|考取)|可于入职后|preferred|nice.to.have|not.required)/i;
const NEGATIVE=/(?:未(?:取得|持有|考取|注册)|尚未|没有(?:取得|持有)|无(?:相关)?资格|准备(?:考|报考)|计划(?:考|报考)|备考|考试中|考取中|申请中|待取得|已失效|已过期|过期|已注销|暂停执业|未注册|未通过|未获得|尚无)/i;
const POSITIVE=/(?:已取得|已考取|已获得|持有|具备|拥有|已注册|已获|持证|现持|获颁|取得了|取得|证书[：:]|资格证书[：:]|资格[：:]|执业证书[：:])/i;
const clean=txt=>String(txt||'').normalize('NFKC').slice(0,15000);
const clauses=text=>clean(text).split(/[。；;\n]+/).flatMap(x=>x.split(/[，,]+/)).map(x=>x.trim()).filter(Boolean);
const marked=clause=>DEFINITIONS.filter(item=>item.pattern.test(clause));
export function extractMandatoryProfessionalCredentials(officialRequirements){
 const required=new Set(),optional=new Set(),uncertain=new Set();
 for(const text of clauses(officialRequirements)){
  const ids=marked(text);
  if(!ids.length)continue;
  const target=OPTIONAL.test(text)?optional:REQUIRED.test(text)?required:uncertain;
  for(const item of ids)target.add(item.id);
 }
 for(const id of required){optional.delete(id);uncertain.delete(id);}
 for(const id of optional)uncertain.delete(id);
 return {mandatory:[...required],preferred:[...optional],unclassified:[...uncertain]};
}
export function extractSelfReportedProfessionalCredentials(resumeText){
 if(typeof resumeText!=='string'||!resumeText.trim())return [];
 const verified=new Set();
 for(const line of clauses(resumeText)){
  const matches=marked(line);
  if(!matches.length||NEGATIVE.test(line))continue;
  // Bare mention of a licensed profession or preparation for an exam
  // cannot be converted into an actual current professional license.
  if(!POSITIVE.test(line))continue;
  for(const row of matches)verified.add(row.id);
 }
 return [...verified];
}
const RISK_ROLES=[
 {pattern:/(?:护士|护理师|registered nurse|(^|\s)nurse(\s|$))/i,credential:'NURSE_PRACTICE',label:'护理执业'},
 {pattern:/(?:临床医师|临床医生|执业医师|全科医生|住院医师|主治医师|physician)/i,credential:'DOCTOR_PRACTICE',label:'医疗执业'},
 {pattern:/(?:执业律师|律师(?!助理)|practicing lawyer)/i,credential:'LAWYER_PRACTICE',label:'律师执业'},
 {pattern:/(?:中小学教师|小学教师|初中教师|高中教师|幼儿园教师|幼儿教师|学科教师)/i,credential:'TEACHER_QUALIFICATION',label:'教师资格'}
];
export function professionalPracticeReview(title){
 if(typeof title!=='string')return null;
 const found=RISK_ROLES.find(x=>x.pattern.test(title.slice(0,150)));
 return found?{kind:found.label,likely_credential:found.credential,
  warning:'该职业可能涉及执业资格或岗位专门要求，须核实官网条件及资格的适用范围、注册与有效状态'}:null;
}
export function credentialLabel(code){
 return DEFINITIONS.find(item=>item.id===code)?.name||null;
}
