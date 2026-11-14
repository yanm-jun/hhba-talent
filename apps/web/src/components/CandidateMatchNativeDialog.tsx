import {useEffect,useRef,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,BriefcaseBusiness,CheckCircle2,Circle,LoaderCircle,MapPin,Wallet,X,Search} from 'lucide-react';
import type {MatchResponse} from '../services/resumeMatch';
import {Link} from '../router';
import '../styles/resume-match-dialog.css';

// Search-first evidence governs links; server scores and ranks. Never present a score as an offer probability.
type ResumeStorageAction={available:boolean;saved:boolean;consent:boolean;saving:boolean;
 notice:string;onConsent:(yes:boolean)=>void;onSave:()=>void};
export function CandidateMatchNativeDialog({result,onClose,pending=false,notice='',stage='preparing',elapsedSeconds=0,resumeStorage}:{
 result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,
  'profile'|'disclaimer'|'history_id'|'history_status'|'new_job_count'|'improved_job_count'>>;
 onClose:()=>void;pending?:boolean;notice?:string;stage?:'preparing'|'connected'|'searching'|'reading'|'writing'|'waiting';elapsedSeconds?:number;resumeStorage?:ResumeStorageAction
}){
 const ref=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  const overflow=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';ref.current?.focus();
  return()=>{document.body.style.overflow=overflow;trigger?.focus()};
 },[]);
 function handleKey(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();onClose();return}
  if(event.key!=='Tab'||!ref.current)return;
  const focusable=Array.from(ref.current.querySelectorAll<HTMLElement>(
   'button:not([disabled]),a[href]'
  )).filter(el=>el.getClientRects().length>0);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
 return createPortal(
  <div className="hhba-match-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <div className="hhba-match-modal" role="dialog" aria-modal="true" tabIndex={-1}
    ref={ref} onKeyDown={handleKey} aria-labelledby="hhba-native-title">
    <header className="hhba-match-modal-head">
     <div className="hhba-match-modal-brand">
      <span className="hhba-match-modal-symbol"><BriefcaseBusiness size={19}/></span>
      <div><strong>汇方职场 · HHBA</strong><small>DeepSeek 自主联网深度搜索 · 智能岗位推荐</small></div>
     </div>
     <button type="button" className="hhba-match-modal-close" onClick={onClose} aria-label="关闭推荐">
      <X size={19}/>
     </button>
    </header>
    <div className="hhba-match-modal-content">
     <div className="hhba-match-intro">
      <span className="hhba-match-eyebrow"><Search size={14} style={{verticalAlign:'-2px',marginRight:5}}/> AI 搜索真实岗位并匹配简历</span>
      <h2 id="hhba-native-title">根据你的简历，已找到 {result.matches.length} 个岗位{pending?'（继续搜索中）':''}</h2>
      <p>适配分仅供比较，不是录用概率。只展示中国大陆企业招聘岗位，不提供第三方招聘平台链接。{pending?'结果正在陆续生成，下方岗位可先查看。':'以下岗位网址来自 DeepSeek Search 结果，推荐原因由 V4 Pro 根据简历生成。'}</p>
     </div>
     {pending&&(()=>{
      const steps=[
       {label:'准备简历与搜索任务',detail:'提取求职方向，准备安全检索'},
       {label:'搜索企业招聘来源',detail:'优先查找中国大陆企业官网与专属招聘系统'},
       {label:'读取岗位详情',detail:'核对岗位名称、地点与招聘页面证据'},
       {label:'分析匹配度并整理推荐',detail:'结合简历经历生成匹配依据与注意事项'}
      ];
      const rank={preparing:0,connected:0,searching:1,reading:2,writing:3,waiting:1};
      const active=rank[stage],progress=[12,36,62,86][active];
      const current=stage==='waiting'?'DeepSeek 仍在处理，暂未收到新的阶段事件':stage==='connected'?'已连接搜索服务，正在准备检索':stage==='searching'?'DeepSeek 深度思考搜索正在核实中国大陆招聘岗位':steps[active].label;
      return <section className="hhba-match-progress" role="status" aria-live="polite" aria-label="智能匹配实时进度">
       <div className="hhba-match-progress-head"><div><strong>正在为你寻找合适的工作</strong><span>{result.matches.length?'已找到 '+result.matches.length+' 个候选岗位':'搜索进行中'}</span></div><time>{elapsedSeconds} 秒</time></div>
       <div className="hhba-match-progress-value"><strong>{progress}%</strong><small>流程阶段</small></div>
       <div className="hhba-match-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={current}><span style={{width:progress+'%'}}/></div>
       <p className="hhba-match-progress-current"><LoaderCircle size={15} className="spin"/>{current}</p>
       <ol className="hhba-match-progress-steps">{steps.map((item,index)=><li key={item.label} className={index<active?'done':index===active?'active':''}>
        {index<active?<CheckCircle2 size={17}/>:index===active?<LoaderCircle size={17} className="spin"/>:<Circle size={17}/>}
        <div><strong>{item.label}</strong><small>{item.detail}</small></div>
       </li>)}</ol>
       <p className="hhba-match-progress-note">{result.matches.length?'已取得的岗位会先行展示，后续搜索继续补充。':'进度根据服务端实际返回的阶段事件更新；等待期间不会虚构搜索进度。'}</p>
      </section>;
     })()}
     {!pending&&result.profile&&result.profile.skills.length>0&&<section className="hhba-match-profile-hints">
      <strong>本次识别到的简历能力线索</strong>
      <div>{result.profile.skills.map(item=><span key={item.name}>{item.name}</span>)}</div>
      <small>这些线索用于扩展岗位搜索和辅助匹配，不代表额外资质；最终以简历原文和岗位要求为准。</small>
     </section>}
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
            {job.recruitment_source_note||'招聘来源待确认'}
           </div>
           <div className="hhba-native-availability" role="note">
            <span className={job.availability_status==='OPEN_LISTED'?'hhba-native-state-open':'hhba-native-state-unknown'}>
             {job.availability_status==='OPEN_LISTED'?'网页显示在招 · 仍需确认':'投递状态未确认'}
            </span>
            <small>{job.availability_status==='OPEN_LISTED'?
             '页面文本提示开放申请，是否可提交仍以招聘官网为准':'链接来自搜索结果，可能已过期或需要登录；请打开官网确认'}</small>
           </div>
          </div>
          <div className="hhba-native-score" aria-label={Number.isInteger(job.match_score)?'简历适配分 '+job.match_score+' 分':'适配分证据不足'}>
           {Number.isInteger(job.match_score)?
            <><strong>{job.match_score}<small>/100</small></strong><span>简历适配分</span></>:
            <><strong className="hhba-native-score-na">—</strong><span>待补充证据</span></>}
          </div>
         </div>
         {job.score_basis&&Number.isInteger(job.match_score)&&
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
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 让机会与人才，找到彼此。</span>
     <button className="hhba-match-done" type="button" onClick={onClose}>完成查看</button>
    </footer>
   </div>
  </div>,document.body);
}
