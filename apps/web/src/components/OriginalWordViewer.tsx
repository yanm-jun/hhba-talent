import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronLeft,ChevronRight,Download,PencilLine,Save,Undo2,Redo2,ZoomIn,ZoomOut,Sparkles,X,History,ChevronDown} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {downloadPrivateResume,fetchPrivateResumeForLocalReview} from '../services/privateResumes';
import {extractDocxText} from '../services/docxProfile.mjs';
import {matchWordAnchors,type WordAnchor} from '../services/resumeWordAnchors.mjs';
import {splitChangedResumeText} from '../services/resumeChangedText.mjs';
import {
 wordEditingCapabilities,wordEditableText,wordPreviewBytes,wordSourceBytes,saveOriginalWordEdit,
 shiftOriginalWordRevision,downloadOriginalWordEdited,downloadOriginalWordPdf,
 type WordHistoryEntry
} from '../services/originalWordApi';
import {renderBrowserWord,browserWordAnchors} from '../services/browserWordPreview';
import '../styles/original-resume-viewer.css';
import '../styles/browser-word-preview.css';
import '../styles/siri-edge.css';

// The original DOCX is NEVER converted into an HHBA template. A privately
// rendered PDF is used when available; otherwise HTML preview stays on-device.
// Downloaded DOCX preserves the original OOXML package, but without the
// optional LibreOffice check its visual pagination is NOT verified.
type PendingWordTextDraft={original:string;text:string;revision:number;page:number};
export type WordVisualSuggestion={id:string;original:string;proposed:string;state:'pending'|'accepted'};
export type WordRevisionSnapshot={revision:number;history:WordHistoryEntry[]};
export function OriginalWordViewer({resume,jobId,jobTitle,onClose,suggestedChanges=[],onOpenSuggestions,pendingSuggestionCount=0,onPendingChange,onVerifiedSave,onVersionMoved,sessionWordDraft,onSessionWordDraftChange,editPanelHost,onEditingChange,glowActive=false,visualSuggestions=[],onVisualSuggestionSelect,onVisualSuggestionAction,onRevisionSnapshot,onDocumentReady,onEditableSegments}:{
 resume:PrivateResume;jobId?:string;jobTitle?:string;onClose?:()=>void;
 suggestedChanges?:{original:string;proposed:string}[];
 onOpenSuggestions?:()=>void;pendingSuggestionCount?:number;onPendingChange?:(dirty:boolean)=>void;
 onVerifiedSave?:(change:{original:string;text:string})=>void;
 onVersionMoved?:()=>void;
 sessionWordDraft?:PendingWordTextDraft|null;
 onSessionWordDraftChange?:(draft:PendingWordTextDraft|null)=>void;
 editPanelHost?:HTMLElement|null;
 onEditingChange?:(editing:boolean,inline?:boolean)=>void;
 glowActive?:boolean;
 visualSuggestions?:WordVisualSuggestion[];
 onVisualSuggestionSelect?:(id:string)=>void;
 onVisualSuggestionAction?:(id:string,action:'accepted'|'ignored'|'edited',text?:string,layoutVerified?:boolean)=>void;
 onRevisionSnapshot?:(snapshot:WordRevisionSnapshot)=>void;
 onDocumentReady?:()=>void;
 onEditableSegments?:(segments:string[])=>void;
}){
 const surface=useRef<HTMLCanvasElement>(null);
 const paper=useRef<HTMLDivElement>(null);
 const browserMount=useRef<HTMLDivElement>(null);
 const doc=useRef<any>(null);
 const renderedEntrance=useRef(false);
 const [ready,setReady]=useState<'checking'|'available'|'unavailable'>('checking');
 const [rendererEnabled,setRendererEnabled]=useState(false);
 const [pdfAvailable,setPdfAvailable]=useState(false);
 const [layoutVerified,setLayoutVerified]=useState(false);
 const [loading,setLoading]=useState(true);
 const [previewError,setPreviewError]=useState('');
 const [text,setText]=useState('');
 const [page,setPage]=useState(1);
 const [count,setCount]=useState(0);
 const [width,setWidth]=useState(680);
 const [zoom,setZoom]=useState(1);
 const [fitMode,setFitMode]=useState<'page'|'width'|'custom'>('width');
 const [editorTopHost,setEditorTopHost]=useState<HTMLElement|null>(null);
 const [paperSize,setPaperSize]=useState({width:0,height:0});
 const [editable,setEditable]=useState<string[]>([]);
 const [anchors,setAnchors]=useState<WordAnchor[]>([]);
 const [selected,setSelected]=useState<WordAnchor|null>(null);
 const [draft,setDraft]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 const [revision,setRevision]=useState(0);
 const [totalRevisions,setTotalRevisions]=useState(0);
 const [maxRevisions,setMaxRevisions]=useState(8);
 const [maxDailyEdits,setMaxDailyEdits]=useState(6);
 const [history,setHistory]=useState<WordHistoryEntry[]>([]);
 const [refresh,setRefresh]=useState(0);
 const [message,setMessage]=useState('');
 const [activeVisualId,setActiveVisualId]=useState<string|null>(null);
 const [inlineVisualEditor,setInlineVisualEditor]=useState<string|null>(null);
 const [inlineVisualSuggestionId,setInlineVisualSuggestionId]=useState<string|null>(null);
 const restorePosition=useRef<{page:number;left:number;top:number;outerTop:number}|null>(null);
 function rememberPosition(){
  const node=paper.current;
  const outer=node?.closest('.hhba-match-modal-content') as HTMLElement|null;
  restorePosition.current={page,left:node?.scrollLeft||0,top:node?.scrollTop||0,
   outerTop:outer?.scrollTop||0};
 }
 function confirmDiscardText(){
  return !selected||draft===selected.text||
   window.confirm('这段文字还没有保存。确定丢弃这次修改吗？');
 }
 function closeEditor(){
  if(!confirmDiscardText())return;
  onClose?.();
 }
 useEffect(()=>{
  setPage(1);setZoom(1);setFitMode('width');setActiveVisualId(null);setInlineVisualEditor(null);restorePosition.current=null;
  renderedEntrance.current=false;
 },[resume.id,jobId]);
 useEffect(()=>{
  // The Word viewer owns authenticated downloads; the parent supplies only an icon slot.
  setEditorTopHost(document.getElementById('hhba-word-top-download'));
 },[jobId,resume.id]);
 useEffect(()=>{
  onPendingChange?.(Boolean(selected&&draft!==selected.text));
 },[selected,draft,onPendingChange]);
 useEffect(()=>{
  onEditingChange?.(Boolean(selected),Boolean(inlineVisualEditor));
 },[selected,inlineVisualEditor,onEditingChange]);
 useEffect(()=>{
  if(!selected||draft===selected.text)return;
  const handle=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',handle);
  return()=>window.removeEventListener('beforeunload',handle);
 },[selected,draft]);

 useEffect(()=>{
  const controller=new AbortController();
  setReady('checking');
  void wordEditingCapabilities(controller.signal).then(capabilities=>{
   if(controller.signal.aborted)return;
   setRendererEnabled(capabilities.rendererEnabled);
   setReady(capabilities.enabled?'available':'unavailable');
  });
  return()=>controller.abort();
 },[resume.id,jobId]);

 useEffect(()=>{
  if(ready==='checking')return;
  let active=true,task:any=null;
  setLoading(true);setPreviewError('');setAnchors([]);setSelected(null);setInlineVisualEditor(null);
  void(async()=>{
   try{
    if(ready==='unavailable'){
     const bytes=await fetchPrivateResumeForLocalReview(resume);
     const content=await extractDocxText(bytes);
     if(active){
      setText(content);setLoading(false);
      if(!renderedEntrance.current){renderedEntrance.current=true;onDocumentReady?.();}
     }
     return;
    }
    const info=await wordEditableText(resume.id,undefined,jobId);
    if(!active)return;
    // Editing is permitted only when the DOCX text is unique not only in
    // the OOXML body but across every rendered page, including headers.
    // Otherwise the clicked visible region could be the WRONG occurrence.
    const wasSaved=Boolean(info.saved);
    setSaved(wasSaved);
    setRevision(Number.isInteger(info.revision)?info.revision:(wasSaved?1:0));
    setTotalRevisions(Number.isInteger(info.total_revisions)?info.total_revisions:(wasSaved?1:0));
    setMaxRevisions(Number.isInteger(info.max_revisions)?info.max_revisions:8);
    setMaxDailyEdits(typeof info.max_daily_edits==='number'&&Number.isInteger(info.max_daily_edits)?info.max_daily_edits:6);
    const inspectedHistory=Array.isArray(info.history)?info.history:[];
    setHistory(inspectedHistory);
    setPdfAvailable(info.pdf_available===true);
    setLayoutVerified(info.layout_verified===true);
    onRevisionSnapshot?.({revision:Number.isInteger(info.revision)?info.revision:(wasSaved?1:0),
     history:inspectedHistory});
    if(!rendererEnabled){
     const currentRevision=Number.isInteger(info.revision)?info.revision:(wasSaved?1:0);
     const raw=await wordSourceBytes(resume.id,currentRevision,jobId);
     if(!active||!browserMount.current)return;
     const mount=browserMount.current;
     await renderBrowserWord(raw,mount);
     if(!active)return;
     const safeAnchors=browserWordAnchors(mount,info.editable_text||[]);
     setEditable(info.editable_text||[]);
     setAnchors(safeAnchors);
     // AI edits may only target unique, visible Word text positions.
     onEditableSegments?.([...new Set(safeAnchors.map(item=>item.text))]);
     setCount(1);setPage(1);
     setPaperSize({width:mount.scrollWidth,height:mount.scrollHeight});
     setLoading(false);
     if(!renderedEntrance.current){renderedEntrance.current=true;onDocumentReady?.();}
     return;
    }
    const bytes=await wordPreviewBytes(resume.id,wasSaved,undefined,
     Number.isInteger(info.revision)?info.revision:(wasSaved?1:0),jobId);
    if(!active)return;
    const [pdf,worker]=await Promise.all([
     import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    if(!active)return;
    pdf.GlobalWorkerOptions.workerSrc=worker.default;
    task=pdf.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,
     enableXfa:false,disableAutoFetch:true,disableStream:true,
     useSystemFonts:false} as any);
    const result=await task.promise;
    if(!active){await task.destroy();return;}
    const counts=new Map<string,number>();
    if(result.numPages<=20){
     const candidates=new Set(info.editable_text||[]);
     for(let current=1;current<=result.numPages;current++){
      const content=await (await result.getPage(current))
       .getTextContent({includeMarkedContent:false});
      for(const item of content.items){
       if(typeof (item as any).str!=='string')continue;
       const label=String((item as any).str).normalize('NFKC').trim();
       if(candidates.has(label))counts.set(label,(counts.get(label)||0)+1);
      }
     }
    }
    if(!active)return;
    const stableText=(info.editable_text||[]).filter(t=>counts.get(t)===1);
    setEditable(stableText);
    onEditableSegments?.(stableText);
    doc.current=result;setCount(result.numPages);
    setPage(current=>Math.min(Math.max(1,current),result.numPages));setLoading(false);
   }catch(error){
    if(active){
     setPreviewError(error instanceof Error?error.message:'无法打开这份 Word。');
     setLoading(false);
     if(!renderedEntrance.current){renderedEntrance.current=true;onDocumentReady?.();}
    }
   }
  })();
  return()=>{active=false;doc.current=null;void task?.destroy().catch(()=>{});};
 },[resume.id,jobId,ready,rendererEnabled,refresh]);

 useEffect(()=>{
  if(ready!=='available'||!rendererEnabled||loading||!surface.current||!doc.current)return;
  let active=true,task:any=null;
  setAnchors([]);
  void(async()=>{
   try{
    const source=doc.current,view=await source.getPage(page);
    if(!active||!surface.current)return;
    const base=view.getViewport({scale:1});
    const body=paper.current?.closest('.hhba-match-modal-content');
    const pageTop=paper.current?.getBoundingClientRect().top??0;
    const visibleBottom=body?.getBoundingClientRect().bottom??window.innerHeight;
    const availableHeight=Math.max(230,Math.min(window.innerHeight*.77,
     visibleBottom-pageTop-32));
    const fitPage=fitMode==='page'?Math.min(width/base.width,availableHeight/base.height):width/base.width;
    const scale=Math.min(3.2,Math.max(.35,fitPage))*zoom;
    const viewport=view.getViewport({scale});
    const ratio=Math.min(1.5,window.devicePixelRatio||1);
    const canvas=surface.current;
    canvas.width=Math.round(viewport.width*ratio);
    canvas.height=Math.round(viewport.height*ratio);
    canvas.style.width=viewport.width+'px';
    canvas.style.height=viewport.height+'px';
    setPaperSize({width:viewport.width,height:viewport.height});
    const context=canvas.getContext('2d');
    if(!context)throw Error('这份 Word 暂时无法显示。');
    task=view.render({canvas,canvasContext:context,viewport,
     transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    await task.promise;
    if(!active)return;
    const content=await view.getTextContent({includeMarkedContent:false});
    if(!active)return;
    const items=content.items.filter((x:any)=>typeof x.str==='string') as any;
    setAnchors(matchWordAnchors({
     editableText:editable,items,styles:content.styles,viewport:viewport as any,page
    }));
    if(!renderedEntrance.current){
     renderedEntrance.current=true;
     onDocumentReady?.();
    }
   }catch(error){
    if(active&&error instanceof Error&&error.name!=='RenderingCancelledException')
     setPreviewError('这一页暂时无法显示，请下载原件查看。');
   }
  })();
  return()=>{active=false;try{task?.cancel();}catch{}};
 },[page,ready,rendererEnabled,loading,editable,width,zoom,fitMode,saved,refresh]);

 useEffect(()=>{
  const el=paper.current;if(!el)return;
  const update=()=>setWidth(Math.max(255,Math.min(800,el.clientWidth-20)));
  update();const observer=new ResizeObserver(update);observer.observe(el);
  return()=>observer.disconnect();
 },[ready,loading]);
 // Default: first Word page completely in view. The document and its text
 // hit areas share one zoom transform; candidate can switch to width-fit.
 useEffect(()=>{
  if(ready!=='available'||rendererEnabled||loading||fitMode==='custom')return;
  const container=paper.current,documentPage=browserMount.current
   ?.querySelector<HTMLElement>('section.hhba-native-docx');
  if(!container||!documentPage)return;
  const update=()=>{
   const pageWidth=documentPage.offsetWidth+24,pageHeight=documentPage.offsetHeight+24;
   if(!pageWidth||!pageHeight)return;
   const availableWidth=Math.max(240,container.clientWidth-34);
   // Measure the actual visible modal content area, not just window height.
   // Header/toolbars consume real vertical room; size the first page to the
   // remaining viewport rather than hiding its bottom under the dialog.
   const content=container.closest('.hhba-match-modal-content');
   const visibleBottom=content?.getBoundingClientRect().bottom??window.innerHeight;
   const pageTop=container.getBoundingClientRect().top;
   const availableHeight=Math.max(230,Math.min(window.innerHeight*.77,
    visibleBottom-pageTop-32));
   const factor=fitMode==='page'?
    Math.min(availableWidth/pageWidth,availableHeight/pageHeight):
    availableWidth/pageWidth;
   // At phone widths an A4 sheet reduced to ~40% is unreadable. Keep the
   // document at a minimum readable scale and let its OWN scroll area pan
   // horizontally; never force the browser or whole modal to overflow.
   const mobileWord=window.innerWidth<=700&&Boolean(container.closest('.targeted-resume.is-word-first'));
   const minZoom=mobileWord?.68:.3;
   const next=Number(Math.max(minZoom,Math.min(1.4,factor)).toFixed(2));
   setZoom(current=>Math.abs(current-next)<.015?current:next);
  };
  const observer=new ResizeObserver(update);observer.observe(container);
  window.addEventListener('resize',update);
  const animation=requestAnimationFrame(update);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);cancelAnimationFrame(animation)};
 },[ready,rendererEnabled,loading,fitMode,paperSize.width,paperSize.height]);
 useEffect(()=>{
  const position=restorePosition.current;
  if(loading||!position||page!==position.page||!paper.current)return;
  const node=paper.current;
  const outer=node.closest('.hhba-match-modal-content') as HTMLElement|null;
  const id=requestAnimationFrame(()=>{
   requestAnimationFrame(()=>{
    node.scrollLeft=position.left;node.scrollTop=position.top;
    if(outer)outer.scrollTop=position.outerTop;
    restorePosition.current=null;
   });
  });
  return()=>cancelAnimationFrame(id);
 },[loading,page,paperSize.width,paperSize.height,refresh]);
 // Explicit candidate confirmation and verified private Word revision are
 // mandatory before any rainbow suggestion becomes actual document text.
 async function acceptVisualWord(anchor:WordAnchor,visual:WordVisualSuggestion){
  if(ready!=='available'||busy||loading||visual.state!=='pending'||
   !editable.includes(anchor.text)||!visual.proposed.trim()||
   visual.proposed.length>300||visual.proposed===anchor.text)return;
  if(!confirmDiscardText())return;
  if(!window.confirm('请先核实这段文字符合真实经历。确认采纳并保存岗位专属 Word 修改？原上传文件不会被覆盖。'))return;
  rememberPosition();setBusy(true);setMessage('');
  try{
   const result=await saveOriginalWordEdit(resume.id,anchor.text,visual.proposed.trim(),revision,jobId);
   onSessionWordDraftChange?.(null);
   onVerifiedSave?.({original:anchor.text,text:visual.proposed.trim()});
   onVisualSuggestionAction?.(visual.id,'accepted',undefined,result.layout_verified===true);
   setSelected(null);setConfirmed(false);setInlineVisualEditor(null);setActiveVisualId(null);
   setSaved(true);setRevision(result.revision);setTotalRevisions(result.total_revisions);
   setRefresh(n=>n+1);
   setPdfAvailable(result.pdf_available===true);setLayoutVerified(result.layout_verified===true);
   setMessage(result.layout_verified?'已采纳并通过 Word 版式核验，原件保持不变。':
    '已采纳并保存原格式 Word。文字与原 DOCX 结构保留，分页请下载后检查。');
  }catch(error){
   setMessage(error instanceof Error?error.message:'未保存成功，请检查此处原文后重试。');
  }finally{setBusy(false);}
 }
 function editVisualWord(anchor:WordAnchor,visual:WordVisualSuggestion){
  if(busy||!confirmDiscardText())return;
  setSelected(anchor);setDraft(visual.proposed);setConfirmed(false);
  setInlineVisualEditor(anchor.id);setInlineVisualSuggestionId(visual.id);setActiveVisualId(null);
  setMessage('请核实和编辑真实内容，确认后才会保存岗位专属 Word。');
 }
 async function downloadOriginal(){
  try{await downloadPrivateResume(resume);}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
 }
 async function downloadSaved(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordEdited(resume.id,jobId,jobTitle);
   setMessage('已发起 Word 下载，请在浏览器下载列表查看。');}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function downloadSavedPdf(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordPdf(resume.id,jobId,jobTitle);
   setMessage('已发起当前已确认版本的 PDF 下载。');}
  catch(error){setMessage(error instanceof Error?error.message:'PDF 下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function save(){
  if(!selected||!confirmed||busy||!draft.trim()||draft.length>300)return;
  rememberPosition();setBusy(true);setMessage('');
  try{
   const result=await saveOriginalWordEdit(resume.id,selected.text,draft.trim(),revision,jobId);
   onSessionWordDraftChange?.(null);
   onVerifiedSave?.({original:selected.text,text:draft.trim()});
   if(inlineVisualEditor&&inlineVisualSuggestionId)
    onVisualSuggestionAction?.(inlineVisualSuggestionId,'edited',draft.trim(),result.layout_verified===true);
   setSelected(null);setConfirmed(false);setInlineVisualEditor(null);setInlineVisualSuggestionId(null);setSaved(true);
   setRevision(result.revision);setTotalRevisions(result.total_revisions);
   setPdfAvailable(result.pdf_available===true);setLayoutVerified(result.layout_verified===true);
   setRefresh(n=>n+1);
   setMessage(result.layout_verified?
    '已检查版式并保存第 '+result.revision+' 版。原始 Word 保持不变。':
    '已保存第 '+result.revision+' 版原格式 DOCX，尚未核验分页。下载后请在 Word 中检查。');
  }catch(error){setMessage(error instanceof Error?error.message:'没有保存，请缩短文字后重试。');}
  finally{setBusy(false);}
 }
 async function changeRevision(action:'undo'|'redo'){
  if(busy||ready!=='available'||action==='undo'&&revision<=0||
   action==='redo'&&revision>=totalRevisions)return;
  if(!confirmDiscardText())return;
  rememberPosition();setBusy(true);setMessage('');
  try{
   const result=await shiftOriginalWordRevision(resume.id,action,revision,jobId);
   onSessionWordDraftChange?.(null);setSelected(null);setConfirmed(false);setInlineVisualEditor(null);setActiveVisualId(null);
   onVersionMoved?.();
   setRevision(result.revision);setTotalRevisions(result.total_revisions);
   setSaved(result.saved);setRefresh(n=>n+1);
   setMessage(action==='undo'?'已恢复上一版 Word，不影响其他岗位版本。':
    '已重新应用已保存的 Word 修改。');
  }catch(error){setMessage(error instanceof Error?error.message:'版本切换失败，请重新打开简历。');}
  finally{setBusy(false);}
 }
 const editPanel=selected?<div className="hhba-original-resume-editbox" role="region"
  aria-label="修改 Word 原文">
  <div className="hhba-original-resume-editbox-title">
   <strong>修改这段</strong>
   <button type="button" aria-label="取消修改" onClick={()=>{
    if(!confirmDiscardText())return;
    onSessionWordDraftChange?.(null);setSelected(null);setDraft('');setConfirmed(false);
   }}><X size={16}/></button>
  </div>
  <p className="hhba-original-resume-edit-source"><span>原文</span>{selected.text}</p>
  <label className="hhba-original-resume-edit-input-label" htmlFor="hhba-word-current-edit">
   修改后的文字
  </label>
  <textarea id="hhba-word-current-edit" aria-label="修改 Word 文字" value={draft} rows={5}
   className={draft!==selected.text?'hhba-siri-typing':''}
   maxLength={300} onChange={e=>{
    const value=e.target.value;setDraft(value);setConfirmed(false);
    onSessionWordDraftChange?.(value!==selected.text?
     {original:selected.text,text:value,revision,page}:null);
   }}/>
  <p className="hhba-original-resume-edit-limit">{draft.length} / 300 字
   · 保留原 Word 字体及样式结构；未经专业校验的分页请自行核对。</p>
  <label className="hhba-original-resume-edit-confirm"><input type="checkbox" checked={confirmed}
   onChange={e=>setConfirmed(e.target.checked)}/>
   我已核实修改后的文字属实
  </label>
  <div className="hhba-original-resume-editbox-actions">
   <button type="button" disabled={!confirmed||!draft.trim()||busy}
    onClick={()=>void save()}><Save size={14}/> {busy?'正在保存…':'确认保存'}</button>
   <button type="button" onClick={()=>{
    if(!confirmDiscardText())return;
    onSessionWordDraftChange?.(null);setSelected(null);setDraft('');setConfirmed(false);
   }}>取消</button>
  </div>
 </div>:null;
 const anchorsOverlay=anchors.map(anchor=>{
       const [x,y,w,h]=anchor.bbox;
       const candidates=visualSuggestions.filter(change=>
        change.original===anchor.text&&change.proposed.trim()&&
        change.proposed!==anchor.text&&change.proposed.length<=300);
       const visual=candidates.length===1?candidates[0]:null;
       const textFits=Boolean(visual&&Array.from(visual.proposed).length<=
        Math.max(12,Array.from(anchor.text).length*1.25));
       const changed=visual?splitChangedResumeText(anchor.text,visual.proposed):null;
       return <div key={anchor.id}
        className={'hhba-word-siri-anchor-shell'+(visual?.state==='pending'?' has-siri-wording':'')+
         (activeVisualId===visual?.id?' is-open':'')+(inlineVisualEditor===anchor.id?' is-editing':'')}
        style={{left:x/10+'%',top:y/10+'%',width:w/10+'%',height:h/10+'%'}}>
        <button type="button"
        className={"hhba-original-resume-anchor"+(selected?.id===anchor.id?" is-selected":"")+
         (visual?' has-ai-preview':'')} title={visual?'点击查看操作':'修改这段'}
        aria-label={visual?.state==='pending'?'查看此处文字操作':'修改这段 Word'}
        onClick={()=>{
         if(visual?.state==='pending'){
          setActiveVisualId(current=>current===visual.id?null:visual.id);return;
         }
         if(!confirmDiscardText())return;
         // A restored draft is never accepted automatically. It must be
         // attached to the identical visible text, page and server revision.
         const replacing=Boolean(selected&&draft!==selected.text);
         if(replacing)onSessionWordDraftChange?.(null);
         const restored=!replacing&&sessionWordDraft&&
          sessionWordDraft.revision===revision&&sessionWordDraft.page===page&&
          sessionWordDraft.original===anchor.text&&
          sessionWordDraft.text.length<=300&&sessionWordDraft.text.trim();
         const matches=suggestedChanges.filter(change=>change.original===anchor.text&&
          change.proposed.trim()&&change.proposed.length<=300);
         const candidate=restored?sessionWordDraft!.text:
          matches.length===1?matches[0].proposed:anchor.text;
         setSelected(anchor);setPage(anchor.page);setDraft(candidate);setInlineVisualEditor(null);
         setConfirmed(false);
         setMessage(restored?'已恢复未保存的文字草稿，请检查后再次确认。':
          matches.length===1?'已填入本人确认过的建议；请复核事实与原版式后再保存。':'');
        }}>
        {visual&&<span className="hhba-word-ai-preview" aria-hidden="true">
         <span className="hhba-word-ai-preview-text"
          style={{fontSize:Math.max(9,Math.min(19,(h/1000*paperSize.height)*.82))+'px',
           fontFamily:anchor.fontFamily||undefined}}>
          {textFits&&changed?.prefix&&<span className="hhba-word-ai-unchanged">{changed.prefix}</span>}
          {!textFits&&<span className="hhba-word-ai-unchanged">…</span>}
          <span className="hhba-word-ai-changed hhba-resume-siri-letters">
           {changed?.changed||'−'}
          </span>
          {textFits&&changed?.suffix&&<span className="hhba-word-ai-unchanged">{changed.suffix}</span>}
         </span>
        </span>}
        {!visual&&<span className="hhba-word-edit-anchor-label"><PencilLine size={12}/> 修改</span>}
       </button>
       {visual?.state==='pending'&&<div className="hhba-word-siri-inline-actions"
        role="group" aria-label="当前彩虹文字操作"
        style={y>710?{bottom:'100%'}:{top:'100%'}}>
        <button type="button" className="is-accept" disabled={busy}
         onClick={()=>void acceptVisualWord(anchor,visual)}><Check size={13}/> 采纳</button>
        <button type="button" disabled={busy}
         onClick={()=>editVisualWord(anchor,visual)}><PencilLine size={13}/> 编辑</button>
        <button type="button" disabled={busy} onClick={()=>{
         onVisualSuggestionAction?.(visual.id,'ignored');setActiveVisualId(null);
         setMessage('已忽略此处彩虹文字，保留原文。');
        }}><X size={13}/> 忽略</button>
       </div>}
       </div>;
      });
 return <section className={'hhba-original-resume hhba-original-word-viewer'+
  (selected&&!editPanelHost?' has-inline-editor':'')} aria-label="查看我的 Word 简历">
  <div className="hhba-original-resume-toolbar">
   <div className="hhba-original-resume-file-heading">
    <strong>{resume.name}</strong>
    <span>{jobId?'岗位专属 Word':'原版式 Word'} · 当前修改进度：{revision} / {totalRevisions}</span>
   </div>
   <div className="hhba-original-resume-toolbar-actions">
    {ready==='available'&&<>
     <button type="button" className="hhba-original-resume-revision-action"
      disabled={busy||loading||revision<=0} title="撤销上次修改" aria-label="撤销"
      onClick={()=>void changeRevision('undo')}><Undo2 size={16}/><span>撤销</span></button>
     <button type="button" className="hhba-original-resume-revision-action"
      disabled={busy||loading||revision>=totalRevisions} title="重做修改" aria-label="重做"
      onClick={()=>void changeRevision('redo')}><Redo2 size={16}/><span>重做</span></button>
    </>}
    <details className="hhba-word-menu hhba-original-resume-export-menu">
     <summary><Download size={16}/> 导出 <ChevronDown size={13}/></summary>
     <div className="hhba-word-menu-content">
      <button type="button" onClick={()=>void downloadOriginal()}>下载原件</button>
      <button type="button" disabled={!saved||busy}
       onClick={()=>void downloadSaved()}>下载 Word</button>
      <button type="button" disabled={!pdfAvailable||busy}
       title={pdfAvailable?'下载经渲染器校验的 PDF':'该版本未做专业分页校验，暂不能下载 PDF'}
       onClick={()=>void downloadSavedPdf()}>下载 PDF</button>
     </div>
    </details>
    <details className="hhba-word-menu hhba-original-resume-version-menu">
     <summary><History size={16}/> 版本</summary>
     <div className="hhba-word-menu-content">
      <p>当前版本 {revision} / {totalRevisions} · 最多 {maxRevisions} 次修订</p>
      <p>单日最多 {maxDailyEdits} 次修改保存，撤销和重做不计入。</p>
      {history.length>0&&<ol className="hhba-original-resume-history-list">
       {history.map(entry=><li key={entry.revision}
        className={entry.revision===revision?'is-current':''}>
        <strong>第 {entry.revision} 版</strong>
        <small>{entry.updated_at?new Date(entry.updated_at).toLocaleString('zh-CN'):'历史记录'}</small>
        <div>原文：{entry.original}</div><div>修改：{entry.text}</div>
       </li>)}
      </ol>}
     </div>
    </details>
    {onClose&&<button type="button" onClick={closeEditor} aria-label="关闭原件预览"><X size={16}/></button>}
   </div>
  </div>
  {editorTopHost&&createPortal(<button type="button" className="hhba-word-editor-header-download"
    aria-label="下载当前 Word" title={saved?'下载当前岗位 Word':'下载原始 Word'}
    disabled={busy||loading} onClick={()=>void(saved?downloadSaved():downloadOriginal())}>
    <Download size={17} aria-hidden="true"/>
   </button>,editorTopHost)}
  {message&&<p className="hhba-original-resume-word-status" role="status">{message}</p>}
  {sessionWordDraft&&ready==='available'&&<details className="hhba-word-draft-help">
   <summary>检测到未完成文字草稿</summary>
   <p>可在第 {sessionWordDraft.page} 页点选相同原文继续核对；修订号或原文不同不会自动填入。</p>
  </details>}
  {editPanel&&(!editPanelHost?
   <aside className="hhba-word-standalone-edit-panel" aria-label="Word 当前文字编辑">{editPanel}</aside>:
   createPortal(editPanel,editPanelHost))}
  {loading&&<p className="hhba-original-resume-note" role="status">正在打开简历…</p>}
  {saved&&ready==='available'&&!layoutVerified&&<p className="hhba-browser-word-disclaimer">
   已保存原格式 DOCX，尚未校验分页；可下载 Word，PDF 暂不可用。
  </p>}
  {busy&&<p className="hhba-original-resume-word-status is-busy" role="status">
   {rendererEnabled?'正在验证字体、分页并准备 PDF…':
    '正在保存原 DOCX 的岗位独立版本，原件不会被覆盖…'}
  </p>}
  {previewError&&<div className="hhba-original-resume-note" role="alert">
   <p>{previewError}</p>
   {ready==='available'&&<button type="button" disabled={busy}
    onClick={()=>{setPreviewError('');setRefresh(n=>n+1);}}>重新载入最新版</button>}
  </div>}
  {!loading&&ready==='unavailable'&&<div className="hhba-original-resume-word">
   <p>当前只能查看文字。要查看原来的样式，请下载原件打开。</p>
   <pre>{text}</pre>
  </div>}
  {ready==='available'&&!rendererEnabled&&!previewError&&<>
   <div className="hhba-original-resume-word-tools" role="group" aria-label="Word 浏览器预览缩放">
    <button type="button" aria-label="缩小 Word" disabled={zoom<=.3}
     onClick={()=>{setFitMode('custom');setZoom(v=>Math.max(.3,Math.round((v-.15)*100)/100))}}><ZoomOut size={15}/></button>
    <output aria-live="polite">{Math.round(zoom*100)}%</output>
    <button type="button" aria-label="放大 Word" disabled={zoom>=2}
     onClick={()=>{setFitMode('custom');setZoom(v=>Math.min(2,Math.round((v+.15)*100)/100))}}><ZoomIn size={15}/></button>
    <button type="button" className={fitMode==='page'?'is-active':''}
     onClick={()=>setFitMode('page')} aria-pressed={fitMode==='page'}>整页</button>
    <button type="button" className={fitMode==='width'?'is-active':''}
     onClick={()=>setFitMode('width')} aria-pressed={fitMode==='width'}>适合宽度</button>
   </div>

   <div className={'hhba-original-resume-siri-stage hhba-siri-edge'+
    (glowActive?' hhba-siri-edge-active':'')}>
    <div className="hhba-original-resume-paper hhba-word-native-preview hhba-browser-word-paper" ref={paper}>
     <div className="hhba-original-resume-page-frame hhba-browser-word-frame" style={{zoom}}>
      <div className="hhba-browser-word-output" ref={browserMount}/>
      {!loading&&<div className="hhba-browser-word-overlay">
       {anchorsOverlay}
      </div>}
     </div>
    </div>
   </div>
   {!loading&&anchors.length===0&&<p className="hhba-original-resume-note">
    此 Word 没有找到可唯一定位的原文，请下载原件检查。没有对它做任何修改。</p>}
  </>}
  {!loading&&ready==='available'&&rendererEnabled&&!previewError&&<>
   <div className="hhba-original-resume-word-tools" role="group" aria-label="Word 预览缩放">
    <button type="button" aria-label="缩小 Word" onClick={()=>setZoom(value=>Math.max(.75,Math.round((value-.25)*100)/100))}
     disabled={zoom<=.75}><ZoomOut size={15}/></button>
    <output aria-live="polite">{Math.round(zoom*100)}%</output>
    <button type="button" aria-label="放大 Word" onClick={()=>setZoom(value=>Math.min(2,Math.round((value+.25)*100)/100))}
     disabled={zoom>=2}><ZoomIn size={15}/></button>
    <button type="button" onClick={()=>{setFitMode('width');setZoom(1)}} aria-pressed={fitMode==='width'}>适合宽度</button>
    <button type="button" onClick={()=>{setFitMode('page');setZoom(1)}} aria-pressed={fitMode==='page'}>整页</button>
   </div>
   <div className={'hhba-original-resume-siri-stage hhba-siri-edge'+
     (glowActive?' hhba-siri-edge-active':'')}>
    <div className="hhba-original-resume-paper hhba-word-native-preview" ref={paper}>
     <div className="hhba-original-resume-page-frame" style={{
      width:paperSize.width||undefined,height:paperSize.height||undefined
     }}>
      <canvas className="hhba-original-resume-canvas" ref={surface}
       role="img" aria-label={'Word 原始页面第 '+page+' 页'}/>
      {anchorsOverlay}
     </div>
    </div>
   </div>
   {anchors.length===0&&<p className="hhba-original-resume-note">
    这页没有找到可以安全修改的位置。</p>}
   <nav className="hhba-original-resume-pages" aria-label="Word 简历翻页">
    <button type="button" disabled={page<=1}
     onClick={()=>{setSelected(null);setPage(n=>n-1)}}>
     <ChevronLeft size={15}/> 上一页</button>
    <span>第 {page} / {count} 页</span>
    <button type="button" disabled={page>=count}
     onClick={()=>{setSelected(null);setPage(n=>n+1)}}>
     下一页 <ChevronRight size={15}/></button>
   </nav>
  </>}
  {ready==='available'&&<footer className="hhba-word-minimal-footer" aria-label="Word 编辑工具栏">
   <div className="hhba-word-minimal-zoom" role="group" aria-label="简历缩放">
    <button type="button" aria-label="缩小 Word" disabled={zoom<=.3}
     onClick={()=>{setFitMode('custom');setZoom(v=>Math.max(.3,Math.round((v-.1)*100)/100))}}><ZoomOut size={17}/></button>
    <output aria-live="polite">{Math.round(zoom*100)}%</output>
    <button type="button" aria-label="放大 Word" disabled={zoom>=2.2}
     onClick={()=>{setFitMode('custom');setZoom(v=>Math.min(2.2,Math.round((v+.1)*100)/100))}}><ZoomIn size={17}/></button>
   </div>
   <div className="hhba-word-minimal-actions" role="group" aria-label="版本与保存">
    <button type="button" disabled={busy||loading||revision<=0}
     title="撤销上一条 Word 修改" aria-label="撤销"
     onClick={()=>void changeRevision('undo')}><Undo2 size={17}/></button>
    <button type="button" disabled={busy||loading||revision>=totalRevisions}
     title="恢复 Word 修改" aria-label="重做"
     onClick={()=>void changeRevision('redo')}><Redo2 size={17}/></button>
    <button type="button" className="hhba-word-minimal-save"
     disabled={busy||loading} title={saved?'下载当前岗位独立 Word':'尚未修改，下载原始 Word'}
     onClick={()=>void(saved?downloadSaved():downloadOriginal())}><Save size={16}/> 保存 Word</button>
   </div>
  </footer>}
  {ready==='available'&&!selected&&<div className="hhba-original-resume-mobile-dock" role="group" aria-label="手机端 Word 操作">
   {onOpenSuggestions&&<button type="button" onClick={onOpenSuggestions}>
    <Sparkles size={15}/> 修改进度{pendingSuggestionCount?' '+pendingSuggestionCount:''}</button>}
   <button type="button" disabled={busy||loading||revision<=0}
    onClick={()=>void changeRevision('undo')}><Undo2 size={15}/> 撤销</button>
   <button type="button" disabled={busy||loading||revision>=totalRevisions}
    onClick={()=>void changeRevision('redo')}><Redo2 size={15}/> 重做</button>
   <button type="button" disabled={busy||loading||!pdfAvailable}
    onClick={()=>void downloadSavedPdf()}><Download size={15}/> 下载 PDF</button>
  </div>}
 </section>;
}
