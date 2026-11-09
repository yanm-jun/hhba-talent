import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from '../functions/_lib/match-job-quality.js';
import {explicitPreferredCity,supplementalQueries,mergeCandidateHits,combineRecommended} from '../functions/_lib/match-search-growth.js';
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
 assert.ok(fetched.fetches>0&&fetched.fetches<=8,'sample early candidate pages without unbounded reads');
 assert.ok(fetched.hits.every(h=>h.availability?.status==='UNKNOWN'));
 assert.equal(fetched.excluded_closed,0);
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
  fetcher,onProgress:s=>stages.push(s),onPartial:jobs=>partials.push(jobs.length),supplementalLimit:0,expandDetailed:false
 });
 assert.ok(stages.includes('searching')&&stages.includes('writing'));
 assert.equal(calls.filter(x=>x.endsWith('/search')).length,searchQueries(cv,'AI产品经理').length);
 assert.equal(calls.filter(x=>x.endsWith('/responses')).length,1);
 assert.equal(result.matches.length,2);
 assert.equal(result.diagnostic.mode,'search-first-staged');
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
test('bounded parallel Fetch verifies status, removes known closed postings, keeps unknowns',async()=>{
 const hits=normalizeHits([searchResults]);
 let calls=0,parallel=0,peak=0;
 const fetcher=async(url,opts)=>{
  assert.ok(url.endsWith('/v1/tools/fetch'));
  const id=Number(JSON.parse(opts.body).url.match(/-(\d+)-2026$/)?.[1]);
  calls++;parallel++;peak=Math.max(peak,parallel);
  await new Promise(resolve=>setTimeout(resolve,6));parallel--;
  const content=id===1?'该职位已关闭，招聘结束，不再接受申请。'.repeat(7):
    id===2?'本职位正在招聘，我们接受投递，具体岗位要求以官网为准。'.repeat(8):
    '有关上海招聘岗位的职责、经验和待遇介绍，但未显示正式申请状态。'.repeat(8);
  return new Response(JSON.stringify({content}),{status:200});
 };
 const result=await enrichCandidateDetails('synthetic-secret-not-real',hits,{fetcher,maxFetch:4});
 assert.equal(calls,4);assert.equal(peak,4);
 assert.equal(result.excluded_closed,1);
 assert.equal(result.hits.length,11);
 assert.equal(result.hits[0].availability.status,'OPEN_LISTED');
 assert.equal(result.hits[1].availability.status,'UNKNOWN');
 assert.ok(!result.hits.some(h=>h.url===posts[0].url));
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
 assert.match(jsx,/不是录用概率/);
 assert.match(jsx,/投递状态未确认/);
 assert.match(jsx,/网页显示在招/);
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
test('5 shortlisted roles are shown before supplemental search, then 10 roles and longer reasons appear',async()=>{
 const stages=[],seen=[],urls=[],allResults=[...posts.slice(0,5),...posts.slice(5,10)];
 let shortlist=0,details=0,searches=0;
 const fetcher=async(url,options)=>{
  urls.push(url);
  const payload=JSON.parse(options.body);
  if(url.endsWith('/v1/tools/search')){
   searches++;
   const extra=payload.query.includes('2026 社会招聘')||payload.query.includes('企业招聘 申请职位');
   return new Response(JSON.stringify({results:extra?allResults.slice(5):allResults.slice(0,5)}),{status:200});
  }
  if(url.endsWith('/v1/tools/fetch')){
   return new Response(JSON.stringify({content:'岗位信息：实际工作地上海，进行产品协调与团队沟通，公开招聘信息没有显示职位已关闭。'.repeat(4)}),{status:200});
  }
  if(url.endsWith('/responses')){
   if(payload.stream===false){
    details++;
    const batch=JSON.parse(payload.input.split('已选真实岗位：\n')[1]);
    return new Response(JSON.stringify(response({jobs:batch.map(item=>({
     id:item.id,reason:'这份简历体现出岗位需要的真实业务沟通和数字产品规划经历，可以把已有的实际项目推进和客户需求梳理成果用于新职位；对应上海的企业数字化产品工作，需要将项目目标转换为落地方案，也应注意企业可能额外要求行业资历与技术背景，应对照岗位详情核验。'
    }))})),{status:200});
   }
   shortlist++;
   assert.ok(payload.instructions.includes('先快速生成岗位名单'));
   assert.ok(payload.max_output_tokens<=3500);
   const candidates=JSON.parse(payload.input.split('可选真实职位：\n')[1]);
   const roles=candidates.map((h,i)=>({
    id:h.id,company:'模拟雇主'+h.id,title:'产品职位'+h.id,
    location:'上海',match_score:90-i,
    score_basis:'简历中的真实项目策划、门店业务分析以及数字产品执行经验与岗位要求相关，但需确认特定行业资质。',
    reason:'简历中的项目协调和产品设计经验与这类岗位职责相关，建议重点核对企业要求。',
    job_basis:'数字产品、业务沟通与协调'
   }));
   const raw=JSON.stringify({jobs:roles});
   const events=[
    {type:'response.output_text.delta',delta:raw},
    {type:'response.completed',response:response({jobs:roles})}
   ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
   return new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}});
  }
  throw Error('unexpected '+url);
 };
 const result=await runSearchFirstMatch('synthetic-secret-not-real',cv,'AI产品经理',10,{
  fetcher,onProgress:x=>stages.push(x),onPartial:jobs=>seen.push({
   count:jobs.length,expanded:jobs.filter(j=>j.reason_detail_complete).length,
   urls:jobs.map(j=>j.official_url)
  })
 });
 assert.equal(searches,searchQueries(cv,'AI产品经理').length+2);
 assert.equal(shortlist,2);
 assert.equal(details,2);
 assert.equal(result.matches.length,10);
 assert.equal(result.diagnostic.initial_visible,5);
 assert.equal(result.diagnostic.final_shortlisted,10);
 assert.equal(result.diagnostic.supplement_queries,2);
 assert.equal(result.diagnostic.details_expanded,10);
 assert.ok(result.diagnostic.primary_raw_hits>=5);
 assert.ok(result.diagnostic.primary_filtered_links>=0);
 assert.ok(seen.some(x=>x.count===5&&x.expanded===0),'initial 5 jobs are immediately available');
 assert.ok(seen.some(x=>x.count===10&&x.expanded===0),'supplement arrives without waiting for detailed prose');
 assert.ok(seen.some(x=>x.count===10&&x.expanded>0),'detailed reasons update asynchronously');
 assert.ok(result.matches.every(j=>j.match_score!==null&&j.reason_detail_complete));
 assert.ok(result.matches.every(j=>allResults.some(x=>x.url===j.official_url)),'no fabricated job URL');
});
