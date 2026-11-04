/**
 * 2027 winter job postings: strictly one row per employer-issued vacancy or
 * official job requisition. Business functions within one placement posting
 * MUST NOT be split into fake independent vacancies.
 * The programme-only catalogue lives in winter2027Programs.ts.
 * Posted ≠ currently accepting applications. Review before every production release.
 */
export type WinterJobStatus='verify-apply'|'deadline-conflict'|'closed';
export type WinterJob={
 id:string;company:string;english:string;title:string;
 region:string;city:string;industry:string;location:string;
 startDate:string;period:string;deadline:string;
 description:string;requirements:string[];majorTags:string[];tags:string[];
 sourceUrl:string;applyUrl:string;checkedOn:string;status:WinterJobStatus;
 statusNote:string;workRightsNote?:string;salaryNote?:string;
 originalProgramId?:string;
};
export const WINTER_2027_JOBS:ReadonlyArray<WinterJob>=[
 {
  id:'apco-shanghai-winter-start-1787',company:'APCO Worldwide',english:'APCO Worldwide',
  title:'政府事务与战略传播实习生（2027 冬季入职）',
  region:'中国内地',city:'上海',industry:'传播公关',location:'上海·太仓路（混合办公）',
  startDate:'2027 年 1 月或 2 月',period:'至少 3 个月，每周至少 3 个完整工作日',
  deadline:'招聘页面未提供统一截止日期；实时申请状态请以官网为准',
  description:'APCO 官方职位编号 1787。协助政策、行业、媒体和市场研究，制作客户简报与演示材料，撰写中文传播内容，并支持政府事务与客户项目。',
  requirements:['本科三年级及以上，包括符合条件的硕士和毕业生；国际关系、政治学、传播、公关或相关背景。','中文母语水平、英语流利，官方职位注明相当于 IELTS 7.0+ 或 TOEFL iBT 100+。','具备研究、分析、写作、PowerPoint、Word 和 Excel 能力。','能够从 2027 年 1 月或 2 月开始、至少投入三个月且每周至少三个完整工作日。'],
  majorTags:['传播学','新闻学','公共关系','国际关系','政治学','英语','广告学'],
  tags:['实习','传播','政府事务','公关','行业研究','2027','冬季','上海'],
  sourceUrl:'https://fa-evxv-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/1787',
  applyUrl:'https://fa-evxv-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/1787',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'官方发布具体岗位（编号 1787）；投递按钮及名额需在企业招聘系统复核',
  salaryNote:'官方明确说明为带薪实习，但没有公布具体金额',
  originalProgramId:'apco-shanghai-2027-winter'
 },
 {
  id:'hsbc-hk-student-placement-1367003857',company:'汇丰银行',english:'HSBC',
  title:'Student Work Placement 学生工作实习（2027 上半年）',
  region:'中国香港',city:'香港',industry:'金融银行',location:'香港·中环（全职到岗）',
  startDate:'2027 年 1 月 5 日',period:'2027 年 1 月 5 日至 6 月 30 日（六个月）',
  deadline:'官方不同入口同时出现 2026 年 10 月 30 日及 11 月 20 日；无法确认当前开放',
  description:'汇丰官方招聘职位 1367003857。一个综合学生实习招聘项目，提供商业银行、数字银行、数据分析、合规、客户服务、市场研究等多个职能方向的匹配机会；这些方向不是独立发布的岗位，不拆分重复展示。',
  requirements:['大学本科在读，不限具体专业；实际匹配业务方向由招聘系统决定。','可以在 2027 年 1 月 5 日至 6 月 30 日全职实习。','实习期间及结束后均具备合法在港工作资格，且无需汇丰提供签证担保。','每轮仅接受一次申请；申请数量较多时职位可能提前关闭。'],
  majorTags:['金融学','经济学','会计学','计算机科学','数据科学','法学','市场营销','不限专业'],
  tags:['汇丰','实习','香港','数据分析','数字银行','银行','商业分析','2027','冬季'],
  sourceUrl:'https://apply.careers.hsbc.com/emergingtalent/job/Central-HSBC-Student-Work-Placement-Hong/1367003857/',
  applyUrl:'https://apply.careers.hsbc.com/emergingtalent/job/Central-HSBC-Student-Work-Placement-Hong/1367003857/',
  checkedOn:'2026-11-04',status:'deadline-conflict',
  statusNote:'官方具体职位存在两种截止日版本；暂不标记为确认在招',
  workRightsNote:'必须具备合法香港工作资格，官方明确不提供签证担保。',
  originalProgramId:'hsbc-hk-2027-work-placement'
 },
 {
  id:'qima-hk-sales-intern-744000154586189',company:'QIMA',english:'QIMA',
  title:'Sales Coordinator Internship 销售协调实习生',
  region:'中国香港',city:'香港',industry:'商务销售',location:'中国香港·线下办公',
  startDate:'2027 年 1 月',period:'连续实习约六个月',
  deadline:'岗位页面没有可靠统一截止日期；需检查是否仍接受申请',
  description:'QIMA 自有官方招聘系统发布的具体实习岗位。主要负责销售线索发掘、潜在客户联络、CRM 与报表维护、账户跟进以及销售会议支持。',
  requirements:['商学院或商科背景在校生。','能从 2027 年 1 月开始连续实习约六个月。','参与线索开发、销售报表及客户资料维护。','若从香港以外地区申请，需先核实本人的合法工作资格。'],
  majorTags:['工商管理','市场营销','商务英语','国际商务','经济学','管理学'],
  tags:['QIMA','香港','销售','市场','客户关系','CRM','国际商务','实习','2027'],
  sourceUrl:'https://jobs.smartrecruiters.com/QIMA/744000154586189-sales-coordinator-internship',
  applyUrl:'https://jobs.smartrecruiters.com/QIMA/744000154586189-sales-coordinator-internship',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'雇主官方招聘系统有具体岗位；当前投递是否开放需在页面确认',
  salaryNote:'原职位标示最高每月 1,200 欧元；实际发薪币种与金额以雇主合同为准',
  workRightsNote:'招聘信息未提供签证担保说明；非当地申请者须核对香港工作资格。'
 },
 {
  id:'bdo-hk-spring-assurance-2027',company:'BDO 香港',english:'BDO Hong Kong',
  title:'Spring Internship 2027 – Assurance 审计鉴证实习生',
  region:'中国香港',city:'香港',industry:'审计咨询',location:'中国香港·全职线下实习',
  startDate:'2027 年 1 月初',period:'2027 年 1 月初至 4 月末，全职',
  deadline:'企业官方明确显示 2026 年 11 月 20 日截止；可能提前关闭，以申请系统为准',
  description:'BDO 香港独立发布的 2027 春季鉴证实习招聘岗位（职位列表编号 134）。参与审计项目，协助鉴证团队执行审计工作并接受专业指导。',
  requirements:['本科大二或大三在读。','会计、经济、金融等专业优先。','可于 2027 年 1 月初至 4 月末全职实习。','按 BDO 官方职位页要求申请，并核对在香港实习的工作许可。'],
  majorTags:['会计学','审计学','财务管理','金融学','经济学'],
  tags:['BDO','香港','审计','鉴证','会计','Spring Internship','2027','冬季','春季'],
  sourceUrl:'https://recruitment.bdo.com.hk/Apply/JobDetail.aspx?qs=oPaEsT8Oae0cgQ5ubvSQIQ%3D%3D',
  applyUrl:'https://recruitment.bdo.com.hk/Apply/JobDetail.aspx?qs=oPaEsT8Oae0cgQ5ubvSQIQ%3D%3D',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'官方岗位编号 134，明确标示 2026-11-20 截止；是否仍可提交以招聘系统为准',
  workRightsNote:'香港实习岗位；非香港居民请先确认合法工作资格，官方未明确本岗位签证担保安排。'
 },
 {
  id:'bdo-hk-spring-it-audit-2027',company:'BDO 香港',english:'BDO Hong Kong',
  title:'Spring Internship 2027 – IT Audit 信息技术审计实习生',
  region:'中国香港',city:'香港',industry:'审计咨询',location:'中国香港·全职线下实习',
  startDate:'2027 年 1 月初',period:'2027 年 1 月初至 4 月末，全职',
  deadline:'企业官方明确显示 2026 年 11 月 30 日截止；可能提前关闭，以申请系统为准',
  description:'BDO 香港另一个独立的 2027 IT 审计实习职位。协助团队审查 IT 一般控制、应用控制、数据库管理及网络安全，并参与审计报告与改进建议。',
  requirements:['本科大二或大三在读。','计算机科学、会计、信息系统或相关专业优先。','可于 2027 年 1 月初至 4 月末全职实习。','对 IT 风险、信息系统、数据库或网络安全有兴趣，按照雇主要求提交材料。'],
  majorTags:['计算机科学','信息系统','网络安全','信息安全','会计学','审计学','软件工程'],
  tags:['BDO','香港','IT审计','信息系统','网络安全','数据库','2027','春季','冬季'],
  sourceUrl:'https://recruitment.bdo.com.hk/Apply/JobDetail.aspx?qs=Y8N698+gXg1C1B5645zuhg%3D%3D',
  applyUrl:'https://recruitment.bdo.com.hk/Apply/JobDetail.aspx?qs=Y8N698+gXg1C1B5645zuhg%3D%3D',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'BDO 官方 IT 审计具体职位，截止 2026-11-30；并非保证实时仍可申请',
  workRightsNote:'香港实习岗位；申请前请确认在港工作资格，雇主未明确本岗位签证担保安排。'
 },
 {
  id:'atkinsrealis-hk-winter-2027-r164310',company:'AtkinsRéalis',english:'AtkinsRéalis',
  title:'Winter Internship 2027 – 工程与可持续发展实习生',
  region:'中国香港',city:'香港',industry:'工程技术',location:'中国香港·尖沙咀',
  startDate:'2027 年冬季（具体入职日期待官网确认）',period:'冬季实习，具体实习时长以正式录用说明为准',
  deadline:'雇主职位页面未列公开统一截止日期；请核实官网是否仍可投递',
  description:'AtkinsRéalis 官方冬季实习职位编号 R-164310。参与工程设计、临时及永久工程技术支持、施工现场观察与项目协调。报名时申请者可填写最多三个业务方向偏好，由企业按需要分配；这些业务方向并非 13 个单独招聘岗位。',
  requirements:['大二及以上土木、结构、岩土、交通、建筑设备、机械、电气、环境或其他相关工程专业学生。','具备中英文书面与口头沟通能力，以及分析和团队协作能力。','申请时需准备个人简历、成绩单、HKDSE 英语及/或 IELTS 成绩与最多三个业务方向意向。','业务线偏好不保证录取至对应组别，实际分配以企业决定。'],
  majorTags:['土木工程','机械工程','电气工程','建筑环境','环境工程','交通工程','结构工程','岩土工程','可持续发展'],
  tags:['AtkinsRealis','香港','工程','机械','电气','土木','环境','2027','冬季','MVAC','MEP'],
  sourceUrl:'https://careers.atkinsrealis.com/fr-fr/jobs/winter-internship-r-164310',
  applyUrl:'https://careers.atkinsrealis.com/fr-fr/jobs/winter-internship-r-164310',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'雇主官方发布单一冬季实习岗位 R-164310；具体日期和投递按钮以官网为准',
  workRightsNote:'实习工作地点为中国香港，申请时须自行核实合法工作资格及企业签证担保政策。'
 },
 {
  id:'rsm-hk-spring-audit-assurance-2027',company:'RSM 罗申美香港',english:'RSM Hong Kong',
  title:'2027 Spring Interns – Audit & Assurance 审计鉴证实习生',
  region:'中国香港',city:'香港',industry:'审计咨询',location:'中国香港·审计鉴证业务',
  startDate:'2027 年春季（确切起始月份尚未公布）',period:'雇主官网说明为 3 个月春季实习',
  deadline:'官网未列固定申请截止日期，开放情况须以企业招聘系统为准',
  description:'RSM 香港官网独立发布的 2027 春季审计与鉴证实习机会。参与控制测试、审计工作底稿、财务报表分析、内部流程和风险评估等实际工作。雇主未在该页面明确是否从 1 月开始，需独立核实是否覆盖寒假。',
  requirements:['具备良好的中英文沟通能力。','熟练使用 Excel 与 Word。','具备分析、解决问题和团队协作能力。','按雇主的在线申请指引提交简历及学业成绩单；具体年级与实习起止时间请在申请时核实。'],
  majorTags:['会计学','审计学','财务管理','金融学','工商管理'],
  tags:['RSM','罗申美','香港','审计','财务','鉴证','2027','春季'],
  sourceUrl:'https://www.rsm.global/hongkong/assurance/en/2027-spring-interns-audit-assurance-services',
  applyUrl:'https://www.rsm.global/hongkong/assurance/en/2027-spring-interns-audit-assurance-services',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'官方发布 2027 春季独立职位；准确开始月份及是否覆盖寒假尚待企业确认',
  workRightsNote:'香港工作地点，申请前请核实合法实习/工作资格及雇主签证政策。'
 },
 {
  id:'rsm-hk-spring-tech-consulting-2027',company:'RSM 罗申美香港',english:'RSM Hong Kong',
  title:'2027 Spring Interns – Technology & Management Consulting 科技管理咨询实习生',
  region:'中国香港',city:'香港',industry:'科技咨询',location:'中国香港·科技与管理咨询',
  startDate:'2027 年春季（确切起始月份尚未公布）',period:'春季实习，官网未列明确周数或起止日',
  deadline:'官网未列固定申请截止日期，具体开放状态需官方复核',
  description:'RSM 香港官网另行发布的 2027 科技与管理咨询实习岗位。协助 IT 尽职调查、网络安全审核、IT 审计、渗透测试及客户系统实施项目，与审计鉴证实习为不同的真实岗位页面。',
  requirements:['计算机科学、信息系统或会计等专业的在读学生。','良好的英文书面与口头表达能力。','具备分析、独立工作和解决问题能力。','按官网申请指南提交简历及学业成绩单；确切到岗日由雇主确认。'],
  majorTags:['计算机科学','信息系统','网络安全','信息安全','会计学','管理科学','软件工程'],
  tags:['RSM','罗申美','香港','IT审计','咨询','网络安全','渗透测试','2027','春季'],
  sourceUrl:'https://www.rsm.global/hongkong/assurance/en/2027-spring-interns-technology-management-consulting-services',
  applyUrl:'https://www.rsm.global/hongkong/assurance/en/2027-spring-interns-technology-management-consulting-services',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'雇主官网有独立科技与管理咨询岗位；月份尚未证实，申请前确认是否涵盖寒假',
  workRightsNote:'香港工作地点，具体工作许可和签证担保政策应向雇主核实。'
 }
];
const safe=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false}};
export function winterJobById(id:string){return WINTER_2027_JOBS.find(job=>job.id===id);}
export function winterJobSafeUrl(job:WinterJob){return safe(job.sourceUrl)&&safe(job.applyUrl)?job.applyUrl:null;}
export function winterJobStatusLabel(job:WinterJob){
 if(job.status==='closed')return '已过申请截止日';
 if(job.status==='deadline-conflict')return '申请日期冲突 · 需核实';
 return '官方具体岗位 · 申请状态待核实';
}
