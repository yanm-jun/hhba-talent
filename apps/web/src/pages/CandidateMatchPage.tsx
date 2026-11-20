import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,FileText,FileUp,LockKeyhole,LoaderCircle,ShieldCheck,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {CandidateMatchNativeDialog} from '../components/CandidateMatchNativeDialog';
import {CandidateResumeStage} from '../components/CandidateResumeStage';
import {extractDocxText} from '../services/docxProfile.mjs';
import {CandidateJourneySteps} from '../components/CandidateJourneySteps';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,uploadPrivateResume,type PrivateResume} from '../services/privateResumes';
import {linkMatchHistoryResume} from '../services/matchHistory';
import {getRealAuthToken} from '../services/realAuth';
import {matchServiceReady,submitExtractedResumeText,extractResumeTextLocally,type MatchResponse,type MatchedJob,type MatchOptions,MatchError} from '../services/resumeMatch';
import '../styles/resume-match.css';
import '../styles/candidate-journey.css';

const supportedTypes='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxResumeSize=3*1024*1024;

export function CandidateMatchPage({user,embedded=false}:{user:User|null;embedded?:boolean}){
 const [file,setFile]=useState<File|null>(null);
 const [savedFiles,setSavedFiles]=useState<PrivateResume[]>([]);
 const [savedId,setSavedId]=useState('');
 const deepLinkPending=useRef<string|null>(new URLSearchParams(window.location.search).get('resume'));
 const [previewText,setPreviewText]=useState('');
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [documentText,setDocumentText]=useState('');
 const [documentBusy,setDocumentBusy]=useState(false);
 const [documentError,setDocumentError]=useState('');
 const [documentRetry,setDocumentRetry]=useState(0);
 const previewController=useRef<AbortController|null>(null);
 const [vaultError,setVaultError]=useState('');
 const [saveConsent,setSaveConsent]=useState(false);
 const [saveBusy,setSaveBusy]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({country:'CN',remote_only:false,role_hint:'',limit:10});
 const [working,setWorking]=useState(false);
  const [partialJobs,setPartialJobs]=useState<MatchedJob[]>([]);
  const [stage,setStage]=useState<'preparing'|'connected'|'searching'|'reading'|'writing'|'waiting'>('preparing');
 const [error,setError]=useState('');

 const [result,setResult]=useState<MatchResponse|null>(null);
 const [optimizationSource,setOptimizationSource]=useState('');
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
    setSavedFiles(rows.filter(item=>/\.docx$/i.test(item.name)));setVaultError('');
    const requested=deepLinkPending.current;
    if(requested){
     deepLinkPending.current=null;
     if(/^[0-9a-f-]{36}$/.test(requested)&&rows.some(item=>item.id===requested&&/\.docx$/i.test(item.name)))setSavedId(requested);
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
 // Uploading a resume now gives an immediate private reading surface.
 // No AI call or remote write happens during local DOCX text extraction.
 useEffect(()=>{
  const abort=new AbortController();
  setDocumentText('');setDocumentError('');
  if(!file&&!savedId){setDocumentBusy(false);return()=>abort.abort();}
  setDocumentBusy(true);
  void (async()=>{
   try{
    let selected=file;
    if(!selected&&savedId){
     const entry=savedFiles.find(item=>item.id===savedId);
     if(!entry)throw new Error('保存的简历暂时未找到，请重试。');
     const bytes=await fetchPrivateResumeForLocalReview(entry);
     if(abort.signal.aborted)return;
     selected=new File([bytes],entry.name,{type:entry.type});
    }
    if(!selected)return;
    const raw=await extractDocxText(await selected.arrayBuffer());
    if(!abort.signal.aborted)setDocumentText(raw);
   }catch(error){
    if(!abort.signal.aborted)setDocumentError(error instanceof Error?error.message:'暂时无法本地预览此文件。');
   }finally{if(!abort.signal.aborted)setDocumentBusy(false);}
  })();
  return()=>abort.abort();
 },[file,savedId,savedFiles,documentRetry]);
 function choose(candidate:File|null){
  previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setConsent(false);setSavedId('');
  setError('');setResult(null);setOptimizationSource('');setSaveConsent(false);setSaveNotice('');
  if(!candidate){setFile(null);return}
  if(!/\.docx$/i.test(candidate.name)||!candidate.size||candidate.size>maxResumeSize){
    setFile(null);setError('请上传不超过 3 MB 的 Word（.docx）简历。');return;
  }
  setFile(candidate);
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
 async function saveResume(){
  if(!file||savedId||!saveConsent||saveBusy||!user||!getRealAuthToken())return;
  setSaveBusy(true);setSaveNotice('');
  try{
   const item=await uploadPrivateResume(file,true);
   setSavedId(item.id);setSavedFiles(all=>all.some(x=>x.id===item.id)?all:[item,...all]);
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
   setSaveConsent(false);
   if(result?.history_id){
    try{
     await linkMatchHistoryResume(result.history_id,item.id);
     setSaveNotice('简历已保存到「我的简历」，并关联到本次 AI 匹配历史。');
    }catch{
     setSaveNotice('简历已保存到「我的简历」，但与匹配历史的关联暂未完成；历史推荐内容仍可单独查看。');
    }
   }else setSaveNotice('简历已保存到「我的简历」，下次可以直接选择使用，不必重复上传。');
  }catch(e){setSaveNotice(e instanceof Error?e.message:'简历保存失败，请稍后重试。')}
  finally{setSaveBusy(false)}
 }
 async function run(){
  if((!file&&!savedId)||!consent||working||previewBusy||availability!=='ready'||!getRealAuthToken())return;
  setWorking(true);setStage('preparing');setError('');setResult(null);setPartialJobs([]);
  const abort=new AbortController();
  controller.current=abort;
  try{
   // Reuse one local extraction for matching AND later user-controlled editing.
   // No second AI parse, and no extra file upload is required for optimization.
   let submittedText='';
   if(previewLoaded){
    // Once the user has reviewed/edited text, NEVER fall back to the raw resume.
    if(previewLoaded&&previewText.replace(/\s/g,'').length<30)
     throw new MatchError(400,'已编辑的简历文字为空，请重新核对；不会自动读取原文件。');
    submittedText=previewText;
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
    submittedText=await extractResumeTextLocally(selected,abort.signal);
   }
   const matched:MatchResponse=await submitExtractedResumeText(
    submittedText,options,consent,abort.signal,savedId||undefined,setStage,setPartialJobs);
   if(abort.signal.aborted)return;
   setOptimizationSource(submittedText);
   setResult(matched);setPartialJobs([]);
   // Keep selected file for return-to-edit. No automatic re-analysis.
   setConsent(false);
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof MatchError?e.message:'智能匹配暂时失败，请稍后再试。');
  }finally{setWorking(false);controller.current=null}
 }
 return <Shell user={user} embedded={embedded}>
  <section className="hhba-ai-page">
    <nav className="hhba-ai-breadcrumb"><Link to="/candidate/account"><ArrowLeft size={15}/> 工作台</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> 汇方职场 · HHBA</div>
      <h1>上传一份简历，找到适合你的工作。</h1>
      <p>AI 负责寻找企业岗位、分析适配程度，并为你准备针对性的投递简历。</p>
    </div>
    <CandidateJourneySteps current={working?2:1}/>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>智能匹配服务暂未启用。</strong>
       <p>请稍后再试，或直接浏览公开岗位。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className={"hhba-ai-layout"+((file||savedId)?" hhba-ai-layout-reading":"")}>
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 选择你的 Word 简历</h2>
         <p>上传 .docx，或选择以前保存的简历。AI 会根据真实内容主动寻找岗位，不必先填写求职条件。</p></header>
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
        {!getRealAuthToken()&&<p className="hhba-ai-service-check">AI 简历匹配需要先 <Link to="/candidate/login?next=%2Fcandidate%2Fmatch">登录 HHBA 求职账号</Link>。</p>}
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>choose(e.target.files?.[0]||null)}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{savedId?'已选择私有简历：'+(savedFiles.find(x=>x.id===savedId)?.name||'') :file?file.name:'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB · 可以分析':'仅支持有真实文字的 Word（.docx）；PDF 作为最终导出格式'}</span>
        </label>
        {(file||savedId)&&<CandidateResumeStage text={documentText}
         fileName={file?.name||savedFiles.find(item=>item.id===savedId)?.name||'已保存的简历'}
         loading={documentBusy} error={documentError}
         onRetry={()=>setDocumentRetry(value=>value+1)}/>}
        <details className="hhba-ai-preferences">
         <summary>可选：指定岗位方向或核对简历文字</summary>
         <p>不填写岗位方向，AI 也会根据简历寻找适合的真实工作。</p>
         <div className="hhba-ai-mainland-only"><span>搜索范围</span><strong>中国大陆</strong></div>
         <div className="hhba-ai-fields hhba-ai-fields-one">
          <label>希望优先寻找的岗位<input value={options.role_hint} maxLength={80}
           placeholder="留空，让 AI 判断最适合的方向"
           onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/></label>
         </div>
         <div className="hhba-ai-review-tools">
          <button type="button" disabled={(!file&&!savedId)||working||previewBusy}
           onClick={()=>void preview()}>{previewBusy?'正在读取简历文字…':'查看 AI 将分析的简历文字'}</button>
          {previewLoaded&&<div className="hhba-ai-text-review">
           <label htmlFor="hhba-ai-text-preview">简历文字核对（最多 20,000 字）</label>
           <textarea id="hhba-ai-text-preview" rows={6} maxLength={20000}
            value={previewText} disabled={working}
            onChange={e=>{setPreviewText(e.target.value);setConsent(false);}}/>
           <small>可以删除不希望提交给 AI 的内容；修改后需重新确认授权。</small>
          </div>}
         </div>
        </details>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我已阅读并同意 <Link to="/candidate/account/privacy">《隐私说明》</Link>，授权 HHBA 使用我的简历信息进行智能岗位匹配。</span>
        </label>
        <p className="hhba-ai-notice"><ShieldCheck size={15}/>简历仅用于生成岗位建议，不会自动向企业投递或公开。</p>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={(!file&&!savedId)||!consent||working||previewBusy||(previewLoaded&&previewText.replace(/\s/g,'').length<30)||availability!=='ready'||!getRealAuthToken()}>
          {working?<><LoaderCircle className="spin" size={18}/> AI 正在寻找岗位…</>:
           <><BriefcaseBusiness size={17}/> AI 为我寻找适合的工作 <ArrowRight size={17}/></>}
        </button>
        {working&&<p className="hhba-ai-processing" role="status">{stage==='preparing'?'正在准备智能匹配…':stage==='connected'?'正在连接岗位信息…':stage==='searching'?'正在寻找中国大陆岗位…':stage==='reading'?'正在读取候选岗位信息…':stage==='waiting'?'正在生成推荐，请稍候…':'正在分析简历并生成推荐理由…'}</p>}
      </section>
      <aside className="hhba-ai-aside">
       <div className="hhba-ai-aside-card">
        <h3>剩下的交给 AI</h3>
        <p>搜索真实岗位、给出适配分、准备针对岗位的简历。</p>
        <small>你只需要核实个人经历，决定是否去企业官网投递。</small>
       </div>
      </aside>
    </div>
    {(result||partialJobs.length>0)&&<CandidateMatchNativeDialog
      result={result||{matches:partialJobs}}
      pending={working&&!result} notice={working?'':error}
      sourceText={result?optimizationSource:undefined}
      sourceResume={result&&savedId?savedFiles.find(item=>item.id===savedId&&/\.docx$/i.test(item.name)):undefined}
      accountScope={String(user?.id||'')}
      resumeStorage={result&&file&&!savedId?{
        available:true,saved:false,consent:saveConsent,saving:saveBusy,
        notice:saveNotice,onConsent:setSaveConsent,onSave:()=>void saveResume()
       }:result&&savedId?{available:false,saved:true,consent:false,saving:false,
        notice:saveNotice,onConsent:()=>{},onSave:()=>{}}:undefined}
      onClose={()=>{if(working)controller.current?.abort();setPartialJobs([]);setResult(null);setWorking(false);}}/>}
     <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
