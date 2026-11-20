import test from 'node:test';
import assert from 'node:assert/strict';
import {splitChangedResumeText} from '../src/services/resumeChangedText.mjs';

test('unchanged source text stays neutral with no rainbow span',()=>{
 assert.deepEqual(splitChangedResumeText('负责市场运营','负责市场运营'),{
  prefix:'负责市场运营',changed:'',suffix:'',hasChange:false
 });
});
test('rainbow applies only to inserted/expanded text, never the unchanged source',()=>{
 assert.deepEqual(splitChangedResumeText('负责市场运营','负责市场运营与渠道分析'),{
  prefix:'负责市场运营',changed:'与渠道分析',suffix:'',hasChange:true
 });
});
test('replacement highlights modified phrase while preserving prefix and suffix',()=>{
 assert.deepEqual(splitChangedResumeText('负责区域门店运营及数据','负责全国门店运营及数据'),{
  prefix:'负责',changed:'全国',suffix:'门店运营及数据',hasChange:true
 });
});
test('supplementary Unicode characters and emoji are not cut through surrogate pairs',()=>{
 assert.deepEqual(splitChangedResumeText('项目🚀管理','项目🚀及团队管理'),{
  prefix:'项目🚀',changed:'及团队',suffix:'管理',hasChange:true
 });
});
test('pure deletion leaves no invented colored characters',()=>{
 const result=splitChangedResumeText('负责销售与项目运营','负责销售');
 assert.equal(result.changed,'');
 assert.equal(result.prefix,'负责销售');
 assert.equal(result.hasChange,true);
});
