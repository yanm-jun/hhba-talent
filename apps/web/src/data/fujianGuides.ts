import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
import type {TalentHousingRecord} from './talentHousingRecords.ts';
import type {CompleteGuide,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {FUJIAN_POLICY_RECORDS} from './fujianPolicyRecords.ts';
import {FUJIAN_HOUSING_RECORDS} from './fujianHousingRecords.ts';
export const FUJIAN_9_CITIES=["福州","厦门","莆田","三明","泉州","漳州","南平","龙岩","宁德"] as const;
export const fujianGuideUrl=(kind:'policy'|'housing',id:string)=>'/talent-service/policy-guide-preview/fujian/'+kind+'/'+encodeURIComponent(id);
const guides=(actions:string[]):GuideStep[]=>actions.map((action,index)=>({title:['辨别属地与政策版本','核实本人或单位资格','准备所需真实材料','寻找当前业务入口','查询真实审核结果'][Math.min(index,4)],
 why:['省级与市级不能混淆，过期报名不能冒充现行。','政府政策明确限制人群、区域、合同及住房条件，不能只凭学历。','最高金额或历史公寓规模不等于实际待遇和实时空房。','政府新闻与真正申报表单不同，必须核对当期业务。','只有主管部门结果、公示与合同能证明实际获批。'][Math.min(index,4)],
 action,done:['已确认本条官方来源和适用地域，不混用其他市县政策','已经逐项核对个人/用人单位所需身份与排除条件','已准备官方要求的材料并列明缺失项','已找到本期有效官方事项，或明确申报已结束/待核','已取得正式受理/审核结果，未获批则不预认定'][Math.min(index,4)]}));
const faq=(condition:string,caution:string,apply:string,isHousing:boolean):[string,string][]=>[
 ['是不是所有毕业生都能申请？','不能。'+condition],
 ['为什么九个城市出现同一省级政策？','此类是福建省统一政策按注册地、就读地或实际业务归属地展示，不是各市分别出台的新政策。'],
 ['2026年创业省级资助还能报名吗？','该项目2026年4月15日已截止，9月公布结果，需关注后续新年度通知。其他事项不得以此日期判断。'],
 ['最高补贴能保证领取吗？','不保证。需满足真实审核、项目类别及互斥条件。'+caution],
 ['如何查询现在是否受理？',apply+'；政策原文不等于正在开放的线上表单。'],
 ['人才公寓一定有房吗？',isHousing?'本条住房为制度/历史项目介绍，不是当前实时空房，须查具体项目公告和运营机构。':'如涉及住房，规划套数、历史配租和实时可租数必须单独核验。'],
 ['需要向平台提供身份证吗？','不需要。本站只做公开信息自查，请到政府官方系统提交合法所需资料。'],
 ['不同市、区的细则能同时领取吗？','不能自动叠加，须按政府对属地、家庭住房和重复补贴的限制分别核实。']
];
function forPolicy(p:TalentPolicyRecord):CompleteGuide{
 const old=p.temporal!=='policy'||Boolean(p.deadline&&p.deadline<'2026-10-31');
 const note=p.reviewNote||'当期办理状态待核';const mats=p.materials||[];
 return {city:p.city,title:p.title,kicker:'福建省 V5.1 · '+p.category,
 desc:p.summary,support:p.headlineAmount||'按具体审核',unit:p.headlineUnit||'不同人才类别有别',
 limit:old?'历史已结束批次，不可直接申报':p.deadline?'官方申报截止 '+p.deadline:'当前受理与资格以主管部门核准',
 review:'2026-10-31政策资料核验；完整A级需要独立取证与人工验收',qualityLevel:old?'C':'B',
 amounts:[[p.category,p.benefit,p.headlineUnit||'适用受理规则'],['适用人群',p.targetGroup||'',p.scope||'省级属地'],['政策限制',note,p.published+' 政府发布/公开日期']],
 branches:{eligible:{label:'核对本人或单位申领条件',desc:p.targetGroup||'',conditions:[p.eligibility,note],materials:mats,warning:note},
 other:{label:'不满足或有特殊情况',desc:'不跨市、跨区或跨人才类别套用。',conditions:[p.eligibility,'如本期截止，不可用历史申报地址强行提交。','用人单位补贴、个人补贴及政策性住房不能擅自互加。'],materials:['官方有效文号与原文',...mats.slice(0,2)],warning:note}},
 defaultBranch:'eligible',steps:guides(p.applicationSteps||[]),checks:['已核对具体城市和省级/市级政策性质','已核对申请批次起止日','已确认本人/企业申领类别、劳动关系与参保要求','已确认资金领取人和待遇是否互斥',...mats,'已确认原文链接与申请事项深链不同'],
 faq:faq(p.eligibility,note,p.application,false),sources:[[p.sourceName,p.sourceUrl]],
 officialUrl:p.applicationUrl,officialLabel:p.applicationUrl?'公开政府业务平台（需查当前申报事项）':'当前独立事项申报入口待核实',officialNote:p.application,contacts:[],
 listPath:'/talent-service/list/policies/'+encodeURIComponent(p.city),detailPath:'/talent-service/policy/'+encodeURIComponent(p.id),otherRoute:'/talent-service/city/'+encodeURIComponent(p.city),otherLabel:'返回城市政策'};
}
function forHousing(h:TalentHousingRecord):CompleteGuide{
 const mats=['具体项目与家庭身份/住房证明（按项目公式公告）','真实就业或人才认定及区县适用条件','有效租赁或配售资格证明（按官方要求）','项目主管部门当前房源、租金/售价、受理批次核验记录'];
 return {city:h.city,title:h.title,kicker:'福建省 V5.1 · 人才安居',desc:h.statusNote,
 support:h.kind==='project'?'具体项目':'住房保障制度/项目服务',unit:'不是2026实时空房',limit:'当批申请、租价和资格待官方核实',
 review:'2026-10-31住房资料核验，未取得A级独立项目认证',qualityLevel:h.applicationEnd&&h.applicationEnd<'2026-10-31'?'C':'B',
 amounts:[['住房类型',h.housingCategory||'住房服务','不是实时房源'],['区域/位置',h.address,h.district],['历史规模',h.units,'不代表当前空房'],['费用与支持',h.rent,'以主管部门当前具体项目为准']],
 branches:{eligible:{label:'拟申请住房保障',desc:h.eligibility,conditions:[h.eligibility,h.statusNote],materials:mats,warning:h.statusNote},
 other:{label:'无当前批次或条件未核',desc:'此住房记录仅供制度和材料准备自查。',conditions:['必须分清配租型保租房、公共租赁房和配售型住房。','历史项目规模不等于实时可租可售空房。','如具体项目暂未公告，不代表已有住房等待领取。'],materials:mats,warning:h.statusNote}},
 defaultBranch:'eligible',steps:guides(h.steps),checks:['已确认该条是制度还是具体楼栋','已核对所在市县及家庭住房状况','已确认租赁或购房类型与互斥限制','已核验真实独立项目地址与运营单位','已核验当期房源、价格与有效申请期',...mats],
 faq:faq(h.eligibility,h.statusNote,h.steps.join('；'),true),sources:[['官方住房制度/市级项目报道',h.sourceUrl]],officialUrl:h.applyUrl,
 officialLabel:h.applyUrl?'住房申报服务平台':'尚未核实当期独立房源申报地址',officialNote:h.statusNote,
 contacts:h.contactPhone?[{name:'政府公开住房业务咨询',phone:h.contactPhone}]:[],contactSource:h.contactSourceUrl,
 listPath:'/talent-service/list/housing/'+encodeURIComponent(h.city),detailPath:'/talent-service/housing/'+encodeURIComponent(h.id),otherRoute:'/talent-service/city/'+encodeURIComponent(h.city),otherLabel:'返回城市政策'};
}
export function getFujianGuide(kind:string,id:string):CompleteGuide|undefined{
 if(kind==='policy'){const p=FUJIAN_POLICY_RECORDS.find(x=>x.id===id);return p?forPolicy(p):undefined;}
 if(kind==='housing'){const h=FUJIAN_HOUSING_RECORDS.find(x=>x.id===id);return h?forHousing(h):undefined;}
 return undefined;
}
export const FUJIAN_GUIDE_COUNT=FUJIAN_POLICY_RECORDS.length+FUJIAN_HOUSING_RECORDS.length;
