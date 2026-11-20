/** One coherent user-visible HHBA job application journey.
 * The AI tools, provider choice and draft internals live behind these stages.
 */
export const CANDIDATE_JOURNEY_LABELS=[
 '上传简历','AI 找岗位','匹配评分','定向优化','官网投递'
] as const;
export function CandidateJourneySteps({current,compact=false}:{
 current:1|2|3|4|5;compact?:boolean
}){
 return <nav className={'hhba-journey'+(compact?' is-compact':'')}
  aria-label="求职流程">
  <ol>
   {CANDIDATE_JOURNEY_LABELS.map((label,index)=>{
    const step=index+1;
    return <li key={label}
     className={step===current?'is-current':step<current?'is-done':'is-upcoming'}
     aria-current={step===current?'step':undefined}>
      <span className="hhba-journey-index" aria-hidden="true">
       {step<current?'✓':String(step).padStart(2,'0')}
      </span>
      <span className="hhba-journey-label">{label}</span>
     </li>;
   })}
  </ol>
 </nav>;
}
