import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,BriefcaseBusiness,MapPin,Wallet,X,Search} from 'lucide-react';
import type {MatchResponse} from '../services/resumeMatch';
import type {PrivateResume} from '../services/privateResumes';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {TargetedResumeOptimization} from './TargetedResumeOptimization';
import {CandidateJourneySteps} from './CandidateJourneySteps';
import {officialApplicationUrl,officialLinkLabel} from '../services/officialApplicationUrl.mjs';
import {Link} from '../router';
import '../styles/resume-match-dialog.css';

// Search-first evidence governs links; server scores and ranks. Never present a score as an offer probability.
type ResumeStorageAction={available:boolean;saved:boolean;consent:boolean;saving:boolean;
 notice:string;onConsent:(yes:boolean)=>void;onSave:()=>void};
export function CandidateMatchNativeDialog({result,onClose,pending=false,notice='',resumeStorage,sourceText,sourceResume,accountScope}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'disclaimer'|'history_id'|'history_status'|'new_job_count'|'improved_job_count'|'profile'>>;
 onClose:()=>void;pending?:boolean;notice?:string;resumeStorage?:ResumeStorageAction;sourceText?:string;sourceResume?:PrivateResume;accountScope?:string
}){
 const ref=useRef<HTMLDivElement|null>(null);
 const [optimizedJobId,setOptimizedJobId]=useState<string|null>(null);
 const [optimizationDirty,setOptimizationDirty]=useState(false);
 const activeJob=result.matches.find(job=>job.id===optimizedJobId);
 // The result list and document editor share a scrollable dialog. Always
 // start a newly selected job at its own header and Word canvas rather than
 // inheriting the prior card-list scroll position (especially on phones).
 useEffect(()=>{
  const viewport=ref.current?.querySelector<HTMLElement>('.hhba-match-modal-content');
  if(viewport)viewport.scrollTop=0;
 },[optimizedJobId]);
 function confirmExitOptimization(){
  return !optimizationDirty||window.confirm('仍有尚未保存的简历文字草稿。退出后这些草稿可能丢失，确定离开吗？');
 }
 function backToMatches(){
  if(!confirmExitOptimization())return;
  setOptimizedJobId(null);setOptimizationDirty(false);
 }
 function requestClose(){
  if(!confirmExitOptimization())return;
  onClose();
 }
 useEffect(()=>{
  const overflow=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';ref.current?.focus();
  return()=>{document.body.style.overflow=overflow;trigger?.focus()};
 },[]);
 function handleKey(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();requestClose();return}
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
 const parsedProfile=result.profile?({
  ...result.profile,experiences:[]
 } as CandidateProfile):null;
 function asTargetJob(job:MatchResponse['matches'][number]):JobMatch{
  return {
   id:job.id,company:job.company,title:job.title,title_zh:job.title_zh||null,
   location:job.location,official_url:job.official_url,platform:job.platform,
   remote:job.remote,reference_score:Number.isInteger(job.match_score)?job.match_score!:job.reference_score,
   matched:job.matched||[],not_evidenced:job.not_evidenced||[],
   needs_verification:job.needs_verification||[],
   requirements_basis:job.requirements_basis||job.score_basis||''
  };
 }
 return createPortal(
  <div className="hhba-match-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)requestClose()}}>
   <div className={'hhba-match-modal'+(activeJob?' hhba-match-modal-editor':'')} role="dialog" aria-modal="true" tabIndex={-1}
    ref={ref} onKeyDown={handleKey} aria-labelledby="hhba-native-title">
    <header className="hhba-match-modal-head">
     <div className="hhba-match-modal-brand">
      <span className="hhba-match-modal-symbol"><BriefcaseBusiness size={19}/></span>
      <div><strong>汇方职场 · HHBA</strong><small>为你找到的工作</small></div>
     </div>
     <button type="button" className="hhba-match-modal-close" onClick={requestClose} aria-label="关闭推荐">
      <X size={19}/>
     </button>
    </header>
    <div className="hhba-match-modal-content" data-hhba-stage={activeJob?'optimization':'matches'}>
     <CandidateJourneySteps current={activeJob?4:pending?2:3} compact/>
     {activeJob&&parsedProfile?
      <section className="hhba-match-workspace" aria-label="独立简历优化工作区">
       <button type="button" className="hhba-match-workspace-back" onClick={backToMatches}>
        返回岗位评分
       </button>
       <div className="hhba-match-selected-job">
        <div>
         <span>针对这个岗位优化简历</span>
         <h2 id="hhba-native-title">{activeJob.title_zh||activeJob.title}</h2>
         <p>{activeJob.company} · {activeJob.location}</p>
        </div>
        <div className="hhba-match-selected-score">
         <strong>{Number.isInteger(activeJob.match_score)?activeJob.match_score:'—'}<small>/100</small></strong>
         <span>原简历适配分 · 不是录用概率</span>
        </div>
       </div>
       {!sourceResume&&resumeStorage?.available&&<div className="hhba-match-save-resume hhba-match-word-onboarding">
        <strong>先保存 Word，才能保留原有排版</strong>
        <p>当前还没有把这份 Word 关联到你的私有简历库。
         授权保存后，本页会自动切换成原版式 Word 编辑，避免生成另一份不同排版的简历。</p>
        <label><input type="checkbox" checked={resumeStorage.consent} disabled={resumeStorage.saving}
         onChange={event=>resumeStorage.onConsent(event.target.checked)}/>
         我同意将该 Word 文件保存在我的 HHBA 私有简历库，AI 处理仍需另行授权。
        </label>
        <button type="button" disabled={!resumeStorage.consent||resumeStorage.saving}
         onClick={resumeStorage.onSave}>{resumeStorage.saving?'正在保存 Word…':'保存原 Word 并开始优化'}</button>
        {resumeStorage.notice&&<p role="status">{resumeStorage.notice}</p>}
       </div>}
       <TargetedResumeOptimization key={activeJob.id} profile={parsedProfile}
        job={asTargetJob(activeJob)} sourceText={sourceText} accountScope={accountScope}
        sourceResume={sourceResume} onDraftDirtyChange={setOptimizationDirty}/>
       <section className="hhba-match-apply-last" aria-label="最后一步：企业官网投递">
        <div className="hhba-match-apply-last-head">
         <span className="hhba-match-final-index">05</span>
         <div><h3>准备好简历后，前往企业官网投递</h3>
          <p>确认并下载针对该岗位的 Word。投递由你在企业招聘页面自行完成，HHBA 不会替你提交。</p></div>
        </div>
        {officialApplicationUrl(activeJob)?
         <a className="hhba-match-final-apply" href={officialApplicationUrl(activeJob)!}
          target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">
          {officialLinkLabel(activeJob)} <ArrowUpRight size={16}/>
         </a>:
         <p className="hhba-match-apply-unverified" role="status">
          这个岗位尚未提供可核验的企业招聘链接，暂不提供投递按钮，避免误入第三方招聘平台。
         </p>}
       </section>
      </section>:
     <>
     <div className="hhba-match-intro">
      <span className="hhba-match-eyebrow"><Search size={14} style={{verticalAlign:'-2px',marginRight:5}}/> 智能推荐</span>
      <h2 id="hhba-native-title">为你找到 {result.matches.length} 个适合评估的岗位{pending?' · 搜索中':''}</h2>
      <p>AI 已根据简历分析每个岗位的适配分。选择岗位，定向优化后可到企业招聘页投递。分数不是录用概率，不提供第三方招聘平台链接。</p>
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
            {job.recruitment_source_kind==='EMPLOYER_ATS'?
             '企业专属招聘系统 · 请核实':job.recruitment_source_note||'招聘来源待确认'}
           </div>
           <div className="hhba-native-availability" role="note">
            <span className={job.availability_status==='OPEN_LISTED'?'hhba-native-state-open':'hhba-native-state-unknown'}>
             {job.availability_status==='OPEN_LISTED'?'网页显示招聘中':'请核实是否招聘'}
            </span>
            <small>{job.availability_status==='OPEN_LISTED'?
             '请以企业官网为准':'请打开企业招聘页面确认'}</small>
           </div>
          </div>
          <div className="hhba-native-score" aria-label={Number.isInteger(job.match_score)?'简历适配分 '+job.match_score+' 分':'适配分证据不足'}>
           {Number.isInteger(job.match_score)?
            <><strong>{job.match_score}<small>/100</small></strong><span>简历适配分</span></>:
            <><strong className="hhba-native-score-na">—</strong><span>待补充证据</span></>}
           {!pending&&parsedProfile&&<div className="hhba-native-optimize-action">
            <button type="button" aria-label={'针对'+(job.title_zh||job.title)+'优化简历'}
             onClick={()=>{
              setOptimizationDirty(false);setOptimizedJobId(job.id);
             }}>优化简历 <span aria-hidden="true">✦</span></button>
           </div>}
          </div>
         </div>
         <p className="hhba-native-reason"><strong>为什么适合：</strong>{
          (job.recommendation_reason||job.matched?.[0]||'请结合简历和招聘详情自行判断。').slice(0,170)
         }{(job.recommendation_reason||'').length>170?'…':''}</p>
         {(job.score_basis||(job.recommendation_reason||'').length>170)&&
          <details className="hhba-native-job-more">
           <summary>查看完整评分依据和推荐分析</summary>
           {job.score_basis&&<p><strong>评分依据：</strong>{job.score_basis}</p>}
           {job.recommendation_reason&&<p>{job.recommendation_reason}</p>}
          </details>}
         {officialApplicationUrl(job)?
          <a className="hhba-native-apply" href={officialApplicationUrl(job)!}
           target="_blank" rel="noopener noreferrer"
           data-hhba-recruitment-outbound="true">
           不优化，直接查看企业招聘页 <ArrowUpRight size={15}/>
          </a>:
          <p className="hhba-native-no-official" role="note">
           暂未取得可核验的企业招聘链接，不提供第三方投递入口。
          </p>}
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
        我同意将这份 Word（.docx）原文件保存到当前账户的私有简历库（与本次 AI 分析授权分开）。</label>
       <button type="button" disabled={!resumeStorage.consent||resumeStorage.saving}
        onClick={resumeStorage.onSave}>{resumeStorage.saving?'正在私有保存…':'保存到我的简历'}</button>
      </div>}
     {!pending&&resumeStorage?.saved&&<p className="hhba-match-saved-resume">已选择账户中保存的简历，可在「我的简历」中继续管理。</p>}
     {resumeStorage?.notice&&<p className="hhba-match-saved-resume" role="status">{resumeStorage.notice}</p>}
     <p className="hhba-match-disclaimer">{result.disclaimer||'岗位信息可能变化，请以企业招聘页面为准。HHBA 不会自动投递你的简历。'}</p>
     </>}
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 让机会与人才，找到彼此。</span>
     <button className="hhba-match-done" type="button" onClick={activeJob?backToMatches:requestClose}>
      {activeJob?'返回推荐列表':'完成查看'}</button>
    </footer>
   </div>
  </div>,document.body);
}
