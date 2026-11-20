import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,PencilLine,Save,X} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {downloadPrivateResume,fetchPrivateResumeForLocalReview} from '../services/privateResumes';
import {extractDocxText} from '../services/docxProfile.mjs';
import {matchWordAnchors,type WordAnchor} from '../services/resumeWordAnchors.mjs';
import {
 wordRendererReady,wordEditableText,wordPreviewBytes,saveOriginalWordEdit,
 downloadOriginalWordEdited,downloadOriginalWordPdf
} from '../services/originalWordApi';
import '../styles/original-resume-viewer.css';
import '../styles/siri-edge.css';

// The original DOCX is NEVER converted into an HHBA template. A privately
// rendered PDF is used only to show the source page. Downloaded edits are
// the genuine original OOXML with a verified small text change.
export function OriginalWordViewer({resume,onClose,suggestedChanges=[]}:{
 resume:PrivateResume;onClose:()=>void;
 suggestedChanges?:{original:string;proposed:string}[];
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
 const [paperSize,setPaperSize]=useState({width:0,height:0});
 const [editable,setEditable]=useState<string[]>([]);
 const [anchors,setAnchors]=useState<WordAnchor[]>([]);
 const [selected,setSelected]=useState<WordAnchor|null>(null);
 const [draft,setDraft]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [message,setMessage]=useState('');

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
  setLoading(true);setPreviewError('');setPage(1);setAnchors([]);setSelected(null);
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
    const bytes=await wordPreviewBytes(resume.id,wasSaved);
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
    if(result.numPages<=20&&!wasSaved){
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
    setEditable(wasSaved?[]:(info.editable_text||[]).filter(t=>counts.get(t)===1));
    doc.current=result;setCount(result.numPages);setLoading(false);
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
    const scale=Math.min(1.65,Math.max(.5,width/base.width));
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
    if(saved)return;
    setAnchors(matchWordAnchors({
     editableText:editable,items,viewport:viewport as any,page
    }));
   }catch(error){
    if(active&&error instanceof Error&&error.name!=='RenderingCancelledException')
     setPreviewError('这一页暂时无法显示，请下载原件查看。');
   }
  })();
  return()=>{active=false;try{task?.cancel();}catch{}};
 },[page,ready,loading,editable,width,saved,refresh]);

 useEffect(()=>{
  const el=paper.current;if(!el)return;
  const update=()=>setWidth(Math.max(255,Math.min(800,el.clientWidth-20)));
  update();const observer=new ResizeObserver(update);observer.observe(el);
  return()=>observer.disconnect();
 },[ready,loading]);

 async function downloadOriginal(){
  try{await downloadPrivateResume(resume);}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
 }
 async function downloadSaved(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordEdited(resume.id);}
  catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function downloadSavedPdf(){
  setBusy(true);setMessage('');
  try{await downloadOriginalWordPdf(resume.id);}
  catch(error){setMessage(error instanceof Error?error.message:'PDF 下载失败，请重试。');}
  finally{setBusy(false);}
 }
 async function save(){
  if(!selected||!confirmed||busy||!draft.trim()||draft.length>300)return;
  setBusy(true);setMessage('');
  try{
   await saveOriginalWordEdit(resume.id,selected.text,draft.trim());
   setSelected(null);setConfirmed(false);setSaved(true);
   setRefresh(n=>n+1);setMessage('修改已保存，原来的版式没有改变。');
  }catch(error){setMessage(error instanceof Error?error.message:'没有保存，请缩短文字后重试。');}
  finally{setBusy(false);}
 }
 return <section className="hhba-original-resume" aria-label="查看我的 Word 简历">
  <div className="hhba-original-resume-toolbar">
   <div><strong>{resume.name}</strong><p>原件始终保留</p></div>
   <div>
    <button type="button" onClick={()=>void downloadOriginal()}>
     <Download size={15}/> 下载原件</button>
    <button type="button" onClick={onClose} aria-label="关闭原件预览"><X size={16}/></button>
   </div>
  </div>
  {loading&&<p className="hhba-original-resume-note" role="status">正在打开简历…</p>}
  {previewError&&<p className="hhba-original-resume-note" role="alert">{previewError}</p>}
  {!loading&&ready==='unavailable'&&<div className="hhba-original-resume-word">
   <p>当前只能查看文字。要查看原来的样式，请下载原件打开。</p>
   <pre>{text}</pre>
  </div>}
  {!loading&&ready==='available'&&!previewError&&<>
   <div className={'hhba-original-resume-siri-stage hhba-siri-edge'+
    (selected?' hhba-siri-edge-active':'')}>
    <div className="hhba-original-resume-paper" ref={paper}>
     <div className="hhba-original-resume-page-frame" style={{
      width:paperSize.width||undefined,height:paperSize.height||undefined
     }}>
      <canvas className="hhba-original-resume-canvas" ref={surface}
       role="img" aria-label={'Word 原始页面第 '+page+' 页'}/>
      {!saved&&anchors.map(anchor=>{
       const [x,y,w,h]=anchor.bbox;
       return <button key={anchor.id} type="button"
        className="hhba-original-resume-anchor" title="修改这段"
        aria-label="修改这段 Word"
        style={{left:x/10+'%',top:y/10+'%',width:w/10+'%',height:h/10+'%'}}
        onClick={()=>{
         // Never apply a model suggestion unless it was explicitly accepted
         // and exactly matches this unique, renderer-located Word text node.
         const matches=suggestedChanges.filter(change=>change.original===anchor.text&&
          change.proposed.trim()&&change.proposed.length<=300);
         const candidate=matches.length===1?matches[0].proposed:anchor.text;
         setSelected(anchor);setDraft(candidate);
         setConfirmed(false);
         setMessage(matches.length===1?'已填入本人确认过的建议；请复核事实与原版式后再保存。':'');
        }}>
        <span><PencilLine size={12}/> 修改</span>
       </button>;
      })}
      {selected&&(()=>{
       const popWidth=Math.min(296,Math.max(205,paperSize.width-24));
       const x=paperSize.width*selected.bbox[0]/1000;
       const left=Math.max(9,Math.min(x,paperSize.width-popWidth-9));
       return <div className="hhba-original-resume-edit-glow hhba-siri-edge hhba-siri-edge-active"
        style={{left:left+'px',width:popWidth+'px',
         top:Math.min(69,(selected.bbox[1]+selected.bbox[3])/10+1)+'%'}}>
        <div className="hhba-original-resume-editbox" role="region"
         aria-label="修改 Word 原文">
         <div className="hhba-original-resume-editbox-title">
          <strong>修改这段</strong>
          <button type="button" aria-label="取消修改" onClick={()=>setSelected(null)}>
           <X size={14}/></button>
         </div>
         <textarea aria-label="修改 Word 文字" value={draft} rows={3}
          className={draft!==selected.text?'hhba-siri-typing':''}
          maxLength={300} onChange={e=>{setDraft(e.target.value);setConfirmed(false);}}/>
         <label><input type="checkbox" checked={confirmed}
          onChange={e=>setConfirmed(e.target.checked)}/>我确认内容属实，并同意处理此文件</label>
         <div className="hhba-original-resume-editbox-actions">
          <button type="button" disabled={!confirmed||!draft.trim()||busy}
           onClick={()=>void save()}><Save size={13}/> {busy?'正在检查…':'保存'}</button>
         </div>
        </div>
       </div>;
      })()}
     </div>
    </div>
   </div>
   {saved&&<div className="hhba-original-resume-review-export">
    <button type="button" disabled={busy} onClick={()=>void downloadSaved()}>
     <Download size={14}/> 下载 Word</button>
    <button type="button" disabled={busy} onClick={()=>void downloadSavedPdf()}>
     <Download size={14}/> 下载 PDF</button>
    <span>PDF 由这份已验证的 Word 转换生成；原件保留。继续修改可下载 Word 后重新上传。</span>
   </div>}
   {!saved&&anchors.length===0&&<p className="hhba-original-resume-note">
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
  {message&&<p className="hhba-original-resume-note" role="status">{message}</p>}
 </section>;
}
