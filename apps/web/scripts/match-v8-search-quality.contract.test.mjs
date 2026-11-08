import test from 'node:test';
import assert from 'node:assert/strict';
import {
 searchEvidenceHints,orderPublicJobCandidates
} from '../functions/_lib/deepseek-job-search-quality.js';
import {
 publicJobLink,readPublicJob,runDeepSeekOfficialJobAgent
} from '../functions/_lib/deepseek-official-job-agent.js';

const now=new Date('2026-11-08T12:00:00Z');
const job='https://careers.yunhe.cn/jobs/202611080041';
const home='https://yunhe.cn/';
const base={
 url:job,title:'内容运营专员 - 云禾文化有限公司',
 rerank_score:2.1,authority:3,date:'2026-11-05T00:00:00+08:00'
};
const evidence={
 ...base,snippet:'工作地点：北京，岗位职责：负责内容策划，任职要求：本科学历，立即投递',
 summary:'职位工作地点：北京市；工作职责：公众号内容推广；任职要求：本科及以上学历，在线申请'
};
const generic={...base,title:'云禾文化有限公司招聘首页 / 职位列表',
 snippet:'内容运营岗位汇总、各地招聘公告及职业规划',summary:'工作地点：北京'};
test('DeepSeek result hints rank a dated individual JD over a recruitment listing',()=>{
 const relevant=searchEvidenceHints(evidence,['内容运营'],now);
 const listing=searchEvidenceHints(generic,['内容运营'],now);
 assert.equal(relevant.hint_only,true);
 assert.equal(relevant.work_city_hint,true);
 assert.equal(relevant.requirements_hint,true);
 assert.equal(relevant.duties_hint,true);
 assert.equal(relevant.apply_hint,true);
 assert.ok(relevant.score>listing.score);
 assert.equal(listing.listing_warning,true);
 assert.equal(searchEvidenceHints({...base,date:'2024-01-01T00:00:00Z'},['内容运营'],now).work_city_hint,false);
});
test('Pre-Fetch ranking avoids generic listings and protects employer diversity',()=>{
 const make=(domain,id,summary,score=2)=>({
  url:'https://'+domain+'/jobs/'+id,domain,search_title:'内容运营 - '+domain,
  search_metadata:{title:'内容运营 - '+domain,url:'https://'+domain+'/jobs/'+id,
   snippet:summary,rerank_score:score}
 });
 const input=[
  make('jobs.a.cn','202611080001','工作地点：北京 任职要求：本科 岗位职责：负责运营'),
  make('jobs.a.cn','202611080002','工作地点：北京 任职要求：本科 岗位职责：负责运营'),
  make('jobs.a.cn','202611080003','工作地点：北京 任职要求：本科 岗位职责：负责运营'),
  make('jobs.a.cn','202611080004','工作地点：北京 任职要求：本科 岗位职责：负责运营'),
  make('jobs.b.cn','202611080005','工作地点：上海 任职要求：本科 岗位职责：负责运营'),
  make('jobs.c.cn','202611080006','工作地点：杭州 任职要求：本科 岗位职责：负责运营'),
  {...make('jobs.d.cn','202611080007','工作地点：深圳'),
   search_metadata:{title:'内容运营 职位列表',url:'https://jobs.d.cn/jobs/202611080007',
    snippet:'工作地点：深圳'}}
 ];
 const ranked=orderPublicJobCandidates(input,['内容运营'],{maxPerDomain:2,limit:6,now});
 assert.equal(ranked.length,6);
 assert.equal(ranked.slice(0,4).filter(x=>x.domain==='jobs.a.cn').length,2);
 assert.equal(ranked.some(x=>x.domain==='jobs.b.cn'),true);
 assert.equal(ranked.some(x=>x.domain==='jobs.c.cn'),true);
 assert.equal(ranked.some(x=>x.domain==='jobs.d.cn'),false);
 assert.ok(ranked.every(x=>x.rank.hint_only&&x.rank.score>=0));
});
test('Snippet appears relevant but never becomes independent position proof',()=>{
 const link=publicJobLink(job);
 assert.ok(searchEvidenceHints(evidence,['内容运营'],now).score>50);
 const rejection={};
 assert.equal(readPublicJob(link,{content:'只有招聘资讯摘要，没有完整职位正文'},now,rejection),null);
 assert.equal(rejection.SHORT_PAGE,1);
});
test('Bounded postpass prefers evidence-rich public search hit and does not fetch irrelevant JD',async()=>{
 const key='synthetic-key-without-access',low='https://careers.yunhe.cn/jobs/202611080042';
 const other='https://careers.yunhe.cn/jobs/202611080043';
 const company='# 云禾文化有限公司\n'+('云禾文化有限公司官方主页与社会招聘，公司主营数字内容服务。').repeat(8);
 const jd=[
  '# 内容运营', '公司名称：云禾文化有限公司','工作地点：北京',
  '岗位职责','负责内容编辑、短视频选题、内容项目执行与用户维护。'.repeat(5),
  '任职要求','本科及以上学历，有内容创作和新媒体运营经验，熟悉社交媒体。'.repeat(5),
  '立即投递'
 ].join('\n');
 let model=0,search=0,fetches=0;const fetched=[];
 const tool=(name,args,call_id)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id});
 const mock=async(url,opts)=>{
  if(url.endsWith('/responses')){
   model++;
   if(model===1)return Response.json({status:'completed',output:[
    tool('search_jobs',{query:'内容运营 北京 官网 工作地点 任职要求'},'q1')]});
   return Response.json({status:'completed',output:[]});
  }
  if(url.endsWith('/search')){search++;
   return Response.json({results:[
    {url:low,title:'内容运营 - 云禾文化有限公司',snippet:'普通职位页面',rerank_score:0.4},
    {url:other,title:'应聘通知汇总 - 云禾文化有限公司',
     snippet:'招聘公告 职位列表 岗位汇总'},
    {url:job,title:'内容运营 - 云禾文化有限公司',
     snippet:'工作地点：北京，任职要求：本科及以上，岗位职责：负责内容策划，立即投递',
     rerank_score:2.8,authority:3,date:'2026-11-05T00:00:00Z'}
   ]});
  }
  if(url.endsWith('/fetch')){
   fetches++;const data=JSON.parse(opts.body);fetched.push(data.url);
   if(data.url===job)return Response.json({title:'内容运营',content:jd});
   if(data.url===home)return Response.json({title:'云禾文化有限公司',content:company});
   throw Error('Irrelevant job must never be fetched before evidence-rich job');
  }
  throw Error('Provider path mismatch');
 };
 const out=await runDeepSeekOfficialJobAgent('内容运营',key,{fetcher:mock,now,targetCount:1});
 assert.equal(model,2);
 assert.equal(search,1);
 assert.equal(fetches,2);
 assert.deepEqual(fetched,[job,home]);
 assert.equal(out.candidates.length,1);
 assert.equal(out.stats.postpass_job_reads,1);
 assert.equal(out.stats.search_quality_hints.candidate_links,3);
 assert.equal(out.stats.search_quality_hints.work_city,1);
 assert.equal(out.stats.search_quality_hints.requirements,1);
 assert.equal(out.stats.search_quality_hints.apply,1);
 assert.equal(out.accounting.complete,false,'no mock model token usage should be treated as incomplete billing');
});

test('Public corporate-site Search hint advances same-domain vacancy without certifying it',()=>{
 const make=(domain,city,score)=>({
  url:'https://careers.'+domain+'/jobs/202611080155',domain,
  search_metadata:{title:'内容运营 - 企业岗位',url:'https://careers.'+domain+'/jobs/202611080155',
   snippet:'岗位职责：负责内容运营，任职要求：本科，工作地点：'+city,
   rerank_score:score}
 });
 const unknown=make('other.cn','北京',3);
 const siteDiscovered=make('enterprise.cn','济南',0);
 const base=orderPublicJobCandidates([unknown,siteDiscovered],['内容运营'],{now});
 const ranked=orderPublicJobCandidates([unknown,siteDiscovered],['内容运营'],{
  now,corporateSiteDomains:['enterprise.cn']});
 assert.equal(base[0].domain,'other.cn');
 assert.equal(ranked[0].domain,'enterprise.cn');
 assert.equal(ranked[0].source_hint,'CORPORATE_SITE_SEEN');
 assert.equal(ranked[0].rank.hint_only,true);
 assert.equal(ranked[1].source_hint,'UNCONFIRMED');
 // An unrelated corporate website is not a reason to boost or accept a job.
 assert.equal(orderPublicJobCandidates([unknown,siteDiscovered],['内容运营'],{
  now,corporateSiteDomains:['unrelated.cn']})[0].domain,'other.cn');
});
