import {useState} from 'react';
import '../styles/resume-match-dialog.css';
import type {MatchProfile,MatchResearchReport,MatchedJob,NativeMatchProgress} from '../services/resumeMatch';

const stages=[
 {label:'识别简历',stages:['preparing','parsing']},
 {label:'搜索企业岗位',stages:['connected','planning','searching']},
 {label:'核验岗位 JD',stages:['reading','researching']},
 {label:'对照简历评分',stages:['writing','scoring']}
];
const safeLink=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
const confirmed=(job:MatchedJob)=>job.jd_source_status==='VERIFIED_JD'&&job.source_type==='站外官方招聘';
export function MatchResearchPanels({profile,report,jobs,officialJobs,pending=false,progressStage='preparing'}:{
 profile?:MatchProfile;report?:MatchResearchReport;jobs:MatchedJob[];officialJobs:MatchedJob[];pending?:boolean;progressStage?:NativeMatchProgress;
}){
 const [selected,setSelected]=useState<number|null>(null);
 const parsed=report?.profile||profile;
 const all=Array.from(new Map([...jobs,...officialJobs].map(j=>[j.official_url,j])).values());
 const identified=!!(parsed&&(parsed.summary||parsed.facts?.length||parsed.skills?.length||parsed.target_roles?.length||parsed.education));
 const empty=(message:string)=><p className="hhba-stage-empty">{message}</p>;
 return <>
 <ol className="hhba-match-progress-steps" aria-label="匹配进度及研究报告">
  {stages.map((step,i)=><li key={step.label} aria-current={pending&&step.stages.includes(progressStage)?'step':undefined}>
   <button type="button" className="hhba-stage-tab" aria-expanded={selected===i} aria-controls="hhba-stage-report"
    onClick={()=>setSelected(old=>old===i?null:i)}>{step.label}<span aria-hidden="true">{selected===i?'⌃':'⌄'}</span></button>
  </li>)}
 </ol>
 {selected!==null&&<section id="hhba-stage-report" className="hhba-stage-report" aria-label={stages[selected].label+'报告'}>
  <header><strong>{stages[selected].label} · 研究成果</strong><button type="button" onClick={()=>setSelected(null)}>收起</button></header>
  {selected===0&&<>{identified&&parsed?<>
   {parsed.summary&&<p>{parsed.summary}</p>}
   {parsed.education&&<p><strong>教育背景：</strong>{parsed.education}</p>}
   {parsed.experience_years!==null&&parsed.experience_years!==undefined&&<p><strong>已识别工作年限：</strong>{parsed.experience_years} 年</p>}
   {!!parsed.target_roles?.length&&<div><h4>AI 研究方向</h4><div className="hhba-stage-tags">{parsed.target_roles.map((role,i)=><span key={i}>{role}</span>)}</div></div>}
   {!!parsed.skills?.length&&<div><h4>能力与原文依据</h4><ul>{parsed.skills.map((skill,i)=><li key={i}><strong>{skill.name}</strong>{skill.evidence&&<p>{skill.evidence}</p>}</li>)}</ul></div>}
   {!!parsed.facts?.length&&<div><h4>简历事实</h4><ul>{parsed.facts.map((fact,i)=><li key={i}>{fact.quote}</li>)}</ul></div>}
   {!!parsed.warnings?.length&&<p>{parsed.warnings.join('；')}</p>}
  </>:empty(pending?'AI 正在识别简历，实际分析成果产生后会显示在这里。':'本次记录没有保存简历分析报告。')}</>}
  {selected===1&&<>
   {report&&<div className="hhba-stage-stats"><span>研究轮次 {report.rounds.length}</span><span>候选岗位 {report.discovered}{report.candidate_target?' / '+report.candidate_target:''}</span><span>已排除商业平台链接 {report.excluded_count}</span></div>}
   {report?.rounds.map(r=><details key={r.round}><summary>第 {r.round} 轮 · 新增 {r.added} 条候选 · {r.cited_count} 条非商业平台引用</summary>
    {r.queries.length?<ul>{r.queries.map((q,i)=><li key={i}>{q}</li>)}</ul>:<p>接口未返回本轮具体检索词。</p>}</details>)}
   <h4>已发现的招聘候选（不是最终推荐）</h4>
   {all.length?<ul className="hhba-stage-jobs">{all.map(job=><li key={job.official_url}><strong>{job.company} · {job.title_zh||job.title}</strong><p>{job.location} · {confirmed(job)?'官方来源已核验':'来源待核验'}</p>{confirmed(job)&&safeLink(job.official_url)?<a href={safeLink(job.official_url)!} target="_blank" rel="noopener noreferrer">查看官方招聘来源</a>:<small>来源未确认，不提供投递入口。</small>}</li>)}</ul>:empty(pending?'正在搜索官方招聘渠道，尚无候选。':'本轮没有保留可展示的候选。')}
  </>}
  {selected===2&&<>
   <div className="hhba-stage-stats"><span>已核验官方 JD {all.filter(confirmed).length}</span><span>待核验 {all.filter(j=>!confirmed(j)).length}</span></div>
   {all.length?<ul className="hhba-stage-jobs">{all.map(job=><li key={job.official_url}><details><summary>{job.company} · {job.title_zh||job.title} · {confirmed(job)?'官方 JD 已核验':'未确认官方来源或完整 JD'}</summary>
    {job.requirements_basis&&<><h4>岗位要求</h4><p>{job.requirements_basis}</p></>}
    {job.evidence_excerpt&&<><h4>原文依据</h4><p>{job.evidence_excerpt}</p></>}
    {job.jd_checked_at||job.checked_at?<p>核验时间：{job.jd_checked_at||job.checked_at}</p>:null}
    {confirmed(job)&&safeLink(job.official_url)&&<a href={safeLink(job.official_url)!} target="_blank" rel="noopener noreferrer">官方招聘原始页面</a>}
    {confirmed(job)&&!!job.evidence_sources?.length&&<ul>{job.evidence_sources.map((source,i)=>safeLink(source.url)?<li key={i}><a href={safeLink(source.url)!} target="_blank" rel="noopener noreferrer">{source.url}</a></li>:null)}</ul>}
   </details></li>)}</ul>:empty(pending?'等待岗位网页核验成果。':'未取得可核验的岗位 JD。')}
  </>}
  {selected===3&&<>
   <div className="hhba-stage-stats"><span>正式推荐 {officialJobs.length}{report?.final_target?' / '+report.final_target:''}</span><span>证据支持评分 {officialJobs.filter(j=>j.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'&&j.match_score!=null).length}</span></div>
   {officialJobs.length?<ul className="hhba-stage-jobs">{officialJobs.map(job=><li key={job.official_url}><details><summary>{job.company} · {job.title_zh||job.title} · {job.match_score==null?'暂无可靠分数':job.match_score+'/100'}</summary>
    {job.score_basis&&<p>{job.score_basis}</p>}{job.recommendation_reason&&<p>{job.recommendation_reason}</p>}
    {!!job.matched?.length&&<><h4>匹配依据</h4><ul>{job.matched.map((v,i)=><li key={i}>{v}</li>)}</ul></>}
    {job.research_detail&&<><h4>逐项对照</h4><ul>{job.research_detail.comparisons.map((c,i)=><li key={i}><strong>{c.requirement}</strong><p>{c.resume_evidence}</p><p>{c.analysis}</p></li>)}</ul><h4>核心优势</h4><p>{job.research_detail.strengths}</p><h4>风险</h4><p>{job.research_detail.risks}</p></>}
    {!!job.not_evidenced?.length&&<><h4>待补充证据</h4><ul>{job.not_evidenced.map((v,i)=><li key={i}>{v}</li>)}</ul></>}
   </details></li>)}</ul>:empty(pending?'取得并核验官方 JD 后展示评分结果。':'本轮没有满足官方来源条件的正式推荐。')}
  </>}
 </section>}
 </>;
}
