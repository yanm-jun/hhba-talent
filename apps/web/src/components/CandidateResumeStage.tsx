import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {Check,FileText,RotateCcw,Sparkles,Undo2,X} from 'lucide-react';
import {splitChangedResumeText} from '../services/resumeChangedText.mjs';
import '../styles/siri-edge.css';
import '../styles/candidate-resume-stage.css';

type Props={text:string;fileName:string;loading?:boolean;error?:string;onRetry?:()=>void};
const MAX_LINES=260,MAX_CHARS=38000;
function previewLines(text:string){
 const normalized=text.replace(/\r\n?/g,'\n');
 const all=normalized.slice(0,MAX_CHARS).split('\n').map(s=>s.trim()).filter(Boolean);
 return {lines:all.slice(0,MAX_LINES),truncated:normalized.length>MAX_CHARS||all.length>MAX_LINES};
}
const isSection=(text:string)=>/^(个人简介|教育经历|工作经历|项目经历|专业技能|技能特长|自我评价|联系方式|求职意向|实习经历|荣誉奖项|个人信息|基本信息)(?:\s*[:：])?$/.test(text);

/* All edits stay in React state, in this tab only. No AI, R2, DOCX writes,
 * invented suggestions or automatic applications are triggered here. */
export function CandidateResumeStage({text,fileName,loading=false,error='',onRetry}:Props){
 const {lines,truncated}=useMemo(()=>previewLines(text),[text]);
 const [open,setOpen]=useState(false);
 const [selected,setSelected]=useState<number|null>(null);
 const [draft,setDraft]=useState('');
 const [edits,setEdits]=useState<Record<number,string>>({});
 const [suggestionOpen,setSuggestionOpen]=useState(false);
 const [notice,setNotice]=useState('');
 const dialog=useRef<HTMLDivElement|null>(null);
 const previouslyFocused=useRef<HTMLElement|null>(null);
 const selectedValue=selected===null?'':edits[selected]??lines[selected]??'';
 const draftDirty=selected!==null&&draft!==selectedValue;
 const editedCount=Object.keys(edits).length;
 useEffect(()=>{
  setOpen(false);setEdits({});setSelected(null);
  setDraft('');setSuggestionOpen(false);setNotice('');
 },[fileName,text]);
 useEffect(()=>{
  if(!open)return;
  const oldOverflow=document.body.style.overflow;
  previouslyFocused.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';
  dialog.current?.focus();
  return()=>{document.body.style.overflow=oldOverflow;previouslyFocused.current?.focus()};
 },[open]);
 function close(){
  if((draftDirty||editedCount>0)&&!window.confirm(
   '这些是尚未写回原 Word 的页面草稿，关闭后会丢失。确定退出吗？'))return;
  setOpen(false);setSuggestionOpen(false);
 }
 function chooseLine(i:number){
  if(draftDirty&&!window.confirm('当前段落尚未确认，要放弃草稿并切换段落吗？'))return;
  setSelected(i);setDraft(edits[i]??lines[i]);setSuggestionOpen(true);setNotice('');
 }
 function confirmEdit(){
  if(selected===null)return;
  const value=draft.trim();
  if(!value||value.length>1600){setNotice('段落不能为空且最多 1600 字。');return;}
  setEdits(previous=>{
   const updated={...previous};
   if(value===lines[selected])delete updated[selected];
   else updated[selected]=value;
   return updated;
  });
  setDraft(value);
  setNotice('已确认本段预览，彩虹字体恢复普通颜色；原 Word 未被修改。');
 }
 function keepOriginal(){
  if(selected===null)return;
  setEdits(previous=>{const updated={...previous};delete updated[selected];return updated;});
  setDraft(lines[selected]);
  setNotice('已保留原文。');
 }
 function handleKeys(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();suggestionOpen?setSuggestionOpen(false):close();return;}
  if(event.key!=='Tab'||!dialog.current)return;
  const items=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),textarea:not([disabled]),a[href]'))
   .filter(node=>node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden');
  const first=items[0],last=items[items.length-1];
  if(!first||!last)return;
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
 return <section className="hhba-reading" aria-label="在平台内查看我的简历">
  <div className="hhba-reading-head">
   <div><span><FileText size={15}/> 我的简历</span><h3>上传以后，就能直接查看。</h3>
    <p>先查看原文件中可提取的文字，再决定要不要优化。</p></div>
   {!!lines.length&&!loading&&<button type="button" className="hhba-reading-start" onClick={()=>{
    setOpen(true);setSuggestionOpen(window.innerWidth>700);setSelected(null);setNotice('');
   }}><Sparkles size={16}/> 开始优化简历</button>}
  </div>
  {loading?<p className="hhba-reading-placeholder" role="status">正在本地读取 Word…</p>:
   error?<div className="hhba-reading-alert" role="alert">
    <strong>无法读取这份简历</strong><p>{error}</p>
    {onRetry&&<button type="button" onClick={onRetry}>重新读取</button>}
   </div>:
   !lines.length?<p className="hhba-reading-placeholder">先上传或选择一份 Word 简历。</p>:
   <div className="hhba-reading-card">
    <div className="hhba-reading-filename"><FileText size={15}/>
     <strong>{fileName}</strong><small>当前设备 · 文字预览</small></div>
    <div className="hhba-reading-excerpt">
     {lines.slice(0,6).map((line,i)=><p className={isSection(line)?'is-heading':''} key={i}>{line}</p>)}
     {lines.length>6&&<p className="hhba-reading-more">还有 {lines.length-6} 段内容，打开优化窗口查看。</p>}
    </div>
    {truncated&&<p role="status" className="hhba-reading-limited">这份简历较长，当前预览只显示部分正文；原文件没有删减。</p>}
    <p className="hhba-reading-caption">当前为本地文字阅读预览，暂不等于原 Word 的字体、分页和版式。原版式渲染将在后续能力阶段接入。</p>
   </div>}
  {open&&!!lines.length&&createPortal(
   <div className="hhba-stage-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
    <div className="hhba-stage-modal" role="dialog" aria-modal="true" tabIndex={-1}
     aria-labelledby="hhba-stage-title" ref={dialog} onKeyDown={handleKeys}>
     <header className="hhba-stage-head">
      <div><small>HHBA / 简历优化</small><h2 id="hhba-stage-title">直接在简历里，完成每一次修改。</h2></div>
      <div className="hhba-stage-head-tools"><span>前端交互预览</span>
       <button type="button" aria-label="关闭优化窗口" onClick={close}><X size={19}/></button>
      </div>
     </header>
     <div className="hhba-stage-body">
      <div className="hhba-stage-document">
       <div className="hhba-stage-document-label"><span><FileText size={14}/>{fileName}</span>
        <small>点选文字段落进行修改</small></div>
       <div className="hhba-stage-siri hhba-siri-edge hhba-siri-edge-active">
        <article className="hhba-stage-paper" aria-label="简历正文">
         {lines.map((original,i)=>{
          const shown=edits[i]??original;
          const previewing=selected===i&&draft!==shown;
          const parts=previewing?splitChangedResumeText(shown,draft):null;
          return <button key={i} type="button" onClick={()=>chooseLine(i)}
           className={'hhba-stage-paragraph'+(isSection(original)?' is-heading':'')+
            (selected===i?' is-selected':'')+(previewing?' is-pending':'')}
           aria-label={'编辑第 '+(i+1)+' 段：'+original.slice(0,32)}>
           {parts?<>{parts.prefix}<span className="hhba-resume-siri-letters">{parts.changed||'　'}</span>{parts.suffix}</>:shown}
          </button>;
         })}
         {truncated&&<p className="hhba-stage-truncated">此处未展示全部原文；原 Word 完整保留，不能将当前预览用于正式投递。</p>}
        </article>
       </div>
       <p className="hhba-stage-legend"><i/> 修改中的字才显示彩虹色；确认后恢复普通字体，原 Word 不会改变。</p>
      </div>
      <button type="button" className="hhba-stage-mobile-toggle"
       onClick={()=>{if(selected===null){setSelected(0);setDraft(edits[0]??lines[0]);}setSuggestionOpen(true);}}>
       <Sparkles size={15}/> 查看修改建议
      </button>
      {suggestionOpen&&<button type="button" className="hhba-stage-shade"
       aria-label="关闭建议小弹窗" onClick={()=>setSuggestionOpen(false)}/>}
      <aside className={'hhba-stage-popover'+(suggestionOpen?' is-open':'')}
       aria-label="文字修改建议小弹窗">
       <div className="hhba-stage-popover-header"><div><small>HHBA · ASSISTANT</small><strong>修改建议</strong></div>
        <button type="button" aria-label="关闭建议" onClick={()=>setSuggestionOpen(false)}><X size={16}/></button></div>
       {selected===null?
        <div className="hhba-stage-hint"><Sparkles size={19}/><strong>选中一段文字</strong>
         <p>点击左侧简历的任一段落，在这个小窗口中核对和调整文字。</p>
         <p>AI 自动建议将在后端阶段接入，当前不会编造内容。</p>
        </div>:
        <div className="hhba-stage-editor">
         <small>第 {selected+1} 段 · 原文</small><p className="hhba-stage-original">{lines[selected]}</p>
         <label htmlFor="hhba-stage-draft">修改内容（前端交互）</label>
         <textarea id="hhba-stage-draft" rows={5} maxLength={1600} value={draft}
          className={draftDirty?'hhba-siri-typing':''}
          onChange={e=>{setDraft(e.target.value);setNotice('');}}/>
         <p>这里只演示真实文字的修改过程，不自动生成 AI 建议。所有内容须由本人核实。</p>
         <div className="hhba-stage-editor-buttons">
          <button type="button" className="is-primary" onClick={confirmEdit} disabled={!draft.trim()}>
           <Check size={14}/> 确认本段</button>
          <button type="button" onClick={keepOriginal}><Undo2 size={14}/> 保留原文</button>
         </div>
        </div>}
       {notice&&<p className="hhba-stage-notice" role="status">{notice}</p>}
       <div className="hhba-stage-popover-foot">
        <span>{editedCount>0?'已确认 '+editedCount+' 段（仅预览）':'还没有确认修改'}</span>
        {editedCount>0&&<button type="button" onClick={()=>{
         if(!window.confirm('清空当前预览的修改、恢复原文？原 Word 不受影响。'))return;
         setEdits({});setSelected(null);setDraft('');setNotice('预览已恢复原文。');
        }}><RotateCcw size={13}/> 恢复</button>}
       </div>
      </aside>
     </div>
     <footer className="hhba-stage-footer">
      <p>这阶段只验收界面和交互。不会调用 AI、修改原 Word、生成文件或向企业投递。</p>
      <button type="button" onClick={close}>完成预览</button>
     </footer>
    </div>
   </div>,document.body)}
 </section>;
}
