import type {TalentHousingRecord} from './talentHousingRecords.ts';
/** 广东省人才住房制度索引；制度项目不是实时可租房源。2026-10-31核验。 */
export const GUANGDONG_HOUSING_RECORDS:TalentHousingRecord[]=[
 {id:'gd-sz-202608-high-talent-program',city:'深圳',district:'全市（按该批次项目）',
 title:'2026年8月高层次人才保障性租赁住房认租制度及历史批次',address:'深圳市当期公告项目（详细楼栋地址以房源附件为准）',
 units:'2026年8月认租批次，具体套数和户型详见市住房保障署原公告附件；非实时空房',
 rent:'按项目房源清单及认租规定执行，未核实统一租金标准',
 eligibility:'持符合条件的鹏城优才卡或经确定的急需紧缺人才，在深全职工作且家庭住房与社保条件满足2026年8月公告',
 sourceUrl:'https://zjj.sz.gov.cn/szszfhjsjwzgkml/szszfhjsjwzgkml/seztfw/zfly/wyk/content/post_12942746.html',
 published:'2026-08-19',applicationEnd:'2026-08-31',kind:'program',reviewedAt:'2026-10-31',
 statusNote:'2026年8月31日18时申报已截止；本条仅为政府配租制度及历史批次，不等于当前可租房源，下一批申报入口未公开。',
 steps:['查询住房保障署当期配租公告及项目清单','按人才类别、工作社保和家庭住房资格进行自查','在当期公告规定时限内进入官方住房保障服务模块申报（本期已截止）','跟随主管部门审核、公示、选房和签约通知'],
 housingCategory:'保障性租赁住房'},
 {id:'gd-dg-talent-housing-sale-202603',city:'东莞',district:'全市适用制度，具体房源所在镇街依当期项目公告',
 title:'配建安居房（人才房）八折销售制度',address:'东莞市符合条件的配建安居房项目（楼栋地址待当期配售公告）',
 units:'制度性住房支持；无经核实的当前配售套数，非实时可售房源',
 rent:'人才购房优惠：符合条件的配建安居房按核定销售价格八折；不是租金和现金补贴',
 eligibility:'按基础型或其他人才分类核定资质；基础型学历/技能、在莞连续工作及家庭无产权住房等条件以原文件为准',
 sourceUrl:'https://zjj.dg.gov.cn/zwgk/zfxxgkml/zcwj/gfxwj/content/post_4508354.html',
 published:'2026-03-09',kind:'program',reviewedAt:'2026-10-31',
 statusNote:'仅为政府住房制度，项目地址、申请入口及具体配售批次待核实；八折不等于全市商品房均有优惠，非实时在售房源；申报入口未公开。',
 steps:['查询具体配建安居房人才房配售公告及销售价格','按人才认定、连续工作和家庭无房条件自查','在项目实际公告受理窗口准备并提交申请材料','等待人才类别及购房资格审核公示，再按公布排序选房及认购'],
 housingCategory:'其他住房'}
];
