// Shared conservative academic family and applicant degree rules.
// Relevance is not an employer's official admission decision.
const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\s·．.（）()]/g,'').trim();
const families={
 mechanical:['机械','机械类','机械工程','机械设计制造及其自动化','机械设计制造及自动化','机械电子工程','机械工程及自动化','机械设计及理论','机械制造及其自动化','机械设计与制造','机械制造与自动化','机械工艺技术','机械与自动化','机电一体化','机电一体化技术','机电工程','机电技术教育','材料成型及控制工程','过程装备与控制工程','智能制造工程','智能制造技术','车辆工程','智能车辆工程','机器人工程'],
 control:['自动化','自动化类','控制科学与工程','控制工程','控制理论与控制工程','检测技术与自动化装置','工业自动化','电气自动化技术','机械与自动化','机械设计制造及其自动化','机械设计制造及自动化','机电一体化','机电一体化技术','机械电子工程','智能制造工程','机器人工程','机器人技术'],
 electrical:['电气工程','电气工程及其自动化','电气工程与智能控制','电气类','智能电网信息工程','电力系统及其自动化','电气自动化技术'],
 computer:['计算机','计算机类','计算机科学与技术','计算机技术','软件工程','网络工程','信息安全','网络空间安全','数据科学与大数据技术','人工智能','物联网工程','计算机应用技术'],
 electronic:['电子信息','电子信息类','电子信息工程','电子科学与技术','通信工程','集成电路科学与工程','微电子科学与工程','光电信息科学与工程','光学工程'],
 design:['设计学','设计学类','艺术设计','艺术设计学','产品设计','工业设计','视觉传达设计','数字媒体艺术','环境设计'],
 finance:['经济金融类','金融','金融学','金融工程','经济学','经济类','投资学'],
 medicine:['医学','医学类','临床医学','基础医学','预防医学','护理学','药学']
};
const index=new Map();
for(const [group,names] of Object.entries(families))for(const name of names){
 const k=norm(name);if(!index.has(k))index.set(k,new Set());index.get(k).add(group);
}
export function majorFamilies(name){
 const key=norm(name);if(!key)return [];
 if(index.has(key))return [...index.get(key)];
 // Mechanical sub-disciplines in official postgraduate catalogs.
 if(/^机械(?:工程|设计|制造|电子|工艺|及自动化|与自动化)/.test(key))return ['mechanical'];
 return [];
}
export function majorNamesRelated(label,selected){
 const a=norm(label),b=norm(selected);
 if(!a||!b)return false;
 if(a===b)return true;
 const fa=majorFamilies(a),fb=majorFamilies(b);
 return fa.some(x=>fb.includes(x));
}
const ranks={HIGH_SCHOOL:1,ASSOCIATE:2,BACHELOR:3,MASTER:4,PHD:5};
const degreePatterns=[
 ['HIGH_SCHOOL',/(?:高中|中专|中职|high\s*school|ged)/i],
 ['ASSOCIATE',/(?:专科|大专|高职|associate)/i],
 ['BACHELOR',/(?:本科|学士|bachelor|undergraduate)/i],
 ['MASTER',/(?:硕士|研究生|master|postgraduate)/i],
 ['PHD',/(?:博士|ph\.?d\.?|doctoral|doctorate)/i]
];
export function educationRequirement(value){
 const raw=String(value??'').trim();
 if(!raw)return {minimum:null,only:null};
 const code=raw.toUpperCase();
 if(ranks[code])return {minimum:code,only:null};
 if(code==='UNRESTRICTED'||/(?:不限学历|学历不限|不要求学历|无学历要求|no degree required)/i.test(raw))
  return {minimum:'UNRESTRICTED',only:null};
 const found=degreePatterns.filter(([,pattern])=>pattern.test(raw)).map(([key])=>key);
 if(!found.length)return {minimum:null,only:null};
 found.sort((a,b)=>ranks[a]-ranks[b]);
 const exclusive=/(?:仅限|只招|限招|仅招|仅接受|仅面向).{0,9}(?:博士|硕士|本科|专科)/.exec(raw);
 if(exclusive){
  const only=degreePatterns.find(([,pattern])=>pattern.test(exclusive[0]))?.[0]||null;
  if(only)return {minimum:only,only};
 }
 return {minimum:found[0],only:null};
}
export function educationMatchesApplicant(selection,requirement){
 if(!selection)return true;
 const parsed=educationRequirement(requirement);
 if(selection==='UNRESTRICTED')return parsed.minimum==='UNRESTRICTED';
 if(selection==='UNRESTRICTED_OR_UNREPORTED')return parsed.minimum===null||parsed.minimum==='UNRESTRICTED';
 if(!ranks[selection])return false;
 if(parsed.minimum==='UNRESTRICTED')return true;
 if(!parsed.minimum)return false; // Unknown cannot be asserted eligible.
 if(parsed.only)return selection===parsed.only;
 return ranks[selection]>=ranks[parsed.minimum];
}
