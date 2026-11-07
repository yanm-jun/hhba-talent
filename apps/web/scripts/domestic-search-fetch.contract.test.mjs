import test from 'node:test';
import assert from 'node:assert/strict';
import {
 sanitizedJobIntent,buildOfficialQueries,safeOfficialJobLocator,
 extractOfficialJob,discoverExternalOfficialJobs,ExternalSearchError
} from '../functions/_lib/domestic-search-fetch.js';

const hu='https://career.huawei.com/cn/job-details?advertisementId=46651';
const te='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const detail=[
 '# 软件开发工程师 深圳','更新于2026-11-06','岗位职责',
 '负责开发服务端平台、设计数据链路和维护应用。',
 '岗位要求','熟练使用 Python 和 SQL，具有软件工程或相近专业背景。',
 '熟悉服务端稳定性和接口文档，具备良好的团队沟通能力。',
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
 for(const item of q){assert.ok(item.length<=128);assert.ok(item.includes('Python 开发'));}
});
test('official URL parser rejects redirects, tracking, foreign links, deceptive subdomains',()=>{
 assert.equal(safeOfficialJobLocator(te)?.company,'腾讯');
 assert.equal(safeOfficialJobLocator(hu)?.company,'华为');
 for(const u of ['http://careers.tencent.com/jobdesc.html?postId=2097166275703910400',
  'https://careers.tencent.com.evil.com/jobdesc.html?postId=2097166275703910400',
  'https://careers.tencent.com@evil.example/jobdesc.html?postId=2097166275703910400',
  te+'&utm_source=chat',te+'#foo','https://career.huawei.com/cn/job-details?advertisementId=bad',
  'https://career.huawei.com/cn/social-recruitment-job-list',
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
test('provider errors only return safe codes and never raw response contents',async()=>{
 const {fetcher}=providerMock({errorSearch:401});
 await assert.rejects(
  discoverExternalOfficialJobs('数据分析','fake-key-of-adequate-length',{fetcher}),
  e=>e instanceof ExternalSearchError&&e.code==='SEARCH_PROVIDER_KEY_REJECTED'
 );
});
