import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AGENT_VERSION,normalizeResearchDecision,runAgentOwnedMainlandMatch}
 from '../functions/_lib/ai-owned-job-research.js';

const resume='负责汽车经销商培训、区域业务分析和数字化项目运营，有真实销售过程管理经验。';
const first={id:'j1',title:'星海汽车有限公司 区域渠道督导 上海 招聘',
 url:'https://careers.xinghai-cn.com/jobs/channel-supervisor-2026',
 source:'星海汽车有限公司',summary:'星海汽车有限公司招聘区域渠道督导，工作地点上海，负责门店销售流程复盘与经销商培训。',
 content:'',availability:{status:'UNKNOWN'}};
const adjacent={id:'j1',title:'北辰数字有限公司 项目运营 杭州 招聘',
 url:'https://careers.beichen-cn.com/jobs/project-operation-2026',
 source:'北辰数字有限公司',summary:'北辰数字有限公司招聘项目运营，工作地点杭州，负责跨部门项目协同和数字产品交付。',
 content:'',availability:{status:'UNKNOWN'}};
const jobOf=hit=>({
 id:'search-'+hit.id,company:hit.source,title:hit.title.replace(hit.source+' ',''),
 title_zh:hit.title,location:hit.url.includes('beichen')?'杭州':'上海',
 official_url:hit.url,match_score:81,score_basis:'简历中记录的实际项目与公开岗位的运营方向相关',
 recommendation_reason:'简历中有渠道运营、项目协调和数据复盘经历，与公开岗位的职责方向存在可解释的联系，具体条件尚需核实。'
});
test('AI action normalizer rejects invented URLs, IDs, PII queries and duplicates',()=>{
 const out=normalizeResearchDecision({actions:[
  {type:'fetch',candidate_ids:['j1','j666','j1']},
  {type:'search',queries:['医药物流 企业项目运营 官方招聘','test@example.com 公司招聘',
   'https://fake.test/jobs/123','医药物流 企业项目运营 官方招聘']},
  {type:'finish'}
 ],shortlist_ids:['j666','j1','j1'],rationale:'read sources'},[first],[]);
 assert.deepEqual(out.fetchIds,['j1']);
 assert.deepEqual(out.queries,['医药物流 企业项目运营 官方招聘']);
 assert.deepEqual(out.shortlistIds,['j1']);
 assert.equal(out.finish,true);
 assert.equal('url' in out,false);
});
test('model chooses research, then cross-industry search, then evidence-based finish',async()=>{
 const queryLog=[],progress=[],observed=[],chosen=[];
 let decisionCount=0;
 const result=await runAgentOwnedMainlandMatch('synthetic',resume,'',10,{
  expandDetailed:false,onProgress:x=>progress.push(x),
  onPartial:rows=>observed.push(rows.map(x=>x.official_url))
 },{
  plan:async()=>({queries:['汽车区域督导 上海 企业官网招聘'],strategy:'start with direct'}),
  search:async(k,cv,hint,options)=>{
   assert.equal(k,'synthetic');
   assert.ok(!options.queriesOverride.some(q=>q.includes('负责汽车经销商')));
   queryLog.push(...options.queriesOverride);
   return {hits:options.queriesOverride.some(q=>q.includes('跨行业'))?[adjacent]:[first],
    diagnostic:{successful_searches:1,raw_results:1,search_failures:0}};
  },
  fetchDetails:async(k,hits,opts)=>({hits:hits.map(x=>({...x,
   content:'工作地点上海。岗位职责：区域渠道督导，复盘销售漏斗数据并承担经销商培训。'})),fetches:1}),
  decide:async(k,cv,hint,pool,queries,history)=>{
   decisionCount++;
   if(decisionCount===1)return {actions:[{type:'fetch',candidate_ids:['j1','j99']}]};
   if(decisionCount===2)return {actions:[{type:'search',queries:['跨行业 数字化项目运营 杭州 企业招聘']}]};
   return {actions:[{type:'finish'}],shortlist_ids:['j2']};
  },
  select:async(k,cv,hits,number,options)=>{
   chosen.push(hits.map(x=>x.url));
   return {matches:[jobOf(hits[0])]};
  }
 });
 assert.equal(result.diagnostic.mode,AGENT_VERSION);
 assert.equal(result.diagnostic.agent_decisions,3);
 assert.equal(result.diagnostic.agent_reflections,2);
 assert.equal(result.diagnostic.agent_exit_reason,'agent_finished');
 assert.ok(result.diagnostic.page_reads>=1,'real source research must not be skipped');
 assert.ok(result.diagnostic.selection_rounds>=1);
 assert.deepEqual(queryLog,['汽车区域督导 上海 企业官网招聘',
  '跨行业 数字化项目运营 杭州 企业招聘']);
 assert.equal(result.matches[0].official_url,adjacent.url);
 assert.equal(chosen[0][0],adjacent.url,'AI-selected research focus precedes original source');
 assert.ok(progress.includes('planning')&&progress.includes('researching')&&progress.includes('searching'));
 assert.equal(result.diagnostic.third_party_results_shown,0);
 assert.ok(observed.length>0);
});
test('a model-invented URL is never displayed, even when only a real source preview survives',async()=>{
 const out=await runAgentOwnedMainlandMatch('synthetic',resume,'',10,{
  expandDetailed:false
 },{
  plan:async()=>({queries:['汽车区域督导 上海 企业官网招聘']}),
  search:async()=>({hits:[first],diagnostic:{successful_searches:1,raw_results:1}}),
  decide:async()=>({actions:[{type:'finish'}],shortlist_ids:['j1']}),
  select:async()=>({matches:[{...jobOf(first),
   official_url:'https://careers.fictitious-company.com/jobs/invented'}]})
 });
 assert.ok(out.matches.every(job=>job.official_url!==
  'https://careers.fictitious-company.com/jobs/invented'));
 assert.ok(out.matches.every(job=>job.official_url===first.url));
 assert.ok(out.matches.every(job=>job.match_score===null),
  'if the model invented a URL, only a real, explicitly uns cored source preview may survive');
});
test('model not available for planning falls back only for tool discovery, still uses AI action loop',async()=>{
 const searched=[];
 const out=await runAgentOwnedMainlandMatch('synthetic',resume,'',10,{
  expandDetailed:false
 },{
  plan:async()=>{throw Error('planner unavailable')},
  search:async(k,cv,hint,{queriesOverride})=>{
   searched.push(...queriesOverride);
   return {hits:[first],diagnostic:{successful_searches:queriesOverride.length,raw_results:1}};
  },
  decide:async()=>({actions:[{type:'finish'}]}),
  select:async(k,cv,hits)=>({matches:[jobOf(hits[0])]})
 });
 assert.ok(searched.length>0,'fallback remains available when planning provider fails');
 assert.equal(out.matches.length,1);
 assert.equal(out.diagnostic.agent_exit_reason,'agent_finished');
});
test('the real candidate route defaults to model-owned loop and preserves authenticated Word flow',()=>{
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const word=readFileSync(new URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 assert.match(route,/runAgentOwnedMainlandMatch/);
 assert.match(route,/HHBA_AI_OWNED_RESEARCH_ENABLED==='0'/);
 assert.match(route,/runCandidateResearch\(env,env\.HHBA_MATCH_DEEPSEEK_KEY/);
 assert.match(route,/'AI_EMPLOYER_JOBS_NOT_FOUND'/);
 assert.match(route,/'AI_SEARCH_API_REJECTED'/);
 assert.match(route,/includes\(error\?\.code\)\)throw error/);
 assert.match(route,/domesticResearchPass/);
 assert.match(route,/candidateSession\(env,request\)/);
 assert.match(route,/redactForModel\(input\.text\)/);
 assert.match(word,/jobContextForAI/);
});
