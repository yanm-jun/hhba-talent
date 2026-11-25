// Local-only DOCX HTML preview; scripts are hosted by HHBA, never a CDN.
// This is a visual aid, NOT an authoritative Word/LibreOffice page-layout check.
import type {WordAnchor} from './resumeWordAnchors.mjs';
import {distributeStyledText} from './resumeDocxPreserve.mjs';
type DocxRenderer={renderAsync:(bytes:Uint8Array,body:HTMLElement,styles:HTMLElement,
 options:Record<string,unknown>)=>Promise<unknown>};
type ZipFile={name:string;dir:boolean;_data?:{uncompressedSize?:number};
 async:(type:'string')=>Promise<string>};
type ZipLoader={loadAsync:(bytes:Uint8Array)=>Promise<{files:Record<string,ZipFile>}>};
type WordWindow=Window&{JSZip?:ZipLoader;docx?:DocxRenderer};
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
async function assertPreviewSafe(bytes:Uint8Array){
 const loader=(window as WordWindow).JSZip;
 if(!loader||bytes.length<100||bytes.length>3*1024*1024)
  throw Error('Word 文件无法安全预览。');
 const zip=await loader.loadAsync(bytes);
 const entries=Object.values(zip.files);
 if(entries.length>1200)throw Error('Word 文件包含过多内容，无法安全预览。');
 let total=0;
 for(const entry of entries){
  const size=entry._data?.uncompressedSize;
  if(typeof size==='number'){
   if(size>18*1024*1024)throw Error('Word 文件包含过大的嵌入内容。');
   total+=size;
   if(total>35*1024*1024)throw Error('Word 文件体积超出预览安全范围。');
  }
  if(!entry.dir&&entry.name.endsWith('.rels')){
   const content=await entry.async('string');
   if(content.length>1024*1024)throw Error('Word 关系文件超出安全范围。');
   const tags=content.match(/<Relationship\b[^>]*>/g)||[];
   for(const rel of tags){
    const external=/\bTargetMode\s*=\s*['"]External['"]/i.test(rel);
    const safeLink=/\bType\s*=\s*['"][^'"]*\/hyperlink['"]/i.test(rel);
    // User-typed hyperlinks are displayed as inert text. External media and
    // templates must never be fetched automatically on resume preview.
    if(external&&!safeLink)throw Error('Word 包含外部加载内容，请下载原件在本地查看。');
   }
  }
 }
}
export async function renderBrowserWord(bytes:Uint8Array,mount:HTMLElement){
 const docx=await loadBrowserWordRenderer();
 await assertPreviewSafe(bytes);
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
/**
 * Pending AI wording lives IN the locally rendered DOCX span, rather than
 * a second text layer with a guessed font size and one-line clipping.
 *
 * This is a reversible, browser-only preview: the source DOCX bytes never
 * change and the candidate must still explicitly confirm a server-side edit.
 * Only unique editable leaf runs may be touched. Original run styling,
 * paragraph wrapping and the actual Word sheet layout remain authoritative.
 */
// Server inspection advertises uniquely editable plain-text paragraphs.
// Match rendered direct leaf spans, not guessed text or a rebuilt paragraph.
function browserParagraphRuns(mount:HTMLElement,allowed:Set<string>){
 const groups:{text:string;paragraph:HTMLElement;spans:HTMLElement[]}[]=[];
 for(const paragraph of mount.querySelectorAll<HTMLElement>('section.hhba-native-docx p')){
  const spans=Array.from(paragraph.children||[]) as HTMLElement[];
  if(spans.length<2||spans.some(s=>s.tagName!=='SPAN'||(s.querySelector('span')&&!s.hasAttribute('data-hhba-original-run'))))continue;
  if(Array.from(paragraph.childNodes).some(n=>n.nodeType!==1&&Boolean(n.textContent)))continue;
  if(spans.some(s=>Array.from(s.children).some(child=>!child.classList.contains('hhba-word-ai-changed'))))continue;
  const source=spans.map(s=>s.getAttribute('data-hhba-original-run')??s.textContent??'');
  if(source.filter(Boolean).length<2)continue;
  const text=source.join('');
  if(allowed.has(text))groups.push({text,paragraph,spans});
 }
 return groups;
}
export function paintBrowserWordSuggestions(
 mount:HTMLElement,editableText:string[],
 suggestions:readonly {original:string;proposed:string;state:'pending'|'accepted'}[]
):void{
 const attribute='data-hhba-original-run';
 for(const node of mount.querySelectorAll<HTMLElement>('span[data-hhba-original-run]')){
  const original=node.getAttribute(attribute);
  if(original===null)continue;
  node.replaceChildren(document.createTextNode(original));
  node.removeAttribute(attribute);
  node.classList.remove('hhba-word-inline-suggestion');
 }
 const allowed=new Set(editableText);
 const grouped=new Map<string,HTMLElement[]>();
 for(const node of mount.querySelectorAll<HTMLElement>('section.hhba-native-docx span')){
  if(node.querySelector('span'))continue;
  const source=node.textContent||'';
  if(!allowed.has(source))continue;
  grouped.set(source,[...(grouped.get(source)||[]),node]);
 }
 const paragraphs=browserParagraphRuns(mount,allowed);
 const proposals=new Map<string,string[]>();
 for(const suggestion of suggestions){
  if(suggestion.state!=='pending'||!allowed.has(suggestion.original)||
   suggestion.proposed===suggestion.original||!suggestion.proposed.trim())continue;
  proposals.set(suggestion.original,[...(proposals.get(suggestion.original)||[]),
   suggestion.proposed]);
 }
 for(const [original,values] of proposals){
  const nodes=grouped.get(original)||[];
  const joined=paragraphs.filter(group=>group.text===original);
  if(values.length!==1||nodes.length+joined.length!==1)continue;
  const group=joined[0];
  const node=group?group.spans[0]:nodes[0],proposal=values[0];
  if(group){
   const source=group.spans.map(span=>span.textContent||'');
   const revised=distributeStyledText(source,proposal);
   group.spans.forEach((span,i)=>{
    if(source[i]===revised[i])return;
    span.setAttribute(attribute,source[i]);
    span.classList.add('hhba-word-inline-suggestion');
    const mark=document.createElement('span');mark.className='hhba-word-ai-changed hhba-resume-siri-letters';
    const before=source[i],after=revised[i];let start=0,end=0;
    while(start<before.length&&start<after.length&&before[start]===after[start])start++;
    while(end<before.length-start&&end<after.length-start&&before[before.length-1-end]===after[after.length-1-end])end++;
    mark.textContent=after.slice(start,after.length-end)||'\u200b';
    if(proposal.includes('\n'))mark.style.whiteSpace='pre-wrap';
    span.replaceChildren(document.createTextNode(after.slice(0,start)),mark,document.createTextNode(after.slice(after.length-end)));
   });
   continue;
  }
  const before=Array.from(original),after=Array.from(proposal);
  let start=0,end=0;
  while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  while(end<before.length-start&&end<after.length-start&&
   before[before.length-1-end]===after[after.length-1-end])end++;
  const prefix=after.slice(0,start).join('');
  const changed=after.slice(start,after.length-end).join('');
  const suffix=after.slice(after.length-end).join('');
  const mark=document.createElement('span');
  mark.className='hhba-word-ai-changed hhba-resume-siri-letters';
  mark.textContent=changed||'\u200b';
  if(proposal.includes('\n')&&mark.style)mark.style.whiteSpace='pre-wrap';
  node.setAttribute(attribute,group?(node.textContent||''):original);
  node.classList.add('hhba-word-inline-suggestion');
  node.replaceChildren(document.createTextNode(prefix),mark,document.createTextNode(suffix));
 }
}

export function browserWordAnchors(mount:HTMLElement,editableText:string[]):WordAnchor[]{
 const pages=[...mount.querySelectorAll<HTMLElement>('section.hhba-native-docx')];
 if(!pages.length)return [];
 const bounds=mount.getBoundingClientRect();
 // On phones the DOCX paper is wider than the scrollable viewport.
 // Anchor coordinates must use the FULL rendered document, never the clipped
 // visible area, otherwise valid text can be rejected as "out of bounds".
 const fullWidth=Math.max(mount.scrollWidth,mount.offsetWidth);
 const fullHeight=Math.max(mount.scrollHeight,mount.offsetHeight);
 if(bounds.width<100||bounds.height<100||fullWidth<100||fullHeight<100)return [];
 const safe=new Set(editableText.filter(s=>typeof s==='string'&&s.trim()===s&&s.length>=3));
 const found=new Map<string,HTMLElement[]>();
 // Only leaf spans with exactly one matching run may be edited. Ambiguous or
 // duplicated text (including repeated headers) is never clickable.
 for(const span of mount.querySelectorAll<HTMLElement>('section.hhba-native-docx span')){
  // A painted run has a nested gradient span; still anchor it by its
  // authenticated ORIGINAL, never by the AI-proposed display text.
  const original=span.getAttribute('data-hhba-original-run');
  if(span.querySelector('span')&&original===null)continue;
  const value=original??span.textContent??'';
  if(!safe.has(value))continue;
  const entries=found.get(value)||[];entries.push(span);found.set(value,entries);
 }
 for(const group of browserParagraphRuns(mount,safe)){
  const entries=found.get(group.text)||[];entries.push(group.paragraph);found.set(group.text,entries);
 }
 const result:WordAnchor[]=[];
 for(const [text,elements] of found){
  if(elements.length!==1)continue;
  const node=elements[0],rect=node.getBoundingClientRect();
  const scaleX=bounds.width/mount.offsetWidth,scaleY=bounds.height/mount.offsetHeight;
  const x=(rect.left-bounds.left)/scaleX/fullWidth*1000;
  const y=(rect.top-bounds.top)/scaleY/fullHeight*1000;
  const w=rect.width/scaleX/fullWidth*1000,h=rect.height/scaleY/fullHeight*1000;
  if([x,y,w,h].some(v=>!Number.isFinite(v))||x<0||y<0||w<4||h<2||
   x+w>1000.5||y+h>1000.5)continue;
  const family=getComputedStyle(node).fontFamily;
  const page=Math.max(1,pages.indexOf(node.closest('section.hhba-native-docx') as HTMLElement)+1);
  result.push({id:'browser-word-'+result.length,text,page,
   bbox:[x,y,w,h],fontFamily:family.length<=100?family:undefined});
 }
 // Include every uniquely verifiable text run, including content after the
 // first screen and on later Word pages. No presentation-order truncation:
 // later sections must not silently lose their edit buttons.
 return result;
}
