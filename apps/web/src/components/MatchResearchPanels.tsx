import {useEffect,useId,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,ChevronDown,ArrowUpRight,Check,MapPin} from 'lucide-react';
import '../styles/resume-match-dialog.css';
import {CuratedJobReport} from './CuratedJobReport';
import type {MatchProfile,MatchResearchReport,MatchedJob,NativeMatchProgress,NativeMatchActivity} from '../services/resumeMatch';

const stages=[
 {label:'识别简历',english:'CAREER PROFILE',stages:['preparing','parsing']},
 {label:'搜索企业岗位',english:'CAREER RESEARCH',stages:['connected','planning','searching']},
 {label:'核验岗位 JD',english:'SOURCE VERIFICATION',stages:['reading','researching']},
 {label:'对照简历评分',english:'MATCH REPORT',stages:['writing','scoring']}
];
export const matchStageIndex=(stage:NativeMatchProgress)=>stages.findIndex(s=>s.stages.includes(stage));
const safeLink=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
const confirmed=(job:MatchedJob)=>job.jd_source_status==='VERIFIED_JD'&&job.source_type==='站外官方招聘';
const scoreGrounded=(job:MatchedJob)=>job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&job.match_score!=null;
function JobTitle({job}:{job:MatchedJob}){
 return <><strong>{job.company}</strong><span>{job.title_zh||job.title}</span><small><MapPin size={12} aria-hidden="true"/>{job.location}</small></>;
}
function OfficialLink({job}:{job:MatchedJob}){
 const href=confirmed(job)&&safeLink(job.official_url);
 return href?<a className="hhba-refined-source-link" href={href} target="_blank" rel="noopener noreferrer">查看官方招聘页面 <ArrowUpRight size={13}/></a>:null;
}
function ReportPager({count,index,onChange}:{count:number;index:number;onChange:(i:number)=>void}){
 if(!count)return null;
 return <nav className="hhba-refined-pager" aria-label="岗位切换">
  <button type="button" disabled={index===0} onClick={()=>onChange(index-1)}><ChevronLeft size={16}/> 上一个</button>
  <span>{String(index+1).padStart(2,'0')} / {count}</span>
  <button type="button" disabled={index>=count-1} onClick={()=>onChange(index+1)}>下一个 <ChevronRight size={16}/></button>
 </nav>;
}
export function MatchResearchPanels({profile,report,jobs,officialJobs,pending=false,progressStage='preparing',activity,elapsed,selection,onSelectionChange,onFollow,externalScore=false}:{
 profile?:MatchProfile;report?:MatchResearchReport;jobs:MatchedJob[];officialJobs:MatchedJob[];pending?:boolean;progressStage?:NativeMatchProgress;
 activity?:NativeMatchActivity|null;elapsed?:number;selection?:number;onSelectionChange?:(i:number)=>void;onFollow?:()=>void;externalScore?:boolean;
}){
 const id=useId();
 const [selected,setSelected]=useState(3);
 const [jdIndex,setJdIndex]=useState(0);
 const [scoreIndex,setScoreIndex]=useState(0);
 const [arrival,setArrival]=useState<string[]>([]);
 const [query,setQuery]=useState('');
 const active=selection??selected;
 const actual=matchStageIndex(progressStage);
 const parsed=report?.profile||profile;
 const all=useMemo(()=>Array.from(new Map([...jobs,...officialJobs].map(j=>[j.official_url,j])).values()),[jobs,officialJobs]);
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
 const jdItems=[...verified,...all.filter(j=>!confirmed(j))];
 const currentJdIndex=Math.min(jdIndex,Math.max(0,jdItems.length-1));
 const jdJob=jdItems[currentJdIndex];
 const currentScoreIndex=Math.min(scoreIndex,Math.max(0,officialJobs.length-1));
 const scoreJob=officialJobs[currentScoreIndex];
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
   <div className="hhba-refined-title"><span>03 / SOURCE VERIFICATION</span><h2>官方招聘信息核验</h2><p>优先研究真实、适合的候选岗位，未确认的来源不作为正式推荐。</p></div>
   <div className="hhba-refined-metrics"><div><small>已核验官方 JD</small><strong>{verified.length}</strong></div><div><small>尚未确认官方 JD</small><strong>{Math.max(0,discovered-verified.length)}</strong></div><div><small>已完成证据评分</small><strong>{officialJobs.filter(scoreGrounded).length}</strong></div></div>
   {jdJob?<><ReportPager count={jdItems.length} index={currentJdIndex} onChange={setJdIndex}/><article className="hhba-verified-report">
    <div className="hhba-refined-job-head"><div><JobTitle job={jdJob}/></div><span className={confirmed(jdJob)?'hhba-source-confirmed':'hhba-source-pending'}>{confirmed(jdJob)?'官方 JD 已核验':'尚未确认'}</span></div>
    <dl className="hhba-verification-facts"><div><dt>招聘来源</dt><dd>{confirmed(jdJob)?'官方来源已核验':'尚未确认官方归属'}</dd></div><div><dt>完整岗位 JD</dt><dd>{jdJob.jd_source_status==='VERIFIED_JD'?'已取得完整原文':'尚未取得完整原文'}</dd></div><div><dt>工作地点</dt><dd>{jdJob.location||'未知'}</dd></div><div><dt>薪资</dt><dd>{jdJob.salary||'未取得可确认薪资'}</dd></div><div><dt>投递状态</dt><dd>{jdJob.availability_status==='OPEN_LISTED'?'页面显示开放，仍需确认':'仍需官网确认'}</dd></div>{(jdJob.jd_checked_at||jdJob.checked_at)&&<div><dt>核验时间</dt><dd>{jdJob.jd_checked_at||jdJob.checked_at}</dd></div>}</dl>
    {jdJob.requirements_basis&&<section className="hhba-refined-section"><h3>岗位要求{confirmed(jdJob)?'':'（待核验）'}</h3><p>{jdJob.requirements_basis}</p></section>}
    {jdJob.evidence_excerpt&&<section className="hhba-refined-section"><h3>{jdJob.jd_source_status==='VERIFIED_JD'?'完整 JD 原文':'已收到的来源资料'}</h3><p>{jdJob.evidence_excerpt}</p></section>}
    <OfficialLink job={jdJob}/>
    {confirmed(jdJob)&&!!jdJob.evidence_sources?.length&&<details className="hhba-refined-details"><summary>研究来源（{jdJob.evidence_sources.length}）</summary><ul>{jdJob.evidence_sources.map((source,i)=>safeLink(source.url)?<li key={i}><a href={safeLink(source.url)!} target="_blank" rel="noopener noreferrer">{source.url}</a></li>:null)}</ul></details>}
   </article></>:empty(pending?'等待官方 JD 核验结果。':'本次没有可核验的岗位资料。')}
  </>}
  {active===3&&<>
   <div className="hhba-refined-title"><span>04 / MATCH REPORT</span><h2>精选岗位匹配报告</h2><p>逐项对照简历和官方 JD，一次只阅读一个岗位。</p></div>
   <div className="hhba-refined-metrics hhba-score-metrics"><div><small>正式推荐</small><strong>{officialJobs.length}{report?.final_target?<em> / {report.final_target}</em>:null}</strong></div><div><small>原文证据支持评分</small><strong>{officialJobs.filter(scoreGrounded).length}</strong></div></div>
   {!externalScore&&(scoreJob?<><ReportPager count={officialJobs.length} index={currentScoreIndex} onChange={setScoreIndex}/><article className="hhba-verified-report">
    <div className="hhba-refined-job-head"><div><JobTitle job={scoreJob}/></div><div className="hhba-refined-score">{scoreJob.match_score??'—'}<small>/100</small></div></div>
    {scoreJob.research_detail?<CuratedJobReport detail={scoreJob.research_detail} jd={scoreJob.evidence_excerpt}/>:<><p>{scoreJob.score_basis}</p><p>{scoreJob.recommendation_reason}</p>{!!scoreJob.matched?.length&&<ul>{scoreJob.matched.map((v,i)=><li key={i}>{v}</li>)}</ul>}{!!scoreJob.not_evidenced?.length&&<ul>{scoreJob.not_evidenced.map((v,i)=><li key={i}>{v}</li>)}</ul>}</>}
    <OfficialLink job={scoreJob}/>
   </article><ReportPager count={officialJobs.length} index={currentScoreIndex} onChange={setScoreIndex}/></>:empty(pending?'正在核验和评分，完整报告产生后自动展示。':'本次没有达到交付要求的正式推荐。'))}
  </>}
 </section>
 </>;
}
