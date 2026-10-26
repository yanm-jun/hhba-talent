// HHBA 智能网申助手：纯函数；不得输出、上传或缓存敏感网页内容。
export const PROFILE_FIELDS = [
  ["fullName","姓名"],["phone","手机号"],["email","邮箱"],["school","毕业院校"],
  ["major","所学专业"],["education","最高学历"],["degree","最高学位"],
  ["enrollment","入学年月"],["graduation","毕业年月"],["city","所在城市"],
  ["skills","技能特长"],["experience","工作或实习经历"],["projects","项目经历"],
  ["summary","个人简介"]
];
export const EMPTY_PROFILE=Object.freeze(Object.fromEntries(PROFILE_FIELDS.map(([id])=>[id,""])));
const SAFE_KEYS=new Set(PROFILE_FIELDS.map(([key])=>key));
const LIMITS={fullName:80,phone:40,email:160,school:180,major:150,education:50,degree:50,
  enrollment:20,graduation:20,city:100,skills:2000,experience:12000,projects:12000,summary:4000};
export function normalizeProfile(input){
  const obj=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const source=obj.schema==="hhba-apply-profile-v1"&&obj.profile&&typeof obj.profile==="object"?obj.profile:obj;
  const result={};
  for(const key of SAFE_KEYS)result[key]=(typeof source[key]==="string"?source[key].trim():"").slice(0,LIMITS[key]);
  return result;
}
export function validateProfile(input){
  const p=normalizeProfile(input);
  const count=Object.values(p).filter(Boolean).length;
  if(!count)throw Error("档案是空的。请先填写至少一项真实资料。");
  if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw Error("邮箱格式有误，请核对。");
  return p;
}
export function exportProfile(p){
 return JSON.stringify({schema:"hhba-apply-profile-v1",exportedAt:new Date().toISOString(),profile:validateProfile(p)},null,2);
}
const EXCLUDED=/(验证码|校验码|短信|口令|密码|密钥|身份证|证件号码|家庭|亲属|紧急联系|联系人|健康|疾病|婚姻|民族|宗教|籍贯|户口|诚信|承诺|同意|授权|隐私|调查|是否|签名|单位名称|公司名称|企业名称|工作单位|招聘单位|报名号|政治面貌|党派|持证|军人|薪资|工资|待遇|出生|年龄|性别|民族|公民身份|护照|税号|社保|bank|password|captcha|verify|otp|consent|agreement|terms|privacy|company|employer|reference|referee|emergency|government.id)/i;
const RULES=[
 ["email",/(电子邮箱|电子邮件|邮箱地址|e-?mail)/i],
 ["phone",/(手机号|手机号码|联系电话|联系手机|本人电话|^手机$|^电话$|phone|mobile|tel\b)/i],
 ["fullName",/(^姓名$|^真实姓名$|^中文姓名$|^应聘人姓名$|^候选人姓名$|^本人姓名$|^name$|^full.?name$)/i],
 ["school",/(毕业学校|毕业院校|就读院校|学校名称|^学校$|^院校$|university|college|school)/i],
 ["major",/(所学专业|专业名称|毕业专业|^专业$|major\b)/i],
 ["education",/(最高学历|学历层次|^学历$|education.level|academic.qualification)/i],
 ["degree",/(最高学位|所获学位|^学位$|degree)/i],
 ["enrollment",/(入学时间|入学年月|入校时间|开始就读|入学日期)/i],
 ["graduation",/(毕业时间|毕业年月|毕业日期|预计毕业|毕业年份)/i],
 ["city",/(^所在城市$|^现居城市$|^居住城市$|^现居地$|^当前城市$)/i],
 ["skills",/(^技能特长$|^专业技能$|^技能$|^擅长技能$)/i],
 ["experience",/(^工作经历$|^实习经历$|^个人经历$)/i],
 ["projects",/(^项目经历$|^项目经验$|^科研项目$)/i],
 ["summary",/(^个人简介$|^自我评价$|^自我介绍$)/i]
];
const norm=x=>String(x??"").replace(/[\s:：*（）()【】\[\]：.·_-]/g,"").toLowerCase();
const EDUCATION_ALIASES={
 "本科":["本科","大学本科","本科学历"],"硕士":["硕士","硕士研究生","研究生(硕士)"],"博士":["博士","博士研究生"],
 "大专":["大专","专科","大学专科"],"高中":["高中","普通高中"],"中专":["中专"],
 "学士":["学士","学士学位"],"硕士学位":["硕士","硕士学位"],"博士学位":["博士","博士学位"]
};
export function optionFor(options,value,key){
 const wanted=norm(value);
 const usable=(options||[]).filter(o=>!o.disabled&&norm(o.text||o.label||o.value));
 const exact=usable.filter(o=>norm(o.text||o.label)===wanted);
 if(exact.length===1)return exact[0];
 if(key!=="education"&&key!=="degree")return null;
 const synonyms=EDUCATION_ALIASES[value]||[];
 const found=usable.filter(o=>synonyms.some(s=>norm(s)===norm(o.text||o.label)));
 return found.length===1?found[0]:null;
}
export function classifyField(field){
 const label=[field.label,field.placeholder,field.name,field.idAttribute].filter(Boolean).join(" ");
 const primary=String(field.label||field.placeholder||field.name||field.idAttribute||"")
  .replace(/[（(]\s*(?:必填|选填|可选|required)\s*[）)]/gi,"")
  .replace(/[\s*＊:：]/g,"").trim();
 if(field.excluded||EXCLUDED.test(label))return null;
 if(field.kind==="checkbox"||field.kind==="radio"||field.kind==="file"||field.kind==="password")return null;
 if(field.type==="email"&&(!primary||/e-?mail|邮箱/i.test(label)))return "email";
 if(field.type==="tel"&&(!primary||/(电话|手机|phone|tel|mobile)/i.test(label)))return "phone";
 const exact=RULES.filter(([key,pattern])=>pattern.test(primary));
 if(exact.length===1)return exact[0][0];
 // name/id may be generic; only use when explicit label is missing.
 if(!field.label&&!field.placeholder) {
   const secondary=RULES.filter(([key,pattern])=>pattern.test(String(field.name||"")));
   return secondary.length===1?secondary[0][0]:null;
 }
 return null;
}
export function planFields(fields,profile){
 const p=normalizeProfile(profile);
 return (fields||[]).map(field=>{
  const key=classifyField(field);
  let value=key?p[key]:"";
  let reason="",eligible=false,option=null;
  if(field.value)reason="已有内容，不覆盖";
  else if(field.required&&field.kind==="select"&&(!Array.isArray(field.options)||!field.options.length))reason="动态下拉组件尚未识别，请手动处理";
  else if(!key)reason=field.excluded?"敏感或声明类字段，请本人操作":"无法可靠识别，留给人工";
  else if(!value)reason="求职档案缺少对应信息";
  else if(field.kind==="select"){
   option=optionFor(field.options,value,key);
   if(option){eligible=true;reason="与下拉选项准确匹配"}
   else reason="没有找到唯一且准确的下拉选项";
  }else if(field.kind==="text"||field.kind==="textarea"){
   // 避免将长篇经历塞进普通短输入框、将非法日期塞进日期控件。
   if((key==="experience"||key==="projects"||key==="summary")&&field.kind!=="textarea")reason="长文本需要手动核对";
   else if(field.type==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(value))reason="日期格式需精确到日，请手动填写";
   else if(field.type==="month"&&!/^\d{4}-\d{2}$/.test(value))reason="需要 YYYY-MM 格式";
   else if(field.maxLength>0&&value.length>field.maxLength)reason="超过网页允许的最大字数，请手动精简";
   else{eligible=true;reason="根据资料字段准确匹配"}
  }else reason="此控件需要人工处理";
  return {id:field.id,key:key||"",label:field.label||field.placeholder||field.name||"未命名字段",
   value,optionValue:option?option.value:null,eligible,checked:eligible,reason};
 });
}
