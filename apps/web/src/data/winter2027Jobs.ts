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
