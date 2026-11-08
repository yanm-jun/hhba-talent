import test from 'node:test';
import assert from 'node:assert/strict';
import {assessJobQualification,scoreCandidateFit,evaluateJobEligibility} from '../functions/_lib/match-ranking.js';
import {extractStructuredSkillConditions} from '../functions/_lib/job-skill-evidence.js';
import {extractStructuredCredentialConditions} from '../functions/_lib/professional-credentials.js';
import {verifiedProfile} from '../functions/_lib/resume-match-core.js';
import {separateCareerIntentAndExperience} from '../functions/_lib/resume-role-evidence.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const job={title:'Python 开发工程师',location:'深圳',min_experience_years:3,
 minimum_education:'BACHELOR',required_skills:['Python'],mandatory_skills:['Python']};
const base={education:'BACHELOR',experience_years:4,
 skills:[{name:'Python',evidence:'Python 项目开发'}],target_roles:['Python 开发工程师']};
const now=Date.parse('2026-11-08T10:00:00Z');

test('verified missing resume evidence is UNKNOWN, not proven ineligible',()=>{
 const missing=assessJobQualification({...base,experience_years:null,education:null,skills:[]},job);
 assert.equal(missing.status,'NEEDS_INFORMATION');
 assert.equal(missing.eligible,false);
 assert.deepEqual(new Set(missing.missing.map(x=>x.field)),new Set(['experience_years','education','skills']));
 assert.equal(missing.failed.length,0);
 assert.equal(scoreCandidateFit({...base,experience_years:null},job).qualification_status,'NEEDS_INFORMATION');
 // Compatibility for old integrations without status support.
 assert.deepEqual(evaluateJobEligibility({...base,experience_years:null},job),
  {eligible:false,reason:'EXPERIENCE_NOT_MET'});
});

test('evidenced short tenure and insufficient degree are proven incompatible',()=>{
 const report=assessJobQualification({...base,experience_years:2,education:'ASSOCIATE',skills:[]},job);
 assert.equal(report.status,'INELIGIBLE');
 assert.ok(report.failed.some(x=>x.code==='EXPERIENCE_NOT_MET'));
 assert.ok(report.failed.some(x=>x.code==='DEGREE_NOT_MET'));
 assert.ok(report.missing.some(x=>x.field==='skills'),'missing a skill does not turn an explicit tenure failure into eligible');
 const offMainland=assessJobQualification(base,{...job,location:'伦敦'});
 assert.equal(offMainland.status,'INELIGIBLE');
 assert.equal(offMainland.reason,'NOT_MAINLAND_JOB');
});

test('complete demonstrated requirements qualify; exact hiring probability remains unknown',()=>{
 const q=assessJobQualification(base,job);
 assert.equal(q.status,'ELIGIBLE');
 assert.deepEqual(q.missing,[]);
 assert.deepEqual(q.failed,[]);
 const scored=scoreCandidateFit(base,job);
 assert.equal(scored.eligible,true);
 assert.equal(scored.qualification_status,'ELIGIBLE');
 assert.equal(scored.hiring_probability,undefined);
});

test('explicit skill requirements preserve all/any/N-of-M logic',()=>{
 const cases=[
  ['岗位要求：必须掌握 Python、SQL，使用 Linux 维护服务。',
    {operator:'ALL_OF',values:['Python','SQL']}],
  ['岗位要求：必须掌握 Python 或 Java 中的一项。',
    {operator:'ANY_OF',values:['Python','Java']}],
  ['硬性要求：Python、SQL、Linux 至少掌握两项。',
    {operator:'AT_LEAST',values:['Python','SQL','Linux'],min_count:2}],
  ['Python、SQL 能力优先；无需 Linux。',
    null]
 ];
 for(const [jd,expected] of cases){
  const groups=extractStructuredSkillConditions(jd);
  if(expected===null){assert.deepEqual(groups,[]);continue}
  assert.equal(groups[0].operator,expected.operator,jd);
  assert.deepEqual(groups[0].values,expected.values,jd);
  if(expected.min_count)assert.equal(groups[0].min_count,expected.min_count);
  assert.equal(groups[0].certainty,'EXPLICIT');
 }
 const anyOf=extractStructuredSkillConditions('必须掌握 Python 或 Java 至少一种。');
 const one=assessJobQualification({...base,skills:[{name:'Java'}]},
  {...job,mandatory_skills:[],skill_conditions:anyOf});
 assert.equal(one.status,'ELIGIBLE','one alternative must be sufficient');
 const missing=assessJobQualification({...base,skills:[]},
  {...job,mandatory_skills:[],skill_conditions:anyOf});
 assert.equal(missing.status,'NEEDS_INFORMATION');
 assert.ok(missing.missing.some(x=>x.code==='MANDATORY_SKILL_GROUP_NOT_EVIDENCED'));
 const twoOf=extractStructuredSkillConditions('必须在 Python、SQL、Linux 中至少掌握两项。');
 assert.equal(assessJobQualification({...base,skills:[{name:'Python'}]},
  {...job,mandatory_skills:[],skill_conditions:twoOf}).status,'NEEDS_INFORMATION');
 assert.equal(assessJobQualification({...base,skills:[{name:'Python'},{name:'SQL'}]},
  {...job,mandatory_skills:[],skill_conditions:twoOf}).status,'ELIGIBLE');
});

test('professional-license alternatives are not cumulative',()=>{
 const groups=extractStructuredCredentialConditions(
  '岗位要求：必须具备护士执业证书或护士执业资格证书任意一种，能够承担护理工作。');
 assert.deepEqual(groups.map(x=>x.operator),['ANY_OF']);
 assert.equal(assessJobQualification({...base,professional_credentials:['NURSE_QUALIFICATION']},
  {...job,credential_conditions:groups}).status,'ELIGIBLE');
 assert.equal(assessJobQualification(base,{...job,credential_conditions:groups}).status,'NEEDS_INFORMATION');
 assert.equal(assessJobQualification(base,{...job,credential_conditions:groups}).reason,
  'PROFESSIONAL_CREDENTIAL_GROUP_NOT_EVIDENCED');
});

test('career aspiration is not automatically evidence of professional duties',()=>{
 const text='求职意向：产品经理\n工作经历\n2022.07—2025.09 某公司 销售顾问\n负责客户销售线索跟进及客户转化，提高签约效率。';
 const p=separateCareerIntentAndExperience(['产品经理'],text);
 assert.deepEqual(p.career_intents,['产品经理']);
 assert.ok(p.demonstrated_roles.includes('销售顾问'));
 assert.ok(!p.demonstrated_roles.includes('产品经理'));
 assert.ok(p.target_roles.includes('产品经理'));
 const candidate={...base,career_intents:p.career_intents,
  demonstrated_roles:p.demonstrated_roles,target_roles:p.target_roles,
  skills:[],experience_years:3};
 const switchRole=scoreCandidateFit(candidate,{...job,title:'产品经理',mandatory_skills:[],required_skills:[]});
 assert.equal(switchRole.eligible,true);
 assert.equal(switchRole.career_alignment.transition,true);
 assert.ok(switchRole.breakdown.role<30,'career interests are not proof of experience');
 const verified=verifiedProfile({education:'BACHELOR',education_evidence:null,
  experience_years:null,experience_evidence:null,skills:[],target_roles:['产品经理']},text,new Date(now));
 assert.deepEqual(verified.career_intents,['产品经理']);
 assert.ok(verified.demonstrated_roles.includes('销售顾问'));
});

test('explicit missing facts stay out of Top10 and are surfaced as actionable review',()=>{
 const inside=[{
  id:'ashby-test-company-job1',company:'测试公司',title:'Python 开发工程师',
  location:'深圳',official_url:'https://jobs.ashbyhq.com/test-company/job1',
  source_type:'HHBA站内岗位',reference_score:80,required_skills:['Python'],
  mandatory_skills:['Python'],min_experience_years:3,minimum_education:'BACHELOR'
 }];
 const uncertain=fuseDomesticJobRecommendations(inside,[],{...base,experience_years:null},
  {role_hint:'Python 开发工程师'},now);
 assert.equal(uncertain.matches.length,0,'unknown experience must not enter Top10');
 assert.equal(uncertain.qualification_reviews.length,1);
 assert.equal(uncertain.qualification_reviews[0].status,'NEEDS_INFORMATION');
 assert.equal(uncertain.qualification_reviews[0].missing[0].field,'experience_years');
 assert.equal(uncertain.qualification_reviews[0].official_url,undefined,'review is not a clickable qualified recommendation');
 const disqualified=fuseDomesticJobRecommendations(inside,[],{...base,experience_years:2},
  {role_hint:'Python 开发工程师'},now);
 assert.equal(disqualified.matches.length,0);
 assert.equal(disqualified.qualification_reviews.length,0);
 const eligible=fuseDomesticJobRecommendations(inside,[],base,
  {role_hint:'Python 开发工程师'},now);
 assert.equal(eligible.matches.length,1);
 assert.deepEqual(eligible.qualification_reviews,[]);
});

test('unrelated missing-evidence roles do not flood the followup queue',()=>{
 const candidate={...base,experience_years:null};
 const jobs=[{id:'test-1',source_type:'HHBA站内岗位',reference_score:80,
  company:'甲',title:'护士',location:'深圳',official_url:'https://example.cn/jobs/1',
  min_experience_years:5,minimum_education:'BACHELOR'}];
 const out=fuseDomesticJobRecommendations(jobs,[],candidate,{role_hint:'Python 开发工程师'},now);
 assert.equal(out.qualification_reviews.length,0);
});
