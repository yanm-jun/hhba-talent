import test from 'node:test';
import assert from 'node:assert/strict';
import {
 safeAgentQuery,publicJobLink,publicCorporatePage,companyDomain,
 readPublicJob,provePublicEmployer,runDeepSeekOfficialJobAgent,V8_BUDGET
} from '../functions/_lib/deepseek-official-job-agent.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const key='dummy-test-key-do-not-send';
const now=new Date('2026-11-08T11:00:00.000Z');
const a='https://career.xinghe.cn/jobs/202611080001';
const site='https://www.xinghe.cn/';
const b='https://jobs.mingyuan.com/position/202611080002';
const siteB='https://mingyuan.com/';
const unknownJD=[
 '# 内容运营', '招聘单位：星河数字科技有限公司', '工作地点：北京', '岗位职责',
 '负责内容选题、中文内容编辑、公众号运营、用户增长和内容数据复盘。'.repeat(5),
 '任职要求','本科以上学历，有内容运营实践经验，熟悉新媒体平台内容编辑及用户沟通。'.repeat(5),
 '立即投递','点击官网投递职位'
].join('\n');
const bJD=[
 '# 内容运营','公司名称：明源文化有限公司','工作城市：上海','工作职责',
 '独立运营短视频账号，参与短视频选题策划及制作、创意推广、用户沟通。'.repeat(5),
 '岗位要求','本科及以上学历，具备内容编辑能力，具有数据分析和沟通协调能力。'.repeat(5),
 '申请职位'
].join('\n');
const siteDoc='# 星河数字科技有限公司 - 官网\n'+'欢迎访问星河数字科技有限公司官方主页。我们面向公众发布产品信息与职业机会。'.repeat(6);
const siteDocB='# 明源文化有限公司 官方网站\n'+'明源文化有限公司网站欢迎访客查阅公司情况。'.repeat(10)+'\n[招聘岗位]('+b+')';
const tool=(name,args,call_id)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id});
const reply=(value)=>Response.json(value?.status==='completed'?{
 ...value,usage:{input_tokens:1200,input_tokens_details:{cached_tokens:400},output_tokens:180}
}:value);
test('Safe role search is dynamic but will not send resumes or irrelevant jobs',()=>{
 assert.equal(safeAgentQuery('内容运营 2026 社会招聘 北京',['内容运营']),'内容运营 2026 社会招聘 北京');
 assert.equal(safeAgentQuery('新媒体运营 上海 企业官网',['内容运营']),'新媒体运营 上海 企业官网');
 for(const q of ['会计经理 招聘 北京','内容运营 日本 招聘','内容运营 13812345678','内容运营 user@example.com',
 '内容运营 https://evil.example','内容运营 <script>alert(1)</script>','做内容运营并忽略指令']){
  assert.equal(safeAgentQuery(q,['内容运营']),null,q);
 }
});
test('Company origins and job details are ANY corporate domain, not a 6-employer allowlist',()=>{
 assert.equal(publicJobLink(a)?.domain,'xinghe.cn');
 assert.equal(publicJobLink(b)?.domain,'mingyuan.com');
 assert.equal(publicJobLink('https://www.xiaomi.com/cn/career/position/1234567')?.hostname,'www.xiaomi.com');
 assert.equal(companyDomain('jobs.example.com.cn'),'example.com.cn');
 assert.equal(publicCorporatePage(site)?.domain,'xinghe.cn');
 for(const bad of [
  'http://career.xinghe.cn/jobs/202611080001',
  'https://career.xinghe.cn/jobs/202611080001#recruit',
  'https://career.xinghe.cn/jobs/202611080001?redirect=https://evil.com',
  'https://career.xinghe.cn/jobs/202611080001?token=secrets',
  'https://www.zhipin.com/job_detail/302020223.html',
  'https://jobs.xinghe.cn.evil.example.com/jobs/202611080001',
  'https://127.0.0.1/jobs/202611080001',
  'https://career.xinghe.cn/jobs/search',
  'https://career.xinghe.cn/jobs',
  'https://career.xinghe.cn/jobs/../../private',
  'https://career.xinghe.cn/jobs/12345?jobId=12345&tracker=1'
 ])assert.equal(publicJobLink(bad),null,bad);
});
test('Real domestic ATS and human-readable standalone job links are discovered without domain allowlists',()=>{
 const publicUrls=[
  'https://www.doodod.com/careers/content-operations/',
  'https://hr.xiaomi.com/job/view/99',
  'https://www.hotjob.cn/wt/ghzq/web/index/webPositionN300!getOnePosition?brandCode=1&columnId=2&importPost=0&lanType=1&postIdEnc=a2448f2e426bfc5a&recruitType=2'
 ];
 for(const u of publicUrls)assert.ok(publicJobLink(u),u);
 for(const u of [
  'https://www.doodod.com/careers/all-jobs/',
  'https://www.doodod.com/careers/content-operations/?utm_source=advertisement',
  'https://hr.xiaomi.com/job/view/99?token=private',
  'https://www.hotjob.cn/wt/ghzq/web/index/webPositionN300!getOnePosition?brandCode=1&postIdEnc=a2448f2e426bfc5a&evil=https%3A%2F%2Fevil.cn',
  'https://www.hotjob.cn/wt/ghzq/web/index/webPositionN300!getOnePosition?brandCode=1',
  'https://www.doodod.com/careers/search/'
 ])assert.equal(publicJobLink(u),null,u);
});
test('Candidate only from Fetch job details with mainland city, JD and apply evidence',()=>{
 const l=publicJobLink(a);
 const pending=readPublicJob(l,{content:unknownJD,title:'内容运营 - 星河科技招聘'},now);
 assert.equal(pending?.source_status,'PUBLIC_JOB_UNCONFIRMED');
 assert.equal(pending?.location,'北京');
 assert.equal(pending?.company_claim,'星河数字科技有限公司');
 assert.equal(pending?.company,undefined,'JD employer claim alone is not verification');
 assert.equal(pending?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.equal(readPublicJob(l,{content:unknownJD.replace('工作地点：北京','工作地点：东京 日本')},now),null);
 assert.equal(readPublicJob(l,{content:unknownJD.replace('立即投递','职位已关闭')},now),null);
 assert.equal(readPublicJob(l,{content:unknownJD.replace('任职要求','未列出具体资格')},now),null);
 assert.equal(provePublicEmployer(pending,{title:'星河官网',content:siteDoc},site)?.source_status,'OFFICIAL_DETAIL_FETCHED');
 assert.equal(provePublicEmployer(pending,{title:'假公司',content:siteDoc.replaceAll('星河数字科技有限公司','其他公司')},site),null);
 assert.equal(provePublicEmployer(pending,{title:'伪造网站',content:siteDoc},'https://attacker.cn/'),null);
});
test('Cross-domain company/job websites require direct careers crosslink',()=>{
 const job=readPublicJob(publicJobLink(b),{content:bJD},now);
 assert.equal(provePublicEmployer(job,{title:'明源文化有限公司',content:siteDocB},siteB)?.source_verification,'CORPORATE_DOMAIN_AND_BRAND');
 const offDomain=readPublicJob(publicJobLink('https://jobs.hr-vendor.com/jobs/1098765'),{content:bJD},now);
 assert.equal(provePublicEmployer(offDomain,{title:'明源文化有限公司',content:siteDocB},siteB),null,
  'An unrelated ATS/job host requires explicit referral to the same job');
 const linked=siteDocB+'\n明源文化有限公司招聘: https://jobs.hr-vendor.com/jobs/1098765';
 assert.equal(provePublicEmployer(offDomain,{title:'明源文化有限公司',content:linked},siteB)?.source_verification,'CORPORATE_EXACT_JOB_LINK');
});
function mockAgent(){
 const requests=[],messages=[];let model=0;
 const fetcher=async(url,options)=>{
  requests.push({url:String(url),body:JSON.parse(options.body)});
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Authorization,'Bearer '+key);
  assert.doesNotMatch(options.body,/13123456789|person@example.com|身份证号码/);
  if(url.endsWith('/responses')){
   messages.push(JSON.parse(options.body));
   model++;
   if(model===1)return reply({status:'completed',output:[
    tool('search_jobs',{query:'内容运营 2026 中国大陆 社会招聘'},'find') ]});
   if(model===2)return reply({status:'completed',output:[
    tool('read_job',{url:a},'jobA'),tool('read_job',{url:b},'jobB') ]});
   if(model===3)return reply({status:'completed',output:[
    tool('verify_employer',{job_url:a,website_url:site},'proofA'),
    tool('verify_employer',{job_url:b,website_url:siteB},'proofB') ]});
   return reply({status:'completed',output:[{type:'message',role:'assistant',
    content:[{type:'output_text',text:'完成'}]}]});
  }
  if(url.endsWith('/search'))return reply({results:[
   {url:a,title:'星河 内容运营 北京',site_name:'星河'},
   {url:b,title:'明源 内容运营 上海',site_name:'明源'},
   {url:site,title:'星河数字科技有限公司官网'},
   {url:siteB,title:'明源文化有限公司官网'},
   {url:'https://www.zhipin.com/job_detail/123.html',title:'招聘聚合页'},
   {url:'https://www.evil.example/position/10000',title:'伪造企业岗位'}
  ]});
  if(url.endsWith('/fetch')){
   const input=JSON.parse(options.body);
   if(input.url===a)return reply({title:'内容运营',content:unknownJD});
   if(input.url===b)return reply({title:'内容运营',content:bJD});
   if(input.url===site)return reply({title:'星河数字科技有限公司',content:siteDoc});
   if(input.url===siteB)return reply({title:'明源文化有限公司',content:siteDocB});
  }
  throw Error('Unexpected API request');
 };
 return {fetcher,requests,messages};
}
test('DeepSeek autonomous Search -> Fetch -> corporate verification without any private employer API',async()=>{
 const x=mockAgent();
 const result=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:x.fetcher,now});
 assert.equal(result.kind,'HHBA_V8_PUBLIC_MAINLAND_DISCOVERY_V2');
 assert.equal(result.quality_status,'VERIFIED_JOBS_FOUND');
 assert.equal(result.status,'COMPLETE');
 assert.deepEqual(result.usage,{model:4,search:1,fetch:4});
 assert.deepEqual(result.accounting.attempts,result.usage);
 assert.deepEqual(result.accounting.billable,{search:1,fetch:4});
 assert.deepEqual(result.accounting.tokens,{input:4800,cached_input:1600,output:720});
 assert.equal(result.accounting.complete,true);
 assert.equal(result.accounting.estimated_total_cny,0.04936);
 assert.equal(result.accounting.peak_price_upper_estimate_cny,0.07372);
 assert.equal(result.candidates.length,2);
 assert.deepEqual(new Set(result.candidates.map(j=>j.company)),new Set(['星河数字科技有限公司','明源文化有限公司']));
 assert.ok(result.candidates.every(j=>j.source_status==='OFFICIAL_DETAIL_FETCHED'));
 assert.ok(result.candidates.every(j=>j.official_url.startsWith('https://')));
 assert.ok(result.candidates.every(j=>j.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
 assert.equal(x.requests.some(z=>z.url.includes('jobs.xinghe.cn/api')),false);
 assert.deepEqual(Object.keys(result.limit),Object.keys(V8_BUDGET));
 assert.ok(x.messages.every(m=>m.model==='deepseek-v4-pro'&&!m.tools.some(z=>z.type==='web_search')));
 assert.ok(x.messages.every(m=>m.max_output_tokens<=1400));
 const profile={education:'BACHELOR',experience_years:2,
  demonstrated_roles:['内容运营'],career_intents:['内容运营'],
  skills:[{name:'内容运营',evidence:'内容运营'}]};
 const fused=fuseDomesticJobRecommendations([],result.candidates,profile,{role_hint:'内容运营',limit:10},now);
 assert.equal(fused.counts.external_reviewed,2);
 assert.equal(fused.counts.external_eligible,2);
 assert.ok(fused.matches.every(j=>j.source_type==='站外官方招聘'));
 assert.ok(fused.matches.every(j=>j.location==='北京'||j.location==='上海'));
});
test('Hard budget cannot be bypassed with parallel hallucinated tool calls',async()=>{
 const usage={model:0,search:0,fetch:0};
 const fetcher=async(url)=>{
  if(url.endsWith('/responses')){
   usage.model++;
   return reply({status:'completed',output:Array.from({length:14},(_,i)=>
    tool('search_jobs',{query:'内容运营 2026 企业社招 '+i},'s'+i))});
  }
  if(url.endsWith('/search')){usage.search++;return reply({results:[]});}
  if(url.endsWith('/fetch')){usage.fetch++;return reply({content:'unexpected'});}
  throw Error('Unexpected request');
 };
 const result=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher});
 assert.equal(usage.search,8);
 assert.equal(usage.fetch,0);
 assert.ok(usage.model<=V8_BUDGET.model);
 assert.deepEqual(result.candidates,[]);
});
test('Model-proposed fake URL and offline provider produce no recommended jobs',async()=>{
 const unsourced=async(url)=>String(url).endsWith('/responses')?
  reply({status:'completed',output:[tool('read_job',{url:'https://fake-recruit.cn/jobs/234567'},'fake')]}):
  reply({results:[]});
 const a=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:unsourced});
 assert.deepEqual(a.candidates,[]);
 const b=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:async()=>{throw Error('network down')}});
 assert.equal(b.status,'PARTIAL');assert.deepEqual(b.candidates,[]);
});

test('Stop model inference early once target number of independently verified jobs is reached',async()=>{
 const x=mockAgent();
 const result=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:x.fetcher,now,targetCount:1});
 assert.equal(result.candidates.length,1);
 assert.deepEqual(result.usage,{model:2,search:1,fetch:2});
 assert.equal(result.accounting.billable.fetch,2);
 assert.equal(result.accounting.complete,true);
 assert.ok(result.accounting.estimated_total_cny>0);
});
test('Public Fetch hard ceiling is twenty, independent of model tool-call volume',async()=>{
 const jobs=Array.from({length:20},(_,i)=>
  'https://career.gongsi.cn/jobs/'+String(202611080000+i));
 let turn=0,attempts=0;
 const fetcher=async(url)=>{
  if(url.endsWith('/responses')){
   turn++;
   const calls=turn===1?[tool('search_jobs',{query:'内容运营 2026 企业招聘'},'s')]:
    turn===2?jobs.slice(0,14).map((v,i)=>tool('read_job',{url:v},'r'+i)):
    turn===3?jobs.slice(14).map((v,i)=>tool('read_job',{url:v},'r'+(i+14))):[];
   return reply({status:'completed',output:calls});
  }
  if(url.endsWith('/search'))return reply({results:jobs.map(url=>({url,title:'内容运营'}))});
  if(url.endsWith('/fetch')){attempts++;return reply({content:'公开招聘详细正文无法提取，但 Fetch 返回了可读取文本。'});}
  throw Error('unexpected API');
 };
 const result=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now});
 assert.equal(attempts,20);
 assert.equal(result.usage.fetch,20);
 assert.equal(result.accounting.billable.fetch,20);
 assert.equal(result.accounting.billable.search,1);
 assert.equal(result.candidates.length,0,'never recommend when JD lacks eligibility evidence');
 assert.equal(result.accounting.complete,true);
 assert.equal(result.usage.model,4);
});

test('Diagnostic rejection reasons are finite labels, never raw company or user data',()=>{
 const x={};
 const link=publicJobLink('https://career.xinghe.cn/jobs/202611080001');
 assert.equal(readPublicJob(link,{content:'short'},now,x),null);
 assert.equal(x.SHORT_PAGE,1);
 const brokenJD=[
 '# 内容运营','公司名称：星河数字科技有限公司','工作地点：北京',
 '岗位要求','本科及以上，熟悉新媒体编辑和内容平台运营。'.repeat(8),
 '立即投递'
 ].join('\n');
 assert.equal(readPublicJob(link,{content:brokenJD},now,x),null);
 assert.equal(x.MISSING_DUTIES,1);
 assert.deepEqual(Object.keys(x).sort(),['MISSING_DUTIES','SHORT_PAGE']);
});

test('Realistic Markdown table + numbered Chinese JD paragraphs are parsed with hard facts',()=>{
 const jobUrl='https://careers.yunhe.cn/jobs/202611080031';
 const companySite='https://yunhe.cn/';
 const fetched=[
  '# 内容运营专员 | 云禾文化有限公司',
  '| 工作地点 | 上海 |',
  '| 招聘单位 | 云禾文化有限公司 |',
  '职责描述',
  '1. 负责图文内容选题、用户沟通，组织公众号及社区活动。',
  '2. 参与内容增长分析，协助改进工作流程和数据复盘。',
  '岗位要求',
  '1. 本科及以上学历，新闻传播、广告或相关专业。',
  '2. 具备内容运营经验，熟悉数据分析及主流社交媒体平台。',
  '[申请职位](https://careers.yunhe.cn/jobs/202611080031)'
 ].join('\n');
 const link=publicJobLink(jobUrl),reasons={};
 const parsed=readPublicJob(link,{title:'内容运营专员 | 云禾文化有限公司',content:fetched},now,reasons);
 assert.equal(parsed?.title,'内容运营专员');
 assert.equal(parsed?.location,'上海');
 assert.equal(parsed?.company_claim,'云禾文化有限公司');
 assert.match(parsed?.evidence.requirement||'',/本科及以上学历/);
 assert.equal(parsed?.has_application_cta,true);
 const home={title:'云禾文化有限公司 官网',content:
  ('# 云禾文化有限公司\n云禾文化有限公司公司介绍、人才招聘、主营业务。').repeat(5)};
 assert.equal(provePublicEmployer(parsed,home,companySite)?.company,'云禾文化有限公司');
 assert.deepEqual(reasons,{});
});
test('Employer label may be absent, but independent homepage and job-brand proof remain mandatory',()=>{
 const link=publicJobLink('https://careers.xinghe.cn/jobs/202611080056');
 const content=[
  '# 新媒体运营', '工作地点','北京', '职责描述',
  '负责社交平台内容管理、创意选题策划及短视频运营，能够制定季度选题计划并维护完整内容日历。'.repeat(2),
  '配合市场活动制定内容计划，推动新媒体业务增长，与设计团队沟通并分析各平台内容数据。'.repeat(2),
  '我们希望你具备',
  '本科及以上学历，具备内容编辑能力及社会化媒体运营经验。',
  '能熟练使用办公软件并且熟悉数据分析和内容策划。',
  '立即投递','欢迎来到星河数字科技有限公司招聘'
 ].join('\n');
 const job=readPublicJob(link,{title:'新媒体运营',content},now);
 assert.equal(job?.company_claim,null);
 assert.equal(job?.location,'北京');
 const home={title:'星河数字科技有限公司',content:
  ('# 星河数字科技有限公司\n欢迎查看星河数字科技有限公司官方网站及招聘信息。').repeat(6)};
 assert.equal(provePublicEmployer(job,home,'https://xinghe.cn/'),null,
  'A homepage brand alone cannot prove which employer owns the vacancy');
 const branded=readPublicJob(link,{title:'新媒体运营 - 星河数字科技有限公司',content},now);
 assert.equal(branded?.company_claim,'星河数字科技有限公司');
 assert.equal(provePublicEmployer(branded,home,'https://xinghe.cn/')?.company,'星河数字科技有限公司');
 const impostor={title:'其他集团',content:('# 其他集团\n其他集团公司招聘信息').repeat(8)};
 assert.equal(provePublicEmployer(job,impostor,'https://xinghe.cn/'),null);
});
test('Never repair missing Mainland-city evidence or employer identity by model guessing',()=>{
 const link=publicJobLink('https://careers.xinghe.cn/jobs/202611080077');
 const text=[
 '# 内容运营','公司名称：星河数字科技有限公司',
 '职责描述','负责新媒体传播及用户互动，分析内容运营效果。'.repeat(4),
 '岗位要求','本科学历，熟练掌握图文编辑和短视频制作软件。'.repeat(4),
 '立即投递'
 ].join('\n');
 const why={};
 assert.equal(readPublicJob(link,{content:text},now,why),null);
 assert.equal(why.MISSING_EXPLICIT_WORKPLACE,1);
 assert.equal(readPublicJob(link,{content:text.replace('# 内容运营','# 内容运营\n工作地点：新加坡')},now),null);
 assert.equal(readPublicJob(link,{content:text.replace('# 内容运营','# 内容运营\n工作地点：北京\n工作城市：上海')},now),null);
 assert.equal(readPublicJob(link,{content:text.replace('# 内容运营','# 内容运营\n工作地点：北京').replace('岗位要求','工作要求：待定')},now),null);
});

test('Header city without explicit location label is accepted only near single job title',()=>{
 const link=publicJobLink('https://career.xinghe.cn/jobs/202611081188');
 const job=[
  '# 内容运营','北京','招聘单位：星河数字科技有限公司',
  '岗位职责',
  '负责公众号内容发布、跨部门运营协调、短视频策划和用户互动。'.repeat(4),
  '任职要求',
  '本科及以上学历，熟悉内容营销策略和短视频创意，能独立推进内容活动。'.repeat(4),
  '立即应聘'
 ].join('\n');
 const parsed=readPublicJob(link,{title:'内容运营',content:job},now);
 assert.equal(parsed?.location,'北京');
 assert.equal(parsed?.has_application_cta,true);
 const bad=job.replace('\n北京\n','\n行业不限\n').replace('负责公众号内容发布','北京客户项目负责公众号内容发布');
 assert.equal(readPublicJob(link,{title:'内容运营',content:bad},now),null,
  'a city only inside duties does not establish actual workplace');
 const amb=job.replace('\n北京\n','\n北京\n上海\n');
 assert.equal(readPublicJob(link,{title:'内容运营',content:amb},now),null,
  'two unlabeled cities in the job header cannot be arbitrarily collapsed');
});
test('Model-discovered roles receive bounded autonomous Fetch postpass with no extra model calls',async()=>{
 const vacancy='https://career.xinghe.cn/jobs/202611081237';
 const main='https://xinghe.cn/';
 const jd=[
  '# 内容运营', '工作地点：北京', '招聘公司：星河数字科技有限公司',
  '工作职责','负责社交平台内容运营、专题活动策划、内容制作和用户反馈。'.repeat(5),
  '岗位要求','本科及以上学历，具备内容编辑、新媒体内容策划、项目执行及数据复盘能力。'.repeat(5),
  '立即应聘'
 ].join('\n');
 const homeContent='# 星河数字科技有限公司\n'+('星河数字科技有限公司官方网站，提供产品介绍与公司动态。').repeat(10);
 const counts={responses:0,search:0,fetch:0};
 const replies=(x)=>Response.json(x);
 const toolCall=(name,args,id)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
 const transport=async(url,options)=>{
  if(url.endsWith('/responses')){
   counts.responses++;
   return replies({status:'completed',usage:{input_tokens:300,
    input_tokens_details:{cached_tokens:20},output_tokens:150},output:
    counts.responses===1?[toolCall('search_jobs',{query:'内容运营 企业招聘 北京'},'q')]:
     [{type:'message',role:'assistant',content:[{type:'output_text',text:'已完成检索'}]}]});
  }
  if(url.endsWith('/search')){
   counts.search++;return replies({results:[{url:vacancy,title:'内容运营 - 星河数字科技有限公司'}]});
  }
  if(url.endsWith('/fetch')){
   counts.fetch++;
   const body=JSON.parse(options.body);
   if(body.url===vacancy)return replies({title:'内容运营',content:jd});
   if(body.url===main)return replies({title:'星河数字科技有限公司',content:homeContent});
   throw Error('Unexpected Fetch URL');
  }
  throw Error('Unexpected provider endpoint');
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:transport,now,targetCount:1});
 assert.deepEqual(counts,{responses:2,search:1,fetch:2});
 assert.deepEqual(got.usage,{model:2,search:1,fetch:2});
 assert.equal(got.stats.postpass_job_reads,1);
 assert.equal(got.candidates.length,1);
 assert.equal(got.candidates[0].company,'星河数字科技有限公司');
 assert.equal(got.quality_status,'VERIFIED_JOBS_FOUND');
 assert.equal(got.accounting.complete,true);
});
test('Postpass never fetches irrelevant search teaser or bypasses 4/8/20 bounds',async()=>{
 let responses=0,search=0,fetches=0;
 const reply=x=>Response.json(x);
 const producer=async(url)=>{
  if(url.endsWith('/responses')){
   responses++;
   return reply({status:'completed',output:responses===1?[{
    type:'function_call',call_id:'q',name:'search_jobs',
    arguments:JSON.stringify({query:'内容运营 招聘 2026'})
   }]:[{type:'message',role:'assistant',content:[]}]});
  }
  if(url.endsWith('/search')){search++;return reply({results:[
   {url:'https://career.gongsi.cn/jobs/202611081111',title:'财务经理'},
   {url:'https://career.gongsi.cn/jobs/202611082222',title:'物流销售'}
  ]});}
  if(url.endsWith('/fetch')){fetches++;return reply({content:'should not fetch'});}
  throw Error('Unexpected call');
 };
 const outcome=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:producer,now});
 assert.equal(responses,2);
 assert.equal(search,1);
 assert.equal(fetches,0);
 assert.equal(outcome.stats.postpass_job_reads,0);
 assert.equal(outcome.candidates.length,0);
 assert.ok(outcome.usage.model<=4&&outcome.usage.search<=8&&outcome.usage.fetch<=20);
});

test('Domestic ATS title prefix and 投递此职位 must parse without turning listings into vacancies',()=>{
 const url='https://www.hotjob.cn/wt/ghzq/web/index/webPositionN300!getOnePosition?brandCode=1&columnId=2&importPost=0&lanType=1&postIdEnc=a2448f2e426bfc5a&recruitType=2';
 const link=publicJobLink(url);
 assert.ok(link);
 const body=[
  '社会招聘','校园招聘','帮助中心','招聘注册与登录','欢迎访问招聘系统',
  '首页 > 社会招聘 > 内容运营岗','内容运营岗',
  '招聘单位：国海证券股份有限公司','工作地点：深圳市',
  '职位描述',
  '负责内容运营选题、资讯整理、客户增长和数据分析，持续优化用户体验。'.repeat(6),
  '任职要求',
  '硕士及以上学历，具有内容制作、金融信息整理与数据分析能力。'.repeat(6),
  '投递此职位'
 ].join('\n');
 const p=readPublicJob(link,{title:'职位详情 - 内容运营岗',content:body},now);
 assert.equal(p?.title,'内容运营岗');
 assert.equal(p?.location,'深圳');
 assert.equal(p?.company_claim,'国海证券股份有限公司');
 assert.equal(p?.has_application_cta,true);
 assert.equal(p?.application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.equal(provePublicEmployer(p,{title:'其他企业官网',
  content:('别家公司公开招聘网站，业务产品介绍与团队新闻。').repeat(10)},
  'https://ghzq.com.cn/'),null);
});

test('Opt-in live public URL diagnostics expose only bounded public link and reason, never JD/resume',async()=>{
 const url='https://careers.xinghe.cn/jobs/202611080199';
 let calls=0;
 const fetcher=async(endpoint,opts)=>{
  if(endpoint.endsWith('/responses')){
   calls++;
   return Response.json({status:'completed',
    usage:{input_tokens:300,input_tokens_details:{cached_tokens:120},output_tokens:45},
    output:calls===1?[tool('search_jobs',{query:'内容运营 2026 企业招聘'},'q1')]:[]});
  }
  if(endpoint.endsWith('/search'))return Response.json({results:[{
   url,title:'内容运营 - 星河数字科技',
   snippet:'工作地点：北京 职位职责 任职资格 立即应聘'
  }]});
  if(endpoint.endsWith('/fetch'))return Response.json({title:'内容运营',
   content:'职位页无可读取正文'});
  throw Error('UNEXPECTED_ENDPOINT');
 };
 const diagnostic=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now,auditPublicEvidence:true});
 assert.equal(diagnostic.quality_status,'NO_VERIFIED_JOBS');
 assert.deepEqual(diagnostic.stats.rejected_public_links,[{url,reason:'SHORT_PAGE'}]);
 assert.equal(JSON.stringify(diagnostic.stats.rejected_public_links).includes('职位页无可读取正文'),false);
 const ordinary=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now});
 assert.equal(ordinary.stats.rejected_public_links,undefined);
});

test('Real DeepSeek audit: general job portals are NOT employer-owned job pages',()=>{
 const rejected=[
  'https://www.adquan.com/job/27529',
  'https://zrc-sme.chinasme.cn/job/69ad72323e67084e25d59746',
  'https://www.quanzhi.com/job/6aed8044d18cbdfa17daca82',
  'https://www.quanzhi.com/job/6a04cf095e5710182924c8e0',
  'https://campus.niuqizp.com/job-vl85a5Lz5.html',
  'https://campus.niuqizp.com/job-vsy5aaaLa.html',
  'https://shu.ncss.cn/student/jobs/3S8wCZjbvJCXoS4UYMECnJ/detail.html',
  'https://www.ncss.cn/student/jobs/MRJ5FvVE96HMoyrsoxpyRR/detail.html',
  'https://www.nmbys.cn/job/view/id/812751/mark/imuchuangye',
  'https://www.risfond.com/Job/263934',
  'https://ylt.gzrc.com.cn/jobs/53099212.html',
  'https://m.yingjiesheng.com/job-008-144-268.html'
 ];
 for(const u of rejected)assert.equal(publicJobLink(u),null,u);
 assert.ok(publicJobLink('https://careers.suning.cn/rps-web/position/position_info_new.htm?id=19714'),
  'a real enterprise-owned careers domain must remain eligible for Fetch before independent JD screening');
});
