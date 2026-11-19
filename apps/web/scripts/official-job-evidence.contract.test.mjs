import test from 'node:test';
import assert from 'node:assert/strict';
import {directOfficialJobEvidence,validatedCachedOfficialJob} from '../functions/_lib/official-job-evidence.js';
import {sameEngineReassessment} from '../functions/_lib/resume-reassessment.js';

const url='https://careers.tencent.com/jobdesc.html?postId=123456789012345';
const html=`<!doctype html><html lang="zh"><head><title>腾讯校园招聘</title>
<script>document.write('隐藏岗位职责 任职要求 中国大陆');</script></head><body>
<h1>数据分析师</h1><p>工作地点：上海</p>
<h2>岗位职责</h2><p>负责运营指标分析、推动跨团队项目协作、构建业务观察指标和日常报表。</p>
<h2>任职要求</h2><p>熟悉 Python、SQL，能够独立处理数据分析任务，具有较强的团队沟通能力和项目总结能力。</p>
<button>立即申请</button></body></html>`;
function page(body=html,options={}){
 return Response.json({},options);
}
test('direct HTTPS employer page produces a content-hashed, verified JD',async()=>{
 const calls=[];
 const evidence=await directOfficialJobEvidence(url,{fetcher:async(link,options)=>{
  calls.push({link,options});
  return new Response(html,{status:200,headers:{'Content-Type':'text/html'}});
 }});
 assert.equal(calls.length,1);
 assert.equal(calls[0].link,url);
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(evidence.company,'腾讯');
 assert.equal(evidence.location,'上海');
 assert.equal(evidence.title,'数据分析师');
 assert.equal(evidence.proof_method,'DIRECT_EMPLOYER_HTML_V1');
 assert.match(evidence.id,/^verified-official-[a-f0-9]{32}$/);
 assert.match(evidence.requirements,/Python/);
 assert.doesNotMatch(evidence.requirements,/隐藏岗位职责/);
 const cached=await validatedCachedOfficialJob(evidence);
 assert.ok(cached);
 assert.ok(cached.required_skills.includes('Python'));
 assert.ok(cached.required_skills.includes('SQL'));
});
test('only exact official job paths can be fetched; redirects and missing JD fail closed',async()=>{
 let fetched=0;
 const fetcher=async()=>{fetched++;return new Response(html,{headers:{'Content-Type':'text/html'}});};
 await assert.rejects(()=>directOfficialJobEvidence('https://malicious.example/position/123',{fetcher}),/OFFICIAL_URL_NOT_SUPPORTED/);
 await assert.rejects(()=>directOfficialJobEvidence('https://careers.tencent.com.evil.example/jobdesc.html?postId=123456789012345',{fetcher}),/OFFICIAL_URL_NOT_SUPPORTED/);
 await assert.rejects(()=>directOfficialJobEvidence(url+'&redirect=http://evil.example',{fetcher}),/OFFICIAL_URL_NOT_SUPPORTED/);
 assert.equal(fetched,0);
 await assert.rejects(()=>directOfficialJobEvidence(url,{fetcher:async()=>new Response('',{status:302,headers:{Location:'https://elsewhere.example'}})}),/OFFICIAL_PAGE_UNAVAILABLE/);
 await assert.rejects(()=>directOfficialJobEvidence(url,{fetcher:async()=>new Response('<p>登录后查看</p>',{headers:{'Content-Type':'text/html'}})}),/OFFICIAL_JD_NOT_VERIFIED/);
});
test('stale, modified and tampered cached JD cannot be used for V2 scores',async()=>{
 const good=await directOfficialJobEvidence(url,{fetcher:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})});
 assert.equal(await validatedCachedOfficialJob({...good,requirements:good.requirements+'篡改'}),null);
 assert.equal(await validatedCachedOfficialJob({...good,checked_at:'2020-01-01T00:00:00.000Z'}),null);
 assert.equal(await validatedCachedOfficialJob({...good,canonical_url:'https://evil.example/job'}),null);
 const trusted=await validatedCachedOfficialJob(good);
 const profile={education:null,experience_years:null,target_roles:[],skills:[]};
 const before=[{id:'source-0',section:'summary',text:'负责运营日报与基础报表分析工作'}];
 const after=[{...before[0],text:'负责运营日报与基础报表分析工作，真实使用 Python 和 SQL 整理业务数据'}];
 const scores=sameEngineReassessment(trusted,profile,before,after);
 assert.equal(scores.supported,true);
 assert.equal(scores.ranking_version,'HHBA_MATCH_RANKING_V2');
 assert.equal(scores.selected_job_as_target_direction,true);
 assert.ok(scores.updated_score>scores.original_score);
 assert.equal(scores.before_breakdown.education,scores.after_breakdown.education);
 assert.equal(scores.before_breakdown.experience,scores.after_breakdown.experience);
});
