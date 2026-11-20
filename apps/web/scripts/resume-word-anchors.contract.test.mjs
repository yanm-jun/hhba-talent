import test from 'node:test';
import assert from 'node:assert/strict';
import {matchWordAnchors} from '../src/services/resumeWordAnchors.mjs';
const viewport={width:600,height:800,transform:[1,0,0,-1,0,800],
 convertToViewportPoint:(x,y)=>[x,800-y]};
const item=(str,x=70,y=700)=>({str,transform:[14,0,0,14,x,y],width:180,height:14});
const anchor=(editableText,items)=>matchWordAnchors({editableText,items,viewport,page:1});
test('unique exact Word text nodes map into original rendered PDF coordinates',()=>{
 const result=anchor(['原始工作经历描述','另一段文字'],[item('原始工作经历描述')]);
 assert.equal(result.length,1);assert.equal(result[0].text,'原始工作经历描述');
 assert.ok(result[0].bbox[0]>=100&&result[0].bbox[2]>100);
});
test('duplicate, split, rotated and invented text never becomes editable',()=>{
 assert.deepEqual(anchor(['原始工作经历描述'],[item('原始工作经历描述'),
  item('原始工作经历描述',70,650)]),[]);
 assert.deepEqual(anchor(['原始工作经历描述'],[item('原始工作'),item('经历描述')]),[]);
 assert.deepEqual(anchor(['原始工作经历描述'],[{...item('原始工作经历描述'),
  transform:[14,1,0,14,70,700]}]),[]);
 assert.deepEqual(anchor(['虚构文字'],[item('原始工作经历描述')]),[]);
});
