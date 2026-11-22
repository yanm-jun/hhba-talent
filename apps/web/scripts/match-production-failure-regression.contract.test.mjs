import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl,isDirectEmployerSourceHit,recruitmentSourceKind}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits,sourceOnlyJobPreviews}
 from '../functions/_lib/deepseek-search-match.js';
import {classifyJobAvailability,isRecommendationEligible}
 from '../functions/_lib/match-job-quality.js';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';
import {sanitizePublicResearchCheckpoint} from '../functions/_lib/ai-research-checkpoint.js';

// Public URL/title structures reconstructed from the failing 2026-11-22
// production research checkpoint. No actual resume, phone, identity or key.
const employer={
 id:'j13',title:'职位详情',source:'美团招聘',
 url:'https://zhaopin.meituan.com/web/position/detail?highlightType=campus&jobUnionId=4885239249',
 summary:'督导经理社招-正式 更新时间：2026/11/10 工作地点：北京市、石家庄市、上海市、杭州市 部门：核心本地商业 工作经验：3年。岗位职责：商户运营、门店督导、项目协调。具体任职条件请查看官方职位页面。',
 snippet:'督导经理社招-正式 更新时间：2026/11/10 工作地点：北京市、石家庄市、上海市、杭州市',
 content:'',availability:{status:'UNKNOWN'}
};
const closedEmployer={
 id:'j4',title:'拼好饭-运营支持/门店督导',source:'美团招聘',
 url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId=4643320053&highlightType=social',
 summary:'拼好饭-运营支持/门店督导社招-正式 更新时间：2026/07/23 工作地点：深圳市 岗位职责：执行区域门店运营，定期巡视门店和协助项目整改。',
 content:'拼好饭-运营支持/门店督导社招-正式 更新时间：2026/07/23 工作地点：深圳市。部门：美团核心本地商业。目前系统提示：当前职位无法投递。请查看其他在招职位。',
 availability:{status:'UNKNOWN'}
};
const aggregators=[
 {title:'B Capital Job Board',source:'B Capital',
  url:'https://jobs.b.capital/companies/tuhu/jobs/51174972'},
 {title:'DCC主管-小米汽车经销商',source:'tzrl.com',
  url:'https://wenling.tzrl.com/zhaopin/job/18159-938910.htm'},
 {title:'4s店DCC主管',source:'E滁州',
  url:'https://job.0550.com/job/374543'},
 {title:'品牌督导（外派上海）',source:'最佳东方',
  url:'https://job.veryeast.cn/6000802/2099003'},
 {title:'督导专员',source:'日照职业技术学院',
  url:'https://zhaopin.rzpt.cn/job/index.php?c=comapply&id=1229'},
 {title:'督导（2026届）',source:'天津工业大学',
  url:'https://jobs.tiangong.edu.cn/correcruit/content/id/51863.html'},
 {title:'dcc经理',source:'全国工商联汽车经销商商会',
  url:'https://www.cadcc.com.cn/recruit/198.html'},
 {title:'美团督导专家',source:'牛企直聘',
  url:'https://jobs.niuqizp.com/job-vrk5NnnnL.html'}
];
test('real failed Search corpus: 8 aggregator and school links cannot enter an employer source pool',()=>{
 for(const hit of aggregators){
  assert.equal(isDirectEmployerSourceHit(hit),false,'rejected: '+hit.url);
  assert.ok(['THIRD_PARTY_BOARD','UNVERIFIED','EMPLOYER_DOMAIN_CANDIDATE'].includes(
    recruitmentSourceKind(hit.url)));
 }
 assert.equal(isMainlandEmployerJobUrl(employer.url),true);
 assert.equal(isDirectEmployerSourceHit(employer),true);
 const rows=[...aggregators.map(x=>({...x,summary:'公司职位招聘；工作地点：上海。岗位要求运营经验。'})),
  {...employer,site_name:employer.source}];
 const out=normalizeHits([{results:rows}],28);
 assert.equal(out.length,1,'the one actual corporate job must survive normalization');
 assert.equal(out[0].url,employer.url);
});
test('an employer Fetch saying 当前职位无法投递 is a closure, not a valid recommendation',()=>{
 const availability=classifyJobAvailability({content:closedEmployer.content},{fetched:true});
 assert.equal(availability.status,'CLOSED_LISTED');
 assert.equal(isRecommendationEligible({...closedEmployer,availability}),false);
 const searchState=classifyJobAvailability({summary:'当前职位无法投递，招聘已暂停。工作地点：深圳市'});
 assert.equal(searchState.status,'POSSIBLY_CLOSED');
});
test('corporate recruiting page with generic 职位详情 title recovers real role from indexed source text',()=>{
 const result=sourceOnlyJobPreviews([employer],10);
 assert.equal(result.length,1,'official company position should not be lost due to generic <title>');
 assert.equal(result[0].company,'美团');
 assert.equal(result[0].title,'督导经理');
 assert.equal(result[0].official_url,employer.url);
 assert.equal(result[0].match_score,null,'no invented numeric score from snippet');
 assert.equal(result[0].source_status,'SOURCE_SEARCH_PREVIEW');
 assert.ok(result[0].location.includes('北京'),'explicit multi-city job location must be retained');
 const noCity=sourceOnlyJobPreviews([{...employer,summary:'督导经理社招-正式，任职地点未公开',snippet:'职位详情'}],10);
 assert.equal(noCity.length,0,'never guess a work city');
});
test('actual employer sources survive model shortlist timeouts, but disallowed and explicitly closed sources do not',async()=>{
 const actions=[];
 const result=await runAgentOwnedMainlandMatch('synthetic-key',
  '虚构测试简历：曾参与门店运营、区域协调和人员培训。','',10,
  {expandDetailed:false,onActivity:x=>actions.push(x)},{
   plan:async()=>({queries:['企业官方招聘 区域督导']}),
   search:async()=>({hits:[...aggregators.map((x,i)=>({...x,id:'j'+(i+1),
      summary:'区域督导岗位 工作地点：上海'})),closedEmployer,employer],
    diagnostic:{successful_searches:1,raw_results:20,search_failures:0}}),
   decide:async()=>({actions:[{type:'finish'}]}),
   fetchDetails:async()=>({hits:[],fetches:0}),
   select:async()=>{const e=new Error('AI_MATCH_NO_VALID_JOBS');e.code=e.message;throw e;},
   recover:async()=>[]
 });
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,employer.url);
 assert.equal(result.matches[0].match_score,null);
 assert.ok(actions.some(x=>x.stage==='writing'));
 assert.equal(result.diagnostic.third_party_results_shown,0);
});
test('stale stored search checkpoints cannot reintroduce banned recruiter links',()=>{
 const input={pool:[{...employer,id:'j1'},...aggregators.map((x,i)=>({
  ...x,id:'j'+(i+2),summary:'招聘岗位公开页面'}))],
  usedQueries:['上海 督导 企业官方招聘'],history:[],shortlistIds:['j1','j2']};
 const res=sanitizePublicResearchCheckpoint(input);
 assert.equal(res.pool.length,1);
 assert.equal(res.pool[0].url,employer.url);
 assert.deepEqual(res.shortlistIds,['j1']);
});
test('Agent must reserve real time for a shortlist rather than spending all 150 seconds iterating Search',()=>{
 const script=readFileSync(new URL('../functions/_lib/ai-owned-job-research.js',import.meta.url),'utf8');
 assert.match(script,/const reserve=pool\.length\|\|completed\.length\?61000:38000/);
 assert.match(script,/while\(budget\(\)>\(pool\.length>=5\?98000:73000\)\)/);
 assert.match(script,/modelTimeoutMs:Math\.min\(32000,Math\.max\(1000,budget\(\)-12500\)\)/);
});
