/**
 * Reviewed official programmes, not invented "2027 winter jobs" or guaranteed openings.
 * Programme-level records link to first-party employers. Update independently of UI.
 */
export type WinterProgram={
 id:string;company:string;english:string;title:string;kind:'专项计划'|'具体岗位';
 region:string;location:string;category:'审计咨询'|'金融'|'传播公关';
 intro:string;requirements:string[];period:string;deadline:string;
 sourceUrl:string;applicationUrl:string;checkedOn:string;statusNote:string;
 tags:string[];featured?:boolean;
 evidenceUrl?:string; /** Secondary public evidence when official portal omits dates. */
 workRightsNote?:string; /** Eligibility notes especially for cross-border postings. */
 verificationLevel?:'official-program'|'official-posting'|'date-conflict'|'historical-only';
};
export const WINTER_2027_PROGRAMS:ReadonlyArray<WinterProgram>=[
 {
  id:'kpmg-2027-winter',company:'毕马威中国',english:'KPMG China',
  title:'2026—2027 寒假实习项目',kind:'专项计划',region:'中国内地',location:'内地多城市（以官方职位列表为准）',category:'审计咨询',
  intro:'毕马威官方实习项目页明确列有 2026—2027 寒假实习，覆盖审计、税务、咨询等不同业务板块；须进入岗位列表选择实际开放的城市和职位。',
  requirements:['官方项目面向本科或硕士在读学生。','专业、所在城市、实习起止时间及到岗要求以具体职位公告为准。'],
  period:'官方所列实习期范围：2026 年 10 月至 2027 年 5 月',
  deadline:'未见统一截止日；以职位页为准',
  sourceUrl:'https://kpmg.com/cn/zh/careers/campus/basecamp.html',
  applicationUrl:'https://app.mokahr.com/campus-recruitment/kpmg/74356',
  checkedOn:'2026-11-04',statusNote:'官方已发布寒假项目；各职位投递状态需实时核实',
  tags:['审计','财务','税务','咨询','商科','法律','数据'],featured:true
 },
 {
  id:'deloitte-winter',company:'德勤中国',english:'Deloitte China',
  title:'Winter Internship 冬季实习项目',kind:'专项计划',region:'中国内地',location:'具体办公城市以官方招聘页面为准',category:'审计咨询',
  intro:'德勤中国实习项目官网明确介绍冬季实习机会，覆盖审计、税务和咨询等业务方向，通常为 2—4 个月的项目制体验。',
  requirements:['官方介绍针对大学高年级在读学生（例如四年制本科三年级及以上）及符合条件的研究生。','实际岗位是否开放、专业资格、项目周期和地点应从官方投递页再次确认。'],
  period:'官方项目介绍：冬季或夏季约 2—4 个月',
  deadline:'按实际招聘职位决定，官网没有统一截止日',
  sourceUrl:'https://www.deloitte.com/cn/en/careers/explore-your-fit/students/internship-program.html',
  applicationUrl:'https://www.deloitte.com/cn/en/careers/explore-your-fit/students/internship-program.html',
  checkedOn:'2026-11-04',statusNote:'官方冬季实习项目入口；不是当前职位数量承诺',
  tags:['审计','会计','财务','咨询','税务','商业分析'],featured:true
 },
 {
  id:'jpm-2027-seasonal',company:'摩根大通',english:'JPMorganChase',
  title:'2027 China Seasonal Internship Program',kind:'专项计划',region:'中国内地',location:'上海等（以官方在招城市为准）',category:'金融',
  intro:'官方季节性实习项目介绍资产管理、公司银行、支付、研究分析、运营等轮岗机会，官网在其职位区域展示具体岗位及实际开放城市。',
  requirements:['对金融服务有浓厚兴趣并具备沟通、分析及解决问题能力。','官方介绍希望实习生在学期中每周至少工作三天；具体岗位的资格和周期应逐条确认。'],
  period:'2027 年季节性实习；具体入职和结束日期以岗位为准',
  deadline:'官网职位信息曾标注 2026-12-31；投递前务必重新核对',
  sourceUrl:'https://www.jpmorganchase.com/careers/explore-opportunities/programs/china-apprenticeship',
  applicationUrl:'https://www.jpmorganchase.com/careers/explore-opportunities/programs/china-apprenticeship',
  checkedOn:'2026-11-04',statusNote:'官方季节性项目；个别岗位可能提前关闭',
  tags:['金融','投资','资产管理','银行','支付','运营','分析','上海'],featured:true
 },
 {
  id:'apco-shanghai-2027-winter',company:'APCO Worldwide',english:'APCO Worldwide',
  title:'上海政府事务与战略传播实习生（冬季开始）',kind:'具体岗位',region:'中国内地',location:'上海（混合办公）',category:'传播公关',
  intro:'雇主官方招聘系统公布的冬季起始实习岗位，参与政府事务、传播、行业研究、材料制作等工作。',
  requirements:['中文需达到母语水平（官方标题明确要求）。','每周至少 3 个完整工作日，至少实习 3 个月。','实际申请资格和招聘状态以官方招聘系统为准。'],
  period:'预计 2027 年 1 月或 2 月开始；至少 3 个月',
  deadline:'岗位页未提供统一截止日',
  sourceUrl:'https://fa-evxv-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/1787',
  applicationUrl:'https://fa-evxv-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/1787',
  checkedOn:'2026-11-04',statusNote:'曾标为有薪岗位；金额和当前可投递状态以官网为准',
  tags:['上海','传播','媒体','公共事务','品牌','研究','写作','公关']
 },
 {
  id:'ey-china-winter-2027-review',company:'安永中国',english:'EY China',
  title:'安永中国 Winter Internship Program 冬季实习',kind:'专项计划',region:'中国内地',location:'具体办公室及职位须从安永中国校招官网选择',category:'审计咨询',
  intro:'安永中国官方校园招聘页面明确设有冬季实习项目，为在读学生提供真实客户项目、业务实践及专业培训机会。官网尚未公布统一的 2026—2027 冬季实习起止日期，不能将该项目视为已经确认开放的 2027 岗位。',
  requirements:['官网对冬季实习列明：全日制大学三年级在读生或符合条件的第一年毕业生。','愿意在专业服务领域发展，具备解决问题、团队合作与组织能力。','具体城市、岗位、申请资格以及签约要求以安永官方招聘系统为准。'],
  period:'冬季项目；2026—2027 具体实习日期尚待官方岗位确认',
  deadline:'未查得 2026—2027 批次官方统一申请截止日期',
  sourceUrl:'https://www.ey.com/en_cn/careers/student-programs-in-chinese-mainland',
  applicationUrl:'https://www.ey.com/en_cn/careers/student-programs-in-chinese-mainland',
  checkedOn:'2026-11-04',statusNote:'官方长期设有冬季实习项目，但本批次是否在招尚未确认',
  verificationLevel:'official-program',
  tags:['安永','EY','审计','鉴证','税务','咨询','财务','商科','大三','冬季']
 },
 {
  id:'pwc-hk-2027-winter',company:'普华永道香港',english:'PwC Hong Kong',
  title:'2027 香港冬季实习｜咨询、数字鉴证与交易服务',kind:'专项计划',region:'中国香港',location:'香港特别行政区（部分方向为全职到岗）',category:'审计咨询',
  intro:'普华永道官方校园招聘页确认每年有冬季实习批次；香港中文大学招聘平台发布了面向 2027 年 1—6 月的咨询、数据与人工智能、数字鉴证及交易服务等冬季实习职位。不同业务线条件各异，项目期与具体投递状态需要再核对。',
  requirements:['相关岗位为香港办公室冬季实习，不应与中国内地岗位混同。','大学平台对多项职位标记为 2027 年 1—6 月、约六个月全职；以申请页面实际要求为准。','官网校园实习计划提及欢迎 2028 届及之后的本科及以上申请者，但不同职位可能有额外条件。','申请香港职位前核对在港工作资格、实习时长、专业和岗位对应条件。'],
  period:'部分具体岗位：2027 年 1 月至 6 月（约六个月）',
  deadline:'大学招聘平台显示的部分截止日期晚于项目起始月；请以企业招聘入口实时状态为准',
  sourceUrl:'https://www.pwccn.com/en/careers/students.html',
  evidenceUrl:'https://pip.erg.cuhk.edu.hk/app.php/guest/jobs/posted',
  applicationUrl:'https://www.pwccn.com/en/careers/students.html',
  checkedOn:'2026-11-04',statusNote:'官方存在冬季批次；2027 年香港岗位有高校发布记录，逐岗位申请状态待核实',
  verificationLevel:'official-program',
  tags:['普华永道','PwC','香港','咨询','数据','人工智能','AI','科技风险','审计','数字鉴证','交易咨询','2027','金融']
 },
 {
  id:'hsbc-hk-2027-work-placement',company:'汇丰银行',english:'HSBC',
  title:'2027 香港 Student Work Placement 学生工作实习',kind:'具体岗位',region:'中国香港',location:'香港岛中环，香港',category:'金融',
  intro:'汇丰官方招聘系统公布的香港全职学生工作实习项目，业务涉及商业银行、数据分析、数字银行、客户服务、风险合规、市场研究等，计划自 2027 年 1 月 5 日持续至 6 月 30 日。注意：同一岗位官方访问入口显示两种不同截止日期，需以实际申请按钮的最新状态为准。',
  requirements:['面向大学在读本科生，官网表示允许多专业背景申请。','需在 2027 年 1 月 5 日至 6 月 30 日全职到岗。','必须具备覆盖整个实习期间及项目结束后的香港合法工作资格；该项目不提供签证担保。','企业说明每轮仅接受一次申请，且职位可能因申请量提前截止。'],
  period:'2027 年 1 月 5 日—6 月 30 日，六个月全职',
  deadline:'官方同一职位在不同访问入口出现 2026-10-30 与 2026-11-20 两种截止日期；不保证仍可投递',
  sourceUrl:'https://apply.careers.hsbc.com/emergingtalent/job/Central-HSBC-Student-Work-Placement-Hong/1367003857/',
  evidenceUrl:'https://apply.careers.hsbc.com/emergingtalent/job/Central-HSBC-Student-Work-Placement-Hong/1367003857/?feedId=434057',
  applicationUrl:'https://apply.careers.hsbc.com/emergingtalent/job/Central-HSBC-Student-Work-Placement-Hong/1367003857/',
  checkedOn:'2026-11-04',statusNote:'官方岗位已发布；截止日期存在版本冲突，投递前须重新核实',
  workRightsNote:'需要现有合法香港工作资格，汇丰明确不提供此岗位签证担保。',
  verificationLevel:'date-conflict',
  tags:['汇丰','HSBC','香港','银行','数字银行','金融','数据','商业分析','风险合规','法律','市场营销','2027']
 },
 {
  id:"cmb-guangzhou-2027-winter-internship-review",
  company:"招商银行广州分行",
  english:"China Merchants Bank Guangzhou Branch",
  title:"2027 寒假实习核验资料（目前仅查到往期项目）",
  kind:"专项计划",
  region:"中国内地",
  location:"广州及分行覆盖地区，若有新批次以正式公告为准",
  category:"金融",
  intro:"截至2026年11月4日，已找到招商银行广州分行2026寒假「梦工场」实习历史公告（2025年12月发布），岗位方向包括职能、数字金融和市场营销；还找到了2026年暑期面向2027届的实习公告。近期2027届「冬季校园招聘」是毕业生校招，不能等同于2027寒假实习。没有取得2027寒假实习独立岗位或官方现行报名批次。",
  requirements:["目前没有经过核实的2027寒假实习申请资格或开始时间；不得引用往期学历限制当作新批次要求。","2026年冬季历史项目存在职能、数字金融、营销三个业务方向，但不构成2027年三个已发布岗位。","如有新项目，须进入招商银行官方招聘平台的校园招聘→实习生招聘筛选广州分行，并再次核对时间和职位。","不要把2026年五月的2027届暑期实习和2026年十一月的2027届冬季毕业生招聘混入寒假岗位列表。"],
  period:"2027 年寒假尚无可信确认；往期2026寒假信息仅作历史参考",
  deadline:"2027寒假未公布；旧版2026暑期实习截止2026年5月31日，已不适用",
  sourceUrl:"https://career.cmbchina.com/",
  applicationUrl:"https://career.cmbchina.com/",
  evidenceUrl:"https://offers.51mee.com/offer-detail/NI8TU9E1.html",
  checkedOn:"2026-11-04",
  statusNote:"已处理候选企业，但没有核实2027寒假实习具体岗位；先置于项目资料区，不计入具体岗位、不承诺仍在招聘",
  verificationLevel:"historical-only",
  tags:["招商银行","广州分行","2026寒假旧项目","2027待核验","银行","数字金融","市场营销","历史项目"]
 }
];
export function winterProgramById(id:string){return WINTER_2027_PROGRAMS.find(p=>p.id===id);}
