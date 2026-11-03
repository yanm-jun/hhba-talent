import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {FileUp,FileText,Trash2,Download,LockKeyhole,ShieldCheck} from 'lucide-react';
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
 function choose(event:ChangeEvent<HTMLInputElement>){
  const f=event.target.files?.[0]||null;
  setError('');setNotice('');setConsent(false);
  if(!f){setFile(null);return;}
  if(!/\.(pdf|docx)$/i.test(f.name)||f.size<30||f.size>PRIVATE_RESUME_LIMIT){
   setFile(null);if(input.current)input.current.value='';
   setError('仅支持 3 MB 以内的 PDF / DOCX 文件。');
   return;
  }
  setFile(f);
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
   <LockKeyhole size={18}/><span>使用服务器端账户校验与私有对象存储。上传不等于同意 AI 分析或向企业投递。</span>
  </div>
  {loading?<p role="status">正在检查私有简历服务…</p>:!ready?<>
   <div className="hhba-account-upload"><FileUp size={29}/>
    <h3>私有简历服务尚未启用</h3>
    <p>Cloudflare R2 对象存储尚未开通或绑定；为保护你的资料，当前禁止上传。原有手机号账号不受影响。</p>
   </div>
   {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
   </>:<>
    <div className="hhba-private-resume-summary"><strong>{items.length} / 3</strong><span>当前账户已保存的私有简历</span></div>
    {items.length===0?<p className="hhba-private-resume-empty">还没有上传简历。你可以上传 PDF 或 DOCX，保存到当前真实账户。</p>:
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
     <label htmlFor="hhba-private-resume-file">选择简历文件（PDF 或 DOCX，单份不超过 3 MB）</label>
     <input ref={input} type="file" id="hhba-private-resume-file"
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      onChange={choose} disabled={busy}/>
     {file&&<p>已选择：{file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
     <label className="hhba-private-resume-consent">
      <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
      <span>我已知悉：简历将由 HHBA 使用 Cloudflare R2 亚太区（APAC）的私有对象存储保存，存储位置可能在中国大陆境外。我单独同意保存本次文件以便本人登录后管理；上传不等于授权 DeepSeek 分析或向招聘企业分享。涉及身份证号、住址等非必要敏感信息，请在上传前自行移除。</span>
     </label>
     <button type="button" className="hhba-private-resume-submit" disabled={!file||!consent||busy}
      onClick={()=>void upload()}><ShieldCheck size={17}/>{operation==='upload'?'正在安全保存…':'确认授权并保存简历'}</button>
     <small>每个账户最多 3 份简历；近 24 小时最多 15 次上传。删除后无法从工作台恢复，账号注销与备份清理规则仍待完善。</small>
    </div>}
   </>}
  {error&&ready&&<p className="hhba-personal-error" role="alert">{error}</p>}
  {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
 </section>;
}
