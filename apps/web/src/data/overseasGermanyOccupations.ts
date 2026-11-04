/* Real German shortage *categories* and training occupations, not scraped vacancies or a legal closed list. */
import {deOfficial} from './overseasGermanyA.ts';
export type DeProfession={
 id:string;cn:string;de:string;en:string;group:string;kind:'blue'|'training';
 duties:string;qualification:string;language:string;regulation:string;salary:string;
 experience:string;documents:string[];actions:string[];sources:{label:string;url:string}[];
 important:string;
};
const occupationSources=[
 {label:'德国政府欧盟蓝卡2026工资及紧缺职业类别',url:deOfficial.blue},
 {label:'德国政府目前紧缺职业介绍',url:deOfficial.occupations},
 {label:'德国官方资格认证与受监管职业查询',url:deOfficial.recognitionGuide},
 {label:'ZAB国外大学学历比较证明',url:deOfficial.zab},
 {label:'德国联邦认可的真实职位库（非保证招聘）',url:deOfficial.jobs}
];
const trainingSources=[
 {label:'德国官方职业培训热门职业领域',url:deOfficial.trainings},
 {label:'德国职业培训签证、B1及2026资金要求',url:deOfficial.training},
 {label:'德国官方招聘与培训岗位搜索',url:deOfficial.jobs}
];
type BlueDef=[string,string,string,string,string,string,string?];
const blues:BlueDef[]=[
 ['software','软件开发工程师','Softwareentwickler/in','Software Developer','IT与数字技术','根据项目需求开发、测试和维护应用程序或企业级软件，而不是只靠会用电脑。','典型STEM/IT相关职业类别，能否享受较低门槛仍看官方分类和真实岗位。'],
 ['it-manager','信息技术服务经理','Leiter/in IT-Dienstleistungen','ICT Service Manager','IT与数字技术','管理IT服务团队、系统交付、预算及技术服务质量；职位必须有实际管理职责。','官方紧缺职业类别包含ICT服务管理，但任何中文“IT主管”并非自动等同。'],
 ['electrical','电气工程师','Elektroingenieur/in','Electrical Engineer','工程与科学','电路、电力设施和自动化系统的专业设计、工程分析和技术协调。','属于典型学术STEM领域；电气安装工与电气工程师不应混为同一职业。'],
 ['mechanical','机械工程师','Maschinenbauingenieur/in','Mechanical Engineer','工程与科学','从事机械产品、工业设备与汽车零部件研发、设计、仿真和工艺技术分析。','属于典型学术工程专业；简单生产线操作不等于机械工程师。'],
 ['civil','土木工程师','Bauingenieur/in','Civil Engineer','工程与科学','土木结构、桥梁、道路与建筑基础设施的规划、设计或工程监理。','典型学术STEM职业，但具体职业类别和受监管任务需要个别确认。'],
 ['scientist','自然科学研究人员','Naturwissenschaftler/in','Natural Scientist','工程与科学','开展科学实验、分析、技术研发以及科研相关专业活动。','学术数学、自然科学领域在紧缺类别范围，科研助理/技术工人不能全部混同。'],
 ['architect','建筑师','Architekt/in','Architect','建设与规划','从事建筑空间规划、设计、规范协调及建筑项目设计责任。','建筑、空间规划等学术职业被列为紧缺类别，但Architekt头衔和执业权限受到地方职业规定限制。'],
 ['doctor','医生','Arzt/Ärztin','Medical Doctor','医疗教育','诊断、治疗和管理病患健康，是德国受监管医疗执业活动。','医生属紧缺类别；学历和薪资满足要求仍不能替代德国行医许可（Approbation）。'],
 ['nurse','注册护理人员','Pflegefachperson','Qualified Nurse','医疗教育','从事经认可的专业护理、临床监护和护理记录；与护理助理、护工法律资格不同。','官方包括具备学术和同等资格的护理专业类别，具体岗位能否走蓝卡需专业层级和许可判断。'],
 ['teacher','学校教师','Lehrer/in','School Teacher','医疗教育','在符合职业资格的学校进行教学、教研和班级管理。','教师属所列紧缺领域，但公立学校任教和外籍学历认可通常存在州级监管条件。'],
 ['pharmacist','药剂师','Apotheker/in','Pharmacist','医疗教育','涉及药物审核、配药及药学专业服务，需要德国合法药学执业权。','官方紧缺职业包含药剂师；该职业受监管，不能拿药学本科就直接签字配药。'],
 ['education-manager','教育服务管理人员','Leiter/in Bildungsdienste','Education Services Manager','医疗教育','规划和管理教育服务、人员与运营质量，需真实专业管理工作。','官方紧缺职业类别包含教育/健康等专业服务经理；普通办公室行政不一定属于。']
];
export const deBlueProfessionSamples:DeProfession[]=blues.map(([id,cn,de,en,group,duties,comment])=>{
 const regulated=['doctor','nurse','teacher','pharmacist','architect'].includes(id);
 const standard='2026欧盟蓝卡一般税前年薪至少€50,700；如确属政府规定的紧缺类别，或满足合格新毕业、IT经验等例外，则可能适用€45,934.20并接受对应联邦就业局审查。必须以具体岗位和资格核对，不能仅凭本页示例认定。';
 return {
  id:'de-blue-'+id,cn,de,en,group,kind:'blue',duties,
  qualification:regulated?'必须同时具备可比/认可的学位或合法高等资格、真实职业许可，并确认合同岗位与实际专业能力相符。中国毕业证本身不会自动获得德国执业许可。':'一般需德国认可或可比的大学/等同高等资格及与专业匹配的工作。可先查学校和具体学位的anabin，再判断是否需ZAB个案学历比较；IT特殊经验例外单独审查。',
  language:regulated?'签证并不存在统一适用所有人的德语等级；受监管执业类别往往有额外的职业语言及州级要求，应向职业主管机构核查。':'蓝卡并不针对所有职业统一规定德语B1；真实招聘和客户/团队沟通可能要求德语或英语，由雇主及实际专业任务确定。',
  regulation:regulated?'属于或可能涉及受监管活动。医生、护士、药剂师、教师以及建筑师受保护的职称/执业内容都要核对目的地德国联邦州主管机关及具体许可证。':'这类专业职务不一定存在统一联邦执业许可证，但应核对实际岗位是否涉及州级受监管工程责任或其他依法许可的任务。',
  salary:standard,
  experience:id==='software'||id==='it-manager'?'若申请IT无学历特殊蓝卡，需要在最近7年有至少3年与大学水准相当的专业IT工作经历；其他学历路线则按其实际资格和职位要求判断。':'蓝卡没有适用于所有紧缺类别的统一最低工作年数；但实际学历资格、岗位经验和执照要求仍需要满足。',
  documents:['实际德国公司的至少6个月工作合同，列明具体职责、税前年薪和工时','学位/成绩单及anabin或ZAB需要的学历可比证明','受监管职业的实际注册/许可文件（如适用）','护照、医保及使馆/外管局要求的材料'],
  actions:['对照德国政府蓝卡紧缺类别说明，确认'+de+'实际岗位内容及职业分类。','核对大学、学位、执照和工作许可，特别查受监管行业主管机构。','请德国雇主按€50,700或适用的€45,934.20税前年薪标准核对实际合同。','通过德国外交部门户按欧盟蓝卡类别递交，必要时由联邦就业局审查较低工资路径。'],
  sources:occupationSources,important:comment||'本职业属于真实工作类型示例，不是政府保证获批的职业白名单；只要专业名称相同，并不能直接认定符合蓝卡。'
 };
});
type TrainDef=[string,string,string,string,string,string,string];
const trainings:TrainDef[]=[
 ['mechatronics','机电一体化技术员','Mechatroniker/in','Mechatronics Technician','电子与制造','学习机电装配、机械和电气控制系统维护、故障诊断及工业自动化操作。','正式职业培训，不是单纯装配流水线的普工合同。'],
 ['electronics','电子技术员','Elektroniker/in','Electronics Technician','电子与制造','学习电气安装、线路测量、电力控制与设备维护，具体方向以培训企业及职业学校课程为准。','电气安装有相关安全和职业规则，不能把学徒资格等同工程师执照。'],
 ['industrial-mechanic','工业机械技术员','Industriemechaniker/in','Industrial Mechanic','电子与制造','学习工业机械安装、加工、维修和生产设备调试。','和大学机械工程专业岗位是两种不同教育资格体系。'],
 ['automotive','汽车机电维修技师','Kfz-Mechatroniker/in','Automotive Mechatronics Technician','交通与汽车','学习机动车维修、电子诊断、车载电气、动力总成维护。','需要真正Ausbildung企业和职业学校安排，不等于进口车售后普通兼职。'],
 ['it','信息技术职业培训','Fachinformatiker/in','IT Vocational Trainee','IT与数字技术','学习软件应用开发、系统集成或数据/过程分析等具体Fachinformatiker培训方向。','应在合同中明确细分学习方向；不是任何IT客服工作自动属于学徒培训。'],
 ['logistics','仓储物流专员','Fachkraft für Lagerlogistik','Warehouse Logistics Specialist','物流与服务','学习仓库收货、库存管理、数字化物流调度及出货质量控制。','职业培训与仅做仓库打包的辅助工作不应混淆。'],
 ['hospitality','酒店服务职业培训','Hotelfachmann/-frau','Hotel Management Assistant','物流与服务','学习酒店前台接待、客房运营、预订服务与酒店经营流程。','酒店职业培训应有理论课程与企业实践，不是只有服务员排班。'],
 ['nursing','职业护理培训','Pflegefachfrau/-mann','Nursing Vocational Trainee','医疗照护','学习基础与临床护理知识、病人安全、护理文书及规定的医学实践。','护士是受监管职业；完成培训、考试与执业权限是不同环节。']
];
export const deTrainingOccupationSamples:DeProfession[]=trainings.map(([id,cn,de,en,group,duties,important])=>({
 id:'de-training-'+id,cn,de,en,group,kind:'training',duties,
 qualification:'本职业应有德国国家认可的真实Ausbildung培训合同或学校制录取，通常包含职业学校学习与企业实践。实际入学学历由企业和学校决定，不存在全国统一必须本科毕业的规则。',
 language:'德国职业培训签证通常需要德语B1；护理及具体行业训练、考试或招生企业可另要求更高德语或语言能力证明。',
 regulation:id==='nursing'?'护理在德国属于受监管职业，培训合格、考试、职业许可和实际护理执业权需分别核对目的地州要求。':'该职业培训不意味着获得所有工程/特种作业执业许可，涉及受管制内容应按德国正式培训规则和行业安全要求判断。',
 salary:'2026企业制培训如果每月培训津贴达到€1,048税前或€822税后，一般可证明足够生活来源；学校制培训参考每月€959净资金。这里的金额不是每个企业必定向学徒支付的统一法定工资。',
 experience:'申请职业培训通常不要求先有相同职业数年工作经验；企业会依据实际录取、语言、基础教育和年龄作出判断，找培训名额签证则有另外的未满35岁条件。',
 documents:['企业双元制正式培训合同或学校制录取通知，写明'+de+'完整职业名称','申请人真实学校毕业学历和德语B1或企业要求的更高语言证书','培训津贴或冻结账户/合法资金担保，医疗保险证明','官方要求的护照、使馆申请及适用学校材料'],
 actions:['到德国官方职业培训门户输入 '+de+' 查询真实职业培养内容。','筛选真实培训企业，核对职业学校、培训起止、津贴和每周学习安排。','按实际企业制或学校制分别准备€1,048税前/€822税后或€959净/月生活资金证明。','取得真实合同或学校录取后按§16a职业培训签证申请，拒绝购买所谓学徒保证名额。'],
 sources:trainingSources,important
}));
export const deOccupationAll=[...deBlueProfessionSamples,...deTrainingOccupationSamples];
