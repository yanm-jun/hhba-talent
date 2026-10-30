import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const shell=read('../src/components/Shell.tsx');
const main=read('../src/main.tsx');
const page=read('../src/pages/StudyAbroadPage.tsx');
const data=read('../src/data/studyAbroad.ts');
const css=read('../src/styles/study-abroad.css');
test('One main HHBA site, navigation before talent and new deep links',()=>{
 assert.match(shell,/to="\/study-abroad"/);
 assert.ok(shell.indexOf('<StudyAbroadNavLink')<shell.indexOf('<TalentPolicyNavLink'));
 assert.match(main,/route==='\/study-abroad'/);
 assert.match(main,/route\.startsWith\('\/study-abroad\/'\)/);
 assert.match(main,/StudyAbroadPage/);
 assert.match(page,/to=\{'\/study-abroad\/'\+d\.id\}/);
});
test('Six distinct official public resources, honest directional data',()=>{
 for(const marker of ['EducationUSA','Study UK','Study Australia','DAAD','Study in Japan','Study with New Zealand'])assert.ok(data.includes(marker),marker);
 for(const code of ['us','uk','au','de','jp','nz'])assert.ok(data.includes("code:'"+code+"'"),code);
 assert.equal((data.match(/id:'(?:us-public-masters|de-public|jp-masters|uk-taught-masters|au-masters|nz-masters)'/g)||[]).length,6);
 assert.match(page,/不代表某所学校已开放招生/);
 assert.match(page,/费用及申请条件待逐校核实/);
 assert.match(page,/target="_blank" rel="noopener noreferrer"/);
 assert.doesNotMatch(page,/保录成功|保证录取|保证就业|假数据/);
});
test('V1 search/filter/detail/empty-state and responsive styling',()=>{
 for(const marker of ['matchesStudyDirection','role="search"','onSubmit','onChange','chooseCountry','chooseGoal','setQuery','StudyDetail','hhba-study-empty','重置筛选'])assert.ok(page.includes(marker),marker);
 assert.ok(css.includes('@media(max-width:620px)'));
 assert.ok(css.includes('.hhba-study-card-grid'));
});
