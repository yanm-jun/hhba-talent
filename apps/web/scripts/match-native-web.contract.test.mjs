import test from 'node:test';
import assert from 'node:assert/strict';
import {safeJobDetailLink,parseJobAnswer,wasWebSearched,outputText,partialJobMatchesFromText,decodeSearchText} from './fixtures/retired-native-parser.mjs';
const posting='https://careers.examplecorp.com/jobs/brand-supervisor-2026';
const answer={jobs:[
 {company:'示例汽车中国',title:'品牌督导',location:'上海',salary:'15000-20000 元/月',
  reason:'你曾辅导经销商门店，具备终端巡店、DCC 管理和销售顾问培训经历，与该品牌督导岗位的渠道管理工作相关。',
  job_basis:'负责上海经销商终端督导',match_score:82,
  score_basis:'具备经销商管理和DCC培训经验，品牌经验需核实',url:posting},
 {company:'某外资企业中国区',title:'渠道运营',location:'广州',salary:'',
  reason:'具备线索转化及门店运营经验。',url:'https://jobs.ashbyhq.com/china/abcd1234'},
 {company:'海外企业',title:'督导',location:'东京',reason:'不能展示',url:'https://careers.fakecorp.com/jobs/123456'},
 {company:'海外企业',title:'销售顾问',location:'上海 / 香港',reason:'不能展示',url:'https://careers.fakecorp.com/jobs/123457'},
 {company:'示例汽车中国',title:'品牌督导',location:'上海',reason:'重复岗位',url:posting},
 {company:'候选公司',title:'运营',location:'上海',reason:'招聘官网首页不允许',url:'https://companycorp.com/'}
]};
const deepseek=jobs=>({id:'resp_test',status:'completed',
 output:[{type:'web_search_call',status:'completed',action:{type:'search'}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs})}]}],
 usage:{server_tool_use:{tool_search:2,tool_fetch:1}}});
test('official Responses payload parser retains Mainland jobs with reasons and per-position HTTPS links',()=>{
 const out=parseJobAnswer(deepseek(answer.jobs),10);
 assert.equal(out.received,6);
 assert.equal(out.matches.length,2);
 assert.equal(out.matches[0].company,'示例汽车中国');
 assert.match(out.matches[0].recommendation_reason,/经销商/);
 assert.equal(out.matches[0].official_url,posting);
 assert.equal(out.matches[1].location,'广州');
 assert.equal(out.matches[0].source_status,'MODEL_SEARCH_REPORTED');
 assert.equal(out.matches[0].match_score,82);
 assert.equal(out.matches[0].reference_score,82);
 assert.match(out.matches[0].score_basis,/DCC培训/);
 assert.equal(out.matches[1].match_score,null);
 assert.equal(out.matches[1].reference_score,0);
});
test('unverifiable, malformed, out-of-range AI scores are never presented as real matches',()=>{
 const jobs=[
  {...answer.jobs[0],match_score:101},
  {...answer.jobs[0],company:'甲公司',url:'https://jobs.ashbyhq.com/china/testid01',match_score:89,score_basis:''},
  {...answer.jobs[0],company:'乙公司',url:'https://jobs.ashbyhq.com/china/testid02',match_score:'88'},
  {...answer.jobs[0],company:'丙公司',url:'https://jobs.ashbyhq.com/china/testid03',match_score:0,score_basis:'明确缺少硬性证书要求，当前匹配证据极弱'}
 ];
 const data=parseJobAnswer(deepseek(jobs),10).matches;
 assert.equal(data.length,4);
 assert.equal(data[0].match_score,null);
 assert.equal(data[1].match_score,89,'job_basis is valid fallback evidence when score_basis is empty');
 assert.equal(data[2].match_score,null);
 assert.equal(data[3].match_score,0);
});

test('native results dialog never hides optimizer behind the optional match score',async()=>{
 const {readFile}=await import('node:fs/promises');
 const ui=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(ui,/function visibleMatchScore\(/);
 const panels=await readFile(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.match(panels,/<button type="button" disabled=\{!optimizationAvailable\|\|\(!\(jdJob\.jd_version_id&&jdJob\.jd_sha256\)/);
 assert.match(panels,/jdJob\.reference_jd_kind==='AI_GENERATED_REFERENCE'&&jdJob\.reference_jd\?\.trim\(\)&&jdJob\.reference_jd_basis\?\.trim\(\)/);
 assert.doesNotMatch(ui,/!pending&&Number\.isInteger\(job\.match_score\)/);
 assert.match(panels,/优化简历/);
 assert.match(panels,/暂无可靠分数/);
});

test('no search: never show invented jobs',()=>{
 const r={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}],
 usage:{server_tool_use:{tool_search:0,tool_fetch:0}}};
 assert.equal(wasWebSearched(r),false);
 assert.match(outputText(r),/"jobs"/);
});
test('job links are broad enough for real ATS but still specific public HTTPS pages',()=>{
 assert.equal(safeJobDetailLink(posting),posting);
 assert.equal(safeJobDetailLink('https://jobs.ashbyhq.com/china/abcd1234'),
  'https://jobs.ashbyhq.com/china/abcd1234');
 assert.equal(safeJobDetailLink('http://careers.examplecorp.com/jobs/12345'),null);
 assert.equal(safeJobDetailLink('https://careers.examplecorp.com/'),null);
 assert.equal(safeJobDetailLink('https://www.google.com/search?q=jobs'),null);
 assert.equal(safeJobDetailLink('https://local/jobs/12345'),null);
 assert.equal(safeJobDetailLink('https://careers.examplecorp.com/jobs/12345?access_token=secret'),null);
});
test('new upload UI uses native endpoint and native results, not legacy multi-stage APIs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(svc,/const EFFECTIVE_API='\/api\/match-v4'/);
 // The active candidate UI is bound to the single V4 backend.
 assert.match(page,/CandidateMatchNativeDialog/);
 assert.doesNotMatch(page,/CandidateMatchResultDialog/);
});


test('frontend fetches one native SSE stream and maps stages without restarting model',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(svc,/'Accept':readOnly\?'application\/json':'text\/event-stream'/,
  'original research remains SSE while lightweight progress is JSON');
 assert.match(svc,/consumeNativeMatchStream/);
 assert.match(svc,/event==='complete'/);
 assert.match(svc,/event==='failure'/);
 assert.match(page,/setStage/);
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(page,/progressStage=\{stage\}/);
 assert.match(dialog,/搜索企业岗位/);
 assert.match(dialog,/stageTitle\[progressStage\]/);
});


test('streaming JSON returns Mainland jobs as soon as each full object is written',async()=>{
 const all=JSON.stringify({jobs:answer.jobs});
 const boundary=all.indexOf('},{"company"');
 assert.ok(boundary>0);
 const first=partialJobMatchesFromText(all.slice(0,boundary+1));
 assert.equal(first.length,1);
 assert.equal(first[0].location,'上海');
 assert.equal(first[0].official_url,posting);
 const end=partialJobMatchesFromText(all,10);
 assert.equal(end.length,2,'overseas, mixed-location and duplicate posts never appear even temporarily');
 const noClosing=partialJobMatchesFromText('{"jobs":[{"company":"深圳示例","title":"销售经理"');
 assert.equal(noClosing.length,0);
});
test('frontend shows partial results without pretending network completion',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(svc,/event==='partial'/);
 assert.match(svc,/onPartial\?\./);
 assert.match(page,/result\|\|partialJobs\.length>0/);
 assert.match(page,/setPartialJobs/);
 assert.match(dialog,/activeJob&&parsedProfile/);
 assert.match(dialog,/已完成 \{verifiedMatchReports\(result\.matches\)\.length\} 份可核验报告，最终排名待确认/);
 const panels=await readFile(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.match(panels,/已发现/);assert.match(panels,/官方 JD 已核验/);
});


test('encoded Chinese characters and spaces are normalized in job reasons',()=>{
 assert.equal(decodeSearchText('&#x610F;向城市聊城本地&#x20;、岗位方向匹配'), '意向城市聊城本地 、岗位方向匹配');
 const fixture=deepseek([{company:'某企业',title:'AI 产品经理',location:'聊城',
  url:'https://careers.samplecorp.com/jobs/ai-manager-2026',
  reason:'经历里的&#x610F;向分析能力&#x20;与岗位匹配。'}]);
 const p=parseJobAnswer(fixture,10);
 assert.match(p.matches[0].recommendation_reason,/意向分析能力 与岗位匹配/);
 assert.doesNotMatch(p.matches[0].recommendation_reason,/&#x/);
});
