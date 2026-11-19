import {useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Undo2,ShieldCheck,LoaderCircle,CheckCircle2,Save,FolderOpen,Printer,Eye,PencilLine} from 'lucide-react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {getRealAuthToken,realAuthReady} from '../services/realAuth';
import {getResumeOptimizationStatus,requestResumeOptimization,type ResumeOptimizationStatus} from '../services/resumeOptimizationApi';
import {applySuggestion,validateSuggestion,editResumeBlock,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import {evidenceVisibility} from '../services/resumeEvidenceVisibility';
import {deleteResumeVersion,listResumeVersions,saveResumeVersion,type SavedResumeVersion} from '../services/resumeVersionsApi';
import {buildResumeDocument,readableResumeDocument,normalizeResumeDocumentDetails,EMPTY_RESUME_DOCUMENT_DETAILS,type ResumeDocumentDetails} from '../services/resumeDocument';
import {ResumePrintSheet} from './ResumePrintSheet';
import '../styles/targeted-resume-optimization.css';

export function TargetedResumeOptimization({profile,job}:{profile:CandidateProfile;job:JobMatch}){
 const blocks=useMemo<ResumeBlock[]>(()=>[
  ...(Array.isArray(profile.experiences)?profile.experiences:[]).filter(e=>e.evidence?.trim()).map((e,i)=>({id:'experience-'+i,section:'experience' as const,text:e.evidence.slice(0,1600)})),
  ...(Array.isArray(profile.skills)?profile.skills:[]).filter(s=>s.evidence?.trim()).map((s,i)=>({id:'skill-'+i,section:'skills' as const,text:s.evidence.slice(0,1600)}))
 ].slice(0,12),[profile]);
 const initial=()=>({id:'draft-'+job.id,targetJobId:job.id,blocks,acceptedSuggestionIds:[] as string[]});
 const [version,setVersion]=useState<ResumeVersion>(initial);
 const [suggestions,setSuggestions]=useState<ResumeSuggestion[]>([]);
 const [ignored,setIgnored]=useState<string[]>([]);
 const [confirmed,setConfirmed]=useState<string[]>([]);
 const [newEvidence,setNewEvidence]=useState<Record<string,string>>({});
 const [consent,setConsent]=useState(false);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState<ResumeOptimizationStatus|null>(null);
 const [saved,setSaved]=useState<SavedResumeVersion[]>([]);
 const [storageReady,setStorageReady]=useState(false);
 const [saving,setSaving]=useState(false);
 const [details,setDetails]=useState<ResumeDocumentDetails>({...EMPTY_RESUME_DOCUMENT_DETAILS});
 const [confirmReal,setConfirmReal]=useState(false);
 const [showPrintPreview,setShowPrintPreview]=useState(false);
 const [editingBlock,setEditingBlock]=useState<string|null>(null);
 const [manualText,setManualText]=useState('');
 const generation=useRef(0);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  getResumeOptimizationStatus(abort.signal).then(setStatus);
  return ()=>{abort.abort();active.current?.abort();};
 },[]);
 useEffect(()=>{
  if(!realAuthReady||!getRealAuthToken())return;
  let alive=true;
  listResumeVersions(job.id).then(data=>{
   if(alive){setSaved(data.items);setStorageReady(true);}
  }).catch(()=>{if(alive)setStorageReady(false);});
  return ()=>{alive=false;};
 },[job.id]);
 const requirements=useMemo(()=>[
  job.requirements_basis,...job.matched,...job.not_evidenced,...job.needs_verification
 ].filter(Boolean).join('\n').slice(0,2500),[job]);
 const criteria=useMemo(()=>[...job.matched,...job.not_evidenced], [job]);
 const printDocument=useMemo(()=>buildResumeDocument(profile,version.blocks,details),[profile,version.blocks,details]);
 const canPrint=readableResumeDocument(printDocument);
 function updateDetail(key:keyof ResumeDocumentDetails,value:string){
  setDetails(current=>({...current,[key]:value}));
  setConfirmReal(false);
 }
 const before=useMemo(()=>evidenceVisibility(criteria,blocks),[criteria,blocks]);
 const after=useMemo(()=>evidenceVisibility(criteria,version.blocks),[criteria,version.blocks]);
 async function persist(){
  if(saving||!confirmReal||!storageReady||!canPrint)return;
  setSaving(true);setNotice('');
  try{
   await saveResumeVersion({id:job.id,title:job.title_zh||job.title,company:job.company},
    version.blocks,version.acceptedSuggestionIds,details);
   const data=await listResumeVersions(job.id);
   setSaved(data.items);
   setNotice('已保存本岗位专属简历版本到你的 HHBA 账户。');
  }catch(err){setNotice(err instanceof Error?err.message:'保存失败，请重试。');}
  finally{setSaving(false);}
 }
 function restore(item:SavedResumeVersion){
  active.current?.abort();setBusy(false);
  setVersion({id:item.id,targetJobId:job.id,blocks:item.version.blocks,
   acceptedSuggestionIds:item.version.acceptedSuggestionIds});
  setDetails(normalizeResumeDocumentDetails(item.version.details));setConfirmReal(false);
  setSuggestions([]);setIgnored([]);setConfirmed([]);setNewEvidence({});
  setNotice('已载入 '+new Date(item.created_at).toLocaleString()+' 的简历版本；没有修改原始简历。');
 }
 async function remove(item:SavedResumeVersion){
  if(!window.confirm('确定删除此岗位的已保存简历版本吗？'))return;
  try{
   await deleteResumeVersion(item.id);
   setSaved(previous=>previous.filter(v=>v.id!==item.id));
   setNotice('已删除选中的云端简历版本。');
  }catch(err){setNotice(err instanceof Error?err.message:'删除失败，请重试。');}
 }
 async function generate(){
  if(!consent||!blocks.length||busy||!status?.enabled)return;
  const currentBlocks=version.blocks;
  setBusy(true);setNotice('');setSuggestions([]);setIgnored([]);setConfirmed([]);setNewEvidence({});
  const controller=new AbortController();active.current=controller;
  try{
   const incoming=await requestResumeOptimization(currentBlocks,{
    title:(job.title_zh||job.title).slice(0,120),requirements
   },controller.signal);
   const unique=new Set<string>(),usedBlocks=new Set<string>();
   const accepted=incoming.filter(s=>{
    if(unique.has(s.id)||usedBlocks.has(s.blockId)||!validateSuggestion(currentBlocks,s))return false;
    unique.add(s.id);usedBlocks.add(s.blockId);return true;
   }).map((s,i)=>({...s,id:('generation-'+(++generation.current)+'-'+i+'-'+s.id).slice(0,100)}));
   setSuggestions(accepted);
   setNotice(accepted.length?'建议已生成。请逐条核实真实性，再选择填充。':'本次 AI 未发现可以可靠润色的内容。');
  }catch(error){
   if(controller.signal.aborted)return;
   setNotice(error instanceof Error?error.message:'AI 润色暂时不可用。');
  }finally{setBusy(false);if(active.current===controller)active.current=null;}
 }
 function accept(s:ResumeSuggestion){
  if(s.evidenceStatus==='needs_user_confirmation'&&!confirmed.includes(s.id)){
   setNotice('请先确认建议内容符合你的真实经历。');return;
  }
  try{
   setVersion(applySuggestion(version,s,confirmed.includes(s.id)));setConfirmReal(false);
   setNotice('已填充到本次预览，原始简历文件没有被修改。');
  }catch{setNotice('原文已变化或缺乏真实证据，请重新生成建议。');}
 }
 function addFact(s:ResumeSuggestion){
  const text=(newEvidence[s.id]||'').trim();
  if(text.length<8){setNotice('请具体描述你的真实经历或成果，至少8个字。');return;}
  if(!confirmed.includes(s.id)){setNotice('请确认补充内容真实、准确后再填充。');return;}
  try{
   setVersion(applySuggestion(version,{...s,action:'append',proposed:text},true));setConfirmReal(false);
   setNotice('已将你亲自填写的真实信息添加到当前简历预览。');
  }catch{setNotice('原文已经变化，请重新生成补充建议。');}
 }
 function startEdit(block:ResumeBlock){
  setEditingBlock(block.id);setManualText(block.text);
 }
 function saveEdit(){
  if(!editingBlock)return;
  try{
   setVersion(editResumeBlock(version,editingBlock,manualText));
   setSuggestions(existing=>existing.filter(s=>s.blockId!==editingBlock));
   setEditingBlock(null);setManualText('');setConfirmReal(false);
   setNotice('已更新本次简历的文字内容。所有手动修改须以真实经历为准。');
  }catch{setNotice('请输入有效内容，单个段落最多 1600 字。');}
 }
 function reset(){
  active.current?.abort();setBusy(false);setVersion(initial());setSuggestions([]);
  setIgnored([]);setConfirmed([]);setNewEvidence({});setConfirmReal(false);setEditingBlock(null);setNotice('已恢复原始预览。');
 }
 const hasSession=realAuthReady&&Boolean(getRealAuthToken());
 return <section className="targeted-resume" aria-label="岗位定向简历优化">
  <div className="targeted-resume-heading">
   <div><small>HHBA / 岗位定向优化</small><h3>{job.title_zh||job.title}</h3>
    <p>AI 建议原位展示，逐条确认后填充。原始简历文件始终不变。</p></div>
   <span><Sparkles size={13} aria-hidden="true"/> 原位智能润色</span>
  </div>
  <div className="targeted-resume-toolbar">
   <div><strong>开始为这个岗位润色</strong><p>依据已识别的工作经历、技能证据与岗位要求生成建议，避免凭空编造。</p></div>
   {hasSession&&status?.enabled
    ?<button type="button" disabled={!consent||busy||!blocks.length} onClick={generate}>
       {busy?<><LoaderCircle size={15} className="resume-match-spinning"/> 正在生成…</>:<><Sparkles size={15}/> 生成 AI 建议</>}
      </button>
    :<span className="targeted-resume-unavailable">{!hasSession?'站内登录后可使用 AI 润色':status?'AI 润色尚未开放':'正在检查服务状态…'}</span>}
  </div>
  {hasSession&&status?.enabled&&<label className="targeted-resume-consent">
   <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
   <span>我同意将下方展示的简历证据片段与该岗位要求发送给平台选定的第三方 AI 服务商进行润色。服务器会尽力脱敏常见联系方式，但不能确保移除所有个人信息。建议内容只供本人核实与选择，不会自动投递。</span>
  </label>}
  <div className="targeted-resume-paper">
   <header><h4>岗位定向简历 · 证据预览</h4><p>目标企业：{job.company} · 当前展示 AI 识别出的证据片段，完整排版将在后续阶段接入 · 原始文件保持不变</p></header>
   {version.blocks.map(block=>{
    const s=suggestions.find(x=>x.blockId===block.id);
    const applied=Boolean(s&&version.acceptedSuggestionIds.includes(s.id));
    const dismissed=Boolean(s&&ignored.includes(s.id));
    return <div className="targeted-resume-block" key={block.id}>
     <div className="targeted-resume-block-label">
      <small>{block.section==='experience'?'工作经历':'专业技能'}</small>
      <button type="button" onClick={()=>startEdit(block)}><PencilLine size={13}/> 编辑原文</button>
     </div>
     {editingBlock===block.id?<div className="targeted-resume-inline-editor">
      <textarea rows={4} maxLength={1600} value={manualText}
       onChange={e=>setManualText(e.target.value)}
       aria-label="编辑当前简历段落"/>
      <div><button type="button" onClick={saveEdit}>保存本次修改</button>
       <button type="button" onClick={()=>{setEditingBlock(null);setManualText('')}}>取消</button></div>
     </div>:<p>{block.text}</p>}
     {s&&!applied&&!dismissed&&editingBlock!==block.id&&<div className="targeted-resume-suggestion">
      <span className="targeted-resume-ai-label"><Sparkles size={13} aria-hidden="true"/> AI 建议 · {s.action==='request_evidence'?'需要补充真实信息':'待用户核实'}</span>
      <p className="targeted-resume-gradient">{s.proposed}</p>
      <p className="targeted-resume-rationale">对应岗位要求：{s.jobRequirement}</p>
      <p className="targeted-resume-rationale">{s.rationale}</p>
      {s.action==='request_evidence'&&<label className="targeted-resume-fact-entry">
       <span>补充你的真实经历或成果（不会使用 AI 猜测的数据）</span>
       <textarea maxLength={800} rows={3} value={newEvidence[s.id]||''}
        onChange={e=>setNewEvidence(prev=>({...prev,[s.id]:e.target.value}))}
        placeholder="例如：在某项工作中具体做了什么、取得了什么可核实的结果"/>
      </label>}
      <label className="targeted-resume-confirm">
       <input type="checkbox" checked={confirmed.includes(s.id)}
        onChange={e=>setConfirmed(v=>e.target.checked?[...v,s.id]:v.filter(id=>id!==s.id))}/>
       我已核实建议或补充内容中的经历、能力和数据均属实
      </label>
      <div className="targeted-resume-actions">
       {s.action==='request_evidence'
        ?<button type="button" disabled={!confirmed.includes(s.id)||!(newEvidence[s.id]||'').trim()} onClick={()=>addFact(s)}>填充我的补充</button>
        :<button type="button" disabled={!confirmed.includes(s.id)} onClick={()=>accept(s)}>填充此建议</button>}
       <button type="button" onClick={()=>setIgnored(v=>[...v,s.id])}>保留原文</button>
      </div>
     </div>}
     {applied&&<span className="targeted-resume-applied"><CheckCircle2 size={13} aria-hidden="true"/> 已填充</span>}
    </div>;
   })}
   {!version.blocks.length&&<p>未提取到可引用的工作或技能证据，请先完善原始简历。</p>}
  </div>
  <section className="targeted-resume-document-editor" aria-label="正式简历排版与打印">
   <div className="targeted-resume-document-heading">
    <div><strong>正式简历排版</strong>
     <p>用已识别的真实经历生成简洁的 A4 简历；请手动补全姓名等缺失信息，系统不会猜测个人资料。</p>
    </div>
    <div className="targeted-resume-document-actions">
     <button type="button" onClick={()=>setShowPrintPreview(v=>!v)}><Eye size={15}/>{showPrintPreview?'收起预览':'预览 A4'}</button>
     <button type="button" disabled={!canPrint} onClick={()=>window.print()}><Printer size={15}/> 打印 / 保存 PDF</button>
    </div>
   </div>
   <div className="targeted-resume-document-fields">
    <label>姓名 <input maxLength={80} value={details.fullName} placeholder="请填写本人真实姓名" onChange={e=>updateDetail('fullName',e.target.value)}/></label>
    <label>职业标题 <input maxLength={120} value={details.headline} placeholder="例如：区域运营督导" onChange={e=>updateDetail('headline',e.target.value)}/></label>
    <label>联系邮箱 <input type="email" maxLength={120} value={details.email} placeholder="自行填写" onChange={e=>updateDetail('email',e.target.value)}/></label>
    <label>联系电话 <input type="tel" maxLength={60} value={details.phone} placeholder="自行填写" onChange={e=>updateDetail('phone',e.target.value)}/></label>
    <label>所在地区 <input maxLength={120} value={details.location} placeholder="城市 / 地区" onChange={e=>updateDetail('location',e.target.value)}/></label>
    <label className="wide">教育信息补充 <textarea rows={2} maxLength={600} value={details.educationDetails}
     placeholder="院校、专业、就读时间等，以真实经历为准"
     onChange={e=>updateDetail('educationDetails',e.target.value)}/></label>
    <label className="wide">职业概述 <textarea rows={3} maxLength={800} value={details.summary}
     placeholder="用自己的真实工作经历和求职方向概括优势"
     onChange={e=>updateDetail('summary',e.target.value)}/></label>
   </div>
   <p className="targeted-resume-print-note">打印功能会调用浏览器的打印对话框，可选择「保存为 PDF」。AI 渐变建议、填充按钮和后台说明不会进入打印文件。生成内容仅覆盖识别到的经历和你填写的信息，不能保证无损还原上传文件。</p>
   {!canPrint&&<p className="targeted-resume-print-note" role="status">请至少填写真实姓名并确保已有一项简历内容，才能打印。</p>}
  </section>
  <div className={showPrintPreview?'targeted-resume-print-preview':'targeted-resume-print-preview is-collapsed'}>
   <ResumePrintSheet document={printDocument}/>
  </div>
  {before.score!==null&&<div className="targeted-resume-audit" aria-label="文字证据覆盖变化">
   <div><small>优化前 · 要求文字覆盖</small><strong>{before.score}%</strong></div>
   <span aria-hidden="true">→</span>
   <div><small>当前版本 · 要求文字覆盖</small><strong>{after.score}%</strong></div>
   <p>按现有岗位卡片列出的 {before.total} 条要求计算文字相似度，仅用于检查表达是否更清楚；不是岗位匹配分、任职资格判断或录用概率。需人工核实建议的事实依据。</p>
   {after.missing.length>0&&<details><summary>仍未充分体现的要求（{after.missing.length}）</summary>
    <ul>{after.missing.map((label,index)=><li key={index}>{label}</li>)}</ul></details>}
  </div>}
  <div className="targeted-resume-save">
   <div><strong><FolderOpen size={16} aria-hidden="true"/> 我的岗位简历版本</strong>
    <p>仅在你主动保存后，将当前已确认的文字片段保存在 HHBA 私人账号中；不保存原始 PDF/DOCX。</p></div>
   {hasSession&&storageReady&&<button type="button" disabled={saving||!confirmReal||!canPrint} onClick={persist}>
    <Save size={14} aria-hidden="true"/>{saving?'保存中…':'保存当前版本'}</button>}
   {hasSession&&!storageReady&&<span className="targeted-resume-unavailable">云端版本保存尚未开放或数据库未就绪</span>}
  </div>
  {hasSession&&storageReady&&<label className="targeted-resume-confirm targeted-resume-save-confirm">
   <input type="checkbox" checked={confirmReal} onChange={e=>setConfirmReal(e.target.checked)}/>
   我已核实当前简历的全部文字及个人联系方式真实准确，理解点击保存后这些资料会保存在我的 HHBA 云端账户，直到我主动删除或按平台数据政策处理。
  </label>}
  {saved.length>0&&<div className="targeted-resume-history">
   {saved.map(item=><div key={item.id}>
    <span>{new Date(item.created_at).toLocaleString()} · {item.version.acceptedSuggestionIds.length} 条已采纳</span>
    <button type="button" onClick={()=>restore(item)}>载入</button>
    <button type="button" onClick={()=>remove(item)}>删除</button>
   </div>)}
  </div>}
  <div className="targeted-resume-footer">
   <p><ShieldCheck size={14} aria-hidden="true"/> 岗位相关性参考：{job.reference_score}/100。润色后的匹配分须通过同一评分规则重新评估；本预览不虚报分数。</p>
   <button type="button" onClick={reset}><Undo2 size={14}/> 恢复原始预览</button>
  </div>
  {notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
 </section>;
}
