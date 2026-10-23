import { getDomesticCompanies, type DomesticCompany } from './domesticCompanySearch';

export type MajorDefinition={slug:string;name:string;keywords:string[];description:string};
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
const majorBySlug=new Map(MAJORS.map(m=>[m.slug,m]));
export const majorById=(slug:string)=>majorBySlug.get(slug)||null;
const normalized=(x:string)=>x.toLocaleLowerCase().replace(/\s+/g,'');
const aliases:Record<string,string[]>={
 '华域视觉科技（上海）有限公司':['electrical-engineering','automation','mechanical-engineering','vehicle-engineering','electronic-information','optoelectronics','computer-science','materials-engineering']
};
// These are business-related suggestions, never assertions that an opening exists.
export function matchingMajors(company:DomesticCompany):MajorDefinition[]{
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
 const result=all.filter(company=>matchingMajors(company).some(x=>x.slug===slug)&&company.entityKind!=='business')
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
 return getDomesticCompanies().filter(c=>c.entityKind!=='business'&&matchingMajors(c).some(m=>m.slug===slug)).length;
}
