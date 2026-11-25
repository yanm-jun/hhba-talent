import {useEffect,useRef,useState,type ChangeEvent,type DragEvent} from 'react';
import {CloudUpload,Download,FileCheck2,FileText,ShieldCheck,Trash2,X,ChevronDown,PencilLine} from 'lucide-react';
import {
 privateResumeAvailable,listPrivateResumes,uploadPrivateResume,
 deletePrivateResume,downloadPrivateResume,PRIVATE_RESUME_LIMIT,
 type PrivateResume,
} from '../services/privateResumes';
import {Link} from '../router';
import {createPortal} from 'react-dom';
import {OriginalWordViewer} from './OriginalWordViewer';
import {listSavedWordVersions,downloadOriginalWordEdited,downloadOriginalWordPdf,type SavedWordVersion} from '../services/originalWordApi';
import '../styles/word-editor-minimal.css';
import '../styles/private-resumes.css';

export function PrivateResumeVault({active=true}:{active?:boolean}){
 const [items,setItems]=useState<PrivateResume[]>([]);
 const [versions,setVersions]=useState<Record<string,SavedWordVersion[]>>({});
 const [versionErrors,setVersionErrors]=useState<Record<string,string>>({});
 const [editor,setEditor]=useState<{resume:PrivateResume;version:SavedWordVersion}|null>(null);
 const [dirty,setDirty]=useState(false);
 const [versionsLoading,setVersionsLoading]=useState(false);
 const editorDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(editor&&!editorDialog.current?.open)editorDialog.current?.showModal();},[editor]);
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[operation,setOperation]=useState('');
 const [file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const input=useRef<HTMLInputElement>(null);
 async function load(active=true){
  if(!privateResumeAvailable){setReady(false);setLoading(false);return;}
  try{
   const resumes=await listPrivateResumes();
   if(active){setItems(resumes);setReady(true);setError('');}
  }catch(e){
   if(active){setReady(false);setError(e instanceof Error?e.message:'私有简历服务无法连接。');}
  }finally{if(active)setLoading(false);}
 }
 useEffect(()=>{if(!active)return;let mounted=true;setLoading(true);void load(mounted);return()=>{mounted=false};},[active]);
 useEffect(()=>{
  if(!active||!ready)return;
  const controller=new AbortController();let generation=0;
  const refresh=async()=>{
   const current=++generation;setVersionsLoading(true);
   const rows=await Promise.all(items.filter(item=>/\.docx$/i.test(item.name)).map(async item=>{
    try{return {id:item.id,items:await listSavedWordVersions(item.id,controller.signal),error:''};}
    catch(e){return {id:item.id,items:[] as SavedWordVersion[],error:e instanceof Error?e.message:'读取失败'};}
   }));
   if(!controller.signal.aborted&&current===generation){
    setVersions(Object.fromEntries(rows.map(row=>[row.id,row.items])));
    setVersionErrors(Object.fromEntries(rows.map(row=>[row.id,row.error])));setVersionsLoading(false);
   }
  };
  void refresh();
  window.addEventListener('hhba:word-versions-changed',refresh);
  return()=>{controller.abort();window.removeEventListener('hhba:word-versions-changed',refresh);};
 },[active,ready,items]);
 function closeEditor(){setEditor(null);setDirty(false);}
 async function downloadVersion(item:PrivateResume,version:SavedWordVersion,pdf=false){
  if(busy)return;
  setBusy(true);setOperation(version.scope);setError('');
  try{if(pdf)await downloadOriginalWordPdf(item.id,version.scope,version.jobLabel,version.revision);
   else await downloadOriginalWordEdited(item.id,version.scope,version.jobLabel,version.revision);}
  catch(e){setError(e instanceof Error?e.message:'下载失败，请重新打开简历列表。');}
  finally{setBusy(false);setOperation('');}
 }
 function selectFile(selected:File|null){
  setError('');setNotice('');setConsent(false);
  if(!selected){setFile(null);return;}
  if(!/\.(pdf|docx)$/i.test(selected.name)||selected.size<30||selected.size>PRIVATE_RESUME_LIMIT){
   setFile(null);
   if(input.current)input.current.value='';
   setError('仅支持 3 MB 以内的 PDF / DOCX 文件。');
   return;
  }
  setFile(selected);
 }
 function choose(event:ChangeEvent<HTMLInputElement>){
  selectFile(event.target.files?.[0]||null);
 }
 function handleDragOver(event:DragEvent<HTMLDivElement>){
  event.preventDefault();
  if(!busy)setDragging(true);
 }
 function handleDrop(event:DragEvent<HTMLDivElement>){
  event.preventDefault();
  setDragging(false);
  if(busy)return;
  if(input.current)input.current.value='';
  selectFile(event.dataTransfer.files?.[0]||null);
 }
 function clearSelection(){
  if(busy)return;
  setFile(null);setConsent(false);
  if(input.current)input.current.value='';
 }
 async function upload(){
  if(!file||!ready||!consent||busy)return;
  setBusy(true);setOperation('upload');setError('');setNotice('');
  try{
   await uploadPrivateResume(file,consent);
   setFile(null);setConsent(false);if(input.current)input.current.value='';
   setNotice('简历已保存，不会自动向企业投递。');
   await load();
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
  }catch(e){setError(e instanceof Error?e.message:'上传失败，请稍后重试。');}
  finally{setBusy(false);setOperation('');}
 }
 async function remove(item:PrivateResume){
  if(busy||!window.confirm('确定永久删除这份原始简历及其所有岗位专属版本吗？删除后无法恢复。'))return;
  setBusy(true);setOperation(item.id);setError('');setNotice('');
  try{
   await deletePrivateResume(item.id);
   setItems(all=>all.filter(x=>x.id!==item.id));
   setNotice('已从私有存储删除这份简历及其当前账户记录。');
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
  }catch(e){setError(e instanceof Error?e.message:'删除失败，请重试。');}
  finally{setBusy(false);setOperation('');}
 }
 async function download(item:PrivateResume){
  if(busy)return;
  setBusy(true);setOperation(item.id);setError('');
  try{await downloadPrivateResume(item);}
  catch(e){setError(e instanceof Error?e.message:'下载失败，请重试。');}
  finally{setBusy(false);setOperation('');}
 }
 return <section className="hhba-account-panel hhba-private-resumes">
  <div className="hhba-account-section-heading"><div>
   <h2>我的简历</h2>
  </div></div>
  {loading?<p role="status">正在检查私有简历服务…</p>:!ready?<>
   <div className="hhba-account-upload"><CloudUpload size={29}/>
    <h3>私有简历服务尚未启用</h3>
    <p>请稍后再试。</p>
   </div>
   {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
   </>:<>
    <div className="hhba-private-resume-summary">
     <span>原始简历 · 岗位版本不占原始文件名额</span>
     <span className="hhba-private-resume-count"><strong>{items.length}</strong><span> / 3 份</span></span>
    </div>
    {items.length===0?<div className="hhba-private-resume-empty"><FileText size={18}/><span>暂未保存简历，上传后即可在这里管理。</span></div>:
     <div className="hhba-private-resume-list">{items.map(item=><div className="hhba-private-resume-group" key={item.id}><article>
      <FileText size={21}/><div className="hhba-private-resume-info">
       <strong>{item.name}</strong>
       <small>{(item.size/1024/1024).toFixed(2)} MB · {item.createdAt.slice(0,10)} 保存</small>
      </div>
      <div className="hhba-private-resume-actions">
       <Link to={'/candidate/account/match?resume='+encodeURIComponent(item.id)}
        className="hhba-private-resume-match" aria-label={'使用 '+item.name+' 进行 AI 智能匹配'}>AI 智能匹配</Link>
       <button type="button" disabled={busy} onClick={()=>void download(item)} aria-label={'下载 '+item.name}>
        <Download size={15}/>{operation===item.id&&busy?'处理中':'下载'}
       </button>
       <button type="button" disabled={busy} onClick={()=>void remove(item)} aria-label={'删除 '+item.name}>
        <Trash2 size={15}/>删除
       </button>
      </div>
     </article>
     {/\.docx$/i.test(item.name)&&<details className="hhba-private-word-versions">
      <summary><ChevronDown size={15}/> {versionsLoading&&!versions[item.id]?'正在读取岗位版本…':versionErrors[item.id]?'岗位版本暂不可用':(versions[item.id]?.length||0)+' 份岗位专属简历'}</summary>
      {versionErrors[item.id]?<p role="status">{versionErrors[item.id]} · 请重新打开页面。</p>:!versions[item.id]?.length?<p>暂无已保存的优化版本。</p>:
       <div className="hhba-private-word-version-list">{versions[item.id].map(version=><div className="hhba-private-word-version" key={version.scope}>
        <FileText size={17}/><div className="hhba-private-resume-info"><strong>{version.jobLabel}</strong>
         <small>岗位专属 Word · 第 {version.revision} 版 · {version.updatedAt.slice(0,10)} 保存</small></div>
        <div className="hhba-private-resume-actions">
         <button type="button" disabled={busy} onClick={()=>setEditor({resume:item,version})}><PencilLine size={15}/>继续编辑</button>
         <button type="button" disabled={busy} onClick={()=>void downloadVersion(item,version)}><Download size={15}/>下载 Word</button>
         {version.pdfAvailable&&<button type="button" disabled={busy} onClick={()=>void downloadVersion(item,version,true)}>下载 PDF</button>}
         <Link className="hhba-private-resume-match" to={'/candidate/account/match?resume='+encodeURIComponent(item.id)+'&word_scope='+encodeURIComponent(version.scope)+'&word_revision='+version.revision}>使用此版本匹配</Link>
        </div>
       </div>)}</div>}
     </details>}
     </div>)}</div>}
    {items.length<3&&<div className="hhba-private-resume-upload">
     <div className="hhba-private-resume-upload-heading">
      <div><h3>添加简历</h3><p>上传后可随时下载或删除</p></div>
      <span>PDF / DOCX</span>
     </div>
     <div className={'hhba-private-resume-dropzone'+(dragging?' is-dragging':'')+(file?' has-file':'')}
      onDragOver={handleDragOver} onDragLeave={()=>setDragging(false)} onDrop={handleDrop}>
      <div className="hhba-private-resume-drop-icon">{file?<FileCheck2 size={26}/>:<CloudUpload size={28}/>}</div>
      {file?<><strong>文件已选择</strong><span className="hhba-private-resume-file-name" title={file.name}>{file.name}</span>
       <small>{(file.size/1024/1024).toFixed(2)} MB · 准备上传</small></>:
       <><strong>拖拽简历到这里，或点击下方按钮</strong>
        <small>仅支持 PDF、DOCX 格式 · 单份不超过 3 MB</small></>}
      <input ref={input} hidden type="file" id="hhba-private-resume-file"
       aria-label="选择简历文件" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
       onChange={choose} disabled={busy}/>
      <div className="hhba-private-resume-file-actions">
       <button type="button" className="hhba-private-resume-pick" disabled={busy}
        onClick={()=>input.current?.click()}>{file?'更换文件':'选择简历'}</button>
       {file&&<button type="button" className="hhba-private-resume-clear" disabled={busy}
        onClick={clearSelection} aria-label="移除已选择的文件"><X size={15}/>清除</button>}
      </div>
     </div>
     <details className="hhba-private-resume-details">
      <summary>了解简历保存及 AI 分析范围</summary>
      <p>上传不等于授权 DeepSeek 分析。只有本人主动选择 AI 匹配并另外授权后，才会进入相应分析流程。文件存储区域与跨境传输规则需以实际部署及正式隐私告知为准；不应将未核实的区域作为保证。</p>
     </details>
     <div className="hhba-private-resume-consent-panel">
      <label className="hhba-private-resume-consent">
       <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
       <span>我已知悉并单独同意 HHBA 保存本次简历。请先阅读 <Link to="/candidate/account/privacy">《账户与隐私说明》</Link>；此授权不包含向 AI 服务提供文件。</span>
      </label>
     </div>
     <div className="hhba-private-resume-upload-actions">
      <button type="button" className="hhba-private-resume-submit" disabled={!file||!consent||busy}
       onClick={()=>void upload()}><ShieldCheck size={17}/>{operation==='upload'?'正在安全保存…':'确认授权并保存简历'}</button>
     </div>
    </div>}
   </>}
  {editor&&createPortal(<dialog ref={editorDialog} className="hhba-private-word-dialog" onCancel={e=>{e.preventDefault();if(!dirty||window.confirm('放弃未保存的文字修改？'))closeEditor();}}><OriginalWordViewer key={editor.resume.id+':'+editor.version.scope} resume={editor.resume} jobId={editor.version.scope} jobTitle={editor.version.jobLabel} onPendingChange={setDirty} onClose={closeEditor}/></dialog>,document.body)}
  {error&&ready&&<p className="hhba-personal-error" role="alert">{error}</p>}
  {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
 </section>;
}
