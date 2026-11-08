import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMainlandJobLocation} from '../functions/_lib/mainland-job-location.js';
import {assessJobQualification} from '../functions/_lib/job-qualification-evidence.js';
import {extractSkillRequirements,extractStructuredSkillConditions} from '../functions/_lib/job-skill-evidence.js';
import {
 extractMandatoryProfessionalCredentials,extractStructuredCredentialConditions
} from '../functions/_lib/professional-credentials.js';
import {prioritizeOfficialSearchCandidates,discoverExternalOfficialJobs} from '../functions/_lib/domestic-search-fetch.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';
import {summarizeRankedRelevance} from '../functions/_lib/match-quality-evaluator.js';
import {groundedCareerTransfer} from '../functions/_lib/career-transfer-evidence.js';

const applicant={education:'BACHELOR',experience_years:4,
 target_roles:['Python 开发工程师'],skills:[{name:'Java'}]};
const job={title:'Python 开发工程师',location:'深圳',minimum_education:'BACHELOR',
 min_experience_years:2};
const at=Date.parse('2026-11-08T07:10:00Z');

test('location unknown, explicit overseas, and Mainland confirmed are distinct',()=>{
 const items=[
  ['深圳','MAINLAND_CONFIRMED'],['Shenzhen, China','MAINLAND_CONFIRMED'],
  ['北京 / 伦敦','OUTSIDE_MAINLAND'],['香港','OUTSIDE_MAINLAND'],
  ['新加坡','OUTSIDE_MAINLAND'],['美国','OUTSIDE_MAINLAND'],
  ['','UNKNOWN'],['未标注','UNKNOWN'],['远程','UNKNOWN'],
  ['中国','UNKNOWN'],['北京 / 未知城市','UNKNOWN']
 ];
 for(const [loc,status] of items)assert.equal(classifyMainlandJobLocation(loc),status,loc);
 assert.equal(assessJobQualification(applicant,{...job,location:''}).status,'NEEDS_INFORMATION');
 assert.ok(assessJobQualification(applicant,{...job,location:''}).missing.some(x=>x.field==='location'));
 assert.equal(assessJobQualification(applicant,{...job,location:'北京 / 伦敦'}).status,'INELIGIBLE');
});

test('structured one-of skills supersede overlapping mandatory flat list',()=>{
 const jd='岗位要求：必须掌握 Python、Java，任选一种。';
 const group=extractStructuredSkillConditions(jd);
 assert.deepEqual(group.map(g=>g.operator),['ANY_OF']);
 assert.deepEqual(group[0].values,['Python','Java']);
 const flat=extractSkillRequirements(jd).mandatory;
 const decision=assessJobQualification(applicant,{...job,mandatory_skills:flat,skill_conditions:group});
 assert.equal(decision.status,'ELIGIBLE');
 assert.deepEqual(decision.missing,[]);
 assert.equal(assessJobQualification({...applicant,skills:[]},
  {...job,mandatory_skills:flat,skill_conditions:group}).status,'NEEDS_INFORMATION');
});

test('explicit separate mandatory requirements remain required despite one-of choice',()=>{
 const jd='必须掌握 Python 或 Java 至少一种；必须掌握 SQL。';
 const groups=extractStructuredSkillConditions(jd);
 assert.deepEqual(groups.map(g=>g.operator),['ANY_OF','ALL_OF']);
 const missing=assessJobQualification(applicant,{...job,
  mandatory_skills:extractSkillRequirements(jd).mandatory,skill_conditions:groups});
 assert.equal(missing.status,'NEEDS_INFORMATION');
 assert.ok(missing.missing.some(x=>x.label.toLowerCase().includes('sql')));
 const full=assessJobQualification({...applicant,skills:[{name:'Java'},{name:'SQL'}]},
  {...job,mandatory_skills:extractSkillRequirements(jd).mandatory,skill_conditions:groups});
 assert.equal(full.status,'ELIGIBLE');
});

test('enumerated must-have conditions do not absorb merely familiar or preferred skills',()=>{
 const jd='必须掌握 Python、SQL，使用 Linux 维护服务；Docker 经验优先。';
 const groups=extractStructuredSkillConditions(jd);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].values,['Python','SQL']);
 assert.equal(groups[0].operator,'ALL_OF');
 const optional=extractStructuredSkillConditions('岗位要求：Python、SQL 优先；不要求 Linux。');
 assert.deepEqual(optional,[]);
});

test('N-of-M constraints do not secretly require a third skill',()=>{
 const jd='硬性要求：Python、SQL、Linux 至少掌握两项。';
 const groups=extractStructuredSkillConditions(jd);
 assert.equal(groups[0].operator,'AT_LEAST');
 assert.equal(groups[0].min_count,2);
 const given={...applicant,skills:[{name:'Python'},{name:'SQL'}]};
 const condition={...job,mandatory_skills:['Linux'],skill_conditions:groups};
 assert.equal(assessJobQualification(given,condition).status,'ELIGIBLE');
 assert.equal(assessJobQualification({...given,skills:[{name:'Python'}]},condition).status,'NEEDS_INFORMATION');
});

test('professional license alternatives supersede a legacy flat MUST list',()=>{
 const jd='岗位要求：必须持有护士执业证书、护士执业资格证书，任选一种。';
 const groups=extractStructuredCredentialConditions(jd);
 assert.deepEqual(groups.map(g=>g.operator),['ANY_OF']);
 assert.deepEqual(groups[0].values,['NURSE_PRACTICE','NURSE_QUALIFICATION']);
 const legacy=extractMandatoryProfessionalCredentials(jd).mandatory;
 const p={...applicant,professional_credentials:['NURSE_QUALIFICATION']};
 assert.equal(assessJobQualification(p,{...job,
  professional_credential_requirements:legacy,credential_conditions:groups}).status,'ELIGIBLE');
 assert.equal(assessJobQualification({...p,professional_credentials:[]},
  {...job,professional_credential_requirements:legacy,credential_conditions:groups}).status,'NEEDS_INFORMATION');
});

const internal=(id,title,location,department)=>({
 id,company:'示例公司',title,location,department,
 source_type:'HHBA站内岗位',reference_score:75,
 official_url:'https://jobs.ashbyhq.com/example/'+id,
 min_experience_years:2,minimum_education:'BACHELOR',
 required_skills:[],unclassified_skills:[],matched:[],not_evidenced:[],
 needs_verification:['仅用于合成测试']
});
test('same-company same-title separate cities are retained, same city duplicates are collapsed',()=>{
 const p={...applicant,target_roles:['Python 开发工程师'],skills:[]};
 const rows=[internal('role-a','Python 开发工程师','上海'),
  internal('role-b','Python 开发工程师','北京'),
  internal('role-c','Python 开发工程师','上海')];
 const r=fuseDomesticJobRecommendations(rows,[],p,{},at);
 assert.deepEqual(new Set(r.matches.map(x=>x.location)),new Set(['上海','北京']));
 assert.equal(r.matches.length,2);
});

test('two independently verified departments within the same city are not accidentally merged',()=>{
 const p={...applicant,target_roles:['Python 开发工程师'],skills:[]};
 const r=fuseDomesticJobRecommendations([
  internal('dept-a','Python 开发工程师','上海','数据基础架构'),
  internal('dept-b','Python 开发工程师','上海','交易平台')
 ],[],p,{},at);
 assert.equal(r.matches.length,2);
});

test('official Fetch budget covers distinct occupation intents before duplicate employer results',()=>{
 const url=i=>'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400n+BigInt(i));
 const rows=[
  ...Array.from({length:8},(_,i)=>({url:url(i),title:'Python 后端开发工程师'})),
  {url:url(8),title:'影视剪辑师'},
  {url:'https://not-recruiting.example/jobs/1',title:'影视剪辑师'}
 ];
 const selected=prioritizeOfficialSearchCandidates(rows,
  ['Python 开发工程师','影视剪辑师'],3);
 assert.ok(selected.length<=3);
 assert.ok(selected.some(x=>x.title==='影视剪辑师'),'second intent receives at least one Fetch slot');
 assert.ok(selected.some(x=>x.title==='Python 后端开发工程师'));
 assert.ok(selected.every(x=>x.url.includes('careers.tencent.com')));
});

test('offline relevance metrics compute NDCG, precision and candidate recall against labeled IDs only',()=>{
 const r=summarizeRankedRelevance([
  {group:'软件',relevance_grades:{a:3,b:2,c:0},candidate_ids:['a','b','c'],
   recommended_ids:['a','b','c']},
  {group:'艺术',relevance_grades:{x:3,y:2,z:0},candidate_ids:['x','z'],
   recommended_ids:['z','x']}
 ]);
 assert.equal(r.kind,'OFFLINE_GRADED_LABELS_ONLY');
 assert.equal(r.sample_count,2);
 assert.ok(r.ndcg_at_10>0&&r.ndcg_at_10<100);
 assert.ok(r.precision_at_3>0&&r.precision_at_3<=100);
 assert.ok(r.candidate_recall_labeled<100);
 assert.equal(r.privacy,'NO_RESUME_OR_PERSONAL_IDENTIFIERS');
 assert.ok(!JSON.stringify(r).includes('a:3'));
 assert.throws(()=>summarizeRankedRelevance([]),/RANKING_CASES_REQUIRED/);
 assert.throws(()=>summarizeRankedRelevance([
  {group:'X',relevance_grades:{good:5},candidate_ids:['good'],recommended_ids:['good']}
 ]),/RANKING_INVALID_GRADE/);
});


test('career transfer needs both intended target and two documented, relevant skills',()=>{
 const profile={
  career_intents:['内容运营'],demonstrated_roles:['销售顾问'],
  skills:[{name:'项目管理',evidence:'组织线下客户活动'},
   {name:'数据分析',evidence:'分析客户转化和订单数据'}]
 };
 const suggestion=groundedCareerTransfer(profile,{title:'内容运营'});
 assert.equal(suggestion.kind,'EVIDENCED_TRANSFER_DIRECTION_ONLY');
 assert.deepEqual(suggestion.supporting_skills,['项目管理','数据分析']);
 assert.match(suggestion.disclaimer,/不代表具有目标岗位任职经历/);
 assert.equal(groundedCareerTransfer({...profile,skills:[{name:'项目管理',evidence:'负责活动'}]},
  {title:'内容运营'}),null);
 assert.equal(groundedCareerTransfer({...profile,career_intents:[]},{title:'内容运营'}),null);
 assert.equal(groundedCareerTransfer({...profile,demonstrated_roles:['内容运营']},{title:'内容运营'}),null);
 assert.equal(groundedCareerTransfer({...profile,skills:[{name:'项目管理',evidence:''},{name:'数据分析',evidence:''}]},
  {title:'内容运营'}),null);
});

test('fetched same-company role preserves two verified work cities without duplicate SEO copies',async()=>{
 const ids=['2097166275703910401','2097166275703910402','2097166275703910403'];
 const urls=ids.map(id=>'https://careers.tencent.com/jobdesc.html?postId='+id);
 const cities=['北京','上海','北京'];
 const detail=city=>[
  '# Python 开发工程师',
  '社会招聘',
  '工作地点：'+city,
  '岗位职责',
  '负责开发后端服务、分析业务需求、维护稳定可靠的数据平台和业务接口，保障系统监控、测试、持续交付与跨团队协作。',
  '岗位要求',
  '本科及以上学历，熟练使用 Python、SQL 与常见数据库，理解软件工程方法，能够独立开发、分析故障并维护技术文档，有良好的团队沟通意识。',
  '申请岗位'
 ].join('\n');
 let searches=0,fetches=0;
 const fetcher=async(url,options)=>{
  if(String(url).endsWith('/search')){
   searches++;
   return Response.json({results:urls.map(u=>({url:u,title:'Python 开发工程师'}))});
  }
  assert.ok(String(url).endsWith('/fetch'));
  fetches++;
  const target=JSON.parse(options.body).url;
  const index=urls.indexOf(target);
  assert.notEqual(index,-1);
  return Response.json({title:'官方招聘详情',content:detail(cities[index])});
 };
 const found=await discoverExternalOfficialJobs('Python 开发','synthetic-testing-only-key',
  {fetcher,expanded:true,now:new Date('2026-11-08T00:00:00Z')});
 assert.equal(searches,4);
 assert.equal(fetches,3);
 assert.equal(found.candidate_count,2);
 assert.deepEqual(new Set(found.candidates.map(j=>j.location)),new Set(['北京','上海']));
 assert.ok(found.candidates.every(j=>j.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
});

test('one failed expanded Search cannot discard verified positions from successful Searches',async()=>{
 const url='https://careers.tencent.com/jobdesc.html?postId=2097166275703910408';
 let calls=0;
 const fetcher=async(endpoint,options)=>{
  if(String(endpoint).endsWith('/search')){
   calls++;
   if(calls===1)return new Response('{}',{status:503});
   return Response.json({results:[{url,title:'Python 开发工程师'}]});
  }
  assert.ok(String(endpoint).endsWith('/fetch'));
  return Response.json({title:'官方岗位',content:[
   '# Python 开发工程师','工作地点：北京','岗位职责',
   '负责业务系统服务端研发、数据分析、需求讨论、自动化测试和代码质量维护，协同多个团队解决线上可靠性问题。',
   '岗位要求',
   '熟练掌握 Python 和 SQL，本科及以上学历，熟悉数据库与企业软件工程流程，具备良好的沟通和问题解决能力。',
   '立即投递'
  ].join('\n')});
 };
 const result=await discoverExternalOfficialJobs('Python 开发','synthetic-testing-only-key',
  {fetcher,expanded:true,now:new Date('2026-11-08T00:00:00Z')});
 assert.equal(calls,4);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].location,'北京');
 assert.equal(result.usage.search,3);
});
