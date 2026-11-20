import {useState} from 'react';
import {CheckCircle2,Download,FileText,MessageCircleQuestion,RefreshCcw,ShieldCheck,Sparkles} from 'lucide-react';
import type {ResumeWholeRewriteResult} from '../services/resumeWholeRewriteApi';

/**
 * One whole-document review, not a stack of "AI tip" confirmations.
 * Approval is a presentation decision only; it NEVER writes a Word file.
 * Real DOCX writes still need explicit per-location renderer validation.
 */
export function WholeResumeRewriteReview({result,approved,onApprove,onRegenerate,onDownload,revealedCount,documentName,onDocumentNameChange}:{
 result:ResumeWholeRewriteResult;
 approved:boolean;
 onApprove:(approved:boolean)=>void;
 onRegenerate:(answers:Record<string,string>)=>void;
 onDownload:()=>void;
 revealedCount:number;
 documentName:string;
 onDocumentNameChange:(name:string)=>void;
}){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const changes=result.blocks.filter(b=>b.changed);
 const blocked=result.blocks.filter(b=>b.status==='kept_original');
 const complete=result.coverage.source_blocks===result.coverage.analyzed_blocks&&
  result.coverage.analyzed_blocks===result.blocks.length;
 const allVisible=revealedCount>=result.blocks.length;
 return <section className="hhba-whole-rewrite" aria-label="AI 整份岗位定向简历重写稿">
  <header className="hhba-whole-rewrite-heading">
   <div><Sparkles size={17} aria-hidden="true"/>
    <strong>岗位定向整份简历</strong></div>
   <p>{allVisible?'已完成整份改写，请核对所有真实事实。':
    'AI 已完成生成，正在逐段展示真正的改写结果：'+
    Math.min(revealedCount,result.blocks.length)+' / '+result.blocks.length+'。'}</p>
  </header>
  {result.autonomy?.enabled&&<div className="hhba-whole-rewrite-agent-summary" role="status">
   <strong><Sparkles size={14}/> AI 自主处理了 {result.autonomy.rounds} 轮</strong>
   <p>{result.autonomy.stop_reason==='user_evidence_requested'?
    'AI 发现重要信息缺口，已提出需要核实的问题。':
    result.autonomy.needs_more_work?
    '本轮执行到达技术运行边界，现有草稿仍可核对，但不是全部优化已经完成。':
    result.autonomy.stop_reason==='tool_unavailable'?
    '深度审查暂不可用，已保留基础事实核验的整份草稿。':
    'AI 根据岗位与真实经历，选择需要检查和再次撰写的章节。'}</p>
   <div>{result.autonomy.tools_used.map((t,i)=><span key={i}>{
    t.action==='inspect_source'?'查看原始证据':
    t.action==='rewrite_sections'?'重新撰写 '+t.sections.length+' 段':
    t.action==='ask_user'?'询问真实信息':'完成编辑'
   }</span>)}</div>
  </div>}
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
    onClick={()=>{
     // The model may ask several separate questions about one source block.
     // Send ALL real user answers, rather than silently keeping the last.
     const grouped=new Map<string,string[]>();
     for(const [key,value] of Object.entries(answers)){
      const index=key.lastIndexOf('::');
      const blockId=index<0?key:key.slice(0,index);
      if(!value.trim())continue;
      grouped.set(blockId,[...(grouped.get(blockId)||[]),value.trim()]);
     }
     onRegenerate(Object.fromEntries([...grouped].map(([id,items])=>
      [id,items.join('\n')]))); 
    }}><RefreshCcw size={14}/> 用已补充的事实重新撰写</button>
  </div>}
  <div className="hhba-whole-rewrite-blocks">
   {result.blocks.slice(0,revealedCount).map((block,index)=><details key={block.blockId}
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
   <label className="hhba-whole-rewrite-identity">
    <span>简历姓名 <small>仅写入下载的 Word，不发送给 AI</small></span>
    <input type="text" aria-label="岗位简历真实姓名" autoComplete="name"
     value={documentName} maxLength={80} placeholder="填写你的真实姓名"
     onChange={e=>onDocumentNameChange(e.target.value)}/>
   </label>
   <label><input type="checkbox" checked={approved}
    disabled={!complete||!allVisible||!changes.length}
    onChange={e=>onApprove(e.target.checked)}/>
    <span><ShieldCheck size={15}/> 我已整体核对这份 AI 改写稿，确认其中的个人事实属实。</span>
   </label>
   {approved?<p><CheckCircle2 size={14}/> 已确认草稿；可精确定位的短段落可以在原 Word 中逐处保存。
    当前确认不等于已经写入原文件。</p>:
    <p>AI 已完成撰写，但所有内容仍是草稿。任何修改写回原 Word 前还需要版式校验。</p>}
   <button type="button" className="hhba-whole-rewrite-download"
    disabled={!approved||!complete||!allVisible||documentName.trim().length<2} onClick={onDownload}>
    <Download size={15}/> 下载完整岗位定向 Word（新排版）
   </button>
   <small>这是根据整份 AI 草稿生成的可编辑新版 Word，不是覆盖你上传的原版式文件。原件始终保留。</small>
  </div>
 </section>;
}
