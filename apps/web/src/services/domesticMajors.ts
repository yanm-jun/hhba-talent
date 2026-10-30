import { getDomesticCompanies, type DomesticCompany } from './domesticCompanySearch';
import higherCatalog from '../data/officialAcademicMajors.json';
import vocationalCatalog from '../data/officialVocationalMajors.json';
import verifiedProfiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles as additionalProfiles} from './domesticCompany200Data';
const allReviewedProfiles={...verifiedProfiles,...additionalProfiles};

export type MajorLevel='undergraduate'|'vocational'|'postgraduate'|'legacy'|'custom';
export type MajorDefinition={slug:string;name:string;keywords:string[];description:string;code?:string;level?:MajorLevel;discipline?:string;sourceYear?:number};
type AcademicRecord={id:string;name:string;code:string;level:MajorLevel;discipline?:string;sourceYear?:number};
export const MAJORS:MajorDefinition[]=[
 {slug:'electrical-engineering',name:'电气工程及其自动化',keywords:['电气自动化','电气工程','电力系统','智能电网','汽车电器','电气','电驱动','电控','工业控制','配电'],description:'电气控制、电能转换、电驱动和电气系统相关业务'},
 {slug:'automation',name:'自动化',keywords:['自动化','PLC','工业控制','工业机器人','智能制造','运动控制','伺服','机器人'],description:'自动控制、工业设备、机器人与自动化产线'},
 {slug:'mechanical-engineering',name:'机械设计制造及其自动化',keywords:['机械工程','机械制造','模具','智能制造','车身制造','生产工艺','零部件','汽车制造'],description:'机械设计、设备制造、工艺和生产系统'},
 {slug:'vehicle-engineering',name:'车辆工程',keywords:['车辆工程','汽车制造','整车','汽车工程','汽车底盘','汽车零部件','汽车照明'],description:'汽车产品、零部件、整车开发与制造'},
 {slug:'electronic-information',name:'电子信息工程',keywords:['电子信息','汽车电子','汽车电器','电子技术','智能驾驶','照明电子','电控','电子制造'],description:'电子系统、电路、控制器、信号和车载电子'},
 {slug:'optoelectronics',name:'光电信息科学与工程',keywords:['汽车照明','光电','光学','灯光','照明','视觉科技'],description:'光学设计、光电器件、汽车照明和显示'},
 {slug:'computer-science',name:'计算机科学与技术',keywords:['计算机','软件','人工智能','工业软件','算法','大模型','云计算','IT','软件工程'],description:'软件系统、算法、信息技术与计算机应用'},
 {slug:'materials-engineering',name:'材料科学与工程',keywords:['材料','金属加工','精密结构件','汽车零部件','电池'],description:'材料开发、制造工艺、测试与应用'},
 {slug:'energy-engineering',name:'新能源科学与工程',keywords:['新能源','储能','光伏','风电','电池','能源'],description:'新能源装备、储能和能源系统'},
 {slug:'robotics',name:'机器人工程',keywords:['机器人','智能制造','运动控制','自动化','PLC'],description:'机器人、驱动控制和智能制造'},
 {slug:'software-engineering',name:'软件工程',keywords:['软件','信息技术','工业软件','人工智能','算法'],description:'业务软件、工业软件及应用研发'},
 {slug:'finance',name:'金融学',keywords:['金融','银行','支付','证券','保险'],description:'银行、金融产品和金融服务'}
];

const EXTRA_MAJORS:MajorDefinition[]=[
 ['electronic-science','电子科学与技术',['电子技术','半导体','汽车电子','电子信息','器件'],'电子器件、集成电路及电子系统'],
 ['microelectronics','微电子科学与工程',['半导体','芯片','微电子','集成电路'],'半导体材料、芯片和电子器件'],
 ['integrated-circuits','集成电路设计与集成系统',['半导体','芯片','集成电路'],'芯片与集成电路设计'],
 ['communications','通信工程',['通信','网络','无线通信','工业通信','物联网'],'通信设备、网络和连接技术'],
 ['iot','物联网工程',['物联网','工业互联网','智能制造','传感器'],'联网设备、传感与物联网平台'],
 ['information-security','信息安全',['信息安全','网络安全','网络','软件'],'信息安全与网络防护'],
 ['data-science','数据科学与大数据技术',['大数据','工业互联网','数字化','算法','数据'],'数据分析、数据工程与数字化系统'],
 ['ai','人工智能',['人工智能','智能驾驶','算法','工业视觉','智能制造'],'智能算法与人工智能系统'],
 ['intelligent-manufacturing','智能制造工程',['智能制造','工业自动化','生产制造','工业机器人'],'智能工厂与自动化生产系统'],
 ['mechatronics','机械电子工程',['机械制造','工业控制','机电','伺服','运动控制'],'机械与电子协同设计'],
 ['mechanical-design','机械工程',['机械工程','机械制造','智能制造','机械结构'],'机械设计与生产制造'],
 ['industrial-engineering','工业工程',['工艺','智能制造','生产制造','质量管理'],'制造系统、工艺与流程优化'],
 ['measurement-control','测控技术与仪器',['传感器','测控','测试','电气自动化','仪器'],'测量、检测与控制设备'],
 ['energy-power','能源与动力工程',['新能源','动力总成','汽车热管理','热管理','能源'],'动力、热工与能源系统'],
 ['new-energy-vehicle','新能源汽车工程',['新能源汽车','电驱动','电池','汽车电子'],'新能源汽车工程技术'],
 ['transportation','交通运输',['轨道交通','汽车','物流','交通'],'交通运输及相关产业'],
 ['railway-engineering','轨道交通信号与控制',['轨道交通','电力机车','列车控制','信号'],'轨道交通与控制系统'],
 ['optical-engineering','光源与照明',['汽车照明','光电','照明','灯光'],'光源、照明与光电系统'],
 ['materials-physics','材料物理',['材料','光电','半导体','金属'],'材料性能、制备与应用'],
 ['materials-chemistry','材料化学',['材料','电池','新能源','化工'],'材料化学与材料制造'],
 ['polymer-materials','高分子材料与工程',['材料','塑料','橡胶','汽车零部件'],'高分子材料及制品'],
 ['chemical-engineering','化学工程与工艺',['化工','能源','电池','材料'],'化工生产和工艺技术'],
 ['environmental-engineering','环境工程',['环保','环境','能源','水处理'],'环境保护与工程'],
 ['civil-engineering','土木工程',['建筑','结构','土木','工程建设'],'建筑结构与土木工程'],
 ['architecture','建筑学',['建筑','设计','楼宇'],'建筑设计与规划'],
 ['construction-management','工程管理',['工程','工程建设','项目管理'],'工程组织及项目管理'],
 ['medical-engineering','生物医学工程',['医疗设备','医疗工程','医药'],'医疗装备与工程技术'],
 ['pharmacy','药学',['制药','医药','药品'],'制药研发与药品技术'],
 ['biology','生物科学',['生物','微生物','生物技术','细胞'],'生命科学、生物分析及应用相关方向'],
 ['nursing','护理学',['医疗','护理','医院'],'护理与医疗服务'],
 ['clinical-medicine','临床医学',['医院','医疗','临床'],'临床医疗'],
 ['accounting','会计学',['财务','会计','审计'],'会计、财务与审计'],
 ['financial-management','财务管理',['财务','资金','金融'],'财务与企业资金管理'],
 ['economics','经济学',['金融','经济','投资'],'经济分析与研究'],
 ['business-administration','工商管理',['运营','企业管理','管理'],'企业组织与运营管理'],
 ['marketing','市场营销',['市场','营销','销售','品牌'],'市场推广、渠道和销售'],
 ['human-resources','人力资源管理',['人力资源','招聘','培训','管理'],'人才招聘与组织发展'],
 ['logistics','物流管理',['物流','供应链','运输'],'物流、仓储与供应链运营'],
 ['supply-chain','供应链管理',['供应链','采购','物流'],'采购、供应链管理'],
 ['international-business','国际商务',['国际','海外','贸易'],'跨国商务与海外业务'],
 ['international-trade','国际经济与贸易',['进出口','外贸','国际','贸易'],'国际贸易与跨境业务'],
 ['law','法学',['法律','法务','合规'],'法律事务与合规'],
 ['english','英语',['翻译','外语','海外'],'语言、翻译与国际交流'],
 ['design','产品设计',['设计','产品','工业设计'],'产品造型、用户体验与工业设计'],
 ['visual-design','视觉传达设计',['设计','视觉','品牌','传媒'],'视觉传播与品牌设计'],
 ['industrial-design','工业设计',['工业设计','产品设计','设计'],'工业产品设计与体验'],
 ['education','教育学',['教育','培训','学校'],'教育与人才培养'],
 ['preschool-education','学前教育',['学前','幼儿','教育'],'学前教育'],
 ['dance','舞蹈学',['舞蹈','艺术','演艺','教育'],'舞蹈表演、教育与研究'],
 ['journalism','新闻学',['传媒','内容','新闻','传播'],'新闻传播与内容工作'],
 ['digital-media','数字媒体技术',['传媒','数字','软件','设计'],'数字媒体与技术开发'],
 ['tourism','旅游管理',['旅游','文旅','酒店'],'旅游、文旅与服务管理'],
 ['agriculture','农学',['农业','种植','农产品'],'农业生产与农业科技'],
 ['food-engineering','食品科学与工程',['食品','质量','生产'],'食品加工、检测与研发']
].map(([slug,name,keywords,description])=>({slug:slug as string,name:name as string,keywords:keywords as string[],description:description as string}));
MAJORS.push(...EXTRA_MAJORS);


const linkedByVocational:Record<string,string>={
 'voc-460306':'electrical-engineering','voc-460301':'automation','voc-460305':'robotics',
 'voc-460303':'automation','voc-460104':'mechanical-engineering','voc-460103':'mechanical-engineering',
 'voc-510203':'software-engineering','voc-510201':'computer-science',
 'voc-520201':'nursing','voc-570102K':'preschool-education','voc-530605':'marketing',
 'voc-530701':'marketing','voc-460310':'automation'
};
const linkedByAcademicName:Record<string,string>={
 '电气工程':'electrical-engineering','控制科学与工程':'automation','计算机技术':'computer-science',
 '机械':'mechanical-engineering','机械工程':'mechanical-design',
 '电子信息':'electronic-information','软件工程':'software-engineering',
 '人工智能':'ai','工商管理':'business-administration',
 '新闻与传播':'journalism','临床医学':'clinical-medicine'
};
const legacyBySlug=new Map(MAJORS.map(m=>[m.slug,m]));
const legacyByName=new Map(MAJORS.map(m=>[m.name,m]));
const officialRecords=[
 ...(higherCatalog.records as AcademicRecord[]),
 ...(vocationalCatalog.records as AcademicRecord[])
];
export const MAJOR_OPTIONS:MajorDefinition[]=officialRecords.map(record=>{
 const legacy=legacyByName.get(record.name);
 return {slug:record.id,name:record.name,code:record.code,level:record.level,
  discipline:record.discipline,sourceYear:record.sourceYear,
  description:legacy?.description||'',keywords:legacy?.keywords||[]};
});
for(const legacy of MAJORS)if(!MAJOR_OPTIONS.some(m=>m.name===legacy.name)){
 MAJOR_OPTIONS.push({...legacy,level:'legacy'});
}
const officialBySlug=new Map(MAJOR_OPTIONS.map(m=>[m.slug,m]));
export function majorById(slug:string):MajorDefinition|null{
 if(slug.startsWith('custom:')){
  let name='';try{name=decodeURIComponent(slug.slice(7)).trim().slice(0,70)}catch{return null}
  return name?{slug,name,level:'custom',keywords:[],description:'自填专业，尚未核对国家专业目录'}:null;
 }
 return officialBySlug.get(slug)||legacyBySlug.get(slug)||null;
}
function canonicalMajorSlug(major:MajorDefinition):string{
 return legacyBySlug.has(major.slug)?major.slug:
   linkedByVocational[major.slug]||
   linkedByAcademicName[major.name]||
   legacyByName.get(major.name)?.slug||'';
}
export function companyMatchesSelectedMajor(company:DomesticCompany,slug:string):boolean{
 if(company.entityKind==='business')return false;
 const major=majorById(slug);if(!major)return false;
 const canonical=canonicalMajorSlug(major);
 if(!canonical)return false; // Avoid inventing matches from a major name alone.
 return matchingMajors(company).some(m=>m.slug===canonical);
}
const normalized=(x:string)=>x.toLocaleLowerCase().replace(/\s+/g,'');
const aliases:Record<string,string[]>={
 '华域视觉科技（上海）有限公司':['electrical-engineering','automation','mechanical-engineering','vehicle-engineering','electronic-information','optoelectronics','computer-science','materials-engineering']
};
// These are business-related suggestions, never assertions that an opening exists.
export function matchingMajors(company:DomesticCompany):MajorDefinition[]{
 const prof=(allReviewedProfiles as Record<string,{majorSlugs?:string[]}>)[company.name];
 if(prof?.majorSlugs?.length)return prof.majorSlugs.map(slug=>majorById(slug)).filter((x):x is MajorDefinition=>Boolean(x));
 const curated=aliases[company.name];
 if(curated)return curated.map(slug=>majorById(slug)).filter((x):x is MajorDefinition=>Boolean(x));
 if(company.status!=='industry_reviewed'||!company.tags.length)return [];
 const terms=company.tags.map(normalized);
 return MAJORS.filter(major=>major.keywords.some(keyword=>terms.some(tag=>tag.includes(normalized(keyword))||normalized(keyword).includes(tag)&&tag.length>=3)));
}
export type MajorCompanyResult={company:DomesticCompany;matchedTags:string[]};
export function companiesForMajor(slug:string,limit=80):MajorCompanyResult[]{
 const major=majorById(slug);
 if(!major)return [];
 const all=getDomesticCompanies();
 const result=all.filter(company=>companyMatchesSelectedMajor(company,slug))
 .map(company=>({
  company,
  matchedTags:company.tags.filter(t=>major.keywords.some(key=>normalized(t).includes(normalized(key))||normalized(key).includes(normalized(t))&&t.length>=3)).slice(0,3)
 }));
 result.sort((a,b)=>{
  const featured=(c:DomesticCompany)=>Number(Boolean(c.careers))*40+Number(c.name==='华域视觉科技（上海）有限公司')*120+Number(c.status==='industry_reviewed')*20+Number(Boolean(c.parentName))*3;
  return featured(b.company)-featured(a.company)||a.company.name.localeCompare(b.company.name,'zh-CN');
 });
 return result.slice(0,limit);
}
export function relatedCompanyCount(slug:string):number{
 return getDomesticCompanies().filter(c=>companyMatchesSelectedMajor(c,slug)).length;
}
