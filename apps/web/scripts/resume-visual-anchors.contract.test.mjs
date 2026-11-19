import test from 'node:test';
import assert from 'node:assert/strict';
import {matchVisualRegionsToPdfPage} from '../src/services/resumeVisualAnchors.mjs';
const viewport={width:600,height:800,transform:[1,0,0,-1,0,800],
 convertToViewportPoint:(x,y)=>[x,800-y]};
const item={str:'负责区域门店运营与销售数据分析',transform:[13,0,0,13,60,680],width:200,height:16};
const proposal={id:'p1-r1',page:1,kind:'experience',bbox:[88,108,380,100],
 text:'负责区域门店运营与销售数据分析'};
const match=(regions,items=[item])=>matchVisualRegionsToPdfPage({regions,items,viewport,page:1});
test('only a genuine matching text object in correct position produces a clickable region',()=>{
 const a=match([proposal]);
 assert.equal(a.length,1);
 assert.equal(a[0].verified,true);
 assert.equal(a[0].id,'p1-r1');
 assert.match(a[0].source_text,/销售数据分析/);
 assert.ok(a[0].bbox[0]>=90&&a[0].bbox[0]<=110);
});
test('never accepts hallucinated model text, wrong page or wrong column',()=>{
 assert.deepEqual(match([{...proposal,text:'虚构了一大堆工作成果与业绩'}]),[]);
 assert.deepEqual(match([{...proposal,page:2}]),[]);
 assert.deepEqual(match([{...proposal,bbox:[540,105,280,100]}]),[]);
 assert.deepEqual(match([{...proposal,bbox:[560,105,200,100]}]),[]);
 assert.deepEqual(match([{...proposal,bbox:[10,700,400,120]}]),[]);
});
test('never enables edit controls for scanned PDFs without native text objects',()=>{
 assert.deepEqual(match([proposal],[]),[]);
 assert.deepEqual(match([proposal],[{...item,str:' '}]),[]);
});
test('requires enough source evidence, not one matching job title or repeated short name',()=>{
 assert.deepEqual(match([{...proposal,text:'销售'}]),[]);
 assert.deepEqual(match([{...proposal,text:'门店运营'}]),[]);
});
test('de-duplicates matching ids and rejects unsafe geometries',()=>{
 const a=match([proposal,proposal,{...proposal,id:'p1-r2',bbox:[-1,20,50,50]}]);
 assert.equal(a.length,1);
 assert.equal(a[0].id,'p1-r1');
});
