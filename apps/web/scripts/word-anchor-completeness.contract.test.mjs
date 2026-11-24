import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {browserWordAnchors,paintBrowserWordSuggestions} from '../src/services/browserWordPreview.ts';
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

test('PDF comparison normalizes Chinese punctuation but preserves the Word original',()=>{
 const original='工作职责：持续改善门店运营';
 const normalized='工作职责:持续改善门店运营';
 const viewport={width:820,height:1100,transform:[1,0,0,1,0,0],
  convertToViewportPoint:(x,y)=>[x,1100-y]};
 const item={str:normalized,transform:[1,0,0,1,50,900],
  width:320,height:16,fontName:'F1'};
 const matches=matchWordAnchors({editableText:[original],items:[item],viewport,page:1});
 assert.equal(matches.length,1);
 assert.equal(matches[0].text,original,'save must use original DOCX text, not PDF-normalized text');
 const collision=matchWordAnchors({editableText:[original,normalized],
  items:[item],viewport,page:1});
 assert.equal(collision.length,0,'NFKC collision must not be treated as uniquely editable');
 const viewer=readFileSync(new URL('../src/components/OriginalWordViewer.tsx',import.meta.url),'utf8');
 assert.match(viewer,/original\.normalize\('NFKC'\)/);
 assert.match(viewer,/counts\.get\(key\)===1/);
});


test('long editable Word run and long AI expansion remain visible and actionable',()=>{
 const source='真实经历与工作过程。'.repeat(200);
 const proposed=source+'结合目标岗位突出已有工作职责。'.repeat(10);
 assert.ok(source.length>1600&&proposed.length>1600);
 const page={},attributes=new Map(),classes=new Set();
 const node={textContent:source,querySelector:()=>null,closest:()=>page,
  getAttribute:k=>attributes.get(k)??null,setAttribute:(k,v)=>attributes.set(k,v),
  removeAttribute:k=>attributes.delete(k),
  classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},
  replaceChildren(...parts){this.textContent=parts.map(p=>p.textContent).join('');},
  getBoundingClientRect:()=>({left:40,top:50,width:440,height:80})};
 const mount={querySelectorAll:s=>s==='section.hhba-native-docx'?[page]:
  s==='section.hhba-native-docx span'?[node]:[],
  getBoundingClientRect:()=>({left:0,top:0,width:800,height:1200}),
  offsetWidth:800,offsetHeight:1200,scrollWidth:800,scrollHeight:1200};
 const oldStyle=globalThis.getComputedStyle,oldDocument=globalThis.document;
 globalThis.getComputedStyle=()=>({fontFamily:'Arial'});
 globalThis.document={createTextNode:textContent=>({textContent}),createElement:()=>({textContent:''})};
 try{
  assert.equal(browserWordAnchors(mount,[source])[0].text,source);
  paintBrowserWordSuggestions(mount,[source],[{original:source,proposed,state:'pending'}]);
  assert.equal(node.textContent,proposed);
  assert.ok(classes.has('hhba-word-inline-suggestion'));
  assert.equal(browserWordAnchors(mount,[source])[0].text,source,'save uses original even after rainbow preview');
 }finally{
  if(oldStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=oldStyle;
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
