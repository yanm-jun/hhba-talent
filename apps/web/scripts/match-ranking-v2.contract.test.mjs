import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RANKING_VERSION,DEFAULT_RANKING_WEIGHTS,isMainlandWorkCity,
 inferOfficialSkills,evaluateJobEligibility,scoreCandidateFit,
 proposeFeedbackWeightUpdate
} from '../functions/_lib/match-ranking.js';

const profile={
 education:'BACHELOR',experience_years:3,target_roles:['Python 开发工程师'],
 skills:[{name:'Python',evidence:'Python'},{name:'SQL',evidence:'SQL'}]
};
const role={
 company:'某国内企业',title:'Python 开发工程师',location:'上海',
 required_skills:['Python','SQL'],min_experience_years:3,minimum_education:'BACHELOR'
};

test('audited initial model is a provider-independent 100 point distribution',()=>{
 assert.equal(RANKING_VERSION,'HHBA_MATCH_RANKING_V2');
 assert.deepEqual(DEFAULT_RANKING_WEIGHTS,{role:30,skills:30,experience:20,education:10,location:10});
 assert.equal(Object.values(DEFAULT_RANKING_WEIGHTS).reduce((a,b)=>a+b,0),100);
 assert.equal(Object.isFrozen(DEFAULT_RANKING_WEIGHTS),true);
});

test('Mainland job scope is a hard requirement regardless of foreign employer ownership',()=>{
 for(const location of ['北京','上海 · 远程办公','Shenzhen, China','Hangzhou, China'])
  assert.equal(isMainlandWorkCity(location),true,location);
 for(const location of ['','中国大陆','Remote, China','香港','台湾','Tokyo','San Francisco, USA','北京 / 香港'])
  assert.equal(isMainlandWorkCity(location),false,location);
 assert.equal(evaluateJobEligibility(profile,{...role,company:'外国品牌中国有限公司',location:'上海'}).eligible,true);
});

test('3 years cannot qualify for 7 years, missing experience cannot qualify either',()=>{
 for(const years of [3,0,null,undefined]){
  const applicant={...profile,experience_years:years};
  assert.deepEqual(evaluateJobEligibility(applicant,{...role,min_experience_years:7}),
   {eligible:false,reason:'EXPERIENCE_NOT_MET'});
  assert.equal(scoreCandidateFit(applicant,{...role,min_experience_years:7}).score,null);
 }
 assert.equal(evaluateJobEligibility({...profile,experience_years:7},{...role,min_experience_years:7}).eligible,true);
});

test('unknown or lower education cannot satisfy an explicitly higher degree requirement',()=>{
 const master={...role,minimum_education:'MASTER'};
 assert.equal(scoreCandidateFit(profile,master).reason,'DEGREE_NOT_MET');
 assert.equal(scoreCandidateFit({...profile,education:null},role).reason,'DEGREE_NOT_MET');
 assert.equal(scoreCandidateFit(profile,{...role,minimum_education:null}).eligible,true);
 assert.equal(scoreCandidateFit(profile,{...role,minimum_education:'UNRESTRICTED'}).eligible,true);
});

test('perfect documented match reaches 100 points but never claims hiring probability',()=>{
 const result=scoreCandidateFit({...profile,experience_years:7},role);
 assert.equal(result.eligible,true);
 assert.equal(result.score,100);
 assert.deepEqual(result.breakdown,{role:30,skills:30,experience:20,education:10,location:10});
 assert.equal(result.score,Object.values(result.breakdown).reduce((a,b)=>a+b,0));
 assert.equal(result.ranking_version,RANKING_VERSION);
 assert.equal(result.hiring_probability,undefined);
});

test('missing job skills are not assumed to be a perfect skills match',()=>{
 const result=scoreCandidateFit(profile,{...role,required_skills:[]});
 assert.equal(result.eligible,true);
 assert.equal(result.breakdown.skills,8);
 assert.ok(result.score<95);
});

test('skill overlap provides evidence; unrelated roles without skill overlap do not qualify',()=>{
 const dataRole={...role,title:'数据分析师',required_skills:['Python','SQL']};
 const oneSkill=scoreCandidateFit({...profile,skills:[{name:'Python'}]},dataRole);
 const both=scoreCandidateFit(profile,dataRole);
 assert.equal(oneSkill.eligible,true);
 assert.ok(both.score>oneSkill.score);
 const unrelated=scoreCandidateFit(profile,{...role,title:'高级会计师',required_skills:['会计资格证']});
 assert.equal(unrelated.eligible,false);
 assert.equal(unrelated.reason,'NO_MATCH_EVIDENCE');
});

test('scoring is source-neutral and deterministic for identical verified job facts',()=>{
 const a=scoreCandidateFit(profile,{...role,source_type:'HHBA站内岗位'});
 const b=scoreCandidateFit(profile,{...role,source_type:'站外官方招聘'});
 assert.deepEqual(a,b);
 assert.equal(a.score,scoreCandidateFit(profile,{...role}).score);
});

test('preferred cities are soft signals and never override Mainland-only gate',()=>{
 const sh=scoreCandidateFit(profile,role,{preferred_cities:['上海']});
 const bj=scoreCandidateFit(profile,role,{preferred_cities:['北京']});
 assert.ok(sh.score>bj.score);
 assert.equal(bj.eligible,true);
 assert.equal(scoreCandidateFit(profile,{...role,location:'新加坡'},{preferred_cities:['新加坡']}).eligible,false);
});

test('skill extraction reads only explicit requirement text and rejects Java/JavaScript collision',()=>{
 assert.deepEqual(inferOfficialSkills('具备 Python、SQL 和 JavaScript 能力，至少3年相关开发经验。'),
  ['Python','SQL','JavaScript']);
 assert.ok(!inferOfficialSkills('要求熟练 JavaScript 开发，熟悉 React 与 Git，具有 API 设计经验。').includes('Java'));
 assert.deepEqual(inferOfficialSkills(''),[]);
});

test('cold-start feedback does not change live weights or trigger any personalization',()=>{
 const draft=proposeFeedbackWeightUpdate({
  distinct_users:199,verified_outcomes:10000,
  comparative_lifts:{role:.4,skills:.1,experience:.1,education:0,location:0}
 });
 assert.equal(draft.status,'INSUFFICIENT_EVIDENCE');
 assert.deepEqual(draft.weights,DEFAULT_RANKING_WEIGHTS);
 const before=scoreCandidateFit(profile,role);
 proposeFeedbackWeightUpdate({distinct_users:300,verified_outcomes:1000,
  comparative_lifts:{role:.4,skills:-.3,experience:.2,education:0,location:-.1}});
 assert.deepEqual(scoreCandidateFit(profile,role),before,'Offline proposals never modify production scoring');
});

test('offline feedback only proposes bounded weights after sufficient reviewed aggregates',()=>{
 const aggregate={distinct_users:250,verified_outcomes:900,
  comparative_lifts:{role:.4,skills:-.25,experience:.05,education:0,location:0}};
 const candidate=proposeFeedbackWeightUpdate(aggregate);
 assert.equal(candidate.status,'PROPOSAL_ONLY');
 assert.equal(candidate.auto_activated,false);
 assert.equal(candidate.requires_review,true);
 assert.equal(Object.values(candidate.weights).reduce((a,b)=>a+b,0),100);
 for(const [dimension,weight] of Object.entries(candidate.weights))
  assert.ok(Math.abs(weight-DEFAULT_RANKING_WEIGHTS[dimension])<=3);
 assert.equal(proposeFeedbackWeightUpdate({...aggregate,comparative_lifts:{role:100}}).status,'INVALID_AGGREGATE');
});

test('future approved weight versions require server-side review and remain bounded',()=>{
 const metrics={distinct_users:250,verified_outcomes:900,
  comparative_lifts:{role:.5,skills:-.5,experience:0,education:0,location:0}};
 const proposal=proposeFeedbackWeightUpdate(metrics);
 const applicant={...profile,skills:[{name:'Python'}],experience_years:3};
 const baseline=scoreCandidateFit(applicant,role);
 const unapproved=scoreCandidateFit(applicant,role,{},{...proposal,version:'hhba-ranking-v2-1'});
 assert.deepEqual(unapproved,baseline,'Offline proposal must not activate itself');
 const approved={status:'APPROVED',version:'hhba-ranking-v2-1',weights:proposal.weights};
 const result=scoreCandidateFit(applicant,role,{},approved);
 assert.equal(result.weight_policy_version,'hhba-ranking-v2-1');
 assert.notEqual(result.score,baseline.score,'Human-approved policy may change soft ordering');
 assert.equal(scoreCandidateFit(applicant,{...role,min_experience_years:7},{},approved).reason,
  'EXPERIENCE_NOT_MET');
 const invalid={...approved,weights:{...approved.weights,role:100}};
 assert.deepEqual(scoreCandidateFit(applicant,role,{},invalid),baseline);
});

test('no resume, account identifier, or applicant action is required to rank',()=>{
 const job={...role};
 const clean={education:profile.education,experience_years:3,
  target_roles:profile.target_roles,skills:profile.skills.map(s=>({name:s.name}))};
 assert.ok(scoreCandidateFit(clean,job).score>0);
 assert.equal(JSON.stringify(scoreCandidateFit(clean,job)).includes('phone'),false);
});
