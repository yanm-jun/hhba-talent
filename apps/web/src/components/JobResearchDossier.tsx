import {CheckCircle2,CircleDot,FileSearch,ShieldCheck,ScanSearch,ClipboardCheck,AlertCircle} from 'lucide-react';
import {jobResearchDossier} from '../services/jobResearchDossier.mjs';
import {recruitmentText} from './RecruitmentSourceLinks';
import type {MatchedJob} from '../services/resumeMatch';
import '../styles/job-research-dossier.css';

// A read-only view of persisted, evidence-backed state: not a simulated agent
// transcript. In particular, absence of evidence must never appear "complete".
export function JobResearchDossier({job}:{job:MatchedJob}){
 const dossier=jobResearchDossier(job);
 const icons=[ShieldCheck,FileSearch,ScanSearch,ClipboardCheck];
 const sourceQuote=job.jd_research?.facts?.find(f=>f.context==='same_job'&&f.quote?.trim())?.quote;
 const originalExcerpt=dossier.officialJd?job.evidence_excerpt:sourceQuote;
 const compared=dossier.reportFinished?
  job.research_detail?.comparisons?.find(c=>c.requirement?.trim()&&c.analysis?.trim()):
  dossier.groundedScore?job.jd_comparisons?.find(c=>c.requirement?.trim()&&c.resume_evidence?.trim()):undefined;
 const strength=dossier.reportFinished?job.research_detail?.strengths?.trim():null;
 return <section className="hhba-job-dossier" aria-label="当前岗位深度研究档案" data-hhba-job-dossier="true">
  <div className="hhba-job-dossier-top">
   <div>
    <span className="hhba-job-dossier-eyebrow">HHBA / CAREER RESEARCH DOSSIER</span>
    <h3>本岗位深度研究档案</h3>
    <p>招聘真实性、岗位资料、简历证据与职业判断分别核对；未完成的部分如实保留。</p>
   </div>
   <div className="hhba-job-dossier-completeness" aria-label={'已有研究阶段成果 '+dossier.finished+' 项，共 4 项'}>
    <strong>{dossier.finished}<span> / 4</span></strong>
    <small>已有阶段成果</small>
   </div>
  </div>
  <ol className="hhba-job-dossier-milestones">
   {dossier.stages.map((stage,index)=>{
    const Icon=icons[index];
    const done=stage.state==='complete'||stage.state==='reference';
    return <li key={stage.id} data-research-stage={stage.id} data-evidence-state={stage.state}>
     <span className="hhba-job-dossier-stage-icon" aria-hidden="true">{done?<CheckCircle2 size={17}/>:stage.state==='attention'?<AlertCircle size={17}/>:stage.state==='partial'?<CircleDot size={17}/>:<Icon size={17}/>}</span>
     <div className="hhba-job-dossier-stage-body">
      <div className="hhba-job-dossier-stage-heading"><strong><span>{String(index+1).padStart(2,'0')}</span> {stage.title}</strong><small>{stage.label}</small></div>
      <p>{stage.summary}</p>
      {stage.count!==undefined&&<span className="hhba-job-dossier-evidence-count">已取得 {stage.count} 项对照记录</span>}
     </div>
    </li>;
   })}
  </ol>
  {(originalExcerpt||compared||strength)&&<div className="hhba-job-dossier-samples">
   <div className="hhba-job-dossier-samples-label">本岗位已取得的实际研究内容</div>
   {originalExcerpt&&<div className="hhba-job-dossier-sample">
    <strong>{dossier.officialJd?'官方 JD 原文摘录':'已读取的该岗位公开资料摘录'}</strong>
    <p>{recruitmentText(originalExcerpt.slice(0,280))}{originalExcerpt.length>280?'…':''}</p>
   </div>}
   {compared&&<div className="hhba-job-dossier-sample">
    <strong>岗位要求与简历证据对照</strong>
    <p>{recruitmentText(compared.requirement)}</p>
    {compared.resume_evidence&&<small>简历依据：{recruitmentText(compared.resume_evidence)}</small>}
    {'analysis' in compared&&typeof compared.analysis==='string'&&compared.analysis&&<p className="hhba-job-dossier-analysis">{recruitmentText(compared.analysis)}</p>}
   </div>}
   {strength&&<div className="hhba-job-dossier-sample">
    <strong>职业顾问研判摘录</strong>
    <p>{recruitmentText(strength.slice(0,280))}{strength.length>280?'…':''}</p>
   </div>}
  </div>}
  <p className="hhba-job-dossier-footnote">以上节点依据实际保存的岗位研究成果展示，不代表模拟执行步骤；完整 JD、评分依据及职业建议见下方。匹配参考分不等于录用概率。</p>
 </section>;
}
