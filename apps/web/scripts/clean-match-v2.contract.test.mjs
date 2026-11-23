import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preferredCities,fallbackPlan,isExactEmployerJobUrl,groundedVacancy,
 runCleanJobMatch,planRecoverySearch,diversifyEmployerSources,groundedMatchExplanations,scoreJobs,rankCleanMatchResults,MATCH_V2} from '../functions/_lib/clean-match-v2.js';
import {onRequest} from '../functions/api/match-next/[[path]].js';
import {onRequest as legacyMatchRoute} from '../functions/api/match-native/[[path]].js';

const JD_URL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const BAD='https://job-boards.greenhouse.io/example/jobs/1234567';
const BOARD='https://www.zhipin.com/job_detail/1234567';
const JD=[
 '腾讯社会招聘','招聘单位：腾讯','职位名称：销售运营主管',
 '工作地点：上海','岗位职责：负责渠道运营和销售数据复盘工作',
 '任职要求：具有销售数据分析经验和跨团队协作能力',
 '申请说明：职位信息仅供参考，是否仍在招聘请以官网状态为准'
].join('\n');
const profile={facts:[{id:'CV-1',kind:'work',
 quote:'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘'}],
 skills:[{name:'渠道运营'},{name:'门店管理'}],
 target_roles:['区域督导','渠道运营']};
const reply=v=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(v)}]}]});
function makeFetcher({withoutCity=false,allSearchFail=false,noFetch=false,unsupportedText=false}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  const request=JSON.parse(opts.body),path=new URL(url).pathname;
  calls.push({path,request});
  if(path==='/v1/tools/search'){
   if(allSearchFail)return new Response('failed',{status:503});
   return Response.json({results:[
    {url:JD_URL,title:'腾讯 销售运营主管 上海职位',site_name:'腾讯招聘',
     summary:'职位详情，上海，销售运营主管，要求渠道分析经验'},
    {url:BOARD,title:'上海区域督导',site_name:'直聘平台'},
    {url:BAD,title:'Overseas job',site_name:'Foreign job'}
   ]});
  }
  if(path==='/v1/tools/fetch'){
   if(noFetch)return new Response('failed',{status:502});
   return Response.json({content:withoutCity?
    JD.replace('工作地点：上海','公司总部：上海'):JD});
  }
  if(path==='/responses'){
   if(unsupportedText)return new Response('not json',{status:200,headers:{'content-type':'text/plain'}});
   const instructions=request.instructions||'';
   if(instructions.includes('检索策略'))
    return reply({queries:['区域督导 上海 社会招聘 企业官网']});
   if(instructions.includes('提取真实公司'))
    return reply({jobs:[{id:'p1',company:'腾讯',title:'销售运营主管',
     duties_quote:'负责渠道运营和销售数据复盘工作',
     requirements_quote:'具有销售数据分析经验和跨团队协作能力'}]});
   if(instructions.includes('求职匹配分析师'))
    return reply({jobs:[{id:'p1',score:82,
     resume_fact_ids:['CV-1'],
     alignments:[{jd_quote:'负责渠道运营和销售数据复盘工作',resume_fact_id:'CV-1'}],
     gaps:[{jd_quote:'具有销售数据分析经验和跨团队协作能力'}],
     reason:'简历具有汽车区域门店运营、渠道培训及销售漏斗复盘的真实经历，可对应岗位的渠道运营和销售数据分析职责；仍须核对企业对行业经验及学历的具体要求。',
     score_basis:'岗位职责要求渠道运营与销售数据复盘，简历有相应门店和渠道经验，但最低学历及行业任职年限仍待核对。'}]});
   throw Error('unexpected reasoning prompt');
  }
  throw Error('unexpected '+url);
 };
 return {calls,fetcher};
}

test('search geography expands Shanghai to nearby cities without mistaking former sales territory for preference',()=>{
 assert.deepEqual(preferredCities('意向工作城市：上海\n经历：山东省区督导'),['上海']);
 assert.deepEqual(preferredCities('曾负责上海区域市场，工作地济南'),[]);
 const plan=fallbackPlan(profile,'','意向工作城市：上海');
 assert.ok(plan.queries.some(x=>x.includes('上海')));
 assert.ok(plan.queries.some(x=>x.includes('苏州')));
 assert.ok(plan.queries.some(x=>x.includes('渠道运营')));
 assert.ok(plan.queries.every(x=>!x.includes('山东')));
});

test('only single-employer job pages are considered, not foreign ATS, board or company homepage',()=>{
 assert.equal(isExactEmployerJobUrl(JD_URL),true);
 assert.equal(isExactEmployerJobUrl(BAD),false);
 assert.equal(isExactEmployerJobUrl(BOARD),false);
 assert.equal(isExactEmployerJobUrl('https://careers.tencent.com/search.html'),false);
 assert.equal(isExactEmployerJobUrl('https://www.tencent.com'),false);
});

test('source-grounded vacancy requires explicit work city and real company/title/duty text',()=>{
 const page={url:JD_URL,title:'腾讯 销售运营主管',site:'腾讯招聘',content:JD};
 const v=groundedVacancy(page);
 assert.equal(v?.company,'腾讯');
 assert.equal(v?.title,'销售运营主管');
 assert.equal(v?.location,'上海');
 assert.equal(groundedVacancy({...page,
  content:JD.replace('工作地点：上海','企业总部：上海')}),null);
 assert.equal(groundedVacancy(page,{company:'不存在的公司',title:'销售运营主管'}),null);
 assert.equal(groundedVacancy(page,{company:'腾讯',title:'销售运营主管',
  duties_quote:'模型编造且不存在于页面的岗位职责内容'}),null);
});

test('Huawei mainland official job-details URL is accepted; markdown headings give real workplace evidence',()=>{
 const url='https://career.huawei.com/cn/job-details?advertisementId=46681';
 assert.equal(isExactEmployerJobUrl(url),true);
 const body=[
  '# 职位详情','## 法务合规专员','', '## 工作地点','', '上海',
  '## 岗位职责','1、参与外管遵从合规风险识别与评估，并支持相关整改闭环。',
  '## 任职要求','1、熟悉合规风险管理、法规检索与数据分析。'
 ].join('\n');
 const job=groundedVacancy({url,title:'职位详情',site:'华为招聘',content:body},{
  company:'华为',title:'法务合规专员',
  duties_quote:'参与外管遵从合规风险识别与评估',
  requirements_quote:'熟悉合规风险管理、法规检索与数据分析'
 });
 assert.equal(job?.company,'华为');
 assert.equal(job?.title,'法务合规专员');
 assert.equal(job?.location,'上海');
 assert.match(job?.duties||'',/风险识别/);
 assert.equal(groundedVacancy({url,title:'职位详情',site:'华为招聘',
  content:body.replace('## 工作地点\n\n上海','## 公司总部\n\n上海')},{
   company:'华为',title:'法务合规专员',
   duties_quote:'参与外管遵从合规风险识别与评估'
  }),null,'headquarters cannot substitute for explicitly listed work city');
});

test('Markdown sections do not turn generic work-city headings into invented cities',()=>{
 const url='https://career.huawei.com/cn/job-details?advertisementId=46681';
 const generic=['职位名称：区域运营专员','公司名称：华为',
  '## 工作地点','', '## 岗位职责',
  '负责渠道管理与数据复盘。',
  '## 任职要求','具备相关工作经验。'].join('\n');
 assert.equal(groundedVacancy({url,title:'职位详情',site:'华为招聘',content:generic}),null);
});

test('Clean V2 finds real page via provider Search, reads JD and scores only with evidenced CV fact',async()=>{
 const {calls,fetcher}=makeFetcher(),activity=[],stage=[],partials=[];
 const result=await runCleanJobMatch('test-key',
  '求职意向城市：上海\n负责区域门店督导、渠道培训和数据复盘',profile,'区域督导',10,{
   onProgress:x=>stage.push(x),onActivity:x=>activity.push(x),
   onPartial:x=>partials.push(...x)
  },{fetcher});
 assert.equal(result.diagnostic.mode,MATCH_V2);
 assert.equal(result.diagnostic.queries,16,'scarce first-round results trigger six additional queries');
 assert.equal(result.diagnostic.searches,16);
 assert.equal(result.diagnostic.recovery_planned,true);
 assert.equal(result.diagnostic.recovery_queries,6);
 assert.equal(result.diagnostic.recovery_candidates,0,'same employer URL is not a new job');
 assert.equal(result.diagnostic.candidate_links,1,'duplicate Search sources are not job count');
 assert.equal(result.diagnostic.fetch_attempted,1);
 assert.equal(result.diagnostic.page_reads,1);
 assert.equal(result.diagnostic.extracted_jobs,1);
 assert.deepEqual(result.matches.map(x=>x.official_url),[JD_URL]);
 assert.equal(result.matches[0].match_score,82);
 assert.equal(result.matches[0].location,'上海');
 assert.equal(result.matches[0].score_evidence_status,'GROUNDED_JD_RESUME_QUOTES');
 assert.match(result.matches[0].matched[0],/岗位原文.*负责渠道运营.*简历原文.*负责汽车区域/);
 assert.match(result.matches[0].not_evidenced[0],/岗位要求/);
 assert.doesNotMatch(result.matches[0].recommendation_reason,/仍须核对企业对行业经验及学历/);
 assert.equal(result.matches[0].jd_source_status,undefined,
  'page text is useful evidence but not an independently verified immutable JD archive');
 assert.equal(result.matches[0].evidence_status,'PARTIAL_SOURCE');
 assert.ok(stage.includes('planning')&&stage.includes('searching')&&
  stage.includes('reading')&&stage.includes('researching')&&stage.includes('scoring'));
 assert.equal(partials.length,1);
 assert.equal(activity.length>=3,true);
 assert.ok(calls.filter(x=>x.path==='/v1/tools/search').every(x=>
  !JSON.stringify(x.request).includes('负责区域门店督导')));
 assert.equal(calls.filter(x=>x.path==='/v1/tools/fetch').length,1);
});

test('failed model reasoning still permits only page-verified, unscored source facts',async()=>{
 const {fetcher}=makeFetcher({unsupportedText:true});
 const result=await runCleanJobMatch('test','期望城市：上海',profile,'区域督导',10,{}, {fetcher});
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.matches[0].official_url,JD_URL);
 assert.equal(result.diagnostic.model_failures,1);
 assert.equal(result.diagnostic.score_provider_error,'AI_PROVIDER_RESPONSE_INVALID');
});

test('no work-city evidence never becomes a scored or unscored vacancy',async()=>{
 const {fetcher}=makeFetcher({withoutCity:true});
 const result=await runCleanJobMatch('test','意向城市：上海',profile,'区域督导',10,{}, {fetcher});
 assert.equal(result.matches.length,0);
 assert.equal(result.diagnostic.page_reads,1);
 assert.equal(result.diagnostic.stage,'insufficient_job_evidence');
});

test('provider has zero official candidates: no invented links and clear stage code',async()=>{
 const {fetcher}=makeFetcher({allSearchFail:true});
 const result=await runCleanJobMatch('test','意向城市：上海',profile,'区域督导',10,{}, {fetcher});
 assert.deepEqual(result.matches,[]);
 assert.equal(result.diagnostic.stage,'search_provider_unavailable');
 assert.equal(result.diagnostic.search_failures,10);
 assert.deepEqual(result.diagnostic.provider_error_codes,['AI_PROVIDER_UPSTREAM_ERROR']);
 assert.equal(result.diagnostic.page_reads,0);
});

test('Fetch failure must not be silently represented as there are no jobs',async()=>{
 const {fetcher}=makeFetcher({noFetch:true});
 const result=await runCleanJobMatch('test','意向城市：上海',profile,'区域督导',10,{}, {fetcher});
 assert.deepEqual(result.matches,[]);
 assert.equal(result.diagnostic.stage,'pages_unreadable');
 assert.equal(result.diagnostic.fetch_attempted,1);
 assert.equal(result.diagnostic.fetch_failures,1);
 assert.deepEqual(result.diagnostic.fetch_error_codes,['AI_PROVIDER_UPSTREAM_ERROR']);
});

test('rebuild launch gate is closed until independent live evidence acceptance',async()=>{
 const res=await onRequest({request:new Request('https://hhba.work/api/match-next/status'),
  env:{HHBA_MATCH_SERVICE_ENABLED:'1',HHBA_MATCH_DEEPSEEK_KEY:'synthetic-key-long-enough',
   HHBA_PNVS_AUTH_DB:{prepare(){}}}});
 const status=await res.json();
 assert.equal(status.enabled,false);
});

test('old resume matching backend is retired in production but has no data-destructive changes',async()=>{
 const status=await legacyMatchRoute({
  request:new Request('https://hhba.work/api/match-native/status'),
  env:{CF_PAGES_BRANCH:'main'}
 });
 assert.equal(status.status,200);
 assert.equal((await status.json()).enabled,false);
 const match=await legacyMatchRoute({
  request:new Request('https://hhba.work/api/match-native/resume',{method:'POST'}),
  env:{CF_PAGES_BRANCH:'main'}
 });
 assert.equal(match.status,410);
 assert.equal((await match.json()).error,'MATCH_BACKEND_RETIRED');
});

test('single failed search does not masquerade as zero market demand when another source is valid',async()=>{
 let n=0;
 const {fetcher}=makeFetcher();
 const partial=async(url,opts)=>{
  if(new URL(url).pathname==='/v1/tools/search'&&n++===0)
   return new Response('temporary upstream error',{status:503});
  return fetcher(url,opts);
 };
 const result=await runCleanJobMatch('test','期望工作城市：上海',profile,'区域督导',10,{}, {fetcher:partial});
 assert.equal(result.matches.length,1);
 assert.equal(result.diagnostic.search_failures,1);
 assert.equal(result.diagnostic.searches,15);
 assert.equal(result.diagnostic.recovery_queries,6);
 assert.deepEqual(result.diagnostic.provider_error_codes,['AI_PROVIDER_UPSTREAM_ERROR']);
 assert.equal(result.diagnostic.stage,'complete');
});

test('new backend owns status and has no imports of hybrid, Greenhouse, Lever, checkpoints or stale Agent',async()=>{
 const res=await onRequest({
  request:new Request('https://hhba.work/api/match-next/status'),
  env:{HHBA_MATCH_CLEAN_V2_ENABLED:'1',HHBA_MATCH_SERVICE_ENABLED:'1',HHBA_MATCH_DEEPSEEK_KEY:'synthetic-key-long-enough',
   HHBA_PNVS_AUTH_DB:{prepare(){}}}
 });
 assert.equal(res.status,200);
 const status=await res.json();
 assert.equal(status.engine,MATCH_V2);
 assert.equal(status.enabled,true);
 const code=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.doesNotMatch(code,/ai-owned-job-research|native-deepsearch|hybrid-mainland|job-jd-archive|ai-research-checkpoint/);
 assert.match(page,/const API='\/api\/match-next'/);
 assert.match(code,/EXPLICIT_AI_SHARING_CONSENT_REQUIRED/);
 assert.match(code,/sessionOfBearer/);
 assert.match(code,/saveMatchHistory/);
});


test('source order visits different employer domains before dozens of postings from one site',()=>{
 const tencent=Array.from({length:20},(_,i)=>({
  url:'https://careers.tencent.com/jobdesc.html?postId='+(100000+i),
  title:'腾讯 渠道管理 '+i,site:'腾讯招聘'
 }));
 const huawei={url:'https://career.huawei.com/cn/job-details?advertisementId=46681',
  title:'华为运营岗位',site:'华为招聘'};
 const ranked=diversifyEmployerSources([...tencent,huawei]);
 assert.deepEqual(ranked.slice(0,2).map(x=>new URL(x.url).hostname),
  ['careers.tencent.com','career.huawei.com']);
 assert.equal(ranked.length,21);
 assert.equal(new Set(ranked.map(x=>x.url)).size,21);
});

test('location-less first 24 employer pages do not hide a valid later official vacancy',async()=>{
 const urls=Array.from({length:25},(_,i)=>JD_URL.replace(
  /postId=\d+/,'postId='+(2097166275703910400n+BigInt(i)).toString()));
 const base=makeFetcher().fetcher;
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname;
  if(path==='/v1/tools/search')return Response.json({results:urls.map((jobUrl,i)=>({
   url:jobUrl,title:'腾讯 销售运营主管 上海 第'+(i+1)+'个职位',
   site_name:'腾讯招聘',summary:'岗位详情及渠道运营要求'
  }))});
  if(path==='/v1/tools/fetch'){
   const jobUrl=JSON.parse(opts.body).url;
   return Response.json({content:jobUrl===urls[24]?JD:
    JD.replace('工作地点：上海','公司总部：上海')});
  }
  return base(url,opts);
 };
 const stages=[];
 const result=await runCleanJobMatch('test-key',
  '意向工作城市：上海\n渠道督导、销售复盘',profile,'区域督导',10,
  {onProgress:stage=>stages.push(stage)},{fetcher});
 assert.equal(result.diagnostic.candidate_links,25);
 assert.equal(result.diagnostic.fetch_attempted,25);
 assert.ok(result.diagnostic.source_batches>1,'later pages were actually fetched');
 assert.ok(result.diagnostic.source_backfill_attempts>0);
 assert.equal(result.diagnostic.page_reads,25);
 assert.equal(result.diagnostic.extracted_jobs,1);
 assert.equal(result.diagnostic.stage,'complete');
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,urls[24]);
 assert.equal(result.matches[0].location,'上海');
 assert.ok(stages.includes('researching')&&stages.includes('scoring'));
});

test('underfilled Search triggers one adaptive wave and backfills a second real employer JD',async()=>{
 const {fetcher:base}=makeFetcher(),seen=[];
 const HUAWEI='https://career.huawei.com/cn/job-details?advertisementId=46681';
 const other=[
  '华为社会招聘','公司名称：华为','职位名称：渠道运营主管',
  '工作地点：上海','岗位职责：负责销售渠道管理、区域业务分析与跨部门项目协调执行',
  '任职要求：熟悉企业运营指标、渠道经营管理和数据分析方法，能够协调多部门落实年度经营计划',
  '岗位说明：本岗位职位信息可供求职者在企业招聘页面核对，并以招聘方最新官方公示为准'
 ].join('\n');
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname,req=JSON.parse(opts.body);
  if(path==='/v1/tools/search'&&
   /招聘 职位详情 工作地点 岗位职责|企业招聘 任职要求 职位申请/.test(req.query)){
   seen.push(req.query);
   return Response.json({results:[{url:HUAWEI,
    title:'华为 渠道运营主管 上海 职位',site_name:'华为招聘',
    summary:'岗位职责、工作城市、任职要求'}]});
  }
  if(path==='/v1/tools/fetch'&&req.url===HUAWEI)
   return Response.json({content:other});
  return base(url,opts);
 };
 const result=await runCleanJobMatch('test-key',
  '意向工作城市：上海\n渠道督导、销售复盘',profile,'区域督导',10,
  {},{fetcher});
 assert.equal(result.diagnostic.recovery_planned,true);
 assert.ok(result.diagnostic.recovery_queries>=1&&result.diagnostic.recovery_queries<=6);
 assert.equal(result.diagnostic.queries,10+result.diagnostic.recovery_queries);
 assert.equal(result.diagnostic.recovery_candidates,1);
 assert.equal(result.diagnostic.candidate_links,2);
 assert.equal(result.diagnostic.fetch_attempted,2);
 assert.equal(result.diagnostic.page_reads,2);
 assert.equal(result.diagnostic.visible_jobs,2);
 assert.ok(seen.length>0);
 assert.deepEqual(new Set(result.matches.map(x=>x.official_url)),new Set([JD_URL,HUAWEI]));
 assert.ok(result.matches.every(x=>x.location==='上海'));
 assert.ok(result.matches.every(x=>x.evidence_status==='PARTIAL_SOURCE'));
});

test('adaptive query planning never repeats prior terms and survives unavailable reasoning model',async()=>{
 const used=['渠道运营 上海 社会招聘 职位详情 企业官网'];
 const fetcher=async()=>new Response('error',{status:503});
 const result=await planRecoverySearch(fetcher,'test',
  {roles:['渠道运营'],cities:['上海']},{previousQueries:used});
 assert.equal(result.planning_error,'AI_PROVIDER_UPSTREAM_ERROR');
 assert.ok(result.queries.length>=1&&result.queries.length<=6);
 assert.ok(result.queries.every(x=>!used.includes(x)));
 assert.ok(result.queries.every(x=>x.includes('渠道运营')));
});

test('only verbatim JD quotes and actual résumé fact IDs become user-visible evidence',()=>{
 const job=groundedVacancy({url:JD_URL,title:'腾讯 销售运营主管',
  site:'腾讯招聘',content:JD});
 const v=groundedMatchExplanations(job,{
  alignments:[
   {jd_quote:'负责渠道运营和销售数据复盘工作',resume_fact_id:'CV-1'},
   {jd_quote:'企业强制要求金融资格证书',resume_fact_id:'CV-1'},
   {jd_quote:'负责渠道运营和销售数据复盘工作',resume_fact_id:'fake-id'}
  ],
  gaps:[
   {jd_quote:'具有销售数据分析经验和跨团队协作能力'},
   {jd_quote:'必须拥有不存在的证书'}
  ]
 },profile.facts);
 assert.equal(v.matched.length,1);
 assert.equal(v.not_evidenced.length,1);
 assert.match(v.matched[0],/汽车区域门店运营/);
 assert.doesNotMatch(v.matched.join(' '),/资格证书/);
 assert.doesNotMatch(v.not_evidenced.join(' '),/不存在/);
});

test('a plausible-looking numeric score with fabricated or unmapped citations stays unscored',async()=>{
 const job=groundedVacancy({url:JD_URL,title:'腾讯 销售运营主管',
  site:'腾讯招聘',content:JD});
 const fetcher=async()=>reply({jobs:[{id:'p1',score:98,
  resume_fact_ids:['CV-1'],alignments:[
   {jd_quote:'企业严格要求博士学历和十年经验',resume_fact_id:'CV-1'}
  ],gaps:[{jd_quote:'企业严格要求博士学历和十年经验'}],
  reason:'这个候选人显然满足所有岗位要求，可以直接入职，所有职业证书和学历都没有任何问题，完全符合任职资格与工作地点要求。',
  score_basis:'所有任职要求完全达标，包括学历、证书和技能，入职概率极高。'}]});
 const matches=await scoreJobs(fetcher,'test',profile,[job]);
 assert.equal(matches.length,1);
 assert.equal(matches[0].match_score,null);
 assert.equal(matches[0].matched.length,0);
 assert.equal(matches[0].not_evidenced.length,0);
 assert.equal(matches[0].score_evidence_status,undefined);
 assert.doesNotMatch(matches[0].recommendation_reason,/博士|入职概率极高|直接入职/);
});

test('final recommendations rank verified JD provenance and genuine scores, never a fake zero',()=>{
 const rows=[
  {id:'partial-empty',evidence_status:'PARTIAL_SOURCE',match_score:null},
  {id:'verified-low',jd_source_status:'VERIFIED_JD',match_score:62},
  {id:'partial-high',evidence_status:'PARTIAL_SOURCE',match_score:96},
  {id:'verified-high',jd_source_status:'VERIFIED_JD',match_score:84},
  {id:'verified-empty',jd_source_status:'VERIFIED_JD',match_score:null}
 ];
 const ranked=rankCleanMatchResults(rows);
 assert.deepEqual(ranked.map(x=>x.id),[
  'verified-high','verified-low','verified-empty','partial-high','partial-empty'
 ]);
 assert.equal(rows[0].id,'partial-empty','original results must not be mutated');
 assert.equal(ranked[2].match_score,null,'unscored evidence is not a score of zero');
});
