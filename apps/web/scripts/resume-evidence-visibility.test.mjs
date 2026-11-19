import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceVisibility} from '../src/services/resumeEvidenceVisibility.ts';
const base=[
 {id:'x',section:'experience',text:'销售流程优化、区域门店管理'}
];
test('empty JD evidence does not invent a score',()=>{
 assert.equal(evidenceVisibility([],base).score,null);
});
test('same text evidence rubric shows only wording coverage changes',()=>{
 const requirements=['销售流程优化','客户关系管理'];
 const before=evidenceVisibility(requirements,base);
 const after=evidenceVisibility(requirements,[...base,
  {id:'y',section:'skills',text:'客户关系管理'}]);
 assert.equal(before.score,50);
 assert.equal(after.score,100);
 assert.equal(after.present.length,2);
});
test('duplicate requirements do not count twice and missing remains visible',()=>{
 const result=evidenceVisibility(['销售流程优化','销售流程优化','数据可视化'],base);
 assert.equal(result.total,2);
 assert.equal(result.missing.length,1);
 assert.equal(result.missing[0],'数据可视化');
});
