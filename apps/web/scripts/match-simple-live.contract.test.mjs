import test from 'node:test';
import assert from 'node:assert/strict';
import {
 safePublicJobUrl,simpleJobDirections,simpleJobQueries,discoverSimpleJobs,rankSimpleShortlist
} from '../functions/_lib/match-simple-live-discovery.js';

const url='https://careers.examplecorp.com/jobs/ai-product-2026-001';
const search={results:[{
 title:'AI产品经理 - 示例科技',url,
 summary:'工作地点：济南。参与 AI Agent 产品需求设计，2027届校招。'
}]};
const fetched={title:'AI产品经理 | 示例科技',content:[
 '# AI产品经理','工作地点：济南',
 '岗位职责：负责 AI Agent 产品需求分析、产品原型和上线验收。',
 '任职要求：本科及以上学历，有真实产品项目实践经验。'
].join('\n')};
function fixture({page=true,searchFails=false}={}){
 const requests=[];
 const fetcher=async(target,options)=>{
  requests.push({url:target,body:JSON.parse(options.body)});
  if(target.endsWith('/search')){
   return new Response(searchFails?'failed':JSON.stringify(search),{
    status:searchFails?503:200,
    headers:{'Content-Type':'application/json'}
   });
  }
  if(target.endsWith('/fetch')){
   return new Response(page?JSON.stringify(fetched):'{"error":"missing"}',{
    status:page?200:404,
    headers:{'Content-Type':'application/json'}
   });
  }
  throw Error('Unexpected endpoint');
 };
 return {fetcher,requests};
}
test('broad source links are allowed, but search portals, credentials, HTTP and homepages are rejected',()=>{
 assert.equal(safePublicJobUrl(url),url);
 assert.equal(safePublicJobUrl('https://jobs.ashbyhq.com/example/abcd1234'),'https://jobs.ashbyhq.com/example/abcd1234');
 assert.equal(safePublicJobUrl('https://talent.baidu.com/jobs/detail/SOCIAL/12345678-1234-1234-9234-123456789abc')?.startsWith('https://talent.baidu.com'),true);
 assert.equal(safePublicJobUrl('https://zhipin.com/jobs/123456'),null);
 assert.equal(safePublicJobUrl('https://examplecorp.com/'),null);
 assert.equal(safePublicJobUrl('http://careers.example.com/jobs/123456'),null);
 assert.equal(safePublicJobUrl('https://user:pass@careers.example.com/jobs/123456'),null);
 assert.equal(safePublicJobUrl('https://localhost/jobs/12345'),null);
});
test('resume career direction derives AI product from project evidence without sending resume to Search',()=>{
 const resume='负责 HHBA AI Agent 产品原型设计，完成需求文档、版本验收、推广。';
 assert.deepEqual(simpleJobDirections('',{},resume).slice(0,2),['AI产品经理','产品经理']);
 const queries=simpleJobQueries(['AI产品经理','产品经理'],['济南']);
 assert.ok(queries.length>=2);
 assert.ok(queries.some(q=>q.includes('济南')));
 assert.ok(queries.every(q=>!q.includes('HHBA')&&q.length<=128));
});
test('live Search and Fetch can return specific Chinese role and directly navigable job URL',async()=>{
 const {fetcher,requests}=fixture();
 const out=await discoverSimpleJobs('synthetic-provider-secret', ['AI产品经理'],['济南'],{fetcher});
 assert.equal(out.jobs.length,1);
 assert.equal(out.jobs[0].official_url,url);
 assert.equal(out.jobs[0].location,'济南');
 assert.equal(out.jobs[0].source_status,'OFFICIAL_DETAIL_FETCHED');
 assert.ok(out.jobs[0].candidate_evidence.requirement.includes('产品需求分析'));
 assert.equal(out.meta.verified_details,1);
 assert.ok(requests.some(r=>r.url.endsWith('/search')));
 assert.ok(requests.some(r=>r.url.endsWith('/fetch')));
 const combined=rankSimpleShortlist([],out.jobs,['AI产品经理'],['济南'],10);
 assert.equal(combined.length,1);
 assert.ok(combined[0].reference_score>=70);
});
test('read failure does not turn a search-only specific mainland link into invented verified job',async()=>{
 const {fetcher}=fixture({page:false});
 const out=await discoverSimpleJobs('synthetic-provider-secret',['产品经理'],[],{fetcher});
 assert.equal(out.jobs.length,1);
 assert.equal(out.jobs[0].source_status,'SEARCH_RESULT_ONLY');
 assert.match(out.jobs[0].needs_verification[0],/未能独立读取/);
});
test('all DeepSeek Search failures must report real failure, never no jobs',async()=>{
 const {fetcher}=fixture({searchFails:true});
 await assert.rejects(discoverSimpleJobs('synthetic-provider-secret',['产品经理'],[],{fetcher}),/SEARCH_PROVIDER_ERROR/);
});
test('deduplicated result list does not drop English-titled jobs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../src/components/CandidateMatchResultDialog.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!chinese\)return original/);
 assert.match(src,/result\.matches\.filter\(job=>Boolean\(job\.title/);
});
