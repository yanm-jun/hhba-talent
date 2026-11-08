/**
 * Infer a *search direction*, not a career credential, from resume action
 * evidence. A model may suggest an occupation only when concrete work/task
 * text supports it; isolated skill words and a person's name never suffice.
 */
const CANDIDATE_DIRECTIONS=[
 {canonical:'Python 开发工程师',kind:'backend',evidence:/(?:\bpython\b[\s\S]{0,55}(?:接口开发|后端开发|服务端开发|系统开发|平台开发|软件开发)|(?:接口开发|后端开发|服务端开发|系统开发)[\s\S]{0,55}\bpython\b)/i},
 {canonical:'Java 开发工程师',kind:'backend',evidence:/(?:\bjava\b[\s\S]{0,55}(?:后端开发|接口开发|系统开发|软件开发)|(?:后端开发|接口开发|系统开发)[\s\S]{0,55}\bjava\b)/i},
 {canonical:'前端开发工程师',kind:'frontend',evidence:/(?:前端(?:页面|开发|项目)|(?:vue|react)[\s\S]{0,55}(?:页面|前端|开发)|(?:开发|搭建|实现)[\s\S]{0,55}(?:vue|react))/i},
 {canonical:'数据分析师',kind:'data-analyst',evidence:/(?:负责|开展|参与|完成|分析|制作|构建)[^\n。]{0,75}(?:数据分析|数据清洗|业务分析|数据报表|bi报表)|(?:数据分析|业务分析)[^\n。]{0,60}(?:项目|工作|任务|业务)/i},
 {canonical:'数据工程师',kind:'data-engineer',evidence:/(?:负责|参与|搭建|开发|构建)[^\n。]{0,70}(?:etl|数据仓库|数据管道|数据平台|数据链路|大数据平台)/i},
 {canonical:'测试开发工程师',kind:'qa',evidence:/(?:负责|参与|设计|编写|执行|开发)[^\n。]{0,75}(?:自动化测试|测试用例|回归测试|测试平台|质量保障)/i},
 {canonical:'产品经理',kind:'product',evidence:/(?:负责|参与|编写|制定|管理)[^\n。]{0,70}(?:产品规划|产品需求|产品设计|需求文档|需求分析|产品路线图)/i},
 {canonical:'视觉设计师',kind:'graphic-design',evidence:/(?:负责|参与|制作|完成|设计)[^\n。]{0,70}(?:品牌视觉|视觉设计|平面设计|品牌包装|海报设计|VI设计)/i},
 {canonical:'内容运营',kind:'operations',evidence:/(?:负责|参与|策划|撰写|运营)[^\n。]{0,70}(?:内容运营|新媒体|公众号|社交媒体运营|短视频内容)/i},
 {canonical:'销售顾问',kind:'sales',evidence:/(?:负责|从事|跟进|开发|接待)[^\n。]{0,70}(?:客户销售|客户转化|汽车销售|销售线索|销售顾问|商务开发|客户跟进)/i},
 {canonical:'影视剪辑师',kind:'film-editing',evidence:/(?:负责|参与|完成|独立)[^\n。]{0,75}(?:视频剪辑|影视后期|剪辑短视频|视频后期|影视剪辑|宣传片剪辑)/i},
 {canonical:'影视编导',kind:'film-directing',evidence:/(?:负责|参与|主导|制作)[^\n。]{0,75}(?:影视分镜|拍摄脚本|短视频编导|影视导演|现场导演|导演分镜)/i},
 {canonical:'舞蹈编导',kind:'dance-choreography',evidence:/(?:负责|参与|主导|完成|组织)[^\n。]{0,75}(?:舞蹈编排|舞蹈创作|群舞排练|舞蹈编导|编舞)/i},
 {canonical:'舞蹈演员',kind:'dance-performance',evidence:/(?:参与|担任|出演|完成)[^\n。]{0,75}(?:舞蹈演出|舞蹈表演|舞台舞蹈|舞蹈演员)/i},
 {canonical:'舞蹈教师',kind:'dance-education',evidence:/(?:负责|承担|开展|从事)[^\n。]{0,75}(?:舞蹈教学|舞蹈授课|舞蹈课程|舞蹈教师)/i},
 {canonical:'机械设计工程师',kind:'mechanical',evidence:/(?:负责|参与|完成|主导)[^\n。]{0,75}(?:机械设计|机械结构|零件设计|机械制图|CAD出图|cad出图)/i},
 {canonical:'电气工程师',kind:'electrical',evidence:/(?:负责|参与|完成|主导)[^\n。]{0,75}(?:电气设计|电气原理图|PLC编程|plc编程|电气控制)/i},
 {canonical:'工业设计师',kind:'industrial-design',evidence:/(?:负责|参与|主导|完成)[^\n。]{0,75}(?:工业产品设计|产品外观设计|工业设计|产品造型设计)/i},
 {canonical:'土木工程师',kind:'civil',evidence:/(?:负责|参与|承担|完成)[^\n。]{0,75}(?:土木工程|施工组织|施工管理|土建工程|工程结构计算)/i},
 {canonical:'建筑设计师',kind:'architecture',evidence:/(?:负责|参与|完成|主导)[^\n。]{0,75}(?:建筑方案设计|建筑平面设计|建筑设计|建筑规划)/i},
 {canonical:'供应链管理',kind:'supply-chain',evidence:/(?:负责|参与|完成|管理|优化)[^\n。]{0,75}(?:供应商管理|采购计划|供应链管理|采购合同|采购执行)/i},
 {canonical:'物流专员',kind:'logistics',evidence:/(?:负责|参与|管理|完成)[^\n。]{0,75}(?:物流调度|运输调度|仓储运营|物流管理|仓库管理)/i},
 {canonical:'外贸业务',kind:'international-trade',evidence:/(?:负责|参与|跟进|处理|开发)[^\n。]{0,75}(?:出口订单|进口报关|出口报关|外贸客户|外贸业务|进出口业务)/i},
 {canonical:'翻译',kind:'translation',evidence:/(?:负责|完成|承担|参与)[^\n。]{0,75}(?:文件翻译|商务口译|同声传译|笔译工作|口译服务)/i},
 {canonical:'法务专员',kind:'legal',evidence:/(?:负责|参与|完成|承担)[^\n。]{0,75}(?:合同审核|法律合规|法务工作|法律尽调|合规审查)/i},
 {canonical:'护士',kind:'nursing',evidence:/(?:负责|参与|执行|承担)[^\n。]{0,75}(?:临床护理|病房护理|护理工作|患者护理|护理操作)/i},
 {canonical:'财务会计',kind:'accounting',evidence:/(?:负责|完成|参与|承担)[^\n。]{0,75}(?:账务处理|会计凭证|总账核算|财务记账|会计报表)/i},
 {canonical:'市场营销',kind:'marketing',evidence:/(?:负责|参与|策划|执行|组织)[^\n。]{0,75}(?:市场营销|品牌推广|市场推广|营销方案|营销活动)/i},
 {canonical:'食品工程师',kind:'food-science',evidence:/(?:负责|完成|参与|主导)[^\n。]{0,75}(?:食品研发|食品检测|食品质量|食品工艺)/i}
];
const contains=(text,phrase)=>text.toLowerCase().includes(String(phrase).toLowerCase());
export function groundedCareerDirections(proposed,source,{limit=6}={}){
 const raw=typeof source==='string'?source.slice(0,20000):'';
 if(raw.trim().length<20)return [];
 const safe=Array.isArray(proposed)?proposed.filter(x=>typeof x==='string'&&x.length>=2&&x.length<=70):[];
 const documented=CANDIDATE_DIRECTIONS.filter(row=>row.evidence.test(raw));
 const candidates=[];
 for(const name of safe){
  const normalized=name.trim();
  if(contains(raw,normalized)){
   candidates.push(normalized);
   continue;
  }
  const matched=documented.find(row=>row.canonical===normalized||
   (row.kind==='backend'&&/^(?:后端开发|后端工程师)$/.test(normalized))||
   (row.kind==='frontend'&&/^(?:前端开发|前端工程师)$/.test(normalized))||
   (row.kind==='data-analyst'&&/^(?:数据分析|数据分析师)$/.test(normalized))||
   (row.kind==='qa'&&/^(?:测试开发|测试开发工程师)$/.test(normalized)));
  if(matched)candidates.push(matched.canonical);
 }
 // Only when the model has not supported any roles: a bounded fallback
 // grounded in specific actions, not in an isolated technology word.
 if(!candidates.length&&documented.length)
  candidates.push(...documented.slice(0,3).map(x=>x.canonical));
 return [...new Set(candidates)].slice(0,Math.min(6,Math.max(1,limit))) ;
}
