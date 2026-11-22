import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAutonomousQueries,planAutonomousMainlandSearch}
 from '../functions/_lib/autonomous-mainland-search.js';
import {runSearchFirstMatch} from '../functions/_lib/deepseek-search-match.js';

const cv='本人负责汽车经销商督导、销售数据复盘，也参与智能体产品设计和商业化项目协调。';
const apiReply=(value)=>new Response(JSON.stringify({
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]
}),{status:200});
const posting=(company,title,city,path)=>({
 url:'https://careers.example-cn.com/jobs/'+path,
 title:company+' '+title+' '+city+' 招聘职位',
 summary:company+' '+title+' 工作地点：'+city+'；岗位职责包括区域业务分析、经销商协作与项目交付；任职要求包括沟通协调能力与团队执行经验。'.repeat(3),
 site_name:company
});
const sse=(jobs)=>{
 const raw=JSON.stringify({jobs});
 return new Response([
 {type:'response.output_text.delta',delta:raw},
 {type:'response.completed',response:{status:'completed',output:[{
  type:'message',content:[{type:'output_text',text:raw}]
 }]}}
 ].map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join(''),{
 status:200,headers:{'Content-Type':'text/event-stream'}});
};
test('AI-generated public search queries are not bound to a fixed industry table but drop contacts, keys and links',()=>{
 const queries=normalizeAutonomousQueries([
  '文旅集团 项目协调 上海 企业官方招聘',
  '农业食品 企业运营 社招 中国大陆',
  '建筑工程 项目运营 官方招聘岗位',
  '文旅集团 项目协调 上海 企业官方招聘',
  '联系我 13800138000 工作',
  'https://fake.example/jobs/123',
  {query:'医药物流 企业销售支持 职位职责'},
  {query:'数据分析 智能运营 成都 官方招聘'}
 ],['农业食品 企业运营 社招 中国大陆']);
 assert.deepEqual(queries,[
  '文旅集团 项目协调 上海 企业官方招聘',
  '建筑工程 项目运营 官方招聘岗位',
  '医药物流 企业销售支持 职位职责',
  '数据分析 智能运营 成都 官方招聘'
 ]);
});
test('V4 Pro independently plans cross-industry search directions and only model receives redacted CV',async()=>{
 const calls=[],result=await planAutonomousMainlandSearch('synthetic-key',cv,'',{
  fetcher:async(url,init)=>{
   calls.push({url,body:JSON.parse(init.body)});
   return apiReply({queries:[
    '农业食品 企业渠道项目运营 社会招聘',
    '智慧城市 企业数字化项目助理 官方招聘',
    '数字化服务商 用户成功管理 岗位要求'
   ],strategy:'用跨行业可迁移能力搜索，避免把简历局限于汽车行业'});
  }
 });
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.deepseek.com/responses');
 assert.equal(calls[0].body.model,'deepseek-v4-pro');
 assert.ok(calls[0].body.input.includes('经销商督导'));
 assert.equal(result.queries.length,3);
 assert.ok(result.strategy.includes('跨行业'));
 assert.ok(!result.queries.some(q=>q.includes('本人负责')));
});
test('production matching explores AI-selected job directions when initial real shortlist is incomplete',async()=>{
 const first=posting('星云科技有限公司','渠道督导','上海','supervisor-2026');
 const adjacent=posting('北辰数字有限公司','项目运营','杭州','project-operations-2026');
 const searches=[],modelCalls=[],stages=[];
 const chosen='智慧城市 企业数字化项目运营 公开招聘';
 const fetcher=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(url.endsWith('/v1/tools/search')){
   searches.push(body.query);
   return new Response(JSON.stringify({
    results:body.query.includes('智慧城市')?[adjacent]:[first]
   }),{status:200});
  }
  if(url.endsWith('/v1/tools/fetch'))return new Response(JSON.stringify({
   title:first.title,content:first.summary}),{status:200});
  if(url.endsWith('/responses')){
   modelCalls.push(body);
   if(body.instructions.includes('求职搜索策略智能体')){
    return apiReply({queries:[chosen,'文旅数字平台 项目协调 企业官网招聘'],
     strategy:'分析可迁移的项目协作和运营能力'});
   }
   if(body.stream===true){
    const cards=JSON.parse(body.input.split('可选真实职位：\n')[1]);
    const items=cards.map((card,i)=>({
     id:card.id,company:card.title.includes('北辰')?'北辰数字有限公司':'星云科技有限公司',
     title:card.title.includes('北辰')?'项目运营':'渠道督导',
     location:card.title.includes('北辰')?'杭州':'上海',
     reason:'简历具有经销商业务运营与跨部门项目推进的实际经验，可对应公开岗位的项目执行与组织协调方向，实际硬性门槛仍须核对企业招聘页面。',
     match_score:83,score_basis:'真实简历中有区域督导及项目协同经历，与该岗位公开的职责方向有关，但仍需确认具体任职年限。'
    }));
    return sse(items);
   }
  }
  throw Error('unexpected '+url);
 };
 const result=await runSearchFirstMatch('synthetic-key',cv,'',10,{
  fetcher,expandDetailed:false,supplementalLimit:undefined,
  onProgress:stage=>stages.push(stage)
 });
 assert.ok(stages.includes('planning'),'AI planning should be visible in SSE');
 assert.ok(searches.includes(chosen),'AI chooses additional non-template search direction');
 assert.ok(result.matches.some(j=>j.company==='北辰数字有限公司'));
 assert.equal(result.diagnostic.agent_planning_status,'completed');
 assert.ok(result.diagnostic.agent_planned_queries>=1);
 assert.ok(searches.every(q=>!q.includes('本人负责')));
 assert.ok(result.matches.every(j=>j.official_url.startsWith('https://careers.example-cn.com/jobs/')));
});
test('the planner cannot invent jobs: it returns public search questions, never posting records',async()=>{
 const result=await planAutonomousMainlandSearch('synthetic-key',cv,'督导',{
  fetcher:async()=>apiReply({jobs:[{company:'凭空创建公司',url:'https://invented.invalid'}]})
 });
 assert.deepEqual(result.queries,[]);
});
