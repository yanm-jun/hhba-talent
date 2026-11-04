/**
 * 2027 winter job postings: strictly one row per employer-issued vacancy or
 * official job requisition. Business functions within one placement posting
 * MUST NOT be split into fake independent vacancies.
 * The programme-only catalogue lives in winter2027Programs.ts.
 * Posted ≠ currently accepting applications. Review before every production release.
 */
export type WinterJobStatus='verify-apply'|'deadline-conflict'|'year-conflict'|'closed';
export type WinterJob={
 id:string;company:string;english:string;title:string;
 region:string;city:string;industry:string;location:string;
 startDate:string;period:string;deadline:string;
 description:string;requirements:string[];majorTags:string[];tags:string[];
 sourceUrl:string;applyUrl:string;checkedOn:string;status:WinterJobStatus;
 statusNote:string;workRightsNote?:string;salaryNote?:string;
 evidenceUrl?:string;reviewWarning?:string;
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
 },
 {
  id:'richemont-hk-talent-acquisition-jr134347',company:'历峰集团 Richemont',english:'Richemont',
  title:'Talent Acquisition Intern 人才招聘实习生（2026.12—2027.05）',
  region:'中国香港',city:'香港',industry:'人力资源',location:'中国香港·全职实习',
  startDate:'2026 年 12 月',period:'2026 年 12 月至 2027 年 5 月（约六个月）',
  deadline:'官网有 Apply Now 入口，未列公开统一申请截止日；名额与按钮状态以雇主官网实时显示为准',
  description:'历峰集团官方招聘职位 JR134347，协助校园招聘活动、面试安排、零售精品店招聘支持以及集团实习计划协调。属于单一人力资源职位，不按品牌或门店拆成多个岗位。',
  requirements:['人力资源管理、酒店管理、心理学或相关领域本科背景。','具备 Word、Excel、PowerPoint、Outlook 办公应用能力。','英语、中文书面和口语沟通良好，有团队协作和组织协调能力。','能从 2026 年 12 月至 2027 年 5 月全职到岗；奢侈品零售、酒店业相关实习经历优先。'],
  majorTags:['人力资源管理','心理学','酒店管理','工商管理','英语','市场营销'],
  tags:['历峰','Richemont','人力','招聘','Luxury','零售','香港','冬季','实习','2027'],
  sourceUrl:'https://careers.richemont.com/en/jobs/jr134347/talent-acquisition-intern-6-months-dec-2026-may-2027/',
  applyUrl:'https://careers.richemont.com/en/jobs/jr134347/talent-acquisition-intern-6-months-dec-2026-may-2027/',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'历峰集团雇主官网存在独立编号 JR134347 的具体实习岗位，当前是否仍可申请以官网为准',
  workRightsNote:'工作地点为香港，雇主页面没有明确此岗位签证担保安排，申请前需核实合法工作资格。'
 },
 {
  id:'tianzh-international-haikou-audit-j10722',company:'天职国际',english:'Baker Tilly China · Tianzhi',
  title:'财务审计实习生 · 海口（J10722）',
  region:'中国内地',city:'海口',industry:'审计咨询',location:'海南省海口市',
  startDate:'2026 年 12 月初（根据 2026-10-30 官网招聘公告推定；请向雇主确认）',
  period:'雇主职位说明为 12 月初至次年 3 月 31 日，每周至少 4 天、尽量完整参与一项审计项目',
  deadline:'企业官方招聘列表 2026-10-30 发布，未公布统一截止日期；按岗位编号 J10722 查找',
  description:'天职国际官方实习生招聘板块独立岗位 J10722。协助项目经理及组长完成年报审计、经济责任审计、清产核资及相关底稿工作。原公告写“12月初—3月31日”，未逐项注明两端年份，HHBA 不假定年限已最终确认。',
  requirements:['在校本科大三或以上学生；会计、审计、财务、金融等相关专业可核对申请条件。','具备责任心、沟通协调能力、团队协作能力及基本办公软件使用技能。','每周至少可到岗 4 天、可参与一个完整审计项目者优先。'],
  majorTags:['会计学','审计学','财务管理','金融学','税收学'],
  tags:['天职国际','海口','海南','审计','财务','J10722','实习','寒假','2027'],
  sourceUrl:'https://tzcpa.zhiye.com/intern/jobs',applyUrl:'https://tzcpa.zhiye.com/intern/jobs',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'雇主官方列表中的独立职位编号 J10722；请在企业官网按编号查找后确认 2026—2027 年实习期与可投递状态',
  reviewWarning:'官方岗位写明“12月初—3月31日”但未标注起止年份。根据2026年10月发布日推测覆盖2027年寒假，申请前务必向雇主确认。'
 },
 {
  id:'tianzh-international-xian-workcenter-j11175',company:'天职国际',english:'Baker Tilly China · Tianzhi',
  title:'作业中心审计实习生 · 西安（J11175）',
  region:'中国内地',city:'西安',industry:'审计咨询',location:'陕西省西安市·数字化审计作业中心',
  startDate:'第三方雇主招聘记录标示 2027 年 1 月；企业官网未明示入职月份',
  period:'第三方招聘记录显示 2027 年 1—4 月；官网岗位 J11175 要求至少 50 个工作日',
  deadline:'雇主官网 2026-10-30 发布独立职位 J11175，未见统一截止日',
  description:'天职国际官方职位 J11175“作业中心实习生-西安”，协助审计底稿与报告编制、企业财务报表及现金流量表处理、数字化审计工具操作。第三方平台另一条同类企业职位显示 1—4 月入职批次，具体是否对应 J11175 由雇主确认。',
  requirements:['本科大二及以上在校学生。','具有较强的敬业精神、团队协作、沟通协调及分析能力。','熟练使用计算机、Excel等常用办公软件。','可保证至少 50 个工作日实习，具体时段和录用要求请按职位编号 J11175 向雇主核实。'],
  majorTags:['会计学','审计学','财务管理','信息管理与信息系统','数据科学','计算机科学'],
  tags:['天职国际','西安','AI审计','函证','数字化','J11175','实习','寒假','2027'],
  sourceUrl:'https://tzcpa.zhiye.com/intern/jobs',applyUrl:'https://tzcpa.zhiye.com/intern/jobs',
  evidenceUrl:'https://www.shixiseng.com/intern/inn_vlr3ihsifqkc?pcm=pc_SearchList',
  checkedOn:'2026-11-04',status:'verify-apply',
  statusNote:'雇主官方岗位 J11175 确有该职位；第三方招聘时间未与官网职位 ID 严格绑定，具体冬季批次待企业确认',
  reviewWarning:'第三方平台发布的“2027年1—4月”岗位与官网 J11175 业务内容相似，但未证明为同一招聘编号。此岗位不保证属于该批次或仍可申请。'
 },
 {
  id:'crowe-hk-spring-audit-2027-review',company:'国富浩华香港 Crowe',english:'Crowe (HK) CPA Limited',
  title:'Spring Audit Intern 春季审计实习生（年度版本待核验）',
  region:'中国香港',city:'香港',industry:'审计咨询',location:'中国香港·审计部门',
  startDate:'官网近期检索显示 2027 年 1 月；旧版页面缓存仍显示 2026 年 1 月',
  period:'近期官网检索记录显示 2027 年 1—3 月；与旧版缓存年份不一致',
  deadline:'雇主官网未公开统一截止日，招聘年度与在招状态须直接联系雇主确认',
  description:'国富浩华香港雇主官网 Spring Internship 页面提供单一审计部门实习职位及邮件投递指引。2026年11月的近期搜索索引显示 Spring Internship 2027，但旧的网页提取缓存仍记录 Spring Internship 2026；因此 HHBA 将该职位标注年度待核验，不作为确定 2027 年度可投递机会。',
  requirements:['会计或商科相关专业全日制在读大学生。','英语和中文（广东话及普通话）沟通良好。','愿意参与不同类型企业及机构的审计与鉴证工作。','投递前必须在雇主官网或通过其人力资源联系方式核实2027年度批次是否实际开放。'],
  majorTags:['会计学','审计学','财务管理','金融学','工商管理'],
  tags:['Crowe','国富浩华','香港','审计','Spring Internship','2027','版本待核实'],
  sourceUrl:'https://www.crowe.com/hk/careers/internship',
  applyUrl:'https://www.crowe.com/hk/careers/internship',
  checkedOn:'2026-11-04',status:'year-conflict',
  statusNote:'同一官网网址存在“2027近期检索”与“2026旧缓存”两版年份信息；不保证2027实习已开放',
  reviewWarning:'官方网页存在年度版本冲突：近期检索结果显示2027年1—3月，另有旧缓存显示2026年1—3月。请先核对企业官网当前正文并联系招聘方，不要直接把此条视为已开放的2027岗位。',
  workRightsNote:'中国香港实习岗位；如需在港工作许可，请提前与雇主确认资格及安排。'
 }
];
const safe=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false}};
export function winterJobById(id:string){return WINTER_2027_JOBS.find(job=>job.id===id);}
export function winterJobSafeUrl(job:WinterJob){return safe(job.sourceUrl)&&safe(job.applyUrl)?job.applyUrl:null;}
export function winterJobStatusLabel(job:WinterJob){
 if(job.status==='closed')return '已过申请截止日';
 if(job.status==='year-conflict')return '招聘年度存在冲突 · 待复核';
 if(job.status==='deadline-conflict')return '申请日期冲突 · 需核实';
 return '官方具体岗位 · 申请状态待核实';
}
