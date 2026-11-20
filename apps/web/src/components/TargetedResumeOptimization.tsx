import {useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Undo2,ShieldCheck,LoaderCircle,CheckCircle2,Save,FolderOpen,Printer,FileDown,PencilLine,X} from 'lucide-react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {getRealAuthToken,realAuthReady} from '../services/realAuth';
import {getResumeOptimizationStatus,requestResumeOptimization,type ResumeOptimizationStatus} from '../services/resumeOptimizationApi';
import {applySuggestion,validateSuggestion,editResumeBlock,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import {evidenceVisibility} from '../services/resumeEvidenceVisibility';
import {deleteResumeVersion,listResumeVersions,saveResumeVersion,type SavedResumeVersion} from '../services/resumeVersionsApi';
import {buildResumeDocument,readableResumeDocument,normalizeResumeDocumentDetails,sourceResumeBlocks,sourceResumeOmittedCharacters,structuredResumeOmittedCharacters,EMPTY_RESUME_DOCUMENT_DETAILS,type ResumeDocumentDetails} from '../services/resumeDocument';
import {createPortal} from 'react-dom';
import {Link} from '../router';
import {ResumePrintSheet} from './ResumePrintSheet';
import {downloadResumeDocx} from '../services/resumeDocx';
import {reassessmentStatus,reassessResume,type ReassessmentStatus,type ReassessmentResult} from '../services/resumeReassessmentApi';
import {officialJobVerifyStatus,verifyOfficialJob,type OfficialJobVerifyStatus,type OfficialVerifiedJob} from '../services/officialJobVerifyApi';
import '../styles/targeted-resume-optimization.css';
import '../styles/siri-edge.css';

export function TargetedResumeOptimization({profile,job,sourceText}:{profile:CandidateProfile;job:JobMatch;sourceText?:string}){
 const blocks=useMemo<ResumeBlock[]>(()=>{
 const originals=[
  ...(Array.isArray(profile.experiences)?profile.experiences:[]).filter(e=>e.evidence?.trim()).map((e,i)=>({id:'experience-'+i,section:'experience' as const,text:e.evidence.slice(0,1600)})),
  ...(Array.isArray(profile.skills)?profile.skills:[]).filter(s=>s.evidence?.trim()).map((s,i)=>({id:'skill-'+i,section:'skills' as const,text:s.evidence.slice(0,1600)}))
 ].slice(0,12);
 // Newer search-first flows preserve local source text, but do not yet expose
 // verified structured work-history records. Keep raw paragraphs unmistakably
 // labelled as source text, rather than inventing roles or employers.
 if(!profile.experiences?.length&&sourceText?.trim())return sourceResumeBlocks(sourceText);
 return originals;
 },[profile,sourceText]);
 const omittedSourceCharacters=useMemo(()=>(
  !profile.experiences?.length&&sourceText
   ?sourceResumeOmittedCharacters(sourceText,blocks)
   :structuredResumeOmittedCharacters(profile)
 ),[profile,sourceText,blocks]);
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
 const [scoreStatus,setScoreStatus]=useState<ReassessmentStatus|null>(null);
 const [verifyStatus,setVerifyStatus]=useState<OfficialJobVerifyStatus|null>(null);
 const [verifiedJob,setVerifiedJob]=useState<OfficialVerifiedJob|null>(null);
 const [consentVerify,setConsentVerify]=useState(false);
 const [confirmedVerifiedJob,setConfirmedVerifiedJob]=useState(false);
 const [verifying,setVerifying]=useState(false);
 const [scoreResult,setScoreResult]=useState<ReassessmentResult|null>(null);
 const [scoring,setScoring]=useState(false);
 const [confirmReassessment,setConfirmReassessment]=useState(false);
 const [saved,setSaved]=useState<SavedResumeVersion[]>([]);
 const [storageReady,setStorageReady]=useState(false);
 const [saving,setSaving]=useState(false);
 const [details,setDetails]=useState<ResumeDocumentDetails>({...EMPTY_RESUME_DOCUMENT_DETAILS});
 const [confirmReal,setConfirmReal]=useState(false);
 const [openSuggestionId,setOpenSuggestionId]=useState<string|null>(null);
 const [editingSuggestionId,setEditingSuggestionId]=useState<string|null>(null);
 const [suggestionDrafts,setSuggestionDrafts]=useState<Record<string,string>>({});
 const [undoStack,setUndoStack]=useState<ResumeVersion[]>([]);
 const [editingBlock,setEditingBlock]=useState<string|null>(null);
 const [manualText,setManualText]=useState('');
 const generation=useRef(0);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  getResumeOptimizationStatus(abort.signal).then(setStatus);
  reassessmentStatus(abort.signal).then(setScoreStatus);
  officialJobVerifyStatus(abort.signal).then(setVerifyStatus);
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
 const canPrint=readableResumeDocument(printDocument)&&omittedSourceCharacters===0;
 const canExport=canPrint&&!editingBlock;
 function updateDetail(key:keyof ResumeDocumentDetails,value:string){
  setDetails(current=>({...current,[key]:value}));
  setConfirmReal(false);
 }
 const before=useMemo(()=>evidenceVisibility(criteria,blocks),[criteria,blocks]);
 const after=useMemo(()=>evidenceVisibility(criteria,version.blocks),[criteria,version.blocks]);
 const hasAuditedAtsIdentity=/^(?:ashby|greenhouse|lever)-/.test(job.id);
 const scoreJobId=hasAuditedAtsIdentity?job.id:
  (verifiedJob&&confirmedVerifiedJob?verifiedJob.job_id:null);
 const hasSupportedJob=Boolean(scoreJobId);
 const hasWordingChanges=useMemo(()=>version.blocks.some(block=>{
  const original=blocks.find(old=>old.id===block.id);
  return !original||original.text!==block.text;
 }),[version.blocks,blocks]);
 function invalidateScore(){setScoreResult(null);setConfirmReassessment(false);}
 async function verifyEmployer(){
  if(hasAuditedAtsIdentity||!verifyStatus?.enabled||verifying||!consentVerify)return;
  setVerifying(true);setNotice('');setVerifiedJob(null);
  setConfirmedVerifiedJob(false);invalidateScore();
  try{
   const verified=await verifyOfficialJob(job.official_url);
   setVerifiedJob(verified);
   setNotice('已找到企业发布的岗位信息。请确认企业和岗位是否正确。');
  }catch(e){setNotice(e instanceof Error?e.message:'无法独立核验该岗位页面。');}
  finally{setVerifying(false);}
 }
 async function reassess(){
  if(!scoreStatus?.enabled||!scoreJobId||scoring||!hasWordingChanges||!confirmReassessment)return;
  setScoring(true);setNotice('');setScoreResult(null);
  try{
   const result=await reassessResume(scoreJobId,profile,blocks,version.blocks);
   setScoreResult(result);
   if(!result.supported)setNotice('此岗位未通过当前官方快照复评条件，未生成分数。');
   else setNotice('已用相同标准比较修改前后的简历。');
  }catch(e){setNotice(e instanceof Error?e.message:'复评请求失败。');}
  finally{setScoring(false);}
 }
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
  invalidateScore();setVersion({id:item.id,targetJobId:job.id,blocks:item.version.blocks,
   acceptedSuggestionIds:item.version.acceptedSuggestionIds});
  setDetails(normalizeResumeDocumentDetails(item.version.details));setConfirmReal(false);
  setSuggestions([]);setIgnored([]);setConfirmed([]);setNewEvidence({});setOpenSuggestionId(null);
  setEditingSuggestionId(null);setSuggestionDrafts({});setUndoStack([]);setEditingBlock(null);
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
  invalidateScore();setBusy(true);setNotice('');setSuggestions([]);setIgnored([]);setConfirmed([]);setNewEvidence({});
  setOpenSuggestionId(null);setEditingSuggestionId(null);setSuggestionDrafts({});
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
   setOpenSuggestionId(accepted[0]?.id||null);
   setNotice(accepted.length?'建议已生成。请逐条核实真实性，再选择填充。':'本次 AI 未发现可以可靠润色的内容。');
  }catch(error){
   if(controller.signal.aborted)return;
   setNotice(error instanceof Error?error.message:'AI 润色暂时不可用。');
  }finally{setBusy(false);if(active.current===controller)active.current=null;}
 }
 function commitVersion(next:ResumeVersion){
  setUndoStack(stack=>[...stack.slice(-19),version]);
  setVersion(next);setConfirmReal(false);invalidateScore();
 }
 function undo(){
  const previous=undoStack.at(-1);
  if(!previous)return;
  setUndoStack(stack=>stack.slice(0,-1));setVersion(previous);setConfirmReal(false);
  setEditingBlock(null);setOpenSuggestionId(null);invalidateScore();
  setNotice('已撤销上一次简历文字修改，原始上传文件保持不变。');
 }
 function accept(s:ResumeSuggestion){
  if(!confirmed.includes(s.id)){
   setNotice('请先确认建议内容符合你的真实经历。');return;
  }
  const proposed=(suggestionDrafts[s.id]??s.proposed).trim();
  const original=version.blocks.find(b=>b.id===s.blockId)?.text||'';
  if(!proposed||proposed.length>1600||
   (s.action==='append'&&original.length+1+proposed.length>1600)){
   setNotice('建议文本超出单段 1600 字限制，请精简后再填充。');return;
  }
  try{
   commitVersion(applySuggestion(version,{...s,proposed},true));
   setOpenSuggestionId(null);setEditingSuggestionId(null);
   setNotice('已在原来的简历段落直接填充。可以撤销，原始简历文件没有被修改。');
  }catch{setNotice('原文已变化或缺乏真实证据，请重新生成建议。');}
 }
 function addFact(s:ResumeSuggestion){
  const text=(newEvidence[s.id]||'').trim();
  if(text.length<8){setNotice('请具体描述你的真实经历或成果，至少8个字。');return;}
  if(!confirmed.includes(s.id)){setNotice('请确认补充内容真实、准确后再填充。');return;}
  const original=version.blocks.find(b=>b.id===s.blockId)?.text||'';
  if(original.length+1+text.length>1600){
   setNotice('原文加补充内容超过单段 1600 字，请精简后重试。');return;
  }
  try{
   commitVersion(applySuggestion(version,{...s,action:'append',proposed:text},true));
   setOpenSuggestionId(null);
   setNotice('已将你亲自填写的真实信息填充到简历对应位置。');
  }catch{setNotice('原文已经变化，请重新生成补充建议。');}
 }
 function startEdit(block:ResumeBlock){
  setOpenSuggestionId(null);setEditingBlock(block.id);setManualText(block.text);
 }
 function saveEdit(){
  if(!editingBlock)return;
  try{
   const next=editResumeBlock(version,editingBlock,manualText);
   if(next.blocks.find(b=>b.id===editingBlock)?.text!==version.blocks.find(b=>b.id===editingBlock)?.text)
    commitVersion(next);
   setSuggestions(existing=>existing.filter(s=>s.blockId!==editingBlock));
   setEditingBlock(null);setManualText('');
   setNotice('简历原位置已更新文字。所有手动修改须以真实经历为准。');
  }catch{setNotice('请输入有效内容，单个段落最多 1600 字。');}
 }
 function reset(){
  active.current?.abort();setBusy(false);setVersion(initial());setSuggestions([]);invalidateScore();
  setIgnored([]);setConfirmed([]);setNewEvidence({});setConfirmReal(false);setEditingBlock(null);
  setOpenSuggestionId(null);setEditingSuggestionId(null);setSuggestionDrafts({});setUndoStack([]);
  setNotice('已恢复原稿。');
 }
 function renderEditableBlock(id:string,text:string){
  const block=version.blocks.find(item=>item.id===id);
  if(!block)return <p className="hhba-print-paragraph">{text}</p>;
  const s=suggestions.find(item=>item.blockId===id);
  const applied=Boolean(s&&version.acceptedSuggestionIds.includes(s.id));
  const dismissed=Boolean(s&&ignored.includes(s.id));
  const pending=Boolean(s&&!applied&&!dismissed);
  const draft=s?(suggestionDrafts[s.id]??s.proposed):'';
  return <div className={'targeted-resume-inline-region'+(pending?' has-ai-suggestion':'')} data-resume-block-id={id}>
   <div className="targeted-resume-inline-anchor">
    {editingBlock===id?<div className="targeted-resume-inline-editor">
     <textarea rows={4} maxLength={1600} value={manualText}
      onChange={e=>setManualText(e.target.value)}
      className={manualText!==block.text?'hhba-siri-typing':''}
      aria-label="编辑当前简历段落"/>
     <div><button type="button" onClick={saveEdit}>保存本次修改</button>
      <button type="button" onClick={()=>{setEditingBlock(null);setManualText('')}}>取消</button></div>
    </div>:<p className="hhba-print-paragraph">{text}</p>}
    {editingBlock!==id&&<div className="targeted-resume-inline-controls">
     {pending&&s&&<button type="button" className="targeted-resume-ai-trigger"
      aria-expanded={openSuggestionId===s.id} aria-label="查看此处 AI 修改建议"
      onClick={()=>{setOpenSuggestionId(openSuggestionId===s.id?null:s.id);setEditingSuggestionId(null)}}>
      <Sparkles size={14} aria-hidden="true"/> AI 建议</button>}
     <button type="button" aria-label="编辑当前简历段落" onClick={()=>startEdit(block)}>
      <PencilLine size={13} aria-hidden="true"/> 修改</button>
     {applied&&<span className="targeted-resume-applied"><CheckCircle2 size={12} aria-hidden="true"/> 已填充</span>}
    </div>}
   </div>
   {pending&&s&&openSuggestionId===s.id&&editingBlock!==id&&
    <div className="targeted-resume-popover-shell hhba-siri-edge hhba-siri-edge-active">
    <div className="targeted-resume-suggestion targeted-resume-popover" role="region"
    aria-label="当前简历段落的 AI 建议">
    <div className="targeted-resume-popover-head">
     <span className="targeted-resume-ai-label"><Sparkles size={13} aria-hidden="true"/> AI 原位建议 · {s.action==='request_evidence'?'请补充真实信息':'待本人核实'}</span>
     <button type="button" aria-label="关闭 AI 建议" onClick={()=>setOpenSuggestionId(null)}><X size={15}/></button>
    </div>
    {editingSuggestionId===s.id?<label className="targeted-resume-fact-entry">
     <span>直接修改 AI 建议文字（填写后仍须确认真实性）</span>
     <textarea maxLength={1600} rows={4} aria-label="修改 AI 建议"
      className="hhba-siri-typing" value={draft}
      onChange={e=>setSuggestionDrafts(old=>({...old,[s.id]:e.target.value}))}/>
    </label>:<p className="targeted-resume-gradient">{draft}</p>}
    <p className="targeted-resume-rationale">对应岗位要求：{s.jobRequirement}</p>
    <p className="targeted-resume-rationale">{s.rationale}</p>
    {s.action==='request_evidence'&&<label className="targeted-resume-fact-entry">
     <span>补充自己的真实经历或成果（AI 不会猜测数据）</span>
     <textarea maxLength={800} rows={3} value={newEvidence[s.id]||''}
      className={(newEvidence[s.id]||'').trim()?'hhba-siri-typing':''}
      onChange={e=>setNewEvidence(prev=>({...prev,[s.id]:e.target.value}))}
      placeholder="例如：你在这个岗位具体做过哪些工作？"/>
    </label>}
    <label className="targeted-resume-confirm">
     <input type="checkbox" checked={confirmed.includes(s.id)}
      onChange={e=>setConfirmed(v=>e.target.checked?[...v,s.id]:v.filter(key=>key!==s.id))}/>
     我确认建议及补充内容所描述的经历、能力和数字均属实
    </label>
    <div className="targeted-resume-actions">
     {s.action==='request_evidence'
      ?<button type="button" disabled={!confirmed.includes(s.id)||!(newEvidence[s.id]||'').trim()} onClick={()=>addFact(s)}>填充我的补充</button>
      :<button type="button" disabled={!confirmed.includes(s.id)||!draft.trim()} onClick={()=>accept(s)}>填充到此处</button>}
     {s.action!=='request_evidence'&&<button type="button" onClick={()=>setEditingSuggestionId(editingSuggestionId===s.id?null:s.id)}>
      {editingSuggestionId===s.id?'完成建议修改':'修改建议'}</button>}
     <button type="button" onClick={()=>{setIgnored(v=>[...v,s.id]);setOpenSuggestionId(null)}}>保留原文</button>
    </div>
   </div>
   </div>}
  </div>;
 }
 // The legacy browser-print template is retained solely for synthetic QA.
 // Production PDF must originate from a renderer-verified original DOCX.
 const legacyPrintQa=import.meta.env.DEV&&typeof window!=='undefined'&&
  window.location.pathname.startsWith('/qa/');
 const hasSession=realAuthReady&&Boolean(getRealAuthToken());
 return <section className="targeted-resume" aria-label="岗位定向简历优化">
  <div className="targeted-resume-heading">
   <div><small>HHBA / 岗位定向优化</small><h3>{job.title_zh||job.title}</h3>
    <p>直接在简历上修改。原文件不会被覆盖。</p></div>
   <span><Sparkles size={13} aria-hidden="true"/> 智能修改</span>
  </div>
  <div className="targeted-resume-toolbar">
   <div><strong>优化这份简历</strong><p>根据目标岗位提出修改建议，不会凭空添加经历。</p></div>
   {hasSession&&status?.enabled
    ?<button type="button" disabled={!consent||busy||!blocks.length} onClick={generate}>
       {busy?<><LoaderCircle size={15} className="resume-match-spinning"/> 正在生成…</>:<><Sparkles size={15}/> 生成 AI 建议</>}
      </button>
    :<span className="targeted-resume-unavailable">{!hasSession?'站内登录后可使用 AI 润色':status?'AI 润色尚未开放':'正在检查服务状态…'}</span>}
  </div>
  {omittedSourceCharacters>0&&<p className="targeted-resume-truncation" role="alert">
   <strong>这份简历有部分内容未显示。</strong>部分文字超出可编辑或可打印容量，
   仍有约 {omittedSourceCharacters} 个非空白字符未纳入本次预览。
   为避免遗漏经历，本次暂不允许保存岗位版本或导出 Word 草稿；请先上传精简或分段整理后的原始简历。
   原上传文件不会因此被修改。
  </p>}
  {hasSession&&status?.enabled&&<label className="targeted-resume-consent">
   <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
   <span>我同意将下方展示的简历证据片段与该岗位要求发送给平台选定的第三方 AI 服务商进行润色。服务器会尽力脱敏常见联系方式，但不能确保移除所有个人信息。建议内容只供本人核实与选择，不会自动投递。</span>
  </label>}
  <section className="targeted-resume-document-editor" aria-label="正式简历排版与打印">
   <div className="targeted-resume-document-heading">
    <div><strong>直接修改简历</strong>
     <p>点选对应段落即可修改，所有变更均可撤销。</p>
    </div>
    <div className="targeted-resume-document-actions">
     <button type="button" disabled={!undoStack.length} onClick={undo}><Undo2 size={15}/> 撤销</button>
     {legacyPrintQa&&<button type="button" disabled={!canExport} onClick={()=>window.print()}><Printer size={15}/> 导出 PDF</button>}
     <button type="button" disabled={!canExport} onClick={()=>{try{downloadResumeDocx(printDocument,job.title_zh||job.title)}
      catch{setNotice('Word 草稿导出失败，请稍后再试。')}}}><FileDown size={15}/> 导出 Word 草稿（新排版）</button>
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
   <p className="targeted-resume-print-note">此处用于核对 AI 文字建议，下载的 Word 草稿会重新排版，并非上传文件的原样式。需要保留字体和版式，请到 <Link to="/candidate/account/resume">我的简历</Link> 编辑原 Word；通过验证后，可下载 Word 和由 Word 转换的 PDF。</p>
   {!canExport&&<p className="targeted-resume-print-note" role="status">请填写真实姓名、确认简历内容完整，并保存正在编辑的段落，才可以下载 Word 草稿。</p>}
  </section>
  <div className={'targeted-resume-live-paper hhba-siri-edge'+
    ((openSuggestionId||editingBlock)?' hhba-siri-edge-active':'')}
    aria-label="可原位编辑的简历预览">
   <ResumePrintSheet document={printDocument} renderBlock={renderEditableBlock}/>
  </div>
  {before.score!==null&&<div className="targeted-resume-audit" aria-label="文字证据覆盖变化">
   <div><small>优化前 · 要求文字覆盖</small><strong>{before.score}%</strong></div>
   <span aria-hidden="true">→</span>
   <div><small>当前版本 · 要求文字覆盖</small><strong>{after.score}%</strong></div>
   <p>按现有岗位卡片列出的 {before.total} 条要求计算文字相似度，仅用于检查表达是否更清楚；不是岗位匹配分、任职资格判断或录用概率。需人工核实建议的事实依据。</p>
   {after.missing.length>0&&<details><summary>仍未充分体现的要求（{after.missing.length}）</summary>
    <ul>{after.missing.map((label,index)=><li key={index}>{label}</li>)}</ul></details>}
  </div>}
  <section className="targeted-resume-reassess" aria-label="岗位匹配评分复评">
   <div className="targeted-resume-reassess-heading">
    <div><strong>重新查看匹配分</strong>
     <p>只有核实了企业发布的岗位要求后，才会比较修改前后的分数。</p></div>
    {scoreStatus?.enabled&&<button type="button" onClick={reassess} disabled={!hasSupportedJob||!hasWordingChanges||!confirmReassessment||scoring}>
     {scoring?'正在复评…':'重新计算匹配分'}</button>}
   </div>
   {!hasAuditedAtsIdentity&&verifyStatus?.enabled&&
    <div className="targeted-resume-verify">
     <div><strong>确认目标岗位</strong>
      <p>先确认企业的真实招聘信息，检查时不会把简历发给企业。</p>
     </div>
     {!verifiedJob&&<label className="targeted-resume-confirm">
      <input type="checkbox" checked={consentVerify} onChange={e=>setConsentVerify(e.target.checked)}/>
      我同意读取企业公开的岗位要求，用于核对匹配分。
     </label>}
     {!verifiedJob&&<button type="button" disabled={!consentVerify||verifying} onClick={verifyEmployer}>
      {verifying?'正在读取企业岗位…':'确认岗位信息'}
     </button>}
     {verifiedJob&&<div className="targeted-resume-verified-job">
      <p><strong>找到的岗位：</strong>{verifiedJob.company} · {verifiedJob.title} · {verifiedJob.location}</p>
      <a href={verifiedJob.official_url} target="_blank" rel="noopener noreferrer">查看已核验职位详情</a>
      <p>{verifiedJob.disclaimer}</p>
      <label className="targeted-resume-confirm">
       <input type="checkbox" checked={confirmedVerifiedJob}
        onChange={e=>{setConfirmedVerifiedJob(e.target.checked);invalidateScore();}}/>
       我确认这就是我要针对的岗位，并已核对企业名称、标题及工作地点。
      </label>
     </div>}
    </div>}
   {!scoreStatus?.enabled&&<p className="targeted-resume-reassess-unavailable">暂时无法重新评分，但可以继续修改简历。</p>}
   {scoreStatus?.enabled&&<label className="targeted-resume-confirm">
    <input type="checkbox" checked={confirmReassessment} onChange={e=>setConfirmReassessment(e.target.checked)}/>
    我确认简历内容真实，并同意使用本次修改后的内容重新评分。
   </label>}
   {scoreStatus?.enabled&&!hasAuditedAtsIdentity&&!hasSupportedJob&&
    <p className="targeted-resume-reassess-unavailable">暂时无法核实这份岗位要求，可以继续修改简历，但不能生成新的匹配分。</p>}
   {scoreStatus?.enabled&&hasSupportedJob&&!hasWordingChanges&&<p className="targeted-resume-reassess-unavailable">请先编辑或填充一条简历内容，才需要重新评分。</p>}
   {scoreResult?.supported&&typeof scoreResult.original_score==='number'&&typeof scoreResult.updated_score==='number'&&
    <div className="targeted-resume-score-comparison">
     <div><small>修改前</small><strong>{scoreResult.original_score}<span>/100</span></strong></div>
     <div><small>修改后</small><strong>{scoreResult.updated_score}<span>/100</span></strong></div>
     <p>差值：{scoreResult.delta&&scoreResult.delta>0?'+':''}{scoreResult.delta} 分。岗位：{scoreResult.verified_job_title} · {scoreResult.verified_company}</p>
     {scoreResult.source_label&&<p>岗位来源：{scoreResult.source_label}；仍需在官网确认是否继续开放投递。</p>}
     {scoreResult.selected_job_as_target_direction&&<p>因首次匹配未提供可核实的职业目标，本次将你选定的岗位视为求职意向，不视为已经具备该岗位的任职能力。</p>}
     {scoreResult.newly_visible_terms&&scoreResult.newly_visible_terms.length>0&&
      <p>文字新增体现：{scoreResult.newly_visible_terms.join('、')}。这些技能仍需以你的真实经历为依据。</p>}
     <details><summary>查看评分维度</summary>
      <table><thead><tr><th>维度</th><th>修改前</th><th>修改后</th></tr></thead>
       <tbody>{(['role','skills','experience','education','location'] as const).map(dim=><tr key={dim}>
        <td>{{role:'岗位方向',skills:'岗位技能',experience:'工作经验',education:'学历',location:'地点'}[dim]}</td>
        <td>{scoreResult.before_breakdown?.[dim]??'—'}</td><td>{scoreResult.after_breakdown?.[dim]??'—'}</td>
       </tr>)}</tbody>
      </table>
     </details>
     <p className="targeted-resume-score-disclaimer">{scoreResult.important_notice}</p>
    </div>}
  </section>
  <div className="targeted-resume-save">
   <div><strong><FolderOpen size={16} aria-hidden="true"/> 我的岗位简历版本</strong>
    <p>仅在你主动保存后，将当前已确认的文字片段保存在 HHBA 私人账号中；不保存原始 PDF/DOCX。</p></div>
   {hasSession&&storageReady&&<button type="button" disabled={saving||!confirmReal||!canPrint} onClick={persist}>
    <Save size={14} aria-hidden="true"/>{saving?'保存中…':'保存当前版本'}</button>}
   {hasSession&&!storageReady&&<span className="targeted-resume-unavailable">暂时无法保存，请稍后再试</span>}
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
   <p><ShieldCheck size={14} aria-hidden="true"/> 原来的参考分：{Number.isInteger(job.reference_score)?job.reference_score+'/100':'暂无可靠分数'}。润色后的匹配分须通过同一评分规则重新评估；评分仅供参考。</p>
   <button type="button" onClick={reset}><Undo2 size={14}/> 恢复原稿</button>
  </div>
  {notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
  {legacyPrintQa&&createPortal(<div className="hhba-print-host" data-hhba-print-host="resume">
    <ResumePrintSheet document={printDocument}/>
   </div>,document.body)}
 </section>;
}
