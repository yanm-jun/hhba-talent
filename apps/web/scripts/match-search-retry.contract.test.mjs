import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPublicJobs} from '../functions/_lib/deepseek-search-match.js';

const url='https://careers.example-auto.cn/jobs/regional-supervisor-20261122';
const response=()=>new Response(JSON.stringify({results:[{
 url,title:'星河汽车有限公司 区域督导 上海 招聘',
 site_name:'星河汽车官方招聘',summary:'工作地点：上海。岗位职责：管理区域经销商销售培训和门店运营。'
}]}),{status:200,headers:{'Content-Type':'application/json'}});

test('one transient 503 is retried inside the existing query deadline; a real employer job survives',async()=>{
 let calls=0;
 const result=await searchPublicJobs('synthetic','脱敏的区域督导简历','区域督导',{
  queriesOverride:['区域督导 上海 企业官网'],queryTimeoutMs:8000,allowEmpty:true,
  fetcher:async()=>{
   calls++;
   return calls===1?Response.json({error:'temporary unavailable'},{status:503}):response();
  }
 });
 assert.equal(calls,2);
 assert.equal(result.hits.length,1);
 assert.equal(result.hits[0].url,url);
 assert.equal(result.diagnostic.retry_attempts,1);
 assert.equal(result.diagnostic.retry_recovered,1);
 assert.equal(result.diagnostic.search_failures,0);
});
test('invalid credentials never retry, never become a false no-jobs verdict',async()=>{
 let calls=0;
 await assert.rejects(searchPublicJobs('synthetic','脱敏的区域督导简历','区域督导',{
  queriesOverride:['汽车督导 上海 企业官网'],queryTimeoutMs:8000,allowEmpty:true,
  fetcher:async()=>{calls++;return Response.json({error:'denied'},{status:401});}
 }),err=>err.code==='AI_PROVIDER_KEY_REJECTED');
 assert.equal(calls,1);
});
test('other healthy search directions survive one provider outage without fabricated results',async()=>{
 let calls=0;
 const out=await searchPublicJobs('synthetic','脱敏简历','区域督导',{
  queriesOverride:['区域督导 上海 企业官网','汽车渠道 上海 企业官网'],
  queryTimeoutMs:8000,allowEmpty:true,
  fetcher:async(_url,args)=>{
   const query=JSON.parse(args.body).query;
   calls++;
   return query.startsWith('区域督导')?Response.json({}, {status:503}):response();
  }
 });
 assert.equal(out.hits.length,1);
 assert.equal(out.diagnostic.successful_searches,1);
 assert.equal(out.diagnostic.search_failures,1);
 assert.equal(out.diagnostic.retry_attempts,1);
 assert.equal(calls,3);
});
