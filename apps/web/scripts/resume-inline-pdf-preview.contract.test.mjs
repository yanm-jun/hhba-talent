import test from 'node:test';
import assert from 'node:assert/strict';
import {planInlinePdfPreview,whitePdfPatchBackground} from '../src/services/resumeInlinePdfPreview.mjs';
const anchor={
 id:'p1-r1',verified:true,source_text:'ORIGINAL RESUME VIEW',text:'ORIGINAL RESUME VIEW',
 native_line_count:1,bbox:[76,78,410,24]
};
const check=(replacement,options={})=>planInlinePdfPreview({
 anchor:{...anchor,...(options.anchor||{})},
 replacement,pageWidth:595,pageHeight:842,measure:(s,size)=>s.length*size*.57,
 onWhite:options.onWhite??true
});
test('conservatively previews shorter verified one-line edit in original page coordinates',()=>{
 const plan=check('EDITED RESUME VIEW');
 assert.equal(plan.safe,true);
 assert.equal(plan.text,'EDITED RESUME VIEW');
 assert.ok(plan.fontPx>7&&plan.fontPx<30);
});
test('longer and multiline text never covers other PDF content',()=>{
 assert.equal(check('A very long detailed new description which wraps across adjacent lines').safe,false);
 assert.equal(check('NEW\nEXPERIENCE').safe,false);
 assert.equal(check(' ',{}).safe,false);
});
test('coordinates or original source must be verified, not merely suggested by AI',()=>{
 assert.equal(check('EDITED RESUME VIEW',{anchor:{verified:false}}).safe,false);
 assert.equal(check('EDITED RESUME VIEW',{anchor:{source_text:'Different original paragraph'}}).safe,false);
 assert.equal(check('EDITED RESUME VIEW',{anchor:{native_line_count:2}}).safe,false);
 assert.equal(check('EDITED RESUME VIEW',{anchor:{bbox:[990,85,90,24]}}).safe,false);
 assert.equal(check('EDITED RESUME VIEW',{anchor:{bbox:[70,85,200,80]}}).safe,false);
});
test('colored/uncertain PDF backgrounds cannot be covered by a white rectangle',()=>{
 assert.equal(check('EDITED RESUME VIEW',{onWhite:false}).reason,'background');
 const white={width:600,height:800,getContext:()=>({
  getImageData:()=>({data:Uint8ClampedArray.from([255,255,255,255])})
 })};
 const color={width:600,height:800,getContext:()=>({
  getImageData:()=>({data:Uint8ClampedArray.from([30,60,80,255])})
 })};
 assert.equal(whitePdfPatchBackground(white,anchor.bbox),true);
 assert.equal(whitePdfPatchBackground(color,anchor.bbox),false);
 assert.equal(whitePdfPatchBackground(null,anchor.bbox),false);
});
