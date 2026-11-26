import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessDomesticEvidence} from './fixtures/retired-partial-evidence.mjs';

const posting=i=>({
 id:'search-j'+i,company:'星河汽车有限公司',title:'区域销售督导'+i,location:'济南',
 official_url:'https://careers.xinghe-cn.com/jobs/supervisor-'+i,
 match_score:91,reference_score:91,score_basis:'搜索模型原始评分但尚未核对JD',
 recommendation_reason:'搜索模型最初给出的区域门店管理、线索复盘和经销商培训建议；这一结论仍要与真实岗位条件核对。'
});
const summary=i=>({
 url:posting(i).official_url,title:'星河汽车有限公司 区域销售督导'+i+' 济南 招聘',
 site_name:'星河汽车有限公司',
 summary:'星河汽车有限公司在济南招聘区域销售督导'+i+'，负责汽车门店管理、经销商销售培训、销售数据分析，任职要求具备沟通协调能力和汽车渠道经验。',
 snippet:'区域销售督导'+i+'，济南，门店管理'
});
const answer=(id,score=82)=>({
 id,match_score:score,
 score_basis:'简历记载经销商门店督导、线索转化分析和团队培训经历，与这份区域销售督导岗位的管理方向相关，但企业要求的实际经验年限与资格仍待官网核实。',
 resume_evidence:'简历明确记录负责汽车经销商门店运营、销售漏斗复盘，以及面向门店团队的培训工作。',
 role_relation:'岗位公开信息提到区域管理和数据分析，这与简历列出的督导职责和经营改善工作有直接联系。',
 unknowns:'公开资料尚不足以证实企业要求的最低任职年限、专业资质及当前投递资格。',
 next_step:'建议核对官网最新岗位职责，重点展示经销商运营指标与培训成果，再决定是否投递。'
});
const output=rows=>new Response(JSON.stringify({output:[{type:'message',content:[
 {type:'output_text',text:JSON.stringify({jobs:rows})}]}]}),{status:200});
const resume='2025年负责汽车经销商门店督导、销售数据分析、DCC线索转化、经销商培训和区域项目协调。';

test('mainland multi-location employer and legal company aliases preserve usable evidence',()=>{
 const job={...posting(1),company:'亚信科技（中国）有限公司',
  title:'运营/职能岗（产品经理助理、产品运营、项目管理助理等）',
  location:'北京/杭州/苏州/上海'};
 const article={url:job.official_url,
  title:'亚信科技 招聘项目管理助理（北京）',
  site_name:'亚信科技',summary:'亚信科技项目管理助理岗位招聘，工作地点北京。工作职责：支持项目计划协调、进度管理与跨部门沟通。任职要求具备一定的业务分析和协作能力。',
  snippet:'项目管理助理，北京，企业招聘'};
 const result=assessDomesticEvidence(job,[article]);
 assert.equal(result.evidence_status,'PARTIAL_SOURCE');
 assert.equal(result.evidence_sources.length,1);
 assert.match(result.evidence_excerpt,/项目计划协调/);
});
test('real stage-aware modal mounts at click and preserves original scroll/results/Word workspace',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const modal=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const svc=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const style=readFileSync(new URL('../src/styles/resume-match-dialog.css',import.meta.url),'utf8');
 assert.match(page,/\(result\|\|partialJobs\.length>0\)\|\|working/);
 assert.match(page,/progressStage=\{stage\}/);
 assert.match(modal,/stageTitle\[progressStage\]/);
 assert.match(modal,/activeJob&&parsedProfile/);
 assert.match(modal,/识别简历经历和技能/);
 assert.match(modal,/终止匹配/);
 assert.match(modal,/确认终止本次匹配/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(route,/onProgress:progress,onActivity:activity/);
 assert.match(svc,/'researching'/);
 assert.match(svc,/'scoring'/);
 assert.match(modal,/TargetedResumeOptimization/);
 assert.match(modal,/matchListScroll/);
});
