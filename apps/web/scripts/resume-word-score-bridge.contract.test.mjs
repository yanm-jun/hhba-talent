import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedWordScoreBlocks} from '../src/services/resumeWordScoreBridge.mjs';
const source=[{id:'e1',section:'experience',text:'真实经历：运营记录；其它经历。'},
 {id:'e2',section:'skills',text:'使用 Word 写作。'}];
const history=[{revision:1,original:'运营记录',text:'运营数据记录'},
 {revision:2,original:'使用 Word',text:'熟练使用 Word'}];
test('only applies exact verified Word revisions to the matching original block',()=>{
 const out=checkedWordScoreBlocks(source,history,2);
 assert.equal(out.ok,true);
 assert.equal(out.applied,2);
 assert.deepEqual(out.blocks.map(x=>x.text),[
  '真实经历：运营数据记录；其它经历。','熟练使用 Word 写作。']);
 assert.deepEqual(source.map(x=>x.text),['真实经历：运营记录；其它经历。','使用 Word 写作。']);
});
test('undo and redo use exactly the active manifest revision count',()=>{
 assert.equal(checkedWordScoreBlocks(source,history,0).blocks[0].text,source[0].text);
 assert.equal(checkedWordScoreBlocks(source,history,1).blocks[0].text,
  '真实经历：运营数据记录；其它经历。');
 assert.equal(checkedWordScoreBlocks(source,history,1).blocks[1].text,source[1].text);
});
test('fails closed for duplicate or missing evidence, unknown revisions and malformed drafts',()=>{
 const duplicated=[...source,{id:'e3',section:'projects',text:'运营记录'}];
 assert.equal(checkedWordScoreBlocks(duplicated,history,1).reason,'WORD_EDIT_AMBIGUOUS');
 assert.equal(checkedWordScoreBlocks(source,[{revision:1,original:'未出现在简历里的文字',text:'虚构'}],1)
  .reason,'WORD_EDIT_OUTSIDE_PROFILE');
 assert.equal(checkedWordScoreBlocks(source,history,3).reason,'WORD_HISTORY_INCOMPLETE');
 assert.equal(checkedWordScoreBlocks(source,[{revision:1,original:'运营记录',text:'运营记录'}],1)
  .reason,'WORD_HISTORY_INCOMPLETE');
 assert.equal(checkedWordScoreBlocks(source,[{revision:1,original:'运营记录',text:'运营数据'}],2)
  .reason,'WORD_HISTORY_INCOMPLETE');
});
test('a partial score must never be shown for a revision with unmappable edits',()=>{
 const out=checkedWordScoreBlocks(source,[...history,
  {revision:3,original:'没记录的事实',text:'夸大的经历'}],3);
 assert.equal(out.ok,false);assert.deepEqual(out.blocks,[]);
});
