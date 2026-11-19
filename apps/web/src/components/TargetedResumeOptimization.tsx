import {useMemo,useState} from 'react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {applySuggestion,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import '../styles/targeted-resume-optimization.css';

export function TargetedResumeOptimization({profile,job}:{profile:CandidateProfile;job:JobMatch}){
 const blocks=useMemo<ResumeBlock[]>(()=>[
  ...profile.experiences.filter(e=>e.evidence.trim()).map((e,i)=>({id:'experience-'+i,section:'experience' as const,text:e.evidence})),
  ...profile.skills.filter(s=>s.evidence.trim()).map((s,i)=>({id:'skill-'+i,section:'skills' as const,text:s.evidence}))
 ],[profile]);
 const [version,setVersion]=useState<ResumeVersion>(()=>({id:'draft-'+job.id,targetJobId:job.id,blocks,acceptedSuggestionIds:[]}));
 const [ignored,setIgnored]=useState<string[]>([]);
 const [notice,setNotice]=useState('');
 // Evidence-only preview. AI-generated suggestions will arrive via a validated server endpoint.
 const suggestions=useMemo<ResumeSuggestion[]>(()=>blocks.map(block=>{
  const isExperience=block.section==='experience';
  const original=block.text;
  const role=isExperience?profile.experiences[Number(block.id.split('-')[1])]?.role:profile.skills[Number(block.id.split('-')[1])]?.name;
  return {id:'suggest-'+block.id,blockId:block.id,original,
   proposed:role?role+'：'+original:original,
   action:'replace',rationale:'突出已有证据的职责或技能，不添加未经证实的事实。',
   jobRequirement:job.title_zh||job.title,evidenceStatus:'verified'};
 }).filter(s=>s.proposed!==s.original),[blocks,profile,job]);
 function accept(s:ResumeSuggestion){
  try{setVersion(v=>applySuggestion(v,s));setNotice('已填充到本次预览。原始简历文件未修改。')}
  catch{setNotice('原文已经变化，请重新生成建议。')}
 }
 return <section className="targeted-resume" aria-label="岗位定向简历优化">
  <div className="targeted-resume-heading"><div><small>HHBA · 岗位定向优化</small><h3>{job.title_zh||job.title}</h3><p>仅基于简历中已有的证据提供表达建议。此处为本地预览，尚未调用新的 AI 润色接口。</p></div><span>原位润色预览</span></div>
  <div className="targeted-resume-paper">
   <header><h4>岗位专属简历</h4><p>目标企业：{job.company} · 原始文件保持不变</p></header>
   {version.blocks.map(block=>{
    const s=suggestions.find(x=>x.blockId===block.id);
    const accepted=s&&version.acceptedSuggestionIds.includes(s.id);
    const dismissed=s&&ignored.includes(s.id);
    return <div className="targeted-resume-block" key={block.id}>
     <small>{block.section==='experience'?'工作经历':'专业技能'}</small>
     <p>{block.text}</p>
     {s&&!accepted&&!dismissed&&<div className="targeted-resume-suggestion">
      <span className="targeted-resume-ai-label">✦ 建议表达 · 基于已有证据</span>
      <p className="targeted-resume-gradient">{s.proposed}</p>
      <div className="targeted-resume-actions">
       <button type="button" onClick={()=>accept(s)}>填充此建议</button>
       <button type="button" onClick={()=>setIgnored(v=>[...v,s.id])}>保留原文</button>
      </div>
     </div>}
     {accepted&&<span className="targeted-resume-applied">✓ 已填充</span>}
    </div>
   })}
   {!blocks.length&&<p>尚未提取到可引用的工作或技能证据，请先完善原始简历。</p>}
  </div>
  <div className="targeted-resume-footer">
   <p>当前岗位相关性参考：{job.reference_score}/100。该分数不会因文字润色自动上调，必须经过同一评分规则重新评估。</p>
   <button type="button" onClick={()=>{setVersion({id:'draft-'+job.id,targetJobId:job.id,blocks,acceptedSuggestionIds:[]});setIgnored([]);setNotice('已恢复本次预览。')}}>恢复原始预览</button>
  </div>
  {notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
 </section>;
}
