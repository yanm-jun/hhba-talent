import test from 'node:test';
import assert from 'node:assert/strict';
import {
 safePublicJobUrl,simpleJobDirections,simpleJobQueries,discoverSimpleJobs,rankSimpleShortlist,mainlandWorkplaceEvidence
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


test('job workplace must be China Mainland; multi-location listings with foreign workplace are rejected',()=>{
 assert.equal(mainlandWorkplaceEvidence('工作地点：北京、东京').city,null);
 assert.equal(mainlandWorkplaceEvidence('工作地点：北京、东京').foreign,true);
 assert.equal(mainlandWorkplaceEvidence('工作地点：上海/纽约').city,null);
 assert.equal(mainlandWorkplaceEvidence('工作地点：上海\n工作地点：东京').city,null);
 assert.equal(mainlandWorkplaceEvidence('工作地点：上海\n工作地点：东京').foreign,true);
 assert.equal(mainlandWorkplaceEvidence('工作地点：上海\n工作地点：加拿大多伦多').city,null);

 assert.equal(mainlandWorkplaceEvidence('工作地点：东京\n公司总部：北京').city,null);
 assert.equal(mainlandWorkplaceEvidence('企业在北京有总部和员工，主营AI产品').city,null);
 assert.equal(mainlandWorkplaceEvidence('工作地点：上海。公司总部在美国').city,'上海');
 assert.equal(mainlandWorkplaceEvidence('工作地点：济南。AI 产品需求分析').city,'济南');
});
test('Mainland-only filter applies even to pre-existing internal job index',()=>{
 const inside=[
  {id:'foreign',company:'海外公司',title:'AI产品经理',location:'东京',reference_score:99},
  {id:'mixed',company:'企业甲',title:'产品经理',location:'上海 / 香港',reference_score:95},
  {id:'unknown',company:'企业乙',title:'运营专员',location:'全球远程',reference_score:90},
  {id:'domestic',company:'外资企业',title:'AI产品经理',location:'上海',reference_score:70},
  {id:'travel',company:'企业丙',title:'海外驻外销售经理',location:'广州',reference_score:97}
 ];
 const out=rankSimpleShortlist(inside,[],['AI产品经理'],[],10);
 assert.deepEqual(out.map(x=>x.id),['domestic']);
});
test('foreign office mentioned in job text does not exclude foreign-owned company recruiting in Mainland',async()=>{
 const mock=async(target,options)=>{
  const body=JSON.parse(options.body);
  if(target.endsWith('/search'))return new Response(JSON.stringify({results:[{
   url,title:'AI产品经理 | US-based Acme China',
   summary:'工作地点：上海。国际公司在华招聘AI产品经理。'
  }]}),{status:200});
  return new Response(JSON.stringify({title:'AI产品经理 | Acme China',content:[
   '# AI产品经理','工作地点：上海','岗位职责：负责AI产品需求、交互原型与版本验收。',
   '任职要求：良好的产品思维，公司总部位于美国。'
  ].join('\n')}),{status:200});
 };
 const out=await discoverSimpleJobs('demo-fake-key-123456789',['AI产品经理'],[],{fetcher:mock});
 assert.equal(out.jobs.length,1);
 assert.equal(out.jobs[0].location,'上海');
});
test('foreign workplaces in fetched job override any misleading domestic Search snippet',async()=>{
 const mock=async(target,options)=>{
  if(target.endsWith('/search'))return new Response(JSON.stringify({results:[{
   url,title:'AI产品经理 | 招聘企业',summary:'工作地点：上海。招聘AI产品经理。'
  }]}),{status:200});
  return new Response(JSON.stringify({title:'AI产品经理',content:[
   '# AI产品经理','工作地点：东京 / 上海',
   '公司总部在北京；岗位职责：产品策划与设计。','任职要求：相关项目经验。'
  ].join('\n')}),{status:200});
 };
 const out=await discoverSimpleJobs('demo-fake-key-123456789',['AI产品经理'],[],{fetcher:mock});
 assert.equal(out.jobs.length,0,'domestic location from snippet must not override mixed international job location');
});
test('generic job listings must not be passed off as direct individual apply pages',()=>{
 assert.equal(safePublicJobUrl('https://careers.examplecorp.com/jobs'),null);
 assert.equal(safePublicJobUrl('https://careers.examplecorp.com/jobs/detail'),null);
 assert.equal(safePublicJobUrl('https://careers.examplecorp.com/careers'),null);
 assert.equal(safePublicJobUrl('https://careers.examplecorp.com/jobs/ai-product-2026-001'),url);
});

test('actual regional sales supervisor CV remains brand-supervisor intent, not product manager',()=>{
 const resume='工作职位：上汽集团（MG 名爵）区域门店督导/终端运营；驻店八个月辅导经销商经营改善，DCC管理与销售顾问培训。意向岗位：品牌督导。意向城市：上海。';
 const roles=simpleJobDirections('品牌督导',{target_roles:['品牌督导']},resume);
 assert.equal(roles[0],'品牌督导');
 const queries=simpleJobQueries(roles,['上海']);
 assert.ok(queries.some(q=>q.includes('品牌督导')&&q.includes('上海')));
 assert.ok(queries.every(q=>!q.includes('产品经理')));
});
