import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DUAL_CLASSIFICATION_VERSION,classifyEmployerDraft,recruitmentSourceCandidate,
 compareEmployerIdentity,classifyValidatedTalentProfile
} from '../functions/_lib/dual-classification-v1.js';

test('multi-label employer classification from public editorial, no automatic trust',()=>{
 const result=classifyEmployerDraft({
  name:'测试芯片企业',
  industry:'集成电路与汽车电子',
  overview:'研发电源管理芯片和车规电源产品',
  business:[{title:'工业控制与马达驱动',details:['MCU','汽车电子']}]
 });
 assert.equal(result.taxonomy_version,DUAL_CLASSIFICATION_VERSION);
 assert.ok(result.industry_tags.includes('semiconductors'));
 assert.ok(result.industry_tags.includes('automotive'));
 assert.ok(result.business_tags.includes('hardware-rd'));
 assert.ok(result.business_tags.includes('automotive-electronics'));
 assert.equal(result.review_status,'PROPOSED');
 assert.equal(result.needs_human_review,true);
 assert.deepEqual(result.evidence_fields,['industry','overview','business']);
});
test('telecommunications does not collapse into software-only industry',()=>{
 const result=classifyEmployerDraft({overview:'中国电信通信网络运营商提供5G基站与光通信和企业服务'});
 assert.ok(result.industry_tags.includes('telecommunications'));
 assert.ok(result.business_tags.includes('telecom-networks'));
 assert.ok(result.business_tags.includes('enterprise-services'));
 assert.equal(result.review_status,'PROPOSED');
});
test('missing employer evidence cannot fabricate tags',()=>{
 const r=classifyEmployerDraft({name:'不存在的示例企业'});
 assert.deepEqual(r.industry_tags,[]);
 assert.deepEqual(r.business_tags,[]);
 assert.equal(r.review_status,'PROPOSED');
});
test('reject untrusted job boards, unsafe URLs and never certify mere URLs',()=>{
 assert.deepEqual(recruitmentSourceCandidate('https://www.zhipin.com/job_detail/123').status,'REJECTED');
 assert.deepEqual(recruitmentSourceCandidate('http://careers.example.com/jobs/123').status,'REJECTED');
 assert.deepEqual(recruitmentSourceCandidate('https://127.0.0.1/test').status,'REJECTED');
 assert.deepEqual(recruitmentSourceCandidate('https://user:pass@careers.example.com/job').status,'REJECTED');
 assert.deepEqual(recruitmentSourceCandidate('https://careers.example.com:8443/job').status,'REJECTED');
 const ats=recruitmentSourceCandidate('https://jobs.lever.co/sample/jobs/123?utm_source=ad');
 assert.equal(ats.status,'REVIEW_REQUIRED');
 assert.equal(ats.source_kind,'EMPLOYER_ATS');
 assert.equal(ats.canonical_url,'https://jobs.lever.co/sample/jobs/123');
 const employer=recruitmentSourceCandidate('https://careers.example.com/jobs/123');
 assert.equal(employer.status,'REVIEW_REQUIRED');
});
test('enterprise identity never merges names, group subsidiaries or shared ATS on guess',()=>{
 const a={id:'cn-1',name:'某集团',legalName:'某集团有限公司',reviewedOfficialHost:'careers.example.com'};
 const b={id:'cn-2',name:'某集团子公司',legalName:'某集团子公司有限公司',reviewedOfficialHost:'careers.example.com'};
 assert.equal(compareEmployerIdentity(a,b).result,'NO_EXACT_IDENTITY_EVIDENCE');
 assert.equal(compareEmployerIdentity(a,{...a,id:'cn-9'}).result,'POSSIBLE_SAME_LEGAL_ENTITY');
 assert.equal(compareEmployerIdentity(a,{...a,id:'cn-1'}).result,'SAME_RECORD');
 assert.equal(compareEmployerIdentity({name:'某集团'},{name:'某集团'}).result,'NAME_COLLISION_REVIEW');
 for(const [left,right] of [[a,b],[a,{...a,id:'cn-9'}],[a,{...a,id:'cn-1'}]])
  assert.equal(compareEmployerIdentity(left,right).auto_merge,false);
});
test('validated talent categories distinguish preferences from proven experience',()=>{
 const data=classifyValidatedTalentProfile({
  education:'BACHELOR',target_roles:['数据分析师','前端开发工程师'],
  demonstrated_roles:['销售经理'],skills:[{name:'SQL',evidence:'负责报表 SQL 统计'},'React'],
  major:'计算机科学与技术'
 });
 assert.ok(data.career_intent_tags.includes('data-analyst'));
 assert.ok(data.career_intent_tags.includes('frontend'));
 assert.ok(!data.demonstrated_role_tags.includes('data-analyst'));
 assert.ok(data.skill_topic_tags.includes('data'));
 assert.ok(data.skill_topic_tags.includes('software'));
 assert.equal(data.major_status,'REQUIRES_EVIDENCE_OR_USER_CONFIRMATION');
 assert.ok(data.missing_information.includes('major'));
 assert.equal(data.profile_status,'CLASSIFICATION_DRAFT');
 assert.ok(!('raw_resume' in data));
});
test('unvalidated profile cannot guess professional background',()=>{
 const result=classifyValidatedTalentProfile({target_roles:['未来打算改行从事不存在领域的岗位']});
 assert.deepEqual(result.career_intent_tags,[]);
 assert.deepEqual(result.demonstrated_role_tags,[]);
 assert.ok(result.missing_information.includes('education'));
});
