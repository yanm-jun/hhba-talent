import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSkillRequirements} from '../functions/_lib/job-skill-evidence.js';
import {inferOfficialSkills,scoreCandidateFit} from '../functions/_lib/match-ranking.js';

const resume={education:'BACHELOR',experience_years:3,
 target_roles:['Python 开发工程师'],skills:[{name:'Python'},{name:'SQL'}]};
const job={company:'某国内企业',location:'深圳',title:'Python 开发工程师',
 minimum_education:'BACHELOR',min_experience_years:2};

test('splits must-have and preferred skill clauses without guessing',()=>{
 const r=extractSkillRequirements(
  '岗位任职要求：熟练使用 Python、SQL，掌握 Linux；有 Kubernetes 经验者优先。');
 assert.deepEqual(r.required,['Python','SQL','Linux']);
 assert.deepEqual(r.preferred,['Kubernetes']);
 assert.deepEqual(r.unclassified,[]);
});
test('optional and explicitly not-required technical skills never become must-have',()=>{
 const r=extractSkillRequirements('任职条件：不要求 Kubernetes；无需 React；熟练掌握 Python；需要 SQL。');
 assert.deepEqual(r.required,['Python','SQL']);
 assert.deepEqual(r.preferred,[]);
 assert.equal(inferOfficialSkills('任职条件：不要求 Kubernetes；无需 React；熟练掌握 Python；需要 SQL。').includes('React'),false);
});
test('required one of two technologies is classified conservatively as alternatives',()=>{
 const r=extractSkillRequirements('岗位要求：Python 或 Java 至少掌握一种，能用主流框架开发系统。');
 assert.deepEqual(r.required,[]);
 assert.deepEqual(r.preferred,[]);
 assert.deepEqual(r.unclassified,['Python','Java']);
});
test('no Java/JavaScript or Go/Google substring confusion',()=>{
 const r=extractSkillRequirements('熟悉 JavaScript 和 Google Cloud，具有 React 开发技能。');
 assert.equal(r.required.includes('Java'),false);
 assert.equal(r.required.includes('Go'),false);
 assert.deepEqual(r.required,['JavaScript','React']);
});
test('a preference in another comma-clause does not overwrite mandatory SQL',()=>{
 const r=extractSkillRequirements(
  '任职要求：熟练掌握 Python，必须掌握 SQL，具有 Kubernetes 经验者优先。');
 assert.deepEqual(r.required,['Python','SQL']);
 assert.deepEqual(r.preferred,['Kubernetes']);
});
test('conflicting clauses: explicit must-have outranks a separate preference mention',()=>{
 const r=extractSkillRequirements(
  '具有 Python 开发经验者优先；必须掌握 Python，并能独立完成代码开发任务。');
 assert.deepEqual(r.required,['Python']);
 assert.deepEqual(r.preferred,[]);
});
test('unclassified mentions do not inflate documented must-have coverage',()=>{
 const r=extractSkillRequirements('职位说明：Python、SQL 和 Excel，负责平台服务工程和协作工作。');
 assert.deepEqual(r.required,[]);
 assert.deepEqual(r.unclassified,['Python','SQL','Excel']);
 assert.equal(r.evidence_available,true);
});
test('mandatory skills carry higher ranking weight than preferences',()=>{
 const base=scoreCandidateFit(resume,{...job,required_skills:['Python','SQL'],
  preferred_skills:['Kubernetes']});
 const full=scoreCandidateFit({...resume,skills:[...resume.skills,{name:'Kubernetes'}]},
  {...job,required_skills:['Python','SQL'],preferred_skills:['Kubernetes']});
 assert.equal(base.eligible,true);
 assert.equal(base.breakdown.skills,24);
 assert.equal(full.breakdown.skills,30);
 assert.equal(base.required_skill_count,2);
 assert.equal(base.preferred_skill_count,1);
 assert.equal(base.matched_preferred_skill_count,0);
 assert.ok(full.score>base.score);
});
test('unclassified skills are weak relevance signals, not full mandatory credit',()=>{
 const explicit=scoreCandidateFit(resume,{...job,required_skills:['Python','SQL']});
 const unknown=scoreCandidateFit(resume,{...job,required_skills:[],
  unclassified_skills:['Python','SQL']});
 assert.ok(explicit.breakdown.skills>unknown.breakdown.skills);
 assert.ok(unknown.breakdown.skills<=11);
 assert.equal(unknown.required_skill_count,0);
});
test('a strong job match with no published skills remains eligible but not perfect',()=>{
 const r=scoreCandidateFit(resume,{...job,required_skills:[],preferred_skills:[],unclassified_skills:[]});
 assert.equal(r.eligible,true);
 assert.equal(r.breakdown.skills,8);
 assert.ok(r.score<100);
});
