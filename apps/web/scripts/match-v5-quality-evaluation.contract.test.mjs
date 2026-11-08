import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMatchEvaluation} from '../functions/_lib/match-quality-evaluator.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const locations=['上海','深圳','杭州'];
const examples=[
 ['护理执业','护士','NURSE_PRACTICE', '护士资格证书','NURSE_QUALIFICATION'],
 ['医生执业','临床医师','DOCTOR_PRACTICE','医师资格证书','DOCTOR_QUALIFICATION'],
 ['律师执业','执业律师','LAWYER_PRACTICE','法律职业资格证书','LEGAL_QUALIFICATION'],
 ['教师资格','小学教师','TEACHER_QUALIFICATION','教育学学位','']
];
const makeJob=(name,i)=>({
 id:'test-job-'+i,company:'样例企业'+i,title:name,location:locations[i%locations.length],
 source_type:'HHBA站内岗位',reference_score:66,
 official_url:'https://jobs.ashbyhq.com/example/role'+i,
 min_experience_years:1,minimum_education:'BACHELOR',
 professional_credential_requirements:[examples[i][2]],
 required_skills:[],mandatory_skills:[],unclassified_skills:[],
 matched:[],not_evidenced:[],needs_verification:[],requirements_basis:'合成职位，非真实招聘'
});
test('offline benchmark reports top1, precision, integrity and occupational subgroup labels without personal info',()=>{
 const cases=examples.map((row,i)=>{
  const profile={education:'BACHELOR',experience_years:2,skills:[],
   professional_credentials:[row[2]],target_roles:[row[1]]};
  const correct=makeJob(row[1],i);
  const wrong=makeJob(examples[(i+1)%examples.length][1],(i+1)%examples.length);
  const fused=fuseDomesticJobRecommendations([wrong,correct],[],profile,{role_hint:row[1]},Date.now());
  return {group:row[0],relevant_ids:[correct.id],recommended:fused.matches.map(j=>({
   id:j.id,official_url:j.official_url,hard_gate_violation:false
  }))};
 });
 const summary=summarizeMatchEvaluation(cases);
 assert.equal(summary.case_count,4);
 assert.equal(summary.top1_relevance,100);
 assert.equal(summary.recall_coverage,100);
 assert.equal(summary.hard_gate_violations,0);
 assert.equal(summary.duplicate_ids,0);
 assert.equal(summary.unsafe_or_missing_links,0);
 assert.equal(summary.synthetic_or_reviewed_labels_only,true);
 assert.deepEqual(Object.keys(summary.by_group).sort(),examples.map(x=>x[0]).sort());
 assert.equal(JSON.stringify(summary).includes('NURSE_PRACTICE'),false);
 assert.equal(JSON.stringify(summary).includes('resume'),false);
});
test('benchmark counts duplicate and unsafe links as explicit failures, without fabricating job availability',()=>{
 const report=summarizeMatchEvaluation([{group:'测试',relevant_ids:['good'],recommended:[
  {id:'good',official_url:'https://official.example/job',hard_gate_violation:false},
  {id:'good',official_url:'javascript:alert(1)',hard_gate_violation:true}
 ]}]);
 assert.equal(report.top1_relevance,100);
 assert.equal(report.duplicate_ids,1);
 assert.equal(report.unsafe_or_missing_links,1);
 assert.equal(report.hard_gate_violations,1);
 assert.equal(report.type,'OFFLINE_LABELED_RELEVANCE_ONLY');
});
test('benchmark rejects empty datasets and malicious schema silently rather than measuring fake precision',()=>{
 assert.throws(()=>summarizeMatchEvaluation([]),/QUALITY_CASES_REQUIRED/);
 assert.throws(()=>summarizeMatchEvaluation([{group:'X',relevant_ids:[],recommended:[{}]}]),/QUALITY_INVALID_JOB/);
 assert.throws(()=>summarizeMatchEvaluation([{group:'X',recommended:[]}]),/QUALITY_INVALID_CASE/);
});
