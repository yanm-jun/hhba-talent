import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import {SICHUAN_POLICY_RECORDS} from './sichuanPolicyRecords.ts';
import {SICHUAN_HOUSING_RECORDS} from './sichuanHousingRecords.ts';
import {LESHAN_POLICY_RECORDS} from './leshanPolicyRecords.ts';
import {LESHAN_HOUSING_RECORDS} from './leshanHousingRecords.ts';
import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
import type {TalentHousingRecord} from './talentHousingRecords.ts';
export const SICHUAN_21_REGIONS=['成都','自贡','攀枝花','泸州','德阳','绵阳','广元','遂宁','内江','乐山','南充','眉山','宜宾','广安','达州','雅安','巴中','资阳','阿坝','甘孜','凉山'] as const;
export const SICHUAN_VERIFIED_POLICIES=[...SICHUAN_POLICY_RECORDS,...LESHAN_POLICY_RECORDS];
export const SICHUAN_VERIFIED_HOUSING=[...SICHUAN_HOUSING_RECORDS,...LESHAN_HOUSING_RECORDS];
export function sichuanGuideUrl(kind:'policy'|'housing',id:string):string{
 return '/talent-service/policy-guide-preview/sichuan/'+kind+'/'+encodeURIComponent(id);
}
function steps(actions:string[]):GuideStep[]{
 return actions.map((action,i)=>({
   title:['查验来源和适用范围','选择人才和住房资格分支','备齐真实证明材料','核对本期政府办理入口','提交并接受资格审核','确认公示和待遇/房源'][i]||'完成主管部门补充要求',
   why:i<2?'人才类别、工作城市、所在区县、单位性质不同会决定是否适用。':i<4?'政府政策原文、受理网址和真实项目公告不是同一回事。':'只有受理机关审核和正式项目公告能确定可申领和房源情况。',
   action,done:'已按政府原文核对；未核实的申请状态保持待核状态'
 }));
}
export function buildSichuanGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?SICHUAN_VERIFIED_POLICIES.find(x=>x.id===id):undefined;
 const h=kind==='housing'?SICHUAN_VERIFIED_HOUSING.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const item=p||h!;
 const housing=Boolean(h);
 const materials=p?.materials?.length?p.materials:['本人身份证明和家庭成员住房情况','人才认定或学历职称与劳动合同、社保个税记录','政府主管部门真实办件材料及现行项目公告'];
 const limitation=p?.reviewNote||h?.statusNote||'本条仅为政府基础政策，不保证审批结果及实时空房。';
 const expired=Boolean(p?.deadline&&p.deadline<'2026-10-31')||p?.temporal==='past-window'||p?.temporal==='historical';
 const branches:Record<string,GuideBranch>={
  eligible:{label:'可能符合资格的申请人',desc:p?.targetGroup||h?.district||item.city,
    conditions:[p?.eligibility||h?.eligibility||'须核实官方条件','须核实实际就职属地和住房家庭身份','如果政策为特定用人单位或历史项目，不可将其扩大至全市所有人'],
    materials,warning:limitation},
  other:{label:'不在指定区县或不符合人才类别',desc:'不适用该政策时应另查当地其他项目，不能按不同城市的最高待遇推算。',
    conditions:['单位注册地、实际工作地应符合当事政策','学历职称、人才分类、社保和引进时间要一致','本人与家庭住房及原补贴享受不得违反互斥条件'],
    materials:['工作地点和单位证明','身份、学历、职称及社保税务证明'],warning:limitation},
  verify:{label:'尚未核验受理入口或实际房源',desc:'政策存在不代表当期已经开放申请、可配租或可兑现金额。',
    conditions:['政府原文和最新修订是否仍有效','是否有具体事项办理窗口、当期材料清单和截止时间','住房是否有具体项目名称、地址、配租公告及真实可选房源'],
    materials:['主管部门现行正式公告','实际项目和配租/发放名单（若有）'],warning:limitation}
 };
 const applied=p?.applicationSteps||h?.steps||[];
 return {city:item.city,title:item.title,kicker:'四川省 · '+item.city+' · '+(housing?'独立住房制度':'人才政策')+' · B级来源记录',
   desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||'住房保障办法·具体资格审核',unit:p?.headlineUnit||'非实时空房',
   limit:expired?'批次已结束或已过期，不作为现时开放依据':'受理窗口及申请人资格以政府实际审核为准',
   review:limitation,qualityLevel:expired?'C':'B',
   amounts:[[p?.category||h?.housingCategory||'住房支持',p?.benefit||h?.rent||'按政策规定','不代表个人自动获补'],['适用地区',p?.district||h?.district||item.city,'区县及岗位条件不得跨地区套用']],
   branches,defaultBranch:'eligible',steps:steps(applied),
   checks:['已确认正式政策来源及生效/截止日期','已确认具体城市和县区的适用范围','已核对本人专业、人才身份和实际用工关系','已核对社保个税或家庭住房要求',...materials,'已核对当期具体受理窗口、材料和审核程序','住房项目若无当期公告则不推断可租房间'],
   faq:[
    ['这条政策是2026年正在申报的吗？',expired?'这是归档或已截止资料，不能直接申请，应等下一年度公告。':'文件存在不代表有开放的具体申报窗口，必须以当期办事平台或主管部门通知为准。'],
    ['在四川省工作就一定能领吗？','不能。部分政策只针对指定单位、重点产业、某县区或特定人才类别。'],
    ['政府文件中的最高资助是不是人人可领？','不是。资金依申报类别、岗位、服务期和正式审核核定。'],
    ['租购补贴和人才公寓一样吗？','不一样。现金/贷款/配售房屋/公寓实物必须区分，不能把贷款额度当现金补贴。'],
    ['政府提到筹集数就代表现在有房吗？','不代表。住房建设计划、管理办法及历史项目规模均不能推出当前可供申请房源。'],
    ['如何找到最新的申请材料？','从本页政府原始来源跳转至实际主管部门，核对当期受理事项、申请人资格、材料清单和联系方式。'],
    ['HHBA能代办或保证申请成功吗？','不能。本站为静态公开政策资料索引，不代办或承诺任何政府审批结果。']
   ],
   sources:[[p?.sourceName||'政府住房政策资料',item.sourceUrl]],officialUrl:p?.applicationUrl||h?.applyUrl,
   officialLabel:p?.applicationUrl||h?.applyUrl?'官方综合办理平台（具体事项需核验）':'事项直达办理入口待核验',
   officialNote:limitation,contacts:[],listPath:'/talent-service/list/'+(housing?'housing':'policies')+'/'+encodeURIComponent(item.city),
   detailPath:'/talent-service/'+(housing?'housing':'policy')+'/'+encodeURIComponent(item.id)
 };
}
