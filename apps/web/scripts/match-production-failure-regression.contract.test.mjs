import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl,isDirectEmployerSourceHit,recruitmentSourceKind}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits,sourceOnlyJobPreviews} from './fixtures/retired-search-evidence.mjs';
import {classifyJobAvailability,isRecommendationEligible}
 from '../functions/_lib/match-job-quality.js';
import {targetedEmployerRecoveryQueries} from './fixtures/retired-research-decisions.mjs';
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
test('stale stored search checkpoints cannot reintroduce banned recruiter links',()=>{
 const input={pool:[{...employer,id:'j1'},...aggregators.map((x,i)=>({
  ...x,id:'j'+(i+2),summary:'招聘岗位公开页面'}))],
  usedQueries:['上海 督导 企业官方招聘'],history:[],shortlistIds:['j1','j2']};
 const res=sanitizePublicResearchCheckpoint(input);
 assert.equal(res.pool.length,1);
 assert.equal(res.pool[0].url,employer.url);
 assert.deepEqual(res.shortlistIds,['j1']);
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
test('employer discovery is occupation-neutral rather than limited to supervisors and managers',async()=>{
 const {targetedEmployerRecoveryQueries}=await import('./fixtures/retired-research-decisions.mjs');
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

test('V4 failure event never includes private resume data',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/send\('failure',\{error:code,phase,elapsed_ms:/);
 assert.doesNotMatch(route,/send\('failure',\{[^}]*resume/);
});
