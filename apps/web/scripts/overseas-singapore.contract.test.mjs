import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sgPathways,sgNotEligible,sgVerifiedOn} from '../src/data/overseasSingapore.ts';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('新加坡九条独立官方路径均具有详细资格与材料',()=>{
 assert.equal(sgVerifiedOn,'2026-11-06');assert.equal(sgPathways.length,9);assert.equal(new Set(sgPathways.map(p=>p.id)).size,9);
 for(const p of sgPathways){assert.match(p.id,/^sg-[a-z-]+$/);assert.match(new URL(p.officialUrl).hostname,/^(www\.)?(mom|ica)\.gov\.sg$/);assert.ok(p.summary.length>35&&p.audience.length>20,p.id);
 for(const key of ['requirements','documents','steps','fees','rights','risks']){assert.ok(p[key].length>=2,p.id+': '+key);assert.ok(p[key].every(x=>x.length>=12),p.id+':'+key);}}
});
test('关键政策差异：工资、雇主配额、学生兼职、永久居民与国民服役',()=>{
 const byId=Object.fromEntries(sgPathways.map(x=>[x.id,JSON.stringify(x)]));
 assert.match(byId['sg-ep'],/COMPASS/);assert.match(byId['sg-s-pass'],/配额/);assert.match(byId['sg-work-permit'],/来源/);assert.match(byId['sg-one-pass'],/30,000/);assert.match(byId['sg-student'],/兼职/);assert.match(byId['sg-pr'],/国民服役/);assert.match(JSON.stringify(sgNotEligible),/中国大陆/);
});
test('Singapore page has routes, save, compare, search, real photo and official sources',()=>{
 const page=read('../src/pages/SingaporeDevelopmentPage.tsx');const main=read('../src/main.tsx');const data=read('../src/data/overseasNewZealand.ts');
 assert.match(main,/study-abroad\/country\/singapore/);assert.match(main,/SingaporeDevelopmentPage/);
 assert.match(page,/sgPathways/);assert.match(page,/sgNotEligible/);assert.match(page,/localStorage/);assert.match(page,/sg.webp/);assert.match(page,/\/singapore\/pathway\//);assert.match(data,/code:'sg'.*ready:true/);
});
