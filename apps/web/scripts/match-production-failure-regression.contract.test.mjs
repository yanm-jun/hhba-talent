import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl,isDirectEmployerSourceHit,recruitmentSourceKind}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits,sourceOnlyJobPreviews}
 from '../functions/_lib/deepseek-search-match.js';
import {classifyJobAvailability,isRecommendationEligible}
 from '../functions/_lib/match-job-quality.js';
import {runAgentOwnedMainlandMatch,targetedEmployerRecoveryQueries} from '../functions/_lib/ai-owned-job-research.js';
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

test('when Search finds job-board postings, Agent receives only title hints and can target the actual employer domain',async()=>{
 const {searchPublicJobs}=await import('../functions/_lib/deepseek-search-match.js');
 const board=aggregators[7];
 const provider=await searchPublicJobs('synthetic','dummy text','',{
  queriesOverride:['区域督导 企业招聘'],
  fetcher:async()=>new Response(JSON.stringify({results:[
   {title:board.title,url:board.url,site_name:board.source,summary:'第三方转发职位'},
   {title:employer.title,url:employer.url,site_name:employer.source,
    summary:employer.summary,snippet:employer.snippet}
  ]}),{status:200}),
  allowEmpty:true
 });
 assert.equal(provider.hits.length,1);
 assert.equal(provider.hits[0].url,employer.url);
 assert.ok(provider.diagnostic.rejected_title_hints.includes(board.title));
 assert.ok(!JSON.stringify(provider.hits).includes(board.url));
 const queryLog=[];
 let decisionCalls=0;
 const result=await runAgentOwnedMainlandMatch('synthetic','虚构测试简历：区域运营管理','',10,
  {expandDetailed:false},{
   plan:async()=>({queries:['区域督导']}),
   search:async(key,cv,hint,{queriesOverride})=>{
    queryLog.push(...queriesOverride);
    if(queriesOverride.some(q=>q.includes('美团官网')))
     return {hits:[employer],diagnostic:{successful_searches:1,raw_results:2}};
    return {hits:[],diagnostic:{successful_searches:1,raw_results:12,
     rejected_title_hints:['美团招聘督导经理','汽车渠道督导 - 第三方招聘平台'],rejected_links:12}};
   },
   decide:async(key,cv,hint,pool,queries,history)=>{
    decisionCalls++;
    if(decisionCalls===1){
     assert.ok(history.some(h=>Array.isArray(h.rejected_title_hints)&&
      h.rejected_title_hints.includes('美团招聘督导经理')));
     return {actions:[{type:'search',queries:['美团官网 督导经理 工作地点 北京 招聘']}]};
    }
    return {actions:[{type:'finish'}]};
   },
   select:async()=>{const err=new Error('AI_MATCH_NO_VALID_JOBS');err.code=err.message;throw err},
   recover:async()=>[]
  });
 assert.ok(queryLog.some(q=>q.includes('美团官网')));
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,employer.url);
 assert.equal(result.matches[0].match_score,null);
});

test('Agent must reserve real time for a shortlist rather than spending all 150 seconds iterating Search',()=>{
 const script=readFileSync(new URL('../functions/_lib/ai-owned-job-research.js',import.meta.url),'utf8');
 assert.match(script,/const reserve=Math\.max\(40000,reserveMs\)/);
 assert.match(script,/searchTool\(queries,\{reserveMs:85000\}\)/);
 assert.match(script,/searchTool\(next\.queries,\{reserveMs:44000\}\)/);
 assert.match(script,/while\(budget\(\)>\(pool\.length>=5\?97000:67000\)\)/);
 assert.match(script,/modelTimeoutMs:Math\.min\(32000,Math\.max\(1000,budget\(\)-12500\)\)/);
});

test('source recovery queries use only public role clues, not private or invalid mirror URLs',()=>{
 const queries=targetedEmployerRecoveryQueries([
  {type:'search',rejected_title_hints:[
   'B Capital Job Board','美团招聘督导经理','15712345678','person@example.com',
   '美团招聘督导经理','DCC主管-小米汽车经销商','职位列表']},
 ],['已搜索官方岗位']);
 assert.equal(queries.length,2);
 assert.ok(queries.every(q=>q.includes('企业官网')&&q.includes('-site:zhipin.com')));
 assert.ok(queries.some(q=>q.includes('美团招聘督导经理')));
 assert.ok(queries.every(q=>!q.includes('15712345678')&&!q.includes('example.com')));
});
test('zero official sources must trigger bounded employer-domain discovery before a no-jobs failure',async()=>{
 const queries=[];
 const result=await runAgentOwnedMainlandMatch('synthetic-key',
  '合成测试简历：参与过区域门店运营和商户项目协调。','',10,
  {expandDetailed:false},{
   plan:async()=>({queries:['区域督导 企业招聘 招聘岗位']}),
   search:async(key,cv,hint,opts)=>{
    queries.push(...opts.queriesOverride);
    if(opts.queriesOverride.some(q=>q.includes('美团招聘督导经理')&&q.includes('企业官网')))
     return {hits:[employer],diagnostic:{successful_searches:1,raw_results:3}};
    return {hits:[],diagnostic:{successful_searches:1,raw_results:20,
     rejected_title_hints:['美团招聘督导经理','B Capital Job Board'],
     rejected_links:20}};
   },
   decide:async()=>({actions:[{type:'finish'}]}),
   select:async()=>{const e=new Error('AI_MATCH_NO_VALID_JOBS');e.code=e.message;throw e},
   recover:async()=>[]
  });
 assert.ok(queries.some(q=>q.includes('美团招聘督导经理')&&q.includes('企业官网')));
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,employer.url);
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.diagnostic.third_party_results_shown,0);
});
