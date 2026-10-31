import type {TalentPolicyRecord} from './talentPolicyRecords.ts';

/**
 * 广西独立支线 V5.1：真实自治区政策按属地检索展开，绝不伪装成14份市级独立补贴。
 * 三支一扶2026已于6月16日截止；购房补贴属于2026自治区统一活动。
 * 购房信息来自住建部转发报道（非自治区原始申报细则），故仅 B 基础资料，不授予 A。
 * 只有实证本市差异后，方可引入市级独立项目。核验日 2026-10-31。
 */
type CityContact={city:string;slug:string;phone:string;localPortalHost:string};
export const GUANGXI_CITY_CONTACTS:readonly CityContact[]=[
  {
    "city": "南宁",
    "slug": "nanning",
    "phone": "0771-5381321",
    "localPortalHost": "rsj.nanning.gov.cn"
  },
  {
    "city": "柳州",
    "slug": "liuzhou",
    "phone": "0772-2825735／0772-2807233",
    "localPortalHost": "rsj.liuzhou.gov.cn"
  },
  {
    "city": "桂林",
    "slug": "guilin",
    "phone": "0773-2888156",
    "localPortalHost": "rsj.guilin.gov.cn"
  },
  {
    "city": "梧州",
    "slug": "wuzhou",
    "phone": "0774-3817803",
    "localPortalHost": "rsj.wuzhou.gov.cn"
  },
  {
    "city": "北海",
    "slug": "beihai",
    "phone": "0779-3237022",
    "localPortalHost": "www.beihai.gov.cn"
  },
  {
    "city": "防城港",
    "slug": "fangchenggang",
    "phone": "0770-2823316",
    "localPortalHost": "fcg.gxrc.com"
  },
  {
    "city": "钦州",
    "slug": "qinzhou",
    "phone": "0777-3688396",
    "localPortalHost": "qz.gxrc.com"
  },
  {
    "city": "贵港",
    "slug": "guigang",
    "phone": "0775-4562055",
    "localPortalHost": "rsj.gxgg.gov.cn"
  },
  {
    "city": "玉林",
    "slug": "yulin",
    "phone": "0775-2699221",
    "localPortalHost": "rsj.yulin.gov.cn"
  },
  {
    "city": "百色",
    "slug": "baise",
    "phone": "0776-2841760",
    "localPortalHost": "bs.gxrc.com"
  },
  {
    "city": "贺州",
    "slug": "hezhou",
    "phone": "0774-5136208",
    "localPortalHost": "www.gxhz.gov.cn"
  },
  {
    "city": "河池",
    "slug": "hechi",
    "phone": "0778-2307778",
    "localPortalHost": "rsj.hechi.gov.cn"
  },
  {
    "city": "来宾",
    "slug": "laibin",
    "phone": "0772-4275656",
    "localPortalHost": "lb.gxrc.com"
  },
  {
    "city": "崇左",
    "slug": "chongzuo",
    "phone": "0771-7828636",
    "localPortalHost": "cz.gxrc.com"
  }
];

const THREE_SUPPORT_ORIGINAL="https://chrm.mohrss.gov.cn/announcement/2026%E5%B9%B4%E5%B9%BF%E8%A5%BF%E9%AB%98%E6%A0%A1%E6%AF%95%E4%B8%9A%E7%94%9F%E4%B8%89%E6%94%AF%E4%B8%80%E6%89%B6%E8%AE%A1%E5%88%92%E6%8B%9B%E5%8B%9F%E5%85%AC%E5%91%8A/";
const PURCHASE_MOHURD_REPRINT="https://www.mohurd.gov.cn/xinwen/dfxx/art/2026/art_61b3f16e66854af0bafbb73cb8b5b89a.html";

function historicalThreeSupport(c:CityContact):TalentPolicyRecord{
 return {
  id:'gx-'+c.slug+'-2026-three-support',
  city:c.city,
  title:c.city+' · 2026年广西“三支一扶”基层招募及在岗补贴（报名已结束）',
  category:'就业创业',scope:'年度批次',temporal:'past-window',deadline:'2026-06-16',
  published:'2026-06-09',
  sourceUrl:THREE_SUPPORT_ORIGINAL,
  sourceName:'广西高校毕业生“三支一扶”工作协调管理办公室公告 · 人社部中国人力资源市场网；附件列明'+c.city+'咨询电话',
  summary:'2026年广西全区计划招募1345名高校毕业生赴基层从事支农、支医、支教及乡村振兴工作。'+c.city+'岗位由当地招募公告逐项发布；2026年6月10日至16日报名窗口已关闭，不能继续当作新报名政策。',
  benefit:'通过考试、面试及体检并签订两年服务协议、实际在岗后，工作生活补贴每人每年36000元、交通补贴每人每年500元，服务单位岗位津贴每月不低于600元；新招募且服务满6个月者一次性安家费3000元。金额不可当成所有毕业生普惠补贴。',
  eligibility:'普通高校2024—2026年毕业、大专（含高职）及以上；医疗、农技、水利、林草类部分岗位可扩至2022—2026年毕业。一般33周岁以下，符合特定艰苦边远地区岗位年龄可放宽到35周岁；须符合'+c.city+'当年具体岗位专业、生源、身体、资格及不得报名情形。报名期已过。',
  application:'2026历史办理顺序为：先查'+c.city+'岗位表、在6月10日9时至16日18时期间经当地网上报名（已截止）、资格审核、确认笔试、7月4日笔试、8月1日面试、政审及体检、公示后签两年服务协议。2027年是否续招，须查新的自治区和市级公告。'+c.city+'三支一扶办咨询：'+c.phone+'。',
  department:c.city+'“三支一扶”工作协调管理办公室／广西高校毕业生“三支一扶”工作协调管理办公室',
  targetGroup:'有志参加'+c.city+'基层支农、支教、支医、帮扶乡村振兴并符合对应岗位表的高校毕业生；非全体'+c.city+'毕业生',
  payoutTo:'个人',headlineAmount:'¥36,000',headlineUnit:'每年在岗生活补贴 · 2026历史招募批次',
  reviewedAt:'2026-10-31',
  reviewNote:'2026-06-16报名已截止（C级历史资料）；不可显示仍在招募。2026市级岗位表与个人考试准入须另行核实，不能将全区1345个名额写作'+c.city+'名额。办理入口待核实：下年度及后续批次尚未公布；人社部原文附件仅提供当地公告站点'+c.localPortalHost+'，不将门户首页冒充网上申报表单。',
  keywords:['广西','三支一扶',c.city,'基层就业','支教','支农','支医','毕业生','安家费','2026已结束'],
  materials:[
   '本人身份证件、学历毕业证明（2026报名按公告要求在2026年7月31日前取得）',
   '与'+c.city+'拟报岗位对应的学历、专业及岗位要求证明资料（依当地岗位附件）',
   '考试准考证与资格复审材料、当期公告要求的学历学位或职业资格原件',
   '符合岗位特殊条件时的执业资格、资格证书和其他专项证明（以当年岗位表为准）'
  ],
  applicationSteps:[
   '查看自治区招募公告及'+c.city+'本年度岗位表，核查专业、年龄、生源和工作地要求。',
   '在已结束的2026年6月10日09:00—6月16日18:00期间通过市级指定网上系统填报，仅可报一个岗位。',
   '于2026年6月17日18:00前查询资格审核结果，并在6月18日18:00前按期确认参加笔试。',
   '6月30日12:00后打印准考证，7月4日参加综合知识笔试，按当地要求查询笔试成绩。',
   '7月24日至27日确认面试入围并接受资格复审，8月1日参加结构化面试。',
   '待当地发布拟录用名单并进行不少于5天公示、体检合格后，与服务单位签约并报到。',
   '实际服务过程中核对两年期限、年补贴及6个月在岗安家费，保存服务协议与缴保信息。'
  ]
 };
}

function provincialPurchase(c:CityContact):TalentPolicyRecord{
 return {
  id:'gx-'+c.slug+'-2026-provincial-purchase',
  city:c.city,district:'广西自治区统一活动（'+c.city+'适用性需按房屋所在地核准）',
  title:c.city+' · 2026广西新建商品房购房补贴（自治区政策，非市级独立补助）',
  category:'购房补贴',scope:'全市',temporal:'policy',published:'2026-10-23',
  sourceUrl:PURCHASE_MOHURD_REPRINT,
  sourceName:'住房城乡建设部网站2026-10-23转载“南宁发布”报道；并非自治区补贴实施细则原文',
  summary:'2026年9月25日起广西开展购买新建商品房补贴活动。全区统筹2.72亿元，基础购房补贴每套8000元或10000元，特定人群和换购情形可叠加；据2026年10月23日住建部转载报道，申请由云闪付App“广西消费券专区”受理，预算采取先到先得。'+c.city+'是否有额外市级政策尚未据此证明。',
  benefit:'按房屋合同金额对应基础补贴8000元或10000元；符合卖旧买新、新市民、就业毕业生、灵活就业公积金缴存人员、退役军人、初育或多子女家庭等规定条件的，可叠加相关补贴，符合全部适用规则的单套上限30000元；不是人人可得30000元。',
  eligibility:'应属于自治区2026年新建商品住房活动规定的购房主体、房屋、购房及备案日期范围。是否在'+c.city+'、是否为合格新建商品房、合同总额档位、申请人实际身份、家庭孩次、卖旧买新和房源排除项目，都必须依据自治区正式活动细则及云闪付当前申报页核实。政府转载报道未完整披露全部准入及所需材料。',
  application:'根据住建部2026年10月23日转载报道，应进入云闪付App“广西消费券专区”查找广西新建商品房购房补贴事项；按当期显示的有效时间、房屋所在地、购房合同额、备案与身份材料申报。必须核对真实自治区实施细则，申报与最终核定结果以主管部门和官方系统为准。',
  department:'广西壮族自治区住房和城乡建设厅及房屋所在地住房主管部门／活动经办机构',
  targetGroup:'在2026自治区活动实际覆盖范围内购入合格新建商品房的购房人；部分叠加条件涉及新市民、高校毕业生、退役军人、初育或多子女家庭',
  payoutTo:'个人',headlineAmount:'最高¥30,000',headlineUnit:'全区活动多条件叠加上限 · 财政资金先到先得',
  reviewedAt:'2026-10-31',
  reviewNote:'B级：住建部政府网站转载南宁发布消息，非自治区实施办法原文；原始细则、'+c.city+'地区适用范围、合格合同备案窗口、财政资金余额和申请材料全部须到自治区主管部门及云闪付当期事项核对。办理入口待核实：目前仅确认云闪付App“广西消费券专区”名称，不存在可直接认定个人申请成功的政府网站URL。不可将最高3万作为普惠补助；不可声称一定开放或资金充足。',
  keywords:[c.city,'广西','新建商品房','购房补贴','人才安居','房票','新市民','毕业生','云闪付','2026'],
  materials:[
   '新建商品房买卖合同和备案信息（正式申报材料清单须以当期云闪付页面为准）',
   '本人身份与拟收款账户信息（办理平台当期要求为准）',
   '如申报毕业生、新市民、退役军人、家庭孩次等叠加档次，对应资格证明（具体种类待官方细则核实）',
   '如申报卖旧买新或灵活就业公积金条件，相应交易与缴存凭证（具体口径待核实）'
  ],
  applicationSteps:[
   '先核对自治区2026购房活动公告与财政资金剩余状态，确认'+c.city+'房屋所在地是否被覆盖，不能套用其他地区规则。',
   '核实实际新建商品房买卖合同金额、网签备案及有效时间，并与当地住建部门确认项目类别和适用排除条件。',
   '按本人新市民、就业毕业生、公积金灵活缴存、卖旧买新或家庭孩次等真实条件筛选可叠加档次，不重复计价。',
   '在云闪付App找到“广西消费券专区”对应购房补贴事项，逐项阅读可用截止时间、材料说明与资金公告；查询不到则联系活动主管机构。',
   '仅通过活动真实官方系统按页面要求提交购房备案、身份和叠加材料，保留受理反馈；HHBA不收集用户证件。',
   '待财政审核与公示结果确认实际核定档次、金额及资金拨付；最高3万元仅属封顶，不承诺审核通过。'
  ]
 };
}
export const GUANGXI_POLICY_RECORDS:TalentPolicyRecord[]=GUANGXI_CITY_CONTACTS.flatMap(c=>[
 provincialPurchase(c),historicalThreeSupport(c)
]);
