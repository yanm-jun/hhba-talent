import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyJobAvailability,isRecommendationEligible,normalizeMatchScore,sortByMatchScore} from '../functions/_lib/match-job-quality.js';
import {recruitmentSourceKind,sourceDisplay,sortEmployerFirst,employerLookupQuery,corroboratesEmployerPosting} from '../functions/_lib/match-employer-source.js';
import {explicitPreferredCity,supplementalQueries,mergeCandidateHits,combineRecommended} from '../functions/_lib/match-search-growth.js';
import {buildRoleIntent,buildRoleSearchQueries,buildResumeProfile} from '../functions/_lib/match-role-intent.js';
import {searchQueries,normalizeHits,selectedJobs,searchPublicJobs,
 enrichCandidateDetails,reasonAboutJobs,runSearchFirstMatch,preferEmployerPostingUrls,DEEP_SEARCH_BUDGET} from '../functions/_lib/deepseek-search-match.js';

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
test('deep-search tier caps Search/Fetch requests and raises Search result coverage to 50',async()=>{
 assert.equal(DEEP_SEARCH_BUDGET.searchRequests,10);
 assert.equal(DEEP_SEARCH_BUDGET.fetchRequests,16);
 assert.equal(DEEP_SEARCH_BUDGET.searchResultsPerRequest,50);
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push({url,body:JSON.parse(init.body)});
  if(url.endsWith('/v1/tools/search'))return new Response(JSON.stringify({results:posts}),{status:200});
  return new Response(JSON.stringify({content:'本职位招聘中，上海工作，岗位职责包括项目沟通与需求分析。'.repeat(6)}),{status:200});
 };
 const repeated=Array.from({length:15},(_,i)=>'岗位 '+i+' 招聘 企业官网');
 const found=await searchPublicJobs('fake-key-for-test',cv,'AI产品经理',{
  fetcher,queriesOverride:repeated,allowEmpty:true
 });
 assert.equal(calls.filter(x=>x.url.endsWith('/v1/tools/search')).length,10);
 assert.ok(calls.filter(x=>x.url.endsWith('/v1/tools/search')).every(x=>x.body.count===50));
 assert.equal(found.diagnostic.queries,10);
 const hits=Array.from({length:22},(_,i)=>({
  id:'d'+i,url:'https://careers.chinacorp.cn/jobs/job-'+i,
  summary:'招聘职位',snippet:'岗位',availability:{status:'UNKNOWN'}
 }));
 const checked=await enrichCandidateDetails('fake-key-for-test',hits,{fetcher,maxFetch:100});
 assert.equal(checked.fetch_attempts,16);
 assert.equal(checked.fetches,16);
 assert.equal(calls.filter(x=>x.url.endsWith('/v1/tools/fetch')).length,16);
});
test('public API query plan is short, role-aware, and never sends complete resume to search API',()=>{
 const queries=searchQueries(cv,'AI产品经理');
 assert.ok(queries.length>=3&&queries.length<=4);
 assert.ok(queries.every(q=>q.length<=128));
 assert.ok(queries.some(q=>q.includes('AI产品经理')));
 assert.ok(queries.some(q=>q.includes('品牌督导')));
 assert.ok(queries.every(q=>!q.includes('负责HHBA')));
});
test('role intent expands a short job title and preserves travel and industry preferences',()=>{
 const resume='负责汽车经销商DCC运营、区域门店督导、销售线索转化、销售顾问培训和AI智能体产品项目。工作年限3年，本科。';
 const intent=buildRoleIntent('督导，全国范围可出差，汽车零售优先',resume);
 assert.equal(intent.primary_direction,'督导');
 assert.ok(intent.direct_roles.includes('区域督导'));
 assert.ok(intent.direct_roles.includes('渠道督导'));
 assert.ok(intent.adjacent_roles.includes('区域运营'));
 assert.match(intent.constraints.travel_preference,/全国出差/);
 assert.ok(intent.constraints.industry_preferences.includes('汽车行业优先'));
 const queries=buildRoleSearchQueries('督导，全国范围可出差，汽车零售优先',resume);
 assert.ok(queries.length>=3&&queries.length<=4);
 assert.ok(queries.some(q=>q.includes('督导')));
 assert.ok(queries.some(q=>q.includes('全国出差')));
 assert.ok(queries.some(q=>q.includes('区域运营')));
});
test('natural-language job descriptions resolve the actual role instead of retaining the whole sentence',()=>{
 const resume='有经销商管理、区域门店督导、销售培训和渠道运营经验。';
 const simple=buildRoleIntent('我想找一份督导岗位，能够接受全国出差，汽车零售优先',resume);
 assert.equal(simple.primary_direction,'督导');
 const regional=buildRoleIntent('我希望从事汽车行业的区域督导工作，全国范围可出差',resume);
 assert.equal(regional.primary_direction,'区域督导');
 const priority=buildRoleIntent('全国出差，督导优先，汽车零售优先',resume);
 assert.equal(priority.primary_direction,'督导');
});
test('city preferences preserve user priority and never infer from past work locations',()=>{
 const hint=buildRoleIntent('我想找督导岗位，济南优先、青岛其次，全国范围可出差',
  '工作经历：曾在上海工作，工作地点为聊城。');
 assert.deepEqual(hint.constraints.preferred_cities,['济南','青岛']);
 const historyOnly=buildRoleIntent('督导，全国出差',
  '工作经历：工作地点山东聊城，曾在上海任职。');
 assert.deepEqual(historyOnly.constraints.preferred_cities,[]);
 const resumePreference=buildRoleIntent('督导',
  '求职意向：区域督导；期望城市：杭州、宁波。工作经历：上海。');
 assert.deepEqual(resumePreference.constraints.preferred_cities,['杭州','宁波']);
});
test('resume evidence profile only emits skills and education supported by resume text',()=>{
 const profile=buildResumeProfile('本科。负责经销商DCC运营、门店培训、线索转化和销售漏斗复盘。工作年限3年。');
 assert.equal(profile.education,'本科');
 assert.equal(profile.experience_years,3);
 assert.ok(profile.skills.some(x=>x.name==='区域与渠道管理'&&/经销商|DCC/.test(x.evidence)));
 assert.ok(profile.skills.some(x=>x.name==='团队培训与质量管理'));
 assert.ok(profile.skills.some(x=>x.name==='销售转化与客户运营'));
 assert.ok(profile.warnings.length>0);
 const empty=buildResumeProfile('做过一些工作。');
 assert.equal(empty.education,null);
 assert.equal(empty.experience_years,null);
 assert.equal(empty.skills.length,0);
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
 assert.ok(calls.every(x=>x.body.query.length<=128&&x.body.count===50&&x.body.need_content===false));
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
  roleHint:'督导，全国出差，汽车零售优先',
  fetcher:async(url,options)=>{
   called++;
   const body=JSON.parse(options.body);
   assert.equal(url,'https://api.deepseek.com/responses');
   assert.equal(body.model,'deepseek-v4-pro');
   assert.equal(body.tools,undefined);
   assert.equal(body.text.format.type,'json_object');
   assert.equal(body.reasoning.effort,'none');
   assert.match(body.instructions,/用户目标方向与限制条件/);
   assert.match(body.input,/全国出差/);
   assert.match(body.instructions,/简历能力线索/);
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
 assert.ok(result.profile.skills.length>0);
 assert.ok(result.profile.target_roles.length>0);
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

test('city-aware supplemental searches only use explicit location preferences and prioritize the user hint',()=>{
 const text='工作经历在山东聊城，意向城市：杭州、宁波。希望从事AI产品经理。';
 assert.equal(explicitPreferredCity(text),'杭州');
 const q=supplementalQueries(text,'AI产品经理',searchQueries(text,'AI产品经理'));
 assert.equal(q.length,6);
 assert.ok(q.every(x=>x.includes('杭州')&&x.length<=128));
 assert.equal(explicitPreferredCity('曾在聊城管理门店和培训顾问。'),'');
 assert.equal(explicitPreferredCity('工作经历：上海；工作地点：聊城。','督导，济南优先、青岛其次'),'济南');
});
test('AI matching privacy disclosure describes DeepSeek data flow and redaction limits',async()=>{
 const {readFile}=await import('node:fs/promises');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const privacy=await readFile(new URL('../src/pages/PersonalCenterPage.tsx',import.meta.url),'utf8');
 const route=await readFile(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const core=await readFile(new URL('../functions/_lib/resume-match-core.js',import.meta.url),'utf8');
 assert.match(page,/DeepSeek API/);
 assert.match(page,/不保证完全匿名/);
 assert.match(privacy,/DeepSeek Search 接收/);
 assert.match(privacy,/不会自动识别并遮盖姓名/);
 assert.match(privacy,/匹配历史会保存岗位推荐结果/);
 assert.match(route,/DeepSeek Search 仅接收生成的检索词/);
 assert.match(core,/\[邮箱已隐藏\]/);
 assert.match(core,/\[手机号已隐藏\]/);
 assert.match(core,/\[身份证号已隐藏\]/);
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
 const supplementalSet=new Set(supplementalQueries(cv,'AI产品经理',searchQueries(cv,'AI产品经理')));
 const fetcher=async(url,options)=>{
  urls.push(url);
  const payload=JSON.parse(options.body);
  if(url.endsWith('/v1/tools/search')){
   searches++;
   const extra=supplementalSet.has(payload.query);
   return new Response(JSON.stringify({results:extra?allResults.slice(5):allResults.slice(0,5)}),{status:200});
  }
  if(url.endsWith('/v1/tools/fetch')){
   return new Response(JSON.stringify({content:'岗位详情：实际工作地上海，团队协作、产品方案实施、客户需求分析和项目交付均为岗位职责。'.repeat(4)}),{status:200});
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
 assert.equal(searches,DEEP_SEARCH_BUDGET.searchRequests);
 assert.equal(shortlist,2);
 assert.equal(details,2);
 assert.equal(result.matches.length,10);
 assert.equal(result.diagnostic.initial_visible,5);
 assert.equal(result.diagnostic.final_shortlisted,10);
 assert.equal(result.diagnostic.supplement_queries,DEEP_SEARCH_BUDGET.supplementalSearchRequests);
 assert.equal(result.diagnostic.search_attempts,DEEP_SEARCH_BUDGET.searchRequests);
 assert.ok(result.diagnostic.fetch_attempts<=DEEP_SEARCH_BUDGET.fetchRequests);
 assert.ok(result.diagnostic.estimated_tool_cost_cny<=0.13);
 assert.equal(result.diagnostic.tool_cost_ceiling_cny,0.13);
 assert.equal(result.diagnostic.details_expanded,10);
 assert.ok(result.diagnostic.primary_raw_hits>=5);
 assert.ok(result.diagnostic.primary_filtered_links>=0);
 assert.ok(seen.some(x=>x.count===5&&x.expanded===0),'initial 5 jobs are immediately available');
 assert.ok(seen.some(x=>x.count===10&&x.expanded===0),'supplement arrives without waiting for detailed prose');
 assert.ok(seen.some(x=>x.count===10&&x.expanded>0),'detailed reasons update asynchronously');
 assert.ok(result.matches.every(j=>j.match_score!==null&&j.reason_detail_complete));
 assert.ok(result.matches.every(j=>allResults.some(x=>x.url===j.official_url)),'no fabricated job URL');
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
test('Search-backed employer link replacement requires matching employer, role and Mainland city',async()=>{
 const board='https://www.zhipin.com/job_detail/brand-specialist-2026.html';
 const official='https://careers.stardust-cn.com/jobs/brand-specialist-2026';
 const job={id:'search-j1',company:'星云科技有限公司',title:'品牌督导',location:'上海',match_score:88,
  recruitment_source_kind:'THIRD_PARTY_BOARD',recruitment_source_note:'第三方招聘平台',
  official_url:board,availability_status:'UNKNOWN',recommendation_reason:'原有岗位描述'};
 const options=[],events=[];
 const hit={url:official,title:'星云科技有限公司 - 品牌督导 - 上海 职位招聘',
  site_name:'星云科技有限公司',
  summary:'星云科技有限公司招聘品牌督导，工作地点上海，负责区域门店培训。'.repeat(3),
  snippet:'上海 品牌督导' };
 const resolved=await preferEmployerPostingUrls('synthetic-secret-not-real',[job],[],{
  fetcher:async(url,init)=>{
   assert.equal(url,'https://api.deepseek.com/v1/tools/search');
   const body=JSON.parse(init.body);options.push(body);
   return new Response(JSON.stringify({results:[hit]}),{status:200});
  },onPartial:jobs=>events.push(jobs.map(j=>j.official_url))
 });
 assert.equal(resolved.lookups,1);
 assert.equal(resolved.replaced,1);
 assert.equal(resolved.matches[0].official_url,official);
 assert.equal(resolved.matches[0].match_score,88);
 assert.equal(resolved.matches[0].recruitment_source_kind,'EMPLOYER_DOMAIN_CANDIDATE');
 assert.equal(resolved.matches[0].availability_status,'UNKNOWN');
 assert.ok(resolved.matches[0].recruitment_source_note.includes('待核验'));
 assert.equal(resolved.hits.length,1);
 assert.deepEqual(events,[[official]]);
 assert.equal(options[0].count,12);
 assert.ok(options[0].query.includes('星云科技有限公司'));
 assert.ok(options[0].query.includes('品牌督导'));
 assert.ok(options[0].query.includes('企业官网'));
 assert.ok(!options[0].query.includes('原有岗位描述'),'no private resume content in a replacement lookup');
});
test('never replace a third-party URL with a guessed, mismatched or dead non-position page',async()=>{
 const job={id:'search-j1',company:'星云科技有限公司',title:'品牌督导',location:'上海',
  official_url:'https://www.zhipin.com/job_detail/brand-specialist-2026.html',
  recruitment_source_kind:'THIRD_PARTY_BOARD'};
 const searched=[
  {url:'https://careers.other-cn.com/jobs/brand-specialist-2026',
   title:'别家公司 品牌督导 上海',summary:'别家公司招聘品牌督导，上海'},
  {url:'https://careers.stardust-cn.com/jobs/finance-director-2026',
   title:'星云科技有限公司 财务总监 上海',summary:'星云科技有限公司招聘财务总监，上海'},
  {url:'https://www.zhipin.com/job_detail/98765-2026.html',
   title:'星云科技有限公司 品牌督导 上海',summary:'招聘该职位'},
  {url:'https://careers.stardust-cn.com/',
   title:'星云科技有限公司 品牌督导 上海',summary:'招聘信息首页'}
 ];
 const result=await preferEmployerPostingUrls('synthetic-secret-not-real',[job],[],{
  fetcher:async()=>new Response(JSON.stringify({results:searched}),{status:200})
 });
 assert.equal(result.replaced,0);
 assert.equal(result.matches[0].official_url,job.official_url);
});
test('official company links are left untouched and never cost an extra Search request',async()=>{
 const job={id:'search-j1',company:'星云科技有限公司',title:'品牌督导',location:'上海',
  official_url:'https://careers.stardust-cn.com/jobs/brand-specialist-2026',
  recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE'};
 const res=await preferEmployerPostingUrls('synthetic-secret-not-real',[job],[],{
  fetcher:()=>{throw Error('No extra provider search allowed')}
 });
 assert.equal(res.lookups,0);
 assert.equal(res.replaced,0);
 assert.equal(res.matches[0].official_url,job.official_url);
});
test('native cards show only employer career pages or dedicated ATS without fallback to a third-party platform',async()=>{
 const {readFile}=await import('node:fs/promises');
 const jsx=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(jsx,/recruitment_source_note/);
 assert.doesNotMatch(jsx,/THIRD_PARTY_BOARD/);
 assert.match(jsx,/企业专属招聘系统/);
 assert.doesNotMatch(jsx,/查看第三方平台职位/);
 assert.match(jsx,/不提供第三方招聘平台链接/);
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
test('only third-party sites: automatically searches employer domains, then shows no fabricated fallback',async()=>{
 const calls=[],platformHits={results:[{
  url:'https://www.zhipin.com/job_detail/brand-role-2026.html',
  title:'上海招聘品牌督导',summary:'品牌督导，工作地点上海，招聘中'.repeat(5)
 }]};
 const fetcher=async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/v1/tools/search'))return new Response(JSON.stringify(platformHits),{status:200});
  throw Error('Model and Fetch must never be called when only job boards exist: '+url);
 };
 await assert.rejects(
  runSearchFirstMatch('synthetic-secret-not-real',cv,'品牌督导',10,{fetcher}),
  /AI_EMPLOYER_JOBS_NOT_FOUND/
 );
 assert.equal(calls.length,DEEP_SEARCH_BUDGET.searchRequests);
 assert.ok(calls.every(u=>u.endsWith('/v1/tools/search')));
});
test('first Search is third-party only: official supplemental results can still return employer jobs, never board URLs',async()=>{
 const board={url:'https://www.zhipin.com/job_detail/brand-role-2026.html',
  title:'招聘产品经理',summary:'上海招聘具体岗位，属于招聘平台。'.repeat(5)};
 const corporate={url:'https://careers.orbit-cn.com/jobs/brand-role-2026',
  title:'星云科技 品牌督导 上海 招聘',
  summary:'星云科技招聘上海品牌督导，负责渠道营销、终端门店管理及团队协调。'.repeat(5)};
 let calls=0;
 const supplementalSet=new Set(supplementalQueries(cv,'品牌督导',searchQueries(cv,'品牌督导')));
 const mock=async(url,options)=>{
  if(url.endsWith('/v1/tools/search')){
   calls++;
   const q=JSON.parse(options.body).query;
   return new Response(JSON.stringify({results:supplementalSet.has(q)?[corporate]:[board]}),{status:200});
  }
  if(url.endsWith('/v1/tools/fetch'))return new Response(JSON.stringify({content:
   '上海品牌督导招聘，负责经销商门店业务督导、跨部门培训、项目执行等。'.repeat(8)}),{status:200});
  if(url.endsWith('/responses')){
   const req=JSON.parse(options.body);
   if(req.stream===false)return new Response(JSON.stringify(response({jobs:[{
    id:'search-j1',reason:'简历包括实际参与经销商门店销售渠道、团队培训和业务运营管理的工作，掌握销售线索转化及日常执行流程，对企业招聘的品牌督导职位有直接相关经历；但还需要对照官网判断具体学历、工作年限及岗位技术能力是否达标。'
   }]})),{status:200});
   const rows={jobs:[{id:'j1',company:'星云科技',title:'品牌督导',location:'上海',
    match_score:83,score_basis:'既有经销商督导、团队培训和终端运营经验，符合岗位相关的实践要求。',
    reason:'简历包含经销商督导和销售团队运营经历，与该岗位要求存在关联。'}]};
   const payload=[
    {type:'response.output_text.delta',delta:JSON.stringify(rows)},
    {type:'response.completed',response:response(rows)}
   ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
   return new Response(payload,{status:200,headers:{'Content-Type':'text/event-stream'}});
  }
  throw Error('Unexpected '+url);
 };
 const partial=[];
 const result=await runSearchFirstMatch('synthetic-secret-not-real',cv,'品牌督导',10,{
  fetcher:mock,onPartial:jobs=>partial.push(jobs.map(j=>j.official_url))
 });
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,corporate.url);
 assert.ok(calls>=3);
 assert.ok(partial.length>=1);
 assert.ok(partial.flat().every(url=>url===corporate.url));
 assert.equal(result.diagnostic.source_after.third_party_board,0);
 assert.equal(result.diagnostic.third_party_results_shown,0);
});
