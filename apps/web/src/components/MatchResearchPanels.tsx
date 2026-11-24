import {RecruitmentSourceLinks,recruitmentText} from './RecruitmentSourceLinks';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,ChevronDown,ArrowUpRight,MapPin,Sparkles} from 'lucide-react';
import '../styles/resume-match-dialog.css';
import {CuratedJobReport} from './CuratedJobReport';
import type {MatchProfile,MatchResearchReport,MatchedJob,NativeMatchProgress,NativeMatchActivity} from '../services/resumeMatch';

const stages=[
 {label:'识别简历',english:'CAREER PROFILE',stages:['preparing','parsing']},
 {label:'搜索企业岗位',english:'CAREER RESEARCH',stages:['connected','planning','searching']},
 {label:'岗位研究与匹配',english:'MATCH REPORT',stages:['reading','researching','writing','scoring']}
];
export const matchStageIndex=(stage:NativeMatchProgress)=>stages.findIndex(s=>s.stages.includes(stage));
const safeLink=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
const confirmed=(job:MatchedJob)=>job.jd_source_status==='VERIFIED_JD'&&job.source_type==='站外官方招聘'&&!!job.evidence_excerpt?.trim();
const scoreGrounded=(job:MatchedJob)=>job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&job.match_score!=null;
function reportScore(job:MatchedJob){
 const value=job.match_score;
 if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=100)return value;
 if(value===undefined&&Number.isInteger(job.reference_score)&&job.reference_score>0&&job.reference_score<=100)return job.reference_score;
 return null;
}
function reportScoreLabel(job:MatchedJob){
 return confirmed(job)&&scoreGrounded(job)?'匹配参考分 · JD 原文依据':job.evidence_score_status==='AI_PARTIAL_SOURCE_SCORED'?'初步参考分 · 部分资料':job.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED'?'方向参考分 · 待核验':'匹配参考分 · 依据待核对';
}
function JobTitle({job}:{job:MatchedJob}){
 return <><strong>{job.company}</strong><span>{job.title_zh||job.title}</span><small><MapPin size={12} aria-hidden="true"/>{job.location}</small></>;
}
function OfficialLink({job}:{job:MatchedJob}){
 const href=confirmed(job)&&safeLink(job.official_url);
 return href?<a className="hhba-refined-source-link" href={href} target="_blank" rel="noopener noreferrer">查看官方招聘页面 <ArrowUpRight size={13}/></a>:null;
}
export function ReportPager({count,index,onChange,pending=false}:{count:number;index:number;onChange:(i:number)=>void;pending?:boolean}){
 const anchor=useRef<HTMLDivElement>(null);
 const [modal,setModal]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  setModal(anchor.current?.closest<HTMLElement>('.hhba-match-modal')??null);
 },[]);
 const change=(next:number)=>{
  if(next<0||next>=count)return;
  onChange(next);
  const viewport=anchor.current?.closest<HTMLElement>('.hhba-match-modal-content');
  if(viewport&&anchor.current)viewport.scrollTop+=anchor.current.getBoundingClientRect().top-viewport.getBoundingClientRect().top-12;
 };
 if(!count)return null;
 const previous=<button type="button" className="hhba-report-pager-side hhba-report-pager-prev" aria-label="上一个岗位" title="上一个岗位" disabled={index===0} onClick={()=>change(index-1)}><ChevronLeft size={20} aria-hidden="true"/></button>;
 const next=<button type="button" className="hhba-report-pager-side hhba-report-pager-next" aria-label="下一个岗位" title="下一个岗位" disabled={index>=count-1} onClick={()=>change(index+1)}><ChevronRight size={20} aria-hidden="true"/></button>;
 return <>
  <div ref={anchor} className="hhba-report-pager-anchor" aria-hidden="true"/>
  <nav className={'hhba-report-pager'+(modal?' hhba-report-pager-sticky':'')} aria-label="岗位切换">
   {!modal&&previous}
   <strong aria-live="polite" aria-atomic="true">{String(index+1).padStart(2,'0')} / {count}{pending&&<small>（持续更新）</small>}</strong>
   {!modal&&next}
  </nav>
  {modal&&createPortal(<div className="hhba-report-pager-overlay" role="group" aria-label="切换岗位">{previous}{next}</div>,modal)}
 </>;
}
function JdResearchContent({job,pending}:{job:MatchedJob;pending:boolean}){
 const official=confirmed(job),research=job.jd_research,requirements=job.requirements_basis?.trim(),excerpt=job.evidence_excerpt?.trim();
 return <>
  {requirements&&<section className="hhba-refined-section"><h3>{official?'岗位要求':'岗位要求线索（尚未确认）'}</h3><p>{recruitmentText(requirements)}</p></section>}
  {excerpt&&<section className="hhba-refined-section"><h3>{official?'完整 JD 原文':job.evidence_status==='VERIFIED_FULL_JD'||job.evidence_status==='PARTIAL_SOURCE'?'已读取的岗位资料（官方归属待确认）':'搜索所得岗位资料（尚未核验）'}</h3><p>{recruitmentText(excerpt)}</p></section>}
  {!official&&<>
   {!!research?.facts.length&&<section className="hhba-refined-section"><h3>公开资料研究整理</h3><p className="hhba-refined-note">以下为已读取的公开资料片段，不等同于完整官方 JD。同类岗位资料仅供参考。</p>{research.facts.map((fact,i)=><div className="hhba-fact-list" key={fact.url+'-'+i}><div><span>{String(i+1).padStart(2,'0')}</span><div><small>{fact.context==='same_job'?'AI 判断为本岗位相关资料 · 尚待官网确认':'企业或同类岗位参考资料'}</small><p>{recruitmentText(fact.quote)}</p></div></div></div>)}</section>}
   {research?.inference&&<section className="hhba-refined-section"><h3>AI 职业方向分析（非企业已确认要求）</h3><p className="hhba-refined-note">基于公开信息或岗位性质的研究推断，不代表本岗位实际职责、资格或录用条件。</p><p>{recruitmentText(research.inference)}</p></section>}
   <section className="hhba-refined-section"><h3>待进一步确认</h3>{research?.unknowns.length?<ul>{research.unknowns.map((v,i)=><li key={i}>{recruitmentText(v)}</li>)}</ul>:<p>{pending&&!research?'正在等待岗位资料研究，暂不能确认具体职责与任职要求。':'尚未取得可确认的完整官方 JD；实际职责、任职条件及招聘状态请以企业原始招聘页面为准。'}</p>}</section>
  </>}
  {research?.diagnostics.length?<details className="hhba-refined-details"><summary>岗位研究记录（{research.diagnostics.length} 项）</summary><ul>{research.diagnostics.map(code=><li key={code}>{code}</li>)}</ul>{research.checked_at&&<p className="hhba-refined-note">研究时间：{research.checked_at}</p>}</details>:null}
 </>;
}
export function MatchResearchPanels({profile,report,jobs,officialJobs,pending=false,progressStage='preparing',activity,elapsed,selection,onSelectionChange,onFollow,selectedJobUrl,onJobChange,onOptimize,optimizationAvailable=false}:{
 profile?:MatchProfile;report?:MatchResearchReport;jobs:MatchedJob[];officialJobs:MatchedJob[];pending?:boolean;progressStage?:NativeMatchProgress;
 activity?:NativeMatchActivity|null;elapsed?:number;selection?:number;onSelectionChange?:(i:number)=>void;onFollow?:()=>void;selectedJobUrl?:string|null;onJobChange?:(url:string)=>void;onOptimize?:(job:MatchedJob)=>void;optimizationAvailable?:boolean;
}){
 const id=useId();
 const [selected,setSelected]=useState(2);
 const [localJobUrl,setLocalJobUrl]=useState<string|null>(null);
 const [arrival,setArrival]=useState<string[]>([]);
 const [query,setQuery]=useState('');
 const reportSwipe=useRef<{x:number;y:number}|null>(null);
 const active=Math.max(0,Math.min(stages.length-1,selection??selected));
 const actual=matchStageIndex(progressStage);
 const parsed=report?.profile||profile;
 const all=useMemo(()=>{
  const merged=new Map<string,MatchedJob>();
  for(const job of [...jobs,...officialJobs]){
   const prior=merged.get(job.official_url);
   const preferred=prior&&confirmed(prior)&&!confirmed(job)?prior:job;
   merged.set(job.official_url,{...preferred,jd_research:preferred.jd_research||prior?.jd_research||job.jd_research});
  }
  return [...merged.values()];
 },[jobs,officialJobs]);
 // Remember observed arrival order, not a timer-generated or invented feed.
 useEffect(()=>{
  setArrival(old=>{
   const urls=new Set(all.map(j=>j.official_url));
   const kept=old.filter(url=>urls.has(url)),seen=new Set(kept);
   const next=[...kept,...all.filter(j=>!seen.has(j.official_url)).map(j=>j.official_url)];
   return next.length===old.length&&next.every((v,i)=>v===old[i])?old:next;
  });
 },[all]);
 const byUrl=useMemo(()=>new Map(all.map(j=>[j.official_url,j])),[all]);
 const recent=(arrival.length?arrival.map(u=>byUrl.get(u)).filter((j):j is MatchedJob=>!!j):all).slice(-3).reverse();
 const identified=!!(parsed&&(parsed.summary||parsed.facts?.length||parsed.skills?.length||parsed.target_roles?.length||parsed.education));
 const discovered=report?.discovered??all.length;
 const target=report?.candidate_target;
 const searching=pending&&actual===1;
 const ratio=target?Math.max(0,Math.min(100,discovered/target*100)):0;
 const companies=new Set(all.map(j=>j.company.trim()).filter(x=>x&&!/待核实|未知/.test(x))).size;
 const visible=all.filter(j=>[j.company,j.title,j.title_zh||'',j.location].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const verified=all.filter(confirmed);
 const officialUrls=new Set(officialJobs.map(j=>j.official_url));
 const jdItems=[...all].sort((a,b)=>Number(officialUrls.has(b.official_url))-Number(officialUrls.has(a.official_url))||(reportScore(b)??-1)-(reportScore(a)??-1)||Number(confirmed(b))-Number(confirmed(a)));
 const currentJdIndex=Math.max(0,jdItems.findIndex(j=>j.official_url===(selectedJobUrl??localJobUrl)));
 const jdJob=jdItems[currentJdIndex];
 const changeJob=(next:number)=>{
  const job=jdItems[next];if(!job)return;
  setLocalJobUrl(job.official_url);onJobChange?.(job.official_url);
 };
 const referenceCount=all.filter(j=>!officialUrls.has(j.official_url)&&reportScore(j)!==null).length;
 const empty=(message:string)=><p className="hhba-stage-empty">{message}</p>;
 const status=(i:number)=>!pending?'':actual===i?'正在处理':actual>i?'可查看已有成果':'查看已有成果';
 return <>
 <ol className="hhba-match-progress-steps hhba-refined-steps" aria-label="匹配进度及研究报告">
  {stages.map((step,i)=><li key={step.label} aria-current={pending&&actual===i?'step':undefined} data-selected={active===i}>
   <button type="button" className="hhba-stage-tab" aria-expanded={active===i} aria-controls={id}
    onClick={()=>{setSelected(i);onSelectionChange?.(i)}}><span className="hhba-step-no">0{i+1}</span><span className="hhba-step-copy">{step.label}<small>{status(i)||step.english}</small></span><ChevronDown size={13} aria-hidden="true"/></button>
  </li>)}
 </ol>
 <section id={id} className="hhba-stage-report hhba-refined-stage" aria-label={stages[active].label+'报告'} data-stage={active}>
  <header className="hhba-refined-header"><span className="hhba-refined-brand">HHBA</span><small>{stages[active].english}</small>{pending&&onFollow&&<button type="button" onClick={onFollow}>跟随进度</button>}</header>
  {active===0&&<>
   <div className="hhba-refined-title"><span>01 / CAREER PROFILE</span><h2>个人职业分析报告</h2><p>{identified?'根据本次简历实际内容整理的职业画像。':pending?'正在识别简历，分析成果返回后自动呈现。':'本次历史记录没有保存简历分析报告。'}</p></div>
   {identified&&parsed?<>
    {parsed.summary&&<section className="hhba-refined-section hhba-profile-overview"><h3>综合职业分析</h3><p>{parsed.summary}</p></section>}
    {(parsed.education||parsed.experience_years!=null)&&<div className="hhba-profile-metrics">
     {parsed.education&&<div><small>教育背景</small><strong>{parsed.education}</strong>{parsed.education_evidence&&<p>{parsed.education_evidence}</p>}</div>}
     {parsed.experience_years!=null&&<div><small>识别工作年限</small><strong>{parsed.experience_years}<small> 年</small></strong>{parsed.experience_evidence&&<p>{parsed.experience_evidence}</p>}</div>}
    </div>}
    {!!parsed.facts?.length&&<section className="hhba-refined-section"><h3>真实简历经历与成果</h3><div className="hhba-fact-list">{parsed.facts.map((fact,i)=><div key={fact.id||i}><span>{String(i+1).padStart(2,'0')}</span><p>{fact.quote}</p></div>)}</div></section>}
    {!!parsed.skills?.length&&<section className="hhba-refined-section"><h3>核心能力与原文依据</h3><div className="hhba-skill-list">{parsed.skills.map((skill,i)=><div key={i}><strong>{skill.name}</strong>{skill.evidence&&<p>{skill.evidence}</p>}</div>)}</div></section>}
    {!!parsed.target_roles?.length&&<section className="hhba-refined-section"><h3>AI 自主研究方向</h3><div className="hhba-stage-tags">{parsed.target_roles.map((role,i)=><span key={i}>{role}</span>)}</div></section>}
    {!!parsed.warnings?.length&&<p className="hhba-refined-note">{parsed.warnings.join('；')}</p>}
   </>:empty(pending?'等待本次简历分析结果。':'没有可展示的职业分析。')}
  </>}
  {active===1&&<>
   <div className="hhba-search-hero" data-live={searching}>
    <div className="hhba-search-live"><span aria-hidden="true" className="hhba-search-dot"/>{searching?'RESEARCH IN PROGRESS':pending?'RESEARCH RECORD':'RESEARCH RESULTS'}</div>
    <h2>{searching?'正在寻找你的下一份机会。':'你的职业机会研究'}</h2>
    <p className="hhba-search-subtitle">基于真实经历，探索更适合你的职业可能。</p>
    <div className="hhba-search-number" aria-live="polite"><span key={discovered}>{discovered}</span>{target&&<small> / {target}</small>}</div>
    <p className="hhba-search-number-label">已发现候选岗位 · 尚需核验</p>
    {target&&<div className="hhba-search-progress" role="progressbar" aria-label="候选岗位收集进度" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(discovered,target)}><div style={{width:ratio+'%'}}/></div>}
    <div className="hhba-search-activity" role="status"><span key={searching?activity?.message||'正在等待联网研究成果':pending?'正在处理后续研究阶段':'本次搜索记录已整理'}>{searching?activity?.message||'正在等待联网研究成果':pending?'正在处理后续研究阶段':'本次搜索记录已整理'}</span></div>
    <div className="hhba-search-meta"><span>研究轮次 <b>{report?.rounds.length??0}</b></span><span>已发现企业 <b>{companies}</b></span><span>排除商业来源 <b>{report?.excluded_count??0}</b></span>{pending&&elapsed!==undefined&&<span>已用时 <b>{elapsed}</b> 秒</span>}</div>
   </div>
   <section className="hhba-refined-section hhba-discovery-feed"><div className="hhba-refined-subhead"><h3>{pending?'最新发现':'候选岗位一览'}</h3><small>{pending?'LIVE DISCOVERY':'DISCOVERY'}</small></div>
    {recent.length?recent.map(job=><div className="hhba-discovery-item" key={job.official_url}><div><JobTitle job={job}/></div><span className={confirmed(job)?'hhba-source-confirmed':'hhba-source-pending'}>{confirmed(job)?'来源已核验':'待核验'}</span></div>):empty(pending?'等待实际搜索返回首批候选岗位。':'本次没有保留候选岗位。')}
   </section>
   <details className="hhba-refined-details"><summary>实际研究记录（{report?.rounds.length??0} 轮）</summary>
    {report?.rounds.map(r=><details key={r.round}><summary>第 {r.round} 轮 · 新增 {r.added} 个候选 · {r.cited_count} 条非商业平台引用</summary>
     {r.queries.length?<ul>{r.queries.map((q,i)=><li key={i}>{q}</li>)}</ul>:<p>接口未返回本轮具体检索词。</p>}</details>)}
   </details>
   <details className="hhba-refined-details"><summary>全部已收到候选岗位（{all.length}）</summary><label className="hhba-refined-filter"><span>筛选企业、岗位或地点</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索本次候选记录"/></label>
    {visible.length?visible.map(job=><div className="hhba-discovery-item" key={job.official_url}><div><JobTitle job={job}/><OfficialLink job={job}/></div><small>{confirmed(job)?'来源已核验':'待核验'}</small></div>):empty('没有对应的候选记录。')}
   </details>
  </>}
  {active===2&&<>
   <div className="hhba-refined-title"><span>03 / MATCH REPORT</span><h2>岗位研究与匹配报告</h2><p>查看岗位资料、匹配参考分及招聘来源。匹配分用于求职参考，不是录用概率。</p></div>
   <div className="hhba-refined-metrics hhba-score-metrics"><div><small>已收到岗位</small><strong>{all.length}</strong></div><div><small>正式推荐</small><strong>{officialJobs.length}{report?.final_target?<em> / {report.final_target}</em>:null}</strong></div><div><small>其他已评分岗位</small><strong>{referenceCount}</strong></div></div>
   {jdJob?<><ReportPager count={jdItems.length} index={currentJdIndex} onChange={changeJob} pending={pending}/><article className="hhba-verified-report hhba-curated-card" key={jdJob.official_url}
    onTouchStart={e=>{reportSwipe.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{const start=reportSwipe.current;reportSwipe.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.3)changeJob(currentJdIndex+(dx<0?1:-1))}}
    onWheel={e=>{if(Math.abs(e.deltaX)>50&&Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.5)changeJob(currentJdIndex+(e.deltaX>0?1:-1))}}>
    <div className="hhba-refined-job-head"><div><JobTitle job={jdJob}/><span className={confirmed(jdJob)?'hhba-source-confirmed':'hhba-source-pending'}>{officialUrls.has(jdJob.official_url)?'正式推荐':confirmed(jdJob)?'官方 JD 已核验 · 非正式推荐':'候选岗位 · 来源待确认'}</span></div>
    <div className="hhba-native-score hhba-unified-score" aria-label={reportScore(jdJob)===null?'暂无可靠分数':reportScoreLabel(jdJob)+' '+reportScore(jdJob)+' 分'}><strong>{reportScore(jdJob)??'—'}{reportScore(jdJob)!==null&&<small>/100</small>}</strong><span>{reportScore(jdJob)===null?(pending?'等待评分':'暂无可靠分数'):reportScoreLabel(jdJob)}</span>
    {onOptimize&&<button type="button" disabled={pending||!optimizationAvailable||!jdJob.jd_version_id||!jdJob.jd_sha256} className="hhba-native-optimize" title={!jdJob.jd_version_id||!jdJob.jd_sha256?'取得完整岗位 JD 后可优化':!optimizationAvailable?'请先关联简历':pending?'匹配完成后可优化':'针对所选岗位优化简历'} onClick={()=>onOptimize(jdJob)} aria-label={'针对'+(jdJob.title_zh||jdJob.title)+'优化简历'}><Sparkles size={13} aria-hidden="true"/> 优化简历</button>}
    </div></div>
    <dl className="hhba-verification-facts"><div><dt>招聘来源</dt><dd>{confirmed(jdJob)?'官方来源已核验':'尚未确认官方归属'}</dd></div><div><dt>完整岗位 JD</dt><dd>{confirmed(jdJob)?'已取得完整原文':jdJob.jd_research?.facts.length?'已取得公开资料（非完整官方 JD）':jdJob.jd_research?.inference?'已完成 AI 职业方向研究':jdJob.evidence_excerpt||jdJob.requirements_basis?'已有待核验资料':pending&&!jdJob.jd_research?'等待研究':'尚未取得可核验原文'}</dd></div><div><dt>工作地点</dt><dd>{jdJob.location||'未知'}</dd></div><div><dt>薪资</dt><dd>{jdJob.salary||'未取得可确认薪资'}</dd></div><div><dt>投递状态</dt><dd>{jdJob.availability_status==='OPEN_LISTED'?'页面显示开放，仍需确认':'仍需官网确认'}</dd></div>{(jdJob.jd_checked_at||jdJob.checked_at)&&<div><dt>核验时间</dt><dd>{jdJob.jd_checked_at||jdJob.checked_at}</dd></div>}</dl>
    <JdResearchContent job={jdJob} pending={pending}/>
    {jdJob.research_detail?<CuratedJobReport detail={jdJob.research_detail}/>:<section className="hhba-refined-section"><h3>匹配理由</h3>{jdJob.score_basis&&<p>{recruitmentText(jdJob.score_basis)}</p>}{jdJob.recommendation_reason&&<p>{recruitmentText(jdJob.recommendation_reason)}</p>}{!jdJob.score_basis&&!jdJob.recommendation_reason&&<p>{pending?'等待 AI 分析结果。':'尚无可靠匹配分析。'}</p>}{!!jdJob.matched?.length&&<><h4>匹配优势</h4><ul>{jdJob.matched.map((v,i)=><li key={i}>{recruitmentText(v)}</li>)}</ul></>}{!!jdJob.not_evidenced?.length&&<><h4>待确认差距</h4><ul>{jdJob.not_evidenced.map((v,i)=><li key={i}>{recruitmentText(v)}</li>)}</ul></>}{!!jdJob.jd_comparisons?.length&&<ul className="hhba-native-comparisons">{jdJob.jd_comparisons.map((item,i)=><li key={i}><strong>{item.status==='supported'?'有对应经历':item.status==='partial'?'部分对应':'缺少简历证据'}</strong><div>岗位 JD · {recruitmentText(item.requirement)}</div>{item.resume_evidence&&<div>简历原文 · {item.resume_evidence}</div>}</li>)}</ul>}</section>}
    <RecruitmentSourceLinks job={jdJob}/>
   </article></>:empty(pending?'等待岗位研究结果。':'本次未收到可展示的岗位资料，不代表没有适合的工作。')}
  </>}
 </section>
 </>;
}
