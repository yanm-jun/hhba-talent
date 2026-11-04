import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ukPathways,ukNotEligible} from '../src/data/overseasUnitedKingdom.ts';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('eight UK routes have independent official sources and actionable detail',()=>{
 assert.equal(ukPathways.length,8);
 assert.equal(new Set(ukPathways.map(x=>x.id)).size,8);
 for(const p of ukPathways){
  assert.match(p.id,/^uk-[a-z-]+$/);
  assert.equal(new URL(p.officialUrl).hostname,'www.gov.uk');
  assert.ok(p.summary.length>=30&&p.audience.length>=25,p.id);
  for(const key of ['requirements','documents','steps','fees','rights','risks']){
   assert.ok(p[key].length>=2,p.id+':'+key);
   assert.ok(p[key].every(x=>x.length>=15),p.id+':'+key);
  }
 }
});
test('critical 2026 UK rule distinctions are explicit',()=>{
 const byId=Object.fromEntries(ukPathways.map(x=>[x.id,JSON.stringify(x)]));
 assert.match(byId['uk-skilled'],/41,700/);
 assert.match(byId['uk-student'],/1,529/);
 assert.match(byId['uk-graduate'],/2027-01-01/);
 assert.match(byId['uk-hpi'],/Ecctis/);
 assert.ok(ukNotEligible.some(x=>x.detail.includes('中国大陆普通护照')));
 assert.ok(ukNotEligible.some(x=>x.detail.includes('2025-07-22')));
});
test('UK ready destination and routes are wired without replacing other countries',()=>{
 const m=read('../src/main.tsx'),countries=read('../src/data/overseasNewZealand.ts'),home=read('../src/pages/OverseasDevelopmentPage.tsx');
 assert.match(m,/country\/united-kingdom/);
 assert.match(m,/UnitedKingdomDevelopmentPage/);
 assert.match(countries,/code:'uk'.*ready:true/);
 assert.match(home,/c.code==='uk'\?root\+'\/country\/united-kingdom'/);
 for(const code of ['new-zealand','australia','japan','germany','canada'])assert.ok(m.includes('country/'+code),'missing existing route '+code);
});
