import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl,recruitmentSourceKind}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits,sourceOnlyJobPreviews} from './fixtures/retired-search-evidence.mjs';

const hit={
 id:'j1',title:'华东星海汽车有限公司 · 区域渠道督导 · 上海 招聘',
 url:'https://www.xinghai-auto.cn/recruitment/positions/regional-supervisor-2026',
 summary:'华东星海汽车有限公司社会招聘区域渠道督导。工作地点：上海。岗位职责：培训经销商销售顾问、复盘线索转化、管理区域门店。任职要求有良好沟通协作能力和渠道管理相关经验。',
 snippet:'华东星海汽车有限公司区域渠道督导 工作地点：上海',
 source:'华东星海汽车有限公司',availability:{status:'UNKNOWN'}
};
test('company recruitment-route jobs are candidates, but generic jobs/positions on unknown boards are not',()=>{
 assert.equal(isMainlandEmployerJobUrl(hit.url),true);
 assert.equal(recruitmentSourceKind(hit.url),'EMPLOYER_DOMAIN_CANDIDATE');
 assert.equal(isMainlandEmployerJobUrl('https://www.zhipin.com/jobs/123456789'),false);
 assert.equal(isMainlandEmployerJobUrl('https://www.unidentified-careers-board.com/positions/123456789'),false);
 assert.equal(isMainlandEmployerJobUrl('https://www.indeed.com/positions/123456789'),false);
 const result=normalizeHits([{results:[{...hit,site_name:hit.source}]}]);
 assert.equal(result.length,1);
});
test('a Source-only preview needs real employer, distinct role, explicit Chinese work city, and has NO invented match score',()=>{
 const previews=sourceOnlyJobPreviews([hit],10);
 assert.equal(previews.length,1);
 assert.equal(previews[0].official_url,hit.url);
 assert.equal(previews[0].company,'华东星海汽车');
 assert.equal(previews[0].title,'区域渠道督导');
 assert.equal(previews[0].location,'上海');
 assert.equal(previews[0].match_score,null);
 assert.equal(previews[0].source_status,'SOURCE_SEARCH_PREVIEW');
 assert.match(previews[0].recommendation_reason,/尚未得到足够的模型回复/);
 assert.deepEqual(sourceOnlyJobPreviews([{...hit,summary:'岗位不详',snippet:'公司总部在上海'}]),[]);
 assert.deepEqual(sourceOnlyJobPreviews([{...hit,url:'https://www.zhipin.com/job_detail/abc'}]),[]);
});
test('the modal shows current progress while SSE retains search metrics',()=>{
 const app=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(app,/stageTitle\[progressStage\]/);
 assert.match(app,/已完成 \{verifiedMatchReports\(result\.matches\)\.length\} 份可核验报告，最终排名待确认/);
 assert.doesNotMatch(app,/DeepSeek|候选来源/);
 assert.match(service,/event==='activity'/);
 assert.match(service,/onActivity\?\.\(/);
 assert.match(route,/send\('activity',latestActivity\)/);
 assert.match(route,/send\('heartbeat',/);
 assert.ok(!route.includes("send('progress',{stage:'waiting'})"),
  'heartbeat must not pretend to be a substantive progress stage');
});

test('managed polling retains the complete report and uses the same report gate as SSE',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const dialog=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const panels=readFileSync(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.ok(route.includes('researchEvidence(j)?structuredClone(j)')&&route.includes('researchEvidence=j=>officialJob(j)||'),'completed reports and independently researched intermediate evidence must be preserved, not reduced to preview fields');
 const publisher=readFileSync(new URL('../functions/_lib/v4-progress-publisher.js',import.meta.url),'utf8');
 assert.ok(route.includes("queueProgress(changed||evidenceChanged?'report':newCandidate?'candidate':'routine')"),'report and candidate changes trigger expedited durable publication');
 assert.ok(publisher.includes('routine:20000,candidate:3000,report:1000'),'ordinary heartbeat throttling must not delay new results');
 assert.ok(route.includes('budget?.canPublishProgress(kind)'),'publication checks the dedicated progress allowance');
 assert.ok(route.includes('budget?.tryProgress(kind)'),'actual writes atomically reserve counted capacity');
 assert.ok(route.includes('progressReserve:input.background?4:0'),'managed background progress has explicit reserved capacity');
 assert.ok(/const reports=verifiedMatchReports\(data\.progress\.jobs\);\s*onPartial\?\.\(reports\)/.test(service),'polling must feed the report pager, not just search results');
 assert.ok(dialog.includes('hasCompleteReport?2:'),'the first available report is shown without waiting for all candidates');
 assert.ok(panels.includes("pending||provisional?'已完成报告':'正式推荐'"),'unfinished global ranking must be identified as provisional');
});


test('browser receives individual candidate events immediately and reconciles snapshots without duplicate or fake jobs',async()=>{
 const {createLiveCandidateReception}=await import('../src/services/liveCandidateReception.mjs');
 const base='https://careers.employer.cn/jobs/1',second='https://careers.employer.cn/jobs/2',third='https://careers.employer.cn/jobs/3';
 const event=(url,title='区域督导')=>({event_id:'discovery:'+url,candidate:{company:'企业',title,location:'上海',official_url:url,evidence_status:'RESEARCH_PENDING',match_score:null}});
 const snapshots=[];const state=createLiveCandidateReception(jobs=>snapshots.push(jobs));
 assert.equal(state.receive(event(base)),true);
 assert.equal(snapshots.at(-1).length,1);
 assert.equal(snapshots.at(-1)[0].match_score,null);
 assert.equal(state.receive(event(base+'?utm_source=duplicate')),false);
 assert.equal(state.receive(event('http://example.com/jobs/1')),false);
 assert.equal(state.receive({...event(third),candidate:{...event(third).candidate,match_score:98}}),false);
 assert.equal(state.receive(event(second)),true);
 assert.deepEqual(snapshots.at(-1).map(j=>j.official_url),[base,second]);
 const verified={...snapshots.at(-1)[0],match_score:88,evidence_status:'VERIFIED_FULL_JD',evidence_excerpt:'实际资料',research_detail:{score_explanation:'已核对'}};
 state.snapshot([verified]);
 assert.deepEqual(snapshots.at(-1).map(j=>j.official_url),[base,second],'stale aggregate cannot erase an unacknowledged event');
 assert.equal(state.receive(event(base)),false);
 assert.equal(snapshots.at(-1)[0].match_score,88);
 const newJob={...event(third).candidate,id:'third'};
 assert.equal(state.snapshot([newJob,verified,...snapshots.at(-1).filter(j=>j.official_url===second)]),1);
 assert.deepEqual(snapshots.at(-1).map(j=>j.official_url),[base,second,third]);
 state.snapshot([verified,newJob],{final:true});
 assert.deepEqual(snapshots.at(-1).map(j=>j.official_url),[base,third]);
});

test('browser candidate reception uses direct SSE and actual managed snapshots; report delivery remains intact',()=>{
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const panels=readFileSync(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.ok(service.includes("event==='discovery_candidate'"));
 assert.ok(service.includes('liveCandidates.receive(event)'));
 assert.ok(service.includes('addedCandidates=liveCandidates.snapshot(data.progress.jobs)'));
 assert.ok(service.includes('data.failure?.retryable?15000:addedCandidates>0?2000:3000'));
 assert.ok(service.includes('liveCandidates.snapshot(data.research_leads,{final:true})'));
 assert.ok(/const reports=verifiedMatchReports\(data\.progress\.jobs\);\s*onPartial\?\.\(reports\)/.test(service));
 assert.ok(panels.includes('Math.max(report?.discovered??0,jobs.length)'));
});

test('dedicated progress allowance cannot spend the final reserved report slot on candidates',async()=>{
 const {phaseResourceBudget,PHASE_YIELD}=await import('../functions/_lib/v4-phase-budget.js');
 const budget=phaseResourceBudget({initial:24,soft:24,hard:34,progressReserve:4});
 assert.equal(budget.tryProgress('routine'),false);
 for(let i=0;i<3;i++)assert.equal(budget.tryProgress('candidate'),true);
 assert.equal(budget.tryProgress('candidate'),false);
 budget.take('fetch',6);
 assert.throws(()=>budget.take('fetch'),{code:PHASE_YIELD});
 assert.equal(budget.tryProgress('report'),true);
 assert.equal(budget.used,34);
 assert.equal(budget.tryProgress('report'),false);
});
