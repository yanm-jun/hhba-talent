import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMainlandWorkplaceFromJob} from '../functions/_lib/mainland-job-workplace-evidence.js';
import {readPublicJob,publicJobLink} from '../functions/_lib/deepseek-official-job-agent.js';

const jdLines=(extra=[])=>[
 '# 内容运营专员',...extra,
 '岗位职责',
 '负责微信公众号内容管理、项目内容策划，运营短视频业务并协调活动执行。'.repeat(4),
 '任职要求',
 '本科及以上学历，了解图文内容运营，熟悉主流社交媒体平台及内容增长。'.repeat(4),
 '立即投递'
];
const now=new Date('2026-11-08T12:00:00Z');
const link=publicJobLink('https://career.gongsi.cn/jobs/202611080993');
const subject=(lines)=>readPublicJob(link,{title:'内容运营专员',content:lines.join('\n')},now);
test('Explicit work-city fields in Chinese Markdown tables, paragraphs and split rows',()=>{
 const examples=[
  [['| 工作地点 | 上海市浦东新区 |'],'上海'],
  [['工作城市','广州市天河区'],'广州'],
  [['办公地：深圳南山区'],'深圳'],
  [['上班地点 | 成都市高新区'],'成都'],
  [['岗位所在地：浙江省杭州市'],'杭州'],
  [['工作地址—北京市海淀区'],'北京'],
  [['工作所在地：上海市'],'上海'],
  [['地点：西安'],'西安'],
  [['城市','济南'],'济南']
 ];
 for(const [header,want] of examples){
  const job=subject(jdLines(header));
  assert.equal(job?.location,want,JSON.stringify(header));
  assert.equal(job?.evidence.location_evidence_type,'JOB_LOCATION_FIELD');
 }
});
test('Standalone job-header city is evidence but a city in duties, navigation or company address is not',()=>{
 assert.equal(subject(jdLines(['上海']))?.location,'上海');
 assert.equal(subject(jdLines(['上海']))?.evidence.location_evidence_type,'JOB_HEADER_CITY');
 const misleading=[
  ['工作经验：2年','福利待遇：五险一金','公司地址：北京'],
  ['公司地址：北京','公司名称：云禾文化有限公司'],
  ['职位类型：实习','工作方式：远程'],
 ];
 for(const lines of misleading)assert.equal(subject(jdLines(lines)),null,JSON.stringify(lines));
 const nav=['城市：上海','岗位列表','首页','职位搜索','# 内容运营专员','公司名称：云禾文化有限公司'];
 assert.equal(subject([...nav,...jdLines([])]),null,'nav filter cannot prove job work city');
 const post=jdLines([]);post.splice(post.indexOf('岗位职责')+1,0,'负责北京市场活动和客户沟通。'.repeat(6));
 assert.equal(subject(post),null,'a city inside responsibility is not location evidence');
});
test('Mixed and contradictory work cities never collapse to first Mainland city',()=>{
 for(const location of [
  ['工作地点：北京、上海'],
  ['工作地点：北京市/上海市'],
  ['工作地点：北京', '工作城市：广州'],
  ['工作城市：北京 或 深圳'],
  ['上海','广州'],
  ['工作地址：北京 / 新加坡'],
  ['工作城市：日本东京'],
  ['工作城市：待定'],
  ['工作地点：全国'],
  ['工作城市：朝阳区'],
 ]){
  const x=subject(jdLines(location));
  assert.equal(x,null,JSON.stringify(location));
 }
});
test('Only single JobPosting JSON-LD page location is accepted, not Organization or unrelated job',()=>{
 const role='内容运营专员';
 const wrap=(data)=>'<script type="application/ld+json">'+JSON.stringify(data)+'</script>';
 const data={'@context':'https://schema.org','@type':'JobPosting',title:role,
  jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'杭州市'}}};
 const where=raw=>extractMainlandWorkplaceFromJob({raw,lines:jdLines([]),role});
 assert.deepEqual(where(wrap(data)),{city:'杭州',evidence_type:'JOBPOSTING_STRUCTURED'});
 assert.equal(where(wrap({...data,title:'财务经理'})).reason,'MISSING_EXPLICIT_WORKPLACE');
 assert.equal(where(wrap({...data,'@type':'Organization'})).reason,'MISSING_EXPLICIT_WORKPLACE');
 assert.equal(where(wrap({...data,jobLocation:[
  {address:{addressLocality:'广州'}},{address:{addressLocality:'上海'}}
 ]})).reason,'AMBIGUOUS_WORKPLACE');
 assert.equal(where(wrap({...data,jobLocation:{address:{addressLocality:'东京'}}})).reason,'OVERSEAS_WORKPLACE');
});
test('Search snippets and job URL city strings do not become job work location',()=>{
 const body=jdLines([]).join('\n');
 const fromFetcher=readPublicJob(link,{title:'内容运营专员',content:body,
  snippet:'工作地点：上海',summary:'工作地点：上海'},now);
 assert.equal(fromFetcher,null);
 const rawJobLink=publicJobLink('https://career.gongsi.cn/jobs/202611080994');
 assert.equal(readPublicJob(rawJobLink,{title:'北京内容运营专员',content:body},now),null);
});
