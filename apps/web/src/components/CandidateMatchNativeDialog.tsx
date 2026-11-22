import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ArrowLeft,BriefcaseBusiness,FileText,MapPin,Wallet,X,Search,Sparkles,Check,LoaderCircle} from 'lucide-react';
import type {MatchResponse,NativeMatchProgress} from '../services/resumeMatch';
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
export function CandidateMatchNativeDialog({result,onClose,pending=false,progressStage='preparing',notice='',resumeStorage,sourceText,sourceResume,accountScope,initialOptimizedJobId}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'disclaimer'|'history_id'|'history_status'|'new_job_count'|'improved_job_count'|'profile'>>;
 onClose:()=>void;pending?:boolean;progressStage?:NativeMatchProgress;notice?:string;resumeStorage?:ResumeStorageAction;
 sourceText?:string;sourceResume?:PrivateResume;accountScope?:string;
 // Match-history handoff enters the same existing editor without rerunning a search.
 initialOptimizedJobId?:string;
}){
 const ref=useRef<HTMLDivElement|null>(null);
 const [optimizedJobId,setOptimizedJobId]=useState<string|null>(()=>
  initialOptimizedJobId&&result.matches.some(job=>job.id===initialOptimizedJobId)
   ?initialOptimizedJobId:null);
 const [optimizationDirty,setOptimizationDirty]=useState(false);
 // The stage comes from real backend progress events; no fake percentages.
 const steps=[
  {label:'准备简历',detail:'解析简历并准备本次匹配材料'},
  {label:'搜索真实岗位',detail:'正在检索中国大陆的企业招聘入口'},
  {label:'研究岗位证据',detail:'核对来源、职责与任职要求'},
  {label:'生成评分和推荐',detail:'逐岗位比较真实经历并提出投递建议'}
 ];
 const progressStep=progressStage==='preparing'?0:
  ['connected','searching'].includes(progressStage)?1:
  ['reading','researching'].includes(progressStage)?2:
  ['writing','scoring'].includes(progressStage)?3:1;
 const matchListScroll=useRef(0);
 const activeJob=result.matches.find(job=>job.id===optimizedJobId);
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
  if(viewport)viewport.scrollTop=optimizedJobId?0:matchListScroll.current;
 },[optimizedJobId]);
 function backToMatches(){
  if(optimizationDirty&&!window.confirm('这份岗位简历有尚未保存的文字草稿。返回后草稿可能丢失，确定返回岗位匹配结果吗？'))return;
  setOptimizationDirty(false);setOptimizedJobId(null);
 }
 function handleClose(){
  if(optimizedJobId){backToMatches();return}
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
   <div className={'hhba-match-modal'+(optimizedJobId?' hhba-match-modal-editor':'')} role="dialog" aria-modal="true" tabIndex={-1}
    ref={ref} onKeyDown={handleKey} aria-labelledby="hhba-native-title">
    <header className={'hhba-match-modal-head'+(optimizedJobId&&sourceResume?' hhba-word-editor-head':'')}>
     {optimizedJobId&&sourceResume&&activeJob?
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
       <div><strong>汇方职场 · HHBA</strong><small>DeepSeek Search + V4 Pro 智能岗位推荐</small></div>
      </div>}
     <div className="hhba-word-editor-head-actions">
      {optimizedJobId&&sourceResume&&<span id="hhba-word-top-download" />}
      <button type="button" className="hhba-match-modal-close"
       onClick={optimizedJobId&&sourceResume?()=>{
        if(!optimizationDirty||window.confirm('简历还有未保存的文字草稿，关闭后可能丢失。确定关闭吗？'))onClose();
       }:handleClose}
       aria-label={optimizedJobId&&sourceResume?'关闭简历编辑':'关闭推荐'}><X size={19}/></button>
     </div>
    </header>
    <div className="hhba-match-modal-content" data-hhba-stage={optimizedJobId?'optimization':'matches'}>
     {pending&&<section className={'hhba-match-live-progress'+(result.matches.length?' is-compact':'')} role="status" aria-live="polite">
      <div className="hhba-match-live-heading">
       <span className="hhba-match-live-sparkle"><Sparkles size={20} aria-hidden="true"/></span>
       <div><h2 id={result.matches.length?undefined:'hhba-native-title'}>
        {result.matches.length?'已发现 '+result.matches.length+' 个候选岗位':'正在为你寻找合适的工作机会'}
       </h2><p>搜索、岗位研究和推荐分析都在这个窗口进行，结果会陆续出现。</p></div>
      </div>
      <div className="hhba-match-live-rail" aria-hidden="true"><span/></div>
      <ol className="hhba-match-live-steps">
       {steps.map((step,i)=><li key={step.label} className={i<progressStep?'is-done':i===progressStep?'is-active':'is-upcoming'}>
        <span className="hhba-match-live-marker">
         {i<progressStep?<Check size={15}/>:i===progressStep?<LoaderCircle size={16} className="spin"/>:String(i+1)}
        </span>
        <div><strong>{step.label}</strong><small>{step.detail}</small></div>
       </li>)}
      </ol>
      <p className="hhba-match-live-footnote">进度根据后台实际阶段变化，不伪造完成百分比；以企业官方公告为准。</p>
     </section>}
     {pending&&result.matches.length===0?null:activeJob&&parsedProfile?
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
       {!sourceResume&&<div className="hhba-match-word-note" role="note">
        当前可以核对岗位定向优化内容。原 Word 版式编辑和独立的 DOCX/PDF 修订，
        需要先在「我的简历」私有保存 DOCX 原文件；不会擅自创建另一种排版。
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
         accountScope={accountScope} sourceResume={sourceResume}
         onDraftDirtyChange={setOptimizationDirty}/>
       </Suspense>
       {!sourceResume&&<p className="hhba-match-apply-last">
        处理完简历后可返回原岗位匹配结果，在原卡片上前往企业官网自行投递。
       </p>}
      </section>:<>
     <div className="hhba-match-intro">
      <span className="hhba-match-eyebrow"><Search size={14} style={{verticalAlign:'-2px',marginRight:5}}/> AI 搜索真实岗位并匹配简历</span>
      <h2 id="hhba-native-title">根据你的简历，已找到 {result.matches.length} 个岗位{pending?'（继续搜索中）':''}</h2>
      <p>适配分仅供比较，不是录用概率。只展示中国大陆企业招聘岗位，不提供第三方招聘平台链接。{pending?'结果正在陆续生成，下方岗位可先查看。':'以下岗位网址来自 DeepSeek Search 结果，推荐原因由 V4 Pro 根据简历生成。'}</p>
     </div>
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
        <article key={job.id} className="hhba-native-job">
         <div className="hhba-native-top">
          <span className="hhba-native-num">{String(i+1).padStart(2,'0')}</span>
          <div className="hhba-native-heading">
           <strong>{job.company}</strong>
           <h3>{job.title_zh||job.title}</h3>
           <div className="hhba-native-meta"><span><MapPin size={13}/>{job.location}</span>
            {job.salary&&<span><Wallet size={13}/>{job.salary}</span>}</div>
           <div className="hhba-native-source" role="note">
            {job.jd_source_status==='VERIFIED_JD'?'已核验岗位 JD 原文 · '+(job.jd_score_status==='V2_JD_EVIDENCE_SCORED'?'按岗位要求评分':'简历证据仍需补充'):
             job.evidence_status==='PARTIAL_SOURCE'?'已研究部分公开岗位证据 · 非完整 JD':
             job.evidence_status==='SEARCH_SNIPPET_ONLY'?(job.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED'?'岗位方向参考分 · 任职条件待核实':'只有公开搜索摘要 · 暂不评分'):
             job.evidence_status==='INSUFFICIENT_EVIDENCE'?'岗位要求证据不足 · 暂不评分':
             job.recruitment_source_note||'招聘来源待确认'}
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
            <><strong>{visibleMatchScore(job)}<small>/100</small></strong><span>{job.jd_score_status==='V2_JD_EVIDENCE_SCORED'?'JD 证据适配分':job.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED'?'方向参考分':'初步适配分 · AI 参考'}</span></>:
            <><strong className="hhba-native-score-na">—</strong><span>暂无可靠分数</span></>}
           <button type="button" disabled={pending}
             title={pending?'搜索完成后即可针对这个岗位优化简历':'针对所选岗位优化简历'}
             className="hhba-native-optimize" onClick={()=>{
              matchListScroll.current=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content')?.scrollTop||0;
              setOptimizationDirty(false);setOptimizedJobId(job.id);
             }} aria-label={'针对'+(job.title_zh||job.title)+'优化简历'}>
             <Sparkles size={13} aria-hidden="true"/> 优化简历
            </button>
          </div>
         </div>
         {job.score_basis&&visibleMatchScore(job)!==null&&
          <p className="hhba-native-score-basis"><strong>评分依据：</strong>{job.score_basis}</p>}
         <p className="hhba-native-reason"><strong>为什么推荐：</strong>
          {(job.recommendation_reason||job.matched?.[0]||'请结合简历和招聘详情自行判断。').replace(/([②③])/g,'\n$1')}</p>
         <a className="hhba-native-apply" href={job.official_url} target="_blank" rel="noopener noreferrer"
          data-hhba-recruitment-outbound="true">{job.recruitment_source_kind==='EMPLOYER_ATS'?
            '查看企业专属招聘系统岗位（请核验）':'查看企业招聘岗位页面（请核验）'} <ArrowUpRight size={15}/></a>
        </article>
       ))}
      </div>:
      <div className="hhba-match-empty"><BriefcaseBusiness size={23}/>
       <h3>本轮没有找到符合条件的具体职位链接</h3>
       <p>本轮未找到符合条件的企业招聘站岗位。已排除第三方招聘平台，数量不足也不会用它们补齐。</p>
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
     <p className="hhba-match-disclaimer">{result.disclaimer||'职位信息由 DeepSeek 联网检索提供，HHBA 未逐条人工复核。岗位是否仍开放、任职要求及薪资以原始网页为准；不会自动投递。'}</p>
     </>}
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 让机会与人才，找到彼此。</span>
     <button className="hhba-match-done" type="button" onClick={handleClose}>{optimizedJobId?'返回匹配结果':pending?'取消搜索':'完成查看'}</button>
    </footer>
   </div>
  </div>,document.body);
}
