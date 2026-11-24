import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Provider,v4Call,v4ParseJson,v4GroundProfile,v4Sources,v4GroundScores,
 v4Match} from '../functions/_lib/simple-match-v4.js';
import {onRequest} from '../functions/api/match-v4/[[path]].js';
import {v4PublicJobUrl,v4ReadEmployerJob} from '../functions/_lib/v4-open-job-evidence.js';

const key='TEST_ONLY_FAKE_KEY_0123456789';
const provider=v4Provider({HHBA_AGENT_RELAY_API_KEY:key});
const complete=(value,more=[])=>Response.json({status:'completed',output:[
 ...more,{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}
]});
const pageUrl='https://careers.tencent.com/jobdesc.html?postId=123456789012345';
test('V4 uses one Secret and no Agent or extra model config',()=>{
 assert.equal(v4Provider({}),null);
 assert.equal(provider.model,'gpt-6.2-sol');
 assert.equal(provider.key,key);
});
test('V4 forces store=false, rejects redirects, does not leak credentials',async()=>{
 let captured;
 await v4Call(async(url,options)=>{
  captured={url,options};
  return complete({ok:true});
 },provider,{store:true,input:'synthetic'});
 assert.equal(captured.url,'https://api-c.reqtoken.com/v1/responses');
 assert.equal(JSON.parse(captured.options.body).store,false);
 assert.equal(captured.options.redirect,'manual');
 assert.equal(captured.options.headers.authorization,'Bearer '+key);
 await assert.rejects(()=>v4Call(async()=>new Response(null,{status:302}),
  provider,{input:'hello'}),/AI_PROVIDER_REDIRECT_BLOCKED/);
});
test('Resume profile rejects invented or unquoted career history',()=>{
 const resume='曾经参与门店销售运营，完成线索跟进。熟悉 Excel 表格。';
 const p=v4GroundProfile({education:'博士',education_evidence:'博士毕业',
  experience_years:10,experience_evidence:'十年经验',
  skills:[{name:'Excel',evidence:'熟悉 Excel 表格'},{name:'外科医生',evidence:'医生执业证'}],
  facts:[{kind:'work',quote:'曾经参与门店销售运营'},{kind:'credential',quote:'博士毕业'}],
  roles:['门店督导','渠道运营']},resume);
 assert.equal(p.education,null);
 assert.equal(p.experience_years,null);
 assert.equal(p.facts.length,1);
 assert.equal(p.skills.length,1);
 assert.deepEqual(p.target_roles,['门店督导','渠道运营']);
});
test('Only tool-cited official job detail pages are eligible; never trust invented JSON links',()=>{
 const d={output:[
  {type:'web_search_call',action:{sources:[
   {url:pageUrl},{url:'https://www.zhipin.com/job_detail/1234.html'},
   {url:'https://careers.tencent.com/'},{url:'http://careers.tencent.com/jobdesc.html?postId=123456789012345'}
  ]}},
  {type:'message',content:[{type:'output_text',text:'{"official_url":"https://evil.test/jobs/99"}'}]}
 ]};
 assert.deepEqual(v4Sources(d),[pageUrl]);
});
test('No invented matching score unless exact resume and JD citations both exist',()=>{
 const resume='从事渠道运营以及线索转化。';
 const job={id:'a',company:'腾讯',title:'渠道运营',location:'深圳',canonical_url:pageUrl,
  full_jd:'岗位职责：渠道运营，支持合作伙伴。\n任职要求：熟悉数据分析和项目协作。',requirements:'数据分析',
  checked_at:'2026-11-24T00:00:00Z',proof_method:'TEST_ONLY'};
 const bogus=v4GroundScores({scores:[{url:pageUrl,score:99,reason:'全部满足',
  resume_quote:'博士学历',jd_quote:'数据分析'}]},[job],resume);
 assert.equal(bogus[0].match_score,null);
 const grounded=v4GroundScores({scores:[{url:pageUrl,score:72,
  resume_quote:'从事渠道运营',jd_quote:'熟悉数据分析',
  reason:'部分匹配',matched:['运营'],gaps:['项目协作']}]},[job],resume);
 assert.equal(grounded[0].match_score,72);
 assert.equal(grounded[0].jd_source_status,'VERIFIED_JD');
});
test('Two AI calls can finish without inventing posts when no official page is cited',async()=>{
 let steps=0;
 const fake=async(url,options)=>{
  if(url!=='https://api-c.reqtoken.com/v1/responses')throw Error('unexpected network');
  steps++;
  const payload=JSON.parse(options.body);
  if(!payload.tools)return complete({
   roles:['渠道运营'],facts:[{kind:'work',quote:'负责渠道运营工作'}],
   skills:[],summary:'适合渠道运营'});
  return complete({summary:'search finished'},[{type:'web_search_call',action:{sources:[
   {url:'https://www.zhipin.com/job_detail/invalid'}]}}]);
 };
 const r=await v4Match(fake,provider,'负责渠道运营工作，熟悉团队配合与业务跟进。','渠道运营');
 assert.equal(steps,3);
 assert.equal(r.status,'COMPLETE');
 assert.equal(r.matches.length,0);
 assert.match(r.disclaimer,/不编造/);
});
test('V4 requires explicit flag and never runs unauthenticated or cross-origin',async()=>{
 const mock={HHBA_AGENT_RELAY_API_KEY:key,HHBA_MATCH_V4_READY:'1',
  HHBA_PNVS_AUTH_DB:{prepare:()=>{throw Error('should not query DB')}}};
 const disabled=await onRequest({request:new Request('https://hhba.work/api/match-v4/status'),
  env:{...mock,HHBA_MATCH_V4_READY:'0'}});
 assert.equal((await disabled.json()).enabled,false);
 const r=await onRequest({request:new Request('https://hhba.work/api/match-v4/status'),env:mock});
 assert.equal((await r.json()).enabled,true);
 const noAuth=await onRequest({request:new Request('https://hhba.work/api/match-v4/resume',{
  method:'POST',headers:{Origin:'https://hhba.work','Content-Type':'application/json'},
  body:JSON.stringify({consent:true,text:'工作经历'.repeat(30),options:{country:'CN'}})
 }),env:{...mock,HHBA_PNVS_AUTH_DB:{prepare:()=>({first:async()=>null})}}});
 assert.equal(noAuth.status,401);
 const p=await onRequest({request:new Request('https://v4.hhba-talent.pages.dev/api/match-v4/resume',{
  method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},
  body:JSON.stringify({consent:true,text:'工作经历'.repeat(30),options:{country:'CN'}})
 }),env:mock});
 assert.equal(p.status,403);
});

test('V4 does not require a fixed list of companies, paths, or titles',async()=>{
 const url='https://careers.shancheng-motors.cn/recruitment/social/detail/2026-778?ref=careers';
 assert.equal(v4PublicJobUrl(url),url);
 assert.equal(v4PublicJobUrl('https://www.zhipin.com/job_detail/fake.html'),null);
 assert.equal(v4PublicJobUrl('http://careers.shancheng-motors.cn/jobs/1'),null);
 assert.equal(v4PublicJobUrl('https://127.0.0.1/private'),null);
 assert.equal(v4PublicJobUrl('https://metadata.google.internal/computeMetadata/v1'),null);
 assert.equal(v4PublicJobUrl('https://careers.shancheng-motors.cn.evil.local/jobs/2'),null);
 const desc='<p>岗位职责</p><p>负责经销商的日常经营数据分析和业务流程指导。</p>'+
  '<p>负责区域渠道团队业务培训和终端零售能力提升。</p>'+
  '<p>任职要求</p><p>熟悉经销商销售管理与门店日常经营分析方法。</p>'+
  '<p>能独立完成渠道人员培训、业务复盘与改善工作。</p>';
 const html='<html><head><script type="application/ld+json">'+
  JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'区域渠道督导',
   hiringOrganization:{'@type':'Organization',name:'山城汽车',url:'https://careers.shancheng-motors.cn'},
   jobLocation:{'@type':'Place',address:{addressLocality:'上海',addressCountry:'CN'}},
   description:desc})+'</script></head><body><h1>区域渠道督导</h1></body></html>';
 let requested='';
 const job=await v4ReadEmployerJob(url,{fetcher:async(u,opts)=>{
  requested=u;assert.equal(opts.redirect,'manual');assert.equal(opts.method,'GET');
  return new Response(html,{status:200,headers:{'content-type':'text/html'}});
 }});
 assert.equal(requested,url);
 assert.equal(job.company,'山城汽车');
 assert.equal(job.title,'区域渠道督导');
 assert.equal(job.location,'上海');
 assert.ok(job.full_jd.includes('任职要求'));
 assert.equal(job.source_confirmed,true);
});
test('V4 independently rejects imaginary, closed and unrelated organization postings',async()=>{
 const url='https://jobs.another-motors.cn/position/11886';
 const description='<p>岗位职责</p><p>负责汽车区域门店督导经营改善、数据监控与指导。</p>'+
  '<p>跟进经销商团队的培训和工作复盘。</p><p>任职要求</p>'+
  '<p>具备区域终端管理、业务培训和数据分析的经历。</p>'+
  '<p>具备独立工作和跨团队协作能力。</p>';
 const posting={'@type':'JobPosting',title:'区域运营管理',
  jobLocation:{address:{addressLocality:'上海'}},
  hiringOrganization:{name:'不相关汽车企业',url:'https://unrelated-host.cn'},
  description};
 const mk=j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>';
 const externalOrg=await v4ReadEmployerJob(url,{fetcher:async()=>new Response(mk(posting),{
  headers:{'content-type':'text/html'}})});
 assert.equal(externalOrg.source_confirmed,false, 'different corporate/career host requires user-facing qualification');
 await assert.rejects(()=>v4ReadEmployerJob(url,{fetcher:async()=>new Response('岗位已下线',{
  headers:{'content-type':'text/html'}})}),/V4_JOB_CLOSED/);
});
test('V4 can harvest real candidate URLs printed by relay even when citation metadata is absent',()=>{
 const url='https://careers.shancheng-motors.cn/recruitment/social/detail/2026-778';
 const data={output:[{type:'web_search_call',action:{sources:[]}},
  {type:'message',content:[{type:'output_text',
   text:'找到的官网岗位：'+url+'\nhttps://www.zhipin.com/job_detail/not-official.html'}]}]};
 assert.deepEqual(v4Sources(data),[url]);
});
