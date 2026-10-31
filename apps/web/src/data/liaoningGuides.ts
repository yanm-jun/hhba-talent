import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
import {LIAONING_CITY_CONTACTS,LIAONING_PROVINCIAL_POLICY_RECORDS} from './liaoningProvincialPolicyRecords.ts';
import {LIAONING_MUNICIPAL_POLICY_RECORDS} from './liaoningMunicipalPolicyRecords.ts';

/** 14市统一详情组件：省级同款属地视图和城市独立项目不能混为一谈。 */
export const LIAONING_GUIDE_RECORDS:readonly TalentPolicyRecord[]=[...LIAONING_PROVINCIAL_POLICY_RECORDS,...LIAONING_MUNICIPAL_POLICY_RECORDS];
export const LIAONING_14_CITIES=LIAONING_CITY_CONTACTS.map(c=>c.city);
export const liaoningGuideRoute=(id:string)=>'/talent-service/policy-guide-preview/liaoning/'+encodeURIComponent(id);
const st=(title:string,action:string,i:number):GuideStep=>({
 title,action,
 why:i===0?'先取得官方可查依据并核对办理事项，避免仅凭摘要及广告判断资格。':i===1?'本市毕业时间、户籍、就业和社保等条件可能同时约束，必须逐项确认。':i===2?'同一政策不同学历、身份和住房情况待遇不相同，最高金额不能代替个人核准。':i===3?'政府政策页面不自动等于申报系统，实际受理渠道和截止日期会变化。':i===4?'证件和敏感个人资料只应提交政府指定真实办事入口，HHBA不接收个人证件。':'只有正式批复和到账、配房结果才代表实际取得政策权益。',
 done:i===0?'已定位真正公开政策与当期办事说明':i===1?'已完成个人资格核查并知道仍待确认的限制':i===2?'已核对政策上限、分档及不重复领取要求':i===3?'已核实当地真实申报渠道及当前受理时间':i===4?'已备好资料并取得受理状态': '保存正式核准、公示或补贴资金到账记录'
});
export function buildLiaoningGuide(id:string):CompleteGuide{
 const p=LIAONING_GUIDE_RECORDS.find(x=>x.id===id);
 if(!p)throw new Error('Unknown Liaoning policy guide '+id);
 const c=LIAONING_CITY_CONTACTS.find(x=>x.city===p.city);
 if(!c)throw new Error('City absent '+p.city);
 const archive=p.temporal!=='policy'||!!(p.deadline&&p.deadline<'2026-10-31');
 const isProvincial=p.id.includes('-provincial-')||p.id.includes('-three-support-');
 const three=p.id.endsWith('-three-support-closed');
 const special=p.category==='租房安居'||p.category==='购房补贴';
 const steps=[...(p.applicationSteps||[])];
 while(steps.length<6) steps.push('向'+p.city+'主管部门确认最终资格、受理批次、资金和兑现结果；政策来源与页面展示不等于已经审核通过。');
 const branches:Record<string,GuideBranch>={
 candidate:{
 label:three?'2026当年符合岗位资格者':special?'拟申请住房支持者':'拟按本条申报者',
 desc:three?'2026批次已结束，该路径只供理解历史资格和等待后续公告。':'先核对自身资格，再查询当年本市真实申请渠道。',
 conditions:[p.eligibility,'必须符合'+p.city+'或辽宁主管部门当期实际受理规定；与同类补贴、住房互斥事项另行核对。','经审核后才能认定本人可获补贴，已收录政策不代表自动获得。'],
 materials:p.materials||['身份证','相关资格证明','申报表'],
 warning:archive?'该政策属于历史批次或已截止，不应当作为当前开放的申报入口。':isProvincial?'本项是辽宁全省统一政策在'+p.city+'的属地视图，不是市级另发的一份。':'请确认该项本市是否正在受理，金额与资格以当期原文和审核为准。'
 },
 verify:{
 label:three?'2027或后续新批次待公布':'条件不确定／需要补充材料者',
 desc:three?'没有2027官方新公告就不能复用2026报名链接和岗位表。':'材料未齐、就业或住房状态存在变化者，先核验再决定是否申请。',
 conditions:['先向政策主管部门核实未确认的身份、毕业届次、参保地或住房限制','不得用最高金额、历史批次房源、旧的表单代替现行申请资格','如不符合'+p.city+'规定条件，改为查询其他政策，不提交不实资料。'],
 materials:['本人真实学历就业及社保证明，仅按经办机关要求提供','如涉及租购房，准备合同与无房查询材料并核验有效日期','窗口通知要求的复核说明和补充凭证'],
 warning:'政策页面不提供代审资格，也不采集上传身份证、银行卡、劳动合同等个人文件。'
 }
 };
 const amounts:string[][]=[
 [three?'招募计划':isProvincial?'全省统一支持项目':'本市政策支持类别',p.headlineAmount||'按当地标准',p.headlineUnit||'以本人正式审批为准'],
 ['实际兑现标准',p.benefit,'仅用于符合当前政策真实申请条件者'],
 ['资格要求',p.eligibility,'不符合所有条件不得自动获得']
 ];
 return {
 city:p.city,title:p.title,kicker:'LIAONING / '+c.slug.toUpperCase()+' / V5.1',
 desc:p.summary+(isProvincial?' 这是省级统一政策属地索引，并不表示本市额外发放同一笔补贴。':' 本市资料按发布部门及当前证据核对。'),
 support:p.headlineAmount||'按审核结果',unit:p.headlineUnit||'不能视为实时批准',
 limit:archive?'历史/已截止，后续年度另查官方通知':p.deadline?'公告结束日期 '+p.deadline+'；以现行官方通告为准':'具体申报时段、住房空房和可申领资金须向当地主管部门核实',
 review:'2026-10-31记录；'+(archive?'历史C级': '基本B级')+'，来源：'+p.sourceName,
 qualityLevel:archive?'C':'B',
 amounts,branches,defaultBranch:'candidate',
 steps:steps.map((x,i)=>st(['确认正式政策与适用范围','自查学历户籍就业与社保资格','核算实际扶持额度与互斥规则','查找当地真实办理入口','准备材料按当期事项提交','跟踪审批、公示及兑现'][i]||'等待正式结果',x,i)),
 checks:[
 '本市和政策适用地区/单位已经核实',
 '本人毕业届次、学历专业或人才类别满足要求',
 '户籍、就业、劳动合同与社保情况已核验',
 '住房性质及备案状态已核验（如适用）',
 '已经确认申报期限、资金和官方真实受理事项',
 '资料只交官方平台，保留受理与审核凭据'
 ],
 faq:[
 ['是不是所有在'+p.city+'的毕业生都能领取？','不是。必须满足：'+p.eligibility],
 ['这项可以领取多少钱？',p.benefit],
 ['在哪里申报？',p.application+' 如主管部门未提供公开可验证的事项链接，本站不伪造直接办理入口。'],
 ['辽宁省统一政策和市级补贴是一回事吗？',isProvincial?'不是。本项仅为全省统一政策的'+p.city+'属地展示，不能当作另一笔独立补贴。':'不是。本条来自城市政策依据，若与省级同类事项重合必须核验互斥规则。'],
 ['是否有当期人才公寓可入住？','本指南不展示实时房源，人才公寓制度、购房补贴、租房补贴属于不同事项；必须核对项目地址和当期配租公告。'],
 ['本页是否能替代政府资格审批？','不能。以本市人社或住建主管部门最新有效公告、公示、合同和资金拨付为准。'],
 ['历史批次还能申报吗？',archive?'本次历史或已结束的窗口不可继续报名，需要等待官方新一批次。':'具体是否正在受理未经过系统实时确认，需到主管部门当前事项核实。']
 ],
 sources:[[p.sourceName,p.sourceUrl]],
 officialUrl:undefined,
 officialLabel:'查看政策来源并核对官方受理事项',
 officialNote:three?'2026辽宁三支一扶报名7月17日已结束；公告展示不等于新年度网上报名入口。':special?'如已公布经办APP或服务站，请通过官方渠道使用，本站不代为上传证件，不提供房源预留。':'本条为政策原文或可追溯研究资料，不将官网或报道页面当作个人申请成功的证明。',
 contacts:three?[{name:p.city+'三支一扶办公室',phone:c.phone}]:[],
 contactSource:three?p.sourceUrl:undefined,
 listPath:'/talent-service/list/policies/'+encodeURIComponent(p.city),
 otherRoute:'/talent-service/city/'+encodeURIComponent(p.city),otherLabel:'返回'+p.city+'人才服务'
 };
}
