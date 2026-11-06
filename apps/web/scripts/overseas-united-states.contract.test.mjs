import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usPathways,usNotEligible,usVerifiedOn} from '../src/data/overseasUnitedStates.ts';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('美国16条官方路径，每条具有8个完整内容模块、FAQ与可核验来源',()=>{
 assert.equal(usVerifiedOn,'2026-11-06');
 assert.equal(usPathways.length,16);
 assert.equal(new Set(usPathways.map(p=>p.id)).size,16);
 const domains=new Set(['www.uscis.gov','travel.state.gov','j1visa.state.gov','content.govdelivery.com','uscode.house.gov']);
 for(const p of usPathways){
  assert.match(p.id,/^us-[a-z0-9-]+$/);
  assert.ok(p.name.length>=5&&p.summary.length>50&&p.audience.length>25,p.id);
  assert.ok(domains.has(new URL(p.officialUrl).hostname),p.id+' official domain');
  for(const key of ['requirements','documents','steps','fees','rights','risks','timing','future']){
   assert.ok(p[key].length>=2,p.id+':'+key);
   assert.ok(p[key].every(v=>v.length>=12),p.id+':'+key+' short');
  }
  assert.ok(p.faq.length>=2,p.id+' faq');
  assert.ok(p.sources.length>=2&&p.sources.every(s=>s.url.startsWith('https://')),p.id+' sources');
  assert.ok(!/包获批|100%拿绿卡|购岗保签|永久包就业/.test(JSON.stringify(p)),p.id+' misleading claim');
 }
});
test('签证、培训授权、绿卡程序要严格区分',()=>{
 const byId=Object.fromEntries(usPathways.map(p=>[p.id,JSON.stringify(p)]));
 for(const id of ['us-cpt','us-opt','us-stem-opt'])assert.match(byId[id],/不是.*签证|并非独立.*签证/);
 assert.match(byId['us-h1b'],/2027财年|FY2027/);
 assert.match(byId['us-h1b'],/加权/);
 assert.match(byId['us-h1b'],/100万美元|10万美元|10万.*美元/);
 assert.match(byId['us-eb1a'],/2023-08-01|2023年8月1日/);
 assert.match(byId['us-eb2-niw'],/2021-10-01|2021年10月1日/);
 assert.match(byId['us-eb3'],/2022-01-22|2022年1月22日/);
 assert.match(byId['us-eb5'],/80万美元|80万.*美元/);
 assert.match(JSON.stringify(usNotEligible),/E-2/);
});
test('美国独立国家页：国家真实图片，路由和核心交互已接线',()=>{
 const main=read('../src/main.tsx');
 const page=read('../src/pages/UnitedStatesDevelopmentPage.tsx');
 const countries=read('../src/data/overseasNewZealand.ts');
 const home=read('../src/pages/OverseasDevelopmentPage.tsx');
 for(const suffix of ['country/united-states','united-states/pathway/','united-states/match','united-states/saved','united-states/compare'])assert.ok(main.includes('/study-abroad/'+suffix),suffix);
 assert.match(main,/UnitedStatesDevelopmentPage/);
 assert.match(countries,/code:'us'.*ready:true/);
 assert.match(home,/c.code==='us'\?root\+'\/country\/united-states'/);
 for(const phrase of ['usPathways','usNotEligible','usQuickSources','localStorage','us.webp','detail.faq','detail.sources'])assert.ok(page.includes(phrase),phrase);
});
