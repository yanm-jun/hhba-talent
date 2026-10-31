import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import {JIANGSU_POLICY_RECORDS} from './jiangsuPolicyRecords.ts';
import {JIANGSU_HOUSING_RECORDS} from './jiangsuHousingRecords.ts';
import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
import type {TalentHousingRecord} from './talentHousingRecords.ts';

/** Jiangsu V5.1: reusable six-section guides for each source-backed policy and housing record.
 * This is NOT A-grade automatic certification: A must be separately evidenced and accepted.
 * No private documents are uploaded to HHBA and non-government booking URLs are never substituted.
 */
export const JIANGSU_CITIES=[
 ['南京','nanjing'],['无锡','wuxi'],['徐州','xuzhou'],['常州','changzhou'],
 ['苏州','suzhou'],['南通','nantong'],['连云港','lianyungang'],['淮安','huaian'],
 ['盐城','yancheng'],['扬州','yangzhou'],['镇江','zhenjiang'],['泰州','taizhou'],['宿迁','suqian']
] as const;
export const JIANGSU_CITY_SLUGS:Readonly<Record<string,string>>=Object.fromEntries(JIANGSU_CITIES);
export const JIANGSU_GUIDE_BASE='/talent-service/policy-guide-preview/jiangsu';
export const jiangsuGuideUrl=(kind:'policy'|'housing',id:string)=>JIANGSU_GUIDE_BASE+'/'+kind+'/'+encodeURIComponent(id);
const policyList=(city:string)=>'/talent-service/list/policies/'+encodeURIComponent(city);
const housingList=(city:string)=>'/talent-service/list/housing/'+encodeURIComponent(city);
const cityUrl=(city:string)=>'/talent-service/city/'+encodeURIComponent(city);
const short=(s:string,n=160)=>s.length>n?s.slice(0,n)+'…':s;
function sourceStep(action:string,index:number,kind:'policy'|'housing'):GuideStep{
 const why=[
  '政策适用地区、日期与人才分类是审核的第一关，旧版本可能已经失效。',
  '待遇并非只凭最高金额计算，个人条件决定是否符合具体条款。',
  '本人及家庭住房、社保及既往补贴可能形成不同限制或互斥。',
  '政策原文不等于政府业务受理表单，必须从真实主管部门入口办理。',
  '主管部门的审核、公示、合同或实际资金结算才是最终结果。'
 ];
 const done=[
  '能说清政策对应的城市、文件版本、有效期与适用区域。',
  '能标出本人所属的官方人才类别与其对应条件。',
  '已准备证明真实事实的材料，并标记仍待核实的信息。',
  '已找到官方有效的受理事项或明确知道该期已截止。',
  '取得主管部门真实回执或批复；未获批前不认为可用。'
 ];
 return {title:action,why:why[Math.min(index,4)],action,
  done:kind==='housing'&&index===4?'以官方通知的选房、签约或实际入住结果为准。':done[Math.min(index,4)],
  note:index===3?'请注意：HHBA不是政府申报系统，禁止向本站提交身份证、住址和银行账号。':undefined};
}
function conditionBranches(label:string,eligibility:string,materials:string[],risk:string):Record<string,GuideBranch>{
 return {
  applicant:{label:'我的申领条件',desc:'按本条原始政策核对本人真实资格。'+label,
   conditions:[eligibility,'适用范围和当前申报期限仍以主管部门实时正式公告为准。'],
   materials,warning:risk},
  boundaries:{label:'限制与特殊情况',desc:'不属于政策对象或历史批次时，请勿直接套用这里的金额和步骤。',
   conditions:[risk,'不得把本条的行业、区县或历史批次条件应用到其他市县。','如果缺少官方申请入口或项目仍未开放，只能进行资格咨询。'],
   materials:['需要向经办主管部门确认实际有效政策版本和适用范围',...materials.slice(0,2)],
   warning:'该分支是风险提示而非新的申领资格；应以政府正式规定为准。'}
 };
}
function contactsFromHousing(h:TalentHousingRecord){
 return h.contactPhone?[{name:'政府公告公开的住房业务咨询',phone:h.contactPhone}]:[];
}
function coreFaq(name:string,benefit:string,eligibility:string,application:string,risk:string,kind:'policy'|'housing'):[string,string][]{
 return [
  ['是不是所有毕业生都能申请？',short(eligibility,280)+'。是否符合资格由政府部门核验。'],
  ['网上看到的最高补贴是不是固定发放？','不是。'+short(benefit,270)+'。不得将最高档当作人人可领。'],
  ['现在一定还开放申请吗？','不能据历史公告判断正在受理。'+short(risk,250)],
  ['政府政策原文能直接提交申报吗？','不能。'+short(application,260)+'。原文链接和在线办理入口不同。'],
  ['要准备哪些材料？','先按官方申报页面提供的材料清单准备。本站自查材料仅用于分类核对，不代替官方上传要求。'],
  ['住房套数是实时可租余量吗？',kind==='housing'?'不是。历史公告、筹集规模或原批次套数不能代表现时空房。':'如果政策涉及住房，历史建设数量、项目公告和实时房源必须区分。'],
  ['跨区工作或夫妻共同申请可以按更高档算吗？','不要自行叠加；应核对本项政策的区域、家庭关系、互斥和归属规则。'],
  ['HHBA能替政府审核或者代为提交证件吗？','不能。平台提供公开信息整理与自查，实际报名只进入政府公布的经办系统。']
 ];
}
function fromPolicy(p:TalentPolicyRecord):CompleteGuide{
 const isPast=p.temporal==='historical'||p.temporal==='past-window'||Boolean(p.deadline&&p.deadline<'2026-10-31');
 const money=p.headlineAmount||'按分类核定';
 const note=isPast?'历史政策或已截止批次，不作为2026年当前可申领保证。':p.reviewNote||'现行资格需主管部门核实';
 return {
  city:p.city,title:p.title,kicker:'JIANGSU / V5.1 / '+p.category,
  desc:p.summary+' '+p.targetGroup+'。'+note,support:money,unit:p.headlineUnit||'资格以政府审核为准',
  limit:p.scope==='特定区域'?'仅限对应区域，不适用于全市其他区域':p.deadline?'截至 '+p.deadline:'政策日期与办理状态须复核',
  review:'官方政策资料核验2026-10-31；完整A级独立认证未完成 · '+(isPast?'C历史等级':'B基础等级'),
  qualityLevel:isPast?'C':'B',
  amounts:[
   [p.category,p.benefit,p.headlineUnit||'按申请资格分类'],
   [p.scope||'全市',p.targetGroup||'个人资格待核',p.published+' · 政府发布/资料日期'],
   ['期限及互斥',note,'如有申请截止，以官方具体公告为准']
  ],
  branches:conditionBranches(p.category,p.eligibility,p.materials||[],note),
  defaultBranch:'applicant',
  steps:(p.applicationSteps||[]).map((s,i)=>sourceStep(s,i,'policy')),
  checks:[
   '已经核对政府原文（发布机构、版本与适用区域）',
   '学历、技能或人才认证等级符合所选分档，而非套用最高额',
   '真实就业、社保、家庭住房及历史补贴状况已分别核对',
   '已按原文与本人类别整理申请资料，核实最新申报时间',
   '已区分政府政策原文、真实业务入口与最终审核结果'
  ],
  faq:coreFaq(p.city,p.benefit,p.eligibility,p.application,note,'policy'),
  sources:[[p.sourceName||p.title,p.sourceUrl]],
  officialUrl:p.applicationUrl,
  officialLabel:p.applicationUrl?'政府公布的业务平台':'经办入口待主管部门核实（下方提供政府原文）',
  officialNote:p.applicationUrl?'该业务地址由公开资料提供，登录后仍须确认该事项当前开放。':p.application,
  contacts:[],
  listPath:policyList(p.city),detailPath:'/talent-service/policy/'+encodeURIComponent(p.id),
  otherRoute:cityUrl(p.city),otherLabel:'返回'+p.city+'人才服务'
 };
}
function fromHousing(h:TalentHousingRecord):CompleteGuide{
 const isPast=Boolean(h.applicationEnd&&h.applicationEnd<'2026-10-31');
 const context=h.statusNote+' '+h.address;
 return {
  city:h.city,title:h.title,kicker:'JIANGSU / V5.1 / 人才安居',
  desc:context,support:h.units,unit:'住房项目数量≠实时空房数',
  limit:h.applicationEnd?'当批申请截止 '+h.applicationEnd:'申请批次与项目运营状态待核实',
  review:'住房资料核验2026-10-31；A级独立项目认证未完成 · '+(isPast?'C历史等级':'B基础等级'),
  qualityLevel:isPast?'C':'B',
  amounts:[['项目类型',h.kind==='project'?'实际住房项目':'住房制度/服务项目','具体房源必须有独立公示'],
  ['地址与覆盖范围',h.address,h.district],['收费与优惠',h.rent,'以项目当期合同与政府审批为准'],
  ['公示规模',h.units,'不是可申请实时库存']],
  branches:conditionBranches(h.district,h.eligibility,['身份学历、就业创业及申请家庭关系材料（按具体官方公告）','当地住房、历史住房保障与补贴使用状态核对','项目公告列明的申请表、签约和付款材料（按真实当期要求）'],h.statusNote),
  defaultBranch:'applicant',steps:h.steps.map((s,i)=>sourceStep(s,i,'housing')),
  checks:['核对真实房源地址或确认本记录仅是住房制度而非独立楼盘','核对本人在当地工作、人才认定与家庭住房限制',
  '确认本期是否开放，而不是误读已截止公示','查看项目正式申请入口、收费和选房签约事项',
  '完整材料仅上传政府或正式运营方系统，本站不收个人资料'],
  faq:coreFaq(h.city,h.rent,h.eligibility,h.steps.join('；'),h.statusNote,'housing'),
  sources:[['住房项目/制度官方来源',h.sourceUrl]],
  officialUrl:h.applyUrl,officialLabel:h.applyUrl?'住房主管部门公布的申报平台':'当前可核验的独立项目申请入口未公布',
  officialNote:h.statusNote,
  contacts:contactsFromHousing(h),contactSource:h.contactSourceUrl,
  listPath:housingList(h.city),detailPath:'/talent-service/housing/'+encodeURIComponent(h.id),
  otherRoute:cityUrl(h.city),otherLabel:'返回'+h.city+'人才服务'
 };
}
export function getJiangsuGuide(kind:string,id:string):CompleteGuide|undefined{
 if(kind==='policy'){const found=JIANGSU_POLICY_RECORDS.find(p=>p.id===id);return found?fromPolicy(found):undefined;}
 if(kind==='housing'){const found=JIANGSU_HOUSING_RECORDS.find(h=>h.id===id);return found?fromHousing(found):undefined;}
 return undefined;
}
export const JIANGSU_GUIDE_COUNT=JIANGSU_POLICY_RECORDS.length+JIANGSU_HOUSING_RECORDS.length;
