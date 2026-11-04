import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nzPathways,nzVerifiedOn,overseasCountryOptions,overseasCategoryLabels} from '../src/data/overseasNewZealand.ts';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const page=read('../src/pages/OverseasDevelopmentPage.tsx');
const main=read('../src/main.tsx');
const shell=read('../src/components/Shell.tsx');
const css=read('../src/styles/overseas-development.css');
test('新西兰已收录 7 条明确区分的合法路径',()=>{
 assert.equal(nzVerifiedOn,'2026-11-04');
 assert.equal(nzPathways.length,7);
 assert.equal(new Set(nzPathways.map(x=>x.id)).size,7);
 assert.deepEqual([...new Set(nzPathways.map(x=>x.category))].sort(),Object.keys(overseasCategoryLabels).sort());
 for(const p of nzPathways){
  assert.ok(p.name.length>=5&&p.summary.length>30,p.id+' summary');
  assert.ok(p.requirement.length>=3&&p.documents.length>=3&&p.steps.length>=4,p.id+' process');
  assert.ok(p.fees.length>=1&&p.rights.length>=1&&p.risks.length>=1,p.id+' disclosures');
  assert.ok(p.officialUrl.startsWith('https://www.immigration.govt.nz/'),p.id+' official URL');
  assert.ok(p.availability==='check-official'||p.availability==='closed');
  assert.ok(!/保证成功|包签|100%获批|无条件移民|无条件工签/.test(JSON.stringify(p)),p.id);
 }
});
test('中国公民打工度假关闭且限制被明确标出',()=>{
 const whv=nzPathways.find(p=>p.id==='nz-china-whv');
 assert.equal(whv?.availability,'closed');
 assert.match(whv.requirement.join(' '),/18岁/);
 assert.match(whv.requirement.join(' '),/1,000/);
 assert.match(whv.risks.join(' '),/关闭/);
 assert.match(page,/查看官方开放状态/);
});
test('严格区分 Tier 1 和 Tier 2 两种居留路径及 AEWV',()=>{
 assert.ok(nzPathways.some(p=>p.id==='nz-green-tier1'&&p.english==='Straight to Residence Visa'));
 assert.ok(nzPathways.some(p=>p.id==='nz-green-tier2'&&p.english==='Work to Residence Visa'&&p.requirement.join('').includes('24个月')));
 assert.ok(nzPathways.some(p=>p.id==='nz-aewv'&&p.requirement.join('').includes('30小时')));
});
test('原有大学资料路由保留，新首页/国家/详情/收藏/对比接线',()=>{
 assert.match(shell,/to="\/study-abroad"/);
 assert.match(shell,/>海外发展<\/Link>/);
 for(const path of ['/study-abroad/country/new-zealand','/study-abroad/legacy','/study-abroad/match','/study-abroad/saved','/study-abroad/compare'])assert.ok(main.includes(path),path);
 assert.match(main,/route\.startsWith\('\/study-abroad\/'\)/);
 assert.match(main,/StudyAbroadPage/);
 assert.match(main,/OverseasDevelopmentPage/);
 assert.ok(page.includes('localStorage.setItem'),'browser-local persistence');
 assert.ok(page.includes("view==='compare'"));
 assert.ok(page.includes('官方当前关闭'));
 assert.ok(page.includes("to={root+'/legacy'}"));
});
test('8国展示，新西兰、澳大利亚、日本、德国和加拿大已收录，其余国家仍为规划中',()=>{
 assert.equal(overseasCountryOptions.length,8);
 assert.deepEqual(overseasCountryOptions.filter(c=>c.ready).map(c=>c.code),['nz','au','jp','de','ca']);
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(css.includes('.hhba-overseas-path-grid'));
});
