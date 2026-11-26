import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAutonomousQueries} from '../functions/_lib/public-search-queries.js';

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
