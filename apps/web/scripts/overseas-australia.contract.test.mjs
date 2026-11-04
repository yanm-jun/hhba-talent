import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auPathways,auVerifiedOn,auCategoriesCount} from '../src/data/overseasAustralia.ts';
import {nzPathways,overseasCountryOptions} from '../src/data/overseasNewZealand.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('澳大利亚九条真实类别，内容具备实用的申请步骤和官方依据',()=>{
 assert.equal(auVerifiedOn,'2026-11-04');
 assert.equal(auPathways.length,9);
 assert.equal(new Set(auPathways.map(x=>x.id)).size,9);
 assert.deepEqual([...new Set(auPathways.map(x=>x.category))].sort(),['experience','residence','study','work']);
 for(const p of auPathways){
  assert.ok(p.id.startsWith('au-'),p.id);
  assert.ok(p.name.length>4&&p.summary.length>34,p.id+' descriptive');
  assert.ok(p.requirement.length>=3&&p.documents.length>=3&&p.steps.length>=4,p.id+' procedure');
  assert.ok(p.fees.length>=1&&p.rights.length>=1&&p.risks.length>=1,p.id+' costs and limits');
  assert.ok(p.officialUrl.startsWith('https://immi.homeaffairs.gov.au/'),p.id+' official link');
  assert.ok(!/包获批|保证移民|100%获签|无条件移民|购买名额/.test(p.summary),p.id);
 }
 assert.deepEqual(auCategoriesCount,{work:3,residence:4,study:1,experience:1});
});
test('澳洲雇主、独立技术、省州担保、地区和留学正确区分',()=>{
 const get=id=>auPathways.find(x=>x.id===id);
 assert.ok(get('au-482')?.requirement.join(' ').includes('12个月'));
 assert.ok(get('au-186')?.summary.includes('永久'));
 assert.ok(get('au-494')?.requirement.join(' ').includes('3年'));
 assert.ok(get('au-189')?.requirement.join(' ').includes('SkillSelect'));
 assert.ok(get('au-190')?.requirement.join(' ').includes('65分'));
 assert.ok(get('au-491')?.rights.join(' ').includes('5年'));
 assert.ok(get('au-500')?.requirement.join(' ').includes('2026-10-02'));
 assert.ok(get('au-485')?.requirement.join(' ').includes('35岁'));
});
test('中国462打工度假官方2026—27抽签已关闭，拒绝伪造名额',()=>{
 const whv=auPathways.find(x=>x.id==='au-462-china');
 assert.ok(whv&&whv.availability==='closed');
 assert.ok(whv.requirement.join(' ').includes('2026-06-25'));
 assert.ok(whv.requirement.join(' ').includes('Closed'));
 assert.ok(whv.fees.join(' ').includes('AUD 25'));
 const page=read('../src/pages/AustraliaDevelopmentPage.tsx');
 assert.match(page,/本年度登记已关闭/);
 assert.match(page,/查看官方抽签状态/);
});
test('路由保留新西兰全部功能、旧大学及新增澳大利亚独立详情',()=>{
 const main=read('../src/main.tsx');
 const home=read('../src/pages/OverseasDevelopmentPage.tsx');
 const data=read('../src/data/overseasNewZealand.ts');
 const css=read('../src/styles/overseas-australia.css');
 assert.equal(nzPathways.length,7);
 for(const path of ['/study-abroad/country/australia','/study-abroad/australia/pathway/','/study-abroad/australia/saved','/study-abroad/australia/compare','/study-abroad/australia/match','/study-abroad/legacy'])assert.ok(main.includes(path),path);
 assert.deepEqual(overseasCountryOptions.filter(x=>x.ready).map(x=>x.code),['nz','au']);
 assert.match(home,/c\.code==='au'/);
 assert.match(data,/ready:true,description:'雇主担保/);
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(css.includes('commons.wikimedia.org/wiki/Special:FilePath/'));
});
test('澳洲独立本地收藏及三路比较，不伪装成账户云同步',()=>{
 const p=read('../src/pages/AustraliaDevelopmentPage.tsx');
 assert.ok(p.includes('localStorage.setItem'));
 assert.ok(p.includes('a.length>=3'));
 assert.ok(p.includes('尚未实现')||p.includes('尚未接入'));
 assert.ok(p.includes('aria-label="搜索澳大利亚方案"'));
 assert.ok(p.includes('view===\\x27country\\x27')||p.includes("view==='country'"));
});
