import test from 'node:test';
import assert from 'node:assert/strict';
import {
 sanitizedJobIntent,buildOfficialQueries,safeOfficialJobLocator,
 extractOfficialJob,discoverExternalOfficialJobs,prioritizeOfficialSearchCandidates,ExternalSearchError
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
 assert.equal(q.length,2);
 for(const item of q){assert.ok(item.length<=128);assert.ok(item.includes('Python 开发'));assert.ok(item.includes('site:'));assert.ok(!item.includes('.html '));}
 assert.ok(q[0].includes('site:careers.tencent.com OR site:zhaopin.meituan.com'));
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
test('two searches and at most three fetches, only official detail URLs survive',async()=>{
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
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,2);
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,3);
});
test('JD official posting is accepted only with an exact verified single-position URL',()=>{
 const link='https://zhaopin.jd.com/web/job-info-detail?requementId=227402';
 const locator=safeOfficialJobLocator(link);
 assert.equal(locator?.company,'京东');
 assert.equal(locator?.id,'zhaopin.jd.com:227402');
 for(const bad of [link+'&page=3','https://zhaopin.jd.com.evil.example/web/job-info-detail?requementId=227402',
  'https://zhaopin.jd.com/web/job-info-detail?requementId=abc',
  'https://zhaopin.jd.com/home?requementId=227402']){
  assert.equal(safeOfficialJobLocator(bad),null,bad);
 }
 const jd=['# 测试开发工程师','职位类型：研发类 工作地点：北京市 发布时间：2026-11-02',
 '岗位描述','岗位职责：开发自动化测试脚本，负责接口与性能测试；负责设计质量保障策略，构建自动化测试平台，参与研发需求评审、回归测试、线上稳定性监控、测试计划制定及跨团队协作，并针对质量指标持续优化开发流程。',
 '任职要求','本科及以上学历，具备 3 年软件工程测试开发经验。熟悉 Python 和 SQL，具备跨团队协作能力。',
 '立即申请'].join('\n');
 const extracted=extractOfficialJob({url:link},{content:jd},new Date('2026-11-08T00:00:00Z'));
 assert.equal(extracted?.company,'京东');
 assert.equal(extracted?.location,'北京');
 assert.equal(extracted?.has_application_cta,true);
 assert.equal(extracted?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
});

test('Baidu SOCIAL official job UUID is verified; login is NOT verified-open',async()=>{
 const social='https://talent.baidu.com/jobs/detail/SOCIAL/bd46ce5b-f5ae-4e97-9e25-80b851e30f12';
 const loc=safeOfficialJobLocator(social);
 assert.equal(loc?.company,'百度');
 assert.equal(loc?.id,'talent.baidu.com:bd46ce5b-f5ae-4e97-9e25-80b851e30f12');
 for(const bad of [
  social+'?utm_source=x',social+'#fragment',
  social.replace('/SOCIAL/','/INTERN/'),
  social.replace('talent.baidu.com/','talent.baidu.com.attacker.example/'),
  'https://talent.baidu.com/jobs/',
  'http://talent.baidu.com/jobs/detail/SOCIAL/bd46ce5b-f5ae-4e97-9e25-80b851e30f12'
 ])assert.equal(safeOfficialJobLocator(bad),null,bad);
 const jd=[
  '# 数据产品经理（J86847）','登录','MEG','MEG北京市产品1人2026-07-21',
  '工作职责：','负责百度搜索业务数据产品的规划、设计、开发、上线等全流程，并进行业务需求分析；',
  '与研发团队协作推动数据产品持续改进、优化用户体验、负责需求评审及质量交付。',
  '职责要求：','任职资格：本科及以上学历，具备1年以上数据产品相关经验，能够独立完成数据产品设计。',
  '熟悉数据产品开发流程，了解 SQL 和 Python，有 Spark 经验者优先，具备跨团队合作意识。'
 ].join('\n');
 const fetched=extractOfficialJob({url:social},{content:jd},new Date('2026-11-08T00:00:00Z'));
 assert.equal(fetched?.company,'百度');
 assert.equal(fetched?.location,'北京');
 assert.equal(fetched?.has_application_cta,false);
 assert.equal(fetched?.application_method,'OFFICIAL_DETAIL_LOGIN_REQUIRED');
 assert.equal(fetched?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.ok(fetched?.evidence.requirement.includes('1年以上数据产品相关经验'));
 const noLogin=extractOfficialJob({url:social},{content:jd.replace('登录','')},new Date('2026-11-08T00:00:00Z'));
 assert.equal(noLogin?.application_method,'DIRECT_CTA_UNVERIFIED');
 assert.equal(noLogin?.has_application_cta,false);
 const {fetcher,calls}=providerMock({
  searches:[[],[{url:social}],[],[]],
  documents:{[social]:{content:jd}}
 });
 const found=await discoverExternalOfficialJobs('数据产品经理','fake-key-of-adequate-length',
  {fetcher,expanded:true,now:new Date('2026-11-08T00:00:00Z')});
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,4);
 assert.ok(calls.filter(x=>x.url.endsWith('/search')).every(x=>!JSON.stringify(x.body).includes('resume')));
 assert.equal(found.candidates.length,1);
 assert.equal(found.candidates[0].company,'百度');
 assert.equal(found.candidates[0].has_application_cta,false);
});
test('three verified job directions use the same four search calls',()=>{
 const q=buildOfficialQueries(['Python 开发工程师','数据分析师','测试开发工程师'],true);
 assert.equal(q.length,4);
 assert.ok(q[0].includes('Python 开发'));
 assert.ok(q[1].includes('数据分析师'));
 assert.ok(q[2].includes('测试开发'));
 assert.ok(q[3].includes('Python 开发'));
 assert.ok(q.every(x=>x.length<=128));
 const sanitized=buildOfficialQueries(['数据分析师','姓名：张三','测试开发工程师'],true);
 assert.equal(sanitized.length,4);
 assert.ok(sanitized.every(x=>!x.includes('张三')));
 assert.deepEqual(buildOfficialQueries(['姓名：张三','https://evil.example'],true),[]);
});
test('expanded queries add Baidu official details without adding provider calls',()=>{
 const queries=buildOfficialQueries('数据产品经理',true);
 assert.equal(queries.length,4);
 assert.ok(queries.some(x=>x.includes('site:talent.baidu.com/jobs/detail/SOCIAL/')));
 assert.ok(queries.every(x=>x.length<=128));
});

test('provider errors only return safe codes and never raw response contents',async()=>{
 const {fetcher}=providerMock({errorSearch:401});
 await assert.rejects(
  discoverExternalOfficialJobs('数据分析','fake-key-of-adequate-length',{fetcher}),
  e=>e instanceof ExternalSearchError&&e.code==='SEARCH_PROVIDER_KEY_REJECTED'
 );
});

test('empty Fetch responses cannot bypass three-attempt per-search budget',async()=>{
 const links=Array.from({length:6},(_,i)=>({
  url:'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400n+BigInt(i))
 }));
 const {calls,fetcher}=providerMock({searches:[links,links]});
 const result=await discoverExternalOfficialJobs('Python 开发','fake-key-of-adequate-length',{fetcher});
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,2);
 assert.equal(calls.filter(x=>x.url.endsWith('/fetch')).length,3);
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
 assert.equal(calls.length,1);
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

test('one focused content-operations intent searches multiple safe same-career terms at unchanged cost',()=>{
 const queries=buildOfficialQueries(['内容运营','用户增长'],true);
 assert.equal(queries.length,4);
 assert.ok(queries[0].includes('内容运营'));
 assert.ok(queries[1].includes('新媒体运营'));
 assert.ok(queries[2].includes('内容策划'));
 assert.ok(queries[3].includes('短视频内容运营'));
 assert.ok(queries.every(x=>x.length<=128));
 assert.ok(queries.every(x=>!x.includes('销售顾问')&&!x.includes('用户增长')));
 const software=buildOfficialQueries('Python 开发',true);
 assert.equal(software.length,4);
 assert.ok(software.some(x=>x.includes('软件开发')));
 assert.ok(software.some(x=>x.includes('后端开发')));
});

test('expanded official Fetch never wastes budget on known off-target roles',async()=>{
 const first='2097166275703910400';
 const url=i=>'https://careers.tencent.com/jobdesc.html?postId='+
  String(BigInt(first)+BigInt(i));
 const results=[
  {url:url(1),title:'Machine Learning Engineer'},
  {url:url(2),title:'Treasury & Payment Analyst'},
  {url:url(3),title:'Revenue Strategy Operations Manager'},
  {url:url(4),title:'内容运营'},
  {url:url(5),title:'新媒体运营'},
  {url:url(6),title:'内容策划'},
  {url:url(7),title:'职位详情'}
 ];
 const selected=prioritizeOfficialSearchCandidates(results,['内容运营'],8);
 assert.deepEqual(selected.map(x=>x.url),[url(4),url(5),url(6)]);
 assert.equal(selected.every(x=>x.url.startsWith('https://careers.tencent.com/')),true);
 const backend=prioritizeOfficialSearchCandidates([
  {url:url(8),title:'Product Lead, AI-Native'},
  {url:url(9),title:'Software Engineer - Backend'},
  {url:url(10),title:'软件开发工程师'}
 ],['Python 开发工程师'],8);
 assert.deepEqual(backend.map(x=>x.url),[url(9),url(10)]);
});

test('Fetch unknown-title exploration is strictly bounded even with many official results',()=>{
 const rows=Array.from({length:30},(_,i)=>({
  url:'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400n+BigInt(i)),
  title:'职位详情'
 }));
 const kept=prioritizeOfficialSearchCandidates(rows,'Python 开发工程师',8);
 assert.equal(kept.length,2,'do not burn eight Fetch calls on generic headings');
 assert.ok(kept.every(x=>x.title==='职位详情'));
});

test('generic verified software-engineering titles are valid Search leads, not Product Leads',()=>{
 const first=2097166275703910400n;
 const uri=i=>'https://careers.tencent.com/jobdesc.html?postId='+String(first+BigInt(i));
 const rows=[
  {url:uri(3),title:'Product Lead, AI-Native'},
  {url:uri(4),title:'Software Engineer'},
  {url:uri(5),title:'Software Engineer - Backend'}
 ];
 const selected=prioritizeOfficialSearchCandidates(rows,'Python 开发',8);
 assert.deepEqual(selected.map(x=>x.url),[uri(5),uri(4)]);
});
