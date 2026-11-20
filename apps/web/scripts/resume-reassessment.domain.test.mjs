import test from 'node:test';
import assert from 'node:assert/strict';
import {validReassessmentInput,validatedAuditedJob,sameEngineReassessment} from '../functions/_lib/resume-reassessment.js';

const now=new Date().toISOString();
const job={id:'greenhouse-acme-123',platform:'greenhouse',source:'acme',
 company:'示例企业',title:'软件工程师',location:'上海',url:'https://boards.greenhouse.io/acme/jobs/123'};
const proof={job_id:job.id,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
 full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'samplehash',platform:'greenhouse'};
const facts={id:job.id,countryCode:'CN',original_source_hash:'samplehash',
 skills:['Python','SQL'],experienceMinYears:0,education:'UNRESTRICTED'};
const sources={snapshot:{updated:now,jobs:[job]},audit:{
 summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:now,checked_at:now},
 jobs:[proof]},facets:{indexed_as_of:now,verified_at:now,jobs:[facts]}};
const profile={education:'BACHELOR',experience_years:2,target_roles:['软件工程师'],skills:[]};
const before=[{id:'experience-0',section:'experience',text:'负责软件开发工作'}];
const after=[{...before[0],text:'负责软件开发工作，实际使用 Python 语言编写程序'}];
test('only fresh, hash-verified official mainland job is eligible for V2 rescore',()=>{
 const trusted=validatedAuditedJob(sources,job.id);
 assert.equal(trusted?.id,job.id);
 assert.equal(trusted?.unclassified_skills.length,2);
 assert.equal(validatedAuditedJob(sources,'greenhouse-acme-other'),null);
 assert.equal(validatedAuditedJob({...sources,facets:{
  ...sources.facets,jobs:[{...facts,original_source_hash:'tampered'}]}},job.id),null);
 assert.equal(validatedAuditedJob({...sources,snapshot:{...sources.snapshot,
  updated:'2020-01-01T00:00:00Z'}},job.id),null);
 assert.equal(validatedAuditedJob({...sources,facets:{
  ...sources.facets,jobs:[{...facts,countryCode:'US'}]}},job.id),null);
});
test('V2 scores both versions identically except for confirmed new skill mention',()=>{
 const trusted=validatedAuditedJob(sources,job.id);
 assert.ok(trusted);
 const scored=sameEngineReassessment(trusted,profile,before,after);
 assert.equal(scored.supported,true);
 assert.equal(scored.ranking_version,'HHBA_MATCH_RANKING_V2');
 assert.ok(scored.updated_score>scored.original_score);
 assert.ok(scored.delta>0);
 assert.deepEqual(scored.newly_visible_terms,['Python']);
 assert.equal(scored.after_breakdown.experience,scored.before_breakdown.experience);
 assert.equal(scored.after_breakdown.education,scored.before_breakdown.education);
 assert.equal(scored.after_breakdown.role,scored.before_breakdown.role);
 assert.equal(scored.after_breakdown.location,scored.before_breakdown.location);
});
test('unchanged wording never inflates a score',()=>{
 const scored=sameEngineReassessment(validatedAuditedJob(sources,job.id),profile,before,before);
 assert.equal(scored.delta,0);
 assert.equal(scored.newly_visible_terms.length,0);
});
test('reassessment input requires explicit truthfulness, identical block identity and bounded profile',()=>{
 const payload={job_id:job.id,consent_reassessment:true,confirm_real:true,
  profile,before_blocks:before,after_blocks:after};
 assert.equal(validReassessmentInput(payload),true);
 assert.equal(validReassessmentInput({...payload,confirm_real:false}),false);
 assert.equal(validReassessmentInput({...payload,after_blocks:[{...after[0],id:'tampered'}]}),false);
 assert.equal(validReassessmentInput({...payload,profile:{...profile,experience_years:1000}}),false);
 assert.equal(validReassessmentInput({...payload,before_blocks:[{...before[0],text:'x'.repeat(1601)}]}),false);
});
