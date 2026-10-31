import type {CompleteGuide,GuideBranch,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {SHAANXI_POLICY_RECORDS} from './shaanxiPolicyRecords.ts';
import {SHAANXI_HOUSING_RECORDS} from './shaanxiHousingRecords.ts';
export {SHAANXI_10_CITIES} from './shaanxiPolicyRecords.ts';
export function shaanxiGuideUrl(kind:'policy'|'housing',id:string){
 return '/talent-service/policy-guide-preview/shaanxi/'+kind+'/'+encodeURIComponent(id);
}
const commonFaq:[string,string][]=[
 ['所有本科、硕士毕业生都会得到本条待遇吗？','不会。学历仅是部分政策资格之一，还必须满足本条列示的实际引进、岗位、收入、住房、服务年限或企业条件。'],
 ['省级政策是当地政府另外加发一份补贴吗？','不是。标记【全省统一】的记录是本地适用的省级制度入口，不代表各市额外发同额补贴。'],
 ['怎么查这个公告是否还在接受申请？','先核对官方发布日期与截止时间，再从实际负责的住房、人社或人才主管部门取得当期公告及在线系统入口；历史公告不能重复报名。'],
 ['住房项目公布套数代表现在有多少空房吗？','不代表。公告当时的项目规模、采购数量、年度已分配套数和2026年10月31日真实剩余空房是不同概念。'],
 ['公租房与保租房、人才公寓可以同时租吗？','应依具体项目和本人已享受的住房政策核验互斥条件，一般不得重复享受同类政策性住房福利。'],
 ['就业创业贷款是否等于政府发给我的现金？','不等于。创业担保贷款必须按合同偿还，财政贴息和无偿补助是不同支持形式。'],
 ['政策金额高于我实际支出时能按最大额度领吗？','不一定。购房、租赁补助可能按合同实付金额、人才类别及资金额度封顶，需实际资格与兑现审批。'],
 ['我可以跨市申请别的地方人才公寓吗？','不能直接。住房一般对工作或居住属地有要求，必须核对本条所在地及用人单位、参保和住房限制。'],
 ['网站可以替我审核或保证公寓选房吗？','HHBA仅整理政府公开资料和申请路径，不提供政府审批服务，不承诺房源、待遇、录取或资金兑付。'],
 ['政府新闻、政府采购或规划能直接当作申请入口吗？','不能。政府采购证明拟采购服务、规划证明建设方向；只有正式申报批次/运营方和主管部门确认才可申请。']
];
const deadlines=(deadline?:string,archive=false)=>{
 const today=new Date().toISOString().slice(0,10);
 return archive||(Boolean(deadline&&deadline<today));
};
export function buildShaanxiGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?SHAANXI_POLICY_RECORDS.find(r=>r.id===id):undefined;
 const h=kind==='housing'?SHAANXI_HOUSING_RECORDS.find(r=>r.id===id):undefined;
 if(!p&&!h)return null;
 const item=p||h!;
 const archival=p?deadlines(p.deadline,p.temporal!=='policy'):Boolean(h?.applicationEnd&&h.applicationEnd<new Date().toISOString().slice(0,10));
 const warning=p?.reviewNote||h?.statusNote||'正式受理应向主管部门核实';
 const material=p?.materials?.length?p.materials:[
  '本人及家庭共同申请人的有效身份证明、真实联系方式',
  '毕业证学历、人才认定、在职劳动合同及社保记录（适用时）',
  '住房信息查询、其他政策性住房保障情况及真实租赁合同（适用时）',
  '政府或运营机构要求的申请表、承诺书及当期公告附件'];
 const actions=p?.applicationSteps?.length?p.applicationSteps:h?.steps||[];
 const steps:GuideStep[]=actions.map((action,i)=>({
  title:['核对正式文件与受理时效','检查本人及家庭或企业资格','准备本条正式材料清单','联系属地部门确认申请窗口','提交申请并等待政府审批或房屋分配'][i]||'补充最终审核',
  why:['真实政府政策也可能已截止，制度/采购并不代表本年度可申报','单位受益人、人才分类、住房与学历不能相互混为一谈','只有当期指定资料才能用于审核，不能按其他城市模板盲填','政府原文的新闻链接不是最终在线办事入口','材料提交不等于补贴获批、岗位录用或公寓已有空房'][i]||'应以真实办事流程为准',
  action,done:'已经向相应主管部门或官方公告查验当批要求，未证实仍标记待核验'
 }));
 const branches:Record<string,GuideBranch>={
  eligible:{label:p?.payoutTo==='用人单位'?'具备申报资格的企业':p?.payoutTo==='非现金贷款'?'拟创业贷款申请人':'可能符合本条条件的申请人',
   desc:p?.targetGroup||h?.eligibility||'',conditions:[p?.eligibility||h?.eligibility||'','本条适用属地与用人单位/房源区县已确认','未同时享受禁止重复的政策住房、现金补贴或该类项目优惠'],materials:material,warning},
  other:{label:'不符合或不在适用区域',desc:'不得套用同省其他市补贴、入住房屋或历史公告',
   conditions:['重新确认本人真实工作、户籍/居住与项目行政区','不得将企业补助当作个人可领现金或把房屋采购称为空房','如旧批次截止，查找新的政府正式公告'],materials:['本人真实身份及区域证明','新批次官方发布的办理清单'],warning},
  verify:{label:'项目或办理状态未确认',desc:'先向负责部门确认实际开放入口和剩余资格',conditions:['确认发布日期和截止时间、办理机关名称','核实是否真的已有可以配租的具体房号/可用补贴资金','仅使用主管部门正式渠道，不向未知中介支付押金'],materials:['政府最新正式通知或运营方真实公告','实际受理窗口与操作指南'],warning}
 };
 const isSale=!!h&&h.housingCategory==='其他住房'&&h.title.includes('配售');
 const grade:CompleteGuide['qualityLevel']=archival?'C':'B';
 return {
  city:item.city,title:item.title,kicker:'陕西省 · '+item.city+' · '+(p?'人才/就业政策':'住房保障')+' · V6',
  desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||(isSale?'按项目配售价':'按官方实际项目核定'),
  unit:p?.headlineUnit||(isSale?'政策配售不是免费住房':'历史套数不等于实时余房'),
  limit:archival?'历史批次或已截止，不能沿旧公告直接申请':p?.deadline?'截至'+p.deadline+'的公告期，仍应核对实际受理情况':'现时是否开放及房源／金额均需官方确认',
  review:warning,qualityLevel:grade,
  amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'','根据所属对象及官方真实审核核定'],['适用范围',p?.district||h?.district||item.city,'不能跨市县套用']],
  branches,defaultBranch:'eligible',steps,checks:['已核对官方来源及具体政策版本','已区分省级、市级、区县项目和政府采购新闻','已核对公告期与截止时间','已核验本人的人才/住房/在职身份和互斥条件',...material,'已经取得现行真实办事渠道与完整申请清单','若为住房已核实具体空房及当期租售价格'],
  faq:[
   ...commonFaq,
   ...(p?.city==='铜川'&&p.category==='购房补贴'?[['铜川博士工作一年能领20万元购房补贴吗？','不能仅据此认定。必须核对在铜工作满3年、落户、首次购房和人才分类等条件。'] as [string,string]]:[]),
   ...(p?.city==='宝鸡'&&p.payoutTo==='用人单位'?[['扩岗1500元是毕业生个人收款吗？','不是。此项是按符合条件的招用青年人数给予参保用人单位的一次性扩岗补助。'] as [string,string]]:[]),
   ...(item.city==='咸阳'?[['咸阳人才安居补贴额度是政府正式认证吗？','当前相关金额仅为外部解读研究线索，未取得政府正式实施细则全文，不应据此向个人承诺可领取。'] as [string,string]]:[])
  ],sources:[[p?.sourceName||'政府住房与安居政策公开资料',item.sourceUrl]],
  officialUrl:p?.applicationUrl||h?.applyUrl,
  officialLabel:p?.applicationUrl||h?.applyUrl?'政府指定渠道（申报状态仍需复核）':'办理入口待核实',
  officialNote:warning,contacts:h?.contactPhone?[{name:'原公告所列咨询电话',phone:h.contactPhone}]:[],
  listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(item.city),
  detailPath:'/talent-service/'+(p?'policy':'housing')+'/'+encodeURIComponent(item.id)
 };
}
