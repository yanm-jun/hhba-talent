import type {CompleteGuide,GuideStep,GuideBranch} from '../components/talent/UnifiedPolicyGuide';
import {GUIZHOU_POLICY_RECORDS} from './guizhouPolicyRecords.ts';
import {GUIZHOU_HOUSING_RECORDS} from './guizhouHousingRecords.ts';
export const GUIZHOU_9_REGIONS=['贵阳','六盘水','遵义','安顺','毕节','铜仁','黔西南','黔东南','黔南'] as const;
export function guizhouGuideUrl(kind:'policy'|'housing',id:string){
 return '/talent-service/policy-guide-preview/guizhou/'+kind+'/'+encodeURIComponent(id);
}
function steps(actions:string[]):GuideStep[]{
 return actions.map((action,i)=>({
 title:['核对原文和政策期间','逐项核实人才和属地条件','核对材料与规定类别','确认真实受理窗口','提交资格审核与结果查询'][i]||'落实主管部门后续办理要求',
 why:i===0?'不同市州、年度和岗位的申报资格不可相互套用；历史公告不可再次报名。':i===1?'学历只是资格的一部分，聘用、社保、服务期及家庭住房可能设限。':i===2?'只有主管部门发布的实际材料清单才可作为申请依据。':i===3?'政府新闻报道、历史报名网址和现时项目真实受理平台不同。':'通过资格审查不代表已经获批津贴或分配住房。',
 action,done:'已按政府公开原文核验本项；未确认的真实申报入口或房源保持待核验状态'
 }));
}
export function buildGuizhouGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?GUIZHOU_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?GUIZHOU_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const item=p||h!;
 const housing=!!h;
 const outdated=p?.temporal!=='policy'||Boolean(p?.deadline&&p.deadline<'2026-10-31');
 const material=p?.materials?.length?p.materials:[
 '本人身份、学历学位及工作单位证明（按适用事项）',
 '本人及家庭住房信息、既有住房保障记录（按当期项目要求）',
 '项目主管部门要求的实名申请表和人才资格证据（当期核实）'];
 const limitation=p?.reviewNote||h?.statusNote||'受理情况需以最新政府公告为准';
 const branches:Record<string,GuideBranch>={
  eligible:{label:'可能符合该事项条件',desc:p?.targetGroup||h?.eligibility||item.city,
   conditions:[p?.eligibility||h?.eligibility||'', '申请人工作及人才资格应符合本条限定市州、单位和政策批次','住房资格、已享政策互斥及身份资历需依当期正式清单核验'],materials:material,warning:limitation},
  other:{label:'不符合该批次或不在对应市州',desc:'应查询真实工作或居住市州的其他独立项目，不得跨市州套用最高待遇。',
   conditions:['核对本人聘用或企业注册地点是否在政策所指区域','核对毕业时间、专业学历、人才认定和工作服务期','不得以其他市州制度替代申请本地岗位或租房'],
   materials:['身份证明及真实就业/居住地证明','学历、职称与有效人才资格资料'],warning:limitation},
  verify:{label:'政策报道或房源尚未确定实时受理',desc:'取得政府原文不等于当前可申请，旧申请页面可能早已关闭。',
   conditions:['检查发布日期、批次截止日期和最新修订','在主管部门官网确认本期准确办理渠道及窗口','住房须取得实际项目地址、当期空房、选房规则及运营方公告'],
   materials:['当期真实报名或项目公告','现时资格和材料清单'],warning:limitation}
 };
 return {city:item.city,title:item.title,kicker:'贵州省 · '+item.city+' · '+(housing?'人才安居':'人才政策')+' · 资料分级',
 desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||'住房项目或制度·按真实项目核定',
 unit:p?.headlineUnit||'历史规模不等于实时房源',
 limit:outdated?'历史批次/已截止，不得作为当前开放申请':'是否开放申报和实际补助以当期主管部门核验为准',
 review:limitation,qualityLevel:outdated?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'',housing?'真实项目以运营方通知为准':'并非人人享受'],['资格与适用区域',p?.district||h?.district||item.city,'不可跨州县套用']],
 branches,defaultBranch:'eligible',steps:steps(p?.applicationSteps||h?.steps||[]),
 checks:['已查验官方原文和发布时间','已确认本市州和具体行政区、岗位、单位','已核对人才身份、社保及岗位资格限制','已核实历史批次是否截止',...material,'已分别确认原文网址与办事平台','住房已确认当期具体项目和剩余房源（若不能确认则不得宣传有房）'],
 faq:[
 ['当前可以直接申请吗？',outdated?'本条普通申报批次已结束；如有特殊高层次岗位延长申请须逐岗向主管部门核实。':'不能直接认定。应查看主管部门当前受理通知、真实岗位和项目状态。'],
 ['只有硕士或本科学历一定能拿补贴吗？','不一定。部分事项还需要人才认定、指定产业单位、社保、引进年限、住房或人才分类审核。'],
 ['能领取页面所示最高补贴吗？','不保证。金额针对相应人才类别、服务年限及政府审核结果。'],
 ['人才公寓建设套数等于现在有空房吗？','不等于。项目总规模及历史首批释放套数不能推导今天可申请的空房数。'],
 ['政府新闻网页就是报名网站吗？','不是。当前详情只收录原始政策依据，未核实真实事项直达受理入口的须向主管部门确认。'],
 ['条件不符合时还能跨市州申请吗？','不能直接跨市州适用。请重新检索本人实际就业和住房属地的独立政策。'],
 ['HHBA负责办理或保障审核成功吗？','不负责。本站提供政策公开资料索引，最终依主管部门规定与实际审批。']],
 sources:[[p?.sourceName||'政府住房及人才项目公告',item.sourceUrl]],
 officialLabel:'政府事项直达办理入口待核实',officialNote:limitation,
 contacts:[],listPath:'/talent-service/list/'+(housing?'housing':'policies')+'/'+encodeURIComponent(item.city),
 detailPath:'/talent-service/'+(housing?'housing':'policy')+'/'+encodeURIComponent(item.id)
 };
}
