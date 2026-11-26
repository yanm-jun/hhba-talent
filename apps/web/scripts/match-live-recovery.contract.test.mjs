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
