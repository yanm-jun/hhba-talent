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
import {mergeCandidateHits} from '../functions/_lib/match-search-growth.js';

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

test('three cached job sources cannot finish with zero fresh Search when the shortlist is sparse',async()=>{
 const seen=[];
 const cached={pool:[employer,{...employer,id:'j14',
   url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId=300001'},
   {...employer,id:'j15',
    url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId=300002'}],
  usedQueries:['原有搜索方向 企业招聘'],history:[{type:'search',found:3}],shortlistIds:[]};
 const added={...employer,id:'j16',title:'区域运营专员',
  url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId=300003',
  summary:'美团招聘区域运营专员社招-正式。工作地点：北京市。岗位职责：门店巡查、区域运营和渠道协调。'};
 const r=await runAgentOwnedMainlandMatch('synthetic','虚构测试简历：负责门店运营','',10,{
  expandDetailed:false,checkpoint:{load:async()=>cached,save:async()=>true}
 },{
  plan:async()=>({queries:['新增跨行业 运营督导 企业官网 社招']}),
  search:async(k,cv,hint,opts)=>{
   seen.push(...opts.queriesOverride);
   return {hits:[added],diagnostic:{successful_searches:1,raw_results:13}};
  },
  decide:async()=>({actions:[{type:'finish'}]}),
  select:async()=>{const err=new Error('AI_MATCH_NO_VALID_JOBS');err.code=err.message;throw err;},
  recover:async()=>[]
 });
 assert.equal(r.diagnostic.checkpoint_restored,true);
 assert.ok(seen.includes('新增跨行业 运营督导 企业官网 社招'));
 assert.ok(r.diagnostic.provider_items>=13,'fresh search metrics cannot be zero');
 assert.ok(r.diagnostic.candidate_links>=4);
});

test('one empty successful query cannot hide concurrent DeepSeek auth or quota failure',async()=>{
 const {searchPublicJobs}=await import('../functions/_lib/deepseek-search-match.js');
 const fetcher=async(url,{body})=>{
  const query=JSON.parse(body).query;
  if(query.includes('认证失败'))return new Response('{"error":"invalid key"}',{status:401});
  return new Response(JSON.stringify({results:[]}),{status:200});
 };
 await assert.rejects(()=>searchPublicJobs('synthetic','synthetic','',{
  queriesOverride:['认证失败的招聘查询','返回空结果的招聘查询'],
  fetcher,allowEmpty:true
 }),{code:'AI_PROVIDER_KEY_REJECTED'});
});
test('duplicate official source refreshes search evidence without changing stable ID',()=>{
 const previous={...employer,id:'j1',summary:'较旧的公开搜索信息',
  fetch_attempted:true,availability:{status:'UNKNOWN'}};
 const newer={...employer,id:'j9',summary:employer.summary,
  fetch_attempted:false,availability:{status:'UNKNOWN'}};
 const merged=mergeCandidateHits([previous],[newer],30);
 assert.equal(merged.length,1);
 assert.equal(merged[0].id,'j1');
 assert.equal(merged[0].summary,newer.summary);
 assert.equal(merged[0].fetch_attempted,false);
 const closed=mergeCandidateHits([previous],[{...newer,
  availability:{status:'POSSIBLY_CLOSED'}}],30);
 assert.equal(closed[0].availability.status,'POSSIBLY_CLOSED');
});
test('Agent cannot finish after a single employer role without trying a bounded final expansion',async()=>{
 const newRole={...employer,id:'j77',
  url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId=70000077',
  summary:'区域运营专员社招-正式 更新时间：2026/11/10 工作地点：上海市 岗位职责：门店运营和区域协调。',
  snippet:'区域运营专员社招-正式 工作地点：上海市'};
 const queries=[];
 const out=await runAgentOwnedMainlandMatch('synthetic','测试简历：有区域门店运营经验','',10,
  {expandDetailed:false},{
   plan:async()=>({queries:['区域督导 企业招聘']}),
   search:async(key,resume,hint,options)=>{
    queries.push(...options.queriesOverride);
    if(options.queriesOverride.some(q=>q.includes('在招岗位')||q.includes('官方招聘')))
     return {hits:[newRole],diagnostic:{successful_searches:1,raw_results:10}};
    return {hits:[employer],diagnostic:{successful_searches:1,raw_results:12}};
   },
   decide:async()=>({actions:[{type:'finish'}]}),
   select:async()=>{const e=new Error('AI_MATCH_NO_VALID_JOBS');e.code=e.message;throw e;},
   recover:async()=>[]
  });
 assert.ok(out.diagnostic.underfilled_expansion_queries>0);
 assert.ok(out.diagnostic.candidate_links>=2);
 assert.ok(out.diagnostic.provider_items>=12);
 assert.ok(queries.some(q=>q.includes('在招岗位')||q.includes('官方招聘')));
 assert.ok(out.matches.every(job=>job.official_url.includes('zhaopin.meituan.com')));
});

test('many official URLs without city evidence still trigger follow-up research',async()=>{
 const weak=Array.from({length:8},(_,i)=>({...employer,
  id:'j'+(i+1),url:'https://zhaopin.meituan.com/web/position/detail?jobUnionId='+String(880000+i),
  summary:'岗位内容待核实，招聘信息未展示具体工作城市。',
  snippet:'招聘职位资料尚不完整',content:''}));
 const strong={...employer,id:'j99'};
 let searches=0;
 const result=await runAgentOwnedMainlandMatch('synthetic','模拟简历：门店区域运营','',10,
  {expandDetailed:false},{
   plan:async()=>({queries:['区域运营 企业招聘']}),
   search:async(k,cv,hint,opts)=>{
    searches++;
    if(opts.queriesOverride.some(q=>q.includes('在招岗位')))
     return {hits:[strong],diagnostic:{successful_searches:1,raw_results:5}};
    return {hits:weak,diagnostic:{successful_searches:1,raw_results:12}};
   },
   decide:async()=>({actions:[{type:'finish'}]}),
   select:async()=>{const e=new Error('AI_MATCH_NO_VALID_JOBS');e.code=e.message;throw e},
   recover:async()=>[]
  });
 assert.ok(searches>=2);
 assert.ok(result.diagnostic.underfilled_expansion_queries>0);
 assert.ok(result.matches.some(x=>x.official_url===strong.url));
});
test('suspected closure from Search is eligible for a fresh employer-page Fetch, not silently lost',async()=>{
 const candidate={...employer,availability:{status:'POSSIBLY_CLOSED'},
  summary:'督导经理社招-正式 工作地点：北京市。搜索摘要可能指向已结束招聘的公告。'};
 let read=0,steps=0;
 const output=await runAgentOwnedMainlandMatch('synthetic','模拟简历：区域运营管理','',10,
  {expandDetailed:false},{
   plan:async()=>({queries:['督导经理 企业官网']}),
   search:async()=>({hits:[candidate],diagnostic:{successful_searches:1,raw_results:1}}),
   decide:async(k,cv,hits)=>{
    steps++;
    if(steps===1)return {actions:[{type:'fetch',candidate_ids:['j1']}]};
    return {actions:[{type:'finish'}]};
   },
   fetchDetails:async(k,hits)=>{
    read++;
    return {hits:hits.map(h=>({...h,content:
     '督导经理社招-正式。工作地点：北京市。该岗位正在招聘，开放申请，负责商户运营、门店督导、销售流程整改。',
     availability:{status:'OPEN_LISTED'}})),fetches:1};
   },
   select:async()=>{const e=new Error('AI_MATCH_NO_VALID_JOBS');e.code=e.message;throw e},
   recover:async()=>[]
  });
 assert.ok(read>0);
 assert.ok(output.diagnostic.page_reads>0);
 assert.ok(output.matches.every(j=>j.availability_status!=='CLOSED_LISTED'));
});

test('employer discovery is occupation-neutral rather than limited to supervisors and managers',async()=>{
 const {targetedEmployerRecoveryQueries}=await import('../functions/_lib/ai-owned-job-research.js');
 const hints=['连锁餐厅厨师','花店高级花艺师','农场收割工','机械焊工','司机驾驶员'];
 const queries=targetedEmployerRecoveryQueries([{type:'search',rejected_title_hints:hints}],[]);
 assert.ok(queries.some(q=>q.includes('厨师')));
 assert.ok(queries.some(q=>q.includes('花艺师')));
 assert.ok(queries.some(q=>q.includes('收割工')));
 assert.equal(queries.length,4,'one bounded round still limits the number of searches');
});
test('generic official job-page titles can recover explicitly labeled niche occupations',()=>{
 const job={...employer,id:'j-florist',title:'职位详情',
  summary:'招聘岗位：花艺师 工作地点：上海市 招聘人数：2人。岗位职责：花束搭配与鲜花修剪。',
  snippet:'招聘岗位：花艺师 工作地点：上海市'};
 const preview=sourceOnlyJobPreviews([job],10);
 assert.equal(preview.length,1);
 assert.equal(preview[0].title,'花艺师');
 assert.equal(preview[0].company,'美团');
 assert.equal(preview[0].location,'上海市');
 assert.equal(preview[0].match_score,null);
});
