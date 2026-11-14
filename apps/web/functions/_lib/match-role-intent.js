// Deterministic role-intent expansion and resume evidence extraction for HHBA.
// This module creates search context without another paid model call.
// Evidence labels are search hints only; they never assert an unverified qualification.
const clean=(value,max=240)=>String(value||'').replace(/[\\u0000-\\u001f<>]/g,' ')
 .replace(/\\s+/g,' ').trim().slice(0,max);
const unique=(items,max=12)=>[...new Set(items.map(x=>clean(x,36)).filter(Boolean))].slice(0,max);
const FAMILIES=[
 {id:'supervision',pattern:/(?:区域|渠道|市场|销售|门店|终端)?督导|巡店|稽核|终端管理/,
  direct:['区域督导','渠道督导','市场督导','销售督导','门店督导','终端督导','巡店管理'],
  adjacent:['区域运营','渠道运营','销售运营','零售运营','门店运营','培训督导']},
 {id:'channel',pattern:/经销商|4S店|DCC|渠道管理|渠道拓展|终端运营/,
  direct:['渠道管理','经销商管理','渠道运营','终端运营','汽车区域运营'],
  adjacent:['区域经理','销售运营','门店运营','客户成功']},
 {id:'sales',pattern:/销售|客户开发|商务拓展|BD|大客户|线索转化/,
  direct:['销售管理','区域销售','大客户经理','商务拓展','渠道销售'],
  adjacent:['客户成功','销售运营','商业运营','业务拓展']},
 {id:'product',pattern:/AI产品|产品经理|产品规划|需求分析|智能体|Agent|RAG|工作流|大模型/,
  direct:['AI产品经理','产品经理','大模型应用产品经理','智能体产品运营','产品运营'],
  adjacent:['数字化产品运营','项目经理','解决方案顾问','产品实施顾问']},
 {id:'operations',pattern:/运营|用户增长|活动策划|商业化|业务流程/,
  direct:['业务运营','用户运营','市场运营','项目运营','商业运营'],
  adjacent:['产品运营','客户运营','项目管理','增长运营']},
 {id:'data',pattern:/数据分析|SQL|Python|统计分析|数据建模|BI/,
  direct:['数据分析师','经营分析','商业分析','数据运营'],
  adjacent:['产品分析','运营分析','业务分析']},
 {id:'design',pattern:/视觉设计|交互设计|UI设计|UX|Figma|Photoshop|数字导视/,
  direct:['视觉设计师','UI设计师','交互设计师','体验设计师'],
  adjacent:['品牌设计','数字媒体设计','产品设计']},
 {id:'technology',pattern:/JavaScript|TypeScript|Python|Java|前端开发|后端开发|软件开发|API开发/,
  direct:['软件开发工程师','前端开发','后端开发','技术支持工程师'],
  adjacent:['实施工程师','解决方案工程师','技术产品经理']},
 {id:'training',pattern:/培训|讲师|带教|课程开发|人才培养|教学/,
  direct:['培训经理','培训督导','培训讲师','人才发展'],
  adjacent:['区域运营','销售赋能','学习发展']},
 {id:'marketing',pattern:/品牌推广|市场营销|新媒体|内容运营|媒介/,
  direct:['品牌运营','市场推广','市场营销','内容运营'],
  adjacent:['用户运营','活动运营','商务合作']}
];
const INDUSTRIES=[
 {pattern:/汽车|4S店|经销商|DCC|名爵|上汽|车企/i,label:'汽车与汽车零售'},
 {pattern:/AI|人工智能|智能体|Agent|大模型|软件|互联网|平台/i,label:'互联网与人工智能'},
 {pattern:/零售|门店|商超|消费品|连锁/i,label:'零售与消费品'},
 {pattern:/设计|视觉|交互|影视|传媒|艺术/i,label:'文化传媒与设计'},
 {pattern:/物流|仓储|供应链|运输/i,label:'交通物流与供应链'},
 {pattern:/教育|培训|课程|教学/i,label:'教育培训'}
];
const SKILL_SIGNALS=[
 {name:'区域与渠道管理',pattern:/区域管理|渠道管理|经销商|4S店|DCC|门店运营|终端管理|巡店/i},
 {name:'销售转化与客户运营',pattern:/销售漏斗|线索转化|客户管理|成交|试驾|邀约|到店|销售业绩/i},
 {name:'团队培训与质量管理',pattern:/培训|带教|督导|巡店|考核|质检|团队管理|录音回收/i},
 {name:'产品与项目运营',pattern:/产品规划|需求分析|项目管理|用户增长|工作流|智能体|Agent|RAG|AI产品/i},
 {name:'数据分析与经营复盘',pattern:/数据分析|Excel|SQL|指标|转化率|报表|统计|经营分析/i},
 {name:'视觉与交互设计',pattern:/UI设计|UX|视觉设计|交互设计|Figma|Photoshop|数字导视/i},
 {name:'软件与技术应用',pattern:/Python|JavaScript|TypeScript|Java|API|Git|软件开发/i},
 {name:'市场与品牌运营',pattern:/品牌推广|市场营销|活动策划|新媒体|内容运营|品牌运营/i}
];
function matchedFamilies(text){return FAMILIES.filter(f=>f.pattern.test(text));}
function firstDirection(hint,families){
 const first=hint.split(/[，,；;、|\\n]/)[0]?.trim()||'';
 if(first&&!/(全国|出差|出行|优先|接受|不限|可远程|薪资|城市)/.test(first))return first.slice(0,24);
 for(const family of families){const m=hint.match(family.pattern);if(m)return m[0].slice(0,24);}
 return '';
}
function constraintsFrom(hint,resume){
 const text=hint+' '+resume;
 const travel=/(全国(?:范围)?(?:出差|出行)|接受(?:全国)?出差|可接受出差|长期出差|经常出差|全国各地|全国范围)/.test(hint);
 const national=/(全国|不限城市|各地均可)/.test(hint);
 const cities=['北京','上海','广州','深圳','杭州','南京','苏州','成都','重庆','武汉','西安','天津','青岛','济南','郑州','长沙','合肥','宁波','厦门','福州','昆明','贵阳','南宁','哈尔滨','沈阳','长春','大连'];
 const preferredCities=cities.filter(city=>new RegExp('(?:意向|期望|希望|目标|首选|工作地点|工作区域)[^。；;，,]{0,12}'+city).test(text));
 const preferenceTerms=[];
 if(/汽车|汽车零售|车企|经销商/.test(hint))preferenceTerms.push('汽车行业优先');
 if(/互联网|AI|人工智能|软件/.test(hint))preferenceTerms.push('互联网与科技行业优先');
 return {national_scope:national,travel_preference:travel?'优先考虑全国出差或跨区域岗位':'未明确提出出差要求',
  preferred_cities:preferredCities.slice(0,4),industry_preferences:preferenceTerms};
}
export function buildRoleIntent(roleHint='',resume=''){
 const hint=clean(roleHint,240),text=String(resume||'').slice(0,13000);
 const hintFamilies=matchedFamilies(hint),resumeFamilies=matchedFamilies(text);
 const primaryFamilies=hintFamilies.length?hintFamilies:resumeFamilies.slice(0,2);
 const primaryDirection=firstDirection(hint,primaryFamilies)||primaryFamilies[0]?.direct[0]||'根据简历推荐';
 const directRoles=unique([primaryDirection,...primaryFamilies.flatMap(f=>f.direct)],10);
 const adjacentRoles=unique(primaryFamilies.flatMap(f=>f.adjacent),10);
 const resumeRoles=unique(resumeFamilies.flatMap(f=>f.direct),12);
 const industryTerms=unique(INDUSTRIES.filter(x=>x.pattern.test(text)).map(x=>x.label),5);
 const constraints=constraintsFrom(hint,text);
 return {primary_direction:primaryDirection,direct_roles:directRoles,adjacent_roles:adjacentRoles,
  resume_related_roles:resumeRoles,industry_terms:industryTerms,constraints,
  matched_families:unique([...primaryFamilies,...resumeFamilies].map(f=>f.id),10)};
}
function query(parts){return unique(parts.flatMap(x=>Array.isArray(x)?x:[x]),18).join(' ').slice(0,128);}
export function buildRoleSearchQueries(roleHint='',resume=''){
 const intent=buildRoleIntent(roleHint,resume),c=intent.constraints;
 const travel=c.travel_preference.includes('优先')?'全国出差':'';
 const industry=intent.industry_terms.slice(0,2);
 const common='招聘 职位详情 企业官网 中国大陆';
 const queries=[
  query([intent.primary_direction,intent.direct_roles.slice(1,5),travel,common]),
  query([intent.direct_roles.slice(5,10),industry,'社会招聘 官方招聘 中国大陆']),
  query([intent.adjacent_roles.slice(0,6),industry,'企业招聘 职位详情 中国大陆']),
  query([intent.primary_direction,intent.resume_related_roles.slice(0,5),travel,industry,'企业官方招聘'])
 ].filter(Boolean);
 return [...new Set(queries)].slice(0,4);
}
export function buildSupplementalRoleQueries(roleHint='',resume='',city=''){
 const intent=buildRoleIntent(roleHint,resume),c=intent.constraints;
 const location=city||c.preferred_cities[0]||(c.national_scope?'全国':'中国大陆');
 const travel=c.travel_preference.includes('优先')?'全国出差':'';
 const a=query([intent.direct_roles.slice(3,9),location,travel,'招聘 职位详情 企业官网']);
 const b=query([intent.adjacent_roles.slice(0,7),intent.industry_terms.slice(0,2),location,'社会招聘 官方招聘']);
 return [...new Set([a,b].filter(Boolean))].slice(0,2);
}
function evidence(text,pattern){
 const match=pattern.exec(text);if(!match)return '';
 const start=Math.max(0,match.index-18),end=Math.min(text.length,match.index+match[0].length+24);
 return clean(text.slice(start,end),90);
}
export function buildResumeProfile(resume='',intent=null){
 const text=String(resume||'').slice(0,13000);
 const roleIntent=intent||buildRoleIntent('',text);
 const skills=SKILL_SIGNALS.map(signal=>({name:signal.name,evidence:evidence(text,signal.pattern)}))
  .filter(item=>item.evidence).slice(0,8);
 const educationMatch=text.match(/博士研究生|博士|硕士研究生|硕士|研究生|本科|大学专科|大专|专科|高中|中专/);
 const experienceMatch=text.match(/(?:工作经验|从业经验|相关工作经验|工作年限|从业年限)\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)\\s*年/);
 return {education:educationMatch?.[0]||null,education_evidence:educationMatch?.[0]||null,
  experience_years:experienceMatch?Number(experienceMatch[1]):null,
  experience_evidence:experienceMatch?.[0]||null,skills,
  target_roles:unique([...roleIntent.direct_roles,...roleIntent.adjacent_roles],12),
  warnings:['能力标签由简历可见文字提取，仅用于搜索与匹配线索；学历、年限和技能须以原简历及招聘要求核验。']};
}
