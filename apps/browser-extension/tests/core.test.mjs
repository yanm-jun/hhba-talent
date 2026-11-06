import test from "node:test";
import assert from "node:assert/strict";
import {normalizeProfile,validateProfile,planFields,optionFor,exportProfile,classifyField} from "../core.mjs";
const base={fullName:"李明",phone:"13800138000",email:"li@example.com",school:"某大学",education:"本科",degree:"学士"};
const f=(id,label,kind="text",options=[],more={})=>({id,label,kind,type:"text",value:"",options,...more});
test("导出与导入采用相同安全 schema",()=>{
 const file=JSON.parse(exportProfile(base));
 assert.equal(file.schema,"hhba-apply-profile-v1");
 assert.equal(validateProfile(file).fullName,"李明");
 assert.equal(normalizeProfile({fullName:"a",secret:"x"}).secret,undefined);
});
test("敏感、声明、工作单位和不明确字段不能自动填写",()=>{
 for(const name of ["身份证号码","政治面貌","家庭联系人","诚信承诺","企业名称","验证码","同意隐私政策"]){
  assert.equal(planFields([f("a",name)],base)[0].eligible,false,name);
 }
 assert.equal(classifyField(f("f","姓名")), "fullName");
});
test("已有内容不覆盖；匹配基础资料",()=>{
 const result=planFields([f("a","姓名"),f("b","手机号"),f("c","电子邮箱"),f("d","毕业学校","text",[],{value:"已有"})],base);
 assert.deepEqual(result.map(x=>x.eligible),[true,true,true,false]);
});
test("学历精准匹配，禁止非全日制误选",()=>{
 const options=[{text:"非全日制本科",value:"other"},{text:"本科",value:"bachelor"}];
 assert.equal(optionFor(options,"本科","education").value,"bachelor");
 assert.equal(optionFor([{text:"非全日制本科",value:"other"}],"本科","education"),null);
});
test("学历学位分开匹配",()=>{
 const out=planFields([f("x","最高学历","select",[{text:"本科",value:"u"}]),f("y","最高学位","select",[{text:"学士",value:"b"}])],base);
 assert.deepEqual(out.map(x=>x.optionValue),["u","b"]);
});
test("未知字段与长篇经历不强制填写",()=>{
 const out=planFields([f("a","选项不明"),f("b","工作经历")],{...base,experience:"参加若干实践"});
 assert.equal(out[0].eligible,false);assert.equal(out[1].eligible,false);
});
test("没有档案阻止使用",()=>assert.throws(()=>validateProfile({}),/空的/));

test("长文本、日期和最大输入长度不强制误填",()=>{
 const value={...base,major:"人工智能",enrollment:"2025-09",summary:"项目成果总结"};
 assert.equal(planFields([f("a","所学专业","text",[],{maxLength:2})],value)[0].eligible,false);
 assert.equal(planFields([f("b","入学年月","text",[],{type:"month"})],value)[0].eligible,true);
 assert.equal(planFields([f("c","个人简介","text")],value)[0].eligible,false);
});

test("国内网申的冒号、必填星号与常见括号不会破坏字段识别",()=>{
 for(const name of ["姓名：*","* 姓名","姓名（必填）","真实姓名（必填）"]){
  assert.equal(classifyField(f("field",name)),"fullName",name);
 }
 assert.equal(classifyField(f("field","FULL NAME")),"fullName");
});
