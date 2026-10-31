import type {CompleteGuide,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import type {TalentPolicyRecord} from './talentPolicyRecords';
import {YUNNAN_POLICY_RECORDS} from './yunnanPolicyRecords.ts';

/** Yunnan V5.1: policy-specific B/C six-section guide using shared renderer.
 * These are NOT certified A guides. Every benefit, eligibility and material originates
 * in the named record; only explanation and self-check UX are shared.
 */
export const YUNNAN_GUIDE_RECORDS:readonly TalentPolicyRecord[]=YUNNAN_POLICY_RECORDS;
const dateToday=()=>new Date().toISOString().slice(0,10);
const limited=(p:TalentPolicyRecord)=>p.temporal!=='policy'||Boolean(p.deadline&&p.deadline<dateToday());
function description(p:TalentPolicyRecord,part:'qualification'|'proof'|'application'){
 if(part==='qualification')return '确认本人申请类别、适用区域及工作住房等资格，与政府文件约束一致；不符合不应直接申请。';
 if(part==='proof')return '准备可核验的真实材料，避免因身份、参保或住房信息缺项导致受理失败。';
 return '对照原文确定本事项办理方式和当前受理批次；只有正式受理通知才能证明申报开放。';
}
function mappedSteps(p:TalentPolicyRecord):GuideStep[]{
 const source=p.applicationSteps?.length?p.applicationSteps:[p.application,p.eligibility,p.materials?.join('，')||'',p.reviewNote||'以官方公告为准'];
 return source.map((action,i)=>({
   title:['核对资格与属地','核实政策条件','准备材料或提交渠道','按公告提交与查询结果'][i]||'按主管部门要求办理',
   why:description(p,i===0?'qualification':i===1?'qualification':i===2?'proof':'application'),
   action,
   done:i===0?'已确认本人符合本事项所限定的人群与辖区，不等于主管部门正式资格认定':i===1?'已对照官方文件逐项核对限制条件':i===2?'已准备事项要求的资料并核对真实受理渠道': '已按当期官方渠道提交并留存凭证，或已确认该期截止／入口未公布；提交不等于审核通过'
 }));
}
export function buildYunnanGuide(id:string):CompleteGuide|null{
 const p=YUNNAN_GUIDE_RECORDS.find(x=>x.id===id);
 if(!p)return null;
 const expired=limited(p);
 const materials=p.materials?.length?p.materials:['查看政策原文','核实本人资格','按主管部门材料清单办理'];
 const caution=p.reviewNote||'办理入口待核实，请以主管部门当期公告为准。';
 return {
   city:p.city,title:p.title,
   kicker:expired?'云南省 · 历史批次资料':'云南省 · 政策申请基础指南',
   desc:p.summary,
   support:p.headlineAmount||'以官方标准为准',
   unit:p.headlineUnit||p.category,
   limit:expired?'历史/已结束申报窗口 · 勿当现行申请':'当前受理状态依官方窗口核实',
   review:caution,qualityLevel:expired?'C':'B',
   amounts:[
     [p.category,p.benefit,p.payoutTo==='非现金贷款'?'贷款额度非现金补贴':p.payoutTo==='住房折扣'?'住房价格优惠非现金':p.headlineUnit||'按官方核定'],
     ['适用对象',p.targetGroup||'按官方实际资格',p.scope==='特定区域'?'限规定地区':p.scope==='年度批次'?'限相应申报批次':'严格按原文规定']
   ],
   branches:{
     eligible:{
       label:'拟申报的适用人群',
       desc:p.targetGroup||p.eligibility,
       conditions:[p.eligibility,p.scope==='特定区域'?'必须符合文件指定区域或行政区划':p.scope==='年度批次'?'仅限对应年度批次':'须核对当地单位与个人适用范围',expired?'本批次已截止或归档，需等待新公告':'最新年度申报入口仍需核验'],
       materials,warning:caution
     },
     other:{
       label:'未满足资格／其他地区',
       desc:'此类申请人不能把同一省份或附近城市的政策视为自动适用。',
       conditions:['核对本人所在城市与政策限定的县区/高新区','确认学历职称、人才类别及劳动合同和参保是否符合对应原文','有房家庭、已经享受同类待遇的人应重点核实互斥或无房规则'],
       materials:['本人身份及实际工作所在地区材料','学历职称人才认定证明（如有）','原单位和居住住房证明（如涉及）'],
       warning:'不符合当前政策不等于全市没有其他待遇。请回到城市目录查询其他事项，不能使用他人资格申请。'
     }
   },
   defaultBranch:'eligible',
   steps:mappedSteps(p),
   checks:[
     '已核对原文发布日期、实施区县及适用对象',
     '已核对当前日期与申请截止日期或开放公告',
     '已对照全部身份、工作和参保门槛',
     ...materials,
     '已区分政策原文与真实线上/线下申请渠道',
     '如涉及住房，已核对当前房源和家庭住房限制'
   ],
   faq:[
     ['这项政策现在还能申请吗？',expired?'本条为历史或已截止批次，不是当前可受理通知，须等待主管部门新公告。': '该政策有可查政府依据，但不能仅凭制度仍存在就认定正在受理。请查主管部门当期开放公告。'],
     ['符合学历条件是否一定能领取？','不能。还需核对本事项地区、就业创业、人才分类、社保、住房和家庭等完整条件，并经过主管部门审核。'],
     ['我能领取页面展示的最高金额吗？',p.headlineAmount?'不能直接推定。页面金额是特定类别或制度的上限/标准，具体仍以政府按个人资格核定为准。':'待遇按政策类别、受理批次和政府审核为准，本站不作到账承诺。'],
     ['政策原文能否直接作为申请入口？',p.applicationUrl?'官方受理平台地址已收录，但仍需在平台中核对具体办事事项及开放批次；官网首页不是自动受理凭据。':'不能。政策原文与申请页面不是同一回事。本条尚未核实事项直达入口。'],
     ['如何核实人才公寓是否有房？','人才住房制度、历史配租总量和实时空房不同。只能根据住房主管部门最新配租公告、运营机构或正式受理信息判断。']
   ],
   sources:[[p.sourceName,p.sourceUrl]],
   officialUrl:p.applicationUrl,
   officialLabel:p.applicationUrl?'官方办事服务平台（请核对具体事项）':'事项直达受理入口待核实',
   officialNote:p.applicationUrl?'此网址仅证明平台入口，具体事项及当前申报窗口需在平台再次核实。':'提供的是官方文件原文。未核实直接申报的受理页面，请勿通过第三方付款代办。',
   contacts:[],listPath:'/talent-service/list/policies/'+encodeURIComponent(p.city),
   detailPath:'/talent-service/policy/'+encodeURIComponent(p.id)
 };
}
