import {allGermanyRoutes,deOfficial,deVerifiedOn} from './overseasGermany';
import {pack} from './overseasNzGuidesV2a.ts';
import type {DetailedGuide} from '../components/OverseasDetailedGuide';
const section=(items:{title:string;explain:string;how:string}[])=>items.map(x=>[x.title,x.explain,x.how] as [string,string,string]);
const sourceTitle:Record<string,string>={
 opportunity:'德国政府机会卡官方条件与积分',opportunityFaq:'机会卡生活资金与申请常见问题',
 blue:'德国政府欧盟蓝卡及2026工资门槛',skilled:'德国政府学历/职业教育专业人员工作签证',
 experience:'德国政府实务经验工作签证',recognition:'德国政府职业资格认可合作签证',
 training:'德国政府职业培训及寻找培训名额签证',study:'德国政府大学留学签证与资金要求',
 graduate:'德国官方毕业后求职指南',occupations:'德国政府紧缺职业类别',
 trainings:'德国政府真实职业培训职业介绍',jobs:'德国联邦就业局支持的岗位查询',
 recognitionGuide:'外国学历和受监管职业官方认可方法',zab:'ZAB大学学位比较证明',
 anabin:'德国anabin大学和学位数据库',visa:'德国外交部正式签证申报门户',
 costs:'德国政府2026年签证资金门槛对照'
};
export const deCompleteGuides:Record<string,DetailedGuide>=Object.fromEntries(allGermanyRoutes.map(r=>{
 const sections:[string,[string,string,string][]][]=[
  ['这条德国路线是什么、适合谁；先区分法律上不同的签证与在留资格，不用模糊的“德国工作签”代替真实申请类别。',section([
   {title:'这条路线具体适合谁',explain:r.audience,how:'先用自己的真实学历、工作合同、语言和目标地区与本页适用人群做对照；不要因为有中介报价就认为已经符合。'},
   {title:'一句话说明制度',explain:r.summary,how:'记下本路线的德国或英文正式签证名称，再点击文末对应德国政府的原始政策核对。'},
   {title:'先排除最常见的误解',explain:r.risks[0],how:'列一张三栏清单：目前符合、需要补证明、不适用；任何一项不清楚都不要先付大额费用。'}
  ])],
  ['申请资格不是一句“符合要求”。年龄、学历、德语、年薪、正规职业或资金门槛都要按本路线核对。',section(r.core)],
  ['明确哪些材料可以证明学历、语言、工作经验、雇主、收入和保险，以及从哪里获取。',section(r.materials)],
  ['把具体官方办理步骤和每一步应当产出的证明分开说明，找工作与获签绝不能等同。',section(r.process)],
  ['将税前年薪、冻结账户资金、学费、语言考试、学历认证和德国落地生活费明确分开。',section(r.finance)],
  ['签证办理、学位认可、雇主合同和居留身份各有不同时间表，不可承诺统一审批速度。',section(r.calendar)],
  ['获得签证后可以做什么，兼职或全职有什么限制，能否带家人，以及雇主变更的合法边界。',section(r.rights)],
  ['找工作、身份转换、培训毕业和德国定居许可都是独立程序，不可宣传一张签证自动通向永住。',section(r.future)]
 ];
 if(sections.length!==8||sections.some(s=>s[1].length<3))throw Error('Incomplete German chapter content: '+r.id);
 const faq=r.faq.map(x=>[x.question,x.answer] as [string,string]);
 const sources=r.sources.map(key=>[sourceTitle[key]||key,deOfficial[key],key==='visa'?'按申请居住地与国籍查看具体签证材料和收费':'联邦政府权威条件、证据与实操入口'] as [string,string,string]);
 return [r.id,pack(r.id,'一句话：'+r.summary,'建议先确认：'+r.core[0].how,sections,faq,[...r.risks,'资料核验日期：'+deVerifiedOn+'。政府政策、工资门槛、居留经费和德国各州职业许可可能调整，正式申请前必须核对当期官方原文。'],r.terms,sources)];
}));
