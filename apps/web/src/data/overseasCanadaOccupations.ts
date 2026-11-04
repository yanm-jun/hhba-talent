/* Source: IRCC 2026-11-04 official ten category descriptions.
   Every 5-digit NOC is explicitly listed by IRCC. This is a carefully selected,
   non-exhaustive set of real occupational codes, not live job vacancies.
   Category-specific invitation rounds still require FSW/CEC/FST eligibility,
   sufficient CRS and exact round criteria.
 */
import {caOfficial} from './overseasCanadaA.ts';
export type CaNocEntry={code:string;name:string;english:string;teer:number;group:string;experience:string;notes:string;};
export type CaCategory={key:string;name:string;description:string;experience:string;source:string;};
export const ca2026Categories:CaCategory[]=[
 {key:'health',name:'医疗与社会服务',description:'护士、医生、牙医、物理治疗、社工及相关医疗技术职业示例。部分职业依法需要省级执照。',experience:'最近3年同一列明NOC累计至少12个月，有偿工作可在加拿大或海外；满足主EE项目。',source:caOfficial.category},
 {key:'stem',name:'科学、工程与STEM',description:'2026名单包括建筑/科学经理、网络安全、土木、机械、电气、制造等，不能自动把所有软件开发工作认定为STEM。',experience:'最近3年同一列明NOC累计至少12个月，加拿大或海外；满足FSW/CEC/FST。',source:caOfficial.category},
 {key:'trades',name:'技术工种与技工',description:'建筑管理、焊工、电工、木工、钳工、工厂机修等按官方NOC代码识别。',experience:'最近3年同一列明NOC累计至少12个月，加拿大或海外；满足主EE项目。',source:caOfficial.category},
 {key:'education',name:'教育与学前教育',description:'中小学教师、幼儿教育工作者与助理、特殊教育支持等。',experience:'最近3年同一列明NOC累计至少12个月，加拿大或海外；教师可能另需省执教许可。',source:caOfficial.category},
 {key:'transport',name:'交通运输与维修',description:'飞机机修、飞行员/教练、航空电子技师、汽车及重卡维修职业。',experience:'最近3年同一列明NOC累计至少12个月，加拿大或海外；涉及行业许可证须另核查。',source:caOfficial.category},
 {key:'physicians',name:'加拿大执业医生',description:'必须满足在加拿大具体医生NOC工作经历，不是所有海外医生都适用本特殊类别。',experience:'最近3年在加拿大列明NOC至少12个月；还需基础EE及执业法律要求。',source:caOfficial.category},
 {key:'executive',name:'加拿大高级管理人员',description:'具体NOC 00012–00015的高级管理类别；普通区域主管不一定符合。',experience:'最近3年在加拿大列明NOC至少12个月；须证明高管职责。',source:caOfficial.category},
 {key:'research',name:'加拿大研究人员',description:'大学教授讲师或高等院校教学/科研助理类别。',experience:'最近3年在加拿大列明NOC至少12个月；相关研究职业身份和有薪职责要实证。',source:caOfficial.category},
 {key:'french',name:'法语能力',description:'并非某个NOC职业表，按合格官方法语考试听说读写NCLC7及EE主项目判断。',experience:'法语四项至少NCLC7，同时符合FSW/CEC/FST之一及邀请轮次要求。',source:caOfficial.category},
 {key:'military',name:'具特定经历的军事专业人员',description:'面向符合加拿大军队特殊海外专业人才机制及2026规定的特定人员，不是一般短期服役经历。',experience:'按IRCC类别与加拿大军队Foreign Skilled Military Applicant具体条件核查，不能普通职业套用。',source:caOfficial.category}
];
const occupationSource=caOfficial.category;
const groupExperience:Record<string,string>=Object.fromEntries(ca2026Categories.map(x=>[x.key,x.experience]));
type N=[string,string,string,number,string,string?];
const rows:N[]=[
 ['31100','临床与检验专科医生','Specialists in clinical and laboratory medicine',1,'health'],
 ['31101','外科专科医生','Specialists in surgery',1,'health'],
 ['31102','全科及家庭医生','General practitioners and family physicians',1,'health'],
 ['31103','兽医','Veterinarians',1,'health'],
 ['31110','牙医','Dentists',1,'health'],
 ['31120','药剂师','Pharmacists',1,'health'],
 ['31200','心理学家','Psychologists',1,'health'],
 ['31202','物理治疗师','Physiotherapists',1,'health'],
 ['31301','注册护士与精神科注册护士','Registered nurses and registered psychiatric nurses',1,'health'],
 ['31302','执业护士（高级护理）','Nurse practitioners',1,'health'],
 ['32101','实用护士','Licensed practical nurses',2,'health'],
 ['32102','急救医疗职业','Paramedical occupations',2,'health'],
 ['32120','医学检验技术人员','Medical laboratory technologists',2,'health'],
 ['32121','医学影像技术人员','Medical radiation technologists',2,'health'],
 ['32122','医学超声检查员','Medical sonographers',2,'health'],
 ['32124','药房技术员','Pharmacy technicians',2,'health'],
 ['33102','护理助理与病患服务人员','Nurse aides, orderlies and patient service associates',3,'health'],
 ['33103','药房助理','Pharmacy technical assistants and pharmacy assistants',3,'health'],
 ['41300','社会工作者','Social workers',1,'health'],
 ['41301','咨询与专业治疗师','Therapists in counselling and related specialized therapies',1,'health'],
 ['42201','社会和社区服务工作者','Social and community service workers',2,'health'],
 ['20011','建筑与科学经理','Architecture and science managers',0,'stem'],
 ['21220','网络安全专家','Cybersecurity specialists',1,'stem'],
 ['21300','土木工程师','Civil engineers',1,'stem'],
 ['21301','机械工程师','Mechanical engineers',1,'stem'],
 ['21310','电气电子工程师','Electrical and electronics engineers',1,'stem'],
 ['21321','工业与制造工程师','Industrial and manufacturing engineers',1,'stem'],
 ['21331','地质工程师','Geological engineers',1,'stem'],
 ['22300','土木工程技术员','Civil engineering technologists and technicians',2,'stem'],
 ['22301','机械工程技术员','Mechanical engineering technologists and technicians',2,'stem'],
 ['22310','电气电子工程技术员','Electrical and electronics engineering technologists and technicians',2,'stem'],
 ['63100','保险代理与经纪人','Insurance agents and brokers',3,'stem'],
 ['22303','建筑造价估算员','Construction estimators',2,'trades'],
 ['70010','建筑项目经理','Construction managers',0,'trades'],
 ['70011','房屋建造和翻新经理','Home building and renovation managers',0,'trades'],
 ['72100','机械加工与刀具检验员','Machinists and machining and tooling inspectors',2,'trades'],
 ['72102','钣金技工','Sheet metal workers',2,'trades'],
 ['72106','焊工及相关机器操作员','Welders and related machine operators',2,'trades'],
 ['72200','电工（不含工业/电力系统）','Electricians (except industrial and power system)',2,'trades'],
 ['72201','工业电工','Industrial electricians',2,'trades'],
 ['72300','管道工','Plumbers',2,'trades'],
 ['72302','燃气安装工','Gas fitters',2,'trades'],
 ['72310','木工','Carpenters',2,'trades'],
 ['72311','橱柜制作工','Cabinetmakers',2,'trades'],
 ['72320','砖瓦工','Bricklayers',2,'trades'],
 ['72400','建筑机械安装与工业机修','Construction millwrights and industrial mechanics',2,'trades'],
 ['72401','重型设备维修技工','Heavy-duty equipment mechanics',2,'trades'],
 ['72402','暖通空调制冷机修','Heating, refrigeration and air conditioning mechanics',2,'trades'],
 ['72422','电气机械维修技工','Electrical mechanics',2,'trades'],
 ['73100','混凝土整理工','Concrete finishers',3,'trades'],
 ['73110','屋顶铺设及瓦工','Roofers and shinglers',3,'trades'],
 ['73112','油漆装修技工','Painters and decorators (except interior decorators)',3,'trades'],
 ['63201','屠宰和零售批发肉类工','Butchers - retail and wholesale',3,'trades'],
 ['41220','中学教师','Secondary school teachers',1,'education'],
 ['41221','小学与幼儿园教师','Elementary school and kindergarten teachers',1,'education'],
 ['42202','幼儿教育工作者与助理','Early childhood educators and assistants',2,'education'],
 ['42203','残障人士教育培训讲师','Instructors of persons with disabilities',2,'education'],
 ['43100','中小学教师助理','Elementary and secondary school teacher assistants',3,'education'],
 ['72404','飞机机修与检查员','Aircraft mechanics and aircraft inspectors',2,'transport'],
 ['72600','飞行员、航空工程师与飞行教练','Air pilots, flight engineers and flying instructors',2,'transport'],
 ['22313','航空仪表电气航电维修','Aircraft instrument, electrical and avionics mechanics, technicians and inspectors',2,'transport'],
 ['72410','汽车/卡车/巴士维修技工','Automotive service technicians, truck and bus mechanics, and mechanical repairers',2,'transport'],
 ['31100','加拿大临床与检验专科医生','Specialists in clinical and laboratory medicine',1,'physicians'],
 ['31101','加拿大外科医生','Specialists in surgery',1,'physicians'],
 ['31102','加拿大全科家庭医生','General practitioners and family physicians',1,'physicians'],
 ['00012','加拿大金融通信商务高管','Senior managers - financial, communications and other business services',0,'executive'],
 ['00013','加拿大卫生教育社会服务高管','Senior managers - health, education, social and community services and membership organizations',0,'executive'],
 ['00014','加拿大贸易广播服务高管','Senior managers - trade, broadcasting and other services',0,'executive'],
 ['00015','加拿大建设交通生产高管','Senior managers - construction, transportation, production and utilities',0,'executive'],
 ['41200','加拿大大学教授与讲师','University professors and lecturers',1,'research'],
 ['41201','加拿大高校教学与研究助理','Post-secondary teaching and research assistants',1,'research'],
 ['40042','加拿大军队委任军官','Commissioned officers of the Canadian Armed Forces',1,'military'],
 ['42102','加拿大军队特种专业成员','Specialized members of the Canadian Armed Forces',2,'military']
];
export const caOfficialNoc2026:CaNocEntry[]=rows.map(([code,name,english,teer,group])=>({
 code,name,english,teer,group,experience:groupExperience[group],
 notes:group==='health'||group==='physicians'?'部分职业属受监管医护，取得移民邀请不代表可在加拿大独立行医/执业；仍须通过实际省份主管机构取得职业许可。':
 group==='education'?'学校教学与幼教职业可能受省级教师/幼教资格监管，必须按目的省办理职业登记；实际工作职责必须符合NOC。':
 group==='research'?'本类别特别要求最近3年有至少12个月符合列明NOC的加拿大工作经验，海外高校研究不能自动替代。':
 group==='executive'?'必须有真实高级管理职责及最近3年对应加拿大工作经验；中国“区域经理”职位并非自动等同NOC 00012–00015。':
 group==='transport'?'飞行、航空维修及汽车维修可能涉及职业/行业许可；移民类别与实际工作授权需分开。':
 group==='stem'?'2026 STEM类别的具体NOC需逐项核验。软件开发、前端开发等岗位不因名称涉及IT就自动位于2026 STEM列表。':
 group==='trades'?'本类别是2026职业定向邀请示例；FST另有近5年2年技工经验和offer/资格证规定，不能混为一谈。':
 group==='military'?'2026特殊军事专业人员类别需满足加拿大军队官方外国专业人员准入条件，包括通常长期正式服役经历，非普通应征报名。':
 '按IRCC2026类别职业细则和真实NOC职责、经验查验。'
}));
export const caNocCategorySource=occupationSource;
export const caProvinceEntries=[
 {id:'on',name:'安大略省 Ontario',capital:'多伦多/渥太华',url:'https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp',example:'OINP按雇主offer、职业/语言、EE等不同stream分别审核；部分按邀请制，不是任何工作都有省提名。'},
 {id:'bc',name:'不列颠哥伦比亚省 British Columbia',capital:'温哥华/维多利亚',url:'https://www.welcomebc.ca/immigrate-to-b-c',example:'BC PNP按当期经济重点及工作类别发邀请；行业优先、工资、职位及具体类别可能改变。'},
 {id:'ab',name:'阿尔伯塔省 Alberta',capital:'卡尔加里/埃德蒙顿',url:'https://www.alberta.ca/alberta-advantage-immigration-program',example:'AAIP区分阿尔伯塔机会、Express Entry关联、农业、农村更新等stream，须核实真实就业与居住资格。'},
 {id:'mb',name:'曼尼托巴省 Manitoba',capital:'温尼伯',url:'https://immigratemanitoba.com/',example:'MPNP包含省内技术就业、海外技术及国际教育类别，通常关注真实省份联系与长期定居意愿。'},
 {id:'sk',name:'萨斯喀彻温省 Saskatchewan',capital:'萨斯卡通/里贾纳',url:'https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/immigrate-to-saskatchewan',example:'SINP有职业、雇主支持及省经济重点等不同条件，必须核对当期开放和配额。'},
 {id:'ns',name:'新斯科舍省 Nova Scotia',capital:'哈利法克斯',url:'https://liveinnovascotia.com/immigrate',example:'NS省提名和AIP指定雇主两个制度不同；同省就业并非自动符合任意stream。'},
 {id:'nb',name:'新不伦瑞克省 New Brunswick',capital:'弗雷德里克顿/蒙克顿',url:'https://www2.gnb.ca/content/gnb/en/corporate/promo/immigration.html',example:'NB有本省人才需求及雇主支持项目，与大西洋移民AIP并行但分别审核。'},
 {id:'pe',name:'爱德华王子岛省 Prince Edward Island',capital:'夏洛特敦',url:'https://www.princeedwardisland.ca/en/topic/immigration',example:'PEI PNP优先职业和邀请轮次可能很快变化，需看省官方最新抽选及雇佣条件。'},
 {id:'nl',name:'纽芬兰与拉布拉多省 Newfoundland and Labrador',capital:'圣约翰斯',url:'https://www.gov.nl.ca/immigration/',example:'NLPNP与大西洋移民计划同地但独立，需核验当地职位及支持资格。'},
 {id:'yt',name:'育空地区 Yukon',capital:'怀特霍斯',url:'https://yukon.ca/en/immigration',example:'育空地区雇主支持和本地资格按当期stream、配额与真实就业条件判断。'},
 {id:'nt',name:'西北地区 Northwest Territories',capital:'耶洛奈夫',url:'https://www.immigratenwt.ca/',example:'西北地区省提名/地区提名通常涉及真实雇主与紧缺技能等具体条件，不适用于努纳武特。'}
] as const;
