import {RecruitmentSourceLinks,recruitmentText} from './RecruitmentSourceLinks';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,ChevronDown,ArrowUpRight,MapPin,Sparkles} from 'lucide-react';
import '../styles/resume-match-dialog.css';
import {CuratedJobReport} from './CuratedJobReport';
import {verifiedMatchReports} from '../services/verifiedMatchPresentation.mjs';
import type {MatchProfile,MatchResearchReport,MatchedJob,NativeMatchProgress,NativeMatchActivity} from '../services/resumeMatch';

const stages=[
 {label:'识别简历',english:'CAREER PROFILE',stages:['preparing','parsing']},
 {label:'搜索企业岗位',english:'CAREER RESEARCH',stages:['connected','planning','searching']},
 {label:'岗位研究与匹配',english:'MATCH REPORT',stages:['reading','researching','writing','scoring']}
];
export const matchStageIndex=(stage:NativeMatchProgress)=>stages.findIndex(s=>s.stages.includes(stage));
const safeLink=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
const confirmed=(job:MatchedJob)=>job.jd_source_status==='VERIFIED_JD'&&job.source_type==='站外官方招聘'&&!!job.evidence_excerpt?.trim();
const sourceConfirmed=(job:MatchedJob)=>confirmed(job)||job.reference_vacancy_verified===true;
const liveResearchLabel=(job:MatchedJob)=>job.report_status==='COMPLETE'&&job.research_detail?'报告已完成':Number.isInteger(job.match_score)?sourceConfirmed(job)?'评分已完成':'AI参考评分 · 来源待核验':confirmed(job)?'官方 JD 已核验':job.reference_jd?.trim()?'AI 参考 JD 已整理':sourceConfirmed(job)?'岗位来源已核验':job.jd_research?.facts?.length?'已有公开资料':'待核验';
const scoreGrounded=(job:MatchedJob)=>job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&job.match_score!=null;
function reportScore(job:MatchedJob){
 const value=job.match_score;
 if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=100)return value;
 if(value===undefined&&Number.isInteger(job.reference_score)&&job.reference_score>0&&job.reference_score<=100)return job.reference_score;
 return null;
}
function reportScoreLabel(job:MatchedJob){
 return job.evidence_score_status==='AI_REFERENCE_JD_SCORED'?'AI 参考适配分 · 推断职责':confirmed(job)&&scoreGrounded(job)?'匹配参考分 · JD 原文依据':job.evidence_score_status==='AI_PARTIAL_SOURCE_SCORED'?'初步参考分 · 部分资料':job.evidence_score_status==='AI_DIRECTION_REFERENCE_SCORED'?'方向参考分 · 待核验':'匹配参考分 · 依据待核对';
}
function JobTitle({job}:{job:MatchedJob}){
 return <><strong>{job.company}</strong><span>{job.title_zh||job.title}</span><small><MapPin size={12} aria-hidden="true"/>{job.location}</small></>;
}
function OfficialLink({job}:{job:MatchedJob}){
 const href=(confirmed(job)||job.reference_vacancy_verified===true)&&safeLink(job.official_url);
 return href?<a className="hhba-refined-source-link" href={href} target="_blank" rel="noopener noreferrer">查看官方招聘页面 <ArrowUpRight size={13}/></a>:null;
}
export function ReportPager({count,index,onChange,pending=false,inline=false}:{count:number;index:number;onChange:(i:number)=>void;pending?:boolean;inline?:boolean}){
 const anchor=useRef<HTMLDivElement>(null);
 const [modal,setModal]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  setModal(inline?null:anchor.current?.closest<HTMLElement>('.hhba-match-modal')??null);
 },[inline]);
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
function JdResearchContent({job}:{job:MatchedJob}){
 if(job.reference_jd_kind==='AI_GENERATED_REFERENCE'&&job.reference_jd&&['COMPLETE','UNAVAILABLE','DECLINED'].includes(job.report_status||''))return <>
  <section className="hhba-refined-section"><h3>{job.jd_research?.facts?.length?'依据公开资料整理的参考 JD':'依据岗位名称整理的求职参考 JD'}</h3><p className="hhba-refined-note">{job.jd_research?.facts?.length?'优先依据已核对的公开招聘资料整理，推导的能力方向属于求职建议，不是企业新增要求。':'企业具体职责和资格尚无可核对原文，以下为岗位方向的准备建议，并非企业招聘要求。'}</p><p style={{whiteSpace:'pre-wrap'}}>{recruitmentText(job.reference_jd)}</p>{job.report_status==='UNAVAILABLE'&&<p className="hhba-refined-note">岗位参考资料已整理，暂无可靠的简历匹配分，不属于正式推荐。</p>}{job.report_status==='DECLINED'&&<p className="hhba-refined-note">已保留岗位资料，AI 判断不宜正式推荐。</p>}<h4>整理依据及需要核实的事项</h4><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{recruitmentText(job.reference_jd_basis||'')}</p></section>
  {!!job.jd_research?.facts.length&&<section className="hhba-refined-section"><h3>已独立读取的公开资料片段</h3>{job.jd_research.facts.map((f,i)=><div key={i}><p>{recruitmentText(f.quote)}</p><small>{f.context==='same_job'?'该岗位资料':'相关背景 · 非本岗位要求'}</small></div>)}</section>}
 </>;
 const requirements=job.requirements_basis?.trim(),excerpt=job.evidence_excerpt?.trim();
 // Never render model-supplied requirements unless grounded in the actual JD.
 const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
 return <>
  {requirements&&excerpt&&norm(excerpt).includes(norm(requirements))&&norm(requirements)!==norm(excerpt)&&<section className="hhba-refined-section"><h3>岗位要求</h3><p>{recruitmentText(requirements)}</p></section>}
  {!!job.jd_research?.facts?.length&&<section className="hhba-refined-section"><h3>已独立读取的公开资料片段</h3>{job.jd_research.facts.map((f,i)=><div key={i}><p>{recruitmentText(f.quote)}</p><small>{f.context==='same_job'?'该岗位资料':'相关背景 · 非本岗位要求'}</small></div>)}</section>}
  {job.jd_research?.inference&&<section className="hhba-refined-section"><h3>AI 求职方向分析 · 非企业要求</h3><p style={{whiteSpace:'pre-wrap'}}>{recruitmentText(job.jd_research.inference)}</p></section>}
  {!!job.jd_research?.unknowns?.length&&<section className="hhba-refined-section"><h3>仍需核实的事项</h3>{job.jd_research.unknowns.map((item,i)=><p key={i}>{recruitmentText(item)}</p>)}</section>}
  {excerpt&&<section className="hhba-refined-section"><h3>{confirmed(job)?'完整 JD 原文':'现有岗位资料线索 · 尚非完整官方JD'}</h3><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{recruitmentText(excerpt)}</p></section>}
 </>;
}
export function MatchResearchPanels({profile,report,jobs,officialJobs,pending=false,provisional=false,progressStage='preparing',activity,elapsed,selection,onSelectionChange,onFollow,selectedJobUrl,onJobChange,onOptimize,optimizationAvailable=false}:{
 profile?:MatchProfile;report?:MatchResearchReport;jobs:MatchedJob[];officialJobs:MatchedJob[];pending?:boolean;provisional?:boolean;progressStage?:NativeMatchProgress;
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
 const arrivalSet=new Set(arrival);
 const recent=[...arrival.map(u=>byUrl.get(u)).filter((j):j is MatchedJob=>!!j),...all.filter(j=>!arrivalSet.has(j.official_url))].slice(-3).reverse();
 const identified=!!(parsed&&(parsed.summary||parsed.facts?.length||parsed.skills?.length||parsed.target_roles?.length||parsed.education));
 // The candidate event can precede the aggregate report. Count actual received
 // candidate rows immediately; final history still uses the authoritative total.
 const discovered=pending?Math.max(report?.discovered??0,jobs.length):report?.discovered??all.length;
 const target=report?.candidate_target;
 const searching=pending&&actual===1;
 const ratio=target?Math.max(0,Math.min(100,discovered/target*100)):0;
 const companies=new Set(all.map(j=>j.company.trim()).filter(x=>x&&!/待核实|未知/.test(x))).size;
 const visible=all.filter(j=>[j.company,j.title,j.title_zh||'',j.location].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const verified=all.filter(confirmed);
 // Preserve backend global ranking; research leads never enter this pager.
 const jdItems=verifiedMatchReports(officialJobs);
 const scoredPending=all.filter(j=>(confirmed(j)&&scoreGrounded(j)||j.reference_vacancy_verified===true&&j.evidence_score_status==='AI_REFERENCE_JD_SCORED')&&reportScore(j)!==null&&j.curated_suitable===true&&!j.excluded_closed&&!j.excluded_board&&j.availability_status!=='CLOSED_LISTED'&&j.availability_status!=='POSSIBLY_CLOSED'&&!jdItems.some(item=>item.official_url===j.official_url));
 const materialOnly=all.filter(j=>!j.excluded_closed&&!j.excluded_board&&j.availability_status!=='CLOSED_LISTED'&&j.availability_status!=='POSSIBLY_CLOSED'&&!jdItems.some(item=>item.official_url===j.official_url)&&!scoredPending.some(item=>item.official_url===j.official_url)&&!!(j.reference_jd?.trim()||j.jd_research?.facts?.length||j.jd_research?.inference?.trim()||confirmed(j)));
 const currentJdIndex=Math.max(0,jdItems.findIndex(j=>j.official_url===(selectedJobUrl??localJobUrl)));
 const jdJob=jdItems[currentJdIndex];
 const changeJob=(next:number)=>{
  const job=jdItems[next];if(!job)return;
  setLocalJobUrl(job.official_url);onJobChange?.(job.official_url);
 };
 const pendingCount=all.filter(j=>!confirmed(j)&&!j.reference_vacancy_verified).length;
 const empty=(message:string)=><p className="hhba-stage-empty">{message}</p>;
 const status=(i:number)=>!pending?'':i===0&&identified?'分析已完成':actual===i?'正在处理':actual>i?'可查看已有成果':'等待处理';
 return <>
 <ol className="hhba-match-progress-steps hhba-refined-steps" aria-label="匹配进度及研究报告">
  {stages.map((step,i)=><li key={step.label} aria-current={pending&&actual===i?'step':undefined} data-selected={active===i}>
   <button type="button" className="hhba-stage-tab" aria-expanded={active===i} aria-controls={id}
    onClick={()=>{setSelected(i);onSelectionChange?.(i)}}><span className="hhba-step-no">0{i+1}</span><span className="hhba-step-copy">{step.label}<small>{status(i)||step.english}</small></span><ChevronDown size={13} aria-hidden="true"/></button>
  </li>)}
 </ol>
 <section id={id} className="hhba-stage-report hhba-refined-stage" aria-label={stages[active].label+'报告'} data-stage={active}>
  {active!==2&&<header className="hhba-refined-header"><span className="hhba-refined-brand">HHBA</span><small>{stages[active].english}</small>{pending&&onFollow&&<button type="button" onClick={onFollow}>跟随进度</button>}</header>}
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
    <div className="hhba-search-meta"><span>研究轮次 <b>{report?.rounds.length??0}</b></span><span>已发现企业 <b>{companies}</b></span><span>已收到检索来源 <b>{report?.search_source_count??0}</b></span><span>排除商业来源 <b>{report?.excluded_count??0}</b></span>{pending&&elapsed!==undefined&&<span>已用时 <b>{elapsed}</b> 秒</span>}</div>
   </div>
   <section className="hhba-refined-section hhba-discovery-feed"><div className="hhba-refined-subhead"><h3>{pending?'最新发现':'候选岗位一览'}</h3><small>{pending?'LIVE DISCOVERY':'DISCOVERY'}</small></div>
    {recent.length?recent.map(job=><div className="hhba-discovery-item" key={job.official_url}><div><JobTitle job={job}/></div><span className={sourceConfirmed(job)?'hhba-source-confirmed':'hhba-source-pending'}>{liveResearchLabel(job)}</span></div>):empty(pending?'等待实际搜索返回首个候选岗位。':'本次没有保留候选岗位。')}
   </section>
   <details className="hhba-refined-details"><summary>实际研究记录（{report?.rounds.length??0} 轮）</summary>
    {report?.rounds.map(r=><details key={r.round}><summary>第 {r.round} 轮 · 新增 {r.added} 个候选 · {r.cited_count} 条非商业平台引用</summary>
     {r.queries.length?<ul>{r.queries.map((q,i)=><li key={i}>{q}</li>)}</ul>:<p>接口未返回本轮具体检索词。</p>}</details>)}
   </details>
   <details className="hhba-refined-details"><summary>全部已收到候选岗位（{all.length}）</summary><label className="hhba-refined-filter"><span>筛选企业、岗位或地点</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索本次候选记录"/></label>
    {visible.length?visible.map(job=><div className="hhba-discovery-item" key={job.official_url}><div><JobTitle job={job}/><OfficialLink job={job}/>{(job.reference_jd||job.jd_research?.facts?.length||job.jd_research?.inference||job.jd_research?.unknowns?.length||job.evidence_excerpt)&&<details><summary>岗位资料 · {job.reference_vacancy_verified?'岗位已核验':'岗位来源待进一步核验'}</summary><JdResearchContent job={job}/>{job.report_status==='COMPLETE'&&job.research_detail&&<CuratedJobReport detail={job.research_detail} reference={job.reference_jd_kind==='AI_GENERATED_REFERENCE'}/>}<RecruitmentSourceLinks job={job}/></details>}</div><small>{liveResearchLabel(job)}</small></div>):empty('没有对应的候选记录。')}
   </details>
  </>}
  {active===2&&<>
   <div className="hhba-compact-report-head"><h2>岗位研究与匹配报告</h2>{pending&&onFollow&&<button type="button" onClick={onFollow}>跟随进度</button>}</div>
   <div className="hhba-refined-metrics hhba-score-metrics"><div><small>已发现</small><strong>{all.length}</strong></div><div><small>官方 JD 已核验</small><strong>{verified.length}</strong></div><div><small>{pending||provisional?'已完成报告':'正式推荐'}</small><strong>{jdItems.length}{report?.final_target?<em> / {report.final_target}</em>:null}</strong></div></div>
   {jdJob?<><ReportPager count={jdItems.length} index={currentJdIndex} onChange={changeJob} pending={pending} inline/><article className="hhba-verified-report hhba-curated-card" key={jdJob.official_url}
    onTouchStart={e=>{reportSwipe.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{const start=reportSwipe.current;reportSwipe.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.3)changeJob(currentJdIndex+(dx<0?1:-1))}}
    onWheel={e=>{if(Math.abs(e.deltaX)>50&&Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.5)changeJob(currentJdIndex+(e.deltaX>0?1:-1))}}>
    <div className="hhba-refined-job-head"><div><JobTitle job={jdJob}/><span className="hhba-source-confirmed">{jdJob.reference_jd_kind==='AI_GENERATED_REFERENCE'?(pending||provisional?'真实岗位 · AI参考JD · 排名待确认':'真实岗位 · AI参考JD'):pending||provisional?'研究已完成 · 最终排名待确认':'正式推荐'}</span></div>
    <div className="hhba-native-score hhba-unified-score" aria-label={reportScore(jdJob)===null?'暂无可靠分数':reportScoreLabel(jdJob)+' '+reportScore(jdJob)+' 分'}><strong>{reportScore(jdJob)??'—'}{reportScore(jdJob)!==null&&<small>/100</small>}</strong><span>{reportScore(jdJob)===null?(pending?'等待评分':'暂无可靠分数'):reportScoreLabel(jdJob)}</span>
    {onOptimize&&<button type="button" disabled={pending||!optimizationAvailable||(!(jdJob.jd_version_id&&jdJob.jd_sha256)&&!(jdJob.reference_jd_kind==='AI_GENERATED_REFERENCE'&&jdJob.reference_jd?.trim()&&jdJob.reference_jd_basis?.trim()))} className="hhba-native-optimize" title={jdJob.reference_jd_kind==='AI_GENERATED_REFERENCE'?'基于AI参考JD优化真实经历':!jdJob.jd_version_id||!jdJob.jd_sha256?'取得完整岗位 JD 后可优化':!optimizationAvailable?'请先关联简历':pending?'匹配完成后可优化':'针对所选岗位优化简历'} onClick={()=>onOptimize(jdJob)} aria-label={'针对'+(jdJob.title_zh||jdJob.title)+'优化简历'}><Sparkles size={13} aria-hidden="true"/> 优化简历</button>}
    </div></div>
    <dl className="hhba-verification-facts"><div><dt>招聘来源</dt><dd>{confirmed(jdJob)||jdJob.reference_vacancy_verified?'官方岗位来源已核验':'尚未确认官方归属'}</dd></div><div><dt>完整岗位 JD</dt><dd>{jdJob.reference_jd_kind==='AI_GENERATED_REFERENCE'?'AI参考JD · 非官方原文':confirmed(jdJob)?'已取得完整原文':jdJob.jd_research?.facts.length?'已取得公开资料（非完整官方 JD）':jdJob.jd_research?.inference?'已完成 AI 职业方向研究':jdJob.evidence_excerpt||jdJob.requirements_basis?'已有待核验资料':pending&&!jdJob.jd_research?'等待研究':'尚未取得可核验原文'}</dd></div><div><dt>工作地点</dt><dd>{jdJob.location||'未知'}</dd></div><div><dt>薪资</dt><dd>{jdJob.salary||'未取得可确认薪资'}</dd></div><div><dt>投递状态</dt><dd>{jdJob.availability_status==='OPEN_LISTED'?'页面显示开放，仍需确认':'仍需官网确认'}</dd></div>{(jdJob.jd_checked_at||jdJob.checked_at)&&<div><dt>核验时间</dt><dd>{jdJob.jd_checked_at||jdJob.checked_at}</dd></div>}</dl>
    <JdResearchContent job={jdJob}/>
    {jdJob.research_detail&&<CuratedJobReport detail={jdJob.research_detail} reference={jdJob.reference_jd_kind==='AI_GENERATED_REFERENCE'}/>}
    <RecruitmentSourceLinks job={jdJob}/>
   </article></>:empty(pending?'正在逐条研究已发现岗位；已取得的 JD 和评分会先展示，完整报告逐份送达。':'本次尚无完成岗位真实性核验和可靠适配报告的推荐，其他AI参考分析保留在搜索记录。')}
   {scoredPending.length>0&&<details className="hhba-refined-details"><summary>已有可靠评分 · 待报告或全局排名（{scoredPending.length}）</summary><p className="hhba-refined-note">以下为独立评分研究成果，尚不是最终精选推荐。官方原文和 AI 参考JD分别标注。</p>{scoredPending.map(job=><details key={job.official_url}><summary>{job.company} · {job.title_zh||job.title} · {reportScore(job)} 分</summary><JobTitle job={job}/><p>{reportScoreLabel(job)}</p>{job.recommendation_reason&&<p>{job.recommendation_reason}</p>}{job.score_basis&&<p className="hhba-refined-note">{job.score_basis}</p>}<OfficialLink job={job}/><JdResearchContent job={job}/><RecruitmentSourceLinks job={job}/></details>)}</details>}
   {materialOnly.length>0&&<details className="hhba-refined-details"><summary>岗位研究资料 · 非正式推荐（{materialOnly.length}）</summary><p className="hhba-refined-note">已整理的公开资料及 AI 求职方向单独保留；没有可靠匹配分时不显示数字，不计入最终精选岗位。</p>{materialOnly.map(job=><details key={job.official_url}><summary>{job.company} · {job.title_zh||job.title} · {reportScore(job)===null?'暂无可靠分数':'研究参考 · 非正式推荐'}</summary><JobTitle job={job}/><p className="hhba-refined-note">{confirmed(job)||job.reference_vacancy_verified?'官方岗位来源已核验':'岗位来源待核验'}{job.score_basis?' · '+job.score_basis:''}</p><OfficialLink job={job}/><JdResearchContent job={job}/><RecruitmentSourceLinks job={job}/></details>)}</details>}
   {pendingCount>0&&<p className="hhba-refined-note" role="status">{pending?pendingCount+' 个候选仍在核验或研究中，尚未进入正式推荐。':pendingCount+' 个候选未取得可靠的官方证据，未纳入推荐。'}<button type="button" onClick={()=>{setSelected(1);onSelectionChange?.(1)}}>查看搜索记录</button></p>}
   <p className="hhba-refined-note hhba-compact-disclaimer">匹配分用于求职参考，不是录用概率。</p>
  </>}
 </section>
 </>;
}
