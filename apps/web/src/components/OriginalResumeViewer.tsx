import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,PencilLine,Save,Undo2,X} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {fetchPrivateResumeForLocalReview,downloadPrivateResume} from '../services/privateResumes';
import {extractDocxText} from '../services/docxProfile.mjs';
import {OriginalWordViewer} from './OriginalWordViewer';
import {LegacyPdfReadOnlyViewer} from './LegacyPdfReadOnlyViewer';
import {matchVisualRegionsToPdfPage,type VerifiedResumeAnchor} from '../services/resumeVisualAnchors.mjs';
import {planInlinePdfPreview,whitePdfPatchBackground} from '../services/resumeInlinePdfPreview.mjs';
import {splitChangedResumeText} from '../services/resumeChangedText.mjs';
import {patchPdfWithOriginalFont} from '../services/resumePdfNativeFont.mjs';
import {patchPdfWithOriginalCjkFont} from '../services/resumePdfCjkFont.mjs';
import {verifyOriginalFontPdfPatch} from '../services/resumePdfNativeVerify.mjs';
import {visualEditingReady,analyzeVisualResume,listPageResumeEdits,savePageResumeEdits,
 type VisualResumeLayout,type PageResumeEdit} from '../services/resumeVisualEditingApi';
import '../styles/original-resume-viewer.css';
import '../styles/siri-edge.css';

// The viewer only displays a user's already stored original. The private R2
// blob is fetched under that account's bearer session, never via public URL.
// PDF canvas renders the actual original page instead of regenerating HTML.
export function OriginalResumeViewer(props:{resume:PrivateResume;onClose:()=>void;}){
 if(props.resume.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  return <OriginalWordViewer {...props}/>;
 // Keep the historical synthetic PDF editor QA isolated to the local Vite test
 // harness; real users now receive only the original PDF and its download.
 if(import.meta.env.DEV&&typeof window!=='undefined'&&
  window.location.pathname.startsWith('/qa/'))return <OriginalPdfViewer {...props}/>;
 return <LegacyPdfReadOnlyViewer {...props}/>;
}
function OriginalPdfViewer({resume,onClose}:{
 resume:PrivateResume;onClose:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const paper=useRef<HTMLDivElement>(null);
 const pdfDocument=useRef<any>(null);
 const verifiedDisplayDocument=useRef<any>(null);
 const verifiedDisplayLoadingTask=useRef<any>(null);
 const nativeRevision=useRef(0);
 const [nativePdf,setNativePdf]=useState<Uint8Array|null>(null);
 const [nativeRenderRevision,setNativeRenderRevision]=useState(0);
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
 // Siri is a PENDING-only visual aid. Never paint a confirmed edit in a
 // guessed Arial/Noto typeface: original PDF fonts may be embedded/subsetted.
 // Without an exact native font proof, show the saved edit as a record but
 // keep the original page untouched, and do NOT issue a mismatched export.
 const previewPlans=useMemo(()=>{
  const result=new Map<string,ReturnType<typeof planInlinePdfPreview>>();
  const source=canvas.current;
  if(nativePdf)return result;
  const measureCanvas=document.createElement('canvas');
  const measureContext=measureCanvas.getContext('2d');
  if(!source||!measureContext)return result;
  for(const anchor of anchors){
   if(selectedId!==anchor.id||draft.trim()===anchor.text)continue;
   const plan=planInlinePdfPreview({
    anchor,replacement:draft,
    pageWidth:pageSize.width,pageHeight:pageSize.height,
    onWhite:whitePdfPatchBackground(source,anchor.bbox),
    measure:(text:string,fontPx:number)=>{
     measureContext.font=fontPx+'px Arial, "Noto Sans CJK SC", sans-serif';
     return measureContext.measureText(text).width;
    }
   });
   result.set(anchor.id,plan);
  }
  return result;
 },[anchors,selectedId,draft,pageSize,nativePdf]);
 useEffect(()=>{
  let active=true;
  let pdfTask:any=null;
  setPage(1);setPageCount(0);setText('');setError('');setStatus('loading');
  setAnchors([]);setSelectedId(null);setLayout(null);setChanges([]);setVisionConsent(false);
  nativeRevision.current++;
  setNativePdf(null);setNativeRenderRevision(0);
  if(verifiedDisplayLoadingTask.current){
   void verifiedDisplayLoadingTask.current.destroy().catch(()=>{});
   verifiedDisplayLoadingTask.current=null;
  }
  verifiedDisplayDocument.current=null;
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
  return()=>{active=false;nativeRevision.current++;
   pdfDocument.current=null;if(pdfTask)void pdfTask.destroy().catch(()=>{});
   if(verifiedDisplayLoadingTask.current){
    void verifiedDisplayLoadingTask.current.destroy().catch(()=>{});
    verifiedDisplayLoadingTask.current=null;
   }
   verifiedDisplayDocument.current=null;
  };
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
    const displayPage=verifiedDisplayDocument.current?
     await verifiedDisplayDocument.current.getPage(page):pageObject;
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
    renderTask=displayPage.render({
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
 },[isPdf,status,page,width,pageCount,layout,nativeRenderRevision]);
 useEffect(()=>{
  const element=paper.current;if(!element)return;
  const update=()=>setWidth(Math.max(260,Math.min(800,element.clientWidth-20)));
  update();
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
  observer?.observe(element);return()=>observer?.disconnect();
 },[isPdf,status]);
 function clearVerifiedNative(){
  nativeRevision.current++;
  if(verifiedDisplayLoadingTask.current){
   void verifiedDisplayLoadingTask.current.destroy().catch(()=>{});
   verifiedDisplayLoadingTask.current=null;
  }
  verifiedDisplayDocument.current=null;
  setNativePdf(null);setNativeRenderRevision(n=>n+1);
 }
 async function verifyNativeCandidate(next:PageResumeEdit[]){
  const token=++nativeRevision.current;
  if(next.length!==1){
   clearVerifiedNative();return false;
  }
  const change=next[0];
  try{
   // Never use an AI guess for fonts. Patch existing English or Chinese
   // glyph codes only, leaving embedded font data and other PDF bytes intact.
   const original=new Uint8Array(await fetchPrivateResumeForLocalReview(resume));
   let patch;
   try{
    patch=patchPdfWithOriginalFont(original,change.original,change.text);
   }catch{
    // Only when the actual embedded font and its ToUnicode map prove that
    // every Chinese glyph is already present. No font substitutions.
    patch=patchPdfWithOriginalCjkFont(original,change.original,change.text);
   }
   const {getDocument}=await import('pdfjs-dist');
   await verifyOriginalFontPdfPatch({
    originalBytes:original,editedBytes:patch.bytes,proof:patch.proof,
    getDocument,canvasFactory:()=>document.createElement('canvas')
   });
   if(token!==nativeRevision.current)return false;
   const task=getDocument({data:new Uint8Array(patch.bytes),
    isEvalSupported:false,useSystemFonts:false} as any);
   const ready=await task.promise;
   if(token!==nativeRevision.current){await task.destroy();return false;}
   const previous=verifiedDisplayLoadingTask.current;
   verifiedDisplayLoadingTask.current=task;
   verifiedDisplayDocument.current=ready;
   setNativePdf(patch.bytes);
   setNativeRenderRevision(n=>n+1);
   if(previous)void previous.destroy().catch(()=>{});
   return true;
  }catch{
   if(token===nativeRevision.current){
    const previous=verifiedDisplayLoadingTask.current;
    verifiedDisplayLoadingTask.current=null;
    verifiedDisplayDocument.current=null;setNativePdf(null);
    setNativeRenderRevision(n=>n+1);
    if(previous)void previous.destroy().catch(()=>{});
   }
   return false;
  }
 }
 function downloadVerifiedNative(){
  if(!nativePdf)return;
  const body=new Uint8Array(nativePdf);
  const blob=new Blob([body],{type:'application/pdf'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=(resume.name.replace(/\.pdf$/i,'')||'我的简历')+'-已修改.pdf';
  link.hidden=true;document.body.appendChild(link);
  try{link.click();}finally{
   link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
 }
 async function startEditing(){
  if(visionBusy||!visionConsent||!canStartEdit||!isPdf)return;
  setVisionBusy(true);setMessage('');setSelectedId(null);setConfirmed(false);
  try{
   const data=await analyzeVisualResume(resume.id);
   if(data.layout.source_sha256.length!==64)throw Error('暂时无法检查这份简历。');
   const saved=await listPageResumeEdits(resume.id);
   setLayout(data.layout);setChanges(saved.changes||[]);
   const previouslyVerified=await verifyNativeCandidate(saved.changes||[]);
   setMessage(previouslyVerified?'':'已打开简历，点击文字旁的「修改」即可操作。');
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
   const accepted=await verifyNativeCandidate(response.changes);
   setMessage(accepted?'':'这份 PDF 暂时不能保留原样式完成替换，修改已暂存。');
  }catch(error){setMessage(error instanceof Error?error.message:'保存失败，请重试。');}
  finally{setSaving(false);}
 }
 async function undoChange(anchor:VerifiedResumeAnchor){
  if(saving||!changes.some(item=>item.id===anchor.id))return;
  setSaving(true);setMessage('');
  try{
   const response=await savePageResumeEdits(resume.id,changes.filter(item=>item.id!==anchor.id));
   setChanges(response.changes);setDraft(anchor.text);setSelectedId(null);
   await verifyNativeCandidate(response.changes);
   setMessage('已撤销这段修改。');
  }catch(error){setMessage(error instanceof Error?error.message:'撤销失败，请重试。');}
  finally{setSaving(false);}
 }
 async function download(){
  try{await downloadPrivateResume(resume);}
  catch(e){setError(e instanceof Error?e.message:'下载原件失败');}
 }
 return <section className="hhba-original-resume" aria-label="查看我的简历">
  <div className="hhba-original-resume-toolbar">
   <div><strong>{resume.name}</strong><p>原件始终保留</p></div>
   <div>
    <button type="button" onClick={()=>void download()} aria-label="下载简历原件">
     <Download size={15}/> 下载原件</button>
    <button type="button" onClick={onClose} aria-label="关闭原件预览"><X size={16}/></button>
   </div>
  </div>
  {status==='loading'&&<p role="status" className="hhba-original-resume-note">正在打开简历…</p>}
  {status==='error'&&<p role="alert" className="hhba-original-resume-note">{error}</p>}
  {status==='ready'&&isPdf&&<>
   {canStartEdit&&!layout&&<div className="hhba-original-resume-start">
    <label><input type="checkbox" checked={visionConsent}
     onChange={e=>setVisionConsent(e.target.checked)}/>
     我同意将这份简历提供给第三方 AI 帮助查找可修改的位置。不会自动修改简历或投递。</label>
    <button type="button" onClick={()=>void startEditing()}
     disabled={!visionConsent||visionBusy}>
     <PencilLine size={14}/>{visionBusy?'正在准备…':'开始修改'}</button>
   </div>}
   <div className={'hhba-original-resume-siri-stage hhba-siri-edge'+(selectedId?' hhba-siri-edge-active':'')}>
    <div ref={paper} className="hhba-original-resume-paper">
    <div className="hhba-original-resume-page-frame" style={{
     width:pageSize.width||undefined,height:pageSize.height||undefined}}>
     <canvas ref={canvas} role="img" aria-label={'原始 PDF 第 '+page+' 页'}
      className="hhba-original-resume-canvas"/>
     {layout&&anchors.map(anchor=>{
      const plan=previewPlans.get(anchor.id);
      if(!plan?.safe||selectedId!==anchor.id)return null;
      const [x,y,w,h]=anchor.bbox;
      const diff=splitChangedResumeText(anchor.text,plan.text);
      return <div className="hhba-original-resume-edit-patch hhba-original-resume-draft-patch"
       key={'patch-'+anchor.id} role="note" aria-label="待确认文字预览"
       style={{
        left:'calc('+x/10+'% - 2px)',top:'calc('+y/10+'% - 2px)',
        width:'calc('+w/10+'% + 4px)',height:'calc('+h/10+'% + 4px)',
        fontSize:plan.fontPx+'px'
       }}>
       <span className="hhba-original-resume-patch-line">
        {diff.prefix}
        {diff.changed&&<span className="hhba-resume-siri-letters"
         data-resume-change="modified-or-added">{diff.changed}</span>}
        {diff.suffix}
       </span>
      </div>;
     })}
     {layout&&anchors.map(anchor=>{
      const changed=changes.some(c=>c.id===anchor.id);
      const [x,y,w,h]=anchor.bbox;
      return <button type="button" key={anchor.id}
       className={'hhba-original-resume-anchor'+(changed?' is-edited':'')}
       title={changed?'查看待核验的修改':'修改这段'}
       aria-label={changed?'继续修改这一段':'修改这段简历'}
       onClick={()=>selectAnchor(anchor)}
       style={{left:x/10+'%',top:y/10+'%',width:w/10+'%',height:h/10+'%'}}>
       <span><PencilLine size={12}/>{changed?'待核验':'修改'}</span>
      </button>;
     })}
     {layout&&selectedId&&anchors.filter(a=>a.id===selectedId).map(anchor=>{
      const changed=changes.some(c=>c.id===anchor.id);
      const popupWidth=Math.min(296,Math.max(220,pageSize.width-24));
      const suggestedLeft=pageSize.width*anchor.bbox[0]/1000;
      const safeLeft=Math.max(10,Math.min(suggestedLeft,pageSize.width-popupWidth-10));
      return <div className="hhba-original-resume-edit-glow hhba-siri-edge hhba-siri-edge-active"
       key={anchor.id}
       style={{left:safeLeft+'px',width:popupWidth+'px',
        top:Math.min(72,(anchor.bbox[1]+anchor.bbox[3])/10+1)+'%'}}>
       <div className="hhba-original-resume-editbox"
        role="region" aria-label="在原文位置修改">
       <div className="hhba-original-resume-editbox-title">
        <strong>修改这段</strong>
        <button type="button" aria-label="关闭修改" onClick={()=>setSelectedId(null)}><X size={14}/></button>
       </div>
       <textarea aria-label="修改这段内容" maxLength={1600} rows={3} value={draft}
        className={draft!==anchor.text?'hhba-siri-typing':''}
        onChange={e=>{setDraft(e.target.value);setConfirmed(false);}}/>
       <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
        我确认修改内容属实</label>
       <div className="hhba-original-resume-editbox-actions">
        <button type="button" disabled={!confirmed||!draft.trim()||saving}
         onClick={()=>void saveChange(anchor)}><Save size={13}/> 保存</button>
        {changed&&<button type="button" disabled={saving} onClick={()=>void undoChange(anchor)}>
         <Undo2 size={13}/> 撤销</button>}
       </div>
       </div>
      </div>;
     })}
    </div>
    </div>
   </div>
   {layout&&!nativePdf&&anchors.length===0&&<p className="hhba-original-resume-note">
    这页暂时没有找到可以准确修改的位置。你仍然可以查看和下载原件。</p>}
   {changes.length>0&&<>
    <p className="hhba-original-resume-note" role="status">
     {nativePdf?'已保存修改。原来排版和字体保持不变，原件也已保留。':
      '已暂存 '+changes.length+' 处修改。暂不能保持原样式生成修改版 PDF，你仍可下载原件。'}
    </p>
    {nativePdf&&<div className="hhba-original-resume-review-export">
     <button type="button" onClick={downloadVerifiedNative}><Download size={14}/> 下载 PDF</button>
    </div>}
   </>}
   {message&&<p className="hhba-original-resume-note" role="status">{message}</p>}
   <nav className="hhba-original-resume-pages" aria-label="原始简历翻页">
    <button type="button" disabled={page<=1}
     onClick={()=>{setSelectedId(null);setPage(n=>n-1)}}>
     <ChevronLeft size={15}/> 上一页</button>
    <span>第 {page} / {pageCount} 页</span>
    <button type="button" disabled={page>=pageCount}
     onClick={()=>{setSelectedId(null);setPage(n=>n+1)}}>
     下一页 <ChevronRight size={15}/></button>
   </nav>
  </>}
  {status==='ready'&&!isPdf&&<div className="hhba-original-resume-word">
   <p role="note">可以先查看文字。要查看 Word 的原始样式，请下载原件打开。</p>
   <pre>{text}</pre>
  </div>}
 </section>;
}
