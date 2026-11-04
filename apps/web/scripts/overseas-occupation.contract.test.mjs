import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nzTier1Occupations,au189Occupations,nzGreenListUrl,auOccupationList} from '../src/data/overseasOccupationGuide.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('NZ Tier 1 sample has real searchable codes and meaningful individual explanations',()=>{
 assert.equal(nzTier1Occupations.length,15);
 assert.equal(new Set(nzTier1Occupations.map(x=>x.code)).size,15);
 assert.ok(nzTier1Occupations.every(x=>x.country==='nz'&&x.tier==='Tier 1'&&x.pathwayId==='nz-green-tier1'));
 for(const item of nzTier1Occupations){
  assert.match(item.code,/^\d{6}$/);
  assert.ok(item.name.length>=3&&item.english.length>=8&&item.group.length>=3,item.id);
  assert.ok(item.qualification.length>=1&&item.qualification.join('').length>=60,item.id+' qualifications');
  assert.ok(item.registration.length>=30&&item.wage.length>=40,item.id+' pay and registration');
  assert.ok(item.proof.length>=4&&item.actions.length>=3,item.id+' materials and next steps');
  assert.equal(item.verifiedOn,'2026-11-04');
  assert.ok(item.sources.some(s=>s.url===nzGreenListUrl),item.id+' official Green List');
  assert.ok(item.sources.every(s=>s.url.startsWith('https://')));
 }
 assert.match(nzTier1Occupations.find(x=>x.code==='261313').wage,/72.80/);
 assert.match(nzTier1Occupations.find(x=>x.code==='221213').wage,/45.50/);
 assert.match(nzTier1Occupations.find(x=>x.code==='254418').registration,/Nursing Council/);
});
test('AU 189 first examples have actual codes, assessing authorities and clear no-invitation-guarantee',()=>{
 assert.equal(au189Occupations.length,6);
 assert.equal(new Set(au189Occupations.map(x=>x.code)).size,6);
 for(const item of au189Occupations){
  assert.ok(item.country==='au'&&item.pathwayId==='au-189');
  assert.match(item.code,/^\d{6}$/);
  assert.ok(item.qualification.join('').length>=60&&item.actions.length>=3);
  assert.ok(item.sources.some(s=>s.url===auOccupationList));
  assert.match(item.experience,/没有适用于全部职业/);
 }
 assert.match(au189Occupations.find(x=>x.code==='261313').qualification.join(''),/ACS/);
});
test('Three-level navigation and searchable directory never falsely claim all occupations imported',()=>{
 const component=read('../src/components/OverseasOccupationDirectory.tsx');
 const guide=read('../src/components/OverseasDetailedGuide.tsx');
 const main=read('../src/main.tsx');
 assert.match(component,/not a claim of exhaustive|not a scraped|not a claim of exhaustive|并非完整官方职业名单/);
 assert.match(component,/aria-label=\{'搜索'/);
 assert.match(component,/occupationUrl\(item\)/);
 assert.match(component,/record\.qualification\.map/);
 assert.match(component,/record\.sources\.map/);
 assert.match(component,/未收录不表示不能申请/);
 assert.match(guide,/OverseasOccupationDirectory/);
 assert.match(guide,/nz-green-tier1/);
 assert.match(guide,/au-189/);
 assert.match(main,/\/study-abroad\/nz\/occupation\//);
});
