import {useEffect,useRef,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,BriefcaseBusiness,MapPin,Wallet,X,Search} from 'lucide-react';
import type {MatchResponse} from '../services/resumeMatch';
import '../styles/resume-match-dialog.css';

// Search-first evidence governs links; server scores and ranks. Never present a score as an offer probability.
export function CandidateMatchNativeDialog({result,onClose,pending=false,notice=''}:{result:Pick<MatchResponse,'matches'>&Partial<Pick<MatchResponse,'disclaimer'>>;onClose:()=>void;pending?:boolean;notice?:string}){
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
      <div><strong>汇方职场 · HHBA</strong><small>DeepSeek Search + V4 Pro 智能岗位推荐</small></div>
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
     {notice&&<p className="hhba-match-disclaimer" role="alert">{notice} 已显示本次收到的岗位；请核对招聘原始页面。</p>}
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
     <p className="hhba-match-disclaimer">{result.disclaimer||'职位信息由 DeepSeek 联网检索提供，HHBA 未逐条人工复核。岗位是否仍开放、任职要求及薪资以原始网页为准；不会自动投递。'}</p>
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 让机会与人才，找到彼此。</span>
     <button className="hhba-match-done" type="button" onClick={onClose}>完成查看</button>
    </footer>
   </div>
  </div>,document.body);
}
