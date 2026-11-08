import test from 'node:test';
import assert from 'node:assert/strict';
import {
 extractMandatoryProfessionalCredentials,extractSelfReportedProfessionalCredentials,
 professionalPracticeReview,credentialLabel
} from '../functions/_lib/professional-credentials.js';
import {verifiedProfile} from '../functions/_lib/resume-match-core.js';
import {evaluateJobEligibility,scoreCandidateFit} from '../functions/_lib/match-ranking.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const now=Date.parse('2026-11-08T06:00:00Z');
const base=(title,roles=[title])=>({
 education:'BACHELOR',experience_years:3,skills:[],target_roles:roles,
 professional_credentials:[]
});
const job=(title,requirements=[])=>({
 title,location:'深圳',minimum_education:'BACHELOR',min_experience_years:2,
 professional_credential_requirements:requirements
});
const official=(title,requirement,idx='2097166275703910400')=>({
 id:'careers.tencent.com:'+idx,source_type:'站外官方招聘',
 source_status:'OFFICIAL_DETAIL_FETCHED',company:'腾讯',title,location:'深圳',
 official_url:'https://careers.tencent.com/jobdesc.html?postId='+idx,
 official_domain:'careers.tencent.com',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
 has_application_cta:true,checked_at:'2026-11-08T06:00:00Z',
 evidence:{title,location:'深圳',requirement}
});

test('explicit official requirements distinguish practice licenses from examination/qualification certificates',()=>{
 const cases=[
  ['岗位要求：必须持有护士执业证书，具备临床护理经验。','NURSE_PRACTICE'],
  ['任职资格：须持有医师执业证书，具备相关诊疗经验。','DOCTOR_PRACTICE'],
  ['任职要求：需具备教师资格证书，能够授课和管理学生。','TEACHER_QUALIFICATION'],
  ['岗位要求：必须取得律师执业证书，有相关诉讼经验。','LAWYER_PRACTICE'],
  ['任职要求：应具有法律职业资格证书，熟悉合同审核。','LEGAL_QUALIFICATION'],
  ['必须持有护士执业资格证书，能够协助护理工作。','NURSE_QUALIFICATION'],
  ['需持有医师资格证书，满足其他招聘要求。','DOCTOR_QUALIFICATION'],
  ['岗位要求：具有注册会计师证书，熟悉企业审计。','CPA_QUALIFICATION']
 ];
 for(const [text,id] of cases){
  const result=extractMandatoryProfessionalCredentials(text);
  assert.deepEqual(result.mandatory,[id],text);
  assert.ok(credentialLabel(id));
 }
 assert.notEqual('NURSE_PRACTICE','NURSE_QUALIFICATION');
 assert.notEqual('DOCTOR_PRACTICE','DOCTOR_QUALIFICATION');
 assert.notEqual('LAWYER_PRACTICE','LEGAL_QUALIFICATION');
});

test('official preferred or not-yet-required certificates cannot trigger a mandatory gate',()=>{
 const texts=[
  '有教师资格证书者优先；其他条件以单位要求为准。',
  '护士执业证书可于入职后取得；具备护理服务能力。',
  '不要求律师执业证书；合同审核能力优先。',
  '法律职业资格证加分；基本法律专业知识优先。'
 ];
 for(const t of texts)assert.deepEqual(extractMandatoryProfessionalCredentials(t).mandatory,[],t);
 const plain=extractMandatoryProfessionalCredentials('护士执业证书，熟悉护理工作。');
 assert.deepEqual(plain.mandatory,[]);
 assert.deepEqual(plain.unclassified,['NURSE_PRACTICE']);
});

test('alternative acceptable professional certificates never become two cumulative hard gates',()=>{
 const a=extractMandatoryProfessionalCredentials(
  '任职要求：必须持有护士执业证书或护士执业资格证书其中一种，具备护理能力。');
 assert.deepEqual(a.mandatory,[]);
 assert.deepEqual(a.unclassified,['NURSE_PRACTICE','NURSE_QUALIFICATION']);
 const b=extractMandatoryProfessionalCredentials(
  '岗位要求：须同时持有医师资格证书和医师执业证书，能承担临床工作。');
 assert.deepEqual(b.mandatory,['DOCTOR_PRACTICE','DOCTOR_QUALIFICATION']);
});

test('resume evidence is explicitly self-reported, without validity or registration claims',()=>{
 const text='个人资格\n已取得护士执业证书；持有医师资格证书；现持教师资格证。';
 assert.deepEqual(extractSelfReportedProfessionalCredentials(text),
  ['NURSE_PRACTICE','DOCTOR_QUALIFICATION','TEACHER_QUALIFICATION']);
 for(const t of [
  '个人经历：准备考取护士执业证书，正在备考。',
  '个人说明：未持有律师执业证，计划报考。',
  '求职计划：拟申请教师资格证，尚未取得。',
  '教育经历：护理学本科，相关课程通过。',
  '技能：熟悉医生职责，了解医师执业证书要求。'
 ])assert.deepEqual(extractSelfReportedProfessionalCredentials(t),[],t);
});

test('stated nurse qualification cannot substitute for nurse practice registration',()=>{
 const profile={...base('护士'),professional_credentials:['NURSE_QUALIFICATION']};
 assert.equal(evaluateJobEligibility(profile,job('护士',['NURSE_PRACTICE'])).reason,
  'PROFESSIONAL_CREDENTIAL_NOT_EVIDENCED');
 assert.equal(scoreCandidateFit(profile,job('护士',['NURSE_PRACTICE'])).score,null);
 assert.equal(evaluateJobEligibility({...profile,professional_credentials:['NURSE_PRACTICE']},
  job('护士',['NURSE_PRACTICE'])).eligible,true);
});
test('physician qualification, law qualification and teacher degrees are not interchangeable practice credentials',()=>{
 const rows=[
  ['临床医师','DOCTOR_PRACTICE','DOCTOR_QUALIFICATION'],
  ['执业律师','LAWYER_PRACTICE','LEGAL_QUALIFICATION'],
  ['小学教师','TEACHER_QUALIFICATION','DOCTOR_PRACTICE']
 ];
 for(const [role,needed,other] of rows){
  const applicant={...base(role),professional_credentials:[other]};
  assert.equal(evaluateJobEligibility(applicant,job(role,[needed])).reason,
   'PROFESSIONAL_CREDENTIAL_NOT_EVIDENCED');
 }
});

test('verifiedProfile only extracts professional credential names from original resume data',()=>{
 const raw={education:'BACHELOR',education_evidence:'本科学历',
  experience_years:null,experience_evidence:null,skills:[],target_roles:['护士']};
 const resume='本科学历\n工作经历\n2022.07—2025.09 某医院 临床护士\n证书：已取得护士执业证书';
 const result=verifiedProfile(raw,resume,new Date(now));
 assert.ok(result.professional_credentials.includes('NURSE_PRACTICE'));
 const other=verifiedProfile(raw,resume.replace('已取得','尚未取得'),new Date(now));
 assert.deepEqual(other.professional_credentials,[]);
});

test('regulated-role review warns but does not invent an official vacancy certificate rule',()=>{
 for(const title of ['护士','临床医师','执业律师','小学教师']){
  assert.ok(professionalPracticeReview(title),title);
 }
 for(const title of ['法务专员','律师助理','舞蹈教师','软件开发工程师']){
  assert.equal(professionalPracticeReview(title),null,title);
 }
 assert.deepEqual(extractMandatoryProfessionalCredentials('职位要求：本科以上学历，有良好工作能力。').mandatory,[]);
 const candidate=scoreCandidateFit(base('护士'),job('护士'));
 assert.equal(candidate.eligible,true,'without explicit JD certificate, do not fabricate hard gate');
});

test('official practitioner role is excluded from Top10 if explicit license is not documented',()=>{
 const details=official('护士','岗位要求：本科及以上学历，有2年以上护理工作经验；必须持有护士执业证书。护理岗位正常安排值班。');
 const notProven=fuseDomesticJobRecommendations([],[details],base('护士'),{role_hint:'护士'},now);
 assert.equal(notProven.matches.length,0);
 const qualified=fuseDomesticJobRecommendations([],[details],
  {...base('护士'),professional_credentials:['NURSE_PRACTICE']},{role_hint:'护士'},now);
 assert.equal(qualified.matches.length,1);
 assert.deepEqual(qualified.matches[0].professional_credential_requirements,['NURSE_PRACTICE']);
 assert.ok(qualified.matches[0].not_evidenced.some(x=>x.includes('注册状态')));
 assert.equal(qualified.matches[0].professional_credential_review.kind,'护理执业');
 assert.equal(qualified.matches[0].application_status,'NEEDS_OFFICIAL_CONFIRMATION');
});

test('unlicensed lawyer JD cannot pass via legal qualification certificate',()=>{
 const details=official('执业律师','岗位要求：本科及以上学历，3年以上法律工作经验；必须持律师执业证书，独立负责诉讼业务。');
 const unqualified={...base('执业律师'),professional_credentials:['LEGAL_QUALIFICATION']};
 assert.equal(fuseDomesticJobRecommendations([],[details],unqualified,{role_hint:'执业律师'},now).matches.length,0);
 const selfReported={...unqualified,professional_credentials:['LAWYER_PRACTICE']};
 const qualified=fuseDomesticJobRecommendations([],[details],selfReported,{role_hint:'执业律师'},now);
 assert.equal(qualified.matches.length,1);
 assert.ok(qualified.matches[0].not_evidenced.some(x=>x.includes('尚未核验')));
});

test('standalone generic legal/admin roles do not silently acquire lawyer practice gate',()=>{
 const details=official('法务专员','岗位要求：本科及以上学历，有2年以上法务管理经验，具备合同审核能力。');
 const p=base('法务专员');
 const result=fuseDomesticJobRecommendations([],[details],p,{role_hint:'法务专员'},now);
 assert.equal(result.matches.length,1);
 assert.deepEqual(result.matches[0].professional_credential_requirements,[]);
 assert.equal(result.matches[0].professional_credential_review,null);
});
