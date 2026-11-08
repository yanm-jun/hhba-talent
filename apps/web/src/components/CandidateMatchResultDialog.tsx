import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {fuseDomesticJobRecommendations} from '../../functions/_lib/domestic-match-fusion.js';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,FileText,TriangleAlert,X} from 'lucide-react';
import {Link} from '../router';
import {safeOfficialJobUrl} from '../services/liveRecruitment';
import {safeExternalJobApplicationUrl,externalDomesticSearchReady,discoverExternalDomesticJobs,type MatchResponse,type MatchedJob} from '../services/resumeMatch';
import '../styles/resume-match-dialog.css';

const educationNames:Record<string,string>={
 HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'
};
function Evidence({title,items,variant}:{
 title:string;items:string[];variant:'match'|'gap'|'note'
}){
 return <section className={'hhba-match-evidence hhba-match-evidence-'+variant}>
  <h4>{variant==='match'?<CheckCircle2 size={15}/>:variant==='gap'?<TriangleAlert size={15}/>:<FileText size={15}/>}
   {title}</h4>
  {items.length?<ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:
   <p>简历和公开资料暂无足够依据</p>}
 </section>;
}
function JobRow({item,index,expanded,onToggle}:{
 item:MatchedJob;index:number;expanded:boolean;onToggle:()=>void
}){
 const isExternal=item.source_type==='站外官方招聘';
 const isAtsTenant=isExternal&&item.source_level==='VERIFIED_ATS_TENANT_ONLY';
 const verified=isExternal?safeExternalJobApplicationUrl(item):safeOfficialJobUrl({
  id:item.id,source:item.source,platform:item.platform,company:item.company,
  title:item.title,url:item.official_url,location:item.location,remote:item.remote
 });
 return <article className={'hhba-match-job'+(expanded?' expanded':'')}>
  <button type="button" className="hhba-match-job-toggle" aria-expanded={expanded}
   aria-controls={'hhba-match-job-'+index} onClick={onToggle}>
   <span className="hhba-match-job-index">{String(index).padStart(2,'0')}</span>
   <span className="hhba-match-job-primary">
    <strong>{item.title_zh||item.title}</strong>
    <small>{item.company} · {item.location||'中国大陆 · 地点待核实'} · <span className={isExternal?'hhba-match-source-external':'hhba-match-source-internal'}>{isAtsTenant?'站外招聘系统 · 企业及开放状态待核实':isExternal?'站外企业招聘页 · 待核实开放':'HHBA 站内'}</span></small>
   </span>
   <span className="hhba-match-job-score"><strong>{item.reference_score}</strong><small>参考相关度</small></span>
   <ChevronDown size={17} className={expanded?'hhba-match-job-chevron open':'hhba-match-job-chevron'}/>
  </button>
  {expanded&&<div id={'hhba-match-job-'+index} className="hhba-match-job-details">
   <p className="hhba-match-job-disclaimer">{isAtsTenant?'已读取招聘系统租户的职位详情；尚未独立核实企业法律主体归属及当前开放状态。':isExternal?'已读取企业招聘域名的职位详情；是否仍接受申请需到官网核实。':'已通过 HHBA 官方岗位来源审核，是否仍在招聘以企业官网为准。'} 分数不是录用概率。</p>
   <div className="hhba-match-job-evidence">
    <Evidence title="匹配依据" items={item.matched||[]} variant="match"/>
    <Evidence title="尚待证明" items={item.not_evidenced||[]} variant="gap"/>
    <Evidence title="需要核验" items={item.needs_verification||[]} variant="note"/>
   </div>
   <div className="hhba-match-job-links">
    {!isExternal&&<Link to={'/candidate/jobs/'+encodeURIComponent(item.id)}>查看 HHBA 岗位资料</Link>}
    {verified?<a href={verified} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">
      打开企业招聘页 <ArrowRight size={15}/></a>:<span>该岗位没有通过安全验证的外部链接</span>}
   </div>
  </div>}
 </article>;
}
export function CandidateMatchResultDialog({result,onClose,roleHint=''}:{
 result:MatchResponse;onClose:()=>void;roleHint?:string
}){
 const dialogRef=useRef<HTMLDivElement|null>(null);
 const [expandedId,setExpandedId]=useState<string|null>(null);
 const [displayMatches,setDisplayMatches]=useState<MatchedJob[]>(result.matches);
 const [externalAvailable,setExternalAvailable]=useState(false);
 const [externalBusy,setExternalBusy]=useState(false);
 const [externalRequested,setExternalRequested]=useState(false);
 const [externalMessage,setExternalMessage]=useState('');
 const externalController=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  void externalDomesticSearchReady(abort.signal).then(value=>{
   if(!abort.signal.aborted)setExternalAvailable(value);
  });
  return()=>abort.abort();
 },[]);
 useEffect(()=>()=>{externalController.current?.abort();},[]);
 async function findMoreDomesticJobs(){
  if(externalBusy||externalRequested)return;
  const role=(roleHint.trim()||result.profile.target_roles[0]||'').slice(0,42);
  if(!role){setExternalMessage('请返回填写目标岗位方向，例如“数据分析”，再使用站外搜索。');return;}
  setExternalBusy(true);setExternalMessage('');
  const abort=new AbortController();
  externalController.current=abort;
  try{
   // This intentional user click authorizes an external official-site search.
   // Only a short role name is sent; never the resume, skills evidence or PII.
   const found=await discoverExternalDomesticJobs(role,abort.signal);
   if(abort.signal.aborted)return;
   const fused=fuseDomesticJobRecommendations(
    result.matches,found.candidates,result.profile,{role_hint:role,limit:10}
   );
   setDisplayMatches(fused.matches);
   setExpandedId(null);
   setExternalRequested(true);
   setExternalMessage(
    fused.counts.selected_external?
     '已合并 '+fused.counts.selected_external+' 条有招聘详情证据的站外候选；企业归属和开放状态请在原招聘页确认。':
     '本次未找到通过职位正文、来源及工作地点核验的站外候选，已保留现有站内结果。'
   );
  }catch(e){
   if((e as Error)?.name!=='AbortError')
    setExternalMessage(e instanceof Error?e.message:'站外搜索暂时失败，已保留现有站内结果。');
  }finally{setExternalBusy(false);externalController.current=null;}
 }
 useEffect(()=>{
  const previous=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';
  dialogRef.current?.focus();
  return()=>{document.body.style.overflow=previous;trigger?.focus();};
 },[]);
 function onKeyDown(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();onClose();return;}
  if(event.key!=='Tab'||!dialogRef.current)return;
  const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
   'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
  )).filter(element=>element.getClientRects().length>0);
  if(!focusable.length){event.preventDefault();dialogRef.current.focus();return;}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){
   event.preventDefault();first.focus();
  }
 }
 return createPortal(
  <div className="hhba-match-overlay" role="presentation"
   onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <div className="hhba-match-modal" role="dialog" aria-modal="true" aria-labelledby="hhba-match-dialog-title"
    ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown}>
    <header className="hhba-match-modal-head">
     <div><span className="hhba-match-modal-eyebrow">HHBA · 中国大陆岗位匹配</span>
      <h2 id="hhba-match-dialog-title">能力画像与岗位推荐</h2>
      <p>已完成分析 · 国内岗位 {displayMatches.length} 条 · 仅本次浏览可见</p>
     </div>
     <button type="button" className="hhba-match-modal-close" aria-label="关闭结果，返回简历匹配" onClick={onClose}>
      <X size={20}/></button>
    </header>
    <div className="hhba-match-modal-content">
     <section className="hhba-match-profile" aria-label="简历能力画像">
      <div className="hhba-match-profile-grid">
       <div><small>学历</small><strong>{educationNames[result.profile.education||'']||'未确认'}</strong></div>
       <div><small>工作经验</small><strong>{result.profile.experience_years===null?'未确认':result.profile.experience_years+' 年'}</strong></div>
       <div><small>岗位方向</small><strong>{result.profile.target_roles.length?result.profile.target_roles.slice(0,2).join('、'):'按技能匹配'}</strong></div>
      </div>
      <div className="hhba-match-profile-skills"><span>技能</span><div>
       {result.profile.skills.length?result.profile.skills.slice(0,9).map(s=><small key={s.name} title={s.evidence}>{s.name}</small>):
        <em>暂未识别出可核验的技能</em>}
      </div></div>
     </section>
     {externalAvailable&&<section className="hhba-match-external-search" aria-label="站外官方职位补充">
      <div>
       <strong>想看看更多国内企业吗？</strong>
       <p>动态搜索国内企业与专业招聘系统，只发送岗位方向，不发送姓名、电话或简历；每次最多 5 次 Search、10 次 Fetch（理论最高 ¥0.075），优先复用 24 小时内的公开结果。</p>
      </div>
      <button type="button" disabled={externalBusy||externalRequested}
       onClick={()=>void findMoreDomesticJobs()}>
       {externalBusy?'正在搜索官方职位…':externalRequested?'本次已搜索':'补充站外官方岗位'}
      </button>
     </section>}
     {externalMessage&&<p className="hhba-match-external-message" role="status">{externalMessage}</p>}
     <div className="hhba-match-list-title"><h3>中国大陆岗位推荐</h3><small>点击职位展开详情</small></div>
     {displayMatches.length?
      <div className="hhba-match-job-list">{displayMatches.map((job,i)=>
       <JobRow key={job.id} item={job} index={i+1} expanded={expandedId===job.id}
        onToggle={()=>setExpandedId(old=>old===job.id?null:job.id)}/>)}</div>:
      <div className="hhba-match-no-jobs">
       <strong>当前没有符合要求且来源可核验的国内岗位</strong>
       <p>不会使用境外职位、过期岗位或虚构职位补足十条。国内招聘源正在继续核验，你可以返回修改求职方向。</p>
       <Link to="/candidate/jobs">查看站内国内招聘资料 <ArrowRight size={14}/></Link>
      </div>}
     <p className="hhba-match-disclaimer">参考相关度仅用于排序，不是录用、面试或成功率预测。职位是否仍在招聘，需打开官方页面确认。</p>
    </div>
    <footer className="hhba-match-modal-foot">
     <button type="button" className="hhba-match-return" onClick={onClose}><ArrowLeft size={16}/> 返回修改</button>
     <button type="button" className="hhba-match-done" onClick={onClose}>关闭结果 <X size={15}/></button>
    </footer>
   </div>
  </div>,document.body
 );
}
