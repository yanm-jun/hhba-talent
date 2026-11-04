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
 }
];
export function winterProgramById(id:string){return WINTER_2027_PROGRAMS.find(p=>p.id===id);}
