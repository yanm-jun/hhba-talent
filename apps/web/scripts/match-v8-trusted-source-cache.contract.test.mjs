import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TRUSTED_SOURCE_TTL_HOURS,validSourceProof,cachedSourceRecord,
 createTrustedEmployerSourceCache
} from '../functions/_lib/trusted-employer-source-cache.js';
import {
 publicJobLink,readPublicJob,inspectPublicEmployer,runDeepSeekOfficialJobAgent
} from '../functions/_lib/deepseek-official-job-agent.js';

const now=new Date('2026-11-09T05:00:00Z'),corp='星河数字科技有限公司';
const jobA='https://careers.xinghe.cn/jobs/2026110900001';
const jobB='https://careers.xinghe.cn/jobs/2026110900002';
const corporate='https://xinghe.cn/';
const board='https://jobs.hrboard.cn/companies/xinghe';
const ats1=board+'/jobs/202611090001';
const ats2=board+'/jobs/202611090002';
const siteContent='# 星河数字科技有限公司\n'+
 ('星河数字科技有限公司公司介绍、团队成员及官方招聘。').repeat(10);
const jd=(city='北京',closed=false,claim=corp)=>[
 '# 内容运营','招聘单位：'+claim,
 '工作地点：'+city,'岗位职责',
 '负责公众号内容编辑、短视频运营、用户增长和项目执行管理。'.repeat(6),
 '任职要求','本科及以上学历，具有新媒体和内容渠道运营经验。'.repeat(6),
 '立即申请',...(closed?['职位已关闭']:[])
].join('\n');
const read=(url,city='北京',company=corp,closed=false)=>
 readPublicJob(publicJobLink(url),{title:'内容运营 - '+company,
  content:jd(city,closed,company)},now);

function fakeD1(){
 const rows=new Map();let reads=0,writes=0;
 return {
  rows,
  get reads(){return reads;},
  get writes(){return writes;},
  prepare(sql){
   return {bind(...args){
    return {
     async all(){
      assert.match(sql,/SELECT employer_claim/);
      reads++;
      const [company,host,date]=args;
      return {results:[...rows.values()].filter(x=>x.employer_claim===company&&
       x.job_hostname===host&&x.expires_at>date).sort((a,b)=>
        b.proof_scope.length-a.proof_scope.length).slice(0,12)};
     },
     async run(){
      assert.match(sql,/INSERT INTO hhba_match_trusted_employer_sources/);
      writes++;
      const [employer_claim,job_hostname,proof_scope,proof_method,
       employer_site,verified_at,expires_at]=args;
      rows.set([employer_claim,job_hostname,proof_scope].join('|'),
       {employer_claim,job_hostname,proof_scope,proof_method,employer_site,
        verified_at,expires_at});
      return {success:true,meta:{changes:1}};
     }
    };
   }};
  }
 };
}
test('Only independent inspected employer proofs can create an expiring cache entry',()=>{
 assert.equal(TRUSTED_SOURCE_TTL_HOURS,72);
 const original=read(jobA);
 const checked=inspectPublicEmployer(original,{
  title:corp+' 官网',content:siteContent},corporate);
 assert.equal(checked.reason,'VERIFIED');
 assert.equal(checked.cache_scope,'https://careers.xinghe.cn/');
 const entry=cachedSourceRecord(checked,original,now);
 assert.equal(entry?.proof_method,'CORPORATE_DOMAIN_AND_BRAND');
 assert.equal(entry?.employer_site,corporate);
 assert.equal(entry?.job_hostname,'careers.xinghe.cn');
 assert.equal(validSourceProof(entry,read(jobB),now)?.company,corp);
 assert.equal(validSourceProof(entry,read(jobB),now)?.source_proof_cache,
  'VALID_72H_EMPLOYER_SOURCE');
 const old=new Date(now.getTime()+73*3600000);
 assert.equal(validSourceProof(entry,read(jobB),old),null);
 assert.equal(cachedSourceRecord({reason:'NOT_VERIFIED',job:checked.job,
  cache_scope:checked.cache_scope},original,now),null);
 assert.equal(validSourceProof({...entry,employer_claim:'其他公司'},read(jobB),now),null);
 assert.equal(validSourceProof({...entry,proof_scope:'https://evil.cn/'},read(jobB),now),null);
 assert.equal(read(jobA,'东京'),null);
 assert.equal(read(jobA,'北京',corp,true),null);
 assert.equal(validSourceProof(entry,read(jobA,'北京','另外科技有限公司'),now),null);
});
test('Shared ATS sources cache ONLY the authenticated tenant; no root or other tenant',()=>{
 const job=read(ats1);
 const page={title:corp,content:siteContent+'\n[官方招聘入口]('+board+')'};
 const inspected=inspectPublicEmployer(job,page,'https://xinghe.cn/careers');
 assert.equal(inspected.reason,'VERIFIED');
 assert.equal(inspected.job.source_verification,'CORPORATE_NAMED_BOARD_LINK');
 const row=cachedSourceRecord(inspected,job,now);
 assert.equal(row?.proof_scope,board);
 assert.equal(validSourceProof(row,read(ats2),now)?.company,corp);
 assert.equal(validSourceProof(row,read('https://jobs.hrboard.cn/companies/other/jobs/202611090002'),now),null);
 assert.equal(validSourceProof(row,read('https://jobs.hrboard.cn/companies/xinghe-evil/jobs/202611090002'),now),null);
 assert.equal(validSourceProof({...row,proof_scope:'https://jobs.hrboard.cn/'},read(ats2),now),null);
 assert.equal(validSourceProof({...row,proof_scope:'https://jobs.hrboard.cn/jobs'},read(ats2),now),null);
 assert.equal(validSourceProof({...row,proof_method:'CORPORATE_EXACT_JOB_LINK'},read(ats2),now),null);
 const exact=inspectPublicEmployer(job,{title:corp,
  content:siteContent+'\n[招聘职位]('+ats1+')'},corporate);
 const exactRecord=cachedSourceRecord(exact,job,now);
 assert.equal(validSourceProof(exactRecord,read(ats1),now)?.company,corp);
 assert.equal(validSourceProof(exactRecord,read(ats2),now),null);
});
test('Across independent model recommendations, fresh JD is fetched but corporate site is reused',async()=>{
 const db=fakeD1(),cache=createTrustedEmployerSourceCache(db,{now:()=>now});
 const secret='synthetic-key-only-contract';
 let searchCount=0,corporateFetches=0,detailFetches=0;
 const provider=async(uri,options)=>{
  const input=JSON.parse(options.body);
  if(uri.endsWith('/responses'))return Response.json({
   status:'completed',
   usage:{input_tokens:170,input_tokens_details:{cached_tokens:40},output_tokens:50},
   output:[{type:'function_call',call_id:'search-1',name:'search_jobs',
    arguments:JSON.stringify({query:'内容运营 企业官方岗位 工作地点 北京'})}]
  });
  if(uri.endsWith('/search')){
   searchCount++;
   return Response.json({results:[{
    url:searchCount===1?jobA:jobB,title:'内容运营 - '+corp,
    snippet:'内容运营岗位职责、工作城市北京、任职要求本科及以上，立即申请'
   }]});
  }
  if(uri.endsWith('/fetch')){
   if(input.url===corporate){
    corporateFetches++;return Response.json({title:corp+' 官网',content:siteContent});
   }
   if(input.url===jobA||input.url===jobB){
    detailFetches++;return Response.json({title:'内容运营 - '+corp,content:jd()});
   }
   throw Error('unexpected URL');
  }
  throw Error('unexpected endpoint');
 };
 const first=await runDeepSeekOfficialJobAgent('内容运营',secret,{
  fetcher:provider,now,targetCount:1,trustedSourceCache:cache});
 assert.equal(first.stats.verified,1);
 assert.equal(first.stats.trusted_source_cache.hits,0);
 assert.equal(first.stats.trusted_source_cache.writes,1);
 assert.equal(first.usage.fetch,2);
 assert.equal(db.rows.size,1);
 const second=await runDeepSeekOfficialJobAgent('内容运营',secret,{
  fetcher:provider,now,targetCount:1,trustedSourceCache:cache});
 assert.equal(second.stats.verified,1);
 assert.equal(second.stats.trusted_source_cache.hits,1);
 assert.equal(second.stats.employer_proof.corporate_page_fetches,0);
 assert.equal(second.usage.fetch,1);
 assert.equal(second.candidates[0].official_url,jobB);
 assert.equal(second.candidates[0].source_verification,'CORPORATE_DOMAIN_AND_BRAND');
 assert.equal(corporateFetches,1);
 assert.equal(detailFetches,2);
 assert.equal(db.reads,2);
 assert.equal(db.writes,1);
 assert.ok(second.usage.model<=4&&second.usage.search<=8&&second.usage.fetch<=20);
});
test('Cache D1 read/write outage forces fresh employer proof, not a guessed job',async()=>{
 const down={prepare(){throw Error('D1_SIMULATED_OUTAGE')}};
 const cache=createTrustedEmployerSourceCache(down,{now:()=>now});
 assert.equal(await cache.lookup(read(jobA)),null);
 assert.equal(await cache.remember(inspectPublicEmployer(read(jobA),{
  title:corp,content:siteContent},corporate),read(jobA)),false);
 assert.equal(createTrustedEmployerSourceCache(null),null);
});
