import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverOfficialRecruitmentLinks,LINK_DISCOVERY_LIMITS} from
 '../functions/_lib/official-recruitment-link-navigation.js';
import {publicCorporatePage,publicJobLink} from
 '../functions/_lib/deepseek-official-job-agent.js';

const key='synthetic-test-key-nothing-personal';
const now=new Date('2026-11-09T06:00:00Z');
function makeProvider({results=[],pages={},errorSearch=false,byRole=null}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer '+key);
  const body=JSON.parse(options.body);
  calls.push({endpoint:url.endsWith('/search')?'search':'fetch',body});
  if(url.endsWith('/search')){
   if(errorSearch)return Response.json({error:'OFFLINE'},{status:503});
   const selected=byRole?Object.entries(byRole).find(([role])=>body.query.includes(role))?.[1]||[]:results;
   return Response.json({results:selected});
  }
  if(url.endsWith('/fetch')){
   if(!Object.hasOwn(pages,body.url))return Response.json({error:'NOT_FOUND'},{status:404});
   return Response.json(pages[body.url]);
  }
  throw Error('No model endpoint is allowed in link-first mode');
 };
 return {fetcher,calls};
}
const homepage=(company)=>({
 title:company+' 招聘',
 content:'# '+company+'\n人才招聘｜社会招聘｜岗位介绍\n'+
  ('欢迎加入'+company+'，查看公开招聘岗位并申请就业机会。').repeat(10)
});
test('Link-first result: official job direct and careers entry, no JD or fabricated score',async()=>{
 const job='https://careers.tencent.com/jobdesc.html?postId=2094968965272092672';
 const another='https://www.xinghe.cn/careers';
 const source='https://careers.tencent.com/';
 const mock=makeProvider({results:[
  {url:job,title:'内容运营岗位 - 腾讯招聘',snippet:'社会招聘 · 上海 · 内容运营'},
  {url:source,title:'腾讯招聘',snippet:'腾讯公开招聘网站'},
  {url:another,title:'星河科技官方招聘',snippet:'内容运营方向'},
  {url:'https://www.zhipin.com/job_detail/abc.html',title:'内容运营',snippet:'第三方'}
 ],pages:{
  [source]:homepage('腾讯'),
  [another]:homepage('星河数字科技有限公司')
 }});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{
  fetcher:mock.fetcher,now,limit:10});
 assert.equal(result.quality_status,'VERIFIED_SOURCE_LINKS');
 assert.equal(result.opportunities.length,2);
 assert.ok(result.opportunities.some(x=>x.kind==='JOB_DETAIL'&&x.url===job));
 assert.ok(result.opportunities.some(x=>x.kind==='CAREERS_ENTRY'&&x.url===another));
 assert.ok(result.opportunities.every(x=>x.qualification_status==='NOT_CHECKED'&&
  x.hiring_status==='UNCONFIRMED'&&x.workplace.includes('官网')));
 assert.ok(result.opportunities.every(x=>x.reference_score===undefined&&
  x.success_rate===undefined&&x.location===undefined));
 assert.ok(mock.calls.every(x=>x.endpoint!=='model'));
 assert.ok(mock.calls.filter(x=>x.endpoint==='fetch').every(x=>
  [source,another].includes(x.body.url)));
 assert.equal(result.usage.model,0);
 assert.ok(result.usage.search<=3&&result.usage.fetch<=6);
 assert.equal(result.accounting.billable.fetch,2);
});
test('Shared Feishu ATS job is exposed only when the FETCHED corporate page links to that exact tenant',async()=>{
 const job='https://anker-in.jobs.feishu.cn/index/position/7418141743487945014/detail';
 const official='https://www.anker.com/careers';
 const page=homepage('安克创新科技股份有限公司');
 page.content+='\n[企业官方招聘](https://anker-in.jobs.feishu.cn/index/position/7418141743487945014/detail)';
 const good=makeProvider({results:[
  {url:job,title:'内容运营 · 安克创新',snippet:'企业招聘平台'},
  {url:official,title:'安克创新科技股份有限公司招聘',snippet:'官方职位入口'}
 ],pages:{[official]:page}});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:good.fetcher,now});
 assert.equal(result.opportunities.length,1);
 assert.equal(result.opportunities[0].kind,'JOB_DETAIL');
 assert.equal(result.opportunities[0].url,job);
 assert.equal(result.opportunities[0].source_evidence,'CORPORATE_EXACT_JOB_LINK');
 assert.equal(publicCorporatePage('https://anker-in.jobs.feishu.cn/'),null);
 assert.ok(publicJobLink(job));
 const bad=makeProvider({results:[
  {url:job,title:'内容运营 · 安克创新'},
  {url:official,title:'安克创新科技股份有限公司官网招聘'}
 ],pages:{[official]:homepage('安克创新科技股份有限公司')}});
 const unproven=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:bad.fetcher,now});
 assert.equal(unproven.opportunities.length,1);
 assert.equal(unproven.opportunities[0].kind,'CAREERS_ENTRY');
 assert.equal(unproven.opportunities[0].url,official);
});
test('Search-only, foreign or third-party links do not become verified careers entries',async()=>{
 const results=[
  {url:'https://careers.xinghe.cn/jobs/2026110901',title:'内容运营 中国'},
  {url:'https://www.zhipin.com/jobs/2026110901',title:'内容运营 北京'},
  {url:'https://careers.abc.cn/',title:'招聘平台招聘网站',snippet:'内容运营'},
  {url:'https://careers.bad.cn/',title:'内容运营 日本 东京'}
 ];
 const mock=makeProvider({results,pages:{
  'https://careers.abc.cn/':{
   title:'全国求职招聘平台',content:('附近工作，招聘网站，招聘职位推荐。').repeat(12)}
 }});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:mock.fetcher,now});
 assert.equal(result.opportunities.length,0);
 assert.equal(result.quality_status,'NO_VERIFIED_OFFICIAL_LINKS');
 assert.ok(mock.calls.filter(c=>c.endpoint==='fetch').length<=6);
});
test('Provider failure does not invent company links, cost is bounded',async()=>{
 const mock=makeProvider({errorSearch:true});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:mock.fetcher,now});
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.opportunities.length,0);
 assert.equal(result.accounting.complete,false);
 assert.deepEqual(result.usage,{model:0,search:3,fetch:0});
 assert.equal(LINK_DISCOVERY_LIMITS.fetch,6);
});
test('Only normalized role queries are sent; no resume text, name, email or API key in payload',async()=>{
 const mock=makeProvider({results:[]});
 await discoverOfficialRecruitmentLinks(['内容运营','不符合职业'],key,{fetcher:mock.fetcher,now});
 for(const c of mock.calls){
  assert.ok(c.endpoint==='search');
  assert.match(c.body.query,/内容运营/);
  assert.doesNotMatch(JSON.stringify(c.body),/(?:@|手机号|身份证|password|sk-)/i);
 }
 assert.equal((await discoverOfficialRecruitmentLinks('test@example.com',key,{
  fetcher:mock.fetcher,now})).status,'NOT_READY');
});

test('All three career intents get a fair Search and company Fetch opportunity',async()=>{
 const tencent='https://careers.tencent.com/';
 const job='https://careers.tencent.com/jobdesc.html?postId=2094968965272092672';
 const xinghe='https://www.xinghe.cn/careers';
 const horizon='https://www.horizon.cn/careers';
 const mock=makeProvider({byRole:{
  '内容运营':[
   {url:job,title:'内容运营 - 腾讯招聘',snippet:'中国 社会招聘'},
   {url:tencent,title:'腾讯招聘',snippet:'企业招聘'}
  ],
  '软件开发':[{url:xinghe,title:'星河科技官方招聘',snippet:'软件开发'}],
  '数据分析师':[{url:horizon,title:'地平线科技官方招聘',snippet:'数据分析'}]
 },pages:{
  [tencent]:homepage('腾讯'),
  [xinghe]:homepage('星河数字科技有限公司'),
  [horizon]:homepage('地平线科技有限公司')
 }});
 const result=await discoverOfficialRecruitmentLinks(
  ['内容运营','软件开发','数据分析师'],key,{fetcher:mock.fetcher,now});
 const searches=mock.calls.filter(x=>x.endpoint==='search');
 assert.equal(searches.length,3);
 for(const role of ['内容运营','软件开发','数据分析师'])
  assert.ok(searches.some(s=>s.body.query.includes(role)),role+' not searched');
 assert.equal(result.usage.model,0);
 assert.ok(result.usage.fetch<=6);
 assert.deepEqual(new Set(result.opportunities.map(x=>x.role)),
  new Set(['内容运营','软件开发','数据分析师']));
 assert.ok(result.opportunities.some(x=>
  x.kind==='JOB_DETAIL'&&x.url===job&&x.role==='内容运营'));
 assert.ok(result.opportunities.every(x=>
  x.qualification_status==='NOT_CHECKED'&&x.hiring_status==='UNCONFIRMED'));
});

test('Realistic Tencent, Xiaomi, Anker career subpages reveal only fetched same-host homepages',async()=>{
 const sourceLinks=[
  'https://careers.tencent.com/jobopportunity.html',
  'https://hr.xiaomi.com/website/campus.html',
  'https://career.anker.com.cn/universities/recruitment/'
 ];
 const pages={
  'https://careers.tencent.com/':homepage('腾讯'),
  'https://hr.xiaomi.com/':homepage('小米'),
  'https://career.anker.com.cn/':homepage('安克创新')
 };
 const mock=makeProvider({results:[
  {url:sourceLinks[0],title:'社会招聘 | 腾讯招聘',snippet:'公开社会招聘'},
  {url:sourceLinks[1],title:'校园招聘 | 小米招聘',snippet:'企业招聘项目'},
  {url:sourceLinks[2],title:'安克创新招聘项目',snippet:'加入安克创新'},
  {url:'https://www.zhipin.com/job_detail/123.html',title:'内容运营 招聘',snippet:'聚合职位'},
  {url:'https://jobspam.cn/careers',title:'招聘网站 全职找工作',snippet:'全国招聘平台'}
 ],pages:{
  ...pages,
  'https://jobspam.cn/':{title:'全国求职招聘网站',
   content:('找工作、附近工作、招聘平台、求职招聘平台。').repeat(12)}
 }});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{
  fetcher:mock.fetcher,now});
 const links=result.opportunities.filter(x=>x.kind==='CAREERS_ENTRY');
 assert.deepEqual(new Set(links.map(x=>x.url)),
  new Set(Object.keys(pages)));
 assert.equal(links.length,3);
 assert.equal(result.quality_status,'VERIFIED_SOURCE_LINKS');
 assert.ok(links.every(x=>x.qualification_status==='NOT_CHECKED'));
 assert.ok(!result.opportunities.some(x=>sourceLinks.includes(x.url)));
 assert.ok(!result.opportunities.some(x=>x.url.includes('jobspam')||x.url.includes('zhipin.com')));
 assert.ok(mock.calls.filter(x=>x.endpoint==='fetch').length<=6);
});

test('Direct employer recruitment subpages are fetched and kept as useful navigation links',async()=>{
 const paths=[
  ['https://careers.tencent.com/jobopportunity.html','腾讯'],
  ['https://hr.xiaomi.com/website/campus.html','小米'],
  ['https://career.anker.com.cn/universities/recruitment/','安克创新']
 ];
 const pages=Object.fromEntries(paths.map(([url,brand])=>[url,homepage(brand)]));
 const mock=makeProvider({results:paths.map(([url,brand])=>({
  url,title:brand+' 招聘官网',snippet:'内容运营方向 企业招聘入口'
 })),pages});
 const r=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:mock.fetcher,now});
 assert.equal(r.opportunities.length,3);
 assert.deepEqual(new Set(r.opportunities.map(x=>x.url)),
  new Set(paths.map(x=>x[0])));
 assert.ok(r.opportunities.every(x=>x.kind==='CAREERS_ENTRY'&&x.reference_score===undefined));
 assert.ok(mock.calls.filter(x=>x.endpoint==='fetch').length<=6);
});
test('Real title format strips recruiting portal boilerplate from employer names',async()=>{
 const url='https://hr.game.163.com/';
 const mock=makeProvider({results:[{url,title:'网易游戏 . 招聘门户',
  snippet:'内容运营 招聘 企业官网'}],pages:{[url]:{
  title:'网易游戏 . 招聘门户',
  content:'# 网易游戏\n社会招聘｜校园招聘｜岗位\n'+
   ('欢迎加入网易游戏，了解公开招聘岗位和申请入口。').repeat(12)
 }}});
 const result=await discoverOfficialRecruitmentLinks('内容运营',key,{fetcher:mock.fetcher,now});
 assert.equal(result.opportunities.length,1);
 assert.equal(result.opportunities[0].company,'网易游戏');
 assert.equal(result.opportunities[0].kind,'CAREERS_ENTRY');
 assert.equal(result.opportunities[0].hiring_status,'UNCONFIRMED');
});
