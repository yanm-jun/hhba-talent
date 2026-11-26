import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from '../functions/_lib/match-job-quality.js';
import {recruitmentSourceKind,sourceDisplay,sortEmployerFirst,employerLookupQuery,corroboratesEmployerPosting} from '../functions/_lib/match-employer-source.js';
import {explicitPreferredCity,supplementalQueries,mergeCandidateHits,combineRecommended} from '../functions/_lib/match-search-growth.js';
import {searchQueries,normalizeHits,selectedJobs,indexedJobWorkCity,sourceOnlyJobPreviews} from './fixtures/retired-search-evidence.mjs';

const cv='负责HHBA AI智能体、Agent RAG工作流产品，并管理名爵汽车经销商DCC与销售培训。';
const posts=Array.from({length:12},(_,i)=>({
 title:'华东数字科技有限公司 · 产品经理岗位招聘 '+(i+1),
 url:'https://careers.chinacorp.cn/jobs/product-manager-'+(i+1)+'-2026',
 summary:'该招聘职位在中国大陆的上海办公，工作涉及产品规划、业务需求、客户协作、Agent工具和数字化应用项目建设。'.repeat(3),
 snippet:'招聘职位，上海工作，产品经理。',
 site_name:'华东数字科技',date:null
}));
const searchResults={results:posts};
const resultRows=ids=>({jobs:ids.map((id,index)=>({
 id,company:'招聘企业'+(index+1),title:'数字产品经理'+(index+1),location:index===1?'北京':'上海',
 reason:'简历中的HHBA智能体产品、Agent任务结构设计、经销商DCC业务培训工作，表明有能力把数字化需求转化为落地流程。这类产品经理职位需要梳理客户使用场景、协调技术与业务团队推进项目，并根据岗位实际要求补充相应行业经验。',
 job_basis:'产品路线规划、业务需求梳理、跨部门协作',salary:''
 }))});
const response=jobs=>({status:'completed',output:[{type:'message',
 content:[{type:'output_text',text:JSON.stringify(jobs)}]}]});
test('public API query plan is short, role-aware, and never sends complete resume to search API',()=>{
 const queries=searchQueries(cv,'AI产品经理');
 assert.ok(queries.length>=3&&queries.length<=4);
 assert.ok(queries.every(q=>q.length<=128));
 assert.ok(queries.some(q=>q.includes('AI产品经理')));
 assert.ok(queries.some(q=>q.includes('品牌督导')));
 assert.ok(queries.every(q=>!q.includes('负责HHBA')));
});
test('search candidates come from links in Search API, never guesses or homepages',()=>{
 const hits=normalizeHits([{results:[...posts,
  {title:'招聘首页',url:'https://careers.chinacorp.cn/',summary:'招聘',snippet:'招聘'},
  {title:'日本东京海外招聘职位',url:'https://jobs.overseas.com/jobs/test-2026',summary:'招聘',snippet:'招聘'},
  posts[0]]}],28);
 assert.equal(hits.length,12);
 assert.equal(hits[0].url,posts[0].url);
 assert.equal(hits[0].id,'j1');
});
test('model selection cannot add new URL or overseas jobs',()=>{
 const hits=normalizeHits([searchResults]);
 const rows={jobs:[...resultRows(['j1','j2']).jobs,
  {id:'j400',company:'伪造',title:'虚构岗位',location:'上海',reason:'理由'},
  {id:'j3',company:'某国外公司',title:'海外运营岗位',location:'东京',reason:'理由'},
  {id:'j4',company:'未知',title:'营销岗位',location:'未知城市',reason:'理由'}
 ]};
 rows.jobs[0].url='https://evil.example.invalid/jobs/000';
 const out=selectedJobs(JSON.stringify(rows),hits,10);
 assert.equal(out.length,2);
 assert.equal(out[0].official_url,posts[0].url);
 assert.equal(out[1].location,'北京');
});
test('job availability remains unknown on Search results or on generic apply buttons',()=>{
 const search=classifyJobAvailability({summary:'上海岗位招聘，该公司显示立即申请招聘详情。'});
 assert.equal(search.status,'UNKNOWN');
 const html=classifyJobAvailability({content:'职位详情、工资、工作城市等信息。申请按钮可在页面中点击。'.repeat(5)},{
  fetched:true,checkedAt:'2026-11-10T00:00:00Z'});
 assert.equal(html.status,'UNKNOWN','generic Apply buttons are not proof that application works');
 assert.equal(html.checked_at,'2026-11-10T00:00:00Z');
});
test('explicit closed job on fetched page is rejected, but unknown job remains eligible',()=>{
 const closed=classifyJobAvailability({content:'该职位已关闭，不再接受申请。其他招聘页面内容仅供参考。'.repeat(6)},{
  fetched:true});
 const open=classifyJobAvailability({content:'本职位正在招聘，可在官网查看要求。此岗位目前正在招聘，实际投递以官网为准。'.repeat(5)},{
  fetched:true});
 assert.equal(closed.status,'CLOSED_LISTED');
 assert.equal(open.status,'OPEN_LISTED');
 assert.ok(!isRecommendationEligible({availability:closed}));
 assert.ok(isRecommendationEligible({availability:open}));
 assert.ok(isRecommendationEligible({availability:{status:'UNKNOWN'}}));
 const suspect=classifyJobAvailability({summary:'该职位已关闭。'});
 assert.equal(suspect.status,'POSSIBLY_CLOSED');
 assert.ok(!isRecommendationEligible({availability:suspect}));
});
test('availability filtering is applied even if model mentions a closed candidate ID',()=>{
 const hits=normalizeHits([searchResults]);
 hits[0].availability={status:'CLOSED_LISTED',evidence:'职位已关闭',checked_at:null};
 const rows=resultRows(['j1','j2']);
 rows.jobs[0].match_score=95;rows.jobs[0].score_basis='简历对应目标岗位职责，有项目执行经验，工作城市匹配，但需要确认技术要求。';
 rows.jobs[1].match_score=80;rows.jobs[1].score_basis='有项目分析和业务培训的经历，符合岗位需求，但行业知识仍须加强。';
 const picked=selectedJobs(JSON.stringify(rows),hits,10);
 assert.equal(picked.length,1);assert.equal(picked[0].id,'search-j2');
 assert.equal(picked[0].match_score,80);
 assert.equal(picked[0].availability_status,'UNKNOWN');
});
test('actual Search-first API retains evidence-backed scores and legacy reference field',()=>{
 const hits=normalizeHits([searchResults]);
 const scoreRows=resultRows(['j1','j2']);
 scoreRows.jobs[0].match_score=84;
 scoreRows.jobs[0].score_basis='简历中真实的产品需求梳理和业务协作工作经验，对应岗位产品规划职责，但行业专业深度需核实。';
 scoreRows.jobs[1].match_score=77;
 // The fast shortlist can omit score_basis. A long specific recommendation
 // that refers to candidate evidence is an acceptable fallback explanation.
 delete scoreRows.jobs[1].score_basis;
 const scored=selectedJobs(JSON.stringify(scoreRows),hits,10);
 assert.equal(scored.length,2);
 assert.equal(scored[0].match_score,84);
 assert.equal(scored[0].reference_score,84);
 assert.equal(scored[1].match_score,77);
 assert.equal(scored[1].reference_score,77);
 assert.match(scored[1].score_basis,/简历中的HHBA智能体产品/);
 const unknown=resultRows(['j3']);
 delete unknown.jobs[0].match_score;
 assert.equal(selectedJobs(JSON.stringify(unknown),hits,1)[0].match_score,null);
 const generic=resultRows(['j4']);
 generic.jobs[0].match_score=99;
 generic.jobs[0].reason='此公司非常优秀，岗位非常适合你，未来发展空间非常大，有很多潜力，发展前景非常不错，非常值得试试。';
 assert.equal(selectedJobs(JSON.stringify(generic),hits,1)[0].match_score,null);
});

test('score is model-reported fit, never an Offer probability, and must include explanation',()=>{
 assert.equal(normalizeMatchScore(86,'对应企业经营和岗位职责经历，专业方向较为匹配。'),86);
 assert.equal(normalizeMatchScore('75','有门店管理与区域业务培训履历，地点符合要求。'),75);
 assert.equal(normalizeMatchScore(102,'证据充足且工作经验相符，但分数越界不能展示。'),null);
 assert.equal(normalizeMatchScore(88,''),null);
 assert.equal(normalizeMatchScore('80%','很多经验与要求契合，但需要新的岗位资格核验。'),null);
 assert.equal(normalizeMatchScore(88.5,'技能与岗位要求相符，有真实经历证据可以支持。'),null);
 const ranked=sortByMatchScore([{match_score:63},{match_score:null},{match_score:91}]);
 assert.deepEqual(ranked.map(j=>j.match_score),[91,63,null]);
});
test('Score and recruitment status appear in compact modal, not admission probability',async()=>{
 const {readFile}=await import('node:fs/promises');
 const jsx=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/styles/resume-match-dialog.css',import.meta.url),'utf8');
 assert.match(jsx,/简历适配分/);
 const panels=await readFile(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.match(panels,/不是录用概率/);
 assert.match(panels,/仍需官网确认/);
 assert.match(panels,/页面显示开放，仍需确认/);
 assert.match(css,/hhba-native-score-basis/);
});

test('city-aware supplemental searches only use explicit location preferences',()=>{
 const text='工作经历在山东聊城，意向城市：杭州、宁波。希望从事AI产品经理。';
 assert.equal(explicitPreferredCity(text),'杭州');
 const q=supplementalQueries(text,'AI产品经理',searchQueries(text,'AI产品经理'));
 assert.equal(q.length,2);
 assert.ok(q.every(x=>x.includes('杭州')&&x.length<=128));
 assert.equal(explicitPreferredCity('曾在聊城管理门店和培训顾问。'),'');
});
test('supplemental candidate merge keeps original IDs and drops repeated URLs',()=>{
 const main=normalizeHits([{results:posts.slice(0,4)}]);
 const supplement=normalizeHits([{results:[posts[1],...posts.slice(4,9)]}]);
 const merged=mergeCandidateHits(main,supplement);
 assert.equal(merged.length,9);
 assert.equal(merged[0].id,'j1');
 assert.equal(merged[4].id,'j5');
 assert.equal(merged[4].url,posts[4].url);
 const jobs=combineRecommended([
  {company:'甲公司',title:'产品经理',official_url:posts[0].url,match_score:78},
  {company:'乙公司',title:'分析师',official_url:posts[1].url,match_score:90}
 ],[
  {company:'甲公司',title:'产品经理',official_url:posts[2].url,match_score:88},
  {company:'丙公司',title:'运营经理',official_url:posts[3].url,match_score:84}
 ],10);
 assert.deepEqual(jobs.map(j=>j.company),['乙公司','丙公司','甲公司']);
});
test('recruitment sources distinguish mass boards, hosted employer ATS, and uncertain employer domain candidates',()=>{
 assert.equal(recruitmentSourceKind('https://www.zhipin.com/job_detail/abcd0001.html'),'THIRD_PARTY_BOARD');
 assert.equal(recruitmentSourceKind('https://jobs.51job.com/shanghai/co123456.html'),'THIRD_PARTY_BOARD');
 assert.equal(recruitmentSourceKind('https://www.liepin.com/job/1961234567.shtml'),'THIRD_PARTY_BOARD');
 assert.equal(recruitmentSourceKind('https://careers.corp-example.cn/jobs/position-781'),'EMPLOYER_DOMAIN_CANDIDATE');
 assert.equal(recruitmentSourceKind('https://jobs.lever.co/examplecorp/abc123'),'EMPLOYER_ATS');
 assert.equal(recruitmentSourceKind('https://jobs.ashbyhq.com/example/abc'),'EMPLOYER_ATS');
 assert.equal(recruitmentSourceKind('https://boards.greenhouse.io/example/jobs/789'),'EMPLOYER_ATS');
 assert.equal(recruitmentSourceKind('https://company.example.org/about'),'UNVERIFIED');
 assert.equal(recruitmentSourceKind('https://www.unknown-board.cn/jobs/position-999'),'UNVERIFIED',
  'a generic /jobs URL on an unknown domain is not proof of official employer ownership');
 assert.equal(recruitmentSourceKind('https://www.unknown-board.cn/positions/position-999'),'UNVERIFIED');
 assert.match(sourceDisplay('EMPLOYER_DOMAIN_CANDIDATE'),/待核验/);
 assert.doesNotMatch(sourceDisplay('EMPLOYER_ATS'),/已认证|已确认官网/);
});
test('employer site results survive limited search candidate slots even after many third-party jobs',()=>{
 const boards=Array.from({length:34},(_,i)=>({
  url:'https://www.zhipin.com/job_detail/position-'+i+'-2026.html',
  title:'上海市招聘 数字产品运营'+i,summary:'招聘职位，工作地点上海。'.repeat(8)
 }));
 const employer={
  url:'https://careers.orbit-cn.com/jobs/operations-2026',
  title:'星云科技有限公司 产品运营 上海招聘',
  summary:'星云科技有限公司招聘产品运营，地点上海，负责数字产品运营管理'.repeat(3)
 };
 const found=normalizeHits([{results:[...boards,employer]}],20);
 assert.equal(found.length,1,'all 34 public job board results are removed before model ranking');
 assert.equal(found[0].url,employer.url);
 assert.equal(found[0].recruitment_source_kind,'EMPLOYER_DOMAIN_CANDIDATE');
 assert.equal(sortEmployerFirst(found,8)[0].url,employer.url);
});
test('native cards point to employer recruitment pages without a third-party action',async()=>{
 const {readFile}=await import('node:fs/promises');
 const jsx=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(jsx,/THIRD_PARTY_BOARD/);
 assert.match(jsx,/前往企业官网投递/);
 assert.doesNotMatch(jsx,/查看第三方平台职位/);
});

test('strict employer-only: no popular third-party job board or unknown source reaches selectedJobs',()=>{
 const publicSites=[
  'https://www.zhipin.com/job_detail/abc123-2026.html',
  'https://jobs.51job.com/shanghai/jb-765432.html',
  'https://www.liepin.com/job/abc123-2026.shtml',
  'https://www.zhaopin.com/job_detail/test-123.html',
  'https://www.lagou.com/jobs/764321.html',
  'https://www.unidentified-careers-board.com/job_detail/abc123.html'
 ];
 const matches=publicSites.map((url,i)=>({
  url,title:'上海 产品经理岗位招聘',summary:'上海招聘产品经理，具体职位职责和任职要求。'.repeat(4)
 }));
 const hits=normalizeHits([{results:matches}]);
 assert.equal(hits.length,0,'only source forms classified as employer-directed may enter the model shortlist');
 const raw={jobs:[{id:'j1',company:'示例科技',title:'产品经理',location:'上海',reason:'真实岗位推荐理由'}]};
 const manual=[{id:'j1',url:publicSites[0],recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE',
  availability:{status:'UNKNOWN'},summary:'上海职位招聘'}];
 assert.equal(selectedJobs(JSON.stringify(raw),manual,10).length,0,
  'forged kind must never bypass URL-based checks');
});
test('indexed employer work city is used only when the page explicitly labels a Mainland job location',()=>{
 assert.equal(indexedJobWorkCity({summary:'汽车督导招聘，工作地点：上海。岗位职责涉及经销商培训。'}),'上海');
 assert.equal(indexedJobWorkCity({summary:'企业总部位于上海，但岗位工作地点尚未发布。'}),null);
 assert.equal(indexedJobWorkCity({summary:'企业北京总部发布岗位，工作地点：东京。'}),null);
});
test('employer single-job header supplies Wuhu, not the sales territory in the role title',()=>{
 const row=employer();
 assert.equal(indexedJobWorkCity(row),'Wuhu');
 const [job]=sourceOnlyJobPreviews([row]);
 assert.equal(job?.title,'零售区域销售主管-铜陵');
 assert.equal(job?.match_score,null);
 assert.equal(job?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
});
test('do not infer a city from a title alone, an ambiguous country, headquarters or market lists',()=>{
 assert.equal(indexedJobWorkCity(employer({title:'销售主管-铜陵'})),null);
 assert.equal(indexedJobWorkCity(employer({title:'销售主管 job in Washington, China | Jobs at Example'})),null);
 assert.equal(indexedJobWorkCity(employer({title:'销售主管 job in Shanghai, Singapore, China | Jobs at Example'})),null);
 const empty=employer({title:'地区经理',summary:'Job Description: 区域销售',content:'Location: China\nCompany headquarters: Beijing'});
 assert.equal(indexedJobWorkCity(empty),null);
 assert.equal(indexedJobWorkCity({...empty,content:'Location: Singapore\nSite: Shanghai (Shanghai)'}),null);
 const careerGrid={...empty,title:'社会招聘',url:'https://careers.example.com/recruit.html?pageNumber=3',content:'Job Description\nLocation: Shanghai, China'};
 assert.deepEqual(sourceOnlyJobPreviews([careerGrid]),[]);
 assert.deepEqual(sourceOnlyJobPreviews([employer({availability:{status:'CLOSED_LISTED'}})]),[]);
 assert.deepEqual(sourceOnlyJobPreviews([employer({url:'https://job.goodjob.cn/job963820.html',source:'俊才网'})]),[]);
});
