import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';
import {enrichSearchMatchesWithJD,MATCH_JD_PIPELINE} from '../functions/_lib/match-jd-enrichment.js';
import {directOfficialJobEvidence} from '../functions/_lib/official-job-evidence.js';
import {readJobJdById,hydrateVerifiedJobRequirements,safeJDSourceLocator} from '../functions/_lib/job-jd-archive.js';

const resume='学历：本科\n工作经历\n2025.01-2026.07 虚构的星海门店 区域运营经理，负责多家门店经营管理，熟练使用 Excel 进行数据分析。';
const roles=[
 {company:'腾讯',title:'区域运营经理',location:'上海',url:'https://careers.tencent.com/jobdesc.html?postId=999999000001',
  duty:'负责直营门店的区域运营管理、销售目标分解、定期经营数据分析及客户服务流程协调。', requirement:'熟练使用 Excel 工具，负责数据分析与门店经营管理。'},
 {company:'腾讯',title:'门店运营主管',location:'北京',url:'https://careers.tencent.com/jobdesc.html?postId=999999000002',
  duty:'负责门店运营、库存优化和跨团队交付，维护服务的质量与可用性，推动流程改造。',requirement:'熟练使用 SQL 进行门店经营数据分析，有 Tableau 数据可视化经验者优先。'},
 {company:'腾讯',title:'项目运营主管',location:'深圳',url:'https://careers.tencent.com/jobdesc.html?postId=999999000003'}
];
function fromRole(role,i){
 return {id:'j'+(i+1),url:role.url,source:role.company+'招聘',title:role.title,
 summary:role.company+'招聘'+role.title+'。工作地点：'+role.location+'。职位简介：负责团队项目交付。',availability:{status:'UNKNOWN'}};
}
function evidenceHtml(role){
 return '<h1>'+role.title+'</h1><p>'+role.company+'招聘公开详情，仅用于合成自动化测试。我们欢迎希望贡献技术与职业能力的求职者直接浏览企业岗位信息。</p>'+
  '<h2>岗位职责</h2><p>'+role.duty+'</p><p>与区域同事协同规划项目执行，定期整理业务进展并分派后续任务。</p>'+
  '<h2>任职要求</h2><p>'+role.requirement+'</p><p>具备严谨的报告撰写和跨部门沟通协作能力，并能按期完成任务。</p>'+
  '<p>工作地点：'+role.location+'</p><p>立即申请</p>';
}
function fixtureStorage(){
 const rows=new Map(),objects=new Map();
 const db={prepare(sql){let args=[];const stmt={
  bind(...values){args=values;return stmt;},
  async all(){
   assert.match(sql,/sqlite_master/);
   return {results:[{name:'hhba_job_jd_versions'},{name:'hhba_job_jd_fetch_attempts'}]};
  },
  async first(){
   if(sql.includes('FROM hhba_jd_posting_lifecycle'))return null;
   if(sql.includes('WHERE id=?'))return rows.get(args[0])??null;
   if(sql.includes('WHERE canonical_url=?'))return [...rows.values()].find(r=>r.canonical_url===args[0])??null;
   throw Error('Unexpected fixture D1 statement: '+sql);
  },
  async run(){
   assert.match(sql,/^INSERT INTO hhba_job_jd_versions/);
   const [id,canonical_url,url_sha256,company,title,location,jd_sha256,object_key,text_bytes,proof_method,content_status,first_verified_at,last_verified_at]=args;
   rows.set(id,{id,canonical_url,url_sha256,company,title,location,jd_sha256,object_key,text_bytes,proof_method,content_status,first_verified_at,last_verified_at});
   return {success:true,meta:{changes:1}};
  }
 };return stmt;}};
 const r2={async put(k,v){objects.set(k,v);},async head(k){return objects.has(k)?{key:k}:null;},
 async get(k){return objects.has(k)?{text:async()=>objects.get(k)}:null;}};
 return {env:{HHBA_MATCH_JD_ENRICH_ENABLED:'1',HHBA_JOB_JD_DB:db,HHBA_JOB_JD_R2:r2},rows,objects};
}

test('model decisions and source discovery flow into direct employer JD fetch, immutable storage, grounded scoring, and Word payload',async()=>{
 const queryLog=[], fetched=[], decisions=[], candidates=roles.map(fromRole);
 const excluded=[
  {id:'j4',source:'苹果招聘',title:'搜索职位',url:'https://jobs.apple.com/zh-cn/search?location=hangzhou-HNG',
   summary:'搜索结果 4 条，当前筛选杭州（中国内地）；浏览多个职位。',availability:{status:'UNKNOWN'}},
  {id:'j5',...fromRole({company:'腾讯',title:'已结束运营主管',location:'广州',url:'https://careers.tencent.com/jobdesc.html?postId=999999000005'},4),
   availability:{status:'CLOSED_LISTED'}}
 ];
 const raw=await runAgentOwnedMainlandMatch('synthetic-key',resume,'',10,{expandDetailed:false},{
  plan:async()=>({queries:['连锁门店 经营分析 企业官方招聘']}),
  search:async(k,cv,hint,{queriesOverride})=>{
   assert.equal(k,'synthetic-key');
   queryLog.push(...queriesOverride);
   assert.ok(queriesOverride.every(q=>!q.includes('虚构的星海门店')));
   return {hits:queriesOverride.some(q=>q.includes('研发相邻岗位'))?[...candidates,...excluded]:[candidates[0]],
    diagnostic:{successful_searches:queriesOverride.length,raw_results:queriesOverride.length}};
  },
  decide:async(k,cv,hint,pool)=>{
   decisions.push(pool.length);
   if(decisions.length===1)return {actions:[{type:'search',queries:['研发相邻岗位 企业官方招聘']}]};
   return {actions:[{type:'finish'}],shortlist_ids:pool.map(hit=>hit.id)};
  },
  fetchDetails:async(k,pool)=>({hits:pool,fetches:0}),
  // We exercise real source-only fallback rather than granting mocked AI any evidence-based score.
  // Avoid a 95-second wait: simulate the timing failure at the provider boundary.
  // The actual source-only selector must recover factual cards even if both model shortlist passes time out.
  select:async()=>{throw new DOMException('synthetic shortlist timeout','TimeoutError');},
  recover:async()=>[]
 });
 assert.ok(queryLog.some(q=>q.includes('研发相邻岗位')));
 assert.equal(raw.matches.length,3);
 assert.deepEqual(raw.matches.map(x=>x.official_url).sort(),roles.map(x=>x.url).sort());
 assert.ok(raw.diagnostic.selection_failures>=1);
 assert.equal(raw.diagnostic.unscored_source_previews,3);
 assert.ok(raw.matches.every(j=>j.match_score===null&&j.jd_version_id===undefined));
 const {env,rows,objects}=fixtureStorage();
 const result=await enrichSearchMatchesWithJD(env,raw.matches,resume,{domesticOnly:true,role_hint:'区域运营经理'},{
  fetchDirect:url=>directOfficialJobEvidence(url,{fetcher:async(input,init)=>{
   assert.equal(init.redirect,'manual');
   fetched.push(input);
   const role=roles.find(j=>j.url===input);
   assert.ok(role,'unexpected fetch destination');
   return new Response(role.duty?evidenceHtml(role):'<h1>项目运营主管</h1><p>工作地点：深圳；暂时只显示公开摘要。</p>',{
    headers:{'content-type':'text/html; charset=utf-8'}});
  }})
 });
 assert.equal(result.diagnostic.mode,MATCH_JD_PIPELINE);
 assert.equal(result.diagnostic.verified,2);
 assert.equal(result.diagnostic.failed,1);
 assert.deepEqual([...fetched].sort(),roles.map(x=>x.url).sort());
 const positive=roles.slice(0,2).map(role=>result.matches.find(j=>j.official_url===role.url));
 const negative=result.matches.find(j=>j.official_url===roles[2].url);
 assert.equal(rows.size,2);
 assert.equal(objects.size,2);
 assert.notEqual(positive[0].jd_version_id,positive[1].jd_version_id);
 assert.notEqual(positive[0].jd_sha256,positive[1].jd_sha256);
 for(const [i,job] of positive.entries()){
 
  assert.equal(job.jd_source_status,'VERIFIED_JD');
  assert.match(job.jd_version_id,/^jd_[a-f0-9]{32}$/);
  assert.match(job.jd_sha256,/^[a-f0-9]{64}$/);
  assert.equal(job.jd_score_status,'V2_JD_EVIDENCE_SCORED');
  assert.equal(typeof job.match_score,'number');
  const archived=await readJobJdById(env,job.jd_version_id);
  assert.ok(archived.full_jd.includes(roles[i].requirement));
  assert.ok(!archived.full_jd.includes('虚构的星海门店'));
  const target=await hydrateVerifiedJobRequirements(env,{official_url:job.official_url,jd_version_id:job.jd_version_id,
   title:'untrusted client title',requirements:'untrusted client requirements'});
  assert.equal(target.jd_sha256,job.jd_sha256);
  assert.equal(target.title,job.title);
  assert.ok(target.requirements.includes(roles[i].requirement));
  await assert.rejects(hydrateVerifiedJobRequirements(env,{official_url:positive[1-i].official_url,jd_version_id:job.jd_version_id}),
   /JD_JOB_IDENTITY_MISMATCH/);
 }
 assert.ok(positive[0].match_score>positive[1].match_score,'job with a less supported skill must rank below the matched role');
 assert.equal(negative.match_score,null);
 assert.equal(negative.jd_version_id,undefined);
 assert.notEqual(negative.jd_source_status,'VERIFIED_JD');
 const keyFields=['id','title','company','official_url','jd_version_id','jd_sha256','match_score','jd_source_status','location','recruitment_source_kind','jd_proof_method'];
 const selectKeys=job=>Object.fromEntries(keyFields.filter(k=>job[k]!==undefined).map(k=>[k,job[k]]));
 if(process.env.HHBA_GATE_FIXTURE_JSON){
  const verified=await Promise.all(positive.map(async job=>{
   const archived=await readJobJdById(env,job.jd_version_id);
   return {...selectKeys(job),full_jd:archived.full_jd,proof_method:archived.proof_method};
  }));
  writeFileSync(process.env.HHBA_GATE_FIXTURE_JSON,
   JSON.stringify({verified,excerptOnly:selectKeys(negative)},null,2)+'\n');
 }
});

test('current independent trust registry accepts fixed detail routes but not arbitrary index or unregistered employer postings',()=>{
 assert.ok(safeJDSourceLocator(roles[0].url));
 assert.ok(safeJDSourceLocator(roles[1].url));
 assert.equal(safeJDSourceLocator('https://careers.tencent.com/search.html'),null);
 assert.equal(safeJDSourceLocator('https://careers.unknown.example/jobs/42'),null);
 assert.equal(safeJDSourceLocator('https://www.novartis.com/au-en/careers/career-search/job/details/req-10090943-gaojizishendequjingli-zh-cn'),null,
  'known remaining coverage gap: exact official employer detail can be a Search lead but is not an independently archivable JD under the current registry');
});
