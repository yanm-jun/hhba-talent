import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
/** 西藏V6：自治区统一制度按查询地市明确标注；不虚构地市专属补助。2026-10-31证据截面。 */
export const XIZANG_7_REGIONS=['拉萨','日喀则','山南','林芝','昌都','那曲','阿里'] as const;
export type XizangRegion=typeof XIZANG_7_REGIONS[number];
const MARKET='https://hrss.xizang.gov.cn/zcfg/jycy/202508/t20250805_493513.html';
const JOBS='https://ldjy.xizang.gov.cn/xwzx/gsgg/202607/t20260721_550770.html';
const THREE='https://hrss.xizang.gov.cn/xwzx/tzgg/202610/t20261011_562076.html';
const REGIONS:{city:XizangRegion;slug:string;phone:string;office:string}[]=[
 {city:'拉萨',slug:'lhasa',phone:'0891-6364490',office:'拉萨市城关区夺底北路17号 · 高校毕业生就业服务中心'},
 {city:'日喀则',slug:'rikaze',phone:'0892-8835301',office:'桑珠孜区黑龙江路22号 · 劳动就业服务管理局'},
 {city:'山南',slug:'shannan',phone:'0893-7826234',office:'山南市徽韵科技文化中心14层 · 高校毕业生就业服务中心'},
 {city:'林芝',slug:'linzhi',phone:'0894-5888775',office:'林芝市巴宜区青年路3号 · 高校毕业生就业指导服务中心'},
 {city:'昌都',slug:'changdu',phone:'0895-4843652',office:'昌都市卡若区茶马南路15号 · 就业创业服务中心'},
 {city:'那曲',slug:'naqu',phone:'0896-3721011',office:'那曲市拉萨南路18号 · 人社局就业服务中心'},
 {city:'阿里',slug:'ali',phone:'0897-2824171',office:'阿里地区狮泉河镇陕西路56号 · 劳动就业服务中心'}
];
function p(region:typeof REGIONS[number],key:string,values:Omit<TalentPolicyRecord,'id'|'city'|'district'|'scope'|'reviewedAt'|'materials'|'applicationSteps'|'keywords'|'targetGroup'|'reviewNote'>&Partial<Pick<TalentPolicyRecord,'district'|'scope'|'materials'|'applicationSteps'|'keywords'|'targetGroup'|'reviewNote'>>):TalentPolicyRecord{
 const enterprise=values.payoutTo==='用人单位';
 return {
  id:'xz-'+region.slug+'-'+key,city:region.city,district:values.district||region.city+'行政区域（自治区共性政策须按本地受理口径核查）',scope:values.scope||'全市',reviewedAt:'2026-10-31',
  materials:values.materials||[
   '本人身份证及毕业证、学籍或学历学位核验资料（以该项目对象要求为准）',
   '与就业或服务项目有关的劳动合同、参保缴费及所在单位证明（按该事项适用）',
   '符合该项目的就业失业登记、人才类别或困难身份材料（按当期公告提供）',
   '主管部门正式申请表、承诺书及其他当期要求的材料'],
  applicationSteps:values.applicationSteps||[
   '查阅本条所列自治区官方制度原文，确认适用对象、政策版本及本地执行细则',
   '按本人户籍生源、学历毕业年限、就业地点、合同参保条件逐项核验；企业补助与个人补助不可互换',
   '按照公告列明的主体准备身份证明、劳动合同、毕业证和项目指定附件，不上传无关敏感资料',
   '联系'+region.office+'（'+region.phone+'）核验本年度受理窗口、是否仍可申请及真实提交渠道',
   '经确认仍在办理后通过主管部门指定路径提交，跟踪资格审核、公示与兑现结果；不得把政策介绍当作获批证明'],
  keywords:values.keywords||[region.city,'西藏','自治区统一政策','2026','高校毕业生'],
  targetGroup:values.targetGroup||(enterprise?'在'+region.city+'符合本政策申报条件的用人单位':'符合本条限定条件的高校毕业生或服务对象'),
  reviewNote:values.reviewNote||'本条属西藏自治区统一规定的'+region.city+'属地查询入口，不代表'+region.city+'另发一份同额地方补助。官方原文可查，但当期办理入口、个人资格及实际申报窗口需向属地经办机构核验；办理入口待核实。',
  ...values,
  materials:values.materials?.length?values.materials:[
   '身份证明及学历学位/技能资格材料（按本事项要求）','就业或服务所在单位及社保合同证明（按实际适用）','本人所符合的人才类别、就业或购房项目资格凭证','该事项正式公告要求的申请表与补充附件'],
  applicationSteps:values.applicationSteps?.length?values.applicationSteps:[
   '查阅该条所附官方文件及相关附件，确认是否已截止或属于历史批次',
   '逐项核验'+region.city+'真实属地、学历、生源、合同、购房或岗位条件',
   '按实际申报主体准备身份证、学历证明、合同社保及公告要求的其他材料',
   '联系'+region.office+'，通过'+region.phone+'核实当前申报渠道及办理时间',
   '通过主管部门正式入口办理、参加资格审核并依据公示结果确认，不以资料介绍代替批准']
  ]
 };
}
const shared:TalentPolicyRecord[]=REGIONS.flatMap(region=>[
 p(region,'market-2025',{
  title:'【自治区统一】高校毕业生市场就业创业补贴（'+region.city+'受理核验）',category:'就业创业',
  summary:'2025年西藏自治区人社厅与财政厅发布市场就业创业补贴实施细则；2026年自治区本级仍有审核公示。这里是自治区统一制度在'+region.city+'的查询指引，不是该地市单独追加的现金补贴。',
  benefit:'按照2025年实施细则的就业、创业等不同项目核算；具体生活、住房、社保、创业扶持及支付比例应以所申请条款的正式文件和本地经办核定为准。本页不以历史旧标准虚构2026个人必得金额。',
  eligibility:'须根据2025版实施细则逐项区分西藏籍或我区生源高校毕业生、毕业年限、区内外市场就业、劳动合同、社会保险、创业实际经营及用人单位性质；企业领取部分不等于个人奖金，居住'+region.city+'本身也不代表全部项目均符合。',
  application:'先核对西藏自治区2025年实施细则及2026年本地经办指引，再向'+region.office+'确认个人与企业适用项目和申报窗口。',
  department:'西藏自治区人社厅、财政厅及'+region.city+'就业服务机构',published:'2025-08-05',sourceUrl:MARKET,sourceName:'西藏自治区人社厅、财政厅《高校毕业生市场就业创业补贴实施细则》',temporal:'policy',payoutTo:'个人',
  headlineAmount:'依适用项目核定',headlineUnit:'自治区统一制度·非地方另加金额',
  targetGroup:'符合市场就业、创业分类条件的西藏相关高校毕业生及相应申报主体',
  keywords:[region.city,'西藏','市场就业','创业','补贴','毕业生','自治区统一']}),
 p(region,'three-support-2026',{
  title:'【自治区统一】2026“三支一扶”基层服务待遇与招募核验（'+region.city+'）',category:'就业创业',
  summary:'西藏2026年“三支一扶”公告列出基层服务人员待遇，含二至四类区工作生活补贴及安家、绩效、保险与交通支持。招募计划不是所有毕业生自动得到的现金福利，报名状态须以当期公告为准。',
  benefit:'二类区3000元/人·月、三类区3500元/人·月、四类区4000元/人·月；本科、研究生每月分别增加100元、200元。服务满6个月一次性安家费3000元，并有绩效考核与休假路费等按公告核算；不是所有档次可以相加领取。',
  eligibility:'仅面向符合2026年西藏“三支一扶”招募对象、岗位专业、学历年龄、身体条件等全部要求，并经正式招募录取、履行基层服务的人员。地区类别与录用岗位须按官方岗位表确定，不能把'+region.city+'行政区整片都认成最高四类区，也不能将服务待遇发给未录取求职者。',
  application:'查看2026年官方招募计划、资格与岗位表；核实具体截止、考试安排和录用状态，录用后按服务单位管理规则办理。',
  department:'西藏自治区人社厅及'+region.city+'项目主管部门',published:'2026-10-11',sourceUrl:THREE,sourceName:'西藏自治区人社厅《2026年高校毕业生“三支一扶”计划招募公告》',temporal:'policy',payoutTo:'个人',headlineAmount:'¥3,000—4,000/月起',headlineUnit:'按地区类别·仅限正式录用服务',
  keywords:[region.city,'三支一扶','基层服务','安家补贴','2026'],
  targetGroup:'2026年符合岗位条件并正式录用的“三支一扶”服务人员',
  reviewNote:'招募公告与已录用服务期间的政策待遇必须分开理解；报名截止、最新录用名单和该地区岗位类别需逐项核验。不是无需录用就能领的普惠补贴。办理入口待核实。'}),
 p(region,'public-employment-2026',{
  title:'【属地公共服务】2026高校毕业生求职登记、岗位推荐与就业咨询（'+region.city+'）',category:'就业创业',
  summary:'自治区就业服务中心2026年7月公布七地市公共就业机构联系方式，支持高校毕业生求职登记、就业指导、公共招聘、培训与见习信息查询。此为实际公共就业服务，不是现金补贴。',
  benefit:'公共就业登记与职业指导服务，公开岗位推荐、就业见习和培训信息查询；政府未承诺所有求职者有固定补贴、保证入职或固定岗位名额。',
  eligibility:'以拟就业或服务属地、求职登记信息和本人就业状态为基础，按公共就业机构要求办理。高校毕业生可咨询岗位、培训和政策兑现，但不同补贴另有毕业年限、户籍生源、合同社保及困难身份等具体条件，不能由登记成功直接推导补贴资格。',
  application:'联系'+region.office+'，电话'+region.phone+'，按官方渠道登记求职并核对现行岗位与培训服务。',
  department:region.office,published:'2026-07-21',sourceUrl:JOBS,sourceName:'西藏自治区就业服务中心《致2026届西藏籍高校毕业生的一封信》及七地市机构表',temporal:'policy',
  payoutTo:'非现金服务',headlineAmount:'公共就业服务',headlineUnit:'非现金补贴·不保证岗位',
  materials:['个人身份证明及本人联系方式（按官方实名登记要求）','学历、毕业证或学信网核验资料','个人简历、技能或专业资格证书（岗位匹配使用）','求职方向、就业状态及公共就业机构指定材料'],
  applicationSteps:['打开自治区就业服务中心2026年公布的官方七地市机构表，找到'+region.city+'对应的经办单位','通过官方就业平台或电话'+region.phone+'了解当前线上线下受理时间和实名求职登记方式','在正式平台填写本人求职意向、学历技能及就业状态，只在可信的政府渠道提交个人信息','向工作人员咨询'+region.city+'近期真实岗位、就业见习和职业培训服务，并逐岗核实截止时间','如需资金补助，另行进入具体补贴事项核对适用资格和兑现流程；公共服务不等于核准现金补贴'],
  keywords:[region.city,'西藏','公共就业','求职登记','招聘信息','就业咨询','人才服务'],
  targetGroup:'到'+region.city+'求职的高校毕业生等公共就业服务对象',
  reviewNote:'2026年7月自治区就业中心明确公布'+region.city+'服务机构地址与电话（'+region.phone+'）；具体岗位与培训实时变动，公共就业服务不是人才津贴。'})
]);
const localSpecs:{
 city:XizangRegion;id:string;title:string;category:TalentPolicyRecord['category'];
 sourceUrl:string;published:string;sourceName:string;summary:string;benefit:string;eligibility:string;
 temporal:TalentPolicyRecord['temporal'];deadline?:string;payoutTo:TalentPolicyRecord['payoutTo'];headlineAmount:string;headlineUnit:string;targetGroup:string;
 materials?:string[];applicationSteps?:string[];reviewNote:string
}[]=[
 {city:'拉萨',id:'purchase-2026',title:'2026拉萨新建商品住房购房补贴：三区基础补贴与高校毕业生专项',category:'购房补贴',
  sourceUrl:'https://zfjs.lasa.gov.cn/zjj/wjzl/202607/2e3fd0575d7b4c64be199a28059b028d.shtml',published:'2026-07-06',sourceName:'拉萨市住建局2026-07-06购房补贴实施细则',
  summary:'2026年6月1日至12月31日新建商品房网签备案实行分区基础补贴与高校毕业生专项叠加；2025年1月至2026年5月购房属于另一档次。必须确认专项资金余额。',
  benefit:'堆龙德庆区、柳梧新区、达孜区：自治区房款3%最高5万＋市级5.2%最高5万；城关、文创园、经开、曲水、墨竹工卡为自治区3%最高5万。全日制专科/本科专项3万、硕士4.5万、博士6万；三区合计单套最高16万、其他片区最高11万。不得超过各档上限，实行一人一套一补。',
  eligibility:'须于政策适用期间在拉萨市行政范围购买符合规定的新建商品住房并完成网签备案；高校毕业生专项仅对规定期限内符合全日制学历等条件者，不适用于非全日制学历。需按购房所在地区、成交价、网签日期核定。市级资金按申请先后兑现且用完即止，不能只凭学历承诺最高16万元。',
  temporal:'policy',deadline:'2026-12-31',payoutTo:'个人',headlineAmount:'最高¥160,000/套',headlineUnit:'仅指定三区·其他片区最高11万',
  targetGroup:'2026规定窗口购买拉萨合规新建商品住宅者及符合条件的全日制高校毕业生',
  materials:['购房人有效身份证明及一类银行卡','已完成网签备案的新建商品房买卖（预售）合同','首付款或分期付款缴存凭证及监管账户资料','申请高校毕业生专项的毕业证与学籍核验资料','市住建局通过萨都办要求的其他材料'],
  applicationSteps:['先按网签备案日期判断属于2025-01-01至2026-05-31旧口径或2026-06-01至12-31新口径','核实住宅地块所在片区、房款总价及自治区3%与市级5.2%分段封顶，不把金额直接相加成固定到手数','核对全日制学历、毕业日期和此前是否使用过高校毕业生专项补贴及一人一套一补限制','由房地产开发企业归集身份证、网签合同、购房款凭证、银行卡及学历资料，经萨都办政务平台提交','关注市房产管理部门审核、公示和财政资金是否用尽；未经核定不得认定仍能申领'],
  reviewNote:'2026年文件明确拉萨市级购房补贴资金用完即终止；尚未核实截至2026-10-31余额与实时报名状态。即使日期未截止也不能宣称肯定可申请。'},
 {city:'日喀则',id:'public-recruitment-2026',title:'2026日喀则事业单位高校毕业生招聘与已录用派遣（历史批次）',category:'就业创业',
  sourceUrl:'https://rikaze.xzdw.gov.cn/fbt/gsgg_367/202609/t20260920_697245.html',published:'2026-09-20',sourceName:'中国共产党日喀则市委员会转发市人社局2026年聘用人员派遣通知',
  summary:'2026年日喀则事业单位招聘已进入9月22日聘用人员派遣阶段。本记录仅保留正式历史招聘信息与下一批咨询路径，不把已经派遣的岗位列为可报名。',
  benefit:'本次是事业单位公开招聘与已录用人员派遣事项，不是人才津贴；通过考试、资格审查、录用与报到后依具体岗位聘用合同执行待遇。',
  eligibility:'2026年度相应公告规定的我区生源或其他符合招聘身份、学历、专业、资格与考试条件的报考人员；2026年9月派遣仅针对本次已聘用人员，不是所有待业毕业生可参加。申请新的岗位必须等待新公告。',
  temporal:'past-window',deadline:'2026-09-22',payoutTo:'非现金服务',headlineAmount:'2026历史招聘',headlineUnit:'9月派遣结束·非现金补贴',
  targetGroup:'本批已录用人员及查找下一批日喀则事业单位招聘的毕业生',
  reviewNote:'2026-09-22派遣已过期，不允许展示为正在报名；应关注官方下一批职位表、报名窗口与资格要求。'},
 {city:'山南',id:'talent-month-2026',title:'2026山南人才月：引进人才购房补贴兑现及人才服务联盟（实绩公示）',category:'购房补贴',
  sourceUrl:'https://zjj.shannan.gov.cn/xwzx/snyw/202609/t20260914_176555.html',published:'2026-09-14',sourceName:'山南市住建局转载自治区政府2026山南人才月官方报道',
  summary:'2026年山南人才月官方报道已落实首批引进人才购房补贴，并设人才服务联盟；这是兑现事实，不是所有在山南毕业生均可领或一份新的公开普惠补助办法。',
  benefit:'报道确认有首批引进人才购房补贴兑现及人才服务联盟，但未披露普遍适用的学历分档、单人固定金额、申请截止或当前入口。本页不推断每人金额，也不把历史兑现当作新批次。',
  eligibility:'受益人员应属于山南市已经认定且纳入相应购房补贴兑现范围的引进人才；需满足该批次市级人才分类、引进服务、购房和互斥条件。报道没有足够证据支持所有硕博本科或未引进人员能申请，须由山南人才主管部门提供实施细则。',
  temporal:'historical',payoutTo:'个人',headlineAmount:'历史兑现已确认',headlineUnit:'具体申请资格及金额待核实',
  targetGroup:'经山南市正式认定、且符合特定人才购房补贴项目的人才',
  reviewNote:'目前仅核实2026年9月历史兑现报道；未找到面向社会当前申报的完整正式办法及金额分档，绝不按报道推算个人待遇。办理入口待核实。'},
 {city:'林芝',id:'guangdong-recruitment-2026',title:'2026广东事业单位面向西藏籍少数民族毕业生专项招聘（林芝受理·历史批次）',category:'就业创业',
  sourceUrl:'https://hrss.xizang.gov.cn/xwzx/tzgg/202610/t20261015_562705.html',published:'2026-10-15',sourceName:'西藏自治区人社厅2026广东事业单位专项招聘正式公告',
  summary:'2026广东事业单位专项招聘经林芝市人社局初审，报名为10月21日9:00至10月27日18:30；这是有截止日期的招录公告，不是个人现金补贴。',
  benefit:'符合资格并经笔试面试录用的人员按广东对应事业单位岗位待遇执行；该公告没有承诺所有西藏籍毕业生可领取额外固定现金补贴。',
  eligibility:'需满足公告规定的西藏籍少数民族高校毕业生身份以及岗位学历、专业、资格、年龄等条件，通过林芝市人社局资格初审、笔试、复审与面试。不是所有林芝居住者自动可报；2026年10月27日后不得误报为开放。',
  temporal:'past-window',deadline:'2026-10-27',payoutTo:'非现金服务',headlineAmount:'2026历史招录',headlineUnit:'报名已于10月27日结束',
  targetGroup:'符合2026广东事业单位专项招聘岗位要求的西藏籍少数民族高校毕业生',
  reviewNote:'2026-10-27 18:30报名截止，11月笔试等后续安排须看林芝人社公告；不能提供旧邮箱作为现时报名入口。'},
 {city:'昌都',id:'fujian-recruitment-2026',title:'2026福建省定向招聘32名昌都籍毕业生（历史批次）',category:'就业创业',
  sourceUrl:'https://rsj.changdu.gov.cn/cdrsj/c102793/202608/5eedd742835e4d9a928d334f6184806c.shtml',published:'2026-08-18',sourceName:'昌都市人社局2026福建省事业单位援藏定向招聘公告',
  summary:'2026年福建省事业单位定向招聘昌都籍高校毕业生32名，岗位及报名条件须以2026公告附件为准。历史岗位不能在10月继续宣称开放。',
  benefit:'计划招聘32名，录用后按招聘单位岗位待遇执行；该数字为本批计划人数，不是目前仍空缺名额、现金津贴或每人补助金额。',
  eligibility:'本公告定向昌都户籍（高考时户籍昌都）且符合大专及以上学历及岗位详细要求的毕业生；还应符合国家事业单位招聘通用条件、指定专业与资格。其他地市毕业生不得直接认为可以套用，实际申请期需以当批官方公告为准。',
  temporal:'historical',payoutTo:'非现金服务',headlineAmount:'32个计划名额',headlineUnit:'2026年度历史招录',
  targetGroup:'符合昌都生源/户籍及福建事业单位具体岗位条件的高校毕业生',
  reviewNote:'2026年8月招聘公告作为历史岗位依据；当前是否有后续报名或追加招录未核实，须联系昌都人社部门。'},
 {city:'那曲',id:'jobs-event-2026',title:'2026那曲高校毕业生专项就业服务活动（10月历史场次）',category:'就业创业',
  sourceUrl:'https://chinajob.mohrss.gov.cn/h5/c/2026-10-21/625716.shtml',published:'2026-10-21',sourceName:'中国就业网2026全国城市联合招聘秋季服务活动安排',
  summary:'人社部门全国秋季就业活动计划于2026年10月20日组织那曲高校毕业生专场，属于线下招聘和岗位对接，不是常年开放的资金申请。',
  benefit:'提供现场岗位对接、招聘和公共就业服务；官方活动安排未许诺个人现金补贴或保留固定就业名额。',
  eligibility:'拟参加那曲市高校毕业生专场的求职者应核实具体地点、岗位公告、学历和用人单位要求；2026年10月20日原场次已过去，不能误当成今天正在举办。后续岗位应向那曲公共就业服务机构核实。',
  temporal:'past-window',deadline:'2026-10-20',payoutTo:'非现金服务',headlineAmount:'10月20日已举办',headlineUnit:'历史招聘会·非补贴',
  targetGroup:'参加2026年那曲高校毕业生招聘活动的合资格求职青年',
  reviewNote:'10月20日活动已结束；这里仅作为2026年本地服务实绩和后续服务入口，不复用旧场次报名。'},
 {city:'阿里',id:'recruitment-2026',title:'2026阿里地区事业单位招聘高校毕业生：当地公告与进度查询',category:'就业创业',
  sourceUrl:'https://www.al.gov.cn/gk/zdlyxxgk/jycy.htm',published:'2026-08-18',sourceName:'阿里地区行政公署就业创业栏目2026事业单位招聘与面试通知',
  summary:'阿里地区政府2026年就业创业栏目列有本年度事业单位公开招聘、8月18日面试通知等公告；本批进展不等于目前开放新报名。',
  benefit:'按公开岗位与事业单位人员招聘管理规定确定待遇；政府栏目未公布适用于全部阿里求职者的统一安家费或生活补贴。',
  eligibility:'须先逐一核对西藏自治区2026事业单位招聘总公告及阿里地区岗位表，确认生源户籍、学历专业、政治资格、考试和体检程序。面试通知仅面向符合本次资格并进入面试的考生；2026原批次不应继续作为现时报名。',
  temporal:'historical',payoutTo:'非现金服务',headlineAmount:'2026年度招聘',headlineUnit:'查询历史公告与新一批',
  targetGroup:'符合阿里地区事业单位岗位和2026公开招聘条件的高校毕业生',
  reviewNote:'2026年8月已有面试安排，当前新的报名窗口未核实；不得把政府栏目页误当直接报名表。'}
];
const locals=localSpecs.map(v=>{
 const region=REGIONS.find(x=>x.city===v.city)!;
 const {city,id,...rest}=v;
 return p(region,id,{...rest,application:'查阅所列2026官方公告及岗位或实施细则，向'+region.office+'核验实际申请资格、历史/当期窗口及必要材料。',department:region.city+'有关人才或就业住房主管部门',
  materials:v.materials||undefined,applicationSteps:v.applicationSteps||undefined,
  keywords:[region.city,'2026',v.title,'政策办理','官方公告']});
});
const naquRentalPolicy:TalentPolicyRecord={
 id:'xz-naqu-2026-rent-incentive',city:'那曲',district:'那曲市各县区按三档核算',title:'那曲2026机关事业单位及基层服务人员租房激励补贴',category:'租房安居',
 summary:'2026年8月自治区政府公开报道，那曲市从6月1日起试行城镇住房租赁激励2年，按实际工作县域给符合条件的机关事业单位职工与基层服务人员发放租房激励，不是所有求职大学生都能领取。',
 benefit:'市本级、色尼区、比如县、索县、巴青县每人每月最高600元；嘉黎县、安多县、聂荣县500元；班戈县、申扎县、尼玛县、双湖县400元。本人实付租金低于档位按实付计算，合租人员补助总额不得高于总租金；同地夫妻原则上仅一人领取。',
 eligibility:'政策适用人员为全市各级机关、事业单位在编干部职工及三支一扶、西部计划志愿者、公益性岗位、政府购买服务在岗人员等；租赁房屋须是城镇居民合法产权闲置住房，需有有效租赁合同并按规定接受所在单位和主管部门审核。资金先申先审、用完即止，不是毕业证即享受。',
 application:'官方报道指向那曲市人社快办平台（rskbpt.nqrsj.gov.cn），填报申请表、本人身份证与正规租赁合同，所在单位初审、人社复审公示后住建终审，按资金安排发放。',
 department:'那曲市住房和城乡建设局、那曲市人力资源和社会保障局',published:'2026-08-04',sourceUrl:'https://www.xizang.gov.cn/xwzx_406/dsdt/202608/t20260804_552452.html',
 sourceName:'西藏自治区人民政府2026-08-04《政策上线！在那曲租房可以申领补贴了》',temporal:'policy',scope:'全市',
 keywords:['那曲','租房','住房补贴','三支一扶','西部计划','机关事业单位','600','500','400','2026'],
 targetGroup:'那曲符合范围的在编干部职工及在岗基层服务人员',payoutTo:'个人',headlineAmount:'¥400—600/人·月',headlineUnit:'按县区分档/实际月租封顶',
 reviewNote:'2026年6月1日起试行两年；2026-10-31平台是否仍正常受理、专项资金余额以及本人实付租金均需核实。官方报道提供办理平台地址但非本站实时授权结果，办理入口待核实。',
 reviewedAt:'2026-10-31',
 materials:['本人身份证件及有效在岗身份、所在单位资格材料','真实合法的城镇居民私有闲置住房租赁合同','那曲人社快办官方申请表及实际支付租金凭据（依系统要求）','证明住房保障、夫妻异地就业与合租等相关情况的必要材料'],
 applicationSteps:['查阅自治区人民政府2026年8月4日正式政策报道，核对2026年6月1日起试行两年及适用在岗身份','按工作地点核实对应600元、500元或400元档次，核对实付租金低于补贴按实付结算、夫妻同地仅一人的要求','准备身份证、政策申请表、租赁合同和单位证明，不使用虚构房屋合同','通过那曲人社快办平台核实最新受理，按所在单位初审、那曲人社局线上复审流程提交','经不少于5个工作日公示和住建最终核验后统一兑付；若资金用完则不保证到账，咨询0896-3721016']
};
export const XIZANG_POLICY_RECORDS:TalentPolicyRecord[]=[...shared,...locals,naquRentalPolicy];
