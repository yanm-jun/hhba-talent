import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ArrowLeft,BriefcaseBusiness,FileText,MapPin,Wallet,X,Sparkles,LoaderCircle} from 'lucide-react';
import type {MatchResponse,NativeMatchActivity,NativeMatchProgress} from '../services/resumeMatch';
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
export function CandidateMatchNativeDialog({result,onClose,onContinue,pending=false,progressStage='preparing',progressActivity,notice='',resumeStorage,sourceText,sourceResume,accountScope,initialOptimizedJobId}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'disclaimer'|'history_id'|'history_status'|'new_job_count'|'profile'|'native_search'>>;
 onClose:()=>void;onContinue?:()=>void;pending?:boolean;progressStage?:NativeMatchProgress;
 progressActivity?:NativeMatchActivity|null;
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
 const progressSteps=[
  {label:'识别简历',stages:['preparing','parsing']},
  {label:'搜索企业岗位',stages:['connected','planning','searching']},
  {label:'核验岗位 JD',stages:['reading','researching']},
  {label:'对照简历评分',stages:['writing','scoring']}
 ];
 const matchListScroll=useRef(0);
 const activeJob=result.matches.find(job=>job.official_url===optimizedJobUrl);
 const parsedProfile=result.profile?({...result.profile,experiences:[]} as CandidateProfile):null;
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
    ref={ref} onKeyDown={handleKey} aria-labelledby="hhba-native-title">
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
     {pending&&<><ol className="hhba-match-progress-steps" aria-label="匹配进度">
      {progressSteps.map(step=><li key={step.label}
       aria-current={step.stages.includes(progressStage)?'step':undefined}>{step.label}</li>)}
     </ol><div className="hhba-research-now" role="status">
      <LoaderCircle size={18} className="spin" aria-hidden="true"/>
      <div className="hhba-match-progress-copy">
       <strong id="hhba-native-title">{stageTitle[progressStage]}…</strong>
       {progressStage==='parsing'&&progressActivity?.stage==='parsing'&&<span>{progressActivity.message}</span>}
       {progressActivity?.searches!==undefined&&<span>
        已执行 {progressActivity.searches} 次检索 · 发现 {progressActivity.candidate_links??0} 条企业岗位线索
       </span>}
       {result.matches.length>0&&<span>已找到 {result.matches.length} 个岗位</span>}
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
     {!pending&&<div className="hhba-match-intro">
      <h2 id="hhba-native-title">找到 {result.matches.length} 个岗位</h2>
      <p>匹配分用于求职参考，不是录用概率。</p>
      {!!result.profile?.facts?.length&&<details>
       <summary>已识别的简历证据（{result.profile.facts.length} 条）</summary>
       <ul>{result.profile.facts.map(fact=><li key={fact.id}>{fact.quote}</li>)}</ul>
      </details>}
     </div>}
     {notice&&<p className="hhba-match-disclaimer" role="alert">{notice} 已显示本次收到的岗位；请核对招聘原始页面。</p>}
     {!pending&&result.history_status==='SAVED'&&<div className="hhba-match-history-confirm">
      <span>这次的真实推荐结果已保存到你账户的「匹配历史」，下次登录可以继续查看。</span>
      <Link to="/candidate/account/applications" onClick={onClose}>查看匹配历史</Link>
      {Number(result.new_job_count||0)>0&&<small>相较之前的记录，新发现 {result.new_job_count} 个未推荐过的岗位。</small>}
     </div>}
     {!pending&&result.history_status==='UNAVAILABLE'&&
      <p className="hhba-match-history-warning" role="status">本次岗位推荐已完成，但账户匹配历史暂未保存成功，请保留当前结果并稍后重试。</p>}
     {result.matches.length?
      <div className="hhba-native-list">
       {result.matches.map((job,i)=>(
        <article key={job.official_url} className="hhba-native-job">
         <div className="hhba-native-top">
          <span className="hhba-native-num">{String(i+1).padStart(2,'0')}</span>
          <div className="hhba-native-heading">
           <strong>{job.company}</strong>
           <h3>{job.title_zh||job.title}</h3>
           <div className="hhba-native-meta"><span><MapPin size={13}/>{job.location}</span>
            {job.salary&&<span><Wallet size={13}/>{job.salary}</span>}</div>
           <div className="hhba-native-source" role="note">
            {job.jd_source_status==='VERIFIED_JD'?'完整岗位 JD 已核验':pending?'正在核验岗位 JD':'完整岗位 JD 待核验'}
           </div>
           <div className="hhba-native-availability" role="note">
            <span className={job.availability_status==='OPEN_LISTED'?'hhba-native-state-open':'hhba-native-state-unknown'}>
             {job.availability_status==='OPEN_LISTED'?'网页显示在招 · 仍需确认':'投递状态未确认'}
            </span>
            <small>{job.availability_status==='OPEN_LISTED'?
             '页面文本提示开放申请，是否可提交仍以招聘官网为准':job.jd_source_status==='VERIFIED_JD'?'已核验岗位详情原文，但投递资格和是否仍开放申请仍需到官网确认':'链接来自搜索结果，可能已过期或需要登录；请打开官网确认'}</small>
           </div>
          </div>
          <div className="hhba-native-score" aria-label={visibleMatchScore(job)!==null?'简历适配分 '+visibleMatchScore(job)+' 分（AI 参考）':'暂无可靠适配分'}>
           {visibleMatchScore(job)!==null?
            <><strong>{visibleMatchScore(job)}<small>/100</small></strong><span>匹配分</span></>:
            <><strong className="hhba-native-score-na">—</strong><span>暂无可靠分数</span></>}
           <button type="button" disabled={pending||!parsedProfile||!job.jd_version_id||!job.jd_sha256}
             title={!job.jd_version_id||!job.jd_sha256?'取得完整岗位 JD 后可优化':pending||!parsedProfile?'匹配完成后可优化':'针对所选岗位优化简历'}
             className="hhba-native-optimize" onClick={()=>{
              matchListScroll.current=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content')?.scrollTop||0;
              setOptimizationDirty(false);setOptimizedJobUrl(job.official_url);
             }} aria-label={'针对'+(job.title_zh||job.title)+'优化简历'}>
             <Sparkles size={13} aria-hidden="true"/> 优化简历
            </button>
          </div>
         </div>
         {job.score_basis&&visibleMatchScore(job)!==null&&
          <p className="hhba-native-score-basis"><strong>评分依据：</strong>{job.score_basis}</p>}
         <p className="hhba-native-reason"><strong>{job.jd_comparisons?.length?'为什么推荐：':'匹配依据：'}</strong>
          {(job.recommendation_reason||job.matched?.[0]||'请结合简历和招聘详情自行判断。').replace(/([②③])/g,'\n$1')}</p>
         {!!job.jd_comparisons?.length&&<ul className="hhba-native-comparisons">
          {job.jd_comparisons.map(item=><li key={item.requirement}>
           <strong>{item.status==='supported'?'有对应经历':item.status==='partial'?'部分对应':'缺少简历证据'}</strong>
           <div>岗位 JD · {item.requirement}</div>
           {item.resume_evidence&&<div>简历原文 · {item.resume_evidence}</div>}
          </li>)}
         </ul>}
         <a className="hhba-native-apply" href={job.official_url} target="_blank" rel="noopener noreferrer"
          data-hhba-recruitment-outbound="true">{job.jd_version_id?'前往企业官网投递':'查看企业招聘页面'} <ArrowUpRight size={15}/></a>
        </article>
       ))}
      </div>:
      !pending&&<div className="hhba-match-empty"><BriefcaseBusiness size={23}/>
       <h3>本轮没有找到符合条件的具体职位链接</h3>
       <p>简历已识别完成。本轮企业官网检索没有得到可推荐的具体岗位。</p>
       {result.native_search?.searches!==undefined&&<p>已检索 {result.native_search.searches} 次
        {'，发现 '+(result.native_search.candidate_links??0)+' 条企业岗位线索。'}</p>}
       {!!result.profile?.target_roles?.length&&<p>搜索参考方向 · {result.profile.target_roles.join('、')}</p>}
       {onContinue&&<p>选择「继续搜索岗位」，可以换一批搜索词并继续核对招聘来源。</p>}
      </div>}
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
     {!pending&&<p className="hhba-match-disclaimer">{result.disclaimer||'招聘状态、薪资和任职要求以企业官网为准。'}</p>}
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
