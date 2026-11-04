import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const shell=read('src/components/Shell.tsx');
const main=read('src/main.tsx');
const index=read('src/services/siteSearchIndex.ts');
const page=read('src/pages/SiteSearchPage.tsx');
const css=read('src/styles/site-search.css');

test('search is visible in public, candidate and employer navigation',()=>{
 assert.equal((shell.match(/<HeaderSiteSearch\/>/g)||[]).length,3);
 assert.match(shell,/role="search"/);
 assert.match(shell,/aria-label="搜索 HHBA 站内所有公开内容"/);
 assert.match(shell,/navigate\('\/search'/);
 assert.match(css,/\.hhba-header-site-search/);
 assert.match(css,/@media\(max-width:680px\)/);
});
test('search route is lazy and isolated from the current homepage layout',()=>{
 assert.match(main,/lazy\(\(\)=>import\('\.\/pages\/SiteSearchPage'\)/);
 assert.match(main,/route==='\/search'/);
 assert.doesNotMatch(read('src/pages/HomePage.tsx'),/siteSearchIndex|SiteSearchPage/);
});
test('search indexes real HHBA public data and canonical internal routes',()=>{
 for(const term of ['getDomesticCompanies()','employerProfiles','TALENT_POLICY_RECORDS','TALENT_HOUSING_RECORDS','studyDirections','universities','universityPrograms']){
   assert.ok(index.includes(term),term+' must be indexed');
 }
 for(const path of ['/talent-service/policy/','/talent-service/housing/','/companies/autumn/','/study-abroad/university/','/study-abroad/program/']){
   assert.ok(index.includes(path),path+' missing internal detail route');
 }
 assert.match(index,/startsWith\('\/'\)/);
 assert.match(index,/new Map<string,SiteSearchRecord>\(\)/);
});
test('search results always link inside HHBA and preserve the existing job API',()=>{
 assert.match(page,/listJobs\(/);
 assert.match(page,/safeOfficialJobUrl/);
 assert.match(page,/role="status"/);
 assert.match(page,/key=\{r.kind\+':\'\+r.id\}/);
 assert.match(page,/to=\{r.path\}/);
 assert.match(page,/\/candidate\/jobs\?q=/);
 assert.match(page,/setPage\(1\)/);
 assert.match(page,/setJobError/);
});
test('private data is excluded from the public index',()=>{
 for(const forbidden of ['realAuth.me','privateResume','getRealAuthToken','adminWorkspace','localStorage','sessionStorage','/api/resumes']){
   assert.ok(!index.includes(forbidden),forbidden+' leaked into index');
 }
 assert.match(page,/不搜索用户简历、私人收藏、账号信息或内部管理数据/);
});
