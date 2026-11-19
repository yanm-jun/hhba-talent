import type {ReactNode} from 'react';
import type {ResumeDocument} from '../services/resumeDocument';
import '../styles/resume-print.css';

export function ResumePrintSheet({document,renderBlock}:{document:ResumeDocument;renderBlock?:(id:string,text:string)=>ReactNode}){
 const {details,education,experiences,skills,sourceParagraphs}=document;
 return <article className="hhba-print-sheet" aria-label="可打印的岗位专属简历">
  <header className="hhba-print-header">
   <div className="hhba-print-identification">
    <h2>{details.fullName||'姓名待填写'}</h2>
    {details.headline&&<p className="hhba-print-headline">{details.headline}</p>}
   </div>
   <div className="hhba-print-contact">
    {[details.phone,details.email,details.location].filter(Boolean).map((line,i)=>
     <span key={i}>{line}</span>)}
   </div>
  </header>
  {details.summary&&<section className="hhba-print-section">
   <h3>职业概述</h3><p className="hhba-print-paragraph">{details.summary}</p>
  </section>}
  {experiences.length>0&&<section className="hhba-print-section">
   <h3>工作经历</h3>
   {experiences.map(e=><div className="hhba-print-experience" key={e.id}>
    <div className="hhba-print-experience-top">
     <strong>{e.title||'工作经历'}</strong>
     {e.period&&<span>{e.period}</span>}
    </div>
    {e.organization&&<p className="hhba-print-organization">{e.organization}</p>}
    {renderBlock?renderBlock(e.id,e.details):<p className="hhba-print-paragraph">{e.details}</p>}
   </div>)}
  </section>}
  {education.length>0&&<section className="hhba-print-section">
   <h3>教育背景</h3>
   {education.map((e,i)=><p className="hhba-print-paragraph" key={i}>{e}</p>)}
  </section>}
  {skills.length>0&&<section className="hhba-print-section">
   <h3>专业技能</h3>
   {skills.map((skill,i)=><div className="hhba-print-skill" key={i}>
    {skill.name&&<strong>{skill.name}</strong>}
    {renderBlock?renderBlock('skill-'+i,skill.details):<p className="hhba-print-paragraph">{skill.details}</p>}
   </div>)}
  </section>}
  {sourceParagraphs.length>0&&<section className="hhba-print-section">
   <h3>简历原始内容（请检查并整理）</h3>
   {sourceParagraphs.map((content,i)=>renderBlock?
    <div key={i}>{renderBlock('source-'+i,content)}</div>:
    <p className="hhba-print-paragraph hhba-print-source" key={i}>{content}</p>)}
  </section>}
  {!details.summary&&!experiences.length&&!education.length&&!skills.length&&!sourceParagraphs.length&&
   <p className="hhba-print-placeholder">请先补充真实简历内容。</p>}
 </article>;
}
