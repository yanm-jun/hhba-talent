/**
 * Housing references awaiting primary-source verification.
 * NEVER merge these into TALENT_HOUSING_RECORDS or count as verified projects.
 * Media reproductions may be valuable leads, but do not establish current inventory.
 */
export type TalentHousingResearchLead={
 id:string;city:string;district:string;title:string;category:'人才公寓'|'保障性租赁住房';
 address:string;units:string;rent:string;eligibility:string;published:string;
 sourceUrl:string;sourceName:string;statusNote:string;steps:string[];reviewedAt:string;
};
export const TALENT_HOUSING_RESEARCH_LEADS:TalentHousingResearchLead[]=[
 {
  id:'rizhao-beimiaojia-housing-lead',city:'日照',district:'山海天旅游度假区',
  title:'市级人才公寓 · 北苗家村社区（历史报道待官方复核）',category:'人才公寓',
  address:'太公岛一路与山海天路交汇处，北苗家村社区北沿街东段商业B2栋',
  units:'2024年转载的日照人社指南列有43—52㎡单间及69—78㎡一室一厅；两处市级项目合计523个房间，未披露本项目独立房源数，不等于2026可租空房',
  rent:'2024指南：符合部分人才类型可免租；2022年后市直单位全职引进的合规硕士，原则上不超过60㎡部分按市场租金50%收取。现价及本项目适用范围待复核。',
  eligibility:'旧版市级办法要求本人、配偶及未成年子女在日照无住房；市直企事业单位引进全日制博士、2022年后市直单位全职引进的硕士，以及认定高层次人才等分别适用不同标准。2026资格须向日照人社核实。',
  published:'2024-04-12',sourceUrl:'https://www.sohu.com/a/771048237_121117491',
  sourceName:'2024年转载《日照市级人才公寓申请指南》（注明来源日照人社；非政府一手网页）',
  statusNote:'来源为2024年转载，无法据此确认2026年是否仍有空房、当年租金、受理入口；需要日照市人社局发布的项目原文及运营信息核验。不得作为当前可申报承诺。',
  steps:['先向日照人社确认北苗家村人才公寓是否仍在市级配租名单','核实个人是否属于市级重点人才或市直单位新引进博士、硕士等适用身份','向主管部门核实“人才日照”线上申请通道是否仍启用及现行证明材料','按照主管部门正式公示的材料和审核流程申请，并查看办理结果','审核通过且有实际房源后，由管理方安排签约、入住'],reviewedAt:'2026-10-30'
 },
 {
  id:'rizhao-jinhui-housing-lead',city:'日照',district:'东港区',
  title:'市级人才公寓 · 金汇时代广场（历史报道待官方复核）',category:'人才公寓',
  address:'文登路199号金汇时代广场4号楼',
  units:'2024年转载的日照人社指南列有40—70㎡一室一厅、45—72㎡一室两厅及96.4㎡两室两厅；两处项目合计523房间，不能据此分配到单个项目',
  rent:'2024指南列市级人才公寓最长租期3年，部分高层次人才与博士免租，市直单位符合条件的硕士可按市场价50%承租符合面积规定房源；2026价格待核实。',
  eligibility:'2024指南引述《日照市市级人才公寓认定和管理实施细则》，针对在日照无住房且为符合认定条件的高层次人才、日照市直企事业单位引进博士及指定硕士等；不同区县普通就业人员不自动享有市级公寓资格。',
  published:'2024-04-12',sourceUrl:'https://www.sohu.com/a/771048237_121117491',
  sourceName:'2024年转载《日照市级人才公寓申请指南》（注明来源日照人社；非政府一手网页）',
  statusNote:'此为2024历史资料线索，非2026官方配租公告；最新房源、项目数量、价格和真实在线申请地址待核验，不等于有房可租。',
  steps:['向日照市人社部门核实金汇时代广场4号楼当前管理方与房源是否仍开放','按人才工程类别、学历、单位性质和家庭住房状况核验具体资格','核实“人才日照”平台是否仍提供此项目的在线申请入口','按照当期主管部门公告提交真实材料并配合审核及选房安排','核对实际租金、附加费用和租期后签订入住协议'],reviewedAt:'2026-10-30'
 },
 {
  id:'rizhao-hightech-talent-housing-lead',city:'日照',district:'日照高新区',
  title:'日照高新区人才公寓（园区项目线索）',category:'人才公寓',
  address:'日照高新区；2026年官方报纸介绍未给出具体楼栋地址',
  units:'2026-05-01《日照日报》报道：已有55家企业800多名人才入住高新区人才公寓；此为已入住人数，不是当前空余房源',
  rent:'2026报道提及租金补贴力度扩大，但未披露项目当前价目表及单套租金；以高新区人才服务机构为准',
  eligibility:'报道说明高新区拓宽入住范围，具体学历、单位、就业与住房条件未公开完整清单；需先核实具体项目和适用人才。',
  published:'2026-05-01',sourceUrl:'https://rbrk.rznews.cn/paper/s1/t1/rzrb/20260501/A01/t1_page.html?pagetonum=A01',
  sourceName:'《日照日报》2026年5月报道（政府办事项目一手来源待核验）',
  statusNote:'报道确认园区存在人才公寓，但未给出项目独立地址、真实在租数量及申报入口；仅列为待核验线索，不是可申领房源。',
  steps:['向日照高新区人才服务部门查询人才公寓项目清单和地址','核对现行人才分类、企业范围、缴社保和住房限制','按当期项目材料清单准备就业、身份、住房相关证明','通过主管部门实际公布的渠道申请并核验审核状态','只有确认存在可租房源后才办理选房签约'],reviewedAt:'2026-10-30'
 }
];
