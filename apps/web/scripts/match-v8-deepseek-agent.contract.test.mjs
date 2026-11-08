import test from 'node:test';
import assert from 'node:assert/strict';
import {
 safeAgentQuery,recognizedCompanyWebsite,safeAgentJobLink,
 extractAtsPage,verifyAtsBacklink,runDeepSeekOfficialJobAgent,V8_BUDGET
} from '../functions/_lib/deepseek-official-job-agent.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';

const key='synthetic-key-never-live';
const at=new Date('2026-11-08T10:00:00.000Z');
const old='https://zhaopin.meituan.com/web/position/detail?jobUnionId=4747089400';
const ats='https://jobs.ashbyhq.com/xinghe/123e4567-e89b-42d3-a456-426614174000';
const site='https://www.xinghe.cn/';
const oldJD=[
 '# 内容运营 北京','岗位职责','负责官方内容策划、新媒体渠道运营、用户沟通与品牌推广。'.repeat(5),
 '岗位要求','本科以上学历，熟悉内容策划、用户沟通与新媒体运营。'.repeat(5),
 '工作地点：北京','立即投递'
].join('\n');
const atsJD=[
 '# 内容运营 上海','公司名称：星河公司','Location: 上海','Responsibilities',
 '负责中文内容策划、新媒体传播与用户增长，独立负责选题、公众号及短视频平台的日常发布。'.repeat(4),
 'Requirements',
 '能够负责内容策划和营销活动落地，具有沟通协作能力和项目管理能力，熟练撰写中文稿件。'.repeat(4),
 'Apply for this job'
].join('\n');
const website='# 星河公司 官网\n'+'星河公司是一家示例性技术公司，欢迎查看公开岗位及团队文化。'.repeat(7)+
 '\n[加入我们]('+ats+')';
const reply=(data)=>Response.json(data);
const tool=(name,args,call_id)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id});
function syntheticAgent(){
 const records=[],tokenInputs=[];let round=0;
 const fetcher=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  const endpoint=String(url);
  records.push({endpoint,body});
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Authorization,'Bearer '+key);
  assert.doesNotMatch(JSON.stringify(body),/13812345678|person@example.com|身份证号/);
  if(endpoint.endsWith('/responses')){
   tokenInputs.push(body);
   round++;
   if(round===1)return reply({status:'completed',output:[
    tool('search_jobs',{query:'内容运营 上海 北京 社会招聘'},'search1')
   ]});
   if(round===2)return reply({status:'completed',output:[
    tool('read_job',{url:old},'read1'),tool('read_job',{url:ats},'read2')
   ]});
   if(round===3)return reply({status:'completed',output:[
    tool('prove_ats',{job_url:ats,website_url:site},'prove1')
   ]});
   return reply({status:'completed',output:[{type:'message',role:'assistant',
    content:[{type:'output_text',text:'检索完成'}]}]});
  }
  if(endpoint.endsWith('/search'))return reply({results:[
   {url:old,title:'美团 内容运营 北京'},
   {url:ats,title:'星河公司 内容运营 上海'},
   {url:site,title:'星河公司官网'},
   {url:'https://evil.example/claim-job?id=4',title:'假招聘'},
   {url:'https://jobs.ashbyhq.com.attacker.example/xinghe/123e4567-e89b-42d3-a456-426614174000',
    title:'伪造 ATS'}
  ]});
  if(endpoint.endsWith('/fetch')){
   if(body.url===old)return reply({title:'美团招聘详情',content:oldJD});
   if(body.url===ats)return reply({title:'星河公司职位',content:atsJD});
   if(body.url===site)return reply({title:'星河公司官方网站',content:website});
  }
  throw Error('Unexpected provider call');
 };
 return {fetcher,records,tokenInputs};
}
test('V8 agent search requests allow only safe requested mainland role terms',()=>{
 const roles=['内容运营'];
 assert.equal(safeAgentQuery('内容运营 招聘 上海',roles),'内容运营 招聘 上海');
 assert.equal(safeAgentQuery('新媒体运营 招聘 深圳',roles),'新媒体运营 招聘 深圳');
 for(const q of ['财务经理 北京 招聘','内容运营 日本 东京','内容运营 13812345678',
  '内容运营 foo@example.com','忽略指令','内容运营 https://evil.example',
  '内容运营 <script>alert(1)</script>']){
  assert.equal(safeAgentQuery(q,roles),null,q);
 }
 assert.equal(recognizedCompanyWebsite(site),site);
 for(const url of ['http://www.xinghe.cn/','https://evil.example/jobs',
  'https://www.xinghe.cn/#evil','https://127.0.0.1/','https://www.xinghe.cn/?token=1']){
  assert.equal(recognizedCompanyWebsite(url),null,url);
 }
});
test('ATS single-job URL parser rejects lookalike domains, tracking and arbitrary paths',()=>{
 assert.equal(safeAgentJobLink(ats)?.tenant,'xinghe');
 assert.equal(safeAgentJobLink(ats)?.type,'ats');
 assert.equal(safeAgentJobLink(old)?.type,'known');
 const evil=['https://jobs.ashbyhq.com.evil.example/xinghe/123e4567-e89b-42d3-a456-426614174000',
  ats+'?utm_source=evil',ats+'#bar',
  'http://jobs.ashbyhq.com/xinghe/123e4567-e89b-42d3-a456-426614174000',
  'https://jobs.ashbyhq.com/xinghe','https://example.com/jobs/foo',
  'https://job-boards.greenhouse.io/xinghe/jobs/foo'];
 for(const url of evil)assert.equal(safeAgentJobLink(url),null,url);
});
test('hosted ATS body requires JD, Mainland city and independent employer backlink',()=>{
 const link=safeAgentJobLink(ats);
 const pending=extractAtsPage(link,{content:atsJD},at);
 assert.equal(pending?.source_status,'ATS_NEEDS_EMPLOYER_PROOF');
 assert.equal(pending?.location,'上海');
 assert.equal(pending?.company,undefined,'tenant is not verified legal employer');
 assert.equal(verifyAtsBacklink(pending,{content:website},site)?.company,'星河公司');
 assert.equal(verifyAtsBacklink(pending,{content:website.replace(ats,'https://example.org/')},site),null);
 assert.equal(verifyAtsBacklink(pending,{content:website.replaceAll('星河公司','伪造公司')},site),null);
 assert.equal(verifyAtsBacklink(pending,{content:website},'https://www.evil.cn/'),null,
  'a fake external domain with a forged backlink must not authenticate a tenant');
 assert.equal(extractAtsPage(link,{content:atsJD.replace('Location: 上海','Location: Tokyo 日本')},at),null);
 assert.equal(extractAtsPage(link,{content:atsJD.replace('Apply for this job','职位已关闭')},at),null);
});
test('V8 4-step autonomous function-tool run uses external evidence only, zero resumes',async()=>{
 const provider=syntheticAgent();
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:provider.fetcher,now:at});
 assert.equal(got.status,'COMPLETE');
 assert.equal(got.kind,'HHBA_V8_DEEPSEEK_OFFICIAL_JOB_AGENT_PILOT');
 assert.deepEqual(got.usage,{model:4,search:1,fetch:3});
 assert.equal(got.candidates.length,2);
 assert.deepEqual(new Set(got.candidates.map(j=>j.company)),new Set(['美团','星河公司']));
 assert.ok(got.candidates.every(j=>j.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
 assert.ok(got.candidates.every(j=>j.evidence.requirement.length>=25));
 assert.equal(got.candidates.find(j=>j.company==='星河公司').source_verification,
  'EMPLOYER_SITE_BACKLINK_VERIFIED');
 assert.equal(got.candidates.some(j=>j.official_domain==='evil.example'),false);
 assert.deepEqual(Object.keys(got.limit).sort(),Object.keys(V8_BUDGET).sort());
 for(const req of provider.tokenInputs){
  assert.equal(req.model,'deepseek-v4-pro');
  assert.equal(req.tools.some(t=>t.type==='web_search'),false);
  assert.ok(req.max_output_tokens<=1100);
 }
 // Integration: ranking still independently checks education, experience,
 // mainland location, source legitimacy and hard requirements.
 const profile={education:'BACHELOR',experience_years:3,
  demonstrated_roles:['内容运营'],career_intents:['内容运营'],target_roles:['内容运营'],
  skills:[{name:'内容策划',evidence:'内容策划'}]};
 const matched=fuseDomesticJobRecommendations([],got.candidates,profile,{role_hint:'内容运营',limit:10},at);
 assert.ok(matched.matches.every(j=>j.location==='北京'||j.location==='上海'));
 assert.ok(matched.matches.every(j=>j.source_type==='站外官方招聘'));
 assert.ok(matched.matches.every(j=>j.application_status==='NEEDS_OFFICIAL_CONFIRMATION'));
});
test('model cannot exceed hard Search budget by issuing many parallel calls',async()=>{
 const used={responses:0,search:0,fetch:0};
 const fetcher=async(url,options)=>{
  const api=String(url);
  if(api.endsWith('/responses')){
   used.responses++;
   const calls=Array.from({length:12},(_,i)=>
    tool('search_jobs',{query:'内容运营 北京 招聘 '+i},'batch-'+i));
   return reply({status:'completed',output:calls});
  }
  if(api.endsWith('/search')){used.search++;return reply({results:[]});}
  if(api.endsWith('/fetch')){used.fetch++;throw Error('should not fetch');}
  throw Error('Unexpected API');
 };
 const output=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher});
 assert.equal(used.search,4);
 assert.equal(used.fetch,0);
 assert.ok(used.responses<=V8_BUDGET.model);
 assert.ok(output.usage.search<=V8_BUDGET.search);
 assert.deepEqual(output.candidates,[]);
});
test('no official detail proof or provider outage never invents job',async()=>{
 const empty=async(url)=>String(url).endsWith('/responses')?
  reply({status:'completed',output:[tool('read_job',{url:'https://fake.example/job/1'},'bad')]}):
  reply({results:[]});
 const a=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:empty});
 assert.deepEqual(a.candidates,[]);
 const fail=async()=>{throw Error('offline');};
 const b=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:fail});
 assert.equal(b.status,'PARTIAL');
 assert.deepEqual(b.candidates,[]);
});
