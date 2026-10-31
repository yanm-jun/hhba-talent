import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import {QINGHAI_POLICY_RESEARCH_RECORDS} from './qinghaiPolicyRecords.ts';
import {QINGHAI_SHARED_POLICY_RECORDS} from './qinghaiSharedPolicies.ts';
import {QINGHAI_HOUSING_RESEARCH_RECORDS} from './qinghaiHousingRecords.ts';
import {QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS} from './qinghaiVerifiedHousing.ts';
export const QINGHAI_8_REGIONS=['西宁','海东','海北','黄南','海南州','果洛','玉树','海西'] as const;
export const qinghaiGuideUrl=(kind:'policy'|'housing',id:string)=>'/talent-service/policy-guide-preview/qinghai/'+kind+'/'+encodeURIComponent(id);
export function buildQinghaiGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?[...QINGHAI_POLICY_RESEARCH_RECORDS,...QINGHAI_SHARED_POLICY_RECORDS].find(x=>x.id===id):undefined;
 const h=kind==='housing'?[...QINGHAI_HOUSING_RESEARCH_RECORDS,...QINGHAI_VERIFIED_HOUSING_SUPPLEMENTS].find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const r=p||h!,city=r.city, today=new Date().toISOString().slice(0,10);
 const overdue=!!p&&(p.temporal!=='policy'||!!p.deadline&&p.deadline<today);
 const limitation=p?.reviewNote||h?.statusNote||'受理资格仍须咨询主管部门';
 const materials=p?.materials||['按实际引进项目核实本人身份及人才认定材料','按所在县市核实就业与家庭住房材料','当期项目配租公告与主管单位正式申请清单'];
 const action=p?.applicationSteps||h?.steps||[];
 const steps:GuideStep[]=action.map((a,i)=>({title:['查看原始依据及适用年度','确认地域与人才分类','核对正式申请材料','确认当前有效办理入口','等待部门审批与资金或房源通知'][i]||'按主管部门实际办理程序执行',
 why:i===0?'2026年发布和2026年仍有效不相同；招募报道不是财政实施细则。':i===1?'省直和市州、县区引才资格不可混用。':i===2?'不得凭学历推断能获补贴或住房。':'公告项目与当期开放的具体申请事项、可住空房不相等。',
 action:a,done:'只以该事项主管部门明确的当前证据确认；仍未知的事实保留待核验状态'}));
 const branches:Record<string,GuideBranch>={
 eligible:{label:'可能符合本项目资格',desc:p?.targetGroup||h?.eligibility||city,
 conditions:[p?.eligibility||h?.eligibility||'', '逐项确认单位编制、服务期、人才类别、属地及就业时间','涉及住房的须确认本人及家庭住房及已享补贴互斥条件'],materials,warning:limitation},
 other:{label:'非本地或不符当前批次',desc:'不要直接套用其他市州或省直事业单位的待遇',
 conditions:['核实本人就业、单位注册及人才落地所属市州','查证本岗位是否属于当地专项全职人才引进','过期招聘不得继续提交旧入口'],materials:['身份证和实际工作地证明','学历与用人单位岗位说明'],warning:limitation},
 verify:{label:'申请渠道、金额或房源待核实',desc:'原文存在不等于当期受理窗口已开放',
 conditions:['确认原文件和变更、废止通知','向当地人才主管部门查真实申报入口和办理时间','住房先查具体楼栋、租金与空房，建设总量不能当空房'],materials:['主管部门最新公告','受理平台及有效时间依据'],warning:limitation}
 };
 return {city,title:r.title,kicker:'青海省 · '+city+' · '+(h?'住房项目/制度':'2026人才政策')+' · 证据等级',
 desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||'住房建设或保障·不代表当前空房',
 unit:p?.headlineUnit||(h?'非实时可申请房源':'以正式规则核定'),
 limit:overdue?'2026历史申报批次已截止':p?.deadline?'报名/申报截止'+p.deadline+'，如有变更以政府为准':'是否实际受理及执行细则待主管部门核实',
 review:limitation,qualityLevel:overdue?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'人才住房',p?.benefit||h?.rent||'', '实际额度与资格均以当地发布的实施规则为准'],['适用区域',p?.district||h?.district||city,'青海海南州与海南省不相同']],
 branches,defaultBranch:'eligible',steps,
 checks:['已核对2026政策资料与来源等级','已确认该事项是省级、州级还是县区适用','已确认学历、单位性质、合同服务期等资格','已检查该批次是否到期',...materials,'主管机关当前直达申报入口如未核实不得虚构','住房必须单独核实当前空置与可分配房源'],
 faq:[
 ['这个页面的补贴金额现在能直接领吗？','不能直接认定。2026校园招聘宣讲资料不是单独的财政申报细则，需向本市州人才主管部门确认本单位、人才认定和服务期条件。'],
 ['2026年宣传的最高博士金额所有博士都有吗？','没有这个保证，部分州有不同档位，并限定全职引进、事业编制或相应指定引进岗位。'],
 ['全省省直待遇能叠加市州待遇吗？','未查到允许无条件叠加的正式规则，不得自行相加。'],
 ['青海的海南州等于海南省吗？','不等于。本页面海南州是青海省海南藏族自治州，不适用海南省海口、三亚的人才补助。'],
 ['2026年招聘公告和现金补贴是同一件事吗？','不是。报名岗位与取得人才待遇可能分别要求资格审查、入职及履约。'],
 ['住房项目显示套数就是现在有空房吗？','不是。建成总数、建设招标套数、历史开放批次均不能推导现时空房。'],
 ['申请流程和材料已经都确定了吗？','只有政府原文已明确的环节可以视为已核实；其他检查步骤是核验顺序，不代表官方正式材料清单。'],
 ['没找到具体直达入口怎么办？','向当地组织部人才办、人社局或住建部门核当期正式申请公告，页面不以政策介绍页冒充在线办理。'],
 ['符合学历后能跨县市申领吗？','不可以推定。工作单位、属地及财政发放主体必须按原政策确认。'],
 ['HHBA的A级代表什么？','A级只表示经完整政府证据审计、指南核验的资料质量；这些未取得正式细则的项目不自动认证A级。']
 ],
 sources:[[p?.sourceName||'政府住房项目或人才工作公开资料',r.sourceUrl]],
 officialUrl:p?.applicationUrl||h?.applyUrl,officialLabel:'正式直达办理入口尚待核实',officialNote:limitation,
 contacts:[],listPath:'/talent-service/list/'+(h?'housing':'policies')+'/'+encodeURIComponent(city),
 detailPath:'/talent-service/'+(h?'housing':'policy')+'/'+encodeURIComponent(id)};
}