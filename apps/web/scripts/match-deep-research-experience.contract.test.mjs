import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl} from '../functions/_lib/match-employer-source.js';
const company=['星源汽车有限公司','远航科技有限公司','东华零售有限公司','嘉禾制造有限公司'];
const role=['区域督导','项目运营','渠道管理','门店运营'];
const city=['上海','杭州','深圳','成都'];
const sources=company.map((name,i)=>({
 id:'j'+(i+1),source:name,title:name+' · '+role[i]+' · '+city[i]+' 招聘',
 url:'https://careers.real-cn-'+(i+1)+'.com/jobs/role-'+(i+1),
 summary:name+'招聘'+role[i]+'。工作地点：'+city[i]+'。岗位职责包括跨区域项目沟通、门店管理、培训以及数据复盘。任职要求有项目执行能力和沟通协作经验。',
 snippet:name+' '+role[i]+' 工作地点：'+city[i],
 availability:{status:'UNKNOWN'},content:''
}));
const selection=(hit)=>({
 id:'search-'+hit.id,company:hit.source,title:role[sources.findIndex(x=>x.url===hit.url)],
 location:city[sources.findIndex(x=>x.url===hit.url)],
 official_url:hit.url,match_score:79,
 score_basis:'简历中记录的区域业务运营和跨部门项目协同经验与该岗位公开职责相关，具体经验年限仍需通过原始招聘页面核实。',
 recommendation_reason:'根据简历中的真实门店管理、数据复盘与培训经验，对照该企业职位方向进行独立分析，后续需核实具体任职门槛。',
 availability_status:'UNKNOWN'
});
test('the matcher shows its current step and preserves original Word optimization',()=>{
 const modal=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles/resume-match-dialog.css',import.meta.url),'utf8');
 assert.match(modal,/stageTitle\[progressStage\]/);
 assert.match(modal,/progressActivity\?\.message&&<span>/,'the live AI research explanation must be visible at every step');
 assert.doesNotMatch(modal,/progressStage==='parsing'&&progressActivity/,'do not hide search/research/analysis messages');
 assert.match(modal,/activeJob&&parsedProfile/);
 assert.doesNotMatch(modal,/DeepSeek|researchTrail\.map/);
 assert.match(modal,/TargetedResumeOptimization/);
 assert.match(modal,/sourceResume=\{sourceResume\}/);
 assert.match(page,/progressStage=\{stage\}/);
 assert.match(css,/hhba-research-now/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(!modal.includes('hhba-match-live-steps'),'old four-step progress rail should be retired');
});
