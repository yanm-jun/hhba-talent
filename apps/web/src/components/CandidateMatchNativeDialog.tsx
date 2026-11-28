import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ArrowLeft,BriefcaseBusiness,FileText,X,LoaderCircle} from 'lucide-react';
import {ReportFirstMatchExperience} from './ReportFirstMatchExperience';
import {isVerifiedMatchReport,verifiedMatchReports} from '../services/verifiedMatchPresentation.mjs';
import type {MatchResponse,MatchResearchReport,MatchedJob,NativeMatchActivity,NativeMatchProgress,MatchExecution} from '../services/resumeMatch';
import type {PrivateResume} from '../services/privateResumes';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {capturePriorMatchAnalysis} from '../services/jobJdArchive';
// Load Siri/Word only after a candidate explicitly chooses a job, so the
// existing search-results dialog retains its original performance and look.
const TargetedResumeOptimization=lazy(()=>import('./TargetedResumeOptimization')
 .then(x=>({default:x.TargetedResumeOptimization})));
import {Link} from '../router';
import '../styles/resume-match-dialog.css';

// Search-first evidence governs links; scores are reference estimates, not offer probabilities.
// The native-search adapter historically used reference_score=0 to signal
// "no score". Never print that placeholder as a measured 0/100.
function visibleMatchScore(job:{match_score?:number|null;reference_score?:number}):number|null{
 const reported=job.match_score;
 if(typeof reported==='number'&&Number.isInteger(reported)&&reported>=0&&reported<=100)
  return reported;
 const reference=job.reference_score;
 if(typeof reference==='number'&&Number.isInteger(reference)&&reference>0&&reference<=100)
  return reference;
 return null;
}
// Explicit history handoff may reopen a previously archived official JD.
// The server revalidates the archive; generated reference JDs never qualify.
const archivedHistoryJob=(job:MatchedJob)=>job.jd_source_status==='VERIFIED_JD'&&job.reference_jd_kind!=='AI_GENERATED_REFERENCE'&&/^jd_[a-f0-9]{32}$/.test(job.jd_version_id||'')&&/^[a-f0-9]{64}$/.test(job.jd_sha256||'');
type ResumeStorageAction={available:boolean;saved:boolean;consent:boolean;saving:boolean;
 notice:string;onConsent:(yes:boolean)=>void;onSave:()=>void};
export function CandidateMatchNativeDialog({result,onClose,onTerminate,onContinue,onRetryFailedTask,pending=false,progressStage='preparing',progressActivity,execution,researchReport,researchJobs=[],notice='',resumeStorage,sourceText,sourceResume,accountScope,initialOptimizedJobId,hostRoute,taskFailed=false,initialMinimized=false,taskStartedAt}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'disclaimer'|'history_id'|'history_status'|'new_job_count'|'profile'|'native_search'>>;
 onClose:()=>void;onTerminate?:()=>void;onContinue?:()=>void;onRetryFailedTask?:()=>void;pending?:boolean;progressStage?:NativeMatchProgress;
 progressActivity?:NativeMatchActivity|null;execution?:MatchExecution|null;
 researchReport?:MatchResearchReport;researchJobs?:MatchedJob[];
 notice?:string;resumeStorage?:ResumeStorageAction;
 sourceText?:string;sourceResume?:PrivateResume;accountScope?:string;
 // Match-history handoff enters the same existing editor without rerunning a search.
 initialOptimizedJobId?:string;
 hostRoute?:string;taskFailed?:boolean;initialMinimized?:boolean;taskStartedAt?:number;
}){
 const ref=useRef<HTMLDivElement|null>(null);
 const confirmRef=useRef<HTMLDialogElement|null>(null);
 const dockRef=useRef<HTMLButtonElement|null>(null);
 const [minimized,setMinimized]=useState(initialMinimized);
 const previousHostRoute=useRef(hostRoute);
 useEffect(()=>{
  if(previousHostRoute.current===hostRoute)return;
  previousHostRoute.current=hostRoute;
  // Browser Back, public navigation and workspace switches are visibility
  // changes only. The owner retains the exact same request and result state.
  if(hostRoute!==undefined){setConfirmTerminate(false);setMinimized(true);}
 },[hostRoute]);
 const [confirmTerminate,setConfirmTerminate]=useState(false);
 const [optimizedJobUrl,setOptimizedJobUrl]=useState<string|null>(()=>
  result.matches.find(job=>job.id===initialOptimizedJobId&&archivedHistoryJob(job))?.official_url||null);
 const [optimizationDirty,setOptimizationDirty]=useState(false);
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{
  if(!pending)return;
  const started=taskStartedAt??Date.now();
  const update=()=>setElapsed(Math.max(0,Math.floor((Date.now()-started)/1000)));
  update();const timer=window.setInterval(update,1000);
  return()=>window.clearInterval(timer);
 },[pending,taskStartedAt]);
 const stageTitle:Record<NativeMatchProgress,string>={
  preparing:'准备匹配',parsing:'识别简历经历和技能',connected:'准备搜索',
  planning:'研究职业方向',searching:'搜索企业岗位',
  reading:'整理岗位公开资料',researching:'核对招聘资料',
  writing:'编写完整岗位报告',scoring:'分析岗位与简历',
  waiting:'正在匹配岗位'
 };

 const [,setSelectedJobUrl]=useState<string|null>(optimizedJobUrl);
 const showResults=!optimizedJobUrl;
 const matchListScroll=useRef(0);
 const activeJob=verifiedMatchReports(result.matches).find(job=>job.official_url===optimizedJobUrl)||result.matches.find(job=>job.official_url===optimizedJobUrl&&job.id===initialOptimizedJobId&&archivedHistoryJob(job));
 const parsedProfile=result.profile?({...result.profile,experiences:[]} as CandidateProfile):null;
 function optimizeJob(job:MatchedJob){
  if(!parsedProfile||!isVerifiedMatchReport(job))return;
  matchListScroll.current=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content')?.scrollTop||0;
  setSelectedJobUrl(job.official_url);setOptimizationDirty(false);setOptimizedJobUrl(job.official_url);
 }
 function asTargetJob(job:MatchResponse['matches'][number]):JobMatch{
  return {
   prior_match_analysis:capturePriorMatchAnalysis(job),
   id:job.id,company:job.company,title:job.title,title_zh:job.title_zh||null,
   location:job.location,official_url:job.official_url,platform:job.platform,
   remote:job.remote,reference_score:visibleMatchScore(job)??0,
   matched:job.matched||[],not_evidenced:job.not_evidenced||[],
   needs_verification:job.needs_verification||[],
   requirements_basis:job.requirements_basis||job.score_basis||'',
   jd_version_id:job.jd_version_id,jd_sha256:job.jd_sha256,
   reference_jd:job.reference_jd,reference_jd_basis:job.reference_jd_basis,reference_jd_kind:job.reference_jd_kind,
   evidence_status:job.evidence_status,evidence_excerpt:job.evidence_excerpt
  };
 }
 // The result list is never searched again on return. Preserve scroll and
 // the exact result object from the original matching session.
 useLayoutEffect(()=>{
  const viewport=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content');
  if(viewport)viewport.scrollTop=optimizedJobUrl?0:matchListScroll.current;
 },[optimizedJobUrl]);
 function backToMatches(){
  if(optimizationDirty&&!window.confirm('这份岗位简历有尚未保存的文字草稿。返回后草稿可能丢失，确定返回岗位匹配结果吗？'))return;
  setOptimizationDirty(false);setOptimizedJobUrl(null);
 }
 function handleClose(){
  if(optimizedJobUrl){backToMatches();return}
  if(pending||taskFailed){minimizeSearch();return}
  onClose();
 }
 // Window visibility is independent of the request owned by CandidateMatchPage.
 // Never invoke onClose (which aborts the request) when minimizing.
 function minimizeSearch(){
  setConfirmTerminate(false);setMinimized(true);
 }
 function restoreSearch(){setMinimized(false);}
 useEffect(()=>{
  if(minimized){dockRef.current?.focus();return}
  const overflow=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';ref.current?.focus();
  return()=>{document.body.style.overflow=overflow;trigger?.focus()};
 },[minimized]);
 useEffect(()=>{
  const dialog=confirmRef.current;
  if(confirmTerminate&&(pending||taskFailed)&&dialog&&!dialog.open)dialog.showModal();
  return()=>{if(dialog?.open)dialog.close()};
 },[confirmTerminate,pending,taskFailed]);
 useEffect(()=>{
  if(!pending&&!taskFailed)setConfirmTerminate(false);
 },[pending,taskFailed]);
 function handleKey(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!pending)handleClose();return}
  if(showResults&&!optimizedJobUrl&&event.target===ref.current&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();ref.current?.querySelector<HTMLButtonElement>(event.key==='ArrowRight'?'.hhba-report-pager-next':'.hhba-report-pager-prev')?.click();return;}
  if(event.key!=='Tab'||!ref.current)return;
  const focusable=Array.from(ref.current.querySelectorAll<HTMLElement>(
   'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])'
  )).filter(el=>el.getClientRects().length>0);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
 return createPortal(<>
  <div className="hhba-match-overlay" role="presentation" hidden={minimized} style={minimized?{display:'none'}:undefined} onMouseDown={e=>{if(e.target===e.currentTarget)e.preventDefault()}} onClick={e=>{if(e.target===e.currentTarget&&pending)minimizeSearch()}}>
   <div className={'hhba-match-modal'+(optimizedJobUrl?' hhba-match-modal-editor':' hhba-report-first-dialog')} role="dialog" aria-modal="true" tabIndex={-1}
    ref={ref} onKeyDown={handleKey} aria-label={optimizedJobUrl?'岗位专属简历优化':'岗位匹配'}>
    <header className={'hhba-match-modal-head'+(optimizedJobUrl&&sourceResume?' hhba-word-editor-head':'')}>
     {optimizedJobUrl&&sourceResume&&activeJob?
      <div className="hhba-word-editor-heading">
       <button type="button" className="hhba-word-editor-back" onClick={backToMatches}
        aria-label="返回岗位匹配结果" title="返回岗位匹配结果"><ArrowLeft size={17}/></button>
       <FileText size={18} aria-hidden="true"/>
       <div className="hhba-word-editor-heading-copy">
        <strong>{sourceResume.name}</strong>
        <small id="hhba-native-title">{activeJob.title_zh||activeJob.title}
         {' · 原匹配分 '+(visibleMatchScore(activeJob)??'—')+'/100'}</small>
       </div>
      </div>:
      <div className="hhba-match-modal-brand">
       <span className="hhba-match-modal-symbol"><BriefcaseBusiness size={19}/></span>
       <div><strong>岗位匹配</strong></div>
      </div>}
     <div className="hhba-word-editor-head-actions">
      {optimizedJobUrl&&sourceResume&&<span id="hhba-word-top-download" />}
      <button type="button" className="hhba-match-modal-close"
       onClick={optimizedJobUrl&&sourceResume?()=>{
        if(pending||taskFailed){backToMatches();return;}
         if(!optimizationDirty||window.confirm('简历还有未保存的文字草稿，关闭后可能丢失。确定关闭吗？'))onClose();
       }:handleClose}
       aria-label={optimizedJobUrl&&sourceResume?'关闭简历编辑':pending||taskFailed?'最小化研究窗口':'关闭推荐'}><X size={19}/></button>
     </div>
    </header>
    <div className="hhba-match-modal-content" data-hhba-stage={optimizedJobUrl?'optimization':'matches'}>
     {notice&&<p className="hhba-match-disclaimer" role="alert">{notice}{result.matches.length>0?' 已显示本次收到的岗位；请核对招聘原始页面。':''}</p>}
     {!optimizedJobUrl&&<ReportFirstMatchExperience profile={result.profile} report={researchReport} jobs={researchJobs} officialJobs={result.matches}
      pending={pending} failed={taskFailed} progressStage={progressStage} activity={progressActivity} elapsed={elapsed}
      onOptimize={optimizeJob} optimizationAvailable={!!parsedProfile}/>}
     {activeJob&&parsedProfile?
      <section className="hhba-match-workspace" aria-label="岗位专属简历优化">
       {pending&&<p className="hhba-refined-note" role="status">其他岗位仍在后台搜索与研究，当前这份已完成可靠报告的岗位可以单独优化简历。</p>}
       {!sourceResume&&<><button type="button" className="hhba-match-workspace-back" onClick={backToMatches}>
        返回岗位匹配结果
       </button>
       <div className="hhba-match-selected-job">
        <div><span>针对已选岗位定向优化</span>
         <h2 id="hhba-native-title">{activeJob.title_zh||activeJob.title}</h2>
         <p>{activeJob.company} · {activeJob.location}</p>
        </div>
        <div className="hhba-match-selected-score">
         <strong>{visibleMatchScore(activeJob)??'—'}<small>/100</small></strong>
         <span>原简历适配分 · AI 参考，非录用概率</span>
        </div>
       </div></>}
       {!sourceResume&&resumeStorage?.available&&<div className="hhba-match-word-note" role="note">
        如需保留原 Word 版式，可先将 DOCX 私有保存到「我的简历」。
        {resumeStorage?.available&&<div className="hhba-match-save-resume">
         <label><input type="checkbox" checked={resumeStorage.consent} disabled={resumeStorage.saving}
          onChange={e=>resumeStorage.onConsent(e.target.checked)}/>
          我同意将原文件保存在当前账户的私有简历库。</label>
         <button type="button" disabled={!resumeStorage.consent||resumeStorage.saving}
          onClick={resumeStorage.onSave}>{resumeStorage.saving?'正在保存…':'私有保存原简历'}</button>
         {resumeStorage.notice&&<p role="status">{resumeStorage.notice}</p>}
        </div>}
       </div>}
       <Suspense fallback={<p role="status" className="hhba-match-optimizer-loading">正在打开简历优化工作区…</p>}>
        <TargetedResumeOptimization key={activeJob.id} profile={parsedProfile}
         job={asTargetJob(activeJob)} sourceText={sourceText}
         accountScope={accountScope} sourceResume={sourceResume} requireVerifiedJd
         onDraftDirtyChange={setOptimizationDirty}/>
       </Suspense>
       <a className="hhba-native-apply" href={activeJob.official_url} target="_blank" rel="noopener noreferrer"
        data-hhba-recruitment-outbound="true">前往企业官网投递 <ArrowUpRight size={15}/></a>
      </section>:<>
     {!pending&&result.history_status==='SAVED'&&<div className="hhba-match-history-confirm">
      <span>已保存本次正式推荐记录。</span><Link to="/candidate/account/applications" onClick={onClose}>查看匹配历史</Link>
     </div>}
     {!pending&&result.history_status==='UNAVAILABLE'&&<p className="hhba-match-history-warning" role="status">本次研究成果已展示，但正式推荐历史尚未保存成功。</p>}
     {!pending&&resumeStorage?.available&&<div className="hhba-match-save-resume">
       <strong>把这份简历保存到「我的简历」</strong>
       <p>原文件仅写入你的私有简历库，方便下次复用；不会因保存而再次调用 AI 或向企业投递。</p>
       <label><input type="checkbox" checked={resumeStorage.consent} disabled={resumeStorage.saving}
        onChange={e=>resumeStorage.onConsent(e.target.checked)}/>
        我同意将这份 PDF/DOCX 原文件保存到当前账户的私有简历库（与本次 AI 分析授权分开）。</label>
       <button type="button" disabled={!resumeStorage.consent||resumeStorage.saving}
        onClick={resumeStorage.onSave}>{resumeStorage.saving?'正在私有保存…':'保存到我的简历'}</button>
      </div>}
     {!pending&&resumeStorage?.saved&&<p className="hhba-match-saved-resume">已选择账户中保存的简历，可在「我的简历」中继续管理。</p>}
     {resumeStorage?.notice&&<p className="hhba-match-saved-resume" role="status">{resumeStorage.notice}</p>}
     {!pending&&showResults&&<p className="hhba-match-disclaimer">{result.disclaimer||'招聘状态、薪资和任职要求以企业官网为准。'}</p>}
     </>}
    </div>
    <footer className="hhba-match-modal-foot">
     {!optimizedJobUrl&&onContinue&&!pending?
      <button className="hhba-match-done" type="button" onClick={onContinue}>继续搜索岗位</button>:
      <span>HHBA · 让机会与人才，找到彼此。</span>}
     {taskFailed&&onRetryFailedTask&&<button className="hhba-match-done" type="button" onClick={onRetryFailedTask}>恢复原研究任务</button>}
     {(pending||taskFailed)&&<button className="hhba-match-terminate" type="button" onClick={()=>setConfirmTerminate(true)}>终止匹配</button>}
     <button className="hhba-match-done" type="button" onClick={handleClose}>{optimizedJobUrl?'返回匹配结果':pending||taskFailed?'最小化':'完成查看'}</button>
    </footer>
   </div>
  </div>
  {minimized&&<button ref={dockRef} type="button" className="hhba-match-task-dock" onClick={restoreSearch} aria-label={pending?'恢复正在运行的岗位研究':taskFailed?'查看岗位研究异常':'查看岗位研究结果'}>
   <span className="hhba-match-task-icon">{pending?<LoaderCircle size={20} className="spin" aria-hidden="true"/>:<BriefcaseBusiness size={20} aria-hidden="true"/>}</span>
   <span className="hhba-match-task-copy"><strong>{pending?'AI 正在研究岗位':taskFailed?'岗位研究暂未完成':'岗位研究已结束'}</strong><small>{pending?stageTitle[progressStage]+' · '+(researchReport?.discovered??researchJobs.length)+' 个候选':taskFailed?'点击查看异常原因':'点击查看已收到的研究结果'}</small></span>
   <span className="hhba-match-task-action">{pending?'查看进度':'查看结果'}</span>
  </button>}
  {confirmTerminate&&(pending||taskFailed)&&<dialog ref={confirmRef} className="hhba-match-exit-dialog" aria-labelledby="hhba-match-exit-title" onCancel={e=>{e.preventDefault();setConfirmTerminate(false)}} onClick={e=>{if(e.target===e.currentTarget)e.preventDefault()}}>
   <div className="hhba-match-exit-heading"><span className="hhba-match-task-icon"><BriefcaseBusiness size={22} aria-hidden="true"/></span><h2 id="hhba-match-exit-title">确定终止本次匹配？</h2></div>
   <p>终止后将取消当前请求，尚未保存的本次研究结果可能丢失。已经产生的 API 调用费用不会因终止而退回。</p>
   <div className="hhba-match-exit-actions">
    <button type="button" className="hhba-match-exit-primary" autoFocus onClick={()=>setConfirmTerminate(false)}>继续研究</button>
    <button type="button" className="hhba-match-exit-danger" onClick={()=>{setConfirmTerminate(false);(onTerminate||onClose)()}}>确认终止本次匹配</button>
   </div>
  </dialog>}
 </>,document.body);
}
