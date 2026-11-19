import {useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Undo2,ShieldCheck,LoaderCircle,CheckCircle2,Save,FolderOpen,Printer,Eye,PencilLine} from 'lucide-react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {getRealAuthToken,realAuthReady} from '../services/realAuth';
import {getResumeOptimizationStatus,requestResumeOptimization,type ResumeOptimizationStatus} from '../services/resumeOptimizationApi';
import {applySuggestion,validateSuggestion,editResumeBlock,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import {evidenceVisibility} from '../services/resumeEvidenceVisibility';
import {deleteResumeVersion,listResumeVersions,saveResumeVersion,type SavedResumeVersion} from '../services/resumeVersionsApi';
import {buildResumeDocument,readableResumeDocument,normalizeResumeDocumentDetails,sourceResumeBlocks,EMPTY_RESUME_DOCUMENT_DETAILS,type ResumeDocumentDetails} from '../services/resumeDocument';
import {createPortal} from 'react-dom';
import {ResumePrintSheet} from './ResumePrintSheet';
import {reassessmentStatus,reassessResume,type ReassessmentStatus,type ReassessmentResult} from '../services/resumeReassessmentApi';
import {officialJobVerifyStatus,verifyOfficialJob,type OfficialJobVerifyStatus,type OfficialVerifiedJob} from '../services/officialJobVerifyApi';
import '../styles/targeted-resume-optimization.css';

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
 const [showPrintPreview,setShowPrintPreview]=useState(false);
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
 const canPrint=readableResumeDocument(printDocument);
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
   setNotice('已从受支持的企业官网直接核验岗位详情。请核对下方岗位标题与企业，再确认用于复评。');
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
   else setNotice('已使用同一版本的 V2 评分引擎对两个简历版本完成重新计算。');
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
  invalidateScore();setBusy(true);setNotice('');setSuggestions([]);setIgnored([]);setConfirmed([]);setNewEvidence({});
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
   setVersion(applySuggestion(version,s,confirmed.includes(s.id)));setConfirmReal(false);invalidateScore();
   setNotice('已填充到本次预览，原始简历文件没有被修改。');
  }catch{setNotice('原文已变化或缺乏真实证据，请重新生成建议。');}
 }
 function addFact(s:ResumeSuggestion){
  const text=(newEvidence[s.id]||'').trim();
  if(text.length<8){setNotice('请具体描述你的真实经历或成果，至少8个字。');return;}
  if(!confirmed.includes(s.id)){setNotice('请确认补充内容真实、准确后再填充。');return;}
  try{
   setVersion(applySuggestion(version,{...s,action:'append',proposed:text},true));setConfirmReal(false);invalidateScore();
   setNotice('已将你亲自填写的真实信息添加到当前简历预览。');
  }catch{setNotice('原文已经变化，请重新生成补充建议。');}
 }
 function startEdit(block:ResumeBlock){
  setEditingBlock(block.id);setManualText(block.text);
 }
 function saveEdit(){
  if(!editingBlock)return;
  try{
   setVersion(editResumeBlock(version,editingBlock,manualText));invalidateScore();
   setSuggestions(existing=>existing.filter(s=>s.blockId!==editingBlock));
   setEditingBlock(null);setManualText('');setConfirmReal(false);
   setNotice('已更新本次简历的文字内容。所有手动修改须以真实经历为准。');
  }catch{setNotice('请输入有效内容，单个段落最多 1600 字。');}
 }
 function reset(){
  active.current?.abort();setBusy(false);setVersion(initial());setSuggestions([]);invalidateScore();
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
   <header><h4>岗位定向简历 · 证据预览</h4><p>目标企业：{job.company} · 当前展示已识别的证据或本人确认的原文段落，原始文字可能仍需按经历分类 · 原始文件保持不变</p></header>
   {version.blocks.map(block=>{
    const s=suggestions.find(x=>x.blockId===block.id);
    const applied=Boolean(s&&version.acceptedSuggestionIds.includes(s.id));
    const dismissed=Boolean(s&&ignored.includes(s.id));
    return <div className="targeted-resume-block" key={block.id}>
     <div className="targeted-resume-block-label">
      <small>{block.section==='experience'?'工作经历':block.section==='skills'?'专业技能':'简历原始文字 · 待结构化'}</small>
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
  <section className="targeted-resume-reassess" aria-label="岗位匹配评分复评">
   <div className="targeted-resume-reassess-heading">
    <div><strong>岗位匹配分重新评估</strong>
     <p>仅支持最新官方审核 ATS 快照，或经服务器直接读取并核验的指定企业官网岗位。前后都采用 HHBA Match Ranking V2，不沿用旧卡片分数。</p></div>
    {scoreStatus?.enabled&&<button type="button" onClick={reassess} disabled={!hasSupportedJob||!hasWordingChanges||!confirmReassessment||scoring}>
     {scoring?'正在复评…':'重新计算匹配分'}</button>}
   </div>
   {!hasAuditedAtsIdentity&&verifyStatus?.enabled&&
    <div className="targeted-resume-verify">
     <div><strong>独立核验企业官网岗位</strong>
      <p>搜索式 AI 返回的岗位网址尚未由 HHBA 核实。仅支持严格白名单中的企业招聘详情链接，核验时由服务器访问对应官网，不会向企业发送你的简历。</p>
     </div>
     {!verifiedJob&&<label className="targeted-resume-confirm">
      <input type="checkbox" checked={consentVerify} onChange={e=>setConsentVerify(e.target.checked)}/>
      我理解此次仅核验公开职位页面，官网可能限制访问；网站无法取得合格任职要求时不会生成分数。
     </label>}
     {!verifiedJob&&<button type="button" disabled={!consentVerify||verifying} onClick={verifyEmployer}>
      {verifying?'正在读取企业岗位…':'核验这个企业岗位'}
     </button>}
     {verifiedJob&&<div className="targeted-resume-verified-job">
      <p><strong>已核验的官网岗位：</strong>{verifiedJob.company} · {verifiedJob.title} · {verifiedJob.location}</p>
      <a href={verifiedJob.official_url} target="_blank" rel="noopener noreferrer">查看已核验职位详情</a>
      <p>{verifiedJob.disclaimer}</p>
      <label className="targeted-resume-confirm">
       <input type="checkbox" checked={confirmedVerifiedJob}
        onChange={e=>{setConfirmedVerifiedJob(e.target.checked);invalidateScore();}}/>
       我确认这就是我要针对的岗位，并已核对企业名称、标题及工作地点。
      </label>
     </div>}
    </div>}
   {!scoreStatus?.enabled&&<p className="targeted-resume-reassess-unavailable">V2 可信复评尚未开放，当前仍可使用文字证据覆盖检查。</p>}
   {scoreStatus?.enabled&&<label className="targeted-resume-confirm">
    <input type="checkbox" checked={confirmReassessment} onChange={e=>setConfirmReassessment(e.target.checked)}/>
    我确认本次简历改写均为真实情况，并同意 HHBA 在站内读取当前简历片段、对照官方岗位快照进行评分。此复评不会调用第三方生成式 AI。
   </label>}
   {scoreStatus?.enabled&&!hasAuditedAtsIdentity&&!hasSupportedJob&&
    <p className="targeted-resume-reassess-unavailable">此岗位暂未形成可用于复评的可信官网 JD 快照。请先完成受支持企业的独立核验；不支持的招聘站仍只能进行文字润色与证据覆盖比较。</p>}
   {scoreStatus?.enabled&&hasSupportedJob&&!hasWordingChanges&&<p className="targeted-resume-reassess-unavailable">请先编辑或填充一条简历内容，才需要重新评分。</p>}
   {scoreResult?.supported&&typeof scoreResult.original_score==='number'&&typeof scoreResult.updated_score==='number'&&
    <div className="targeted-resume-score-comparison">
     <div><small>修改前 · V2 复评基准</small><strong>{scoreResult.original_score}<span>/100</span></strong></div>
     <div><small>修改后 · V2 同规则</small><strong>{scoreResult.updated_score}<span>/100</span></strong></div>
     <p>差值：{scoreResult.delta&&scoreResult.delta>0?'+':''}{scoreResult.delta} 分。岗位：{scoreResult.verified_job_title} · {scoreResult.verified_company}</p>
     {scoreResult.source_label&&<p>官方岗位证据：{scoreResult.source_label}；仍需在官网确认是否继续开放投递。</p>}
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
   <p><ShieldCheck size={14} aria-hidden="true"/> 原始岗位卡片参考分：{Number.isInteger(job.reference_score)?job.reference_score+'/100':'暂无可靠分数'}。润色后的匹配分须通过同一评分规则重新评估；本预览不虚报分数。</p>
   <button type="button" onClick={reset}><Undo2 size={14}/> 恢复原始预览</button>
  </div>
  {notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
  {createPortal(<div className="hhba-print-host" data-hhba-print-host="resume">
    <ResumePrintSheet document={printDocument}/>
   </div>,document.body)}
 </section>;
}
