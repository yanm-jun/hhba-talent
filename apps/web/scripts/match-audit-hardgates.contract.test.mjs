import test from 'node:test';
import assert from 'node:assert/strict';
import {MAINLAND_CITIES,isMainlandJobLocation,findMainlandCity} from '../functions/_lib/mainland-job-location.js';
import {extractSkillRequirements} from '../functions/_lib/job-skill-evidence.js';
import {scoreCandidateFit,evaluateJobEligibility} from '../functions/_lib/match-ranking.js';
import {sanitizedJobIntent,buildOfficialQueries,extractOfficialJob} from '../functions/_lib/domestic-search-fetch.js';
import {groundedCareerDirections} from '../functions/_lib/resume-role-evidence.js';
import {verifiedProfile,isVerifiedMainlandLocation} from '../functions/_lib/resume-match-core.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const now=Date.parse('2026-11-08T04:00:00Z');
const profile={education:'BACHELOR',experience_years:3,
 target_roles:['Python 开发工程师'],skills:[{name:'SQL',evidence:'SQL'}]};
const job={title:'Python 开发工程师',location:'上海',company:'示例公司',
 min_experience_years:2,minimum_education:'BACHELOR',required_skills:['Python','SQL'],
 mandatory_skills:['Python']};

test('verified 337-name Mainland registry includes previously missing prefectures',()=>{
 assert.ok(MAINLAND_CITIES.length>=300);
 for(const city of ['三亚','拉萨','泉州','大同','襄阳','宜昌','呼和浩特','和田','博尔塔拉','深圳'])
  assert.ok(MAINLAND_CITIES.includes(city),city);
 for(const location of ['三亚','拉萨市','泉州市','呼和浩特','和田','Shenzhen, China','杭州，上海','北京 / 深圳'])
  assert.equal(isMainlandJobLocation(location),true,location);
 assert.equal(findMainlandCity('工作地点：北京市'), '北京');
});

test('Mainland job verification rejects mixed unknown or overseas work locations',()=>{
 for(const location of ['北京 / 伦敦','北京 / London','北京 / 巴黎','上海 / Sydney',
  '深圳 / 伦敦','北京 / 未知城市','香港','台湾','Tokyo','中国','Remote, China']){
  assert.equal(isMainlandJobLocation(location),false,location);
  const expected=['北京 / 未知城市','中国','Remote, China'].includes(location)?
   'WORK_LOCATION_NOT_EVIDENCED':'NOT_MAINLAND_JOB';
  assert.equal(evaluateJobEligibility(profile,{...job,location}).reason,expected,location);
 }
 assert.equal(isVerifiedMainlandLocation({location:'三亚'},{countryCode:'CN'}),true);
 assert.equal(isVerifiedMainlandLocation({location:'北京 / 伦敦'},{countryCode:'CN'}),false);
 assert.equal(isVerifiedMainlandLocation({location:'三亚'},{countryCode:'US'}),false);
});

test('the external-search job-intent sanitizer cannot forward free-form names',()=>{
 assert.equal(sanitizedJobIntent('张三'),null);
 assert.equal(sanitizedJobIntent('刘强'),null);
 assert.equal(sanitizedJobIntent('闫某某'),null);
 assert.equal(sanitizedJobIntent('Python 开发'),'Python 开发');
 assert.equal(sanitizedJobIntent('数据分析师'),'数据分析师');
 assert.equal(sanitizedJobIntent('张三 Python 开发'),'Python 开发');
 assert.equal(sanitizedJobIntent('李四 数据分析师'),'数据分析师');
 assert.equal(sanitizedJobIntent('外贸业务'),'外贸业务');
 assert.equal(sanitizedJobIntent('舞蹈编导'),'舞蹈编导');
 assert.equal(buildOfficialQueries(['张三','李四'],true).length,0);
 const queries=buildOfficialQueries(['张三 Python 开发','刘强 数据分析师'],true);
 assert.equal(queries.length,4);
 assert.ok(queries.every(q=>!q.includes('张三')&&!q.includes('刘强')));
});

test('job directions may be inferred only from real resume responsibilities',()=>{
 const source='工作经历\n2023.07—2026.07 某科技有限公司\n负责 Python API 接口开发、服务端功能维护，支持业务平台上线。';
 const fromModel=groundedCareerDirections(['Python 开发工程师'],source);
 assert.deepEqual(fromModel,['Python 开发工程师']);
 assert.deepEqual(groundedCareerDirections([],source),['Python 开发工程师']);
 const vetted=verifiedProfile({education:null,experience_years:null,
   skills:[],target_roles:['Python 开发工程师']},source,new Date(now));
 assert.ok(vetted.target_roles.includes('Python 开发工程师'));
 assert.deepEqual(groundedCareerDirections(['Python 开发工程师'],'个人资料：熟练使用 Python 和 SQL，热爱学习，善于合作。'),[]);
 assert.deepEqual(groundedCareerDirections(['Python 开发工程师'],'姓名：张三。学历：本科。'),[]);
});

test('unproven strictly mandatory official skill excludes primary Top10 candidate',()=>{
 const terms=extractSkillRequirements(
  '岗位要求：必须掌握 Python；熟悉 SQL；有 Kubernetes 经验者优先。');
 assert.deepEqual(terms.mandatory,['Python']);
 assert.deepEqual(terms.required,['Python','SQL']);
 assert.deepEqual(terms.preferred,['Kubernetes']);
 assert.equal(evaluateJobEligibility(profile,job).reason,'MANDATORY_SKILL_NOT_EVIDENCED');
 assert.equal(scoreCandidateFit(profile,job).score,null);
 const qualified={...profile,skills:[{name:'Python'},{name:'SQL'}]};
 assert.equal(scoreCandidateFit(qualified,job).eligible,true);
 assert.notEqual(scoreCandidateFit(qualified,job).score,null);
});

test('must-have alternatives and nice-to-have skills are not hard gates',()=>{
 for(const txt of [
  '任职要求：Python 或 Java 至少掌握一种；有 Kubernetes 经验者优先。',
  '任职要求：Python 优先；熟悉 SQL；不要求 Java。',
  '职位要求：具有 Python 开发经验更佳，熟悉数据库。'
 ]){
  const x=extractSkillRequirements(txt);
  assert.equal(x.mandatory.length,0,txt);
  const ranked=scoreCandidateFit(profile,{...job,mandatory_skills:x.mandatory,
   required_skills:x.required,preferred_skills:x.preferred,unclassified_skills:x.unclassified});
  assert.equal(ranked.eligible,true,txt);
 }
});

test('official requirement extraction retains qualifications beyond 1000 chars',()=>{
 const url='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
 const long='任职要求\n熟悉软件工程实践、代码管理、项目协作、数据平台开发、研发测试与持续集成。'.repeat(30);
 const content=[
  '# Python 开发工程师 深圳','工作地点：深圳','岗位职责',
  '负责企业服务端 API 开发以及业务项目建设和接口设计，维护线上服务。',
  '岗位要求',long,
  '必须掌握 Python，具备 7年以上软件开发工作经验，本科及以上学历。',
  '申请岗位'
 ].join('\n');
 const item=extractOfficialJob({url},{content},new Date(now));
 assert.ok(item,'verified official JD with a Mainland city should parse');
 assert.ok(item.evidence.requirement.length>1000);
 assert.ok(item.evidence.requirement.includes('7年以上'));
 assert.ok(item.evidence.requirement.includes('必须掌握 Python'));
});

test('labelled overseas location must not fall back to a domestic employer heading',()=>{
 const url='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
 const content=[
  '# Python 开发工程师 北京','工作地点：伦敦','岗位职责',
  '负责服务端开发，提供接口设计与数据库维护、生产服务运行保障。',
  '岗位要求','本科及以上学历，熟练掌握 Python 和 SQL，有多年软件开发经验。',
  '申请岗位'
 ].join('\n');
 assert.equal(extractOfficialJob({url},{content}),null);
});

function externalWithRequirements(requirement,id='2097166275703910400'){
 const title='Python 开发工程师';
 return {
  id:'careers.tencent.com:'+id,source_type:'站外官方招聘',
  source_status:'OFFICIAL_DETAIL_FETCHED',company:'腾讯',
  title,location:'深圳',official_url:'https://careers.tencent.com/jobdesc.html?postId='+id,
  official_domain:'careers.tencent.com',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
  has_application_cta:true,checked_at:'2026-11-08T04:00:00Z',
  evidence:{title,location:'深圳',requirement}
 };
}
test('a JD demanding a master degree blocks bachelor; master preference does not',()=>{
 const bachelor={...profile,skills:[{name:'Python'},{name:'SQL'}]};
 const masterOnly=externalWithRequirements(
  '岗位要求：硕士学历，必须掌握 Python，有3年以上软件开发经验，熟悉 SQL。');
 const noMatch=fuseDomesticJobRecommendations([],[masterOnly],bachelor,
  {role_hint:'Python 开发工程师'},now);
 assert.equal(noMatch.matches.length,0);
 const bachelorAllowed=externalWithRequirements(
  '岗位要求：本科及以上学历，硕士优先；必须掌握 Python，有3年以上软件开发经验，熟悉 SQL。');
 const allowed=fuseDomesticJobRecommendations([],[bachelorAllowed],bachelor,
  {role_hint:'Python 开发工程师'},now);
 assert.equal(allowed.matches.length,1);
 const noSkill=fuseDomesticJobRecommendations([],[bachelorAllowed],profile,
  {role_hint:'Python 开发工程师'},now);
 assert.equal(noSkill.matches.length,0,'mandatory Python absent');
});
