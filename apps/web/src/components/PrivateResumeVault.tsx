import {useEffect,useRef,useState,type ChangeEvent,type DragEvent} from 'react';
import {CheckCircle2,ChevronDown,CloudUpload,Download,FileCheck2,FileText,LockKeyhole,ShieldCheck,Trash2,X} from 'lucide-react';
import {
 privateResumeAvailable,listPrivateResumes,uploadPrivateResume,
 deletePrivateResume,downloadPrivateResume,PRIVATE_RESUME_LIMIT,
 type PrivateResume,
} from '../services/privateResumes';
import '../styles/private-resumes.css';

export function PrivateResumeVault(){
 const [items,setItems]=useState<PrivateResume[]>([]);
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
 useEffect(()=>{let active=true;void load(active);return()=>{active=false};},[]);
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
   setNotice('简历已保存到你的私有账户。不会自动发给 DeepSeek 或招聘企业。');
   await load();
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
  }catch(e){setError(e instanceof Error?e.message:'上传失败，请稍后重试。');}
  finally{setBusy(false);setOperation('');}
 }
 async function remove(item:PrivateResume){
  if(busy||!window.confirm('确定永久删除这份已上传的简历吗？删除后无法在工作台恢复。'))return;
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
   <h2>我的简历</h2><p>仅供当前登录账户保存、下载和删除。文件不公开展示。</p>
  </div></div>
  <div className="hhba-resume-private-note">
   <LockKeyhole size={17}/><span>私有存储 · 仅本人可见。上传不等于同意 AI 分析或向企业投递。</span>
  </div>
  {loading?<p role="status">正在检查私有简历服务…</p>:!ready?<>
   <div className="hhba-account-upload"><CloudUpload size={29}/>
    <h3>私有简历服务尚未启用</h3>
    <p>Cloudflare R2 对象存储尚未开通或绑定；为保护你的资料，当前禁止上传。原有手机号账号不受影响。</p>
   </div>
   {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
   </>:<>
    <div className="hhba-private-resume-summary">
     <span>我的文件</span>
     <span className="hhba-private-resume-count"><strong>{items.length}</strong><span> / 3 份</span></span>
    </div>
    {items.length===0?<div className="hhba-private-resume-empty"><FileText size={18}/><span>暂未保存简历，上传后即可在这里管理。</span></div>:
     <div className="hhba-private-resume-list">{items.map(item=><article key={item.id}>
      <FileText size={21}/><div className="hhba-private-resume-info">
       <strong>{item.name}</strong>
       <small>{(item.size/1024/1024).toFixed(2)} MB · {item.createdAt.slice(0,10)} 保存</small>
      </div>
      <div className="hhba-private-resume-actions">
       <button type="button" disabled={busy} onClick={()=>void download(item)} aria-label={'下载 '+item.name}>
        <Download size={15}/>{operation===item.id&&busy?'处理中':'下载'}
       </button>
       <button type="button" disabled={busy} onClick={()=>void remove(item)} aria-label={'删除 '+item.name}>
        <Trash2 size={15}/>删除
       </button>
      </div>
     </article>)}</div>}
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
     <div className="hhba-private-resume-consent-panel">
      <label className="hhba-private-resume-consent">
       <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
       <span>我已知悉并单独同意：本次简历将使用 <strong>Cloudflare R2 亚太区（APAC）</strong>的私有对象存储保存，存储位置可能在<strong>中国大陆境外</strong>，仅供本人登录后管理。</span>
      </label>
      <details className="hhba-private-resume-details">
       <summary><ShieldCheck size={16}/><span>查看完整隐私与存储说明</span><ChevronDown size={15} className="hhba-private-resume-chevron"/></summary>
       <p>上传不等于授权 DeepSeek 分析或向招聘企业分享。涉及身份证号、住址等非必要敏感信息，请在上传前自行移除。你可在工作台删除已上传的文件；账号注销与历史备份清理规则仍待完善。</p>
      </details>
     </div>
     <div className="hhba-private-resume-upload-actions">
      <button type="button" className="hhba-private-resume-submit" disabled={!file||!consent||busy}
       onClick={()=>void upload()}><ShieldCheck size={17}/>{operation==='upload'?'正在安全保存…':'确认授权并保存简历'}</button>
      <small><CheckCircle2 size={14}/>每个账户最多 3 份 · 24 小时内最多上传 15 次</small>
     </div>
    </div>}
   </>}
  {error&&ready&&<p className="hhba-personal-error" role="alert">{error}</p>}
  {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
 </section>;
}
