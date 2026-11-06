import {useEffect,useState} from 'react';
import {ArrowRight,FileCheck2,FileText,LockKeyhole,RefreshCcw,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,type PrivateResume} from '../services/privateResumes';
import {PROFILE_FIELD_LABELS,cleanProfile,extractDocxText,inferProfileFromText} from '../services/docxProfile.mjs';
import {extractPdfText,PDFResumeError} from '../services/pdfProfile.mjs';
import {prepareApplyProfileSync,revokeApplyProfileSync} from '../services/applyCredits';
import '../styles/apply-resume-sync.css';

const large=new Set(['skills','experience','projects','summary']);
const limit:Record<string,number>={fullName:80,phone:40,email:160,school:180,major:150,education:50,degree:50,
 enrollment:20,graduation:20,city:100,skills:2000,experience:12000,projects:12000,summary:4000};
export function ApplyResumeSync({enabled}:{enabled:boolean}){
 const [files,setFiles]=useState<PrivateResume[]>([]);
 const [selected,setSelected]=useState('');
 const [profile,setProfile]=useState<Record<string,string>>(()=>cleanProfile({}));
 const [preview,setPreview]=useState('');
 const [reviewed,setReviewed]=useState(false),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [validUntil,setValidUntil]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const selectedFile=files.find(x=>x.id===selected);
 useEffect(()=>{
  let alive=true;
  if(!privateResumeAvailable){setLoading(false);return}
  listPrivateResumes().then(items=>{
   if(!alive)return;
   setFiles(items);setSelected(items[0]?.id||'');
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'无法读取已保存简历')})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[]);
 function clearPrepared(){
  setReviewed(false);setConsent(false);setValidUntil('');setMessage('');setError('');
 }
 async function parse(){
  if(!selectedFile||busy)return;
  clearPrepared();setBusy(true);
  try{
   if(selectedFile.type==='application/pdf'||/\.pdf$/i.test(selectedFile.name)){
    // Read the user's own R2 file into this browser. PDF.js and the worker
    // are bundled first-party assets; no third-party model receives content.
    const bytes=await fetchPrivateResumeForLocalReview(selectedFile);
    try{
     const result=await extractPdfText(bytes);
     setProfile(inferProfileFromText(result.text));
     setPreview(result.text.slice(0,1200));
     setMessage(`已在当前浏览器本地提取 ${result.pages} 页 PDF 文字，未调用 AI。请核对并补充字段，然后再授权同步。`);
    }catch(e){
     if(e instanceof PDFResumeError&&e.code==='PDF_NO_TEXT'){
      setProfile(cleanProfile({}));
      setPreview('这份 PDF 可能是扫描图片，未检测到可靠的可复制文字。你可以在下方手动核对并填写资料；不会尝试猜测或调用 OCR。');
      setMessage('扫描版 PDF 未自动识别任何个人资料，已保留手动核对入口。');
     }else throw e;
    }
   }else if(selectedFile.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||
     /\.docx$/i.test(selectedFile.name)){
    const bytes=await fetchPrivateResumeForLocalReview(selectedFile);
    const text=await extractDocxText(bytes);
    const candidate=inferProfileFromText(text);
    setProfile(candidate);
    setPreview(text.slice(0,1200));
    setMessage('DOCX 已在本浏览器本地提取。请逐项检查并补充信息，然后再授权同步。');
   }else throw Error('仅支持已上传的 PDF 或 DOCX 简历。');
  }catch(e){setProfile(cleanProfile({}));setPreview('');setError(e instanceof Error?e.message:'无法解析该简历，请换一份文件。')}
  finally{setBusy(false)}
 }
 function edit(field:string,value:string){
  setProfile(v=>({...v,[field]:value.slice(0,limit[field]||2000)}));
  setReviewed(false);setConsent(false);setValidUntil('');
 }
 async function send(){
  if(!enabled||!selectedFile||!reviewed||!consent||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const result=await prepareApplyProfileSync(selectedFile.id,profile,true);
   setValidUntil(result.expiresAt);
   setConsent(false);
   setMessage('已为本账号已连接的插件生成一次性资料同步任务。请在插件「连接账户」中点击领取。');
  }catch(e){setValidUntil('');setError(e instanceof Error?e.message:'同步任务创建失败。')}
  finally{setBusy(false)}
 }
 async function revoke(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   await revokeApplyProfileSync();
   setValidUntil('');setReviewed(false);setConsent(false);
   setMessage('待领取的资料已撤销，插件无法再领取。');
  }catch(e){setError(e instanceof Error?e.message:'撤销失败，请重试。')}
  finally{setBusy(false)}
 }
 return <section className="hhba-apply-sync" id="hhba-apply-profile-sync" aria-label="从我的简历同步求职档案">
  <div className="hhba-apply-headline"><div><h3>从已上传的简历同步到插件</h3>
   <p>无需下载 JSON：从你的 HHBA 私有简历库选文件，在本机提取并核对资料，主动授权一次性同步给已连接的插件。</p>
  </div><FileCheck2 size={20}/></div>
  {!enabled&&<p className="hhba-apply-sync-note">账号资料安全同步服务尚未完成部署配置。本页可以本地预览，但暂不能生成插件领取任务，不会传输个人信息。</p>}
  {!privateResumeAvailable?<p className="hhba-apply-sync-note">当前预览环境未连接真实简历接口，不能执行同步。</p>:
   loading?<p className="hhba-apply-sync-note">正在检查你的私有简历…</p>:files.length===0?<p className="hhba-apply-sync-note">尚未保存 PDF/DOCX 简历。请先到 <Link to="/candidate/account/resume">我的简历</Link> 上传，授权私有存储后再返回本页。</p>:<>
   <div className="hhba-apply-sync-select">
    <label htmlFor="hhba-apply-resume-select">选择已有简历</label>
    <select id="hhba-apply-resume-select" value={selected} disabled={busy} onChange={e=>{
     setSelected(e.target.value);setProfile(cleanProfile({}));setPreview('');clearPrepared();
    }}>{files.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <button type="button" disabled={!selectedFile||busy} onClick={()=>void parse()}><RefreshCcw size={14}/>{busy?'处理中…':'读取并整理资料'}</button>
   </div>
   {preview&&<details className="hhba-apply-sync-evidence"><summary><FileText size={14}/> 查看本次提取情况</summary><pre>{preview}</pre></details>}
   {preview&&<div className="hhba-apply-sync-editor">
    <p><ShieldCheck size={15}/> 仅建议填写确有文字证据的字段，不推测学历、工作单位或个人经历。请人工核对并补全后再同步。</p>
    <div className="hhba-apply-sync-fields">{PROFILE_FIELD_LABELS.map(([key,label])=><label key={key}>
     <span>{label}</span>
     {large.has(key)?<textarea rows={3} maxLength={limit[key]} value={profile[key]||''} onChange={e=>edit(key,e.target.value)}/>:
      <input type="text" maxLength={limit[key]} value={profile[key]||''} onChange={e=>edit(key,e.target.value)}/>}
    </label>)}</div>
    <div className="hhba-apply-sync-consents">
     <label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>{setReviewed(e.target.checked);setValidUntil('')}}/>
      <span>我已逐项核对资料，确认不包含虚构的教育、工作或其他申请信息。</span></label>
     <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
      <span>我明确同意本次将<strong>上方已核对的结构化求职资料</strong>加密暂存最多 5 分钟，交给我本人已连接的 HHBA 插件一次性读取并保存到本机。不发送原始 PDF/DOCX，不发送给第三方 AI，也不自动投递。</span></label>
    </div>
    <div className="hhba-apply-sync-actions">
     <button type="button" disabled={!enabled||!reviewed||!consent||busy||!Object.values(profile).some(Boolean)} onClick={()=>void send()}>
      <LockKeyhole size={15}/> {busy?'正在创建…':'确认并发送给已连接插件'}</button>
     {validUntil&&<button type="button" className="secondary" disabled={busy} onClick={()=>void revoke()}>撤销待领取资料</button>}
    </div>
   </div>}
   {validUntil&&<p className="hhba-apply-sync-success" role="status">待插件领取 · 有效期截至 {new Date(validUntil).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}，仅可领取一次。</p>}
   {message&&<p className="hhba-apply-sync-note" role="status">{message}</p>}
   {error&&<p className="hhba-apply-sync-error" role="alert">{error}</p>}
   <p className="hhba-apply-sync-footnote">安全边界：需先完成 HHBA 插件账户连接；PDF 与 DOCX 的可复制文字在浏览器本地提取，不经第三方 AI；扫描版 PDF 暂不支持 OCR，可手动核对字段，无需转换 JSON。网页关闭后不保留尚未确认的本地草稿。</p>
   </>}
 </section>;
}
