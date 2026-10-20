import test from 'node:test';
import assert from 'node:assert/strict';
import {translateWithSourceNumbers} from '../number-locked-translation.mjs';

test('recovers source years without accepting a wrong translation numeral',async()=>{
 const source='At least 5 years of experience in software and 3 years in leadership.';
 const result=await translateWithSourceNumbers(source,async texts=>texts.map((s)=>s
  .replace(/At least/,'至少').replace(/ years of experience in software and /,'年软件经验和')
  .replace(/ years in leadership./,'年领导经验。')));
 assert.equal(result.replace(/\s+(?=\d)/g,''),'至少5年软件经验和3年领导经验。');
});
test('keeps salaries and percentages exactly as the employer wrote',async()=>{
 const source='Salary $182,800 to $238,100 and 80% bonus.';
 const result=await translateWithSourceNumbers(source,async texts=>texts.map(s=>s
  .replace('Salary $','薪资 $').replace(' to $',' 至 $').replace(' and ','，以及 ')
  .replace(' bonus.',' 奖金。')));
 assert.equal(result,'薪资 $182,800 至 $238,100，以及 80% 奖金。');
});
test('rejects injected numbers from translator',async()=>{
 const source='At least 5 years of experience.';
 assert.equal(await translateWithSourceNumbers(source,async arr=>arr.map(()=>'3年经验')),null);
});
test('rejects failed batches and does not silently skip content',async()=>{
 const source='At least 5 years of experience.';
 assert.equal(await translateWithSourceNumbers(source,async()=>null),null);
 assert.equal(await translateWithSourceNumbers('No number here.',async()=>['没有数字。']),null);
});
test('preserves numerical tokens regardless of punctuation style',async()=>{
 const source='Experience: 3-5 years, performance +20% in 2024.';
 const result=await translateWithSourceNumbers(source,async arr=>arr.map(x=>
  x.replace('Experience: ','经验：').replace(' years, performance +','年，表现提升+')
   .replace(' in ','，于').replace('.','。')));
 assert.ok(result);
 assert.deepEqual(result.match(/\d+(?:[.,]\d+)*(?:[%％])?/g),['3','5','20%','2024']);
});
