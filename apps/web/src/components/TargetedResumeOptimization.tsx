import {useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Undo2,ShieldCheck,LoaderCircle,CheckCircle2,Save,FolderOpen,Printer,FileDown,PencilLine,X ,ChevronDown} from 'lucide-react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {getRealAuthToken,realAuthReady} from '../services/realAuth';
import {MATCH_V4_PREVIEW,prepareV4Job} from '../services/resumeMatch';
import {getResumeOptimizationStatus,requestResumeOptimization,type ResumeOptimizationStatus} from '../services/resumeOptimizationApi';
import {getWholeRewriteStatus,requestWholeResumeRewrite,continueWholeResumeRewrite,type ResumeWholeRewriteResult,type ResumeWholeRewriteStatus} from '../services/resumeWholeRewriteApi';
import {completeRewriteSource} from '../services/resumeWholeRewriteSource';
import {downloadWholeRewriteDocx} from '../services/resumeWholeRewriteExport';
import {WholeResumeRewriteReview} from './WholeResumeRewriteReview';
import {applySuggestion,validateSuggestion,editResumeBlock,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import {evidenceVisibility} from '../services/resumeEvidenceVisibility';
import {deleteResumeVersion,listResumeVersions,saveResumeVersion,type SavedResumeVersion} from '../services/resumeVersionsApi';
import {buildResumeDocument,readableResumeDocument,normalizeResumeDocumentDetails,sourceResumeBlocks,sourceResumeOmittedCharacters,structuredResumeOmittedCharacters,EMPTY_RESUME_DOCUMENT_DETAILS,type ResumeDocumentDetails} from '../services/resumeDocument';
import {createPortal} from 'react-dom';
import {Link} from '../router';
import type {PrivateResume} from '../services/privateResumes';
import {OriginalWordViewer,type WordRevisionSnapshot,type WordVisualSuggestion} from './OriginalWordViewer';
import {checkedWordScoreBlocks} from '../services/resumeWordScoreBridge.mjs';
import {ResumePrintSheet} from './ResumePrintSheet';
import {downloadResumeDocx} from '../services/resumeDocx';
import {reassessmentStatus,reassessResume,type ReassessmentStatus,type ReassessmentResult} from '../services/resumeReassessmentApi';
import {officialJobVerifyStatus,verifyOfficialJob,type OfficialJobVerifyStatus,type OfficialVerifiedJob} from '../services/officialJobVerifyApi';
import {jobJdArchiveStatus,ensureArchivedJobJd,getArchivedJobJdVersion,type JdAwareJob} from '../services/jobJdArchive';
import {stablePostingScope} from '../services/stablePostingScope.mjs';
import '../styles/targeted-resume-optimization.css';
import '../styles/siri-edge.css';
import '../styles/word-editor-minimal.css';

export function TargetedResumeOptimization({profile,job,sourceText,sourceResume,onDraftDirtyChange,accountScope,requireVerifiedJd=false}:{profile:CandidateProfile;job:JobMatch;sourceText?:string;sourceResume?:PrivateResume;onDraftDirtyChange?:(dirty:boolean)=>void;accountScope?:string;requireVerifiedJd?:boolean}){
 // Reopen the same employer posting from a new search or history using the same private Word branch.
 const postingScope=useMemo(()=>stablePostingScope(job.official_url),[job.official_url]);
 const blocks=useMemo<ResumeBlock[]>(()=>{
 const originals=[
  ...(Array.isArray(profile.experiences)?profile.experiences:[]).filter(e=>e.evidence?.trim()).map((e,i)=>({id:'experience-'+i,section:'experience' as const,text:e.evidence.slice(0,1600)})),
  ...(Array.isArray(profile.skills)?profile.skills:[]).filter(s=>s.evidence?.trim()).map((s,i)=>({id:'skill-'+i,section:'skills' as const,text:s.evidence.slice(0,1600)}))
 ].slice(0,12);
 // Newer search-first flows preserve local source text, but do not yet expose
 // verified structured work-history records. Keep raw paragraphs unmistakably
 // labelled as source text, rather than inventing roles or employers.
 if(!profile.experiences?.length&&sourceText?.trim())return sourceResumeBlocks(sourceText,requireVerifiedJd);
 return originals;
 },[profile,sourceText,requireVerifiedJd]);
 const wholeSource=useMemo(()=>completeRewriteSource(profile,sourceText),[profile,sourceText]);
 const [wholeStatus,setWholeStatus]=useState<ResumeWholeRewriteStatus|null>(null);
 const [wholeDraft,setWholeDraft]=useState<ResumeWholeRewriteResult|null>(null);
 const [wholeBusy,setWholeBusy]=useState(false);
 const [wholeApproved,setWholeApproved]=useState(false);
 const [wholeDownloaded,setWholeDownloaded]=useState(false);
 // The current candidate's consented text is held only in this open tab.
 // No new public storage or automatic D1 writes for AI checkpoints.
 const wholeRunInput=useRef<{blocks:ResumeBlock[];
  job:JdAwareJob}|null>(null);
 const [revealedWholeCount,setRevealedWholeCount]=useState(0);
 useEffect(()=>{
  const count=wholeDraft?.blocks.length||0;
  if(!count||revealedWholeCount>=count)return;
  // The model response is already complete. Staggered reveal communicates
  // the confirmed result without pretending tokens are streaming live.
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const t=setTimeout(()=>setRevealedWholeCount(n=>Math.min(n+1,count)),reduced?0:240);
  return()=>clearTimeout(t);
 },[wholeDraft,revealedWholeCount]);
 const omittedSourceCharacters=useMemo(()=>(
  !profile.experiences?.length&&sourceText
   ?sourceResumeOmittedCharacters(sourceText,blocks)
   :structuredResumeOmittedCharacters(profile)
 ),[profile,sourceText,blocks]);
 const initial=()=>({id:'draft-'+(postingScope||'invalid'),targetJobId:postingScope||'invalid',blocks,acceptedSuggestionIds:[] as string[]});
 const [version,setVersion]=useState<ResumeVersion>(initial);
 const [suggestions,setSuggestions]=useState<ResumeSuggestion[]>([]);
 const [wordPromptBlocks,setWordPromptBlocks]=useState<ResumeBlock[]>([]);
 const wordDocumentText=useRef('');
 const previousOptimization=useRef<{key:string;suggestions:ResumeSuggestion[];pending:string[]}|null>(null);
 const [ignored,setIgnored]=useState<string[]>([]);
 const [resolvedWordVisualIds,setResolvedWordVisualIds]=useState<string[]>([]);
 const [editedWordVisualIds,setEditedWordVisualIds]=useState<string[]>([]);
 const [confirmed,setConfirmed]=useState<string[]>([]);
 const [newEvidence,setNewEvidence]=useState<Record<string,string>>({});
 const [consent,setConsent]=useState(false);
 const [wordConsentOpen,setWordConsentOpen]=useState(false);
 const [wordConsentChecked,setWordConsentChecked]=useState(false);
 const [generateAfterConsent,setGenerateAfterConsent]=useState(false);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState<ResumeOptimizationStatus|null>(null);
 const [scoreStatus,setScoreStatus]=useState<ReassessmentStatus|null>(null);
 const [archivedJdId,setArchivedJdId]=useState<string|null>(null);
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
 const [activeSuggestionId,setActiveSuggestionId]=useState<string|null>(null);
 const [entranceStage,setEntranceStage]=useState<'waiting'|'entering'|'ready'>('waiting');
 const [revealedSuggestionCount,setRevealedSuggestionCount]=useState(0);
 const [wordRevisionSnapshot,setWordRevisionSnapshot]=useState<WordRevisionSnapshot|null>(null);
 const lastWordRevisionKey=useRef('');
 useEffect(()=>{
  if(sourceResume)setEntranceStage('waiting');
 },[sourceResume?.id,postingScope]);
 useEffect(()=>{
  if(entranceStage!=='entering')return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timeout=setTimeout(()=>setEntranceStage('ready'),reduced?0:1050);
  return()=>clearTimeout(timeout);
 },[entranceStage]);
 function revealRenderedWord(){
  setEntranceStage(stage=>stage==='waiting'?'entering':stage);
 }
 useEffect(()=>{
  if(!sourceResume)return;
  if(!suggestions.length){setRevealedSuggestionCount(0);return;}
  if(revealedSuggestionCount>=suggestions.length)return;
  // Provider results have returned; stagger is presentation, never fake streaming.
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timeout=setTimeout(()=>setRevealedSuggestionCount(n=>Math.min(n+1,suggestions.length)),
   reduced?0:520);
  return()=>clearTimeout(timeout);
 },[sourceResume,suggestions,revealedSuggestionCount]);
 const [aiSettingsOpen,setAiSettingsOpen]=useState(false);
 const [nativeWordPending,setNativeWordPending]=useState(false);
 const [nativeWordTextDraft,setNativeWordTextDraft]=useState<{
  original:string;text:string;revision:number;page:number
 }|null>(null);
 const [verifiedWordEdits,setVerifiedWordEdits]=useState<Array<{original:string;text:string}>>([]);
 // Do not silently keep a resume in localStorage. Optional draft recovery
 // requires a separate, user-checked consent and is tab/session-scoped.
 const draftKey=sourceResume&&accountScope&&postingScope?
  'hhba:word-draft-v1:'+encodeURIComponent(accountScope).slice(0,96)+
  ':'+encodeURIComponent(sourceResume.id)+':'+encodeURIComponent(postingScope):'';
 const [rememberDraft,setRememberDraft]=useState(false);
 const [recoverableDraft,setRecoverableDraft]=useState<any|null>(null);
 const [draftStatus,setDraftStatus]=useState('');
 const [draftExpiresAt,setDraftExpiresAt]=useState<number|null>(null);
 // A lightweight context check, not an authentication mechanism: drafts
 // are already scoped to the signed-in account, document and target job.
 const sourceSignature=useMemo(()=>{
  const source=JSON.stringify(blocks.map(({id,section,text})=>[id,section,text]));
  let a=2166136261,b=5381;
  for(let i=0;i<source.length;i++){
   a=Math.imul(a^source.charCodeAt(i),16777619);
   b=(Math.imul(b,33)^source.charCodeAt(i))|0;
  }
  return source.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);
 },[blocks]);
 useEffect(()=>{
  if(!draftKey)return;
  try{
   const raw=sessionStorage.getItem(draftKey);
   if(!raw)return;
   const stored=JSON.parse(raw);
   if(stored?.schema!=='HHBA_WORD_DRAFT_V2'||
    stored.source_signature!==sourceSignature||
    typeof stored.expires_at!=='number'||stored.expires_at<Date.now()||
    !stored.version||!Array.isArray(stored.version.blocks)||
    stored.version.blocks.length!==blocks.length||
    !Array.isArray(stored.version.acceptedSuggestionIds)){
    sessionStorage.removeItem(draftKey);return;
   }
   setRecoverableDraft(stored);setRememberDraft(true);
   setDraftExpiresAt(stored.expires_at);
  }catch{setDraftStatus('浏览器会话草稿无法读取，请继续手动编辑。');}
 },[draftKey,sourceSignature,blocks.length]);
 const generation=useRef(0);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{
  // A different candidate Word or job must never inherit an earlier job's
  // signed AI continuation, facts, approval or visible score.
  active.current?.abort();
  wholeRunInput.current=null;
  setArchivedJdId(null);setScoreResult(null);setConfirmReassessment(false);
  setWholeDraft(null);setWholeBusy(false);
  setWholeApproved(false);setWholeDownloaded(false);
  setRevealedWholeCount(0);
 },[postingScope,job.jd_version_id,sourceResume?.id,sourceText]);
 useEffect(()=>{
  const abort=new AbortController();
  getResumeOptimizationStatus(abort.signal).then(setStatus);
  getWholeRewriteStatus(abort.signal).then(setWholeStatus);
  reassessmentStatus(abort.signal).then(setScoreStatus);
  officialJobVerifyStatus(abort.signal).then(setVerifyStatus);
  return ()=>{abort.abort();active.current?.abort();};
 },[]);
 useEffect(()=>{
  if(!realAuthReady||!getRealAuthToken()||!postingScope)return;
  let alive=true;
  listResumeVersions(postingScope).then(data=>{
   if(alive){setSaved(data.items);setStorageReady(true);}
  }).catch(()=>{if(alive)setStorageReady(false);});
  return ()=>{alive=false;};
 },[postingScope]);
 const requirements=useMemo(()=>[
  job.requirements_basis,...job.matched,...job.not_evidenced,...job.needs_verification
 ].filter(Boolean).join('\n').slice(0,2500),[job]);
 const fullJobRequirements=useMemo(()=>[
  job.requirements_basis,...job.matched,...job.not_evidenced,...job.needs_verification
 ].filter(Boolean).join('\n').slice(0,16000),[job]);
 const criteria=useMemo(()=>[...job.matched,...job.not_evidenced], [job]);
 const textDraft=requireVerifiedJd&&!sourceResume&&Boolean(sourceText?.trim());
 const printDocument=useMemo(()=>buildResumeDocument(textDraft?
  {...profile,skills:[],experiences:[],education:null,education_evidence:null}:profile,
  version.blocks,details),[profile,version.blocks,details,textDraft]);
 const canPrint=readableResumeDocument(printDocument)&&omittedSourceCharacters===0;
 const canExport=canPrint&&!editingBlock;
 function updateDetail(key:keyof ResumeDocumentDetails,value:string){
  setDetails(current=>({...current,[key]:value}));
  setConfirmReal(false);
 }
 const before=useMemo(()=>evidenceVisibility(criteria,blocks),[criteria,blocks]);
 const after=useMemo(()=>evidenceVisibility(criteria,version.blocks),[criteria,version.blocks]);
 const hasAuditedAtsIdentity=/^(?:ashby|greenhouse|lever)-/.test(job.id);
 const scoreJobId=archivedJdId||job.jd_version_id||(hasAuditedAtsIdentity?job.id:
  (verifiedJob&&confirmedVerifiedJob?verifiedJob.job_id:null));
 const hasSupportedJob=Boolean(scoreJobId);
 const verifiedWordScore=useMemo(()=>checkedWordScoreBlocks(blocks,
  wordRevisionSnapshot?.history||[],wordRevisionSnapshot?.revision||0,{unbounded:MATCH_V4_PREVIEW}),
  [blocks,wordRevisionSnapshot]);
 const hasVerifiedWordRevision=Boolean(sourceResume&&wordRevisionSnapshot&&
  wordRevisionSnapshot.revision>0);
 function handleWordRevisionSnapshot(snapshot:WordRevisionSnapshot){
  const key=snapshot.revision+':'+snapshot.history.map(x=>
   x.revision+':'+x.original+':'+x.text).join('|');
  if(lastWordRevisionKey.current===key)return;
  lastWordRevisionKey.current=key;
  setWordRevisionSnapshot(snapshot);
  setScoreResult(null);setConfirmReassessment(false);
 }
 const hasWordingChanges=useMemo(()=>version.blocks.some(block=>{
  const original=blocks.find(old=>old.id===block.id);
  return !original||original.text!==block.text;
 }),[version.blocks,blocks]);
 const scoreSourceReady=!sourceResume?hasWordingChanges:
  hasVerifiedWordRevision&&verifiedWordScore.ok;
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
  if(!scoreStatus?.enabled||!scoreJobId||scoring||!scoreSourceReady||
   !confirmReassessment||scoreResult?.supported)return;
  setScoring(true);setNotice('');setScoreResult(null);
  try{
   const controller=new AbortController();active.current=controller;
   const target=MATCH_V4_PREVIEW?await jobContextForAI(controller.signal):null;
   const result=await reassessResume(target?.jd_version_id||scoreJobId,profile,blocks,
    sourceResume?verifiedWordScore.blocks:version.blocks,controller.signal);
   setScoreResult(result);
   if(!result.supported)setNotice('此岗位未通过当前官方快照复评条件，未生成分数。');
   else setNotice('已用相同标准比较修改前后的简历。');
  }catch(e){setNotice(e instanceof Error?e.message:'复评请求失败。');}
  finally{setScoring(false);}
 }
 async function persist(){
  if(saving||!confirmReal||!storageReady||!canPrint||!postingScope)return;
  setSaving(true);setNotice('');
  try{
   await saveResumeVersion({id:postingScope,title:job.title_zh||job.title,company:job.company},
    version.blocks,version.acceptedSuggestionIds,details);
   const data=await listResumeVersions(postingScope);
   setSaved(data.items);
   setNotice('已保存本岗位专属简历版本到你的 HHBA 账户。');
  }catch(err){setNotice(err instanceof Error?err.message:'保存失败，请重试。');}
  finally{setSaving(false);}
 }
 function restore(item:SavedResumeVersion){
  active.current?.abort();setBusy(false);
  invalidateScore();setVersion({id:item.id,targetJobId:postingScope||'invalid',blocks:item.version.blocks,
   acceptedSuggestionIds:item.version.acceptedSuggestionIds});
  setDetails(normalizeResumeDocumentDetails(item.version.details));setConfirmReal(false);
  setSuggestions([]);setIgnored([]);setResolvedWordVisualIds([]);setEditedWordVisualIds([]);setConfirmed([]);setNewEvidence({});setOpenSuggestionId(null);
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
 async function runWholeContinuation(
  initial:ResumeWholeRewriteResult,
  input:{blocks:ResumeBlock[];job:JdAwareJob},
  controller:AbortController
 ){
  let latest=initial;
  // Each awaited call executes just one model-selected tool. The signed
  // checkpoint must verify again on the server before that tool can run.
  while(!controller.signal.aborted&&latest.autonomy?.needs_more_work&&
   latest.continuation?.enabled&&latest.continuation.checkpoint){
   if(!MATCH_V4_PREVIEW&&(latest.autonomy.tools_used?.length||0)>=64){
    setNotice('本轮已到达技术保护边界。当前完整草稿已保留，可先审阅。');
    break;
   }
   latest=await continueWholeResumeRewrite(
    input.blocks,input.job,latest,controller.signal);
   if(controller.signal.aborted)return latest;
   setWholeDraft(latest);
  }
  return latest;
 }
 async function resumeWholeRewrite(){
  const draft=wholeDraft,input=wholeRunInput.current;
  if(!draft||!input||wholeBusy||busy||!consent||
   !draft.autonomy?.needs_more_work||!draft.continuation?.enabled)return;
  const controller=new AbortController();active.current=controller;
  setWholeBusy(true);setWholeApproved(false);setWholeDownloaded(false);
  setNotice('AI 正在继续核查并优化简历…');
  try{
   const result=await runWholeContinuation(draft,input,controller);
   if(!controller.signal.aborted)
    setNotice(result.autonomy?.needs_more_work?
     '已保留目前完成的修改，仍可选择继续优化或先核实草稿。':
     'AI 已结束本轮自主优化，请核对个人事实。');
  }catch(error){
   if(!controller.signal.aborted)
    setNotice('本轮 AI 后续优化暂停，已保留上一步结果。'+
     (error instanceof Error?error.message:''));
  }finally{
   setWholeBusy(false);if(active.current===controller)active.current=null;
  }
 }
 /**
  * Both AI edit modes must use one server-backed official JD version whenever
  * the shared archive is enabled. Failed official fetches do NOT silently
  * become fabricated "full" JDs. Legacy environments retain existing
  * summary-based behavior, explicitly labelled as incomplete evidence.
  */
 async function jobContextForAI(signal:AbortSignal):Promise<JdAwareJob>{
  const title=MATCH_V4_PREVIEW?(job.title_zh||job.title):(job.title_zh||job.title).slice(0,180);
  if(!postingScope)throw Error('岗位官网地址无效，已阻止可能串岗的简历优化。');
  if(requireVerifiedJd&&(!job.jd_version_id||!job.jd_sha256))
   throw Error('请先完成此岗位的 JD 核验，再优化简历。');
  if(job.jd_version_id){
   const official=await getArchivedJobJdVersion(job.jd_version_id,signal);
   if(official.canonical_url!==job.official_url||official.job_id!==job.jd_version_id||
    (job.jd_sha256&&official.jd_sha256!==job.jd_sha256))
    throw Error('岗位 JD 版本不一致，请重新匹配后再优化。');
   if(!official.fresh){
    if(!MATCH_V4_PREVIEW)throw Error('岗位 JD 需要重新核验，请重新匹配后再优化。');
    const refreshed=await prepareV4Job(job.official_url,signal,official.title);
    if(!refreshed.jd_version_id||!refreshed.jd_sha256||!refreshed.requirements_basis)
     throw Error('岗位 JD 重新核验失败，未使用过期要求。');
    if(!signal.aborted)setArchivedJdId(refreshed.jd_version_id);
    return {title:refreshed.title||official.title,requirements:refreshed.requirements_basis,
     official_url:job.official_url,jd_version_id:refreshed.jd_version_id,jd_sha256:refreshed.jd_sha256};
   }
   if(!signal.aborted)setArchivedJdId(official.job_id);
   return {title:official.title,requirements:official.full_jd,official_url:official.canonical_url,
    jd_version_id:official.job_id,jd_sha256:official.jd_sha256};
  }
  // An indexed employer page is NOT the same as a verified full job JD.
  const partial=job.evidence_status==='PARTIAL_SOURCE'&&
   typeof job.evidence_excerpt==='string'&&job.evidence_excerpt.length>=130?
   {title,requirements:'以下为公开检索到的部分岗位材料，非完整已核验JD。只能依据有明确文字的要求给出简历措辞建议，不得推断其他硬性资格：\n'+
    job.evidence_excerpt.slice(0,1400),official_url:job.official_url}:null;
  const insufficient=job.evidence_status==='SEARCH_SNIPPET_ONLY'||
   job.evidence_status==='INSUFFICIENT_EVIDENCE';
  if(!await jobJdArchiveStatus(signal)){
   if(partial)return partial;
   if(insufficient)throw Error('该岗位目前只有搜索摘要，证据不足。请先从企业招聘页确认职位要求，再优化 Word。');
   // Backwards-compatible historical snapshots remain labelled summary-only.
   return {title,requirements:fullJobRequirements,official_url:job.official_url};
  }
  // Where official full JD fetch fails (common with mainland recruiting),
  // use only attributed partial research material. Never fake a JD version.
  try{
   const official=await ensureArchivedJobJd(job.official_url,signal);
   if(!signal.aborted)setArchivedJdId(official.job_id);
   return {title:official.title,requirements:official.full_jd,
    official_url:official.canonical_url,jd_version_id:official.job_id};
  }catch(error){
   if(signal.aborted)throw error;
   if(partial)return partial;
   if(insufficient)throw Error('该岗位未能取得足够的公开任职要求，已停止无依据的简历优化。');
   throw error;
  }
 }
 async function generateWholeRewrite(answers:Record<string,string>={}){
  if(!consent||!sourceResume||!wholeSource.complete||
   !wholeSource.blocks.length||!wholeStatus?.enabled||
   wholeBusy||busy)return;
  const controller=new AbortController();
  active.current=controller;
  setWholeBusy(true);setWholeApproved(false);setWholeDownloaded(false);
  setRevealedWholeCount(0);
  setWholeDraft(null);
  setNotice('');
  try{
   const personalized=wholeSource.blocks.map(b=>{
    const extra=answers[b.id]?.trim();
    return extra?{...b,text:b.text+'\n用户本人补充的事实（待核实）：'+extra}:b;
   });
   const trustedJob=await jobContextForAI(controller.signal);
   if(controller.signal.aborted)return;
   const input={blocks:personalized,job:trustedJob};
   wholeRunInput.current=input;
   const first=await requestWholeResumeRewrite(
    input.blocks,input.job,controller.signal);
   if(controller.signal.aborted)return;
   setWholeDraft(first);
   setNotice('已生成并复核完整初稿，AI 正在按需要继续查看证据和优化章节…');
   const result=await runWholeContinuation(first,input,controller);
   if(controller.signal.aborted)return;
   setNotice(result.autonomy?.needs_more_work?
    '已保留全部当前成果，后续修改可继续执行；请核实已有内容。':
    'AI 已完成本轮自主优化。请核实个人事实并确认下载。');
  }catch(error){
   if(!controller.signal.aborted)
    setNotice('已保留最后一份完整草稿。'+
     (error instanceof Error?error.message:'AI 整份简历重写暂时未完成。'));
  }finally{
   setWholeBusy(false);if(active.current===controller)active.current=null;
  }
 }
 async function generate(){
  // AI only operates on unique text segments confirmed inside the real Word.
  const currentBlocks=sourceResume?wordPromptBlocks:version.blocks;
  if(!consent||!currentBlocks.length||busy||wholeBusy||!status?.enabled)return;
  if(sourceResume)setVersion(prev=>({...prev,blocks:currentBlocks,acceptedSuggestionIds:[]}));
  // Previewing/re-generating AI wording does not change the verified DOCX.
  if(!sourceResume)invalidateScore();
  setBusy(true);setNotice('');setSuggestions([]);setRevealedSuggestionCount(0);
  setIgnored([]);setResolvedWordVisualIds([]);setEditedWordVisualIds([]);setConfirmed([]);setNewEvidence({});
  setOpenSuggestionId(null);setEditingSuggestionId(null);setSuggestionDrafts({});
  const controller=new AbortController();active.current=controller;
  try{
   const trustedJob=await jobContextForAI(controller.signal);
   if(controller.signal.aborted)return;
   const targetedJob={
    ...trustedJob,title:MATCH_V4_PREVIEW?trustedJob.title:trustedJob.title.slice(0,120),
    requirements:MATCH_V4_PREVIEW?trustedJob.requirements:trustedJob.requirements.slice(0,16000)
   };
   const context=sourceResume?(wordDocumentText.current||sourceText||''):(sourceText||'');
   const full=requireVerifiedJd;
   if(full&&status?.full_document_enabled===false)
    throw Error('整份简历优化任务暂未就绪，请稍后重试。');
   const key=JSON.stringify([targetedJob.jd_version_id,targetedJob.jd_sha256,currentBlocks,context]);
   const prior=full&&previousOptimization.current?.key===key?previousOptimization.current:null;
   let pending:string[]=[];
   const incoming=prior&&!prior.pending.length?prior.suggestions:
    await requestResumeOptimization(full||MATCH_V4_PREVIEW?currentBlocks:currentBlocks.slice(0,12),targetedJob,controller.signal,
     full?{text:context,wanted:prior?.pending,onPending:ids=>{pending=ids;},
      onQueued:()=>setNotice('简历优化正在排队，轮到后会继续。')}:undefined);
   const combined=[...new Map([...(prior?.suggestions||[]),...incoming].map(item=>[MATCH_V4_PREVIEW?JSON.stringify([item.blockId,item.action,item.proposed,item.jobRequirement]):item.blockId,item])).values()];
   if(full)previousOptimization.current={key,suggestions:combined,pending};
   const unique=new Set<string>(),usedBlocks=new Set<string>();
   const accepted=combined.filter(s=>{
    if((!MATCH_V4_PREVIEW&&(unique.has(s.id)||usedBlocks.has(s.blockId)))||!validateSuggestion(currentBlocks,s))return false;
    unique.add(s.id);usedBlocks.add(s.blockId);return true;
   }).map((s,i)=>({...s,id:('generation-'+(++generation.current)+'-'+i+'-'+s.id).slice(0,100)}));
   setSuggestions(accepted);
   setActiveSuggestionId(accepted[0]?.id||null);
   setOpenSuggestionId(accepted[0]?.id||null);
   const sourceNote=trustedJob.jd_version_id?
    '本次已依据企业官网核验的完整岗位 JD 生成建议。':
    '当前尚未接入可核验的完整 JD，本次仅依据已保存的岗位信息生成建议。';
   setNotice(pending.length?('已保留本次建议。还有 '+pending.length+' 处待处理，再点优化可接着处理。'):
    (accepted.length?'建议已生成。请逐条核实真实性，再选择填充。':'本次 AI 未发现可以可靠润色的内容。')+sourceNote);
  }catch(error){
   if(controller.signal.aborted)return;
   setNotice(error instanceof Error?error.message:'AI 润色暂时不可用。');
  }finally{setBusy(false);if(active.current===controller)active.current=null;}
 }
 // Explicit third-party consent must commit before the AI call.
 useEffect(()=>{
  if(!consent||!generateAfterConsent)return;
  setGenerateAfterConsent(false);
  void generate();
 },[consent,generateAfterConsent]);
 function commitVersion(next:ResumeVersion){
  setUndoStack(stack=>[...(MATCH_V4_PREVIEW?stack:stack.slice(-19)),version]);
  setVersion(next);setConfirmReal(false);
  if(!sourceResume)invalidateScore();
 }
 function undo(){
  const previous=undoStack.at(-1);
  if(!previous)return;
  setUndoStack(stack=>stack.slice(0,-1));setVersion(previous);setConfirmReal(false);
  setEditingBlock(null);setOpenSuggestionId(null);
  if(!sourceResume)invalidateScore();
  setNotice('已撤销上一次简历文字修改，原始上传文件保持不变。');
 }
 function accept(s:ResumeSuggestion){
  if(!confirmed.includes(s.id)){
   setNotice('请先确认建议内容符合你的真实经历。');return;
  }
  const proposed=(suggestionDrafts[s.id]??s.proposed).trim();
  const original=version.blocks.find(b=>b.id===s.blockId)?.text||'';
  if(!proposed||(!MATCH_V4_PREVIEW&&(proposed.length>1600||
   (s.action==='append'&&original.length+1+proposed.length>1600)))){
   setNotice('建议文本超出单段 1600 字限制，请精简后再填充。');return;
  }
  try{
   commitVersion(applySuggestion(version,{...s,proposed},true));
   setOpenSuggestionId(null);setEditingSuggestionId(null);
   setNotice(sourceResume?'建议已确认。请在原 Word 上点选对应文字并再次确认保存；尚未改动原文件。':
    '已在简历文字草稿内填充。可以撤销，原始 Word 文件没有被修改。');
  }catch{setNotice('原文已变化或缺乏真实证据，请重新生成建议。');}
 }
 function addFact(s:ResumeSuggestion){
  const text=(newEvidence[s.id]||'').trim();
  if(text.length<8){setNotice('请具体描述你的真实经历或成果，至少8个字。');return;}
  if(!confirmed.includes(s.id)){setNotice('请确认补充内容真实、准确后再填充。');return;}
  const original=version.blocks.find(b=>b.id===s.blockId)?.text||'';
  if(!MATCH_V4_PREVIEW&&original.length+1+text.length>1600){
   setNotice('原文加补充内容超过单段 1600 字，请精简后重试。');return;
  }
  try{
   commitVersion(applySuggestion(version,{...s,action:'append',proposed:text},true));
   setOpenSuggestionId(null);
   setNotice(sourceResume?'真实经历补充已记入建议草稿。复杂的新增段落暂不能安全自动写回原 Word，请自行核对。':
    '已将你亲自填写的真实信息填充到简历文字草稿。');
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
  }catch{setNotice(MATCH_V4_PREVIEW?'请输入有效内容。':'请输入有效内容，单个段落最多 1600 字。');}
 }
 function reset(){
  active.current?.abort();setBusy(false);setVersion(initial());setSuggestions([]);invalidateScore();
  setIgnored([]);setResolvedWordVisualIds([]);setEditedWordVisualIds([]);setConfirmed([]);setNewEvidence({});setConfirmReal(false);setEditingBlock(null);
  setOpenSuggestionId(null);setEditingSuggestionId(null);setSuggestionDrafts({});setUndoStack([]);
  setNotice('已恢复原稿。');
  try{if(draftKey)sessionStorage.removeItem(draftKey);}catch{}
  setDraftStatus('已清除本标签页草稿。');
 }
 function renderSuggestionCard(s:ResumeSuggestion){
  const draft=suggestionDrafts[s.id]??s.proposed;
  return <div className="targeted-resume-popover-shell hhba-siri-edge hhba-siri-edge-active">
    <div className="targeted-resume-suggestion targeted-resume-popover" role="region"
    aria-label="当前简历段落的 AI 建议">
    <div className="targeted-resume-popover-head">
     <span className="targeted-resume-ai-label"><Sparkles size={13} aria-hidden="true"/> {sourceResume?'核实这处文字':s.action==='request_evidence'?'请补充真实信息':'待本人核实'}</span>
     <button type="button" aria-label="关闭 AI 建议" onClick={()=>{setOpenSuggestionId(null);setActiveSuggestionId(null)}}><X size={15}/></button>
    </div>
    {editingSuggestionId===s.id?<label className="targeted-resume-fact-entry">
     <span>直接修改 AI 建议文字（填写后仍须确认真实性）</span>
     <textarea maxLength={MATCH_V4_PREVIEW?undefined:1600} rows={4} aria-label="修改 AI 建议"
      className="hhba-siri-typing" value={draft}
      onChange={e=>setSuggestionDrafts(old=>({...old,[s.id]:e.target.value}))}/>
    </label>:<p className="targeted-resume-gradient">{draft}</p>}
    <p className="targeted-resume-rationale">对应岗位要求：{s.jobRequirement}</p>
    <p className="targeted-resume-rationale">{s.rationale}</p>
    {s.action==='request_evidence'&&<label className="targeted-resume-fact-entry">
     <span>补充自己的真实经历或成果（AI 不会猜测数据）</span>
     <textarea maxLength={MATCH_V4_PREVIEW?undefined:800} rows={3} value={newEvidence[s.id]||''}
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
   </div>;
 }
 function renderEditableBlock(id:string,text:string){
  const block=version.blocks.find(item=>item.id===id);
  if(!block)return <p className="hhba-print-paragraph">{text}</p>;
  const choices=suggestions.filter(item=>item.blockId===id&&!ignored.includes(item.id)&&validateSuggestion(version.blocks,item));
  const s=choices.find(item=>item.id===openSuggestionId)||choices[0]||suggestions.find(item=>item.blockId===id&&version.acceptedSuggestionIds.includes(item.id));
  const applied=Boolean(s&&version.acceptedSuggestionIds.includes(s.id));
  const dismissed=Boolean(s&&ignored.includes(s.id));
  const pending=Boolean(s&&!applied&&!dismissed);
  return <div className={'targeted-resume-inline-region'+(pending?' has-ai-suggestion':'')} data-resume-block-id={id}>
   <div className="targeted-resume-inline-anchor">
    {editingBlock===id?<div className="targeted-resume-inline-editor">
     <textarea rows={4} maxLength={MATCH_V4_PREVIEW?undefined:1600} value={manualText}
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
   {pending&&s&&openSuggestionId===s.id&&editingBlock!==id&&<>
    {MATCH_V4_PREVIEW&&choices.length>1&&<div className="targeted-resume-actions" aria-label="此段落的备选建议">{choices.map((choice,index)=><button key={choice.id} type="button" aria-pressed={choice.id===s.id} onClick={()=>{setOpenSuggestionId(choice.id);setEditingSuggestionId(null)}}>方案 {index+1}</button>)}</div>}
    {renderSuggestionCard(s)}</>}
  </div>;
 }
 // The legacy browser-print template is retained solely for synthetic QA.
 // Production PDF must originate from a renderer-verified original DOCX.
 const legacyPrintQa=import.meta.env.DEV&&typeof window!=='undefined'&&
  window.location.pathname.startsWith('/qa/');
 const confirmedWordChanges=useMemo(()=>{
  const accepted=new Set(version.acceptedSuggestionIds);
  // Use final, user-confirmed text only. Appending paragraphs, AI unconfirmed
  // suggestions, and non-exact source blocks must never silently patch Word.
  const candidates=suggestions.filter(item=>accepted.has(item.id)&&item.action==='replace')
   .map(item=>({
    original:item.original,proposed:version.blocks.find(b=>b.id===item.blockId)?.text||''
   })).filter(({original,proposed})=>original!==proposed&&
    original.length>1&&(MATCH_V4_PREVIEW||original.length<=300)&&
    proposed.length>1&&(MATCH_V4_PREVIEW||proposed.length<=300)&&
    original===original.trim()&&proposed===proposed.trim()&&
    !/[\r\n\t]/.test(original+proposed));
  const occurrences=new Map<string,number>();
  for(const change of candidates)
   occurrences.set(change.original,(occurrences.get(change.original)||0)+1);
  const approvedWhole=wholeApproved&&wholeDraft?
   wholeDraft.blocks.filter(b=>b.changed&&b.status==='needs_user_confirmation'&&
    b.original.length>1&&(MATCH_V4_PREVIEW||b.original.length<=300)&&
    b.proposed.length>1&&(MATCH_V4_PREVIEW||b.proposed.length<=300)&&
    !/[\r\n\t]/.test(b.original+b.proposed)).map(b=>({
     original:b.original,proposed:b.proposed
    })):[];
  for(const item of approvedWhole)
   occurrences.set(item.original,(occurrences.get(item.original)||0)+1);
  return [...candidates,...approvedWhole].filter(change=>occurrences.get(change.original)===1);
 },[suggestions,version.blocks,version.acceptedSuggestionIds,wholeApproved,wholeDraft]);
 const visualWordSuggestions=useMemo<WordVisualSuggestion[]>(()=>suggestions
  .slice(0,revealedSuggestionCount)
  .filter(s=>s.action==='replace'&&!ignored.includes(s.id)&&!resolvedWordVisualIds.includes(s.id)&&(!MATCH_V4_PREVIEW||!suggestions.some(other=>other.blockId===s.blockId&&other.id!==s.id&&(version.acceptedSuggestionIds.includes(other.id)||editedWordVisualIds.includes(other.id)))))
  .filter((s,i,items)=>!MATCH_V4_PREVIEW||items.findIndex(other=>other.original===s.original)===i)
  .map(s=>({
   id:s.id,original:s.original,
   proposed:version.acceptedSuggestionIds.includes(s.id)?
    (version.blocks.find(b=>b.id===s.blockId)?.text||s.proposed):
    (suggestionDrafts[s.id]??s.proposed),
   state:version.acceptedSuggestionIds.includes(s.id)?'accepted' as const:'pending' as const
  }))
  .filter(s=>s.original.trim()&&s.proposed.trim()&&
   s.original!==s.proposed&&(MATCH_V4_PREVIEW||s.proposed.length<=300)&&
   !(wordRevisionSnapshot?.history||[])
    .slice(0,wordRevisionSnapshot?.revision||0)
    .some(saved=>saved.original===s.original&&saved.text===s.proposed))
  .concat((wholeDraft?.blocks||[])
   .slice(0,revealedWholeCount)
   .filter(b=>b.changed&&!resolvedWordVisualIds.includes('whole-'+b.blockId)&&
     (MATCH_V4_PREVIEW||(b.original.length<=300&&b.proposed.length<=300))&&
    b.proposed!==b.original)
   .map(b=>({
    id:'whole-'+b.blockId,original:b.original,proposed:b.proposed,
    state:wholeApproved?'accepted' as const:'pending' as const
   }))),
 [suggestions,revealedSuggestionCount,ignored,resolvedWordVisualIds,version.acceptedSuggestionIds,
  version.blocks,suggestionDrafts,wordRevisionSnapshot,wholeDraft,wholeApproved,editedWordVisualIds,
  revealedWholeCount]);
 const pendingSuggestions=suggestions.filter(s=>!ignored.includes(s.id)&&
  !editedWordVisualIds.includes(s.id)&&!version.acceptedSuggestionIds.includes(s.id)&&(!MATCH_V4_PREVIEW||!suggestions.some(other=>other.blockId===s.blockId&&(version.acceptedSuggestionIds.includes(other.id)||editedWordVisualIds.includes(other.id)))));
 const acceptedCount=suggestions.filter(s=>version.acceptedSuggestionIds.includes(s.id)||editedWordVisualIds.includes(s.id)).length;
 const pendingTextChanges=version.blocks.some(block=>{
  const original=blocks.find(item=>item.id===block.id);
  if(!original||original.text===block.text)return false;
  return !sourceResume||!verifiedWordEdits.some(change=>
   change.original===original.text&&change.text===block.text);
 });
 const draftDirty=pendingTextChanges||Boolean(editingBlock)||
  Boolean(wholeDraft&&!wholeDownloaded)||
  Boolean(nativeWordTextDraft&&nativeWordTextDraft.text!==nativeWordTextDraft.original)||
  suggestions.some(item=>!ignored.includes(item.id)&&
   !version.acceptedSuggestionIds.includes(item.id)&&
   ((suggestionDrafts[item.id]||'').trim().length>0||
    (newEvidence[item.id]||'').trim().length>0))||
  Object.values(details).some(value=>String(value||'').trim().length>0);

 function restoreSessionDraft(){
  const data=recoverableDraft;
  if(!data||!Array.isArray(data.version?.blocks))return;
  const currentIds=new Set(blocks.map(b=>b.id));
  if(data.source_signature!==sourceSignature||
   data.version.blocks.some((item:ResumeBlock,index:number)=>
    !currentIds.has(item.id)||item.id!==blocks[index]?.id||
    item.section!==blocks[index]?.section||
    typeof item.text!=='string'||item.text.length<1||(!MATCH_V4_PREVIEW&&item.text.length>1600))){
   setDraftStatus('草稿和当前简历不完全一致，为安全起见未恢复。');return;
  }
  // Untrusted browser state can restore wording, never approval. All AI
  // recommendations require fresh evidence confirmation after recovery.
  const reviewed=Array.isArray(data.suggestions)?
   data.suggestions.filter((item:ResumeSuggestion)=>
    item&&validateSuggestion(data.version.blocks,item)).slice(0,MATCH_V4_PREVIEW?undefined:12):[];
  const approvedIds=new Set(reviewed.map((item:ResumeSuggestion)=>item.id));
  const safeFields=(value:unknown,max:number):Record<string,string>=>{
   const input=value&&typeof value==='object'&&!Array.isArray(value)?
    value as Record<string,unknown>:{};
   const cleaned:Record<string,string>={};
   for(const [key,text] of Object.entries(input))
    if(approvedIds.has(key)&&typeof text==='string'&&text.length<=max)
     cleaned[key]=text;
   return cleaned;
  };
  const native=data.native_word_draft;
  setNativeWordTextDraft(native&&typeof native.original==='string'&&
   typeof native.text==='string'&&native.original.length>0&&
   (MATCH_V4_PREVIEW||(native.original.length<=300&&native.text.length<=300))&&
   Number.isInteger(native.revision)&&native.revision>=0&&(MATCH_V4_PREVIEW||native.revision<=8)&&
   Number.isInteger(native.page)&&native.page>=1&&(MATCH_V4_PREVIEW||native.page<=20)?
   {original:native.original,text:native.text,revision:native.revision,page:native.page}:null);
  setVersion({id:'draft-'+(postingScope||'invalid'),targetJobId:postingScope||'invalid',
   blocks:data.version.blocks,acceptedSuggestionIds:[]});
  setDetails(normalizeResumeDocumentDetails(data.details));
  setSuggestions(reviewed);setIgnored([]);setResolvedWordVisualIds([]);setEditedWordVisualIds([]);setSuggestionDrafts(safeFields(data.suggestionDrafts,MATCH_V4_PREVIEW?Infinity:1600));
  setNewEvidence(safeFields(data.newEvidence,MATCH_V4_PREVIEW?Infinity:800));
  setConfirmed([]);setOpenSuggestionId(null);setActiveSuggestionId(null);
  setEditingSuggestionId(null);setUndoStack([]);setRecoverableDraft(null);
  setDraftStatus('文字草稿已恢复。AI 建议的确认状态已重置；请重新核实，原 Word 尚未保存。');
 }
 function discardSessionDraft(){
  try{if(draftKey)sessionStorage.removeItem(draftKey);}catch{}
  setRecoverableDraft(null);setRememberDraft(false);setNativeWordTextDraft(null);
  setDraftExpiresAt(null);
  setDraftStatus('已清除本标签页保存的文字草稿。');
 }
 useEffect(()=>{
  if(!rememberDraft||!draftKey||recoverableDraft)return;
  if(!draftExpiresAt||Date.now()>=draftExpiresAt){
   try{sessionStorage.removeItem(draftKey);}catch{}
   setRememberDraft(false);setDraftExpiresAt(null);
   setDraftStatus('本次草稿保护已到期。尚未保存的文字仍在当前页面，若要继续自动保留，请重新授权。');
   return;
  }
  if(!draftDirty){
   try{sessionStorage.removeItem(draftKey);}catch{}
   return;
  }
  const task=setTimeout(()=>{
   try{
    const payload=JSON.stringify({schema:'HHBA_WORD_DRAFT_V2',
     source_signature:sourceSignature,
     expires_at:draftExpiresAt,
     version:{blocks:version.blocks,acceptedSuggestionIds:version.acceptedSuggestionIds},
     suggestions,ignored,suggestionDrafts,newEvidence,details,
     native_word_draft:nativeWordTextDraft});
    if(!MATCH_V4_PREVIEW&&payload.length>60000)throw Error('TOO_LARGE');
    sessionStorage.setItem(draftKey,payload);
    setDraftStatus('文字草稿已保存在当前浏览器标签页（不包含 Word 原文件）。');
   }catch{setDraftStatus('当前浏览器无法自动保存草稿，请避免关闭页面。');}
  },850);
  return()=>clearTimeout(task);
 },[draftKey,rememberDraft,draftDirty,draftExpiresAt,recoverableDraft,sourceSignature,
    nativeWordTextDraft,version,suggestions,ignored,suggestionDrafts,newEvidence,details]);
 useEffect(()=>{
  if(!rememberDraft||!draftKey||!draftExpiresAt)return;
  const remaining=Math.max(0,draftExpiresAt-Date.now());
  const timer=setTimeout(()=>{
   try{sessionStorage.removeItem(draftKey);}catch{}
   setRememberDraft(false);setDraftExpiresAt(null);setRecoverableDraft(null);
   setDraftStatus('草稿保留时间已结束。请重新授权后再启用自动保留。');
  },remaining);
  return()=>clearTimeout(timer);
 },[rememberDraft,draftKey,draftExpiresAt]);

 useEffect(()=>{onDraftDirtyChange?.(draftDirty||nativeWordPending);},
  [draftDirty,nativeWordPending,onDraftDirtyChange]);
 useEffect(()=>{
  if(!draftDirty&&!nativeWordPending)return;
  const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',prevent);
  return()=>window.removeEventListener('beforeunload',prevent);
 },[draftDirty,nativeWordPending]);
 const hasSession=realAuthReady&&Boolean(getRealAuthToken());
 const optimizationControls=<>
  {sourceResume&&wholeStatus?.enabled&&wholeSource.complete&&<div className="hhba-whole-rewrite-start">
   <button type="button" className="hhba-whole-rewrite-primary"
    disabled={wholeBusy||busy||!wholeSource.complete||!wholeStatus?.enabled}
    onClick={()=>{
     if(!consent){
      setAiSettingsOpen(true);
      setNotice('请先确认第三方 AI 数据处理授权，再进行整份简历撰写。');
      return;
     }
     void generateWholeRewrite();
    }}>
    {wholeBusy?<><LoaderCircle size={16} className="resume-match-spinning"/>
      AI 正在规划并撰写整份简历…</>:<><Sparkles size={16}/>
      AI 针对岗位重写整份简历</>}
   </button>
   {wholeBusy&&<button type="button" className="hhba-whole-rewrite-cancel"
    onClick={()=>{
     active.current?.abort();setWholeBusy(false);
     setNotice('已停止后续 AI 优化；已生成的草稿仍然保留，原 Word 没有修改。');
    }}>停止 AI 继续处理</button>}
  </div>}
  <div className="targeted-resume-toolbar">
   <div><strong>优化这份简历</strong><p>根据目标岗位提出修改建议，不会凭空添加经历。</p></div>
   {hasSession&&status?.enabled
    ?<button type="button" disabled={busy||wholeBusy||!blocks.length||legacyPrintQa&&!sourceResume&&!consent} onClick={()=>{
       if(!consent){
        setAiSettingsOpen(true);
        setNotice('请先展开隐私设置，确认 AI 处理授权，然后再生成建议。');
        return;
       }
       void generate();
      }}>
       {busy?<><LoaderCircle size={15} className="resume-match-spinning"/> 正在分析简历…</>:<><Sparkles size={15}/> {sourceResume?'生成本岗位建议':'开始 AI 优化'}</>}
      </button>
    :<span className="targeted-resume-unavailable">{!hasSession?'站内登录后可使用 AI 润色':status?'AI 润色尚未开放':'正在检查服务状态…'}</span>}
  </div>
  <details className="targeted-resume-ai-settings" open={sourceResume?aiSettingsOpen:legacyPrintQa||aiSettingsOpen}
   onToggle={event=>{if(sourceResume||!legacyPrintQa)setAiSettingsOpen(event.currentTarget.open)}}>
   <summary>隐私授权与草稿设置 <ChevronDown size={14}/></summary>
  {omittedSourceCharacters>0&&<p className="targeted-resume-truncation" role="alert">
   <strong>这份简历有部分内容未显示。</strong>部分文字超出可编辑或可打印容量，
   仍有约 {omittedSourceCharacters} 个非空白字符未纳入本次预览。
   为避免遗漏经历，本次暂不允许保存岗位版本或导出 Word 草稿；请先上传精简或分段整理后的原始简历。
   原上传文件不会因此被修改。
  </p>}
  {hasSession&&(status?.enabled||wholeStatus?.enabled)&&<label className="targeted-resume-consent">
   <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
   <span>我同意将上传简历中可提取的完整文字（用于整份 AI 撰写），或当前选取的简历证据（用于局部优化），连同目标岗位要求发送给平台选定的第三方 AI 服务商。系统会尽力遮盖常见联系方式，但不能保证移除全部个人信息。结果仅作为待本人核实的草稿，不会自动投递，也不会未经确认覆盖原 Word。</span>
  </label>}
  {sourceResume&&draftKey&&<section className="targeted-resume-draft-recovery" aria-label="当前标签页草稿保护">
   <label><input type="checkbox" checked={rememberDraft} onChange={event=>{
    const enabled=event.target.checked;
    if(!enabled)discardSessionDraft();
    else {
     setDraftExpiresAt(Date.now()+6*60*60*1000);setRememberDraft(true);
     setDraftStatus('已授权在本标签页保留文字草稿，6 小时后自动失效。');
    }
   }}/>
    在此标签页自动保留未完成的文字草稿（最多 6 小时）
   </label>
   <small>仅保存文字建议，不保存 Word 原文件；不会自动上传至其他服务。共享设备请关闭此选项。</small>
   {recoverableDraft&&<div className="targeted-resume-draft-recovery-actions">
    <strong>找到上次未完成的草稿</strong>
    <button type="button" onClick={restoreSessionDraft}>恢复草稿</button>
    <button type="button" onClick={discardSessionDraft}>删除草稿</button>
   </div>}
   {draftStatus&&<p role="status">{draftStatus}</p>}
  </section>}
  </details>
 </>;
 return <section className={'targeted-resume'+(sourceResume?' is-word-first':'')} aria-label="岗位定向简历优化">
  <div className="targeted-resume-heading">
   <div><small>简历优化 / 原 Word</small><h3>{job.title_zh||job.title}</h3></div>
   <span><Sparkles size={13} aria-hidden="true"/> 智能修改</span>
  </div>
  {!sourceResume&&(legacyPrintQa||textDraft)&&optimizationControls}
  {sourceResume?<section className={'targeted-resume-word-workspace hhba-word-stage-'+entranceStage}
   aria-label="原版式 Word 沉浸式 AI 优化舞台">
   <div className="targeted-resume-word-main">
    {entranceStage==='entering'&&<p className="hhba-word-arrival-hint" role="status">
     正在呈现你的原版式简历…
    </p>}
    <div className="hhba-word-reader-actions" role="group" aria-label="简历 AI 优化">
     <button type="button" className="hhba-word-primary-action"
      disabled={!hasSession||!status?.enabled||busy||wholeBusy||!(sourceResume?wordPromptBlocks.length:blocks.length)}
      aria-label="开始 AI 优化简历"
      title={!hasSession?'请登录后再优化':!status?.enabled?'AI 优化服务暂不可用':!wordPromptBlocks.length?'正在检查 Word 中可安全修改的文字':'针对当前岗位生成原位置修改建议'}
      onClick={()=>{
       if(!consent){setWordConsentChecked(false);setWordConsentOpen(true);return;}
       void generate();
      }}>
      {busy?<><LoaderCircle size={15} className="resume-match-spinning"/> 正在分析…</>:
       <><Sparkles size={16} aria-hidden="true"/> AI 优化简历</>}
     </button>
    </div>
    {postingScope?<OriginalWordViewer key={sourceResume.id+':'+postingScope} resume={sourceResume}
     jobId={postingScope} jobTitle={job.company+'-'+(job.title_zh||job.title)}
     suggestedChanges={confirmedWordChanges}
     glowActive={false}
     visualSuggestions={visualWordSuggestions}
     onVisualSuggestionSelect={id=>{
      if(id.startsWith('whole-')){
       // Siri controls stay on the Word page; never auto-open a covering panel.
      }else{
       setActiveSuggestionId(id);setOpenSuggestionId(id);
       setEditingSuggestionId(null);
      }
     }}
     onVisualSuggestionAction={(id,action,newText,layoutVerified)=>{
      // OriginalWordViewer calls this only after a saved private Word revision
      // (accept/edit), or after the candidate explicitly ignores a draft.
      if(id.startsWith('whole-')){
       setResolvedWordVisualIds(prev=>prev.includes(id)?prev:[...prev,id]);
       setNotice(action==='ignored'?'此处保留原文。':
         layoutVerified?'该处 Word 已通过版式验证并保存。':'该处 Word 已保存，分页需在 Word 中核对。');
       return;
      }
      const item=suggestions.find(s=>s.id===id);
      if(!item)return;
      setResolvedWordVisualIds(prev=>prev.includes(id)?prev:[...prev,id]);
      if(action==='ignored'){
       setIgnored(prev=>prev.includes(id)?prev:[...prev,id]);
       setNotice('已忽略此处改写，保留原文。');
      }else if(action==='edited'){
       const changed=(newText||'').trim();
       // The server has already verified/saved the user's custom text.
       // Never re-apply the earlier AI proposal over the handwritten edit.
       if(changed){
        setEditedWordVisualIds(prev=>prev.includes(id)?prev:[...prev,id]);
        setVersion(prev=>{
         try{return editResumeBlock(prev,item.blockId,changed);}
         catch{return prev;}
        });
       }
       setConfirmed(prev=>prev.includes(id)?prev:[...prev,id]);
       setNotice(layoutVerified?'已按本人编辑的文字保存并核验原 Word 排版。':
         '已按本人编辑的文字保存原格式 Word，分页仍需核对。');
      }else{
       const proposed=(suggestionDrafts[id]??item.proposed).trim();
       setVersion(prev=>{
        if(prev.acceptedSuggestionIds.includes(id))return prev;
        try{return applySuggestion(prev,{...item,proposed},true);}
        catch{return prev;}
       });
       setConfirmed(prev=>prev.includes(id)?prev:[...prev,id]);
       setNotice(layoutVerified?'已采纳并通过 Word 原版式核验，原上传文件未被覆盖。':
         '已采纳并保存原格式 Word，原文件未被覆盖；请核对分页。');
      }
      setOpenSuggestionId(null);setActiveSuggestionId(null);setEditingSuggestionId(null);
     }}
     onRevisionSnapshot={handleWordRevisionSnapshot}
     onDocumentReady={revealRenderedWord}
     onEditableSegments={(segments,documentText)=>{
      // Never infer a writable Word location from a long ATS/search snippet.
      // Ignore contact-like text and only send visible, unique Word spans.
      const safe=[...new Set(segments)].filter(value=>
       typeof value==='string'&&value.length>=6&&(MATCH_V4_PREVIEW||value.length<=300)&&
       value===value.trim()&&!/[\r\n\t@]/.test(value)&&
       !/^\+?[\d\s()-]{7,}$/.test(value));
      wordDocumentText.current=documentText||'';
      const next=safe.map((text,i)=>({id:'word-'+i,section:'experience' as const,text}));
      setWordPromptBlocks(prev=>
       prev.length===next.length&&prev.every((b,i)=>b.text===next[i].text)?prev:next);
     }}
     onPendingChange={setNativeWordPending}
     onVerifiedSave={change=>{
      setVerifiedWordEdits(prev=>[...prev.filter(item=>item.original!==change.original),change]);
      invalidateScore();
     }}
     onVersionMoved={()=>{
      setVerifiedWordEdits([]);setNativeWordTextDraft(null);
     }}
     sessionWordDraft={nativeWordTextDraft}
     onSessionWordDraftChange={setNativeWordTextDraft}
     pendingSuggestionCount={pendingSuggestions.length}/>:<p role="alert">无法确认岗位官网地址，已停止岗位专属 Word 编辑，避免误写其他岗位的简历版本。</p>}
   </div>
   {notice&&<p className={'hhba-word-minimal-message'+
     (/(失败|无法|不可用|错误|请先|超出|没有找到|请重试)/.test(notice)?' is-error':'')}
     role="status">{notice}</p>}
   {wordConsentOpen&&createPortal(
    <div className="hhba-word-consent-overlay" role="presentation"
     onMouseDown={event=>{if(event.currentTarget===event.target)setWordConsentOpen(false)}}>
     <section className="hhba-word-consent-dialog" role="dialog" aria-modal="true"
      aria-labelledby="hhba-word-consent-title" onKeyDown={event=>{
       if(event.key==='Escape'){event.stopPropagation();setWordConsentOpen(false);}
      }}>
      <h2 id="hhba-word-consent-title">开始 AI 优化简历</h2>
      <p>AI 将根据当前岗位要求分析简历中的相关文字，生成需要你亲自核实的修改建议。不会自动覆盖原 Word，也不会自动投递。</p>
      <label className="hhba-word-consent-check">
       <input type="checkbox" autoFocus checked={wordConsentChecked}
        onChange={event=>setWordConsentChecked(event.target.checked)}/>
       <span>我同意将用于优化的简历文字与岗位要求发送给第三方 AI 服务商。系统会尽力遮盖联系方式，但无法保证移除所有个人信息。</span>
      </label>
      <div className="hhba-word-consent-actions">
       <button type="button" onClick={()=>setWordConsentOpen(false)}>取消</button>
       <button type="button" className="hhba-word-consent-start" disabled={!wordConsentChecked}
        onClick={()=>{
         setConsent(true);setGenerateAfterConsent(true);setWordConsentOpen(false);
        }}>同意并开始</button>
      </div>
     </section>
    </div>,document.body)}

  </section>:textDraft?<section className="targeted-resume-document-editor" aria-label="岗位 Word 草稿">
   <div className="targeted-resume-document-heading">
    <div><strong>岗位 Word 草稿</strong><p>核对修改后可下载重新排版的 Word。投递前请检查联系方式。</p></div>
    <div className="targeted-resume-document-actions">
     <button type="button" disabled={!undoStack.length} onClick={undo}><Undo2 size={15}/> 撤销</button>
     <button type="button" disabled={!hasWordingChanges||Boolean(editingBlock)||omittedSourceCharacters>0}
      onClick={()=>{try{downloadResumeDocx(printDocument,job.title_zh||job.title,'简历正文');}
       catch{setNotice('Word 草稿导出失败，请稍后再试。')}}}><FileDown size={15}/> 下载 Word</button>
    </div>
   </div>
   {omittedSourceCharacters>0&&<p role="alert">简历超出草稿容量。请在匹配页核对并精简文字后重试。</p>}
   <div className="targeted-resume-live-paper">
    <ResumePrintSheet document={printDocument} renderBlock={renderEditableBlock}/>
   </div>
  </section>:legacyPrintQa?<>
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
  </>:<section className="targeted-resume-word-onboarding" role="status">
   <strong>先使用原 Word，才能保留你的字体和版式</strong>
   <p>这份简历尚未保存到「我的简历」。请先完成上方私有保存授权，再从原 Word 页面确认 AI 的修改建议。不会生成另一份冒充原排版的简历。</p>
   <Link to="/candidate/account/resume">前往我的简历</Link>
  </section>}
  {!sourceResume&&legacyPrintQa&&before.score!==null&&<div className="targeted-resume-audit" aria-label="文字证据覆盖变化">
   <div><small>优化前 · 要求文字覆盖</small><strong>{before.score}%</strong></div>
   <span aria-hidden="true">→</span>
   <div><small>当前版本 · 要求文字覆盖</small><strong>{after.score}%</strong></div>
   <p>按现有岗位卡片列出的 {before.total} 条要求计算文字相似度，仅用于检查表达是否更清楚；不是岗位匹配分、任职资格判断或录用概率。需人工核实建议的事实依据。</p>
   {after.missing.length>0&&<details><summary>仍未充分体现的要求（{after.missing.length}）</summary>
    <ul>{after.missing.map((label,index)=><li key={index}>{label}</li>)}</ul></details>}
  </div>}
  {!sourceResume&&legacyPrintQa&&<section className="targeted-resume-reassess" aria-label="岗位匹配评分复评">
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
  </section>}
  {!sourceResume&&legacyPrintQa&&<div className="targeted-resume-save">
   <div><strong><FolderOpen size={16} aria-hidden="true"/> 我的岗位简历版本</strong>
    <p>仅在你主动保存后，将当前已确认的文字片段保存在 HHBA 私人账号中；不保存原始 PDF/DOCX。</p></div>
   {hasSession&&storageReady&&<button type="button" disabled={saving||!confirmReal||!canPrint} onClick={persist}>
    <Save size={14} aria-hidden="true"/>{saving?'保存中…':'保存当前版本'}</button>}
   {hasSession&&!storageReady&&<span className="targeted-resume-unavailable">暂时无法保存，请稍后再试</span>}
  </div>}
  {!sourceResume&&legacyPrintQa&&hasSession&&storageReady&&<label className="targeted-resume-confirm targeted-resume-save-confirm">
   <input type="checkbox" checked={confirmReal} onChange={e=>setConfirmReal(e.target.checked)}/>
   我已核实当前简历的全部文字及个人联系方式真实准确，理解点击保存后这些资料会保存在我的 HHBA 云端账户，直到我主动删除或按平台数据政策处理。
  </label>}
  {!sourceResume&&legacyPrintQa&&saved.length>0&&<div className="targeted-resume-history">
   {saved.map(item=><div key={item.id}>
    <span>{new Date(item.created_at).toLocaleString()} · {item.version.acceptedSuggestionIds.length} 条已采纳</span>
    <button type="button" onClick={()=>restore(item)}>载入</button>
    <button type="button" onClick={()=>remove(item)}>删除</button>
   </div>)}
  </div>}
  {!sourceResume&&legacyPrintQa&&<div className="targeted-resume-footer">
   <p><ShieldCheck size={14} aria-hidden="true"/> 原来的参考分：{Number.isInteger(job.reference_score)?job.reference_score+'/100':'暂无可靠分数'}。润色后的匹配分须通过同一评分规则重新评估；评分仅供参考。</p>
   <button type="button" onClick={reset}><Undo2 size={14}/> 恢复原稿</button>
  </div>}
  {!sourceResume&&notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
  {legacyPrintQa&&createPortal(<div className="hhba-print-host" data-hhba-print-host="resume">
    <ResumePrintSheet document={printDocument}/>
   </div>,document.body)}
 </section>;
}
