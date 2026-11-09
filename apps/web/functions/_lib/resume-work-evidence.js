// Collect concrete, verbatim career evidence from a redacted resume.
// These are proof excerpts for explanations, not a way to infer credentials.
const ACTION=/(?:负责|参与|协助|推动|完成|统筹|组织|制定|搭建|建设|优化|执行|撰写|申报|协调|推进|分析|管理|开发|设计|培训|制作|核验|复盘|落地|带教|实施|led|managed|created|built|improved|coordinated|delivered)/i;
const PERSONAL=/(?:1[3-9]\d{9}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|身份证|个人电话|微信号|忽略以上指令)/i;
const BAD_LINE=/^(?:姓名|性别|年龄|学历|意向岗位|求职意向|期望薪资|工作时间|联系电话|手机号|邮箱|学校|籍贯|婚姻|政治面貌)[：:]/i;
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s_.()（）【】\-]+/g,'');
const safe=s=>typeof s==='string'?s.trim():'';

const GROUPS=[
 {name:'政府事务与政策项目',role:/(?:政府关系|政府事务|公共事务|政企|政府项目|政策研究|政策申报|产业政策|政策专员|government relations|government affairs|public affairs|\bGR\b)/i,
  evidence:/(?:政策研究|项目申报|政府事务|政府关系|政企|政策解读|行政审批|专项资金|政府调研|政府项目|财政资助|监管风险|工信|人社)/i},
 {name:'区域与渠道运营',role:/(?:区域运营|终端运营|门店运营|运营督导|渠道运营|经销商|销售运营|区域管理|渠道管理|商业运营)/i,
  evidence:/(?:门店|销售漏斗|到店率|邀约|试驾|DCC|经销商|销售运营|区域运营|终端运营|成交率|渠道|销售流程|人员带教|SOP)/i},
 {name:'内容策划与传播',role:/(?:内容运营|内容策划|新媒体|社交媒体|短视频|视频运营|内容营销|社媒|编辑|传播|品牌内容|content operations|content marketing)/i,
  evidence:/(?:内容策划|短视频|视频制作|社交媒体|新媒体|公众号|小红书|内容运营|内容生产|账号运营|传播|阅读量|互动量)/i},
 {name:'产品策划与需求推进',role:/(?:产品经理|产品专员|产品策划|产品运营|需求分析|产品负责人|product manager|product owner)/i,
  evidence:/(?:产品规划|需求拆解|需求分析|产品原型|产品设计|功能规划|功能设计|用户研究|交互设计|研发验收|功能验收|产品迭代)/i},
 {name:'数据与业务分析',role:/(?:数据分析|商业分析|业务分析|增长分析|数据运营|策略分析|数据产品|data analyst|business analyst)/i,
  evidence:/(?:数据分析|指标拆解|业务分析|数据看板|漏斗|转化率|统计分析|SQL|Excel|数据报表|经营数据|业务数据)/i},
 {name:'项目统筹与协同',role:/(?:项目管理|项目运营|项目经理|项目交付|项目统筹|PMO|项目专员|project manager|program manager)/i,
  evidence:/(?:项目推进|项目管理|项目申报|统筹|跨部门|项目交付|项目结项|排期|项目复盘|项目执行|项目验收|资源协调)/i},
 {name:'销售与客户运营',role:/(?:销售顾问|客户经理|销售专员|销售主管|商务拓展|客户运营|销售经理|business development|account manager)/i,
  evidence:/(?:客户开发|销售线索|客户跟进|成交|试驾|邀约|客户需求|商机|销售顾问|订单|客户管理|客户沟通)/i},
 {name:'人才与组织发展',role:/(?:人力资源|招聘专员|培训专员|人才发展|组织发展|员工培训|招聘运营|human resources|recruiter)/i,
  evidence:/(?:人才项目|人员培养|带教|新人培训|招聘|培训体系|培训计划|人才培养|人员协调|课程安排|员工)/i},
 {name:'视觉与创意设计',role:/(?:视觉设计|平面设计|品牌设计|UI设计|交互设计|创意设计|graphic designer|visual designer)/i,
  evidence:/(?:视觉设计|平面设计|界面设计|交互设计|视觉创意|设计作品|海报|包装设计|品牌视觉|设计实践)/i}
];
function validQuote(q,original){
 return q.length>=16&&q.length<=220&&
  original.toLowerCase().includes(q.toLowerCase())&&ACTION.test(q)&&
  !PERSONAL.test(q)&&!BAD_LINE.test(q);
}
function autoQuotes(original){
 // In case a provider omits optional highlights, preserve independently
 // verifiable experience evidence without a second paid model call.
 return original.replace(/\r/g,'').split(/[\n。；]/)
  .map(x=>x.trim().replace(/^[•·*\-]\s*/,''))
  .filter(x=>validQuote(x,original))
  .sort((a,b)=>{
   const score=x=>(GROUPS.some(g=>g.evidence.test(x))?3:0)+
    (/\d{1,3}(?:[.,]\d+)?\s*(?:项|人|次|份|年|%|城|月|万|批)/.test(x)?2:0)+
    (/(?:实现|提升|改善|完成|获批|推动|建立|统筹)/.test(x)?1:0);
   return score(b)-score(a);
  });
}
export function verifiedWorkEvidence(proposed,original){
 if(typeof original!=='string'||original.length<20)return [];
 const offered=(Array.isArray(proposed)?proposed:[]).slice(0,14)
  .map(x=>safe(typeof x==='string'?x:x?.evidence))
  .filter(x=>validQuote(x,original));
 const candidates=[...offered,...autoQuotes(original)];
 const result=[],seen=new Set();
 for(const quote of candidates){
  const key=norm(quote);
  if(seen.has(key)||result.some(x=>norm(x).includes(key)||key.includes(norm(x))))continue;
  seen.add(key);result.push(quote);
  if(result.length>=10)break;
 }
 return result;
}
function quotePreview(quote,limit=115){
 return quote.length<=limit?quote:quote.slice(0,limit).replace(/[，,、\s]+[^，,、\s]*$/,'')+'…';
}
export function relevantWorkEvidence(examples,job,limit=2){
 const title=safe(job?.title);
 const topic=GROUPS.find(g=>g.role.test(title));
 if(!topic)return [];
 const candidates=(Array.isArray(examples)?examples:[]).filter(x=>
  typeof x==='string'&&x.length>=16&&x.length<=220&&
  !PERSONAL.test(x)&&ACTION.test(x)&&topic.evidence.test(x)
 );
 return candidates.slice(0,Math.max(0,Math.min(2,limit))).map(x=>({
  quote:quotePreview(x),
  rationale:'体现与'+topic.name+'相关的真实实践，与「'+title.slice(0,60)+'」岗位方向存在联系'
 }));
}
