import {recruitmentText} from './RecruitmentSourceLinks';
import type {MatchResearchDetail} from '../services/resumeMatch';
export function CuratedJobReport({detail,jd,reference=false}:{detail:MatchResearchDetail;jd?:string;reference?:boolean}){
 const sections=[{title:'02｜核心匹配优势',body:detail.strengths},{title:'03｜不足与竞争风险',body:detail.risks},{title:'04｜投递竞争力',body:detail.competition},{title:'05｜职业发展分析',body:detail.career_development},{title:'06｜针对性简历优化方向',body:detail.optimization_advice},{title:'07｜综合评分依据',body:detail.score_explanation}];
 return <div className="hhba-curated-report">
  <section><h4>01｜岗位要求与简历经历逐项对照</h4>
   <div className="hhba-curated-comparison-table" role="table" aria-label="岗位要求和简历证据对照">
    <div className="hhba-curated-comparison-head" role="row"><strong role="columnheader">{reference?'AI 推断的岗位方向':'岗位 JD 原文'}</strong><strong role="columnheader">简历对应经历与分析</strong></div>
    {detail.comparisons.map((c,i)=><div className="hhba-curated-comparison-row" role="row" key={i}>
     <div role="cell">{recruitmentText(c.requirement)}</div><div role="cell"><strong className={'hhba-curated-status '+c.status}>{c.status==='supported'?'有对应经历':c.status==='partial'?'部分匹配':'缺少证据'}</strong>
      {c.resume_evidence&&<p className="hhba-curated-quote">{c.resume_evidence}</p>}<p>{recruitmentText(c.analysis)}</p></div>
    </div>)}
   </div>
  </section>
  {sections.map(s=><section key={s.title}><h4>{recruitmentText(s.title)}</h4><p>{s.body.trim()?recruitmentText(s.body):'本次研究尚未提供该项独立分析；请勿将缺失内容视为已确认结论。'}</p></section>)}
  {detail.extra_sections.map((s,i)=><section key={i}><h4>{recruitmentText(s.title)}</h4><p>{recruitmentText(s.content)}</p></section>)}
  {jd&&<details><summary>查看完整岗位 JD 原文</summary><p>{recruitmentText(jd)}</p></details>}
 </div>;
}
