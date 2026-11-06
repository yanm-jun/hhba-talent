import type {DetailedGuide,GuidePoint,GuideSection,GuideFAQ,GuideSource} from '../components/OverseasDetailedGuide';
import {ukRoutes,ukOfficial,ukVerifiedOn,type UkLine} from './overseasUK';
/** 15 genuine routes; 8 substantive chapters each, with separate factual checks and action tasks.
 * Every link is the public GOV.UK original, not a commercial immigration intermediary.
 */
const chapterTitles=[
 '先理解英国的真实法律路线与适用人群',
 '资格、职业、语言与资金：逐条自检',
 '申请资料：要交什么、如何取得',
 '从零开始：实际申请步骤',
 '官方费用、资金证明与真实开支',
 '时间节点、窗口、处理与过渡规则',
 '获批后工作、家属与居留限制',
 '后续续签、转签、退出和长期规划'
] as const;
const sourceLabels:Record<keyof typeof ukOfficial,string>={
 skilled:'Skilled Worker 政府签证入口',salary:'Skilled Worker 职业与工资',english:'Skilled Worker 英语B2与过渡规定',
 rates:'Appendix Skilled Occupations 官方SOC工资表',sponsors:'UKVI最新持牌担保企业名册',occupation:'Skilled Worker 适用职业清单',
 skilledFees:'Skilled Worker 签证费与维持资金',care:'Health and Care Worker 官方条件',careJobs:'医疗岗位与职业工资',
 careFees:'Health and Care Worker 签证费',careClosed:'2025年7月22日起海外护理员招聘限制',
 student:'Student 学生签证官方入口',money:'Student 2026学费与生活资金',dependants:'学生家属申请资格',
 studentEnglish:'学生英语资格证明',graduate:'Graduate 毕业生签证条件',graduateFees:'Graduate 签证费及IHS',
 global:'Global Talent 国际人才签证',globalArts:'艺术文化Global Talent分轨',globalDigital:'数字科技Global Talent资格',
 hpi:'HPI 高潜力人才签证',hpiList:'按学位授予年度的HPI大学名单',hpiEligibility:'HPI 毕业与Ecctis资格',hpiFees:'HPI 申请费及资金',
 scale:'Scale-up Worker签证',scaleSalary:'Scale-up 工资和职位要求',scaleExtend:'Scale-up续签PAYE收入核验',
 founder:'Innovator Founder创新创业者签证',founderBody:'官方授权背书机构名单',founderSettlement:'创业者ILR与业绩要求',
 seasonal:'Seasonal Worker官方条件',seasonalRules:'Seasonal Worker移民规则正文',creative:'Creative Worker官方签证',
 creativeEligible:'Creative Worker资格及报酬',creativeConcession:'短期演艺免提前签证例外',
 exchange:'Government Authorised Exchange官方说明',schemes:'官方允许的交流项目清单',senior:'Senior or Specialist Worker调派',
 graduateTrainee:'跨国集团Graduate Trainee官方签证',graduateTraineeEligibility:'Graduate Trainee工资与境外3个月任职',
 family:'Family签证伴侣申请资格',familyMoney:'伴侣签证£29,000及特殊条件',
 youth:'Youth Mobility英国打工度假概览',youthCountries:'2026英国青年流动国籍名单',
 fees:'英国内政部2026年10月签证收费',ihs:'Immigration Health Surcharge真实年费',
 tb:'2026中国TB指定检测诊所'
};
const P=(label:string,explain:string,action:string):GuidePoint=>({label,explain,action});
const S=(title:string,summary:string,points:GuidePoint[]):GuideSection=>({title,summary,points});
function points(rows:UkLine[]):GuidePoint[]{return rows.map(([label,explain,action])=>P(label,explain,action));}
function createGuide(r:(typeof ukRoutes)[number]):DetailedGuide{
 const chapters:GuideSection[]=[
 S(chapterTitles[0],r.summary,[
   P('这条路线究竟允许什么',r.summary,'先保存本方案的英文签证全称，再从英国政府原文核实适用类别及办理地点。'),
   P('哪些人值得进一步核查',r.audience,'把实际学历、身份、工作offer、语言、签证历史和赴英目标写成个人资格核验表。'),
   P('最常见的法律误区',r.risks[0]||'没有任何签证可以由私下中介保证获批。','发现中介宣传与官方文件不一致时暂停付款，并核对政府最新公告。')
 ]),
 S(chapterTitles[1],'每个门槛都要分别满足，某一项合格不代表本人一定可以获签。',points(r.requirements)),
 S(chapterTitles[2],'必须是能独立核验来源的文件；学位、工作、语言、资金、CoS或CAS均不能凭空编造。',points(r.documents)),
 S(chapterTitles[3],'先查合法资格，准备证据，拿到真实赞助/录取/背书，再在适当地点与日期递交。',points(r.steps)),
 S(chapterTitles[4],'官方申请费、IHS、可动用的资金证明、语言考试、学费、房租及雇主成本应分开列示。',points(r.costs)),
 S(chapterTitles[5],'区分资格准备、可以递交的时间窗口、政府审理与落地准备；不要推断保证出签时间。',points(r.time)),
 S(chapterTitles[6],'核对准确的英国eVisa许可条款，特别是雇主变更、兼职、自雇、家属、领取福利及定居限制。',points(r.rights)),
 S(chapterTitles[7],'不自动转签或拿永居；下一个阶段应按照届时适用的移民规则重新申请。',points(r.next))
 ];
 if(chapters.length!==8||chapters.some(s=>s.points.length<3))throw new Error('UK guide missing points: '+r.id);
 const faq:GuideFAQ[]=[
 ...r.faq.map(([question,answer])=>({question,answer})),
 {question:'英国持牌雇主、学校或背书机构可以保证签证获批吗？',answer:'不能。只要涉及担保、学校、背书或其他资格，都要满足个人签证条件、官方核验及移民局独立审批；“包签”“买名额”不能当作合法保证。'},
 {question:'HHBA显示的金额和2026资格可以直接拿去申请吗？',answer:'本页为截至2026年11月6日公开的英国政府信息研究整理。实际申请费、担保名单、职业工资、开放状态与签证规则可能改变；递交前要打开页面列出的最新GOV.UK官方原文重新逐条核对。'}
 ];
 const sources:GuideSource[]=r.sourceKeys.map(key=>({
  label:sourceLabels[key],
  url:ukOfficial[key],
  purpose:'核实该类别目前生效的英国政府原始资格、文件、收费、时间和状态；以申请当天原文为准'
 }));
 return {id:r.id,
 plainAnswer:'一句话：'+r.summary,
 firstAction:'先做这件事：'+r.requirements[0][2],
 checkedAt:ukVerifiedOn,
 sections:chapters,faq,
 risks:[...r.risks,'2026-11-06官方资料核验；2026年11月以后职业、工资、政府费、合法入境与定居政策可能更新。本站不是签证代理机构，不承诺任何申请结果。'],
 terms:['UKVI','CoS','CAS','IHS','SOC 2020','going rate','SELT','B2','eVisa','endorsement','ILR'],
 sources
 };
}
export const ukCompleteGuides:Record<string,DetailedGuide>=Object.fromEntries(ukRoutes.map(r=>[r.id,createGuide(r)]));
