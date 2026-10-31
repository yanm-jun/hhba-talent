import type {CompleteGuide,GuideBranch,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {NINGXIA_5_CITIES,NINGXIA_POLICY_RECORDS} from './ningxiaPolicyRecords.ts';
import {NINGXIA_HOUSING_RECORDS} from './ningxiaHousingRecords.ts';
export {NINGXIA_5_CITIES} from './ningxiaPolicyRecords.ts';
export function ningxiaGuideUrl(kind:'policy'|'housing',id:string):string{
 return '/talent-service/policy-guide-preview/ningxia/'+kind+'/'+encodeURIComponent(id);
}
const FAQs:[string,string][]=[
 ['宁夏2026每月500元生活补贴，是5个城市各发一份吗？','不是。2026年自治区统一实施同一项基层中小微企业就业补贴，按参保地在各市县申领，全区共5000名额，每人每月500元、最长12个月。'],
 ['应届生毕业后进入什么企业才能申请500元？','应于2026年应届毕业，进入自治区县市区或街道乡镇的合规中小微企业依法签劳动合同、缴纳社保满一个月；申领到2026年12月31日止。'],
 ['事业单位招聘计划人数是否等于现在还有岗位？','不是。过去的招聘岗位数、已公布入围名单和当前真实可报名岗位是不同概念，过期旧批次不能再报名。'],
 ['企业一次性扩岗补贴能由毕业生个人直接领取吗？','不能。石嘴山市2026年8月公开的1500元扩岗补助的收款主体是满足招录参保条件的企业。'],
 ['银川经开区青年免租公寓和20%—50%租金减免能叠加吗？','不能自行认定。两者属于不同制度、不同人才类别及兑现条件，是否互斥必须由经开区人才住房主管部门和运营机构核验。'],
 ['人才购房补助最高额是不是人人都能拿？','不是。需要通过当地引进人才认定、服务考核、首套房产等条件；购房50%比例及人才等级封顶不是固定发钱。'],
 ['石嘴山四个具名公租房小区是现时可入住的项目吗？','公示说明这些小区有已入住承租户参加2026租金减免，不能证明2026年11月仍有可出租空房。'],
 ['中卫2024年保租房免租条款现在是否仍有效？','原中卫市2024试行办法明文截止2026年5月31日，2026年11月应找续期或新正式办法，不能按旧条款承诺免租。'],
 ['2026年公租房征求意见稿能直接当作准入收入标准吗？','不能。中卫2026年收入门槛调整尚属公开征求意见，最终生效条件必须以政府正式有效文本为准。'],
 ['公租房、人才公寓、配售房是否可同时享受？','多数住房支持有互斥或退出要求；吴忠配售型保障房规定一户限购一套、已享政策住房应按规定退出或不能再申请。'],
 ['是否可以跨吴忠利通区、固原原州区和其他县区套用资格？','不能。市级与区县管理及服务范围不同；实际住房、户籍、参保、就业和家庭信息都需按项目属地核实。'],
 ['住房文件里的在建套数、保障目标和历史小区是否代表今天空房？','不代表。建设计划、已承租小区、年度财政目标和实时可选房号必须严格区别；只有运营方的实时公开配租证明才可据以申请。'],
 ['宁夏一件事办理是否代表HHBA可以代我审核？','不代表。HHBA提供政府资料和入口索引，实际资质、资金兑付与配租由宁夏政务服务及其授权部门审核。']
];
export function buildNingxiaGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?NINGXIA_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?NINGXIA_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const data=p||h!,today=new Date().toISOString().slice(0,10);
 const archive=p?Boolean(p.temporal!=='policy'||p.deadline&&p.deadline<today):Boolean(h?.applicationEnd&&h.applicationEnd<today);
 const caveat=p?.reviewNote||h?.statusNote||'应以最新官方办理资料核验';
 const materials=p?.materials?.length?p.materials:[
  '身份证、婚姻状况及共同家庭成员关系证明（按住房对象实际需要）',
  '正式岗位就业合同、人才类别学历学位、工商信息、缴保材料（对应对象）',
  '家庭住房产权查询、收入证明、其他政策住房互斥说明或实际租赁合同',
  '有效住房申请表、现行配租项目与运营单位要求的指定材料'];
 const actions=p?.applicationSteps?.length?p.applicationSteps:h?.steps||[];
 const steps:GuideStep[]=actions.map((action,i)=>({
  title:['核验文件与年份','核验真实申请对象','准备对应专项材料','确认有效受理渠道','审批公示与实际兑现'][i]||'核实后续流程',
  why:['政策存在不等于今天开放，历史招录、旧规和征求意见稿需明确降级','不同市县区和人才类别不能随意跨区域领取最高待遇','每项政策材料应依当期政府办事清单，而不能只凭本站一般建议','政府公开文章未必是报名入口，住房金额和真实房源需运营方证实','提交申请不等于审批成功、资金到账或实际取得房号'][i]||'以主管部门批准流程为准',
  action,done:'本人已通过当期官方文件或实际主管部门确认执行状况；尚未取得证明时保留待核实'
 }));
 const branches:Record<string,GuideBranch>={
 eligible:{label:p?.payoutTo==='用人单位'?'有资格的申请企业':'可能符合的个人或家庭',desc:p?.targetGroup||h?.eligibility||'',
  conditions:[p?.eligibility||h?.eligibility||'','申请人工作居住、企业注册及社保属地符合本条明确范围','不得同时领取互斥的补贴、现时存在正式有效的办理条件'],materials,warning:caveat},
 other:{label:'条件不符或其他市县区',desc:'不得套用同省其他地市的引进人才资金和配售住房',
  conditions:['区别自治区全区统一政策和各市县专门资金','历史招聘和已到期试行规则不得作为现时待遇承诺','公租房货币补贴与人才公寓、配售房不可随意叠加'],materials:['真实就业/居住属地证明','本人适用类别及有效公告'],warning:caveat},
 verify:{label:'需要先核实房源/入口/实付标准',desc:'必须在主管部门确认真实可办理后再填写个人申请',
  conditions:['核对生效和到期日期、征求意见稿不能作为生效细则','住房需核实真实房号、项目租价、申请截止和空房','由政府正式办事系统或授权运营方核实申报材料'],materials:['最新政府正式管理细则与项目公告','有效办理入口、审核凭证及实际住房信息'],warning:caveat}
 };
 return {
 city:data.city,title:data.title,kicker:'宁夏回族自治区 / '+data.city+' / '+(p?'人才及就业政策':'住房保障')+' V6',
 desc:p?.summary||h?.statusNote||'',
 support:p?.headlineAmount||(h?.kind==='project'?'现有小区证据':'住房管理制度与项目线索'),
 unit:p?.headlineUnit||'已承租项目不代表实时空房',
 limit:archive?'历史批次或原规范已截止；不应再沿用旧申请窗口':p?.deadline?'原公告申请截止 '+p.deadline+'；应确认是否调整':'最新申请入口、房号、资金与租金均待官方核实',
 review:caveat,qualityLevel:archive?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'当期核定','不得按最高额直接认定实际权益'],['适用属地',p?.district||h?.district||data.city,'自治区统一、城市和县区政策分别核验']],
 branches,defaultBranch:'eligible',steps,checks:['已核对政府正式来源、日期及现行效力','已区分自治区统一补贴与市县自有项目','已确认政策是有效条款、征求意见还是已失效规则','已核对本人和家庭、用人单位资格及住房互斥',...materials,'已取得对应的真实官方申报渠道','如申请住房已确认项目真实空余房号及现行价格'],
 faq:FAQs,sources:[[p?.sourceName||'政府住房文件或公开保障公示',data.sourceUrl]],
 officialUrl:p?.applicationUrl||h?.applyUrl,officialLabel:p?.applicationUrl||h?.applyUrl?'政府申报平台（实际状态仍须核对）':'官方具体事项申请入口待核实',
 officialNote:caveat,contacts:[],
 listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(data.city),
 detailPath:'/talent-service/'+(p?'policy':'housing')+'/'+encodeURIComponent(data.id)
 };
}
