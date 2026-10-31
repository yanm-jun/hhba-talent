import type {CompleteGuide,GuideBranch,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {XIZANG_POLICY_RECORDS} from './xizangPolicyRecords.ts';
import {XIZANG_HOUSING_RECORDS} from './xizangHousingRecords.ts';
export {XIZANG_7_REGIONS} from './xizangPolicyRecords.ts';
export function xizangGuideUrl(kind:'policy'|'housing',id:string){return '/talent-service/policy-guide-preview/xizang/'+kind+'/'+encodeURIComponent(id);}
const notes=[
 ['能直接领取页面显示的最高金额吗？','不能。金额与适用资格、当地分区、本人身份、服务期限和资金审核结果有关。'],
 ['有毕业证就可以申请吗？','不能。需核实生源、学历类别、毕业年份、岗位或购房合同、社保等专门条件。'],
 ['全区政策是本地额外补贴吗？','不是，标明自治区统一的事项仅是按当地行政区展示办理线索，不能算成地方额外发钱。'],
 ['一条政府新闻就能证明当前正在受理吗？','不能。须查正式政策文件、申报批次、办事系统及目前公告状态。'],
 ['企业补贴能发给个人吗？','不能直接等同；以公告明确的法定受益主体为准。'],
 ['历史招聘岗位还能报名吗？','已经截止的批次不得视为仍有岗位，需重新查新公告。'],
 ['住房建设规模是可租空房吗？','不是。项目已建成和历史开放数量都不等于现在有空房。'],
 ['没有人才公寓记录是否代表当地没有公寓？','不是，只表示尚未找到足以确认具体项目、资格和受理状态的证据。'],
 ['可以跨地市领相同待遇吗？','不得将异地行政区条件直接套用，应核对真实就业、缴保和购房地。'],
 ['资料准备好了就是审批通过吗？','不是，所有资格、额度、兑现时间和住房配租均以主管部门最终审核为准。']
] as [string,string][];
export function buildXizangGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?XIZANG_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?XIZANG_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const r=p||h!;const t=new Date().toISOString().slice(0,10);
 const outdated=!!p&&(p.temporal!=='policy'||!!p.deadline&&p.deadline<t);
 const material=p?.materials||['本人身份证与家庭情况证明','就业及学历资格证明','住房资格资料','主管部门申请表'];
 const steps=(p?.applicationSteps||h?.steps||[]).map((action,i):GuideStep=>({
  title:['核对政策原文与时效','核对具体适用资格','准备官方要求的材料','确认正式受理渠道','提交审核及跟踪结果'][i]||'补充确认手续',
  why:['公告期与执行期可能不同，已结束的批次不可重新申报','省级和地市级政策不能混用，更不能只凭学历认定享受','只有当期主管部门材料清单才能确定实际所需附件','政策原文网页并不总是可提交申请的办事系统','申报成功也不代表补贴到账或已分配住房'][i]||'需依据官方规定',
  action,done:'取得本项当期官方说明；未核实事项仍标为待核实'
 }));
 const warning=p?.reviewNote||h?.statusNote||'应向主管部门核实';
 const branches:Record<string,GuideBranch>={
  eligible:{label:p?.payoutTo==='用人单位'?'符合要求的申报企业':'可能符合申请资格',desc:p?.targetGroup||h?.eligibility||'',conditions:[p?.eligibility||h?.eligibility||'','核对当地实际政策、身份和属地条件','按规定核验收入社保、已有补贴和互斥资格'],materials:material,warning},
  other:{label:'不属于此政策对象',desc:'请核对是否有本人户籍和就业地适用的其他具体政策',conditions:['不得跨城引用地方补贴','不得将历史招聘视作仍可报名','不得把企业补助直接当成个人收入'],materials:['个人真实学历、身份及属地证明','当期新的官方申报指南'],warning},
  verify:{label:'目前办理入口/房源待核实',desc:'有依据不代表实时开放',conditions:['核对政策日期、截止时间和有效性','仅按官方正式公告办理','如属住房须获得最新空置房号及真实租金'],materials:['正式受理公告或主管部门答复'],warning}
 };
 return {city:r.city,title:r.title,kicker:'西藏自治区 · '+r.city+' · '+(p?'人才政策':'人才安居'),
 desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||'按项目核定',unit:p?.headlineUnit||'制度与空房分开核验',
 limit:outdated?'历史或已截止批次，当前不得直接申请':p?.deadline?'公告列明截止'+p.deadline+'，是否仍开放以官方为准':'当前是否受理需核实',
 review:warning,qualityLevel:outdated?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'','按现行规定核验'],['所属地区',p?.district||h?.district||r.city,'不得跨地区套用']],
 branches,defaultBranch:'eligible',steps,checks:['核对政府原文与发布机构','确认自治区与地市政策层级','核实资格与截止日期',...material,'获取当前受理窗口及官方办理方式','如为住房须核实当期具体空房和正式选房规则'],
 faq:notes.concat(p?.category==='购房补贴'?[['拉萨购房能领16万元吗？','只有符合特定地区、房价、网签时限和高校毕业生身份的人才可能达到相应上限；市级资金可能提前用尽。']]:[]),
 sources:[[p?.sourceName||'住建主管部门公开资料',r.sourceUrl]],officialUrl:p?.applicationUrl||h?.applyUrl,officialLabel:'正式事项申报入口待核验',officialNote:warning,contacts:[],
 listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(r.city),
 detailPath:'/talent-service/'+(p?'policy':'housing')+'/'+encodeURIComponent(r.id)};
}
