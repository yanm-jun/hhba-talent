import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,Download,PencilLine,Save,Undo2,Redo2,ZoomIn,ZoomOut,Sparkles,X,History,ChevronDown} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {downloadPrivateResume,fetchPrivateResumeForLocalReview} from '../services/privateResumes';
import {extractDocxText} from '../services/docxProfile.mjs';
import {matchWordAnchors,type WordAnchor} from '../services/resumeWordAnchors.mjs';
import {
 wordRendererReady,wordEditableText,wordPreviewBytes,saveOriginalWordEdit,
 shiftOriginalWordRevision,downloadOriginalWordEdited,downloadOriginalWordPdf,
 type WordHistoryEntry
} from '../services/originalWordApi';
import '../styles/original-resume-viewer.css';
import '../styles/siri-edge.css';

// The original DOCX is NEVER converted into an HHBA template. A privately
// rendered PDF is used only to show the source page. Downloaded edits are
// the genuine original OOXML with a verified small text change.
type PendingWordTextDraft={original:string;text:string;revision:number;page:number};
export function OriginalWordViewer({resume,onClose,suggestedChanges=[],onOpenSuggestions,pendingSuggestionCount=0,onPendingChange,onVerifiedSave,onVersionMoved,sessionWordDraft,onSessionWordDraftChange,editPanelHost,onEditingChange}:{
 resume:PrivateResume;onClose?:()=>void;
 suggestedChanges?:{original:string;proposed:string}[];
 onOpenSuggestions?:()=>void;pendingSuggestionCount?:number;onPendingChange?:(dirty:boolean)=>void;
 onVerifiedSave?:(change:{original:string;text:string})=>void;
 onVersionMoved?:()=>void;
 sessionWordDraft?:PendingWordTextDraft|null;
 onSessionWordDraftChange?:(draft:PendingWordTextDraft|null)=>void;
 editPanelHost?:HTMLElement|null;
 onEditingChange?:(editing:boolean)=>void;
}){
 const surface=useRef<HTMLCanvasElement>(null);
 const paper=useRef<HTMLDivElement>(null);
 const doc=useRef<any>(null);
 const [ready,setReady]=useState<'checking'|'available'|'unavailable'>('checking');
 const [loading,setLoading]=useState(true);
 const [previewError,setPreviewError]=useState('');
 const [text,setText]=useState('');
 const [page,setPage]=useState(1);
 const [count,setCount]=useState(0);
 const [width,setWidth]=useState(680);
 const [zoom,setZoom]=useState(1);
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
  setPage(1);setZoom(1);restorePosition.current=null;
 },[resume.id]);
 useEffect(()=>{
  onPendingChange?.(Boolean(selected&&draft!==selected.text));
 },[selected,draft,onPendingChange]);
 useEffect(()=>{
  onEditingChange?.(Boolean(selected));
 },[selected,onEditingChange]);
 useEffect(()=>{
  if(!selected||draft===selected.text)return;
  const handle=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',handle);
  return()=>window.removeEventListener('beforeunload',handle);
 },[selected,draft]);

 useEffect(()=>{
  const controller=new AbortController();
  setReady('checking');
  void wordRendererReady(controller.signal).then(ok=>{
   if(!controller.signal.aborted)setReady(ok?'available':'unavailable');
  });
  return()=>controller.abort();
 },[resume.id]);

 useEffect(()=>{
  if(ready==='checking')return;
  let active=true,task:any=null;
  setLoading(true);setPreviewError('');setAnchors([]);setSelected(null);
  void(async()=>{
   try{
    if(ready==='unavailable'){
     const bytes=await fetchPrivateResumeForLocalReview(resume);
     const content=await extractDocxText(bytes);
     if(active){setText(content);setLoading(false);}
     return;
    }
    const info=await wordEditableText(resume.id);
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
    setHistory(Array.isArray(info.history)?info.history:[]);
    const bytes=await wordPreviewBytes(resume.id,wasSaved,undefined,
     Number.isInteger(info.revision)?info.revision:(wasSaved?1:0));
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
    setEditable((info.editable_text||[]).filter(t=>counts.get(t)===1));
    doc.current=result;setCount(result.numPages);
    setPage(current=>Math.min(Math.max(1,current),result.numPages));setLoading(false);
   }catch(error){
    if(active){
     setPreviewError(error instanceof Error?error.message:'无法打开这份 Word。');
     setLoading(false);
    }
   }
  })();
  return()=>{active=false;doc.current=null;void task?.destroy().catch(()=>{});};
 },[resume.id,ready,refresh]);

 useEffect(()=>{
  if(ready!=='available'||loading||!surface.current||!doc.current)return;
  let active=true,task:any=null;
  setAnchors([]);
  void(async()=>{
   try{
    const source=doc.current,view=await source.getPage(page);
    if(!active||!surface.current)return;
    const base=view.getViewport({scale:1});
    const scale=Math.min(3.2,Math.max(.5,width/base.width))*zoom;
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
     editableText:editable,items,viewport:viewport as any,page
    }));
   }catch(error){
    if(active&&error instanceof Error&&error.name!=='RenderingCancelledException')
     setPreviewError('这一页暂时无法显示，请下载原件查看。');
   }
  })();
  return()=>{active=false;try{task?.cancel();}catch{}};
 },[page,ready,loading,editable,width,zoom,saved,refresh]);

 useEffect(()=>{
  const el=paper.current;if(!el)return;
  const update=()=>setWidth(Math.max(255,Math.min(800,el.clientWidth-20)));
  update();const observer=new ResizeObserver(update);observer.observe(el);
  return()=>observer.disconnect();
 },[ready,loading]);
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
 async function downloadOriginal(){
  try{await downloadPrivateResume(resume);}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
 }
 async function downloadSaved(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordEdited(resume.id);
   setMessage('已发起 Word 下载，请在浏览器下载列表查看。');}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function downloadSavedPdf(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordPdf(resume.id);
   setMessage('已发起当前已确认版本的 PDF 下载。');}
  catch(error){setMessage(error instanceof Error?error.message:'PDF 下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function save(){
  if(!selected||!confirmed||busy||!draft.trim()||draft.length>300)return;
  rememberPosition();setBusy(true);setMessage('');
  try{
   const result=await saveOriginalWordEdit(resume.id,selected.text,draft.trim(),revision);
   onSessionWordDraftChange?.(null);
   onVerifiedSave?.({original:selected.text,text:draft.trim()});
   setSelected(null);setConfirmed(false);setSaved(true);
   setRevision(result.revision);setTotalRevisions(result.total_revisions);
   setRefresh(n=>n+1);setMessage('已检查版式并保存第 '+result.revision+' 次修改。原始 Word 保持不变。');
  }catch(error){setMessage(error instanceof Error?error.message:'没有保存，请缩短文字后重试。');}
  finally{setBusy(false);}
 }
 async function changeRevision(action:'undo'|'redo'){
  if(busy||ready!=='available'||action==='undo'&&revision<=0||
   action==='redo'&&revision>=totalRevisions)return;
  if(!confirmDiscardText())return;
  rememberPosition();setBusy(true);setMessage('');
  try{
   const result=await shiftOriginalWordRevision(resume.id,action,revision);
   onSessionWordDraftChange?.(null);setSelected(null);setConfirmed(false);
   onVersionMoved?.();
   setRevision(result.revision);setTotalRevisions(result.total_revisions);
   setSaved(result.saved);setRefresh(n=>n+1);
   setMessage(action==='undo'?'已撤销一处修改，当前文档已恢复对应的原始字体与版式。':
    '已重新应用已验证的 Word 修改。');
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
   · 保留原字体、字号和排版；不符合版式要求时不会保存。</p>
  <label className="hhba-original-resume-edit-confirm"><input type="checkbox" checked={confirmed}
   onChange={e=>setConfirmed(e.target.checked)}/>
   我已核实修改后的文字属实
  </label>
  <div className="hhba-original-resume-editbox-actions">
   <button type="button" disabled={!confirmed||!draft.trim()||busy}
    onClick={()=>void save()}><Save size={14}/> {busy?'正在检查…':'确认保存'}</button>
   <button type="button" onClick={()=>{
    if(!confirmDiscardText())return;
    onSessionWordDraftChange?.(null);setSelected(null);setDraft('');setConfirmed(false);
   }}>取消</button>
  </div>
 </div>:null;
 return <section className={'hhba-original-resume hhba-original-word-viewer'+
  (selected&&!editPanelHost?' has-inline-editor':'')} aria-label="查看我的 Word 简历">
  <div className="hhba-original-resume-toolbar">
   <div className="hhba-original-resume-file-heading">
    <strong>{resume.name}</strong>
    <span>原版式 Word · 当前修改进度：{revision} / {totalRevisions}</span>
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
      <button type="button" disabled={!saved||busy}
       onClick={()=>void downloadSavedPdf()}>下载 PDF</button>
     </div>
    </details>
    <details className="hhba-word-menu hhba-original-resume-version-menu">
     <summary><History size={16}/> 版本</summary>
     <div className="hhba-word-menu-content">
      <p>当前版本 {revision} / {totalRevisions} · 最多 {maxRevisions} 次修订</p>
      <p>单日最多 {maxDailyEdits} 次保存验证，撤销和重做不计入。</p>
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
  {message&&<p className="hhba-original-resume-word-status" role="status">{message}</p>}
  {sessionWordDraft&&ready==='available'&&<details className="hhba-word-draft-help">
   <summary>检测到未完成文字草稿</summary>
   <p>可在第 {sessionWordDraft.page} 页点选相同原文继续核对；修订号或原文不同不会自动填入。</p>
  </details>}
  {loading&&<p className="hhba-original-resume-note" role="status">正在打开简历…</p>}
  {busy&&<p className="hhba-original-resume-word-status is-busy" role="status">
   正在校验原 Word 的文字位置、字体与分页，保存后同步准备 PDF；检查不通过不会覆盖原件。
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
  {!loading&&ready==='available'&&!previewError&&<>
   <div className="hhba-original-resume-word-tools" role="group" aria-label="Word 预览缩放">
    <button type="button" aria-label="缩小 Word" onClick={()=>setZoom(value=>Math.max(.75,Math.round((value-.25)*100)/100))}
     disabled={zoom<=.75}><ZoomOut size={15}/></button>
    <output aria-live="polite">{Math.round(zoom*100)}%</output>
    <button type="button" aria-label="放大 Word" onClick={()=>setZoom(value=>Math.min(2,Math.round((value+.25)*100)/100))}
     disabled={zoom>=2}><ZoomIn size={15}/></button>
    <button type="button" onClick={()=>setZoom(1)} disabled={zoom===1}>适合宽度</button>
   </div>
   <div className="hhba-original-resume-siri-stage">
    <div className="hhba-original-resume-paper hhba-word-native-preview" ref={paper}>
     <div className="hhba-original-resume-page-frame" style={{
      width:paperSize.width||undefined,height:paperSize.height||undefined
     }}>
      <canvas className="hhba-original-resume-canvas" ref={surface}
       role="img" aria-label={'Word 原始页面第 '+page+' 页'}/>
      {anchors.map(anchor=>{
       const [x,y,w,h]=anchor.bbox;
       return <button key={anchor.id} type="button"
        className={"hhba-original-resume-anchor"+(selected?.id===anchor.id?" is-selected":"")} title="修改这段"
        aria-label="修改这段 Word"
        style={{left:x/10+'%',top:y/10+'%',width:w/10+'%',height:h/10+'%'}}
        onClick={()=>{
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
         setSelected(anchor);setDraft(candidate);
         setConfirmed(false);
         setMessage(restored?'已恢复未保存的文字草稿，请检查后再次确认。':
          matches.length===1?'已填入本人确认过的建议；请复核事实与原版式后再保存。':'');
        }}>
        <span><PencilLine size={12}/> 修改</span>
       </button>;
      })}

     </div>
    </div>
   </div>
   {editPanel&&(!editPanelHost?
    <aside className="hhba-word-standalone-edit-panel">{editPanel}</aside>:
    createPortal(editPanel,editPanelHost))}
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
  {ready==='available'&&!selected&&<div className="hhba-original-resume-mobile-dock" role="group" aria-label="手机端 Word 操作">
   {onOpenSuggestions&&<button type="button" onClick={onOpenSuggestions}>
    <Sparkles size={15}/> AI 建议{pendingSuggestionCount?' '+pendingSuggestionCount:''}</button>}
   <button type="button" disabled={busy||loading||revision<=0}
    onClick={()=>void changeRevision('undo')}><Undo2 size={15}/> 撤销</button>
   <button type="button" disabled={busy||loading||revision>=totalRevisions}
    onClick={()=>void changeRevision('redo')}><Redo2 size={15}/> 重做</button>
   <button type="button" disabled={busy||loading||!saved}
    onClick={()=>void downloadSavedPdf()}><Download size={15}/> 下载 PDF</button>
  </div>}
 </section>;
}
