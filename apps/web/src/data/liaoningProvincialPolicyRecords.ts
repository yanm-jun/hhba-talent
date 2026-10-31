import type {TalentPolicyRecord} from './talentPolicyRecords.ts';
/** 辽宁14市属地政策：三项全省政策展示，不等于42项市级独立补贴。更新核查2026-10-31。 */
export const LIAONING_CITY_CONTACTS=[
  {
    "city": "沈阳",
    "slug": "shenyang",
    "phone": "024-31401102"
  },
  {
    "city": "大连",
    "slug": "dalian",
    "phone": "0411-39997553"
  },
  {
    "city": "鞍山",
    "slug": "anshan",
    "phone": "0412-5540860"
  },
  {
    "city": "抚顺",
    "slug": "fushun",
    "phone": "024-52424116"
  },
  {
    "city": "本溪",
    "slug": "benxi",
    "phone": "024-42808632"
  },
  {
    "city": "丹东",
    "slug": "dandong",
    "phone": "0415-3105826"
  },
  {
    "city": "锦州",
    "slug": "jinzhou",
    "phone": "0416-5055078"
  },
  {
    "city": "营口",
    "slug": "yingkou",
    "phone": "0417-2980126"
  },
  {
    "city": "阜新",
    "slug": "fuxin",
    "phone": "0418-2680166"
  },
  {
    "city": "辽阳",
    "slug": "liaoyang",
    "phone": "0419-2269889"
  },
  {
    "city": "盘锦",
    "slug": "panjin",
    "phone": "0427-2288211"
  },
  {
    "city": "铁岭",
    "slug": "tieling",
    "phone": "024-74844013"
  },
  {
    "city": "朝阳",
    "slug": "chaoyang",
    "phone": "0421-2638175"
  },
  {
    "city": "葫芦岛",
    "slug": "huludao",
    "phone": "0429-6660759"
  }
] as const;
export const LIAONING_14_CITIES=LIAONING_CITY_CONTACTS.map(c=>c.city);
const prov='https://www.ln.gov.cn/web/qmzx/5.15zwgkr%28d20j%29/zcztc/msbz/2026051516404662402/index.shtml';
const three='https://chrm.mohrss.gov.cn/announcement/2026%E5%B9%B4%E8%BE%BD%E5%AE%81%E7%9C%81%E9%AB%98%E6%A0%A1%E6%AF%95%E4%B8%9A%E7%94%9F%E4%B8%89%E6%94%AF%E4%B8%80%E6%89%B6%E8%AE%A1%E5%88%92%E6%8B%9B%E5%8B%9F%E5%85%AC%E5%91%8A/';
type City=typeof LIAONING_CITY_CONTACTS[number];
const searchSteps=(city:string)=>[
 '核对本年度辽宁省人社部门发布的《高校毕业生等青年就业创业支持政策清单》，识别受助主体，不凭在'+city+'居住自动领取。',
 '根据本人毕业学年、失业/家庭困难认定以及当地政策要求区分是否符合申请资格。',
 '通过'+city+'所在地公共就业服务机构或就读高校了解真实申报期限与窗口；政府政策清单并不等于在线申请表单。',
 '核对身份、毕业及资格证明，按经办机构公示的材料清单提交，保存受理回执并跟进补正。',
 '经部门复核和资金拨付程序，以真实核定记录为准；不得把省级规定重复计作市级另外一笔补贴。'
];
function provincialJobseek(c:City):TalentPolicyRecord{
return {id:'ln-'+c.slug+'-2026-provincial-jobseek',city:c.city,category:'就业创业',scope:'全市',temporal:'policy',published:'2026-04-14',sourceUrl:prov,sourceName:'辽宁省政府网站 · 辽人社〔2026〕6号2026年高校毕业生就业创业支持政策清单（自治区统一政策属地展示）',
title:c.city+' · 辽宁省2026毕业学年困难高校毕业生一次性求职补贴',
summary:'辽宁2026全省支持政策第（一）项。面向毕业学年积极求职的特定困难高校毕业生，本条仅是省级政策在'+c.city+'的办事索引，非该市独立补贴。',
benefit:'符合条件者可申请一次性求职补贴。省级2026政策清单这一项未在正文中公布全省统一固定金额，具体金额与受理批次应向毕业院校和当地人社部门核实。',
eligibility:'毕业学年且积极求职的低保家庭、零就业家庭、特困人员中的高校毕业生，烈士子女、孤儿（含事实抚养儿童）、残疾毕业生，或获得国家助学贷款的高校毕业生。非所有毕业生都可以申领。',
application:'先向本人学校学生就业/资助部门核对2026毕业届次、困难类别与申报批次；由学校或'+c.city+'公共就业服务机构确认材料和受理渠道后正式提交。',
department:'辽宁省人力资源和社会保障厅／'+c.city+'公共就业服务机构及就读高校',
targetGroup:'符合毕业学年且有指定困难身份的求职高校毕业生',
payoutTo:'个人',headlineAmount:'按当地核定',headlineUnit:'一次性求职补贴，具体金额不得猜测',
reviewedAt:'2026-10-31',reviewNote:'B级省级2026原文确认制度存在；当地是否开放、当年金额及学校初审名册未见统一公开材料，办理入口待核实；省级记录不计作'+c.city+'独立政策。',
keywords:['辽宁',c.city,'毕业生','求职补贴','就业','困难毕业生','2026','学校'],
materials:['本人身份证与毕业学年或学籍信息','符合困难身份的有效低保证明、残疾证、国家助学贷款等择一材料','学校要求的一次性求职补贴申请/承诺表','学校指定收款账户与经办部门补充材料（以实际要求为准）'],
applicationSteps:searchSteps(c.city)};
}
function provincialFlexible(c:City):TalentPolicyRecord{
return {id:'ln-'+c.slug+'-2026-provincial-flex',city:c.city,category:'就业创业',scope:'全市',temporal:'policy',published:'2026-04-14',sourceUrl:prov,sourceName:'辽宁省政府网站 · 辽人社〔2026〕6号2026年高校毕业生就业创业支持政策清单（全省同项属地展示）',
title:c.city+' · 辽宁省离校2年内未就业毕业生灵活就业社会保险补贴',
summary:'全省2026政策清单规定，离校两年内未就业高校毕业生实现灵活就业并实际缴纳社会保险，可申请按实际缴费计算的社保补贴；按'+c.city+'当地执行细则审核。',
benefit:'补贴上限为本人实际缴纳社会保险费的三分之二，享受期限最长24个月。具体当地计发基数、险种、资料与月标准应按市县就业机构执行细则核对，不能把上限当成每人必领金额。',
eligibility:'离校两年内未就业的高校毕业生，后实现灵活就业并依法实际缴纳社会保险且满足当地就业登记、参保和排除性条件；有固定劳动关系等不合格情况不能仅以个人缴保申领。',
application:'先核实未就业/灵活就业状态及在'+c.city+'实际参保缴费记录，向常住地或参保地公共就业服务机构确认受理区域、申请材料、补贴适用险种和现行办理入口，再依官方程序提交。',
department:'辽宁省人力资源和社会保障厅／'+c.city+'人社局和公共就业服务机构',
targetGroup:'离校2年内未就业、在本地区实际灵活就业参保并缴费的毕业生',
payoutTo:'个人',headlineAmount:'不超过实缴2/3',headlineUnit:'最长24个月，市县实际计发标准另核',
reviewedAt:'2026-10-31',reviewNote:'B级省级2026原文确认“实际缴费的三分之二以内、最多24个月”；各市按当期细则核定，不保证实际比例达2/3，办理入口待核实。与当地同类政策不得简单叠加。',
keywords:['辽宁',c.city,'毕业生','灵活就业','养老','医疗','社保','缴费补贴','2026'],
materials:['本人身份证、毕业证、学历验证','离校两年内未就业及灵活就业登记凭证（按当地要求）','本人社会保险缴费凭证和社保卡金融账户','当地公共就业部门指定的申请表和不重复享受声明'],
applicationSteps:[
 '核实毕业证时间是否在离校两年内，是否属于未就业后从事灵活就业的适用情形。',
 '确认在'+c.city+'实际缴纳社会保险、没有相关不适用劳动关系或政策重复享受。',
 '下载实际缴费明细和就业登记材料，向当地公共就业机构确认可以申报的险种和核算基数。',
 '从辽宁政务服务网或所在区县就业服务机构的现行真实事项办理，不把省级文件主页作为申报网址。',
 '按要求提交、接受审查与公示，实际核定补贴不超过所缴费用三分之二、最长24个月。'
]};
}
function historicalThree(c:City):TalentPolicyRecord{
return {id:'ln-'+c.slug+'-2026-three-support-closed',city:c.city,category:'就业创业',scope:'年度批次',temporal:'past-window',published:'2026-07-24',deadline:'2026-07-17',sourceUrl:three,
sourceName:'人社部中国人力资源市场网 · 2026辽宁省高校毕业生“三支一扶”招募公告，含各市电话及岗位附件',
title:c.city+' · 辽宁2026“三支一扶”基层招募（报名已截止）',
summary:'辽宁全省2026拟招募500人，服务期2年；各地岗位、专业、资格以实际岗位表为准。'+c.city+'归属一城岗位，但500人是全省总量，不能算作本市名额。',
benefit:'服务期间享受按国家和服务地区规定的工作生活补贴、社会保障，服务期满考核合格可按规定参加机关事业单位定向招录、硕士研究生招生初试加10分等；不能把尚未录取的报名者当成已获补贴。',
eligibility:'2026普通高校及国家承认学历国境外高校应届毕业生为重点，2024—2025年毕业离校未就业的省内生源毕业生为辅助对象；大专以上学历、本科及以上需相应学位，并满足'+c.city+'岗位表条件，已参加过“三支一扶”者不可再参加。',
application:'2026报名已在7月15日9:00至7月17日16:00结束。历史报名平台辽宁人事考试网；准考证7月22—25日，笔试7月25日。本市咨询电话'+c.phone+'，新年度必须等新公告，不可沿用历史窗口。',
department:c.city+'“三支一扶”计划办公室／辽宁省“三支一扶”计划办公室',
targetGroup:'满足2026辽宁三支一扶具体基层岗位表的毕业生；目前为历史申报参考',
payoutTo:'非现金服务',headlineAmount:'全省500人',headlineUnit:'2026历史计划，不是本市名额',
reviewedAt:'2026-10-31',reviewNote:'C历史批次；2026报名截止7月17日16:00，不是当前招聘。原文发布时间2026-07-24晚于其公告载明的报名时间，本文严格采用公告载明日期并注明该时间矛盾，不臆断再次开放。城市名额详见岗位附件（未逐个核实），办理入口待核实：2027尚未公布。'+c.city+'咨询电话'+c.phone,
keywords:['辽宁',c.city,'三支一扶','2026','基层','历史','报名结束'],
materials:['身份证件与符合岗位的毕业证及本科以上学位证','报考岗位专业、基层服务或执业资格要求证明','2026历史报名登记表和本人照片（旧批次需按公告上传）','资格复审及考察体检时按本市通知提交其他原始材料'],
applicationSteps:[
 '打开2026辽宁省公告和岗位附件，定位'+c.city+'职位及毕业年份、专业、服务地点资格；全省500人不得误写为本市名额。',
 '确认报名时间2026-07-15 09:00至2026-07-17 16:00已经结束，历史窗口不能再投递。',
 '了解当期在辽宁人事考试网提交报名并确认资格审查的旧流程，不应拿这一步作为现在报名按钮。',
 '历史考试7月22—25日打印准考证，7月25日笔试；面试资格复审和体检由'+c.city+'自行公告。',
 '签订实际服务协议并到岗后方可核对补贴和社会保障，服务期两年考核合格后再核定相关升学和就业优惠。',
 '需要新批次请查辽宁人事考试网和'+c.city+'人社部门后续公告，或咨询本市办公室'+c.phone+'。'
 ]};
}
export const LIAONING_PROVINCIAL_POLICY_RECORDS:TalentPolicyRecord[]=LIAONING_CITY_CONTACTS.flatMap(c=>[provincialJobseek(c),provincialFlexible(c),historicalThree(c)]);
