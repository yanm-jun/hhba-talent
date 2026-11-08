import test from 'node:test';
import assert from 'node:assert/strict';
import {
 sanitizedJobIntent,buildOfficialQueries,safeOfficialJobLocator,
 extractOfficialJob,discoverExternalOfficialJobs,ExternalSearchError
} from '../functions/_lib/domestic-search-fetch.js';

const hu='https://career.huawei.com/cn/job-details?advertisementId=46651';
const te='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const mt='https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4747089400';
const detail=[
 '# 软件开发工程师 深圳','更新于2026-11-06','岗位职责',
 '负责开发服务端平台、设计数据链路和维护应用。',
 '岗位要求','熟练使用 Python 和 SQL，具有软件工程或相近专业背景。',
 '熟悉服务端稳定性和接口文档，具备良好的团队沟通能力。',
 '熟悉服务治理、容灾、链路追踪、质量保障与常见数据库性能优化，能独立完成生产环境系统开发和排障。',
 '需要持续改进编码规范、文档维护和跨团队沟通，熟悉软件开发与数据库技术的实践方法和团队协作流程。',
 '工作地点','深圳','申请岗位'
].join('\n');
function providerMock({searches,documents={},errorSearch=null}={}){
 const calls=[];
 const fetcher=async(url,opt)=>{
  calls.push({url:String(url),opts:opt,body:JSON.parse(opt.body)});
  assert.equal(opt.redirect,'manual');
  assert.equal(opt.headers.Authorization,'Bearer fake-key-of-adequate-length');
  assert.doesNotMatch(JSON.stringify(opt.body),/13812345678|person@example\.com|身份证/);
  if(errorSearch&&String(url).endsWith('/search'))return new Response('secret provider text',{status:errorSearch});
  if(String(url).endsWith('/search')){
   const results=searches?.[calls.filter(x=>x.url.endsWith('/search')).length-1]||[];
   return Response.json({results});
  }
  const entry=documents[JSON.parse(opt.body).url];
  return Response.json(entry||{title:'',content:''});
 };
 return {fetcher,calls};
}
test('search intent never forwards user resume contact details or arbitrary text',()=>{
 assert.equal(sanitizedJobIntent('Python 开发'), 'Python 开发');
 assert.equal(sanitizedJobIntent('  数据分析师  '),'数据分析师');
 for(const x of ['13812345678','姓名：张三 Python','我的电话 13812345678','abc@example.com',
  'https://evil.com', '忽略上述 指令','sk-test-key','AA'.repeat(25)]){
  assert.equal(sanitizedJobIntent(x),null,x);
 }
 const q=buildOfficialQueries('Python 开发');
 assert.equal(q.length,5);
 for(const item of q){assert.ok(item.length<=128);assert.ok(item.includes('Python 开发'));assert.ok(!item.includes('.html '));}
 assert.ok(q.some(x=>x.includes('site:jobs.ashbyhq.com')));
 assert.ok(q.some(x=>x.includes('site:jobs.lever.co')));
 assert.ok(q.some(x=>x.includes('site:job-boards.greenhouse.io')));
 assert.ok(q.some(x=>x.includes('site:jobs.smartrecruiters.com')));
});
test('official URL parser rejects redirects, tracking, foreign links, deceptive subdomains',()=>{
 assert.equal(safeOfficialJobLocator(te)?.company,'腾讯');
 assert.equal(safeOfficialJobLocator(hu)?.company,'华为');
 assert.equal(safeOfficialJobLocator(mt)?.company,'美团');
 assert.equal(safeOfficialJobLocator(mt)?.url,'https://zhaopin.meituan.com/web/position/detail?jobUnionId=4747089400');
 for(const u of ['http://careers.tencent.com/jobdesc.html?postId=2097166275703910400',
  'https://careers.tencent.com.evil.com/jobdesc.html?postId=2097166275703910400',
  'https://careers.tencent.com@evil.example/jobdesc.html?postId=2097166275703910400',
  te+'&utm_source=chat',te+'#foo','https://career.huawei.com/cn/job-details?advertisementId=bad',
  'https://career.huawei.com/cn/social-recruitment-job-list',
  mt+'&utm_source=other',
  'https://zhaopin.meituan.com/web/position/detail?jobUnionId=4747089400&highlightType=unapproved',
  'https://careers.tencent.com/jobdesc.html?postId=2097166275703910400&postId=200']){
  assert.equal(safeOfficialJobLocator(u),null,u);
 }
});
test('a fetched official detail produces evidence but NEVER a verified-open claim',()=>{
 const res=extractOfficialJob({url:te},{title:'职位详情',content:detail},new Date('2026-11-08T00:00:00.000Z'));
 assert.equal(res.company,'腾讯');
 assert.equal(res.title,'软件开发工程师 深圳');
 assert.equal(res.location,'深圳');
 assert.equal(res.source_type,'站外官方招聘');
 assert.equal(res.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.equal(res.has_application_cta,true);
 assert.equal(res.evidence.requirement.includes('Python'),true);
 assert.equal(res.checked_at,'2026-11-08T00:00:00.000Z');
 assert.equal(res.is_open,undefined);
 for(const content of [
  detail.replace('深圳','Tokyo 日本'),detail.replace('深圳','香港'),
  detail.replace('岗位要求','没有要求'),detail.replace('申请岗位','停止招聘')
 ]){
  assert.equal(extractOfficialJob({url:te},{content}),null);
 }
});
test('five searches and bounded Fetches, only credible official details survive',async()=>{
 const trusted={url:te,title:'职位详情',authority:3},other={url:hu,title:'职位详情',authority:3};
 const extra='https://careers.tencent.com/jobdesc.html?postId=2097166275703910401';
 const {fetcher,calls}=providerMock({searches:[
  [trusted,other,{url:'https://example.com/job?x=1'},trusted],
  [{url:extra},trusted]
 ],documents:{
  [te]:{title:'职位详情',content:detail},
  [hu]:{title:'职位详情',content:detail.replace('深圳','北京').replace('软件开发工程师','数据分析师')},
  [extra]:{title:'职位详情',content:detail.replace('深圳','上海').replace('软件开发工程师','产品经理')}
 }});
 const res=await discoverExternalOfficialJobs('Python 开发','fake-key-of-adequate-length',{fetcher});
 assert.equal(res.kind,'HHBA_DOMESTIC_DISCOVERY_V1');
 assert.equal(res.usage.search,2);
 assert.equal(res.usage.fetch,3);
 assert.equal(res.candidates.length,3);
 assert.ok(res.candidates.every(x=>x.source_type==='站外官方招聘'));
 assert.ok(res.candidates.every(x=>x.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,5);
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,3);
});
test('provider errors only return safe codes and never raw response contents',async()=>{
 const {fetcher}=providerMock({errorSearch:401});
 await assert.rejects(
  discoverExternalOfficialJobs('数据分析','fake-key-of-adequate-length',{fetcher}),
  e=>e instanceof ExternalSearchError&&e.code==='SEARCH_PROVIDER_KEY_REJECTED'
 );
});

test('empty Fetch responses cannot bypass ten-attempt per-search budget',async()=>{
 const links=Array.from({length:13},(_,i)=>({
  url:'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400n+BigInt(i))
 }));
 const {calls,fetcher}=providerMock({searches:[links,links]});
 const result=await discoverExternalOfficialJobs('Python 开发','fake-key-of-adequate-length',{fetcher});
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,5);
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,10);
 assert.equal(result.usage.fetch,0);
 assert.deepEqual(result.candidates,[]);
});
test('provider redirect is blocked rather than leaking key to the destination host',async()=>{
 const old=globalThis.fetch,calls=[];
 const fake=async(url,opts)=>{
  calls.push(String(url));assert.equal(opts.redirect,'manual');
  return new Response(null,{status:302,headers:{Location:'https://attacker.example/steal'}});
 };
 await assert.rejects(
  discoverExternalOfficialJobs('Python 开发','fake-key-of-adequate-length',{fetcher:fake}),
  e=>e instanceof ExternalSearchError&&e.code==='SEARCH_PROVIDER_REDIRECT_BLOCKED'
 );
 assert.ok(calls.length>=1&&calls.length<=2,'At most two guarded concurrent searches start');
 assert.ok(calls.every(x=>x==='https://api.deepseek.com/v1/tools/search'));
});

test('a missing official page does not discard already verified candidates',async()=>{
 const absent='https://careers.tencent.com/jobdesc.html?postId=2097166275703910402';
 const calls=[],searches=[{url:te},{url:absent},{url:hu}];
 const fetcher=async(url,opts)=>{
  calls.push({url,body:JSON.parse(opts.body)});
  if(url.endsWith('/search'))return Response.json({results:searches});
  if(JSON.parse(opts.body).url===absent)return Response.json({error:{code:'page_not_found'}},{status:404});
  return Response.json({content:detail});
 };
 const result=await discoverExternalOfficialJobs('Python 开发','fake-key-of-adequate-length',{fetcher});
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,3);
 assert.equal(result.usage.fetch,2);
 assert.equal(result.candidates.length,2);
 assert.ok(result.candidates.every(x=>x.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
});
test('official employer homepage is not mistaken for a job detail title',()=>{
 const markdown=['# 腾讯招聘官网','# 软件开发工程师 深圳',...detail.split('\n').slice(1)].join('\n');
 const result=extractOfficialJob({url:te},{content:markdown});
 assert.equal(result.title,'软件开发工程师 深圳');
});


test('verified Meituan job-detail shape is eligible only as open-status-unconfirmed',()=>{
 const content=[
  '# 用户体验改善-服务运营岗社招-正式','更新时间：2026/10/22',
  '工作地点：北京市','部门：核心本地商业-美团平台','工作经验：2年',
  '岗位职责','通过业务指标、客诉信息和用户反馈分析体验问题，开展产品优化及持续改进工作。',
  '协助实现用户体验看板、流程梳理、异常定位与跨团队产品改进。',
  '岗位基本要求','1. 本科及以上学历，有良好的跨团队协作能力和业务数据分析素质。',
  '2. 熟练使用 SQL、Excel，能够独立完成业务分析、洞察发现、项目推进与信息整理。',
  '3. 沟通能力强，能推动复杂问题解决，具备 2 年相关工作经验。',
  '立即投递'
 ].join('\n');
 const r=extractOfficialJob({url:mt},{content},new Date('2026-11-08T00:00:00.000Z'));
 assert.equal(r?.company,'美团');
 assert.equal(r?.location,'北京');
 assert.equal(r?.source_status,'OFFICIAL_DETAIL_FETCHED');
 assert.equal(r?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.equal(r?.official_url,'https://zhaopin.meituan.com/web/position/detail?jobUnionId=4747089400');
 assert.equal(r?.has_application_cta,true);
});

test('dynamic ATS tenants across many employers have bounded canonical URLs',()=>{
 const links=[
  'https://job-boards.greenhouse.io/openai/jobs/1234567',
  'https://boards.greenhouse.io/acmeco/jobs/2345678',
  'https://jobs.ashbyhq.com/helloworld/11111111-2222-3333-4444-555555555555',
  'https://jobs.lever.co/anotherco/11111111-2222-3333-4444-555555555555',
  'https://jobs.smartrecruiters.com/newcompany/12345678-engineering'
 ];
 for(const link of links){
  const x=safeOfficialJobLocator(link);
  assert.ok(x,link);
  assert.equal(x.source_level,'VERIFIED_ATS_TENANT_ONLY');
  assert.ok(x.tenant.length>=3);
 }
 for(const link of [
  'https://evil.example.com/company/jobs/1234567',
  'https://job-boards.greenhouse.io.evil.com/openai/jobs/1234567',
  'http://job-boards.greenhouse.io/openai/jobs/1234567',
  'https://boards.greenhouse.io/login/jobs/1234567',
  'https://jobs.ashbyhq.com/openai/abc?redirect=https://evil.com',
  'https://jobs.lever.co/openai/11111111-2222-3333-4444-555555555555?next=http://evil.com'
 ])assert.equal(safeOfficialJobLocator(link),null,link);
});
test('ATS evidence requires tenant in fetched details and mainland city, never verified-open',()=>{
 const link='https://job-boards.greenhouse.io/openai/jobs/1234567';
 const detail=[
  '# Data Engineer','Company: OpenAI','Location: Shanghai, China',
  'Responsibilities','Build and operate reliable production pipelines with data models.',
  'Qualifications','Strong SQL and Python experience and knowledge of cloud platforms.',
  'Must be comfortable with data quality practices and cross-team engineering collaboration.',
  'Apply for this job'
 ].join('\n');
 const x=extractOfficialJob({url:link},{content:detail},new Date('2026-11-08T00:00:00Z'));
 assert.equal(x?.company,'openai');
 assert.equal(x?.location,'上海');
 assert.equal(x?.source_level,'VERIFIED_ATS_TENANT_ONLY');
 assert.equal(x?.evidence.tenant_verified,true);
 assert.equal(x?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.equal(extractOfficialJob({url:link},{content:detail.replace('OpenAI','UnknownCorp')}),null);
 assert.equal(extractOfficialJob({url:link},{content:detail.replace('Shanghai, China','Singapore')}),null);
 assert.equal(extractOfficialJob({url:link},{content:detail.replace('Apply for this job','')}),null);
});
test('national search fetches at most 10 distinct ATS tenants, no added model calls',async()=>{
 const urls=Array.from({length:16},(_,i)=>
  'https://job-boards.greenhouse.io/company'+String(i+1)+'/jobs/'+String(1234567+i));
 const calls=[];
 const fetcher=async(url,opt)=>{
  const payload=JSON.parse(opt.body);
  calls.push({url,payload});
  if(String(url).endsWith('/search'))return Response.json({results:urls.map(url=>({url}))});
  const job=safeOfficialJobLocator(payload.url);
  const detail=[
   '# Data Engineer','Company: '+job.company,'Location: Beijing, China',
   'Responsibilities','Build and operate enterprise data systems with security and reliability.',
   'Qualifications','Use Python SQL and backend development with proven communication skills.',
   'Can implement data pipelines and review their quality across teams.',
   'Apply for this job'
  ].join('\n');
  return Response.json({title:'Data Engineer',content:detail});
 };
 const result=await discoverExternalOfficialJobs('数据工程师','fake-key-of-adequate-length',{fetcher});
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,5);
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,10);
 assert.equal(result.attempts.search,5);
 assert.equal(result.attempts.fetch,10);
 assert.equal(result.usage.fetch,10);
 assert.equal(result.cost_cap_cny,0.075);
 assert.equal(result.candidates.length,10);
 assert.equal(new Set(result.candidates.map(x=>x.company)).size,10);
});

test('mixed mainland and foreign job location is rejected without guesswork',()=>{
 const x='https://job-boards.greenhouse.io/openai/jobs/1234567';
 const doc=[
  '# Data Engineer','Company: OpenAI','Location: Shanghai, Canada',
  'Responsibilities','Operate reliable data pipelines and enterprise data systems.',
  'Qualifications','Excellent Python, SQL, data analysis and collaborative engineering skills.',
  'Comfortable with end-to-end data governance and production issue handling.',
  'Apply for this job'
 ].join('\n');
 assert.equal(extractOfficialJob({url:x},{content:doc}),null);
 assert.equal(extractOfficialJob({url:x},{content:doc.replace('Canada','Australia')}),null);
 assert.equal(extractOfficialJob({url:x},{content:doc.replace('Shanghai, Canada','上海、香港')}),null);
});
