import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWordSiriInkMask} from '../src/services/resumeSiriInk.mjs';

const bbox=[100,100,350,30];
function fixture({background=255,ink=28,width=600,height=800,invalidMask=false}={}){
 const stored={};
 const maskCtx={
  createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
  putImageData:(mask)=>{stored.mask=mask;}
 };
 const documentBefore=globalThis.document;
 globalThis.document={
  createElement(type){
   assert.equal(type,'canvas');
   return {getContext:()=>maskCtx,
    toDataURL:()=>invalidMask?'invalid':'data:image/png;base64,AA=='};
  }
 };
 const canvas={
  width,height,
  getContext:()=>({
   getImageData:(x,y,w=1,h=1)=>{
    const out=new Uint8ClampedArray(w*h*4);
    for(let yi=0;yi<h;yi++)for(let xi=0;xi<w;xi++){
     const at=(yi*w+xi)*4;
     const px=x+xi,py=y+yi;
     // One rectangular "ink" patch within the verified text bbox;
     // never a guessed font painted on the page.
     const black=px>=60&&px<85&&py>=82&&py<98;
     const value=black?ink:background;
     out.set([value,value,value,255],at);
    }
    return {data:out};
   }
  })
 };
 return {canvas,stored,restore:()=>{globalThis.document=documentBefore}};
}
test('safely isolates the original rendered Word glyph pixels, with no document mutation',()=>{
 const f=fixture();
 try{
  const value=makeWordSiriInkMask(f.canvas,bbox);
  assert.ok(value,'white background and edited glyph pixels should produce a mask');
  assert.match(value.maskUrl,/^data:image\/png;base64,/);
  assert.ok(value.inkPixels>10);
  assert.ok(value.bbox[0]>=99&&value.bbox[0]<=101);
  assert.ok(f.stored.mask.data.some((v,i)=>i%4===3&&v>200),'ink is opaque');
  assert.ok(f.stored.mask.data.some((v,i)=>i%4===3&&v===0),'white paper remains transparent');
 }finally{f.restore();}
});
test('does not highlight unverified, colored, empty, or invalid regions',()=>{
 for(const x of [
  {background:221},{ink:255},{invalidMask:true},{width:80}
 ]){
  const f=fixture(x);
  try{assert.equal(makeWordSiriInkMask(f.canvas,bbox),null);}
  finally{f.restore();}
 }
 const f=fixture();
 try{
  assert.equal(makeWordSiriInkMask(f.canvas,[980,30,30,20]),null);
  assert.equal(makeWordSiriInkMask(f.canvas,[10,10,0,20]),null);
  assert.equal(makeWordSiriInkMask(f.canvas,[10,10,900,800]),null);
 }finally{f.restore();}
});
