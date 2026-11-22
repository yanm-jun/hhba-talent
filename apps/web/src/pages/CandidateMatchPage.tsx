import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,ChevronDown,FileText,FileUp,LockKeyhole,LoaderCircle,ShieldCheck,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {CandidateMatchNativeDialog} from '../components/CandidateMatchNativeDialog';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,uploadPrivateResume,type PrivateResume} from '../services/privateResumes';
import {linkMatchHistoryResume} from '../services/matchHistory';
import {getRealAuthToken} from '../services/realAuth';
import {matchServiceReady,submitExtractedResumeText,inspectResumeTextLocally,recognizeResumeDocument,resumeFileFormat,redactResumeTextLocally,type MatchResponse,type MatchedJob,type MatchOptions,type NativeMatchActivity,type NativeMatchProgress} from '../services/resumeMatch';
import '../styles/resume-match.css';

const supportedTypes='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxResumeSize=3*1024*1024;

export function CandidateMatchPage({user,embedded=false}:{user:User|null;embedded?:boolean}){
 const [file,setFile]=useState<File|null>(null);
 const [savedFiles,setSavedFiles]=useState<PrivateResume[]>([]);
 const [savedId,setSavedId]=useState('');
 const [savedPickerOpen,setSavedPickerOpen]=useState(false);
 const deepLinkPending=useRef<string|null>(new URLSearchParams(window.location.search).get('resume'));
 const [previewText,setPreviewText]=useState('');
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [previewError,setPreviewError]=useState('');
 const [ocrFile,setOcrFile]=useState<File|null>(null);
 const [ocrBusy,setOcrBusy]=useState(false);
 const [previewNote,setPreviewNote]=useState('');
 const previewController=useRef<AbortController|null>(null);
 const [vaultError,setVaultError]=useState('');
 const [saveConsent,setSaveConsent]=useState(false);
 const [saveBusy,setSaveBusy]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 // The user chooses whether the ORIGINAL binary should be retained.
 const [storageChoice,setStorageChoice]=useState<'undecided'|'save'|'once'>('undecided');
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({country:'CN',remote_only:false,role_hint:'',limit:10});
 const [working,setWorking]=useState(false);
 const [partialJobs,setPartialJobs]=useState<MatchedJob[]>([]);
 const [stage,setStage]=useState<NativeMatchProgress>('preparing');
 const [activity,setActivity]=useState<NativeMatchActivity|null>(null);
 const progress=(next:NativeMatchProgress)=>setStage(previous=>next==='waiting'?previous:next);
 const [error,setError]=useState('');

 const [result,setResult]=useState<MatchResponse|null>(null);
 const [optimizationSource,setOptimizationSource]=useState('');
 const controller=useRef<AbortController|null>(null);
 const lastSearch=useRef<{text:string;options:MatchOptions;resumeId?:string}|null>(null);
 const identifiedCharacters=redactResumeTextLocally(previewText).replace(/\s/g,'').length;
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
    if(active){setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);setOcrFile(null);setPreviewNote('');}
    if(active){setSavedFiles([]);setSavedId('');}return;
   }
   void listPrivateResumes().then(rows=>{if(active){
    setSavedFiles(rows);setVaultError('');
    setSavedId(previous=>previous&&rows.some(item=>item.id===previous)?previous:'');
    const requested=deepLinkPending.current;
    if(requested){
     deepLinkPending.current=null;
     const entry=rows.find(item=>item.id===requested);
     if(/^[0-9a-f-]{36}$/.test(requested)&&entry){
      setSavedId(requested);
      void preview(entry);
     }else setVaultError('指定的简历不在当前账号，请从列表中选择。');
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
 function selectSavedResume(id:string){
  if(working||saveBusy)return;
  deepLinkPending.current=null;
  previewController.current?.abort();
  setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  setSavedId(id);setFile(null);setResult(null);setPartialJobs([]);setOptimizationSource('');
  setError('');setSaveConsent(false);setSaveNotice('');
  setStorageChoice('undecided');setSavedPickerOpen(false);
  const entry=savedFiles.find(item=>item.id===id);
  if(entry)void preview(entry);
 }
 function choose(candidate:File|null){
  if(working||saveBusy)return;
  deepLinkPending.current=null;
  setSavedPickerOpen(false);
  previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  setError('');setResult(null);setPartialJobs([]);setOptimizationSource('');setSaveConsent(false);setSaveNotice('');
  setSavedId('');
  setStorageChoice('undecided');
  if(!candidate){setFile(null);return}
  const format=resumeFileFormat(candidate.name);
  if(!format||candidate.size<30||candidate.size>maxResumeSize){
    setFile(null);setError('请选择 3 MB 以内的 Word（DOCX）或 PDF 简历。');return;
  }
  setFile(candidate);
  void preview(candidate);
 }
 async function preview(source:File|PrivateResume){
  previewController.current?.abort();
  setPreviewBusy(true);setPreviewError('');setPreviewText('');setPreviewLoaded(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  const abort=new AbortController();previewController.current=abort;
  try{
   let selected:File;
   if(source instanceof File)selected=source;
   else{
    const bytes=await fetchPrivateResumeForLocalReview(source,abort.signal);
    if(abort.signal.aborted)return;
    selected=new File([bytes],source.name,{type:source.type});
   }
   const {text,needsOcr}=await inspectResumeTextLocally(selected,abort.signal);
   if(!abort.signal.aborted){
    setPreviewText(text);
    if(needsOcr)setOcrFile(selected);
   }
  }catch(e){
   if(!abort.signal.aborted)setPreviewError(e instanceof Error?e.message:'无法读取简历文字。');
  }finally{
   if(previewController.current===abort){
    setPreviewBusy(false);
    if(!abort.signal.aborted)setPreviewLoaded(true);
    previewController.current=null;
   }
  }
 }
 async function runOcr(){
  if(!ocrFile||previewController.current||previewBusy||ocrBusy||working||saveBusy||!getRealAuthToken())return;
  const abort=new AbortController();previewController.current=abort;
  setOcrBusy(true);setPreviewError('');setPreviewNote('');setConsent(false);
  try{
   const recognized=await recognizeResumeDocument(ocrFile,abort.signal);
   if(abort.signal.aborted)return;
   const enough=recognized.text.replace(/\s/g,'').length>=30;
   if(!previewText.trim()||enough)setPreviewText(recognized.text);
   setPreviewNote(recognized.partial||!enough?'已保留可用文字，请核对原件并补全。':
    '文档识别已完成，请核对经历和技能。');
   if(!recognized.partial&&enough)setOcrFile(null);
  }catch(error){
   if(!abort.signal.aborted)setPreviewError(error instanceof Error?error.message:'文档识别暂未完成，请重试。');
  }finally{
   if(previewController.current===abort){setOcrBusy(false);previewController.current=null;}
  }
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
  if((!file&&!savedId)||!consent||working||saveBusy||controller.current||previewBusy||ocrBusy||!previewLoaded||
   identifiedCharacters<30||availability!=='ready'||!getRealAuthToken()||
   (file&&!savedId&&storageChoice==='undecided'))return;
  setWorking(true);setStage('preparing');setActivity(null);setError('');setResult(null);setOptimizationSource('');setPartialJobs([]);
  const abort=new AbortController();
  controller.current=abort;
  try{
   // A new upload is never silently stored: save only after explicit choice,
   // and only after its private vault confirms a valid file ID.
   let matchResumeId=savedId;
   const selectedFile=file;
   if(selectedFile&&!matchResumeId&&storageChoice==='save'){
    if(!privateResumeAvailable)throw new Error('当前环境无法私有保存，请选择仅用于本次匹配。');
    setSaveBusy(true);setSaveNotice('正在私有保存原文件…');
    try{
     const stored=await uploadPrivateResume(selectedFile,true);
     matchResumeId=stored.id;
     setSavedId(stored.id);setFile(null);
     setSavedFiles(all=>all.some(item=>item.id===stored.id)?all:[stored,...all]);
     setSaveNotice('原文件已保存到「我的简历」，本次匹配将自动关联该文件。');
     window.dispatchEvent(new Event('hhba:private-resumes-changed'));
    }catch(e){
     setSaveNotice('原文件尚未保存，本次 AI 匹配未启动。可重试，或明确选择「仅用于本次匹配」。');
     throw e;
    }finally{setSaveBusy(false);}
    // A cancellation during upload may still leave an authorized file saved;
    // in that case do not start the AI request.
    if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
   }
   const matched=await submitExtractedResumeText(previewText,options,consent,abort.signal,matchResumeId||undefined,
    stage=>{if(!abort.signal.aborted)progress(stage);},
    jobs=>{if(!abort.signal.aborted)setPartialJobs(jobs);},
    detail=>{if(!abort.signal.aborted)setActivity(detail);});
   if(abort.signal.aborted)return;
   setOptimizationSource(redactResumeTextLocally(previewText));
   lastSearch.current={text:previewText,options,resumeId:matchResumeId||undefined};
   setResult(matched);setPartialJobs([]);
   // Keep selected file for return-to-edit. No automatic re-analysis.
   setConsent(false);
  }catch(e){
   if(!abort.signal.aborted)setError(e instanceof Error?e.message:'智能匹配暂时失败，请稍后再试。');
  }finally{setWorking(false);controller.current=null}
 }
 async function continueSearch(){
  const previous=result,search=lastSearch.current;
  if(!previous?.can_continue||!search||controller.current||!getRealAuthToken())return;
  const abort=new AbortController();controller.current=abort;
  const combine=(jobs:MatchedJob[])=>Array.from(new Map(
   [...previous.matches,...jobs].map(job=>[job.official_url,job])
  ).values());
  let collected=previous.matches;
  setWorking(true);setStage('preparing');setActivity(null);setError('');setResult(null);setPartialJobs(collected);
  try{
   const next=await submitExtractedResumeText(search.text,{...search.options,
    exclude_urls:previous.matches.map(job=>job.official_url).slice(-50)},true,abort.signal,search.resumeId,
    stage=>{if(!abort.signal.aborted)progress(stage);},
    jobs=>{if(!abort.signal.aborted){collected=combine(jobs);setPartialJobs(collected);}},
    detail=>{if(!abort.signal.aborted)setActivity(detail);});
   if(abort.signal.aborted)return;
   setResult({...next,matches:combine(next.matches)});
   setPartialJobs([]);
  }catch(error){
   if(!abort.signal.aborted){
    setResult({...previous,matches:collected});
    setPartialJobs([]);
    setError(error instanceof Error?error.message:'继续搜索暂未完成，请重试。');
   }
  }finally{setWorking(false);controller.current=null;}
 }
 return <Shell user={user} embedded={embedded}>
  <section className={embedded?'hhba-ai-page hhba-ai-page-embedded':'hhba-ai-page'}>
    {!embedded&&<nav className="hhba-ai-breadcrumb"><Link to="/candidate/account"><ArrowLeft size={15}/> 工作台</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>}
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> 汇方职场 · HHBA · AI JOB MATCH</div>
      <h1>上传简历，寻找合适岗位。</h1>
      <p>HHBA 将结合你的简历与公开岗位，为你生成个性化推荐。</p>
    </div>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>智能匹配服务暂未启用。</strong>
       <p>请稍后再试，或直接浏览公开岗位。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className="hhba-ai-layout">
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 1. 上传简历</h2><p>支持 Word（DOCX）和 PDF，最大 3 MB。</p></header>
        {user&&privateResumeAvailable&&savedFiles.length>0&&<div className="hhba-ai-saved-picker">
          <button type="button" className="hhba-ai-saved-picker-trigger"
           aria-expanded={savedPickerOpen} aria-controls="hhba-ai-existing-options"
           disabled={working} onClick={()=>setSavedPickerOpen(open=>!open)}>
           <span className="hhba-ai-saved-picker-heading"><FileText size={18}/>
            <span><strong>从「我的简历」中选择</strong>
             <small>{savedId&&savedFiles.some(item=>item.id===savedId)
              ?'已选择：'+savedFiles.find(item=>item.id===savedId)!.name
              :'已保存 '+savedFiles.length+' 份简历 · 点击展开'}</small></span>
           </span>
           <ChevronDown size={18} className={'hhba-ai-saved-picker-chevron'+(savedPickerOpen?' is-open':'')}/>
          </button>
          <div id="hhba-ai-existing-options" className="hhba-ai-saved-picker-content" hidden={!savedPickerOpen}>
           <div role="radiogroup" aria-label="选择用于本次智能匹配的已保存简历" className="hhba-ai-saved-picker-options">
            {savedFiles.map(item=><label key={item.id}
              className={'hhba-ai-saved-picker-option'+(savedId===item.id?' is-selected':'')}>
             <input type="radio" name="hhba-ai-existing" value={item.id} checked={savedId===item.id}
              disabled={working} onChange={()=>selectSavedResume(item.id)}/>
             <span className="hhba-ai-saved-picker-option-text">
              <strong>{item.name}</strong>
              <small>{(item.size/1024/1024).toFixed(2)} MB · {item.createdAt.slice(0,10)} 保存</small>
             </span>
            </label>)}
           </div>
           <button type="button" className="hhba-ai-saved-picker-clear" disabled={working}
            onClick={()=>selectSavedResume('')}>不使用已保存简历，改为上传新文件</button>
          </div>
        </div>}
        {user&&privateResumeAvailable&&vaultError&&<p className="hhba-ai-vault-error" role="status">{vaultError}</p>}
        {!getRealAuthToken()&&<p className="hhba-ai-service-check">AI 简历匹配需要先 <Link to="/candidate/login?next=%2Fcandidate%2Fmatch">登录 HHBA 求职账号</Link>。</p>}
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes} disabled={working||saveBusy}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>{choose(e.target.files?.[0]||null);e.target.value='';}}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{file?file.name:savedId?'或上传一份新简历，替换当前选择':'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB':'PDF 或 DOCX'}</span>
        </label>
        {(file||savedId)&&<div className="hhba-ai-review-tools">
         {previewBusy&&<p role="status">正在读取简历文字…</p>}
         {ocrBusy&&<p role="status"><LoaderCircle className="spin" size={15}/> 正在识别文档文字…</p>}
         {ocrFile&&!ocrBusy&&<div className="hhba-ai-text-review">
          <strong>{previewText?'部分页面需要进一步识别':'改用 DeepSeek 读取文档'}</strong>
          <p>点击下方按钮即同意将这份原文件发送给 DeepSeek 识别文字。识别完成后，你可以核对和修改结果。</p>
          <button type="button" disabled={working||saveBusy||!getRealAuthToken()} onClick={()=>void runOcr()}>
           {previewError?'同意并重试识别':'同意并识别'}
          </button>
         </div>}
         {previewLoaded&&<div className="hhba-ai-text-review">
          <label htmlFor="hhba-ai-text-preview">用于匹配的简历文字</label>
          {!previewError&&identifiedCharacters>0&&<small role="status">已识别 {identifiedCharacters} 个非空白字符，请核对工作经历、技能和求职方向。</small>}
          {previewNote&&<small role="status">{previewNote}</small>}
          {previewError&&<p className="hhba-ai-error" role="alert">{previewError} 你可以在下方粘贴或补全简历文字。</p>}
          <textarea id="hhba-ai-text-preview" rows={6} maxLength={20000} value={previewText}
           disabled={working||saveBusy||ocrBusy} onChange={e=>{setPreviewText(e.target.value);setConsent(false);}}/>
          <small>{identifiedCharacters<30?'请输入至少 30 个非空白字符。':'可直接修改，最多 20,000 字。'}</small>
         </div>}
         {!previewBusy&&!ocrBusy&&!ocrFile&&(!previewLoaded||previewError)&&<button type="button" disabled={working||saveBusy}
          onClick={()=>{const source=file||savedFiles.find(item=>item.id===savedId);if(source)void preview(source);}}>
           重新读取简历
         </button>}
        </div>}
        {file&&!savedId&&<fieldset className="hhba-ai-storage-choice" disabled={working||saveBusy}>
         <legend>这份简历，是否保存到「我的简历」？</legend>
         <label className={storageChoice==='save'?'is-selected':''}>
          <input type="radio" name="hhba-resume-storage" value="save"
           checked={storageChoice==='save'} onChange={()=>setStorageChoice('save')}/>
          <span><strong>保存到我的简历</strong><small>匹配前私有保存原 PDF/DOCX，今后可直接选择复用（最多 3 份）。</small></span>
         </label>
         <label className={storageChoice==='once'?'is-selected':''}>
          <input type="radio" name="hhba-resume-storage" value="once"
           checked={storageChoice==='once'} onChange={()=>setStorageChoice('once')}/>
          <span><strong>仅用于本次匹配</strong><small>不保存原文件；匹配结果仍可保留在账户历史中。</small></span>
         </label>
         <p>请先选择一种方式。保存文件和 AI 分析是两项独立授权；预览文字的编辑不会覆盖原文件。</p>
        </fieldset>}
        {saveNotice&&<p className="hhba-ai-storage-status" role="status">{saveNotice}</p>}
        <header className="hhba-ai-section-title"><h2>2. 选择工作方向</h2>
          <p>可选填目标方向；不填写时，AI 会根据简历为你推荐。</p></header>
        <div className="hhba-ai-mainland-only"><span>工作区域</span><strong>中国大陆</strong><small>不推荐港澳台或境外岗位</small></div>
        <div className="hhba-ai-fields hhba-ai-fields-one">
         <label>目标岗位方向<input value={options.role_hint} maxLength={80} placeholder="例如：软件开发、数据分析、销售、视觉设计"
          onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/></label>
        </div>
        <header className="hhba-ai-section-title"><h2>3. 确认 AI 分析与隐私</h2></header>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我已阅读并同意 <Link to="/candidate/account/privacy">《隐私说明》</Link>，授权 HHBA 使用我的简历信息进行智能岗位匹配。</span>
        </label>
        <p className="hhba-ai-notice"><ShieldCheck size={15}/>简历仅用于生成岗位建议，不会自动向企业投递或公开。</p>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={(!file&&!savedId)||!consent||working||saveBusy||previewBusy||ocrBusy||!previewLoaded||
           (file&&!savedId&&storageChoice==='undecided')||
           identifiedCharacters<30||availability!=='ready'||!getRealAuthToken()}>
          {working?<><LoaderCircle className="spin" size={18}/> {saveBusy?'正在保存简历…':'正在匹配岗位…'}</>:
           <><BriefcaseBusiness size={17}/> 开始智能匹配 <ArrowRight size={17}/></>}
        </button>
        {working&&<p className="hhba-ai-processing" role="status">智能搜索进度与已发现岗位已在弹窗中展示。</p>}
      </section>
      <aside className="hhba-ai-aside">
        <div className="hhba-ai-aside-card"><h3>只需三步</h3>
           <ol><li>上传简历</li><li>智能匹配为你寻找岗位</li>
             <li>查看岗位链接和匹配依据</li></ol>
         </div>
         <p className="hhba-ai-aside-footnote">工作地点仅限中国大陆；招聘状态请以岗位原始网页为准。</p>
      </aside>
    </div>
    {((result||partialJobs.length>0)||working)&&<CandidateMatchNativeDialog
      result={result||{matches:partialJobs}}
      pending={working&&!result} progressStage={stage} progressActivity={activity}
      onContinue={result?.can_continue?()=>void continueSearch():undefined}
      notice={working?'':error}
      sourceText={result?optimizationSource:undefined}
      sourceResume={result&&savedId?savedFiles.find(item=>item.id===savedId&&/\.docx$/i.test(item.name)):undefined}
      accountScope={String(user?.id||'')}
      resumeStorage={result&&file&&!savedId&&/\.docx$/i.test(file.name)?{
        available:true,saved:false,consent:saveConsent,saving:saveBusy,
        notice:saveNotice,onConsent:setSaveConsent,onSave:()=>void saveResume()
       }:result&&savedId?{available:false,saved:true,consent:false,saving:false,
        notice:saveNotice,onConsent:()=>{},onSave:()=>{}}:undefined}
      onClose={()=>{if(working)controller.current?.abort();setPartialJobs([]);setResult(null);setWorking(false);}}/>}
     <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
