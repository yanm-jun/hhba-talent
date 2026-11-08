import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyOccupation,scoreCandidateFit,evaluateJobEligibility}
 from '../functions/_lib/match-ranking.js';
import {groundedCareerDirections}
 from '../functions/_lib/resume-role-evidence.js';
import {sanitizedJobIntent,buildOfficialQueries}
 from '../functions/_lib/domestic-search-fetch.js';
import {fuseDomesticJobRecommendations}
 from '../functions/_lib/domestic-match-fusion.js';

// Synthetic labelled fixtures, NOT actual candidate resumes, official job
// listings or real-world precision measurements. No identifying data.
const pairs=[
 ['机械设计工程师','电气工程师','mechanical','electrical'],
 ['电气工程师','机械设计工程师','electrical','mechanical'],
 ['汽车研发工程师','销售顾问','automotive-engineering','sales'],
 ['工业设计师','机械设计工程师','industrial-design','mechanical'],
 ['土木工程师','建筑设计师','civil','architecture'],
 ['建筑设计师','土木工程师','architecture','civil'],
 ['影视剪辑师','影视编导','film-editing','film-directing'],
 ['影视编导','影视剪辑师','film-directing','film-editing'],
 ['舞蹈编导','影视编导','dance-choreography','film-directing'],
 ['舞蹈演员','舞蹈编导','dance-performance','dance-choreography'],
 ['舞蹈教师','教师','dance-education','education'],
 ['供应链管理','物流专员','supply-chain','logistics'],
 ['物流专员','外贸业务','logistics','international-trade'],
 ['外贸业务','翻译','international-trade','translation'],
 ['翻译','外贸业务','translation','international-trade'],
 ['护士','医生','nursing','clinical'],
 ['医生','护士','clinical','nursing'],
 ['医学检验技师','护士','medical-lab','nursing'],
 ['法务专员','人力资源专员','legal','hr'],
 ['审计专员','财务会计','auditing','accounting'],
 ['财务会计','审计专员','accounting','auditing'],
 ['市场营销','销售顾问','marketing','sales'],
 ['客服专员','销售顾问','customer-support','sales'],
 ['行政专员','人力资源专员','administration','hr'],
 ['食品工程师','化工工程师','food-science','chemical'],
 ['化工工程师','机械设计工程师','chemical','mechanical'],
 ['网络安全工程师','运维工程师','cybersecurity','devops'],
 ['视频剪辑师','平面设计师','film-editing','graphic-design'],
 ['建筑设计师','工业设计师','architecture','industrial-design'],
 ['产品经理','市场营销','product','marketing']
];
const baseProfile=role=>({education:'BACHELOR',experience_years:3,
 target_roles:[role],skills:[]});
const shape=(title,company='测试公司')=>({
 id:'synthetic-'+title,company,title,location:'上海',
 source_type:'HHBA站内岗位',official_url:'https://jobs.ashbyhq.com/verified/synthetic',
 reference_score:70,required_skills:[],min_experience_years:2,
 minimum_education:'BACHELOR',matched:[],not_evidenced:[],
 needs_verification:['本条为合成测试职位'],requirements_basis:'合成测试固定条件'
});

test('30 different role families are distinguishable before final score',()=>{
 assert.equal(pairs.length,30);
 for(const [target,wrong,expectedTarget,expectedWrong] of pairs){
  assert.equal(classifyOccupation(target),expectedTarget,target);
  assert.equal(classifyOccupation(wrong),expectedWrong,wrong);
  assert.notEqual(expectedTarget,expectedWrong,target+' vs '+wrong);
 }
});

test('cross-discipline synthetic quality evaluation: 30/30 right-role Top1, no wrong 85+ scores',()=>{
 let topOneCorrect=0,wrongHigh=0,hardFailures=0;
 for(const [target,wrong] of pairs){
  const profile=baseProfile(target),intended=shape(target,'企业甲'),distractor=shape(wrong,'企业乙');
  const wanted=scoreCandidateFit(profile,intended),other=scoreCandidateFit(profile,distractor);
  assert.equal(wanted.eligible,true,target);
  if(other.eligible&&other.score>=85)wrongHigh++;
  const candidates=[intended,distractor].map(job=>{
   const score=scoreCandidateFit(profile,job);
   return {title:job.title,score:score.eligible?score.score:-1};
  }).sort((a,b)=>b.score-a.score);
  if(candidates[0].title===target)topOneCorrect++;
  const invalid=scoreCandidateFit(profile,{...intended,min_experience_years:7});
  if(!invalid.eligible&&invalid.reason==='EXPERIENCE_NOT_MET')hardFailures++;
 }
 assert.equal(topOneCorrect,pairs.length,'all synthetic intended careers rank first');
 assert.equal(wrongHigh,0,'unrelated professions must not get misleading 85+ scores');
 assert.equal(hardFailures,pairs.length,'7-year mandatory experience can never be bypassed');
});

test('final Top10 fusion keeps the correct nontechnical job and blocks unrelated alternatives',()=>{
 for(const [target,wrong] of pairs.slice(0,15)){
  const profile=baseProfile(target);
  const selected=fuseDomesticJobRecommendations(
   [shape(target,'企业甲'),shape(wrong,'企业乙')],[],profile,{role_hint:target},Date.now()
  ).matches;
  assert.ok(selected.length>=1,target);
  assert.equal(selected[0].title,target);
  if(selected.some(x=>x.title===wrong))
   assert.ok(selected.find(x=>x.title===wrong).reference_score<
    selected.find(x=>x.title===target).reference_score);
 }
});

test('search terms retain separate professions instead of merging unrelated ones',()=>{
 const mappings=[
  ['舞蹈演员','舞蹈演员'],['舞蹈编导','舞蹈编导'],
  ['舞蹈教师','舞蹈教师'],['影视编导','影视编导'],
  ['视频剪辑师','影视剪辑师'],['工业设计师','工业设计师'],
  ['机械设计工程师','机械设计工程师'],['建筑设计师','建筑设计师'],
  ['土木工程师','土木工程师'],['外贸业务','外贸业务'],
  ['翻译','翻译'],['护士','护士'],
  ['医生','医生'],['医学检验技师','医学检验技师'],
  ['审计专员','审计专员'],['财务会计','财务会计'],
  ['供应链管理','供应链管理'],['物流专员','物流专员'],
  ['市场营销','市场营销'],['食品工程师','食品工程师']
 ];
 for(const [input,wanted] of mappings)
  assert.equal(sanitizedJobIntent(input),wanted,input);
 const queries=buildOfficialQueries(['影视剪辑师','舞蹈编导','机械设计工程师'],true);
 assert.equal(queries.length,4);
 assert.ok(queries.some(s=>s.includes('影视剪辑师')));
 assert.ok(queries.some(s=>s.includes('舞蹈编导')));
 assert.ok(queries.some(s=>s.includes('机械设计工程师')));
 assert.ok(queries.every(s=>s.length<=128));
 assert.equal(sanitizedJobIntent('某某先生'),null);
 assert.equal(sanitizedJobIntent('姓名：李四 舞蹈演员'),null);
});

test('nontechnical career directions require task verbs, not isolated domain words',()=>{
 const cases=[
  ['负责视频剪辑、字幕制作及宣传片后期。','影视剪辑师'],
  ['负责舞蹈编排和舞台群舞排练。','舞蹈编导'],
  ['参与舞蹈演出及大型舞台舞蹈表演。','舞蹈演员'],
  ['承担舞蹈教学，负责舞蹈课程开发。','舞蹈教师'],
  ['参与机械设计、零件设计和 CAD 出图。','机械设计工程师'],
  ['负责电气控制与 PLC编程，完成图纸设计。','电气工程师'],
  ['负责建筑方案设计及建筑平面设计。','建筑设计师'],
  ['负责仓储运营及物流调度协调。','物流专员'],
  ['负责出口订单处理、出口报关及外贸客户跟进。','外贸业务'],
  ['参与合同审核及法律合规审查。','法务专员'],
  ['负责病房护理及护理操作。','护士'],
  ['负责市场营销活动与品牌推广。','市场营销'],
  ['负责会计凭证及财务记账。','财务会计'],
  ['负责食品研发及食品工艺改进。','食品工程师']
 ];
 for(const [task,expected] of cases){
  const resume='工作经历\n2022年—2026年 任职记录\n'+task;
  const names=groundedCareerDirections([],resume);
  assert.ok(names.includes(expected),expected+': '+names.join(','));
  const suggested=groundedCareerDirections([expected],resume);
  assert.ok(suggested.includes(expected),expected);
 }
 for(const text of [
  '个人信息：舞蹈演员，毕业于某大学，乐于学习。',
  '专业技能：食品研发。喜欢美食，愿意努力。',
  '个人资料：机械设计、工业设计、绘画兴趣。'
 ])assert.deepEqual(groundedCareerDirections([],text),[]);
});
