import test from 'node:test';
import assert from 'node:assert/strict';
import {previewJobBrowserRenderer} from '../functions/_lib/cf-job-browser-preview.js';
import {runDeepSeekOfficialJobAgent} from '../functions/_lib/deepseek-official-job-agent.js';

const now=new Date('2026-11-08T12:00:00Z');
const job='https://careers.yunhe.cn/jobs/202611081234';
const home='https://yunhe.cn/';
const key='synthetic-secret-for-contract-tests';
const jd=(city='')=>[
 '# 内容运营','公司名称：云禾文化有限公司',
 ...(city?['工作地点：'+city]:[]),
 '岗位职责','负责内容运营、客户需求管理、短视频策划与传播项目执行。'.repeat(5),
 '任职要求','本科及以上学历，熟悉图文内容生产、数据复盘与团队协作。'.repeat(5),
 '立即申请'
].join('\n');
const tool=(name,args,id)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:id});

test('Browser Run is never used outside explicit preview and a real binding',()=>{
 const browserBinding={quickAction:async()=>Response.json({})};
 const vars={HHBA_AUTH_ROLLOUT:'preview',BROWSER:browserBinding};
 assert.equal(previewJobBrowserRenderer(vars),null);
 assert.equal(previewJobBrowserRenderer({...vars,HHBA_AUTH_ROLLOUT:'production',
  HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1'}),null);
 assert.equal(previewJobBrowserRenderer({...vars,HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  BROWSER:{}}),null);
 assert.equal(typeof previewJobBrowserRenderer({...vars,
  HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1'}),'function');
});

test('Native binding receives bounded public URL and no credentials or executable script',async()=>{
 const calls=[];
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  BROWSER:{quickAction:async(action,options)=>{
   calls.push({action,options});
   return Response.json({success:true,result:{
    markdown:'---\ntitle: "内容运营 | 云禾文化有限公司"\n---\n'+jd('北京'),
    content:'<html><main>职位信息</main></html>'
   }});
  }}};
 const browser=previewJobBrowserRenderer(env);
 await assert.rejects(()=>browser('http://localhost/jobs/1234'),/BROWSER_BAD_URL/);
 await assert.rejects(()=>browser('https://127.0.0.1/jobs/1234'),/BROWSER_BAD_URL/);
 await assert.rejects(()=>browser('https://careers.yunhe.cn:8443/jobs/1234'),/BROWSER_BAD_URL/);
 const result=await browser(job);
 assert.equal(result.title,'内容运营 | 云禾文化有限公司');
 assert.match(result.content,/工作地点：北京/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].action,'snapshot');
 assert.deepEqual(calls[0].options.formats,['content','markdown']);
 assert.equal(calls[0].options.url,job);
 assert.equal(calls[0].options.cookies,undefined);
 assert.equal(calls[0].options.addScriptTag,undefined);
 assert.equal(calls[0].options.authenticate,undefined);
});

test('Native binding returns empty only for insufficient rendered page text',async()=>{
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  BROWSER:{quickAction:async()=>({result:{markdown:'Empty',content:''},success:true})}};
 assert.equal(await previewJobBrowserRenderer(env)(job),null);
});

test('One-render preview rescues only independently fetched role-city evidence and flags unknown browser cost',async()=>{
 let modelCalls=0,renderCalls=0;
 const fetcher=async(endpoint,opts)=>{
  if(endpoint.endsWith('/responses')){
   modelCalls++;
   return Response.json({status:'completed',
    usage:{input_tokens:350,input_tokens_details:{cached_tokens:90},output_tokens:45},
    output:modelCalls===1?[tool('search_jobs',{query:'内容运营 企业官网 任职要求 工作地点'},'s1')]:[]});
  }
  if(endpoint.endsWith('/search'))return Response.json({results:[
   {url:job,title:'内容运营 - 云禾文化有限公司',
    snippet:'招聘企业官网岗位职责、任职要求及投递入口'},
   {url:home,title:'云禾文化有限公司官方网站',snippet:'企业业务及招聘'},
  ]});
  if(endpoint.endsWith('/fetch')){
   const u=JSON.parse(opts.body).url;
   if(u===job)return Response.json({title:'内容运营 - 云禾文化有限公司',content:jd()});
   if(u===home)return Response.json({title:'云禾文化有限公司',
    content:('# 云禾文化有限公司\n云禾文化有限公司官方网站，关于我们与人才招聘。').repeat(7)});
  }
  throw Error('UNEXPECTED_FETCH');
 };
 const browserRenderer=async url=>{
  assert.equal(url,job);renderCalls++;
  return {title:'内容运营 - 云禾文化有限公司',content:jd('北京')};
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now,
  targetCount:1,browserRenderer});
 assert.equal(got.stats.verified,1);
 assert.equal(got.candidates[0]?.location,'北京');
 assert.equal(got.candidates[0]?.source_status,'OFFICIAL_DETAIL_FETCHED');
 assert.deepEqual(got.stats.browser_render,{attempts:1,recovered:1,failures:0});
 assert.equal(renderCalls,1);
 assert.ok(got.usage.model<=4&&got.usage.search<=8&&got.usage.fetch<=20);
 assert.equal(got.accounting.browser_attempts,1);
 assert.equal(got.accounting.complete,false);
 assert.equal(got.accounting.browser_cost_estimate_cny,null);
});

test('Closed vacancy never triggers browser rescue to reopen a known-expired job',async()=>{
 let m=0,renders=0;
 const fetcher=async(endpoint,opts)=>{
  if(endpoint.endsWith('/responses')){
   m++;return Response.json({status:'completed',
    usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:40},
    output:m===1?[tool('search_jobs',{query:'内容运营 北京 官方招聘'},'s1')]:[]});
  }
  if(endpoint.endsWith('/search'))return Response.json({results:[
   {url:job,title:'内容运营 - 云禾文化有限公司',snippet:'工作地点：北京 任职要求：本科'}
  ]});
  if(endpoint.endsWith('/fetch'))return Response.json({
   title:'内容运营',content:jd('北京')+'\n职位已关闭'});
  throw Error('unexpected');
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now,targetCount:1,
  browserRenderer:async()=>{renders++;return {title:'内容运营',content:jd('北京')};}});
 assert.equal(got.stats.verified,0);
 assert.equal(got.stats.browser_render.attempts,0);
 assert.equal(renders,0);
});

test('Public Feishu ATS job may render, but only verified employer backlink establishes official status',async()=>{
 const ats='https://anker-in.jobs.feishu.cn/index/position/7418141743487945014/detail';
 const site='https://www.anker.com/';
 const corp='安克创新科技股份有限公司';
 const full=[
  '# 内容运营','招聘单位：'+corp,'工作地点：深圳',
  '岗位职责','负责企业新媒体内容策划、品牌传播及视频号账号运营。'.repeat(5),
  '任职要求','本科及以上学历，熟悉内容运营与渠道项目协作。'.repeat(5),
  '立即申请'
 ].join('\n');
 let models=0,searches=0,renderCount=0,fetches=0;
 const source=async(uri,opts)=>{
  const data=JSON.parse(opts.body);
  if(uri.endsWith('/responses')){
   models++;return Response.json({status:'completed',
    usage:{input_tokens:310,input_tokens_details:{cached_tokens:50},output_tokens:65},
    output:models===1?[tool('search_jobs',{query:'内容运营 深圳 企业官方招聘'},'s1')]:[]});
  }
  if(uri.endsWith('/search')){
   searches++;
   return Response.json({results:searches===1?[{
    url:ats,title:'内容运营 - '+corp,snippet:'岗位职责、任职资格、工作地点请见招聘详情'
   }]:[{
    url:site,title:corp+' 官方网站',snippet:corp+' 招聘职位与公司介绍'
   }]});
  }
  if(uri.endsWith('/fetch')){
   fetches++;
   if(data.url===ats)return Response.json({title:'内容运营 - '+corp,
    content:full.replace('工作地点：深圳','工作地点：待定')});
   if(data.url===site)return Response.json({title:corp,
    content:('# '+corp+'\n'+corp+' 官网人才招聘与企业信息。').repeat(5)+
      '\n[人才招聘职位]('+ats+')'});
  }
  throw Error('UNEXPECTED_MOCK_REQUEST');
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{
  fetcher:source,now,targetCount:1,
  browserRenderer:async url=>{
   assert.equal(url,ats);renderCount++;
   return {title:'内容运营 - '+corp,content:full};
  }
 });
 assert.equal(got.stats.verified,1);
 assert.equal(got.candidates[0]?.company,corp);
 assert.equal(got.candidates[0]?.location,'深圳');
 assert.equal(got.candidates[0]?.source_verification,'CORPORATE_EXACT_JOB_LINK');
 assert.equal(renderCount,1);
 assert.deepEqual(got.stats.browser_render,{attempts:1,recovered:1,failures:0});
 assert.equal(got.accounting.complete,false,'browser usage has separate unpriced cost');
 assert.ok(models<=4&&searches<=8&&fetches<=20);
});

test('Genuine employer recruiting homepage can be Browser Run corroborated after DeepSeek corporate Fetch failure',async()=>{
 const url='https://careers.tencent.com/jobdesc.html?postId=2100785142443454464';
 const corporate='https://careers.tencent.com/';
 const localized='https://careers.tencent.com/zh-cn';
 const md=[
  '# 内容运营','工作地点：上海','岗位职责',
  '负责官方内容运营、直播活动策划和传播项目管理。'.repeat(5),
  '岗位要求','本科及以上学历，熟悉内容渠道、运营数据分析和项目协作。'.repeat(5),
  '申请岗位'
 ].join('\n');
 let model=0,search=0,fetch=0;
 const renderUrls=[];
 const mock=async(endpoint,opt)=>{
  const data=JSON.parse(opt.body);
  if(endpoint.endsWith('/responses')){
   model++;return Response.json({status:'completed',
    usage:{input_tokens:150,input_tokens_details:{cached_tokens:30},output_tokens:90},
    output:model===1?[tool('search_jobs',{query:'内容运营 企业官网 上海 任职要求'},'s1')]:
      model===2?[tool('read_job',{url},'r1')]:[]});
  }
  if(endpoint.endsWith('/search')){
   search++;return Response.json({results:[
    {url,title:'内容运营 | 腾讯招聘',snippet:'岗位职责、工作城市与任职要求，详见职位详情'}
   ]});
  }
  if(endpoint.endsWith('/fetch')){
   fetch++;if(data.url===url)return Response.json({title:'岗位详情 | 腾讯招聘',
    content:md.replace('工作地点：上海','工作地点：待定')});
   if(data.url===corporate)throw Error('SYNTHETIC_DEEPSEEK_FETCH_UNAVAILABLE');
   throw Error('Unanticipated corporate site '+data.url);
  }
  throw Error('Unexpected provider request');
 };
 const rendered=async target=>{
  renderUrls.push(target);
  if(target===url)return {title:'岗位详情 | 腾讯招聘',content:md};
  if(target===localized)return {title:'首页 | 腾讯招聘',
   content:('# 腾讯招聘\n欢迎来到腾讯官方招聘网站，职位查询及企业信息。').repeat(8)};
  throw Error('Browser must only read company-owned HTTPS');
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{
  fetcher:mock,now,targetCount:1,browserRenderer:rendered});
 assert.equal(got.quality_status,'VERIFIED_JOBS_FOUND');
 assert.equal(got.candidates[0].company,'腾讯');
 assert.equal(got.candidates[0].location,'上海');
 assert.equal(got.candidates[0].employer_site,localized);
 assert.equal(got.candidates[0].source_verification,'CORPORATE_DOMAIN_AND_BRAND');
 assert.deepEqual(renderUrls,[url,localized]);
 assert.deepEqual(got.stats.browser_render,{attempts:2,recovered:2,failures:0});
 assert.equal(got.accounting.complete,false);
 assert.ok(got.usage.model<=4&&got.usage.search<=8&&got.usage.fetch<=20);
});
