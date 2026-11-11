import test from 'node:test';
import assert from 'node:assert/strict';
import {
 KNOWLEDGE_CAPTURE_VERSION,knowledgeSourceUrl,normalizeKnowledgeCapture,
 knowledgeCaptureEnabled,knowledgeCaptureCallbacks,persistKnowledgeCapture
} from '../functions/_lib/knowledge-capture-v1.js';
import {searchPublicJobs} from '../functions/_lib/deepseek-search-match.js';

const sampleJob=(overrides={})=>({
 company:'测试智能汽车集团',title:'数据分析师',location:'上海',
 official_url:'https://careers.example.com/jobs/alpha-0123',match_score:83,
 recommendation_reason:'简历私有解释不要写入企业公共库',resume_id:'PRIVATE-RESUME-ID',
 phone:'13800000000',...overrides
});
function fakeD1(){
 const batches=[];
 return {
  batches,
  prepare(sql){return {bind(...values){return {sql,values};}};},
  async batch(statements){batches.push(statements);return statements.map(()=>({success:true}));}
 };
}

test('only employer-directed HTTPS candidates, never third-party boards, local IP or arbitrary ATS trust',()=>{
 assert.equal(knowledgeSourceUrl('https://www.zhipin.com/job_detail/123'),null);
 assert.equal(knowledgeSourceUrl('https://127.0.0.1/jobs/123'),null);
 assert.equal(knowledgeSourceUrl('http://careers.example.com/job/1'),null);
 assert.equal(knowledgeSourceUrl('https://careers.example.com/login'),null);
 const ats=knowledgeSourceUrl('https://jobs.lever.co/example/jobs/123');
 assert.equal(ats.source_kind,'EMPLOYER_ATS');
 // "EMPLOYER_ATS" is only a URL shape; no verification is conferred.
 assert.equal(knowledgeSourceUrl('https://careers.example.com/jobs/2').source_kind,
  'EMPLOYER_DOMAIN_CANDIDATE');
});

test('canonical storage removes tokens, emails and tracking but keeps harmless job IDs',()=>{
 const src=knowledgeSourceUrl('https://careers.example.com/job?postId=12345&token=myprivatekey&email=a%40b.com&utm_source=ad');
 assert.equal(src.canonical_url,'https://careers.example.com/job?postId=12345');
 assert.ok(!JSON.stringify(src).includes('myprivatekey'));
 assert.ok(!JSON.stringify(src).includes('a%40b'));
});

test('all public Search hit URLs are captured even if not in Top 10; employer is not guessed',()=>{
 const batch=normalizeKnowledgeCapture({hits:[
  {url:'https://careers.example.com/jobs/11',title:'运营岗位'},
  {url:'https://careers.another.com/jobs/22',title:'财务岗位'},
  {url:'https://www.51job.com/job/33',title:'第三方平台'}
 ]});
 assert.equal(batch.version,KNOWLEDGE_CAPTURE_VERSION);
 assert.equal(batch.sources.length,2);
 assert.equal(batch.employers.length,0);
 assert.equal(batch.jobs.length,0);
});

test('matched company becomes an unverified brand+host observation, distinct from a confirmed business',()=>{
 const batch=normalizeKnowledgeCapture({
  hits:[{url:'https://careers.example.com/jobs/alpha-0123'}],
  matches:[sampleJob()]
 });
 assert.equal(batch.sources.length,1);
 assert.equal(batch.employers.length,1);
 assert.equal(batch.jobs.length,1);
 assert.equal(batch.jobs[0].mainland_location,'上海');
 assert.ok(batch.jobs[0].occupation_tag);
 const serialized=JSON.stringify(batch);
 for(const privateField of ['PRIVATE-RESUME-ID','13800000000','简历私有解释','match_score'])
  assert.ok(!serialized.includes(privateField),privateField);
 assert.ok(!('industry_tags' in batch.employers[0]),'job title must NOT imply employer main industry');
});

test('same brand on different hosts does not automatically merge corporate legal identities',()=>{
 const batch=normalizeKnowledgeCapture({matches:[
  sampleJob({official_url:'https://careers.example.com/jobs/a'}),
  sampleJob({official_url:'https://jobs.lever.co/brand/jobs/b'})
 ]});
 assert.equal(batch.employers.length,2);
 assert.equal(batch.jobs.length,2);
});

test('closed, overseas, malformed or user-contaminated records are not saved as valid company jobs',()=>{
 const batch=normalizeKnowledgeCapture({matches:[
  sampleJob({location:'新加坡'}),
  sampleJob({company:'联系 13812345678',official_url:'https://careers.example.com/jobs/b'}),
  sampleJob({official_url:'https://www.zhipin.com/job_detail/12'}),
  sampleJob({company:'normal@company.com'})
 ]});
 assert.equal(batch.jobs.length,0);
 assert.equal(batch.employers.length,0);
});

test('persistence uses bounded prepared binds, idempotent upserts, NO trust elevation',async()=>{
 const db=fakeD1(),now=new Date('2026-11-11T06:00:00.000Z');
 const arg={hits:[{url:'https://careers.example.com/jobs/111'}],
  matches:[sampleJob({official_url:'https://careers.example.com/jobs/111'})]};
 const first=await persistKnowledgeCapture(db,arg,{now});
 const again=await persistKnowledgeCapture(db,arg,{now});
 assert.deepEqual(first,{sources:1,employers:1,jobs:1,statements:3});
 assert.deepEqual(again,first);
 assert.equal(db.batches.length,2);
 assert.deepEqual(db.batches[0].map(x=>x.values[0]),db.batches[1].map(x=>x.values[0]));
 const sql=db.batches.flat().map(x=>x.sql).join(' ');
 assert.ok(sql.includes('ON CONFLICT(id) DO UPDATE'));
 assert.ok(!/SET .*review_status|SET .*identity_status|SET .*evidence_status/i.test(sql));
 const entire=JSON.stringify(db.batches);
 assert.ok(!entire.includes('13800000000'));
 assert.ok(!entire.includes('简历私有解释'));
 assert.ok(!entire.includes('PRIVATE-RESUME-ID'));
});

test('no capture without rollout flag, D1 binding AND Cloudflare waitUntil',()=>{
 const db=fakeD1(),env={HHBA_PNVS_AUTH_DB:db};
 assert.equal(knowledgeCaptureEnabled(env,()=>{}),false);
 assert.deepEqual(knowledgeCaptureCallbacks(env,()=>{}),{});
 env.HHBA_KNOWLEDGE_CAPTURE_ENABLED='1';
 assert.equal(knowledgeCaptureEnabled(env,undefined),false);
 assert.equal(knowledgeCaptureEnabled(env,()=>{}),true);
});

test('Cloudflare waitUntil receives a fire-and-forget bounded internal write',async()=>{
 const db=fakeD1(),promises=[];
 const env={HHBA_KNOWLEDGE_CAPTURE_ENABLED:'1',HHBA_PNVS_AUTH_DB:db};
 const callbacks=knowledgeCaptureCallbacks(env,p=>promises.push(p));
 callbacks.onDiscoveredCandidates([{url:'https://careers.example.com/jobs/7'}]);
 callbacks.onDiscoveredMatches([sampleJob()]);
 await Promise.all(promises);
 assert.equal(promises.length,2);
 assert.equal(db.batches.length,2);
});

test('existing DeepSeek Search emits PUBLIC candidate URLs with no additional API calls',async()=>{
 let calls=0,observed=[];
 const result=await searchPublicJobs('TEST_KEY','', '',{
  queriesOverride:['数据分析师 官方招聘'],
  allowEmpty:true,
  fetcher:async (url)=>{
   calls++;
   assert.equal(url,'https://api.deepseek.com/v1/tools/search');
   return {ok:true,async json(){return {results:[
    {url:'https://careers.example.com/jobs/111',
     title:'数据分析师招聘',summary:'上海，工作岗位职责与要求'}
   ]};}};
  },
  onDiscoveredCandidates:hits=>observed.push(...hits)
 });
 assert.equal(calls,1);
 assert.equal(result.hits.length,1);
 assert.equal(observed.length,1);
 const batch=normalizeKnowledgeCapture({hits:observed});
 assert.equal(batch.sources.length,1);
 assert.equal(batch.employers.length,0);
});
