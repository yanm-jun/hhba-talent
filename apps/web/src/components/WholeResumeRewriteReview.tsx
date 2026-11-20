import {useState} from 'react';
import {CheckCircle2,Download,FileText,MessageCircleQuestion,RefreshCcw,ShieldCheck,Sparkles} from 'lucide-react';
import type {ResumeWholeRewriteResult} from '../services/resumeWholeRewriteApi';

/**
 * One whole-document review, not a stack of "AI tip" confirmations.
 * Approval is a presentation decision only; it NEVER writes a Word file.
 * Real DOCX writes still need explicit per-location renderer validation.
 */
export function WholeResumeRewriteReview({result,approved,onApprove,onRegenerate,onDownload}:{
 result:ResumeWholeRewriteResult;
 approved:boolean;
 onApprove:(approved:boolean)=>void;
 onRegenerate:(answers:Record<string,string>)=>void;
 onDownload:()=>void;
}){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const changes=result.blocks.filter(b=>b.changed);
 const blocked=result.blocks.filter(b=>b.status==='kept_original');
 const complete=result.coverage.source_blocks===result.coverage.analyzed_blocks&&
  result.coverage.analyzed_blocks===result.blocks.length;
 return <section className="hhba-whole-rewrite" aria-label="AI 整份岗位定向简历重写稿">
  <header className="hhba-whole-rewrite-heading">
   <div><Sparkles size={17} aria-hidden="true"/>
    <strong>岗位定向整份简历</strong></div>
   <p>AI 已根据真实岗位要求主动重写，不只是几条润色建议。</p>
  </header>
  <div className="hhba-whole-rewrite-metrics" role="status">
   <span>读取段落 <strong>{result.coverage.analyzed_blocks}</strong></span>
   <span>改写段落 <strong>{changes.length}</strong></span>
   <span>待补证据 <strong>{result.questions.length+blocked.length}</strong></span>
  </div>
  {!complete&&<p role="alert">完整性验证未通过：没有处理到每一段原文。不能将结果作为整份简历。</p>}
  {result.questions.length>0&&<div className="hhba-whole-rewrite-questions">
   <h4><MessageCircleQuestion size={16}/> AI 需要你补充的真实信息</h4>
   <p>只问原简历缺失且与岗位有关的事实。没有的经历可以留空，不能编造。</p>
   {result.questions.map((q,i)=><label key={i}>
    <span>{i+1}. {q.question}</span>
    <textarea aria-label={'补充事实 '+(i+1)} rows={2} maxLength={2000}
     placeholder="只填写真实经历、职责或成果；没有就留空"
     value={answers[q.blockId+'::'+i]||''}
     onChange={e=>setAnswers(before=>({...before,[q.blockId+'::'+i]:e.target.value}))}/>
   </label>)}
   <button type="button" disabled={!Object.values(answers).some(x=>x.trim())}
    onClick={()=>onRegenerate(Object.fromEntries(
     Object.entries(answers).filter(([,value])=>value.trim()).map(([key,value])=>[key.split('::')[0],value.trim()])
    ))}><RefreshCcw size={14}/> 用已补充的事实重新撰写</button>
  </div>}
  <div className="hhba-whole-rewrite-blocks">
   {result.blocks.map((block,index)=><details key={block.blockId}
    className={'hhba-whole-rewrite-block'+(block.changed?' is-changed':'')}>
    <summary>
     <span><FileText size={14}/>{String(index+1).padStart(2,'0')} · {
      block.section==='experience'?'工作经历':
      block.section==='skills'?'专业技能':
      block.section==='projects'?'项目经历':
      block.section==='education'?'教育背景':'简历内容'}</span>
     <small>{block.changed?'AI 已重写':'保留原文'}</small>
    </summary>
    <div className="hhba-whole-rewrite-diff">
     <div><strong>原文</strong><p>{block.original}</p></div>
     <div><strong>AI 改写</strong><p>{block.proposed}</p></div>
     {block.rationale&&<small>{block.rationale}</small>}
     {block.changed&&block.original.length>300&&<small>
      本段已生成完整文字。原 Word 长段落自动写回仍需版式验证，不能直接认为已保存。
     </small>}
    </div>
   </details>)}
  </div>
  <div className="hhba-whole-rewrite-approval">
   <label><input type="checkbox" checked={approved}
    disabled={!complete||!changes.length}
    onChange={e=>onApprove(e.target.checked)}/>
    <span><ShieldCheck size={15}/> 我已整体核对这份 AI 改写稿，确认其中的个人事实属实。</span>
   </label>
   {approved?<p><CheckCircle2 size={14}/> 已确认草稿；可精确定位的短段落可以在原 Word 中逐处保存。
    当前确认不等于已经写入原文件。</p>:
    <p>AI 已完成撰写，但所有内容仍是草稿。任何修改写回原 Word 前还需要版式校验。</p>}
   <button type="button" className="hhba-whole-rewrite-download"
    disabled={!approved||!complete} onClick={onDownload}>
    <Download size={15}/> 下载完整岗位定向 Word（新排版）
   </button>
   <small>这是根据整份 AI 草稿生成的可编辑新版 Word，不是覆盖你上传的原版式文件。原件始终保留。</small>
  </div>
 </section>;
}
