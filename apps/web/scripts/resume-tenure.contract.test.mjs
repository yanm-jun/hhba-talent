import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDocumentedWorkTenure} from '../functions/_lib/resume-tenure.js';
import {verifiedProfile} from '../functions/_lib/resume-match-core.js';

const now=new Date('2026-11-08T00:00:00Z');
const base={education:null,education_evidence:null,experience_years:null,
 experience_evidence:null,skills:[],target_roles:[]};

test('dated professional experience is inferred without model-supplied years',()=>{
 const text='工作经历\n2022.07—2025.09 某科技有限公司 Python 开发工程师\n教育经历\n2018.09—2022.06 某大学本科';
 const tenure=deriveDocumentedWorkTenure(text,now);
 assert.equal(tenure.months,39);
 assert.equal(tenure.years,3.2);
 const profile=verifiedProfile(base,text,now);
 assert.equal(profile.experience_years,3.2);
 assert.ok(text.includes(profile.experience_evidence));
});
test('work date in Chinese characters and currently employed position are supported',()=>{
 const text='工作履历\n2023年7月 - 至今 某信息科技有限公司 软件工程师\n个人评价\n踏实可靠';
 const years=deriveDocumentedWorkTenure(text,now);
 assert.equal(years.months,40); // Jul 2023 through Oct 2026 are complete.
 assert.equal(years.years,3.3);
});
test('overlapping employment intervals are not double-counted',()=>{
 const text='工作经历\n2021.01 - 2022.12 甲有限公司 数据分析师\n2022.07 - 2023.06 乙科技有限公司 数据工程师';
 const t=deriveDocumentedWorkTenure(text,now);
 assert.equal(t.months,30);
 assert.equal(t.years,2.5);
 assert.equal(t.interval_count,2);
});
test('separate professional periods add but do not fill gaps',()=>{
 const text='工作经历\n2020.01 - 2020.12 甲有限公司 研发工程师\n2022.01 - 2022.12 乙有限公司 研发工程师';
 assert.equal(deriveDocumentedWorkTenure(text,now).months,24);
});
test('education/project/internship periods do not establish full-time tenure',()=>{
 for(const text of [
  '教育经历\n2018.09—2022.06 某大学 软件开发工程师方向\n项目经历\n2022.07—2025.09 个人项目工程师',
  '实习经历\n2022.07—2025.09 某科技有限公司 Python 开发实习生',
  '工作经历\n2022.07—2025.09 某公司 Python 开发工程师 实习',
  '工作经历\n2022.07—2025.09 某公司兼职开发工程师',
  '工作经历\n2022.07—2025.09 无更多身份信息'
 ])assert.equal(deriveDocumentedWorkTenure(text,now),null,text);
});
test('future, reversed and implausibly long dates are discarded',()=>{
 for(const text of [
  '工作经历\n2027.01—2028.09 某公司 软件工程师',
  '工作经历\n2024.02—2021.01 某公司 软件工程师',
  '工作经历\n1999.01—2026.12 某公司 软件工程师',
  '工作经历\n2022.02—2027.02 某公司 软件工程师'
 ])assert.equal(deriveDocumentedWorkTenure(text,now),null,text);
});
test('project years cannot be turned into verified work years by model text',()=>{
 const text='项目经历：Python 项目经验3年。实习3年。技能：Python';
 const claimed=verifiedProfile({...base,experience_years:3,experience_evidence:'项目经验3年'},text,now);
 assert.equal(claimed.experience_years,null);
 const claim2=verifiedProfile({...base,experience_years:3,experience_evidence:'实习3年'},text,now);
 assert.equal(claim2.experience_years,null);
});
test('incorrect AI duration cannot override explicit evidence',()=>{
 const text='数据分析工作3年；熟悉 SQL 和 Python';
 const out=verifiedProfile({...base,experience_years:7,experience_evidence:'数据分析工作3年'},text,now);
 assert.equal(out.experience_years,null);
 assert.equal(out.experience_evidence,null);
});
test('explicit full-time years continue to work without date ranges',()=>{
 const text='Python 开发工作3年，熟悉 SQL';
 const result=verifiedProfile({...base,experience_years:3,experience_evidence:'Python 开发工作3年'},text,now);
 assert.equal(result.experience_years,3);
 assert.equal(result.experience_evidence,'Python 开发工作3年');
});
test('invalid missing history cannot fabricate employment',()=>{
 assert.equal(deriveDocumentedWorkTenure('',now),null);
 assert.equal(deriveDocumentedWorkTenure('职业规划\n2020.01—2024.12 某公司 工程师',now),null);
});
