import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {majorNamesRelated,majorFamilies,educationRequirement,educationMatchesApplicant} from '../src/services/majorEligibility.mjs';
const related=[
 ['机械','机械工程'],['机械','机械设计制造及其自动化'],
 ['机械','机械制造及其自动化'],['机械','机械电子工程'],
 ['机械','智能制造工程'],['机械','机械与自动化'],
 ['自动化','控制科学与工程'],['自动化','机械电子工程'],
 ['机电一体化技术','机械电子工程'],['计算机科学与技术','软件工程'],
 ['电气工程','电气工程及其自动化']
];
for(const [a,b] of related){
 assert(majorNamesRelated(a,b),'Missing academic family '+a+' ↔ '+b);
 assert(majorNamesRelated(b,a),'Asymmetric academic family '+b+' ↔ '+a);
}
for(const [a,b] of [
 ['机械','会计学'],['机械','计算机科学与技术'],
 ['机械','电气工程及其自动化'],['机械','自动化'],
 ['工程管理','机械工程'],['管理','财务管理'],
 ['艺术','人工智能'],['自动化','软件工程']
])assert(!majorNamesRelated(a,b),'Unsupported inferred match: '+a+' → '+b);
assert(majorFamilies('机械').includes('mechanical'));
for(const lower of ['本科','本科及以上','BACHELOR','专科及以上','ASSOCIATE','不限学历']){
 assert(educationMatchesApplicant('MASTER',lower),'Master should not lose lower-minimum job '+lower);
}
assert(educationMatchesApplicant('PHD','MASTER'));
assert(educationMatchesApplicant('PHD','BACHELOR'));
assert(!educationMatchesApplicant('BACHELOR','MASTER'));
assert(!educationMatchesApplicant('MASTER','PHD'));
assert(!educationMatchesApplicant('MASTER','仅限本科毕业生'));
assert(educationMatchesApplicant('BACHELOR','仅限本科毕业生'));
assert(!educationMatchesApplicant('MASTER','2027届校招 · 学历待核实'));
assert(educationMatchesApplicant('UNRESTRICTED_OR_UNREPORTED','2027届校招 · 学历待核实'));
assert(educationMatchesApplicant('UNRESTRICTED','不限学历'));
assert(!educationMatchesApplicant('UNRESTRICTED','本科及以上'));
assert.equal(educationRequirement('硕士及以上').minimum,'MASTER');
const links=[
 ['src/services/majorJobMatching.ts','majorNamesRelated(label,major)'],
 ['src/services/domesticMajors.ts','majorNamesRelated(m.name,major.name)'],
 ['src/services/liveRecruitment.ts','educationMatchesApplicant(f.education,job.educationLabel)'],
 ['src/services/jobSearchFacets.mjs','educationMatchesApplicant(education,f.education||null)'],
 ['src/components/V2EmployerSearchResults.tsx','majorNamesRelated(n,major)'],
 ['src/pages/UnifiedV2CompanyPage.tsx','majorNamesRelated(x,major)']
];
for(const [path,needle] of links)assert(readFileSync(path,'utf8').includes(needle),'Not using shared matching rule: '+path);
const market=readFileSync('src/components/UnifiedJobMarket.tsx','utf8');
assert(market.includes("我的最高学历（按岗位最低学历要求筛选）"),'Applicant degree UI must explain minimum requirement');
console.log('HHBA_ACADEMIC_FAMILY_EDUCATION_HIERARCHY_TEST_PASS',related.length,'positive',links.length,'shared consumers');
