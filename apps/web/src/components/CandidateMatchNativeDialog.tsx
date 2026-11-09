import {useEffect,useRef,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,BriefcaseBusiness,MapPin,Wallet,X,Search} from 'lucide-react';
import type {MatchResponse} from '../services/resumeMatch';
import '../styles/resume-match-dialog.css';

// The model researches and ranks; the UI never re-ranks or hides English job titles.
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
      <div><strong>汇方职场 · HHBA</strong><small>DeepSeek V4 Pro 智能岗位推荐</small></div>
     </div>
     <button type="button" className="hhba-match-modal-close" onClick={onClose} aria-label="关闭推荐">
      <X size={19}/>
     </button>
    </header>
    <div className="hhba-match-modal-content">
     <div className="hhba-match-intro">
      <span className="hhba-match-eyebrow"><Search size={14} style={{verticalAlign:'-2px',marginRight:5}}/> AI 自主联网找工作</span>
      <h2 id="hhba-native-title">根据你的简历，已找到 {result.matches.length} 个岗位{pending?'（继续搜索中）':''}</h2>
      <p>只展示中国大陆工作岗位。{pending?'结果正在陆续生成，下方岗位可先查看。':'以下是 DeepSeek 自主搜索并解释的推荐结果。'}</p>
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
          </div>
         </div>
         <p className="hhba-native-reason"><strong>为什么推荐：</strong>
          {(job.recommendation_reason||job.matched?.[0]||'请结合简历和招聘详情自行判断。').replace(/([②③])/g,'\n$1')}</p>
         <a className="hhba-native-apply" href={job.official_url} target="_blank" rel="noopener noreferrer"
          data-hhba-recruitment-outbound="true">查看岗位原始链接 <ArrowUpRight size={15}/></a>
        </article>
       ))}
      </div>:
      <div className="hhba-match-empty"><BriefcaseBusiness size={23}/>
       <h3>本轮没有找到符合条件的具体职位链接</h3>
       <p>这不代表你没有合适的工作。返回后可以调整目标岗位，再重新搜索。</p>
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
