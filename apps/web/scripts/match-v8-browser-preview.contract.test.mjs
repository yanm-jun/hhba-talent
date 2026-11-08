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

test('Browser fallback disabled by default and requires preview-specific credentials',()=>{
 const vars={HHBA_AUTH_ROLLOUT:'preview',
  HHBA_BROWSER_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
  HHBA_BROWSER_RENDER_TOKEN:'synthetic-token-for-unit-test'};
 assert.equal(previewJobBrowserRenderer(vars),null);
 assert.equal(previewJobBrowserRenderer({...vars,HHBA_AUTH_ROLLOUT:'production',
  HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1'}),null);
 assert.equal(previewJobBrowserRenderer({...vars,HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  HHBA_BROWSER_RENDER_TOKEN:''}),null);
 assert.equal(typeof previewJobBrowserRenderer({...vars,
  HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1'}),'function');
});

test('Preview browser reader only calls the fixed Cloudflare endpoint with safe bounded URL and no cookies',async()=>{
 const calls=[],env={HHBA_AUTH_ROLLOUT:'preview',HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED:'1',
  HHBA_BROWSER_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
  HHBA_BROWSER_RENDER_TOKEN:'synthetic-token-for-unit-test'};
 const fetcher=async(endpoint,options)=>{
  calls.push({endpoint,method:options.method,redirect:options.redirect,
   headers:options.headers,body:JSON.parse(options.body)});
  return Response.json({success:true,result:{markdown:'---\ntitle: "内容运营 | 云禾文化有限公司"\n---\n'+jd('北京'),
   content:'<html><main>职位信息</main></html>'}});
 };
 const browser=previewJobBrowserRenderer(env,{fetcher});
 await assert.rejects(()=>browser('http://localhost/jobs/1234'),/BROWSER_BAD_URL/);
 await assert.rejects(()=>browser('https://127.0.0.1/jobs/1234'),/BROWSER_BAD_URL/);
 const result=await browser(job);
 assert.equal(result.title,'内容运营 | 云禾文化有限公司');
 assert.match(result.content,/工作地点：北京/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].endpoint,
  'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/browser-rendering/snapshot?cacheTTL=0');
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].redirect,'manual');
 assert.deepEqual(calls[0].body.formats,['content','markdown']);
 assert.equal(calls[0].body.url,job);
 assert.equal(calls[0].body.cookies,undefined);
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
