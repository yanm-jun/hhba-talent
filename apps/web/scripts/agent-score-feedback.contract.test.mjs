import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFeedbackActions,iterateScoredJobEvidence}
 from '../functions/_lib/agent-score-feedback.js';
const job=(id='j1',extra={})=>({id,company:'华东星云汽车有限公司',
 title:'区域渠道督导',location:'上海',
 official_url:'https://careers.xingyun-cn.com/jobs/regional-supervisor',
 jd_source_status:null,match_score:null,evidence_status:'INSUFFICIENT_EVIDENCE',
 evidence_reason_status:'FALLBACK',recommendation_reason:'职位信息尚未核实',
 evidence_sources:[],evidence_gaps:['缺少企业任职资格'],...extra});
test('AI feedback actions may choose research questions, but never invent job IDs or leak private search queries',()=>{
 const normalized=normalizeFeedbackActions({finish:false,actions:[
  {type:'search',job_id:'j1',queries:[
   '华东星云汽车有限公司 区域渠道督导 任职要求 官方招聘',
   '华东星云汽车有限公司 区域渠道督导 任职要求 官方招聘',
   'test@example.com 应聘华东星云汽车',
   '仅包含虚构职位名称的搜索词'
  ]},
  {type:'search',job_id:'not-observed',queries:['华东星云汽车有限公司 品牌总监 职位']}
 ]},[job()],[]);
 assert.equal(normalized.actions.length,1);
 assert.deepEqual(normalized.actions[0].queries,
  ['华东星云汽车有限公司 区域渠道督导 任职要求 官方招聘']);
});
test('Agent uses scoring gaps to search and re-evaluate with real source evidence',async()=>{
 const queries=[],observed=[],scores=[];
 let thoughts=0;
 const initial=job();
 const result=await iterateScoredJobEvidence('test-token','redacted CV',[initial],{
  timeBudgetMs:70000,onProgress:phase=>observed.push(phase)
 },{
  decide:async(k,cv,jobs,history)=>{
   thoughts++;assert.equal(jobs[0].id,'j1');
   assert.ok(jobs[0].evidence_gaps?.length>0);
   return {actions:[{type:'search',job_id:'j1',
    queries:['华东星云汽车有限公司 区域渠道督导 任职要求 官方招聘']}],
    rationale:'缺少实证要求'};
  },
  search:async(k,query)=>{
   queries.push(query);
   assert.ok(!query.includes('redacted CV'));
   return [{url:initial.official_url,title:'华东星云汽车有限公司 区域渠道督导 上海 招聘',
    summary:'华东星云汽车有限公司区域渠道督导，工作地点上海，岗位职责为培训经销商销售人员、复盘门店线索转化；任职要求具备渠道管理经验。',
    site_name:'华东星云汽车'}];
  },
  rescore:async(k,cv,targets,opts,deps)=>{
   scores.push({targets,found:await deps.search(k,targets[0])});
   return {matches:[job('j1',{evidence_status:'PARTIAL_SOURCE',
    evidence_reason_status:'AI_INDIVIDUAL_ANALYSIS',evidence_gaps:[],
    match_score:82,recommendation_reason:'结合简历渠道管理和真实岗位要求给出独立分析。'})]};
  }
 });
 assert.equal(thoughts,1);
 assert.equal(queries.length,1);
 assert.equal(scores[0].found.length,1);
 assert.equal(result.matches[0].match_score,82);
 assert.equal(result.matches[0].feedback_refined,true);
 assert.equal(result.diagnostic.feedback_refined_jobs,1);
 assert.ok(observed.includes('researching'));
 assert.ok(observed.includes('scoring'));
});
test('weaker feedback never overwrites a score based on better public evidence',async()=>{
 const initial=job('j1',{match_score:75,evidence_status:'PARTIAL_SOURCE',
  evidence_reason_status:'FALLBACK',evidence_gaps:['企业任职年限未知']});
 const result=await iterateScoredJobEvidence('key','redacted CV',[initial],{
  timeBudgetMs:70000
 },{
  decide:async()=>({actions:[{type:'search',job_id:'j1',
   queries:['华东星云汽车有限公司 区域渠道督导 岗位详情']}]}),
  search:async()=>[{url:initial.official_url,title:'华东星云汽车有限公司 区域渠道督导',summary:'工作地点上海'}],
  rescore:async()=>({matches:[job('j1',{match_score:null,
   evidence_status:'SEARCH_SNIPPET_ONLY'})]})
 });
 assert.equal(result.matches[0].match_score,75);
 assert.equal(result.matches[0].evidence_status,'PARTIAL_SOURCE');
 assert.equal(result.diagnostic.feedback_refined_jobs,0);
});
test('a provider failure or the model deciding to finish keeps the original evidence and score',async()=>{
 const initial=job();
 const stopped=await iterateScoredJobEvidence('key','redacted CV',[initial],{timeBudgetMs:60000},{
  decide:async()=>({finish:true,actions:[]}),
  search:async()=>{throw Error('must not search')}
 });
 assert.equal(stopped.diagnostic.feedback_queries,0);
 assert.equal(stopped.matches[0].match_score,null);
 const unavailable=await iterateScoredJobEvidence('key','redacted CV',[initial],{timeBudgetMs:60000},{
  decide:async()=>{throw Error('provider inaccessible')}
 });
 assert.equal(unavailable.diagnostic.feedback_errors,1);
 assert.equal(unavailable.matches[0].match_score,null);
});
