import type {CompleteGuide,GuideBranch,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {GANSU_POLICY_RECORDS} from './gansuPolicyRecords.ts';
import {GANSU_EXPANDED_POLICY_RECORDS} from './gansuExpandedPolicyRecords.ts';
import {GANSU_EXPANDED_HOUSING_RECORDS} from './gansuExpandedHousingRecords.ts';
import {GANSU_HOUSING_BATCH_RECORDS} from './gansuHousingBatchRecords.ts';
import {GANSU_HOUSING_RECORDS} from './gansuHousingRecords.ts';
export {GANSU_14_REGIONS} from './gansuPolicyRecords.ts';
export function gansuGuideUrl(kind:'policy'|'housing',id:string):string{
 return '/talent-service/policy-guide-preview/gansu/'+kind+'/'+encodeURIComponent(id);
}
const FAQs:[string,string][]=[
 ['政策名称含“人才”是不是有学历就能直接领？','不是。各市州还会审核正式引进资格、合同社保、学历类型、服务年限、住房及政策互斥条件。'],
 ['市直补贴与县区补贴可以不看属地直接相加吗？','不能。市直和不同县区各有独立政策及资金来源，必须核对真实单位注册与就业、住房所在地。'],
 ['省政府建设规划上写有保障住房，是否可以立即申请？','不能。建设、招标和项目开工不等于配租，当期明确公布运营项目、剩余房号、租金和入口才可实际申请。'],
 ['公布建设504套或者企业建设2489套代表现在有这么多空房吗？','不代表。规模可能是规划、累计已建、历史批次或已有住户，均不能用于推算现在可租数量。'],
 ['已经结束的招聘、轮候或选房批次还能从旧公告报名吗？','不能。应以该主管部门新一轮公告的实际受理时间办理；旧文仅供核验待遇标准和历史事实。'],
 ['公租房、人才公寓、保租房、租赁补贴可以重复享受吗？','通常需要核实本人及家庭已经享受的政策住房，许多项目明确禁止同时享受；具体按该地市正式规定。'],
 ['创业贷款或者公积金提取是政府白给的钱吗？','不是。贷款需要偿还，公积金提取属于个人账户资金，租补或购房现金奖励另有不同申请条件。'],
 ['最高待遇金额是否一定能拿到？','不一定。最高额只对特定学历、岗位、人才类别、住房区域、资金分档和期限适用，需主管部门核定。'],
 ['政府网站转载与政府部门制定的原文件有区别吗？','有。政府域名转载不必然意味着来源地政府原文已验证；资料会注明再核实，非政府媒体报道还要更严格核验。'],
 ['为何有的城市显示住房管理制度而不是具体公寓？','该城市目前查到有效制度但没有可靠的实时项目或房源。为避免编造地址、房价和空房，明确区分管理制度与实体项目。'],
 ['如何确认官方申请入口？','请核对具体事项的政府政务服务页面或主管部门公开的当批运营方。单纯政策解读或采购公告通常不是报名页面。'],
 ['资格通过后是否立刻可以选房或拿到补贴？','不是。住房需轮候、抽号、合同，补贴需审核、公示、资金拨付；HHBA不代政府审批。']
];
export function buildGansuGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?[...GANSU_POLICY_RECORDS,...GANSU_EXPANDED_POLICY_RECORDS].find(x=>x.id===id):undefined;
 const h=kind==='housing'?[...GANSU_HOUSING_RECORDS,...GANSU_EXPANDED_HOUSING_RECORDS,...GANSU_HOUSING_BATCH_RECORDS].find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const item=p||h!;
 const today=new Date().toISOString().slice(0,10);
 const archive=!!p&&(p.temporal!=='policy'||!!p.deadline&&p.deadline<today)||!!h?.applicationEnd&&h.applicationEnd<today;
 const risk=p?.reviewNote||h?.statusNote||'应重新核验官方当前申报条件';
 const materials=p?.materials?.length?p.materials:[
  '申请人本人身份证明与共同家庭成员信息（按项目实际对象）',
  '真实工作合同、社保、人才类别、学历职称证明（对应项目才提交）',
  '家庭无房、住房困难或实际租赁、购房、银行缴存材料（按所选项目）',
  '项目当批指定申请表、诚信承诺、资金或合同其他附件'];
 const actions=p?.applicationSteps?.length?p.applicationSteps:h?.steps||[];
 const steps:GuideStep[]=actions.map((action,i)=>({
  title:['核验官方原文和时效','核实属地及本人资格','准备专项材料','确认实际经办渠道','审核公示与选房或兑现'][i]||'核验后续流程',
  why:['政策存在不等于现在开放','本省市县政策不可随意跨区域复用','不同政策不能用一张通用申请表代替当期清单','政府新闻链接未必能直接提交申请','资料提交不是已批准、已选房或已收到资金'][i]||'以主管部门为准',
  action,done:'已与正式公告或经办机构核对当期适用信息；尚无有效公告时继续标注待核验'
 }));
 const eligible=p?.targetGroup||h?.eligibility||'需按规定审核';
 const branches:Record<string,GuideBranch>={
  eligible:{label:p?.payoutTo==='用人单位'?'可能符合申报条件的企业':'可能符合申请资格的个人或家庭',desc:eligible,
   conditions:[p?.eligibility||h?.eligibility||'','本人实际就业、居住、住房或企业所在地属于该事项适用区域','符合其他保障互斥条件，并有当期真实公告支持申领'],
   materials,warning:risk},
  other:{label:'不满足申请对象或区域',desc:'不应把本市政策当全省所有城市普惠补贴',
   conditions:['不跨市县领取市直和县区不同补贴','不把已截止招聘当新开放岗位','不把政府采购和历史建设统计当可选房源'],
   materials:['真实身份与居住/就业属地证据','本市州适用的新正式公告'],warning:risk},
  verify:{label:'现行入口或房源尚未核实',desc:'必须由官方确认实际可申报',
   conditions:['核对来源发布单位与生效/截止日期','核实最新资格、资金或租赁项目实物房号','必须取得主管部门真实办事路径或有授权运营方的公示'],
   materials:['当期官方办事指南','申请人当期资格证明'],warning:risk}
 };
 const first=String(item.sourceUrl);
 return {
  city:item.city,title:item.title,kicker:'甘肃省 / '+item.city+' / '+(p?'人才与就业支持':'住房保障')+' V6',
  desc:p?.summary||h?.statusNote||'',
  support:p?.headlineAmount||(h?.units||'住房按项目核验').slice(0,75),
  unit:p?.headlineUnit||'历史规模不等于实时空房；租金按正式公告',
  limit:archive?'历史资料或申请截止：旧批次不得直接申请':p?.deadline?'公告日期须核验，截止'+p.deadline:'正式受理窗口、资金及房源应另行核实',
  review:risk,qualityLevel:archive?'C':'B',
  amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'按实际项目核定','以符合资格的实际对象为准'],['适用区域',p?.district||h?.district||item.city,'不能跨市县套用']],
  branches,defaultBranch:'eligible',steps,
  checks:['已阅读正式政府来源并核对转载层级','已核对发布年份及是否为历史批次','已区分政策、实体项目、政府采购与规划','已核对本人资格和其他福利互斥限制',...materials,'已取得现行经办渠道和详细受理时间','房源事项已向运营方核实最新具体房号'],
  faq:FAQs,
  sources:[[p?.sourceName||'政府公开住房项目/管理制度/历史运行资料',first]],
  officialUrl:p?.applicationUrl||h?.applyUrl,
  officialLabel:p?.applicationUrl||h?.applyUrl?'官方指定事项入口（仍需核实是否开放）':'当前办理入口待核实',
  officialNote:risk,contacts:[],
  listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(item.city),
  detailPath:'/talent-service/'+(p?'policy':'housing')+'/'+encodeURIComponent(item.id)
 };
}
