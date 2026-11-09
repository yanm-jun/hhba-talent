import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,FileText,FileUp,LockKeyhole,LoaderCircle,ShieldCheck,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {CandidateMatchNativeDialog} from '../components/CandidateMatchNativeDialog';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,type PrivateResume} from '../services/privateResumes';
import {getRealAuthToken} from '../services/realAuth';
import {matchServiceReady,submitResumeForMatching,submitExtractedResumeText,extractResumeTextLocally,type MatchResponse,type MatchOptions,MatchError} from '../services/resumeMatch';
import '../styles/resume-match.css';

const supportedTypes='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxResumeSize=3*1024*1024;

export function CandidateMatchPage({user}:{user:User|null}){
 const [file,setFile]=useState<File|null>(null);
 const [savedFiles,setSavedFiles]=useState<PrivateResume[]>([]);
 const [savedId,setSavedId]=useState('');
 const deepLinkPending=useRef<string|null>(new URLSearchParams(window.location.search).get('resume'));
 const [previewText,setPreviewText]=useState('');
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const previewController=useRef<AbortController|null>(null);
 const [vaultError,setVaultError]=useState('');
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({country:'CN',remote_only:false,role_hint:'',limit:10});
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');

 const [result,setResult]=useState<MatchResponse|null>(null);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  void matchServiceReady(abort.signal).then(ok=>{if(!abort.signal.aborted)setAvailability(ok?'ready':'disabled')});
  return()=>{abort.abort();controller.current?.abort();previewController.current?.abort()};
 },[]);
 useEffect(()=>{
  let active=true;
  const reload=()=>{
   if(!privateResumeAvailable||!user||!getRealAuthToken()){
    previewController.current?.abort();
    if(active){setPreviewText('');setPreviewLoaded(false);setConsent(false);}
    if(active){setSavedFiles([]);setSavedId('');}return;
   }
   void listPrivateResumes().then(rows=>{if(active){
    setSavedFiles(rows);setVaultError('');
    const requested=deepLinkPending.current;
    if(requested){
     deepLinkPending.current=null;
     if(/^[0-9a-f-]{36}$/.test(requested)&&rows.some(item=>item.id===requested))setSavedId(requested);
     else setVaultError('指定的简历不在当前账号，请从列表中选择。');
    }
   }})
    .catch(e=>{if(active){setSavedFiles([]);setVaultError(e instanceof Error?e.message:'私有简历暂时无法读取。');}});
  };
  reload();
  window.addEventListener('hhba:private-resumes-changed',reload);
  window.addEventListener('hhba:real-auth-changed',reload);
  return()=>{active=false;window.removeEventListener('hhba:private-resumes-changed',reload);
   window.removeEventListener('hhba:real-auth-changed',reload);};
 },[user?.id]);
 function choose(candidate:File|null){
  previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setConsent(false);
  setError('');setResult(null);
  if(!candidate){setFile(null);return}
  if(!/\.(pdf|docx)$/i.test(candidate.name)||!candidate.size||candidate.size>maxResumeSize){
    setFile(null);setError('请选择不超过 3 MB 的 PDF 或 DOCX 文件。');return;
  }
  setSavedId('');setFile(candidate);
 }
 async function preview(){
  if((!file&&!savedId)||working||previewBusy)return;
  setPreviewBusy(true);setError('');setPreviewText('');setPreviewLoaded(false);
  const abort=new AbortController();previewController.current=abort;
  try{
   let selected=file;
   if(!selected&&savedId){
    const entry=savedFiles.find(x=>x.id===savedId);
    if(!entry)throw new MatchError(404,'已保存的简历不存在，请重新选择。');
    const bytes=await fetchPrivateResumeForLocalReview(entry);
    if(abort.signal.aborted)return;
    selected=new File([bytes],entry.name,{type:entry.type});
   }
   if(!selected)throw new MatchError(400,'请先选择简历。');
   const text=await extractResumeTextLocally(selected,abort.signal);
   if(!abort.signal.aborted){setPreviewText(text);setPreviewLoaded(true);}
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof Error?e.message:'无法读取简历文字。');
  }finally{setPreviewBusy(false);previewController.current=null;}
 }
 async function run(){
  if((!file&&!savedId)||!consent||working||previewBusy||availability!=='ready'||!getRealAuthToken())return;
  setWorking(true);setError('');setResult(null);
  const abort=new AbortController();
  controller.current=abort;
  try{
   let matched:MatchResponse;
   if(previewLoaded){
    // Once the user has reviewed/edited text, NEVER fall back to re-reading the unedited file.
    matched=await submitExtractedResumeText(previewText,options,consent,abort.signal,savedId||undefined);
   }else{
    let selected=file;
    if(!selected&&savedId){
     const entry=savedFiles.find(item=>item.id===savedId);
     if(!entry)throw new MatchError(404,'已保存的简历已改变，请重新选择。');
     const bytes=await fetchPrivateResumeForLocalReview(entry);
     if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
     selected=new File([bytes],entry.name,{type:entry.type});
    }
    if(!selected)throw new MatchError(400,'请选择简历。');
    matched=await submitResumeForMatching(selected,options,consent,abort.signal,savedId||undefined);
   }
   setResult(matched);
   // Keep selected file for return-to-edit. No automatic re-analysis.
   setConsent(false);
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof MatchError?e.message:'智能匹配暂时失败，请稍后再试。');
  }finally{setWorking(false);controller.current=null}
 }
 return <Shell user={user}>
  <section className="hhba-ai-page">
    <nav className="hhba-ai-breadcrumb"><Link to="/candidate"><ArrowLeft size={15}/> 我要应聘</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> 汇方职场 · HHBA · AI JOB MATCH</div>
      <h1>上传简历，匹配中国大陆岗位。</h1>
      <p>DeepSeek V4 Pro 自主联网寻找中国大陆的工作岗位，直接提供推荐理由和投递链接。</p>
      <div className="hhba-ai-headline-tags"><span>中国大陆工作岗位</span><span>V4 Pro 自主联网</span><span>无需自备 Key</span></div>
    </div>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>平台 DeepSeek 服务尚未启用。</strong>
       <p>这不是要求你自己输入 API Key。管理员需在 HHBA 的 Cloudflare 服务端完成专用 API 密钥和额度配置后，你就能使用平台提供的分析能力（受平台用量限制）。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className="hhba-ai-layout">
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 1. 上传简历</h2><p>PDF 或 DOCX，最大 3 MB。只有点击开始并同意授权后才分析，不会自动向企业投递。</p></header>
        {user&&privateResumeAvailable&&<div className="hhba-ai-saved-picker">
          <label htmlFor="hhba-ai-existing">使用「我的简历」中已经保存的文件（无需重新上传）</label>
          <select id="hhba-ai-existing" value={savedId} disabled={working}
           onChange={e=>{previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setConsent(false);setSavedId(e.target.value);setFile(null);setResult(null);setError('');}}>
           <option value="">不使用已保存文件，改为下面选择新文件</option>
           {savedFiles.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          {!savedFiles.length&&<p>还没有保存的简历。可从 <Link to="/candidate/account/resume">我的简历</Link> 上传。</p>}
          {vaultError&&<p role="status">{vaultError}</p>}
        </div>}
        {!getRealAuthToken()&&<p className="hhba-ai-service-check">AI 简历匹配需要先 <Link to="/candidate/login">登录 HHBA 求职账号</Link>。</p>}
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>choose(e.target.files?.[0]||null)}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{savedId?'已选择私有简历：'+(savedFiles.find(x=>x.id===savedId)?.name||'') :file?file.name:'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB · 可以分析':'仅支持可提取文字的 PDF / DOCX；扫描图片暂不支持'}</span>
        </label>
        <div className="hhba-ai-review-tools">
         <button type="button" disabled={(!file&&!savedId)||working||previewBusy}
          onClick={()=>void preview()}>{previewBusy?'正在本地提取文字…':'可选：预览并编辑 AI 将接收的简历文字'}</button>
         {previewLoaded&&<div className="hhba-ai-text-review">
          <label htmlFor="hhba-ai-text-preview">本地文字预览（最多 20,000 字，可删去不想分享的内容）</label>
          <textarea id="hhba-ai-text-preview" rows={6} maxLength={20000} value={previewText}
           disabled={working} onChange={e=>{setPreviewText(e.target.value);setConsent(false);}}/>
          <small>已尝试隐藏电话、邮箱、身份证号等常见标识。仍可能包含姓名、详细经历等个人信息，请检查。只有上方保留的文字会被发送；清空后将禁止提交，绝不会自动恢复原文件内容。</small>
         </div>}
        </div>
        <header className="hhba-ai-section-title"><h2>2. 选择工作方向</h2>
          <p>可选填目标方向；不填时让 DeepSeek 根据简历自主判断。</p></header>
        <div className="hhba-ai-mainland-only"><span>工作区域</span><strong>中国大陆</strong><small>不推荐港澳台或境外岗位</small></div>
        <div className="hhba-ai-fields hhba-ai-fields-one">
         <label>目标岗位方向<input value={options.role_hint} maxLength={80} placeholder="例如：软件开发、数据分析、销售、视觉设计"
          onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/></label>
        </div>
        <header className="hhba-ai-section-title"><h2>3. 确认 AI 分析与隐私</h2></header>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我同意 HHBA 提取简历文本，尽可能隐藏联系方式后，发送给 DeepSeek V4 Pro，由其自主联网搜索中国大陆招聘岗位并生成推荐。脱敏可能不完整，可先预览编辑；不会公开简历或自动投递。</span>
        </label>
        <p className="hhba-ai-notice"><ShieldCheck size={15}/> 本功能仅供已登录的求职者使用。简历原件在当前浏览器读取，最多取前 2 万字文字分析；分析需单独同意，结果仅在本次页面中展示，不会自动公开或向企业投递。</p>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={(!file&&!savedId)||!consent||working||previewBusy||(previewLoaded&&previewText.replace(/\s/g,'').length<30)||availability!=='ready'||!getRealAuthToken()}>
          {working?<><LoaderCircle className="spin" size={18}/> 正在提取简历并匹配岗位…</>:
           <><BriefcaseBusiness size={17}/> 开始智能匹配 <ArrowRight size={17}/></>}
        </button>
        {working&&<p className="hhba-ai-processing" role="status">DeepSeek V4 Pro 正在自主联网搜索职位并撰写推荐理由，完成后直接显示结果。</p>}
      </section>
      <aside className="hhba-ai-aside">
        <div className="hhba-ai-aside-card"><h3>只需三步</h3>
           <ol><li>上传简历</li><li>DeepSeek V4 Pro 自主联网搜索并判断</li>
             <li>直接查看 Top 10 推荐理由与岗位链接</li></ol>
         </div>
         <p className="hhba-ai-aside-footnote">工作地点仅限中国大陆；招聘状态请以岗位原始网页为准。</p>
      </aside>
    </div>
    {result&&<CandidateMatchNativeDialog result={result} onClose={()=>setResult(null)}/>}
     <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
