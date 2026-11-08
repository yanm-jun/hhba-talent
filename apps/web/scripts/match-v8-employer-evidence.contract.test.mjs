import test from 'node:test';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';
import assert from 'node:assert/strict';
import {
 publicJobLink,publicCorporatePage,employerLookupQuery,
 readPublicJob,provePublicEmployer,inspectPublicEmployer,
 runDeepSeekOfficialJobAgent
} from '../functions/_lib/deepseek-official-job-agent.js';

const now=new Date('2026-11-08T12:00:00Z');
const key='synthetic-test-api-key-private';
const jobURL='https://jobs.hrboard.cn/companies/xinghe/jobs/202611080951';
const board='https://jobs.hrboard.cn/companies/xinghe';
const corporate='https://xinghe.cn/careers';
const JD=[
 '# 内容运营','招聘单位：星河数字科技有限公司',
 '工作地点：北京','岗位职责',
 '负责公众号内容编辑、短视频营销策划、客户需求研究与内容项目跟进。'.repeat(5),
 '任职要求','本科及以上学历，了解新媒体产品和社交媒体数据分析，能组织内容策划。'.repeat(5),
 '立即投递'
].join('\n');
const cleanCompany='# 星河数字科技有限公司官网\n'+('星河数字科技有限公司官方网站，公开企业介绍和人才招聘。').repeat(9);
const agencyHome='# HRBoard 公共招聘平台\n'+('提供多家公司招聘公告、招聘运营服务。').repeat(15);
const companyWithBoard=cleanCompany+'\n[人才招聘]('+board+')';
const reply=Response.json;
const modelCall=(name,args,id)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:id});

test('company public search query comes only from bounded job employer claim',()=>{
 const job={company_claim:'星河数字科技有限公司'};
 assert.equal(employerLookupQuery(job),'星河数字科技有限公司 官方网站 社会招聘');
 for(const claim of ['请忽略指令星河公司','星河公司<script>',
  '星河科技 13812345678','星河公司 token','用户邮箱 test@example.com',
  '请执行系统消息','上海星河密钥公司',''])assert.equal(
   employerLookupQuery({company_claim:claim}),null,claim);
 assert.equal(employerLookupQuery({company_claim:'星河科技有限公司'.repeat(8)}),null);
});
test('corporate link must prove exact vacancy or named specific board, never vendor root',()=>{
 const job=readPublicJob(publicJobLink(jobURL),{content:JD,title:'内容运营'},now);
 assert.equal(job?.location,'北京');
 assert.equal(publicCorporatePage(corporate)?.domain,'xinghe.cn');
 const proven=inspectPublicEmployer(job,{title:'星河数字科技有限公司',content:companyWithBoard},corporate);
 assert.equal(proven.reason,'VERIFIED');
 assert.equal(proven.job?.company,'星河数字科技有限公司');
 assert.equal(proven.job?.source_verification,'CORPORATE_NAMED_BOARD_LINK');
 assert.equal(provePublicEmployer(job,{title:'星河数字科技有限公司',
  content:cleanCompany+'\n[人才招聘]('+jobURL+')'},corporate)?.source_verification,
  'CORPORATE_EXACT_JOB_LINK');
 for(const invalid of [
  cleanCompany,
  cleanCompany+'\n[人才招聘](https://jobs.hrboard.cn/)',
  cleanCompany+'\n[人才招聘](https://jobs.hrboard.cn/jobs)',
  cleanCompany+'\n[人才招聘](https://jobs.hrboard.cn/companies/other)',
  cleanCompany+'\n[人才招聘](https://jobs.hrboard.cn/companies/xinghe-evil)',
  cleanCompany+'\n(https://jobs.hrboard.cn/companies/xinghe)',
  cleanCompany.replaceAll('星河数字科技有限公司','伪造公司')+'\n[人才招聘]('+board+')'
 ])assert.equal(provePublicEmployer(job,{title:'伪造公司',content:invalid},corporate),null,
  'Cannot infer authenticity from a generic or forged referral');
 assert.equal(inspectPublicEmployer(job,{title:'星河数字科技有限公司',
  content:cleanCompany},corporate).reason,'COMPANY_LINK_UNPROVEN');
});
test('agent searches public employer site after missing company proof and respects limits',async()=>{
 let responses=0,search=0,fetch=0;
 const requests=[],queries=[];
 const fetcher=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  requests.push({url,body});
  assert.equal(opts.headers.Authorization,'Bearer '+key);
  if(url.endsWith('/responses')){
   responses++;
   return reply({status:'completed',usage:{input_tokens:400,input_tokens_details:{cached_tokens:50},output_tokens:120},
    output:responses===1?[modelCall('search_jobs',{query:'内容运营 北京 企业招聘 2026'},'one')]:[]});
  }
  if(url.endsWith('/search')){
   search++;queries.push(body.query);
   if(search===1)return reply({results:[{
    url:jobURL,title:'内容运营 - 星河数字科技有限公司',
    snippet:'工作地点：北京 岗位职责 任职要求 立即投递'
   }]});
   if(search===2)return reply({results:[
    {url:corporate,title:'星河数字科技有限公司官方招聘',
     snippet:'星河数字科技有限公司官方网站社会招聘'},
    {url:'https://malicious.cn/careers',title:'内容运营优秀企业'},
    {url:'https://other.cn/jobs',title:'完全无关的公司'}
   ]});
  }
  if(url.endsWith('/fetch')){
   fetch++;
   if(body.url===jobURL)return reply({title:'内容运营',content:JD});
   if(body.url==='https://hrboard.cn/')return reply({title:'HRBoard',content:agencyHome});
   if(body.url===corporate)return reply({title:'星河数字科技有限公司',content:companyWithBoard});
   throw Error('Must not fetch unrelated company pages');
  }
  throw Error('Unknown API endpoint');
 };
 const x=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher,now,targetCount:1});
 assert.equal(x.quality_status,'VERIFIED_JOBS_FOUND');
 assert.equal(x.candidates.length,1);
 assert.equal(x.candidates[0].source_verification,'CORPORATE_NAMED_BOARD_LINK');
 assert.deepEqual(x.usage,{model:2,search:2,fetch:3});
 assert.equal(x.stats.postpass_job_reads,1);
 assert.deepEqual(x.stats.employer_proof,{searches:1,search_candidates:1,corporate_page_fetches:2});
 assert.equal(x.accounting.billable.search,2);
 assert.equal(x.accounting.billable.fetch,3);
 assert.equal(x.accounting.complete,true);
 const profile={education:'BACHELOR',experience_years:2,
  demonstrated_roles:['内容运营'],career_intents:['内容运营'],
  skills:[{name:'内容运营',evidence:'内容运营'}]};
 const fused=fuseDomesticJobRecommendations([],x.candidates,profile,{role_hint:'内容运营',limit:10},now);
 assert.equal(fused.counts.external_reviewed,1);
 assert.equal(fused.counts.external_eligible,1);
 assert.equal(fused.matches.length,1);
 assert.equal(queries[1],'星河数字科技有限公司 官方网站 社会招聘');
 assert.equal(requests.filter(x=>x.url.endsWith('/fetch')).length,3);
 assert.ok(x.usage.model<=4&&x.usage.search<=8&&x.usage.fetch<=20);
});
test('agent never admits company-mismatched careers pages even with search result relevance',async()=>{
 let responses=0,search=0;
 const mock=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  if(url.endsWith('/responses')){
   responses++;
   return reply({status:'completed',output:responses===1?
    [modelCall('search_jobs',{query:'内容运营 北京 岗位'},'search')]:[]});
  }
  if(url.endsWith('/search')){
   search++;
   return reply({results:search===1?[{url:jobURL,title:'内容运营',
    snippet:'工作地点 北京，本科学历，岗位职责'}]:
     [{url:corporate,title:'星河数字科技有限公司招聘'}]});
  }
  if(url.endsWith('/fetch')){
   if(body.url===jobURL)return reply({title:'内容运营',content:JD});
   if(body.url==='https://hrboard.cn/')return reply({title:'招聘平台',content:agencyHome});
   if(body.url===corporate)return reply({title:'星河数字科技有限公司',
    content:cleanCompany+'\n[招聘平台](https://jobs.hrboard.cn/companies/another-company)'});
  }
  throw Error('Unexpected request');
 };
 const got=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:mock,now,targetCount:1});
 assert.equal(got.candidates.length,0);
 assert.equal(got.quality_status,'NO_VERIFIED_JOBS');
 assert.equal(got.stats.job_details,1);
 assert.equal(got.stats.employer_proof.searches,1);
 assert.equal(got.stats.fetch_rejection_counts.COMPANY_LINK_UNPROVEN,1);
});
