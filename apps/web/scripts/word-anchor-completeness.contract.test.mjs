import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWordAnchors} from '../src/services/browserWordPreview.ts';
import {matchWordAnchors} from '../src/services/resumeWordAnchors.mjs';

const text=Array.from({length:72},(_,i)=>'第'+String(i+1)+'段：虚构工作经历文字'+String(i+1));
function renderedWord(offset=0,duplicate=false){
 const first={},second={};
 const bounds={left:90,top:40-offset,width:820,height:3000};
 const elements=text.map((value,i)=>({
  textContent:value,
  getAttribute:()=>null,
  querySelector:()=>null,
  closest:()=>i<40?first:second,
  getBoundingClientRect:()=>({
   left:bounds.left+40,top:bounds.top+20+i*36,width:460,height:19
  })
 }));
 if(duplicate)elements.push({...elements[60]});
 return {
  querySelectorAll:selector=>selector==='section.hhba-native-docx'?
   [first,second]:selector==='section.hhba-native-docx span'?elements:[],
  getBoundingClientRect:()=>bounds,
  offsetWidth:820,offsetHeight:3000,
  scrollWidth:820,scrollHeight:3000
 };
}

test('browser Word keeps all verified edit anchors, including items 5-7 and page two',()=>{
 const old=globalThis.getComputedStyle;
 globalThis.getComputedStyle=()=>({fontFamily:'Arial'});
 try{
  for(const scrollOffset of [0,650]){
   const anchors=browserWordAnchors(renderedWord(scrollOffset),text);
   assert.equal(anchors.length,72,'all 72 runs must remain interactive');
   assert.deepEqual(anchors.slice(-3).map(x=>x.text),text.slice(-3));
   assert.equal(anchors[70].page,2);
   assert.ok(anchors.every(a=>a.bbox.every(Number.isFinite)));
  }
 }finally{
  if(old===undefined)delete globalThis.getComputedStyle;
  else globalThis.getComputedStyle=old;
 }
});

test('browser Word rejects ambiguous repeated content even after item 35',()=>{
 const old=globalThis.getComputedStyle;
 globalThis.getComputedStyle=()=>({fontFamily:'Arial'});
 try{
  const anchors=browserWordAnchors(renderedWord(0,true),text);
  assert.equal(anchors.length,71);
  assert.ok(!anchors.some(x=>x.text===text[60]));
  assert.ok(anchors.some(x=>x.text===text[71]));
 }finally{
  if(old===undefined)delete globalThis.getComputedStyle;
  else globalThis.getComputedStyle=old;
 }
});

test('renderer/PDF mode also keeps 72 uniquely positioned runs',()=>{
 const items=text.map((str,i)=>({
  str,transform:[1,0,0,1,110,2700-i*29],width:460,height:24,fontName:'F1'
 }));
 const viewport={width:820,height:3000,transform:[1,0,0,1,0,0],
  convertToViewportPoint:(x,y)=>[x,3000-y]};
 const anchors=matchWordAnchors({editableText:text,items,viewport,page:1});
 assert.equal(anchors.length,72);
 assert.equal(anchors[71].text,text[71]);
 const ambiguous=matchWordAnchors({editableText:text,
  items:[...items,{...items[60]}],viewport,page:1});
 assert.equal(ambiguous.length,71);
 assert.ok(!ambiguous.some(x=>x.text===text[60]));
});
