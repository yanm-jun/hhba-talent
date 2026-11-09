import test from 'node:test';
import assert from 'node:assert/strict';
import {searchQueries,normalizeHits,selectedJobs,searchPublicJobs,
 enrichCandidateDetails,reasonAboutJobs,runSearchFirstMatch} from '../functions/_lib/deepseek-search-match.js';

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
test('real Search API shape: parallel queries with query/count/need_content and optional Fetch',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return new Response(JSON.stringify(url.endsWith('/search')?{results:posts.slice(0,7)}:
   {title:'职位',content:'职位详情：工作地点上海；需要产品规划、项目协调能力。'.repeat(10)}),{status:200});
 };
 const results=await searchPublicJobs('synthetic-secret-not-real',cv,'AI产品经理',{fetcher});
 assert.ok(calls.length>=3);
 assert.ok(calls.every(x=>x.url==='https://api.deepseek.com/v1/tools/search'));
 assert.ok(calls.every(x=>x.body.query.length<=128&&x.body.count===20&&x.body.need_content===false));
 assert.equal(results.hits.length,7);
 const fetched=await enrichCandidateDetails('synthetic-secret-not-real',
  results.hits,{fetcher,maxFetch:2});
 assert.equal(fetched.fetches,0,'summary-rich jobs should never trigger unnecessary Fetch requests');
});
test('short Search summaries trigger bounded Fetch API only for candidate detail URLs',async()=>{
 let fetched=0;
 const hits=normalizeHits([{results:posts.slice(0,4).map(x=>({...x,summary:'招聘职位',snippet:'招聘职位'}))}]);
 const get=async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/v1/tools/fetch');
  assert.ok(posts.some(x=>x.url===JSON.parse(options.body).url));
  fetched++;
  return new Response(JSON.stringify({title:'招聘职位',content:'这是上海某公司产品经理招聘详情，职责包括跨团队协同和产品规划。'.repeat(12)}),{status:200});
 };
 const enriched=await enrichCandidateDetails('synthetic-secret-not-real',hits,{fetcher:get,maxFetch:2});
 assert.equal(fetched,2);
 assert.equal(enriched.fetches,2);
 assert.ok(enriched.hits[0].content.length>80);
});
test('V4 Pro reasons only about Search results; no tools are passed to model',async()=>{
 let called=0;
 const hits=normalizeHits([searchResults]);
 const text=JSON.stringify(resultRows(['j1','j2']));
 const cut=text.indexOf('},{')+1;
 assert.ok(cut>1);
 const eventStream=[
 {type:'response.created'},
 {type:'response.output_text.delta',delta:text.slice(0,cut)},
 {type:'response.output_text.delta',delta:text.slice(cut)},
 {type:'response.completed',response:response(resultRows(['j1','j2']))}
 ].map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
 const partial=[];
 const out=await reasonAboutJobs('synthetic-secret-not-real',cv,hits,10,{
  fetcher:async(url,options)=>{
   called++;
   const body=JSON.parse(options.body);
   assert.equal(url,'https://api.deepseek.com/responses');
   assert.equal(body.model,'deepseek-v4-pro');
   assert.equal(body.tools,undefined);
   assert.equal(body.text.format.type,'json_object');
   assert.equal(body.reasoning.effort,'none');
   return new Response(eventStream,{headers:{'Content-Type':'text/event-stream'}});
  },onPartial:x=>partial.push(x.length)
 });
 assert.equal(called,1);
 assert.equal(out.matches.length,2);
 assert.deepEqual(partial,[1,2]);
 assert.ok(out.matches[0].recommendation_reason.length>75);
 assert.equal(out.matches[0].official_url,posts[0].url);
});
test('end-to-end: Search then V4 Pro selects actual URLs, logs stage timing and outputs partial results',async()=>{
 const calls=[],stages=[],partials=[];
 const fetcher=async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/v1/tools/search'))return new Response(JSON.stringify(searchResults),{status:200});
  if(url.endsWith('/responses')){
   return new Response([
    {type:'response.output_text.delta',delta:JSON.stringify(resultRows(['j1','j2']))},
    {type:'response.completed',response:response(resultRows(['j1','j2']))}
   ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join(''),
    {status:200,headers:{'Content-Type':'text/event-stream'}});
  }
  throw Error('Unexpected network call: '+url);
 };
 const result=await runSearchFirstMatch('synthetic-secret-not-real',cv,'AI产品经理',10,{
  fetcher,onProgress:s=>stages.push(s),onPartial:jobs=>partials.push(jobs.length)
 });
 assert.ok(stages.includes('searching')&&stages.includes('writing'));
 assert.equal(calls.filter(x=>x.endsWith('/search')).length,searchQueries(cv,'AI产品经理').length);
 assert.equal(calls.filter(x=>x.endsWith('/responses')).length,1);
 assert.equal(result.matches.length,2);
 assert.equal(result.diagnostic.mode,'search-first');
 assert.ok(Number.isFinite(result.diagnostic.search_ms));
 assert.ok(Number.isFinite(result.diagnostic.model_ms));
 assert.ok(partials.length>=1);
});
test('failing Search API never continues to model, so key/balance errors surface precisely',async()=>{
 let calls=0;
 await assert.rejects(searchPublicJobs('synthetic-secret-not-real',cv,'AI产品经理',{
  fetcher:async()=>{calls++;return new Response('no balance',{status:402});}
 }),/AI_PROVIDER_BALANCE_INSUFFICIENT/);
 assert.ok(calls>=2);
});
