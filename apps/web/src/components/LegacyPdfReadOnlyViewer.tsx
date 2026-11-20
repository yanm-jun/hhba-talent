import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,X} from 'lucide-react';
import type {PrivateResume} from '../services/privateResumes';
import {downloadPrivateResume,fetchPrivateResumeForLocalReview} from '../services/privateResumes';
import '../styles/original-resume-viewer.css';

// Historical PDFs stay available to their owners, but PDF text editing is retired.
// This canvas displays the original file; no page edit APIs, font rewrites,
// preview substitutions or derived PDF exports are invoked.
export function LegacyPdfReadOnlyViewer({resume,onClose}:{
 resume:PrivateResume;onClose:()=>void;
}){
 const paper=useRef<HTMLDivElement>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 const documentRef=useRef<any>(null);
 const [page,setPage]=useState(1);
 const [pages,setPages]=useState(0);
 const [width,setWidth]=useState(700);
 const [size,setSize]=useState({width:0,height:0});
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');

 useEffect(()=>{
  let active=true,task:any=null;
  setStatus('loading');setPage(1);setPages(0);setError('');
  void(async()=>{
   try{
    if(resume.type!=='application/pdf')throw Error('不是 PDF 文件。');
    const bytes=await fetchPrivateResumeForLocalReview(resume);
    if(!active)return;
    const [pdfjs,worker]=await Promise.all([
     import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    if(!active)return;
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,
     enableXfa:false,disableAutoFetch:true,disableStream:true,
     useSystemFonts:false} as any);
    const doc=await task.promise;
    if(!active)return;
    if(doc.numPages<1||doc.numPages>20)throw Error('这份 PDF 页数超出安全预览范围，请下载原件查看。');
    documentRef.current=doc;setPages(doc.numPages);setStatus('ready');
   }catch(e){
    if(active){setError(e instanceof Error?e.message:'PDF 预览暂时不可用。');setStatus('error');}
   }
  })();
  return()=>{active=false;documentRef.current=null;void task?.destroy?.().catch(()=>{});};
 },[resume.id,resume.type]);

 useEffect(()=>{
  const node=paper.current;
  if(!node)return;
  const update=()=>setWidth(Math.max(255,Math.min(800,node.clientWidth-20)));
  update();
  const observer=new ResizeObserver(update);
  observer.observe(node);
  return()=>observer.disconnect();
 },[status]);

 useEffect(()=>{
  if(status!=='ready'||!canvas.current||!documentRef.current)return;
  let active=true,renderTask:any=null;
  void(async()=>{
   try{
    const pageRef=await documentRef.current.getPage(page);
    if(!active||!canvas.current)return;
    const base=pageRef.getViewport({scale:1});
    const viewport=pageRef.getViewport({scale:Math.min(1.7,Math.max(.4,width/base.width))});
    const ratio=Math.min(1.5,window.devicePixelRatio||1);
    const surface=canvas.current;
    surface.width=Math.round(viewport.width*ratio);
    surface.height=Math.round(viewport.height*ratio);
    surface.style.width=viewport.width+'px';
    surface.style.height=viewport.height+'px';
    setSize({width:viewport.width,height:viewport.height});
    const context=surface.getContext('2d');
    if(!context)throw Error('当前无法预览这页。');
    renderTask=pageRef.render({canvas:surface,canvasContext:context,viewport,
     transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    await renderTask.promise;
   }catch(e){
    if(active&&(e as Error)?.name!=='RenderingCancelledException')
     setError('这一页暂时无法显示，请下载原件查看。');
   }
  })();
  return()=>{active=false;try{renderTask?.cancel();}catch{}};
 },[status,page,width]);

 async function download(){
  setMessage('');
  try{await downloadPrivateResume(resume);}
  catch(e){setMessage(e instanceof Error?e.message:'下载失败，请重试。');}
 }
 return <section className="hhba-original-resume" aria-label="查看历史 PDF 简历">
  <div className="hhba-original-resume-toolbar">
   <div><strong>{resume.name}</strong><p>历史 PDF 仅供查看和下载，编辑请上传 Word（.docx）。</p></div>
   <div>
    <button type="button" onClick={()=>void download()}><Download size={15}/> 下载原件</button>
    <button type="button" onClick={onClose} aria-label="关闭原件预览"><X size={16}/></button>
   </div>
  </div>
  {status==='loading'&&<p className="hhba-original-resume-note" role="status">正在打开 PDF…</p>}
  {error&&<p className="hhba-original-resume-note" role="alert">{error}</p>}
  {status==='ready'&&<>
   <div className="hhba-original-resume-paper" ref={paper}>
    <div className="hhba-original-resume-page-frame"
     style={{width:size.width||undefined,height:size.height||undefined}}>
     <canvas ref={canvas} className="hhba-original-resume-canvas"
      role="img" aria-label={'历史 PDF 第 '+page+' 页'}/>
    </div>
   </div>
   <nav className="hhba-original-resume-pages" aria-label="PDF 简历翻页">
    <button type="button" disabled={page<=1}
     onClick={()=>setPage(n=>n-1)}><ChevronLeft size={15}/> 上一页</button>
    <span>第 {page} / {pages} 页</span>
    <button type="button" disabled={page>=pages}
     onClick={()=>setPage(n=>n+1)}>下一页 <ChevronRight size={15}/></button>
   </nav>
  </>}
  {message&&<p className="hhba-original-resume-note" role="status">{message}</p>}
 </section>;
}
