import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';
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
test('a one-job first shortlist must retry untouched sources, inspect more real descriptions, and preserve remaining strictly grounded candidates',async()=>{
 const selected=[],activity=[],fetches=[];
 const result=await runAgentOwnedMainlandMatch('synthetic-model-key','区域门店督导、渠道运营和数据分析经验','',10,{
  expandDetailed:false,onActivity:a=>activity.push(a)
 },{
  plan:async()=>({queries:['区域督导 项目运营 企业官方招聘']}),
  search:async()=>({hits:sources,diagnostic:{successful_searches:1,raw_results:40}}),
  decide:async()=>({actions:[{type:'finish'}],shortlist_ids:['j1']}),
  fetchDetails:async(k,items)=>{
   fetches.push(...items.map(x=>x.url));
   return {hits:items.map(x=>({...x,content:x.summary})),fetches:items.length};
  },
  select:async(k,resume,items,n)=>{
   selected.push(items.map(x=>x.url));
   // Reproduce real user failure: the first AI round selected only one
   // of four factual employer-source candidates.
   return {matches:[selection(items[0])]};
  }
 });
 assert.equal(result.matches.length,4);
 assert.equal(result.matches[0].official_url,sources[0].url);
 assert.equal(result.matches[1].official_url,sources[1].url);
 assert.equal(result.diagnostic.selection_rounds,2);
 assert.equal(result.diagnostic.underfilled_rechecks,1);
 assert.equal(result.diagnostic.explicit_city_sources,4);
 assert.equal(result.diagnostic.page_reads,4,'inspect more than just one posting before ranking');
 assert.equal(selected.length,2);
 assert.ok(!selected[1].includes(sources[0].url),'second model pass must study unused sources');
 assert.equal(result.diagnostic.unscored_source_previews,2);
 assert.ok(result.matches.slice(2).every(x=>x.match_score===null&&x.source_status==='SOURCE_SEARCH_PREVIEW'));
 assert.ok(result.matches.every(x=>isMainlandEmployerJobUrl(x.official_url)));
 assert.ok(activity.some(x=>x.message.includes('重新比较')));
 assert.ok(fetches.length>=4);
});
test('if other sources lack explicit work-city evidence, system must not fabricate extra recommendations or numeric scores',async()=>{
 const ambiguous=sources.slice(1).map(x=>({...x,
  summary:'企业发布相关职业方向，工作地点与任职条件暂不明确。',
  snippet:'公司业务涉及多个城市，岗位地点尚未发布'}));
 const out=await runAgentOwnedMainlandMatch('synthetic-model-key','地区运营、门店管理','',10,{
  expandDetailed:false
 },{
  plan:async()=>({queries:['渠道运营 官方招聘']}),
  search:async()=>({hits:[sources[0],...ambiguous],diagnostic:{successful_searches:1,raw_results:35}}),
  decide:async()=>({actions:[{type:'finish'}],shortlist_ids:['j1']}),
  fetchDetails:async(k,items)=>({hits:items,fetches:0}),
  select:async(k,cv,items)=>({matches:items.some(x=>x.url===sources[0].url)?
   [selection(sources[0])]:[]})
 });
 assert.equal(out.matches.length,1);
 assert.equal(out.matches[0].official_url,sources[0].url);
 assert.equal(out.diagnostic.unscored_source_previews,0);
 assert.equal(out.diagnostic.explicit_city_sources,1);
});
test('research is one continuous journal before a final report and preserves original Word optimization',()=>{
 const modal=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles/resume-match-dialog.css',import.meta.url),'utf8');
 assert.match(modal,/hhba-research-journal/);
 assert.match(modal,/researchTrail\.map/);
 assert.match(modal,/pending\?null:activeJob/);
 assert.match(modal,/hhba-research-report-log/);
 assert.match(modal,/TargetedResumeOptimization/);
 assert.match(modal,/sourceResume=\{sourceResume\}/);
 assert.match(page,/setResearchTrail/);
 assert.match(page,/researchTrail=\{researchTrail\}/);
 assert.match(css,/hhba-research-journal/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(!modal.includes('hhba-match-live-steps'),'old four-step progress rail should be retired');
});
