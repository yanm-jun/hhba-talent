import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,PencilLine,Save,Undo2,X} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {fetchPrivateResumeForLocalReview,downloadPrivateResume} from '../services/privateResumes';
import {extractDocxText} from '../services/docxProfile.mjs';
import {matchVisualRegionsToPdfPage,type VerifiedResumeAnchor} from '../services/resumeVisualAnchors.mjs';
import {visualEditingReady,analyzeVisualResume,listPageResumeEdits,savePageResumeEdits,
 type VisualResumeLayout,type PageResumeEdit} from '../services/resumeVisualEditingApi';
import '../styles/original-resume-viewer.css';

// The viewer only displays a user's already stored original. The private R2
// blob is fetched under that account's bearer session, never via public URL.
// PDF canvas renders the actual original page instead of regenerating HTML.
export function OriginalResumeViewer({resume,onClose}:{
 resume:PrivateResume;onClose:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const paper=useRef<HTMLDivElement>(null);
 const pdfDocument=useRef<any>(null);
 const [page,setPage]=useState(1),[pageCount,setPageCount]=useState(0);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [error,setError]=useState(''),[text,setText]=useState('');
 const [width,setWidth]=useState(700);
 const [pageSize,setPageSize]=useState({width:0,height:0});
 const [canStartEdit,setCanStartEdit]=useState(false);
 const [visionConsent,setVisionConsent]=useState(false);
 const [visionBusy,setVisionBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [layout,setLayout]=useState<VisualResumeLayout|null>(null);
 const [anchors,setAnchors]=useState<VerifiedResumeAnchor[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [draft,setDraft]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [changes,setChanges]=useState<PageResumeEdit[]>([]);
 const [message,setMessage]=useState('');
 const isPdf=resume.type==='application/pdf';
 useEffect(()=>{
  let active=true;
  let pdfTask:any=null;
  setPage(1);setPageCount(0);setText('');setError('');setStatus('loading');
  setAnchors([]);setSelectedId(null);setLayout(null);setChanges([]);setVisionConsent(false);
  setMessage('');
  void (async()=>{
   try{
    const buffer=await fetchPrivateResumeForLocalReview(resume);
    if(!active)return;
    if(!isPdf){
     const originalText=await extractDocxText(buffer);
     if(active){setText(originalText);setStatus('ready');}
     return;
    }
    const [pdf,worker]=await Promise.all([
     import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    if(!active)return;
    pdf.GlobalWorkerOptions.workerSrc=worker.default;
    pdfTask=pdf.getDocument({
     data:new Uint8Array(buffer),isEvalSupported:false,
     enableXfa:false,disableAutoFetch:true,disableStream:true,
     stopAtErrors:true,useSystemFonts:false
    } as any); // PDF.js v6 runtime safety flags are omitted from its published init typings.
    const doc=await pdfTask.promise;
    if(!active){await pdfTask.destroy();return;}
    pdfDocument.current=doc;setPageCount(doc.numPages);setStatus('ready');
   }catch(e){
    if(active){setError(e instanceof Error?e.message:'原文件无法预览，请下载原件查看。');setStatus('error');}
   }
  })();
  return()=>{active=false;pdfDocument.current=null;if(pdfTask)void pdfTask.destroy().catch(()=>{});};
 },[resume.id,isPdf]);
 useEffect(()=>{
  if(!isPdf)return;
  const abort=new AbortController();setCanStartEdit(false);
  void visualEditingReady(abort.signal).then(ready=>{
   if(!abort.signal.aborted)setCanStartEdit(ready);
  });
  return()=>abort.abort();
 },[resume.id,isPdf]);
 useEffect(()=>{
  if(!isPdf||status!=='ready'||!pdfDocument.current||!canvas.current)return;
  let alive=true,renderTask:any=null;
  setAnchors([]);
  void (async()=>{
   try{
    const doc=pdfDocument.current;
    const pageObject=await doc.getPage(page);
    if(!alive||!canvas.current)return;
    const viewportBase=pageObject.getViewport({scale:1});
    const scale=Math.min(1.6,Math.max(0.55,width/viewportBase.width));
    const viewport=pageObject.getViewport({scale});
    const pixelRatio=Math.min(1.5,window.devicePixelRatio||1);
    const surface=canvas.current;
    setPageSize({width:viewport.width,height:viewport.height});
    surface.width=Math.max(1,Math.floor(viewport.width*pixelRatio));
    surface.height=Math.max(1,Math.floor(viewport.height*pixelRatio));
    surface.style.width=viewport.width+'px';
    surface.style.height=viewport.height+'px';
    const ctx=surface.getContext('2d');
    if(!ctx)throw Error('PDF_DISPLAY_UNAVAILABLE');
    ctx.clearRect(0,0,surface.width,surface.height);
    renderTask=pageObject.render({
     canvas:surface,canvasContext:ctx,viewport,
     transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0]
    });
    await renderTask.promise;
    if(alive&&layout){
     const textContent=await pageObject.getTextContent({includeMarkedContent:false});
     if(alive)setAnchors(matchVisualRegionsToPdfPage({
      regions:layout.regions,items:textContent.items.filter((item:any)=>typeof item.str==='string') as any,
      viewport:viewport as any,page
     }));
    }
    if(alive)pageObject.cleanup();
   }catch(e){
    if(alive&&e instanceof Error&&e.name!=='RenderingCancelledException'){
     setError('页面显示失败，请下载原件查看。');setStatus('error');
    }
   }
  })();
  return()=>{alive=false;try{renderTask?.cancel();}catch{}};
 },[isPdf,status,page,width,pageCount,layout]);
 useEffect(()=>{
  const element=paper.current;if(!element)return;
  const update=()=>setWidth(Math.max(260,Math.min(800,element.clientWidth-20)));
  update();
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
  observer?.observe(element);return()=>observer?.disconnect();
 },[isPdf,status]);
 async function startEditing(){
  if(visionBusy||!visionConsent||!canStartEdit||!isPdf)return;
  setVisionBusy(true);setMessage('');setSelectedId(null);setConfirmed(false);
  try{
   const data=await analyzeVisualResume(resume.id);
   if(data.layout.source_sha256.length!==64)throw Error('暂时无法检查这份简历。');
   const saved=await listPageResumeEdits(resume.id);
   setLayout(data.layout);setChanges(saved.changes||[]);
   setMessage('已打开修改功能。选择简历中有标记的文字即可修改。');
  }catch(error){
   setMessage(error instanceof Error?error.message:'暂时无法修改，请稍后再试。');
  }finally{setVisionBusy(false);}
 }
 function selectAnchor(anchor:VerifiedResumeAnchor){
  setSelectedId(current=>current===anchor.id?null:anchor.id);
  const previous=changes.find(c=>c.id===anchor.id);
  setDraft(previous?.text??anchor.text);
  setConfirmed(false);setMessage('');
 }
 async function saveChange(anchor:VerifiedResumeAnchor){
  if(saving||!confirmed||!draft.trim()||draft.length>1600)return;
  setSaving(true);setMessage('');
  const updated:PageResumeEdit[]=[
   ...changes.filter(item=>item.id!==anchor.id),
   {id:anchor.id,original:anchor.text,text:draft.trim(),confirmed:true}
  ];
  try{
   const response=await savePageResumeEdits(resume.id,updated);
   setChanges(response.changes);setSelectedId(null);setConfirmed(false);
   setMessage('修改已保存到你的简历副本。原始文件没有改变。');
  }catch(error){setMessage(error instanceof Error?error.message:'保存失败，请重试。');}
  finally{setSaving(false);}
 }
 async function undoChange(anchor:VerifiedResumeAnchor){
  if(saving||!changes.some(item=>item.id===anchor.id))return;
  setSaving(true);setMessage('');
  try{
   const response=await savePageResumeEdits(resume.id,changes.filter(item=>item.id!==anchor.id));
   setChanges(response.changes);setDraft(anchor.text);setSelectedId(null);
   setMessage('已撤销这段修改。');
  }catch(error){setMessage(error instanceof Error?error.message:'撤销失败，请重试。');}
  finally{setSaving(false);}
 }
 async function download(){
  try{await downloadPrivateResume(resume);}
  catch(e){setError(e instanceof Error?e.message:'下载原件失败');}
 }
 return <section className="hhba-original-resume" aria-label="简历原件预览">
  <div className="hhba-original-resume-toolbar">
   <div><strong>{resume.name}</strong><p>原始文件预览 · 不会修改已上传的原件</p></div>
   <div>
    <button type="button" onClick={()=>void download()} aria-label="下载简历原件">
     <Download size={15}/> 下载原件</button>
    <button type="button" onClick={onClose} aria-label="关闭原件预览"><X size={16}/></button>
   </div>
  </div>
  {status==='loading'&&<p role="status" className="hhba-original-resume-note">正在打开简历…</p>}
  {status==='error'&&<p role="alert" className="hhba-original-resume-note">{error}</p>}
  {status==='ready'&&isPdf&&<>
   <div ref={paper} className="hhba-original-resume-paper">
    <canvas ref={canvas} role="img" aria-label={'原始 PDF 第 '+page+' 页'}
     className="hhba-original-resume-canvas"/>
   </div>
   <nav className="hhba-original-resume-pages" aria-label="原始简历翻页">
    <button type="button" disabled={page<=1} onClick={()=>setPage(n=>n-1)}>
     <ChevronLeft size={15}/> 上一页</button>
    <span>第 {page} / {pageCount} 页</span>
    <button type="button" disabled={page>=pageCount} onClick={()=>setPage(n=>n+1)}>
     下一页 <ChevronRight size={15}/></button>
   </nav>
  </>}
  {status==='ready'&&!isPdf&&<div className="hhba-original-resume-word">
   <p role="note">这份 Word 的文字可以查看，但原来的表格、字体和分栏尚不能在这里准确呈现。需要核对原始排版时，请下载原件使用 Word 或 WPS 打开。</p>
   <pre>{text}</pre>
  </div>}
 </section>;
}
