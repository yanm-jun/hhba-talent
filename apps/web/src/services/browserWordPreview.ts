// Local-only DOCX HTML preview; scripts are hosted by HHBA, never a CDN.
// This is a visual aid, NOT an authoritative Word/LibreOffice page-layout check.
import type {WordAnchor} from './resumeWordAnchors.mjs';
type DocxRenderer={renderAsync:(bytes:Uint8Array,body:HTMLElement,styles:HTMLElement,
 options:Record<string,unknown>)=>Promise<unknown>};
type WordWindow=Window&{JSZip?:unknown;docx?:DocxRenderer};
const scripts=new Map<string,Promise<void>>();
function script(src:string){
 const previous=scripts.get(src);
 if(previous)return previous;
 const promise=new Promise<void>((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.src=src;tag.async=false;tag.referrerPolicy='no-referrer';
  tag.onload=()=>resolve();
  tag.onerror=()=>{scripts.delete(src);tag.remove();reject(Error('Word 浏览器预览组件载入失败。'));};
  document.head.appendChild(tag);
 });
 scripts.set(src,promise);return promise;
}
export async function loadBrowserWordRenderer():Promise<DocxRenderer>{
 const global=window as WordWindow;
 if(!global.JSZip)await script('/vendor/jszip.min.js');
 if(!global.docx)await script('/vendor/docx-preview.min.js');
 if(!global.docx?.renderAsync)throw Error('Word 浏览器预览不可用。');
 return global.docx;
}
export async function renderBrowserWord(bytes:Uint8Array,mount:HTMLElement){
 const docx=await loadBrowserWordRenderer();
 mount.replaceChildren();
 await docx.renderAsync(bytes,mount,mount,{
  className:'hhba-native-docx',
  inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,
  renderHeaders:true,renderFooters:true,renderFootnotes:true,
  renderEndnotes:true,renderComments:false,renderAltChunks:false,
  useBase64URL:true,experimental:false,debug:false
 });
 // A resume is a passive display. Its hyperlinks should not navigate or
 // initiate network requests just because it is being previewed.
 for(const a of mount.querySelectorAll('a[href]')){
  a.removeAttribute('href');
 }
 // Disallow remote resources referenced by a DOCX, including tracking images.
 for(const image of mount.querySelectorAll('img[src]')){
  if(!/^(?:data:|blob:)/i.test(image.getAttribute('src')||''))image.removeAttribute('src');
 }
 return mount.querySelectorAll('section.hhba-native-docx').length;
}
export function browserWordAnchors(mount:HTMLElement,editableText:string[]):WordAnchor[]{
 const pages=[...mount.querySelectorAll<HTMLElement>('section.hhba-native-docx')];
 if(!pages.length)return [];
 const bounds=mount.getBoundingClientRect();
 if(bounds.width<100||bounds.height<100)return [];
 const safe=new Set(editableText.filter(s=>typeof s==='string'&&s.trim()===s&&s.length>=3&&s.length<=300));
 const found=new Map<string,HTMLElement[]>();
 // Only leaf spans with exactly one matching run may be edited. Ambiguous or
 // duplicated text (including repeated headers) is never clickable.
 for(const span of mount.querySelectorAll<HTMLElement>('section.hhba-native-docx span')){
  if(span.querySelector('span'))continue;
  const value=span.textContent||'';
  if(!safe.has(value))continue;
  const entries=found.get(value)||[];entries.push(span);found.set(value,entries);
 }
 const result:WordAnchor[]=[];
 for(const [text,elements] of found){
  if(elements.length!==1)continue;
  const node=elements[0],rect=node.getBoundingClientRect();
  const x=(rect.left-bounds.left)/bounds.width*1000;
  const y=(rect.top-bounds.top)/bounds.height*1000;
  const w=rect.width/bounds.width*1000,h=rect.height/bounds.height*1000;
  if([x,y,w,h].some(v=>!Number.isFinite(v))||x<0||y<0||w<4||h<2||
   x+w>1000.5||y+h>1000.5)continue;
  const family=getComputedStyle(node).fontFamily;
  result.push({id:'browser-word-'+result.length,text,page:1,
   bbox:[x,y,w,h],fontFamily:family.length<=100?family:undefined});
 }
 return result.slice(0,35);
}
