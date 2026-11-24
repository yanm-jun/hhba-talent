import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ArrowLeft,BriefcaseBusiness,FileText,X,LoaderCircle} from 'lucide-react';
import {MatchResearchPanels,matchStageIndex} from './MatchResearchPanels';
import type {MatchResponse,MatchResearchReport,MatchedJob,NativeMatchActivity,NativeMatchProgress} from '../services/resumeMatch';
import type {PrivateResume} from '../services/privateResumes';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
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
type ResumeStorageAction={available:boolean;saved:boolean;consent:boolean;saving:boolean;
 notice:string;onConsent:(yes:boolean)=>void;onSave:()=>void};
export function CandidateMatchNativeDialog({result,onClose,onContinue,pending=false,progressStage='preparing',progressActivity,researchReport,researchJobs=[],notice='',resumeStorage,sourceText,sourceResume,accountScope,initialOptimizedJobId}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'disclaimer'|'history_id'|'history_status'|'new_job_count'|'profile'|'native_search'>>;
 onClose:()=>void;onContinue?:()=>void;pending?:boolean;progressStage?:NativeMatchProgress;
 progressActivity?:NativeMatchActivity|null;
 researchReport?:MatchResearchReport;researchJobs?:MatchedJob[];
 notice?:string;resumeStorage?:ResumeStorageAction;
 sourceText?:string;sourceResume?:PrivateResume;accountScope?:string;
 // Match-history handoff enters the same existing editor without rerunning a search.
 initialOptimizedJobId?:string;
}){
 const ref=useRef<HTMLDivElement|null>(null);
 const [optimizedJobUrl,setOptimizedJobUrl]=useState<string|null>(()=>
  result.matches.find(job=>job.id===initialOptimizedJobId&&job.jd_version_id&&job.jd_sha256)?.official_url||null);
 const [optimizationDirty,setOptimizationDirty]=useState(false);
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{
  if(!pending)return;
  const started=Date.now();
  setElapsed(0);
  const timer=window.setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);
  return()=>window.clearInterval(timer);
 },[pending]);
 const stageTitle:Record<NativeMatchProgress,string>={
  preparing:'准备匹配',parsing:'识别简历经历和技能',connected:'准备搜索',
  planning:'研究职业方向',searching:'搜索企业岗位',
  reading:'核验完整岗位 JD',researching:'核对招聘资料',
  writing:'整理岗位',scoring:'对照简历和岗位 JD',
  waiting:'正在匹配岗位'
 };

 const [selectedJobUrl,setSelectedJobUrl]=useState<string|null>(null);
 const [manualStage,setManualStage]=useState<number|null>(null);
 const [furthestStage,setFurthestStage]=useState(0);
 const currentStage=matchStageIndex(progressStage);
 useEffect(()=>{
  if(pending&&currentStage>=0)setFurthestStage(old=>Math.max(old,currentStage));
 },[pending,currentStage]);
 const selectedStage=manualStage??(pending?Math.max(furthestStage,currentStage):2);
 const showResults=selectedStage===2;
 const selectStage=(next:number|null)=>{
  setManualStage(next);
  const viewport=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content');
  if(viewport)viewport.scrollTop=0;
 };
 const matchListScroll=useRef(0);
 const activeJob=result.matches.find(job=>job.official_url===optimizedJobUrl)||researchJobs.find(job=>job.official_url===optimizedJobUrl);
 const parsedProfile=result.profile?({...result.profile,experiences:[]} as CandidateProfile):null;
 function optimizeJob(job:MatchedJob){
  if(pending||!parsedProfile||!job.jd_version_id||!job.jd_sha256)return;
  matchListScroll.current=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content')?.scrollTop||0;
  setSelectedJobUrl(job.official_url);setOptimizationDirty(false);setOptimizedJobUrl(job.official_url);
 }
 function asTargetJob(job:MatchResponse['matches'][number]):JobMatch{
  return {
   id:job.id,company:job.company,title:job.title,title_zh:job.title_zh||null,
   location:job.location,official_url:job.official_url,platform:job.platform,
   remote:job.remote,reference_score:visibleMatchScore(job)??0,
   matched:job.matched||[],not_evidenced:job.not_evidenced||[],
   needs_verification:job.needs_verification||[],
   requirements_basis:job.requirements_basis||job.score_basis||'',
   jd_version_id:job.jd_version_id,jd_sha256:job.jd_sha256,
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
  onClose();
 }
 useEffect(()=>{
  const overflow=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';ref.current?.focus();
  return()=>{document.body.style.overflow=overflow;trigger?.focus()};
 },[]);
 function handleKey(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();handleClose();return}
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
 return createPortal(
  <div className="hhba-match-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)handleClose()}}>
   <div className={'hhba-match-modal'+(optimizedJobUrl?' hhba-match-modal-editor':'')} role="dialog" aria-modal="true" tabIndex={-1}
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
        if(!optimizationDirty||window.confirm('简历还有未保存的文字草稿，关闭后可能丢失。确定关闭吗？'))onClose();
       }:handleClose}
       aria-label={optimizedJobUrl&&sourceResume?'关闭简历编辑':'关闭推荐'}><X size={19}/></button>
     </div>
    </header>
    <div className="hhba-match-modal-content" data-hhba-stage={optimizedJobUrl?'optimization':'matches'}>
     {!optimizedJobUrl&&<MatchResearchPanels profile={result.profile} report={researchReport} jobs={researchJobs} officialJobs={result.matches} pending={pending} progressStage={progressStage} activity={progressActivity} elapsed={elapsed} selection={selectedStage} onSelectionChange={selectStage} onFollow={()=>selectStage(null)} selectedJobUrl={selectedJobUrl} onJobChange={setSelectedJobUrl} onOptimize={optimizeJob} optimizationAvailable={!!parsedProfile}/>}
     {pending&&selectedStage!==1&&<><div className="hhba-research-now" role="status">
      <LoaderCircle size={18} className="spin" aria-hidden="true"/>
      <div className="hhba-match-progress-copy">
       <strong id="hhba-native-title">{stageTitle[progressStage]}…</strong>
       {progressActivity?.message&&<span>{progressActivity.message}</span>}
       {progressActivity?.searches!==undefined&&<span>
        已执行 {progressActivity.searches} 次检索 · 发现 {progressActivity.candidate_links??0} 条企业岗位线索 · 已阅读 {progressActivity.pages_read??0} 份岗位资料
       </span>}
       {researchReport&&<span>已发现 {researchReport.discovered} 条候选招聘来源 · 已排除 {researchReport.excluded_count} 条商业平台链接</span>}
       {result.matches.length>0&&<span>已形成 {result.matches.length} 个正式推荐</span>}
      </div>
      <span className="hhba-match-progress-time" aria-hidden="true">已用时 {elapsed} 秒</span>
     </div></>}
     {!pending&&activeJob&&parsedProfile?
      <section className="hhba-match-workspace" aria-label="岗位专属简历优化">
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
     {showResults&&<>
     {!pending&&result.native_search?.mode==='V4_SIMPLE_AI'&&<div className="hhba-match-disclaimer" role="status">本次发现 {result.native_search.candidate_links??0} 个候选，已核验 JD {result.native_search.jd_verification?.verified??0} 个，完成证据评分 {result.native_search.jd_verification?.scored??0} 个。{result.native_search.stage==='partial'?'研究未达到完整交付目标；未核验或证据不足的候选保留在研究记录，不代表没有适合的工作。':''}{result.native_search.research_error?' 研究中断原因：'+result.native_search.research_error:''}{result.native_search.diagnostics&&Object.keys(result.native_search.diagnostics).length>0?<details><summary>查看实际核验诊断</summary>{Object.entries(result.native_search.diagnostics).map(([code,count])=><span key={code}>{code}：{count}；</span>)}</details>:null}</div>}
     {!pending&&result.native_search?.mode==='HHBA_MATCH_CLEAN_V2'&&<p className="hhba-match-disclaimer" role="status">
      新版独立求职研究：搜索 {result.native_search.queries??0} 组关键词，
      取得 {result.native_search.candidate_links??0} 条企业职位来源，
      尝试打开 {result.native_search.fetch_attempted??0} 个网页，
      成功读取 {result.native_search.page_reads??0} 个，
      有明确工作城市原文的网页 {result.native_search.city_evidence_count??0} 个，
      最终识别 {result.native_search.extracted_jobs??0} 条具体职位。
      {(result.native_search.search_failures??0)>0?
       ' 搜索服务异常 '+(result.native_search.search_failures??0)+' 组；':''}
      {(result.native_search.fetch_failures??0)>0?
       ' 网页读取失败 '+(result.native_search.fetch_failures??0)+' 次；':''}
      {(result.native_search.model_failures??0)>0?
       ' 岗位信息提取模型失败 '+(result.native_search.model_failures??0)+' 批；':''}
      {result.native_search.score_provider_error?' 本次评分模型异常：'+result.native_search.score_provider_error+'；':''}
      {result.native_search.planning_error?' 搜索规划异常：'+result.native_search.planning_error+'；':''}
      {result.native_search.provider_error_codes?.length?
       ' 搜索错误：'+result.native_search.provider_error_codes.join('、')+'；':''}
      {result.native_search.fetch_error_codes?.length?
       ' 网页错误：'+result.native_search.fetch_error_codes.join('、')+'；':''}
      {result.native_search.stage!=='complete'?
       ' 本轮没有充分取得真实职位证据（阶段：'+result.native_search.stage+'），不代表没有适合的工作。':''}
     </p>}
     {!pending&&result.native_search?.hybrid_fallback&&<p className="hhba-match-disclaimer" role="status">
      本轮国内企业补充搜索 {result.native_search.hybrid_fallback.queries??0} 组查询，
      发现 {result.native_search.hybrid_fallback.candidate_links??0} 条合规招聘来源，
      已尝试打开 {result.native_search.hybrid_fallback.fetch_attempted??0} 个网页，
      实际读取成功 {result.native_search.hybrid_fallback.fetched_job_pages??0} 个，
      找到 {result.native_search.hybrid_fallback.explicit_work_city_sources??0} 条明确工作城市证据；
      目前形成 {result.native_search.hybrid_fallback.source_previews??0} 条有职位与地点依据的待核实职位。
      {result.native_search.native_error?' 主搜索未完整成功（'+result.native_search.native_error+'），已独立核对取得的来源。':''}
      {(result.native_search.hybrid_fallback.native_source_salvage_attempted??0)>0?
       ' 主搜索中断前保留 '+(result.native_search.hybrid_fallback.native_source_salvage_attempted??0)+
       ' 条真实网页来源，补充核实 '+(result.native_search.hybrid_fallback.native_source_salvage_jobs??0)+' 条具体职位。':''}
      {(result.native_search.hybrid_fallback.candidate_links??0)>0&&(result.native_search.hybrid_fallback.source_previews??0)===0?
       '本轮仍未完成职位信息核实，不代表没有适合的岗位。':''}
     </p>}
     {notice&&<p className="hhba-match-disclaimer" role="alert">{notice} 已显示本次收到的岗位；请核对招聘原始页面。</p>}
     {!pending&&result.history_status==='SAVED'&&<div className="hhba-match-history-confirm">
      <span>这次的真实推荐结果已保存到你账户的「匹配历史」，下次登录可以继续查看。</span>
      <Link to="/candidate/account/applications" onClick={onClose}>查看匹配历史</Link>
      {Number(result.new_job_count||0)>0&&<small>相较之前的记录，新发现 {result.new_job_count} 个未推荐过的岗位。</small>}
     </div>}
     {!pending&&result.history_status==='UNAVAILABLE'&&
      <p className="hhba-match-history-warning" role="status">本次岗位推荐已完成，但账户匹配历史暂未保存成功，请保留当前结果并稍后重试。</p>}
     </>}
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
     <button className="hhba-match-done" type="button" onClick={handleClose}>{optimizedJobUrl?'返回匹配结果':pending?'取消搜索':'完成查看'}</button>
    </footer>
   </div>
  </div>,document.body);
}
