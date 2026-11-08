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
 assert.equal(where(wrap({...data,title:'财务经理'})).reason,'UNRELATED_STRUCTURED_JOB');
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

test('Rendered Tencent-style single role and same-line Mainland city survive long navigation',()=>{
 const url='https://careers.tencent.com/jobdesc.html?postId=2094968965272092672';
 const l=publicJobLink(url);
 assert.ok(l);
 const lines=[
  '---','title: "岗位详情 | 腾讯招聘"','---','登录','社会招聘','校园招聘',
  '生活在腾讯','产品和服务','工作地点','查看工作岗位','慎防招聘诈骗',
  '我们提醒您，近期新加坡出现招聘诈骗活动，请勿轻信仿冒企业人员的申请指令。',
  '其他招聘信息请访问官方页面。',
  '在研UE5策略竞技游戏-内容运营经理 上海',
  '分享岗位','复制链接','收藏','IEG','点击了解更多BG信息',
  '产品 三年以上工作经验 更新于2026年09月09日',
  '岗位职责',
  '负责对接内容平台与创作者，制定直播运营方案，推动内容规模化传播。'.repeat(4),
  '岗位要求',
  '本科及以上学历，三年以上内容运营经验，熟悉传播策略和平台合作流程。'.repeat(5),
  '申请岗位'
 ];
 const rejects={};
 const out=readPublicJob(l,{title:'岗位详情 | 腾讯招聘',content:lines.join('\n')},now,rejects);
 assert.equal(out?.title,'在研UE5策略竞技游戏-内容运营经理',JSON.stringify(rejects));
 assert.equal(out?.location,'上海');
 assert.equal(out?.evidence.location_evidence_type,'JOB_HEADER_CITY');
 assert.equal(out?.company_claim,'腾讯');
 assert.equal(out?.has_application_cta,true);
 // A rendering recovery is still NOT verified without separate company proof.
 assert.equal(out?.source_status,'PUBLIC_JOB_UNCONFIRMED');
});
test('Navigation text, several similar role-city entries, or a role and city in duties must not prove location',()=>{
 const url='https://careers.examplecompany.cn/jobs/202611081244';
 const l=publicJobLink(url);
 const base=[
  '岗位详情 | 企业招聘','生活在腾讯','产品和服务','工作地点','查看工作岗位',
  '岗位职责','负责上海地区的内容运营和项目推进。'.repeat(5),
  '岗位要求','本科及以上学历，熟悉内容策划和运营分析。'.repeat(5),
  '申请岗位'
 ];
 const withNoJob=readPublicJob(l,{title:'岗位详情 | 企业招聘',
  content:base.join('\n')},now);
 assert.equal(withNoJob,null);
 const twoRoles=[...base];
 twoRoles.splice(5,0,'内容运营经理 上海','产品运营经理 北京');
 assert.equal(readPublicJob(l,{title:'岗位详情 | 企业招聘',
  content:twoRoles.join('\n')},now),null);
});

test('Single fetched HTML JobPosting can supply work city; conflicting, foreign or expired schemas are rejected',()=>{
 const url='https://careers.yunhe.cn/jobs/202611080041';
 const link=publicJobLink(url);
 const role='内容运营';
 const body=[
  '# 内容运营','公司名称：云禾文化有限公司',
  '岗位职责','负责公众号内容策划、短视频生产、数据分析与运营。'.repeat(5),
  '任职要求','本科及以上学历，熟悉新媒体内容运营和用户增长。'.repeat(5),
  '立即申请'
 ].join('\n');
 const wrap=data=>'<html><script type="application/ld+json">'+JSON.stringify(data)+
  '</script><main><h1>内容运营</h1></main></html>';
 const data={'@context':'https://schema.org','@type':'JobPosting',
  title:role,jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',
   addressLocality:'上海市',addressCountry:'CN'}}};
 const good=readPublicJob(link,{title:role,content:body,html:wrap(data)},now);
 assert.equal(good?.location,'上海');
 assert.equal(good?.evidence.location_evidence_type,'JOBPOSTING_STRUCTURED');
 assert.equal(good?.source_status,'PUBLIC_JOB_UNCONFIRMED');
 const rejects={};
 const mismatch=readPublicJob(link,{title:role,
  content:body.replace('# 内容运营','# 内容运营\n工作地点：北京'),
  html:wrap(data)},now,rejects);
 assert.equal(mismatch,null);
 assert.equal(rejects.AMBIGUOUS_WORKPLACE,1);
 const overseas=readPublicJob(link,{title:role,content:body,
  html:wrap({...data,jobLocation:{address:{addressLocality:'上海市',addressCountry:'US'}}})},now,{});
 assert.equal(overseas,null);
 const expired=readPublicJob(link,{title:role,content:body,
  html:wrap({...data,validThrough:'2020-01-01'})},now,{});
 assert.equal(expired,null);
 const multi=readPublicJob(link,{title:role,content:body,
  html:wrap({'@graph':[data,{...data,title:'平面设计',jobLocation:{
   address:{addressLocality:'北京',addressCountry:'CN'}}}]})},now,{});
 assert.equal(multi,null);
});
