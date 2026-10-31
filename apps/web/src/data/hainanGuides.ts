import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import {HAINAN_POLICY_RECORDS} from './hainanPolicyRecords.ts';
import {HAINAN_HOUSING_RECORDS} from './hainanHousingRecords.ts';
import type {TalentPolicyRecord} from './talentPolicyRecords';
import type {TalentHousingRecord} from './talentHousingRecords';
export const HAINAN_TALENT_CITIES=['海口','三亚','三沙','儋州'] as const;
export const hainanGuideUrl=(kind:'policy'|'housing',id:string)=>'/talent-service/policy-guide-preview/hainan/'+kind+'/'+encodeURIComponent(id);
const caveat=(city:string)=>city==='三沙'?'2026年省级安居房管理办法第44条要求三沙市与相关市县统筹。尚未核实联合实施细则、承接市县、直达办理入口或可选房源，绝不等于三沙已有现金补贴。':city==='儋州'?'2026年7月5日起施行的儋州修订细则需与2026年12月31日前旧月份补贴追溯期区分；洋浦特殊对象另行核验，住房项目空房未知。':city==='三亚'?'三亚2026年申领攻略是资格和流程指引，历史公示不代表当前获批；区级办理地点与住房租购互斥条件须核对。':'海口官方政务平台是综合入口，需用人单位根据注册地申报；资格、资金和实时住房库存不能推定。';
const steps=(actions:string[]):GuideStep[]=>actions.map((action,i)=>({
 title:['核对政策原文和适用范围','确认个人或家庭资格','准备真实材料','确认实际主管部门及办理入口','递交申请、参加审核或等待联办规则','查看结果、公示与房源状态'][i]||'按主管部门公布流程补充核验',
 why:i<2?'年龄、人才类型、工作地、参保及住房互斥条件会影响最终资格。':i<4?'官方来源与正式受理入口并非同一网址，必须先确定办理归属。':'政府文件存在和申请递交都不等于已获得待遇或房源。',
 action,done:'已逐项对照正式政府文件核查，未把待核验事项说成已获批准'
}));
export function buildHainanGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?HAINAN_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?HAINAN_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const city=(p||h)!.city;
 const materials=p?.materials||['身份、家庭关系及现有政策住房情况证明','用工单位、人才资格和社保/个税等真实记录','承接地区当期官方公布的全部补充材料'];
 const caution=caveat(city);
 const applicability=p?.eligibility||h?.eligibility||'按官方条件确定';
 const program=p?.benefit||h?.rent||'以官方公布为准';
 const branches:Record<string,GuideBranch>={
   eligible:{label:city==='三沙'?'三沙引进人才：待核联合实施细则':'拟申请且可能满足政策条件的人才',desc:p?.targetGroup||h?.district||city,
    conditions:[applicability,'必须核对原文适用的具体城市或承接区县、引进时间及家庭住房限制',caution],materials,warning:caution},
   excluded:{label:'不符合资格／不在适用地区',desc:'不能把海南省不同市县的人才补贴或落户政策互相套用',
    conditions:['核对实际工作和纳税所在地','核对身份年龄学历、社保或家庭住房限制','已享其他住房政策者先确认互斥'],
    materials:['本人身份证及工作地证明','实际社保、住房状况和政策享受记录'],warning:'不符合这一事项不代表海南其他事项也不适用，不能伪造信息申请。'},
   verify:{label:'实际受理和住房项目待核验',desc:'政府制度与当前可申请事项、项目房源、审核通过是不同状态',
    conditions:['核对对应主管部门公告及发布日期','核对当期实际受理主体、申请入口、申领截止日期','三沙须先找到三沙与承接市县联合实施细则','历史住房项目套数不是实时空房'],
    materials:['部门正式通告或说明','申请材料清单、真实办理网址与实际公示记录'],warning:caution}
 };
 const action=p?.applicationSteps||h?.steps||[];
 const source=p?.sourceName||'海南省政府及属地住房部门原始文件';
 const portal=p?.applicationUrl||h?.applyUrl;
 return {
  city,title:(p||h)!.title,kicker:'海南省四城 · '+(h?'住房制度/项目':'人才政策')+' · B级资料',
  desc:p?.summary||h?.statusNote||'政府来源住房保障规则',
  support:p?.headlineAmount||(h?'住房制度 · 非实时房源':'按官方标准核定'),
  unit:p?.headlineUnit||(h?'不能推定空房和实际补贴':'具体资格待审核'),
  limit:city==='三沙'?'跨市县实施细则及承接地待核实':'2026年度资格、事项受理与实际房源需进一步核对',
  review:caution,qualityLevel:'B',
  amounts:[[p?.category||'住房制度',program,'政府正式文件，不代表申请成功'],['适用对象',p?.targetGroup||h?.district||city,'需逐项核对城市和住房身份']],
  branches,defaultBranch:'eligible',steps:steps(action),
  checks:['已查到真实政府原文和实施日期','已明确政策具体适用城市及行政区','已核对人才、学历和社保个税条件','已核对家庭住房及保障互斥',...materials,'已确认具体官方申报事项和当前受理状态','住房公寓及安居房仅根据实际当期公告确认空房'],
  faq:[
   ['这条政策现在能申请吗？',city==='三沙'?'目前仅核实省级跨市县统筹制度，没有三沙与相关市县的受理细则和直达入口，不能当作开放申请。':'政府文件可查不代表当前开放受理，应在官方政务服务平台或主管部门核实。'],
   ['学历符合就能拿到补贴吗？','不能。还需要满足人才类别、用工地区、社保、年龄和家庭住房等条件，经部门审核。'],
   ['海南其他市县的补贴适用于我吗？','不一定，海南不同市县分别有适用范围。三沙的跨市县统筹也不是自动适用海口等地的现金补贴。'],
   ['安居房和人才公寓、租房补贴是一回事吗？','不是。安居房为共有产权购房保障，公寓是实物住宿，租购补贴是货币或房屋支持，应区分。'],
   ['历史公告里的套数能代表当前空房吗？','不能。公告发布日期和当期库存须分开核实，本站没有实时库存数据。'],
   ['申报入口在哪里？',portal?'已提供官方综合服务平台，但要在其中找到对应具体事项并确认申报属地和有效批次。':'未找到核实的事项直达申请入口；应先向文件列明的部门确认。'],
   ['HHBA是否代收资料和保证审批？','不代收个人身份证、社保或银行材料，不保证政策获得审批或房屋配租。']
  ],
  sources:[[source,(p||h)!.sourceUrl]],
  officialUrl:portal,officialLabel:portal?'官方综合办理平台（事项仍须核实）':'当前事项直达入口待核实',
  officialNote:caution,contacts:[],listPath:'/talent-service/list/'+(h?'housing':'policies')+'/'+encodeURIComponent(city),
  detailPath:'/talent-service/'+(h?'housing':'policy')+'/'+encodeURIComponent(id)
 };
}
