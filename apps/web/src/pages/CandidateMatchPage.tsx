import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,ChevronDown,FileText,FileUp,LockKeyhole,LoaderCircle,ShieldCheck,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {listSavedWordVersions,wordSourceBytes,type SavedWordVersion} from '../services/originalWordApi';
import {CandidateMatchNativeDialog} from '../components/CandidateMatchNativeDialog';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,uploadPrivateResume,type PrivateResume} from '../services/privateResumes';
import {linkMatchHistoryResume} from '../services/matchHistory';
import {getRealAuthToken} from '../services/realAuth';
import {matchServiceReady,submitExtractedResumeText,inspectResumeTextLocally,recognizeResumeDocument,resumeFileFormat,resumeMatchFileLimit,redactResumeTextLocally,type MatchResponse,type MatchResearchReport,type MatchedJob,type MatchOptions,type NativeMatchActivity,type NativeMatchProgress,type MatchExecution} from '../services/resumeMatch';
import {sessionMatchRecoveryAvailable,MATCH_TASK_SIGNAL,readSessionMatchTask,beginSessionMatchTask,advanceSessionMatchTask,closeSessionMatchTask,managedMatchOptions,type SessionMatchTask} from '../services/resumeMatch';
import '../styles/resume-match.css';

const supportedTypes='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function CandidateMatchPage({user,embedded=false,hosted=false,hostRoute}:{user:User|null;embedded?:boolean;hosted?:boolean;hostRoute?:string}){
 const [file,setFile]=useState<File|null>(null);
 const [savedFiles,setSavedFiles]=useState<PrivateResume[]>([]);
 const [savedId,setSavedId]=useState('');
 const [wordVersions,setWordVersions]=useState<Array<{resume:PrivateResume;version:SavedWordVersion}>>([]);
 const [wordVersionBusy,setWordVersionBusy]=useState(false);
 const [wordVersionNotice,setWordVersionNotice]=useState('');
 const wordVersionRequest=useRef<AbortController|null>(null);
 const [savedPickerOpen,setSavedPickerOpen]=useState(false);
 const deepLinkPending=useRef<string|null>(new URLSearchParams(window.location.search).get('resume'));
 const wordDeepLink=useRef(new URLSearchParams(window.location.search));
 const [previewText,setPreviewText]=useState('');
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [previewError,setPreviewError]=useState('');
 const [ocrFile,setOcrFile]=useState<File|null>(null);
 const [ocrBusy,setOcrBusy]=useState(false);
 const [previewNote,setPreviewNote]=useState('');
 const previewController=useRef<AbortController|null>(null);
 const [vaultError,setVaultError]=useState('');
 const [saveConsent,setSaveConsent]=useState(false);
 const [saveBusy,setSaveBusy]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 // The user chooses whether the ORIGINAL binary should be retained.
 const [storageChoice,setStorageChoice]=useState<'undecided'|'save'|'once'>('undecided');
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({country:'CN',remote_only:false,role_hint:'',limit:10});
 const [working,setWorking]=useState(false);
 const [partialJobs,setPartialJobs]=useState<MatchedJob[]>([]);
 const [researchReport,setResearchReport]=useState<MatchResearchReport>();
 const [researchJobs,setResearchJobs]=useState<MatchedJob[]>([]);
 const [stage,setStage]=useState<NativeMatchProgress>('preparing');
 const [activity,setActivity]=useState<NativeMatchActivity|null>(null);
 const [execution,setExecution]=useState<MatchExecution|null>(null);
 const progress=(next:NativeMatchProgress)=>setStage(previous=>next==='waiting'?previous:next);
 const [error,setError]=useState('');

 const [result,setResult]=useState<MatchResponse|null>(null);
 const [taskFailure,setTaskFailure]=useState(false);
 const taskOpen=useRef(false);
 const sessionTask=useRef<SessionMatchTask|null>(null);
 const [restoringTask,setRestoringTask]=useState(false);
 const [checkingTask,setCheckingTask]=useState(sessionMatchRecoveryAvailable&&!!user&&!!getRealAuthToken());
 const closingTask=useRef(false);
 const pendingStart=useRef<string|null>(null);
 const [optimizationSource,setOptimizationSource]=useState('');
 const controller=useRef<AbortController|null>(null);
 const lastSearch=useRef<{text:string;options:MatchOptions;resumeId?:string}|null>(null);
 const identifiedCharacters=redactResumeTextLocally(previewText).replace(/\s/g,'').length;
 useEffect(()=>{
  const abort=new AbortController();
  void matchServiceReady(abort.signal).then(ok=>{if(!abort.signal.aborted)setAvailability(ok?'ready':'disabled')});
  return()=>{abort.abort();controller.current?.abort();previewController.current?.abort();wordVersionRequest.current?.abort()};
 },[]);
 useEffect(()=>{
  let active=true;let generation=0;
  const reload=()=>{
   const current=++generation;
   if(!privateResumeAvailable||!user||!getRealAuthToken()){
    previewController.current?.abort();
    if(active){setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);setOcrFile(null);setPreviewNote('');}
    wordVersionRequest.current?.abort();wordVersionRequest.current=null;
    if(active){setSavedFiles([]);setSavedId('');setWordVersions([]);setWordVersionBusy(false);setWordVersionNotice('');}return;
   }
   void listPrivateResumes().then(rows=>{if(active&&current===generation){
    setSavedFiles(rows);setVaultError('');
    const versionGroups=Promise.all(rows.filter(item=>/\.docx$/i.test(item.name)).map(async resume=>{
     try{return {items:(await listSavedWordVersions(resume.id)).map(version=>({resume,version})),failed:false};}
     catch{return {items:[],failed:true};}
    }));
    void versionGroups.then(groups=>{if(active&&current===generation){setWordVersions(groups.flatMap(group=>group.items));setWordVersionNotice(groups.some(group=>group.failed)?'部分岗位版本暂无法读取，可继续选择原始简历。':'');}});
    if(!taskOpen.current)setSavedId(previous=>previous&&rows.some(item=>item.id===previous)?previous:'');
    const requested=deepLinkPending.current;
    if(requested){
     deepLinkPending.current=null;
     if(taskOpen.current||controller.current){setVaultError('当前匹配任务仍保留，请先查看或结束本次任务，再选择其他简历。');return;}
     const entry=rows.find(item=>item.id===requested);
     if(/^[0-9a-f-]{36}$/.test(requested)&&entry){
      const scope=wordDeepLink.current.get('word_scope'),revision=Number(wordDeepLink.current.get('word_revision'));
      if(scope&&/^vault-scope-v1-[a-f0-9]{64}$/.test(scope)&&Number.isInteger(revision)&&revision>0){
       void versionGroups.then(groups=>{if(active&&current===generation){
        const selected=groups.flatMap(group=>group.items).find(item=>item.resume.id===entry.id&&item.version.scope===scope&&item.version.revision===revision);
        if(taskOpen.current||controller.current)return;
        if(selected)void selectWordVersion(selected.resume,selected.version);else setVaultError('岗位简历版本已变化或不可用，请重新选择。');
       }});
      }else if(!scope){setSavedId(requested);void preview(entry);}
      else setVaultError('岗位简历版本标识无效。');
     }else setVaultError('指定的简历不在当前账号，请从列表中选择。');
    }
   }})
    .catch(e=>{if(active){setSavedFiles([]);setVaultError(e instanceof Error?e.message:'私有简历暂时无法读取。');}});
  };
  const routeSelection=()=>{if(!/\/candidate\/(?:account\/)?match\/?$/.test(window.location.pathname))return;
   const query=new URLSearchParams(window.location.search);if(query.has('resume')){wordDeepLink.current=query;deepLinkPending.current=query.get('resume');reload();}};
  reload();
  window.addEventListener('popstate',routeSelection);
  window.addEventListener('hhba:word-versions-changed',reload);
  window.addEventListener('hhba:private-resumes-changed',reload);
  window.addEventListener('hhba:real-auth-changed',reload);
  return()=>{active=false;window.removeEventListener('popstate',routeSelection);window.removeEventListener('hhba:word-versions-changed',reload);window.removeEventListener('hhba:private-resumes-changed',reload);
   window.removeEventListener('hhba:real-auth-changed',reload);};
 },[user?.id]);
 async function selectWordVersion(resume:PrivateResume,version:SavedWordVersion){
  if(working||saveBusy||controller.current||taskOpen.current)return;
  wordVersionRequest.current?.abort();const abort=new AbortController();wordVersionRequest.current=abort;
  setWordVersionBusy(true);setVaultError('');
  try{
   const bytes=await wordSourceBytes(resume.id,version.revision,version.scope,abort.signal);
   if(abort.signal.aborted||controller.current||taskOpen.current)return;
   const name=version.jobLabel.replace(/[<>:"/\\|?*]/g,'').slice(0,80)||'岗位专属简历';
   // A new input uses the exact optimized bytes, never the original file ID.
   // The user may match once or explicitly save a new independent source.
   choose(new File([new Uint8Array(bytes).buffer],name+'-已优化.docx',{type:resume.type}));
  }catch(e){if(!abort.signal.aborted)setVaultError(e instanceof Error?e.message:'无法读取优化版本，请重新选择。');}
  finally{if(wordVersionRequest.current===abort){wordVersionRequest.current=null;setWordVersionBusy(false);}}
 }
 function selectSavedResume(id:string){
  if(working||saveBusy||taskOpen.current)return;
  wordVersionRequest.current?.abort();wordVersionRequest.current=null;setWordVersionBusy(false);
  deepLinkPending.current=null;
  previewController.current?.abort();
  setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  setSavedId(id);setFile(null);setResult(null);setPartialJobs([]);setResearchReport(undefined);setResearchJobs([]);setOptimizationSource('');
  setError('');setSaveConsent(false);setSaveNotice('');
  setStorageChoice('undecided');setSavedPickerOpen(false);
  const entry=savedFiles.find(item=>item.id===id);
  if(entry)void preview(entry);
 }
 function choose(candidate:File|null){
  if(working||saveBusy||taskOpen.current)return;
  wordVersionRequest.current?.abort();wordVersionRequest.current=null;setWordVersionBusy(false);
  deepLinkPending.current=null;
  setSavedPickerOpen(false);
  previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setPreviewError('');setConsent(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  setError('');setResult(null);setPartialJobs([]);setResearchReport(undefined);setResearchJobs([]);setOptimizationSource('');setSaveConsent(false);setSaveNotice('');
  setSavedId('');
  setStorageChoice('undecided');
  if(!candidate){setFile(null);return}
  const format=resumeFileFormat(candidate.name);
  if(!format||candidate.size<30||candidate.size>resumeMatchFileLimit(format)){
    setFile(null);setError('文件超过当前解析容量：Word 12 MB，V4 PDF 64 MB。');return;
  }
  setFile(candidate);
  void preview(candidate);
 }
 async function preview(source:File|PrivateResume){
  previewController.current?.abort();
  setPreviewBusy(true);setPreviewError('');setPreviewText('');setPreviewLoaded(false);
  setOcrFile(null);setOcrBusy(false);setPreviewNote('');
  const abort=new AbortController();previewController.current=abort;
  try{
   let selected:File;
   if(source instanceof File)selected=source;
   else{
    const bytes=await fetchPrivateResumeForLocalReview(source,abort.signal);
    if(abort.signal.aborted)return;
    selected=new File([bytes],source.name,{type:source.type});
   }
   const {text,needsOcr}=await inspectResumeTextLocally(selected,abort.signal);
   if(!abort.signal.aborted){
    setPreviewText(text);
    if(needsOcr)setOcrFile(selected);
   }
  }catch(e){
   if(!abort.signal.aborted)setPreviewError(e instanceof Error?e.message:'无法读取简历文字。');
  }finally{
   if(previewController.current===abort){
    setPreviewBusy(false);
    if(!abort.signal.aborted)setPreviewLoaded(true);
    previewController.current=null;
   }
  }
 }
 async function runOcr(){
  if(!ocrFile||previewController.current||previewBusy||ocrBusy||working||saveBusy||!getRealAuthToken())return;
  const abort=new AbortController();previewController.current=abort;
  setOcrBusy(true);setPreviewError('');setPreviewNote('');setConsent(false);
  try{
   const recognized=await recognizeResumeDocument(ocrFile,abort.signal);
   if(abort.signal.aborted)return;
   const enough=recognized.text.replace(/\s/g,'').length>=30;
   if(!previewText.trim()||enough)setPreviewText(recognized.text);
   setPreviewNote(recognized.partial||!enough?'已保留可用文字，请核对原件并补全。':
    '文档识别已完成，请核对经历和技能。');
   if(!recognized.partial&&enough)setOcrFile(null);
  }catch(error){
   if(!abort.signal.aborted)setPreviewError(error instanceof Error?error.message:'文档识别暂未完成，请重试。');
  }finally{
   if(previewController.current===abort){setOcrBusy(false);previewController.current=null;}
  }
 }
 async function saveResume(){
  if(!file||savedId||!saveConsent||saveBusy||!user||!getRealAuthToken())return;
  setSaveBusy(true);setSaveNotice('');
  try{
   const item=await uploadPrivateResume(file,true);
   setSavedId(item.id);setSavedFiles(all=>all.some(x=>x.id===item.id)?all:[item,...all]);
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
   setSaveConsent(false);
   if(result?.history_id){
    try{
     await linkMatchHistoryResume(result.history_id,item.id);
     setSaveNotice('简历已保存到「我的简历」，并关联到本次 AI 匹配历史。');
    }catch{
     setSaveNotice('简历已保存到「我的简历」，但与匹配历史的关联暂未完成；历史推荐内容仍可单独查看。');
    }
   }else setSaveNotice('简历已保存到「我的简历」，下次可以直接选择使用，不必重复上传。');
  }catch(e){setSaveNotice(e instanceof Error?e.message:'简历保存失败，请稍后重试。')}
  finally{setSaveBusy(false)}
 }
 async function restoreTask(task:SessionMatchTask){
  if(controller.current||closingTask.current)return;
  const abort=new AbortController();controller.current=abort;
  taskOpen.current=true;sessionTask.current=task;pendingStart.current=null;setRestoringTask(true);setTaskFailure(false);
  setWorking(true);setStage('preparing');setActivity(null);setExecution(null);setError('');setResult(null);setPartialJobs([]);setResearchReport(undefined);setResearchJobs([]);
  previewController.current?.abort();wordVersionRequest.current?.abort();setFile(null);setSavedId(task.resume_id||'');setPreviewText(task.text);setPreviewLoaded(true);setConsent(false);
  const opts=managedMatchOptions(task);setOptions(opts);setOptimizationSource(redactResumeTextLocally(task.text));
  lastSearch.current={text:task.text,options:opts,resumeId:task.resume_id||undefined};
  try{
   const matched=await submitExtractedResumeText(task.text,opts,true,abort.signal,task.resume_id||undefined,
    stage=>{if(!abort.signal.aborted)progress(stage);},jobs=>{if(!abort.signal.aborted)setPartialJobs(jobs);},
    detail=>{if(!abort.signal.aborted)setActivity(detail);},report=>{if(!abort.signal.aborted)setResearchReport(report);},
    jobs=>{if(!abort.signal.aborted)setResearchJobs(jobs);},
    state=>{if(!abort.signal.aborted)setExecution(state);});
   if(!abort.signal.aborted){setResult(matched);setPartialJobs([]);}
  }catch(e){if(!abort.signal.aborted){setTaskFailure(true);setError(e instanceof Error?e.message:'原研究任务暂未恢复。');}}
  finally{if(controller.current===abort){controller.current=null;setWorking(false);}}
 }
 function clearTaskLocally(){
  controller.current?.abort();controller.current=null;taskOpen.current=false;sessionTask.current=null;pendingStart.current=null;
  setTaskFailure(false);setRestoringTask(false);setPartialJobs([]);setResearchReport(undefined);setResearchJobs([]);setResult(null);setExecution(null);setWorking(false);
 }
 // Initial reload and other tabs only discover an authorized server task.
 // They never re-submit a new CV or create a new task automatically.
 useEffect(()=>{
  if(!sessionMatchRecoveryAvailable||!user||!getRealAuthToken()){setCheckingTask(false);return;}
  let disposed=false;const lookup=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let generation=0;
  const check=async()=>{
   const current=++generation;
   try{
    const found=await readSessionMatchTask(lookup.signal);
    if(disposed||current!==generation||closingTask.current)return;
    setCheckingTask(false);
    const local=sessionTask.current;
    if(!found){if(local)clearTaskLocally();return;}
    if(controller.current&&!local)return; // initial authorized start is in flight
    if(local?.id===found.id&&local.generation===found.generation&&taskOpen.current)return;
    if(local)clearTaskLocally();
    if(!controller.current)void restoreTask(found);
   }catch(e){if(!disposed&&current===generation){
    if(e instanceof Error&&'status' in e&&(e.status===401||e.status===403)){setCheckingTask(false);return;}
    timer=setTimeout(()=>void check(),5000);
   }}
  };
  const sync=(e:StorageEvent)=>{if(e.key===MATCH_TASK_SIGNAL){clearTimeout(timer);void check();}};
  const online=()=>{clearTimeout(timer);void check();};
  void check();window.addEventListener('storage',sync);window.addEventListener('online',online);
  return()=>{disposed=true;lookup.abort();clearTimeout(timer);window.removeEventListener('storage',sync);window.removeEventListener('online',online);};
 },[user?.id]);
 async function closeMatch(explicitTerminate=false){
  if(closingTask.current)return;
  const task=sessionTask.current||(pendingStart.current?{id:pendingStart.current,generation:0}:null);
  if(!task){clearTaskLocally();return;}
  closingTask.current=true;
  try{await closeSessionMatchTask(task,explicitTerminate||working||!!pendingStart.current);clearTaskLocally();}
  catch(e){setError(e instanceof Error?e.message:'未确认服务器终止，请恢复网络后重试。');window.alert('服务器尚未确认结束任务，请恢复网络后再试。');}
  finally{closingTask.current=false;}
 }
 async function run(){
  if((!file&&!savedId)||!consent||working||saveBusy||checkingTask||wordVersionBusy||taskOpen.current||controller.current||previewBusy||ocrBusy||!previewLoaded||
   identifiedCharacters<30||availability!=='ready'||!getRealAuthToken()||
   (file&&!savedId&&storageChoice==='undecided'))return;
  taskOpen.current=true;setTaskFailure(false);setRestoringTask(false);
  setWorking(true);setStage('preparing');setActivity(null);setExecution(null);setError('');setResult(null);setOptimizationSource('');setPartialJobs([]);setResearchReport(undefined);setResearchJobs([]);
  const abort=new AbortController();
  controller.current=abort;
  try{
   // A new upload is never silently stored: save only after explicit choice,
   // and only after its private vault confirms a valid file ID.
   let matchResumeId=savedId;
   const selectedFile=file;
   if(selectedFile&&!matchResumeId&&storageChoice==='save'){
    if(!privateResumeAvailable)throw new Error('当前环境无法私有保存，请选择仅用于本次匹配。');
    setSaveBusy(true);setSaveNotice('正在私有保存原文件…');
    try{
     const stored=await uploadPrivateResume(selectedFile,true);
     matchResumeId=stored.id;
     setSavedId(stored.id);setFile(null);
     setSavedFiles(all=>all.some(item=>item.id===stored.id)?all:[stored,...all]);
     setSaveNotice('原文件已保存到「我的简历」，本次匹配将自动关联该文件。');
     window.dispatchEvent(new Event('hhba:private-resumes-changed'));
    }catch(e){
     setSaveNotice('原文件尚未保存，本次 AI 匹配未启动。可重试，或明确选择「仅用于本次匹配」。');
     throw e;
    }finally{setSaveBusy(false);}
    // A cancellation during upload may still leave an authorized file saved;
    // in that case do not start the AI request.
    if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
   }
   // Consent includes encrypted temporary input recovery, not original-file retention.
   if(sessionMatchRecoveryAvailable)pendingStart.current=crypto.randomUUID();
   const registration=await beginSessionMatchTask(previewText,options,matchResumeId||undefined,abort.signal,pendingStart.current||undefined);
   if(abort.signal.aborted)return;
   if(registration)sessionTask.current=registration.task;
   pendingStart.current=null;
   const task=registration?.task;
   const searchText=task?.text??previewText,searchOptions=task?managedMatchOptions(task):options;
   setOptimizationSource(redactResumeTextLocally(searchText));
   if(task){matchResumeId=task.resume_id||'';if(registration?.attached){setFile(null);setSavedId(matchResumeId);setPreviewText(task.text);setOptions(searchOptions);}}
   const matched=await submitExtractedResumeText(searchText,searchOptions,consent,abort.signal,matchResumeId||undefined,
    stage=>{if(!abort.signal.aborted)progress(stage);},
    jobs=>{if(!abort.signal.aborted)setPartialJobs(jobs);},
    detail=>{if(!abort.signal.aborted)setActivity(detail);},
    report=>{if(!abort.signal.aborted)setResearchReport(report);},
    jobs=>{if(!abort.signal.aborted)setResearchJobs(jobs);},
    state=>{if(!abort.signal.aborted)setExecution(state);});
   if(abort.signal.aborted)return;
   setOptimizationSource(redactResumeTextLocally(searchText));
   lastSearch.current={text:searchText,options:searchOptions,resumeId:matchResumeId||undefined};
   setResult(matched);setPartialJobs([]);
   // Keep selected file for return-to-edit. No automatic re-analysis.
   setConsent(false);
  }catch(e){
   if(!abort.signal.aborted){
    // File storage or local preparation can fail BEFORE a server-side match
    // task exists. Do not strand the user behind an imaginary broken task.
    // A pending registration is different: the server may have accepted it
    // before transport failed, so keep its ID and allow safe recovery.
    const registered=!!sessionTask.current||!!pendingStart.current;
    if(!registered){taskOpen.current=false;setTaskFailure(false);}
    else setTaskFailure(true);
    setError(e instanceof Error?e.message:'智能匹配暂时失败，请稍后再试。');
   }
  }finally{if(controller.current===abort){setWorking(false);controller.current=null;}}
 }
 async function retryFailedTask(){
  if(!taskFailure||controller.current||closingTask.current||checkingTask)return;
  setCheckingTask(true);
  try{
   // Check the authoritative current session task before reconnecting. Never
   // start a second task or resubmit the resume as a fresh paid request.
   const task=await readSessionMatchTask();
   if(!task){
    clearTaskLocally();
    setError('服务器没有可恢复的原任务，请重新开始本次匹配。');
    return;
   }
   sessionTask.current=task;taskOpen.current=true;setTaskFailure(false);setError('');
   void restoreTask(task);
  }catch(e){
   setTaskFailure(true);
   setError(e instanceof Error?e.message:'原研究任务暂无法恢复，请稍后重试。');
  }finally{setCheckingTask(false);}
 }
 async function continueSearch(){
  const previous=result,search=lastSearch.current;
  if(!previous?.can_continue||!search||controller.current||!getRealAuthToken())return;
  const abort=new AbortController();controller.current=abort;
  const combine=(jobs:MatchedJob[])=>Array.from(new Map(
   [...previous.matches,...jobs].map(job=>[job.official_url,job])
  ).values());
  let collected=previous.matches;
  setWorking(true);setStage('preparing');setActivity(null);setExecution(null);setError('');setResult(null);setPartialJobs(collected);
  try{
   const durable=!!previous.research_task_id&&typeof previous.research_generation==='number';
   const registered=sessionTask.current?await advanceSessionMatchTask(sessionTask.current,abort.signal):null;
   if(registered){sessionTask.current=registered;lastSearch.current={text:registered.text,options:managedMatchOptions(registered),resumeId:registered.resume_id||undefined};}
   const next=await submitExtractedResumeText(search.text,registered?managedMatchOptions(registered):{...search.options,
    ...(durable?{research_task_id:previous.research_task_id,research_generation:previous.research_generation!+1}:{exclude_urls:previous.matches.map(job=>job.official_url)})},true,abort.signal,search.resumeId,
    stage=>{if(!abort.signal.aborted)progress(stage);},
    jobs=>{if(!abort.signal.aborted){collected=durable?jobs:combine(jobs);setPartialJobs(collected);}},
    detail=>{if(!abort.signal.aborted)setActivity(detail);},
    report=>{if(!abort.signal.aborted)setResearchReport(report);},
    jobs=>{if(!abort.signal.aborted)setResearchJobs(jobs);},
    state=>{if(!abort.signal.aborted)setExecution(state);});
   if(abort.signal.aborted)return;
   setResult(durable?next:{...next,matches:combine(next.matches)});
   setPartialJobs([]);
  }catch(error){
   if(!abort.signal.aborted){
    setResult(previous.research_task_id?previous:{...previous,matches:collected});
    setPartialJobs([]);
    setError(error instanceof Error?error.message:'继续搜索暂未完成，请重试。');
   }
  }finally{if(controller.current===abort){setWorking(false);controller.current=null;}}
 }
 return <Shell user={user} embedded={embedded||hosted}>
  <section className={embedded?'hhba-ai-page hhba-ai-page-embedded':'hhba-ai-page'}>
    {!embedded&&<nav className="hhba-ai-breadcrumb"><Link to="/candidate/account"><ArrowLeft size={15}/> 工作台</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>}
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> 汇方职场 · HHBA · AI JOB MATCH</div>
      <h1>上传简历，寻找合适岗位。</h1>
      <p>HHBA 将结合你的简历与公开岗位，为你生成个性化推荐。</p>
    </div>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>岗位智能匹配暂时不可用。</strong>
       <p>V4 智能匹配暂未就绪，请检查服务连接。你的个人简历和账户资料不会因此被清空。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className="hhba-ai-layout">
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 1. 上传简历</h2><p>支持 Word（DOCX）和 PDF；大 PDF 可按页识别（本地容量 64 MB），Word 12 MB；私有原文件存储另有大小限制。</p></header>
        {user&&privateResumeAvailable&&savedFiles.length>0&&<div className="hhba-ai-saved-picker">
          <button type="button" className="hhba-ai-saved-picker-trigger"
           aria-expanded={savedPickerOpen} aria-controls="hhba-ai-existing-options"
           disabled={working} onClick={()=>setSavedPickerOpen(open=>!open)}>
           <span className="hhba-ai-saved-picker-heading"><FileText size={18}/>
            <span><strong>从「我的简历」中选择</strong>
             <small>{savedId&&savedFiles.some(item=>item.id===savedId)
              ?'已选择：'+savedFiles.find(item=>item.id===savedId)!.name
              :'已保存 '+savedFiles.length+' 份简历 · 点击展开'}</small></span>
           </span>
           <ChevronDown size={18} className={'hhba-ai-saved-picker-chevron'+(savedPickerOpen?' is-open':'')}/>
          </button>
          <div id="hhba-ai-existing-options" className="hhba-ai-saved-picker-content" hidden={!savedPickerOpen}>
           <div role="radiogroup" aria-label="选择用于本次智能匹配的已保存简历" className="hhba-ai-saved-picker-options">
            {savedFiles.map(item=><label key={item.id}
              className={'hhba-ai-saved-picker-option'+(savedId===item.id?' is-selected':'')}>
             <input type="radio" name="hhba-ai-existing" value={item.id} checked={savedId===item.id}
              disabled={working} onChange={()=>selectSavedResume(item.id)}/>
             <span className="hhba-ai-saved-picker-option-text">
              <strong>{item.name}</strong>
              <small>{(item.size/1024/1024).toFixed(2)} MB · {item.createdAt.slice(0,10)} 保存</small>
             </span>
            </label>)}
           </div>
           {wordVersions.length>0&&<div className="hhba-ai-saved-word-options"><strong>已优化的岗位简历</strong>
            {wordVersions.map(({resume,version})=><button type="button" className="hhba-ai-saved-picker-option" key={resume.id+':'+version.scope} disabled={working||saveBusy||wordVersionBusy} onClick={()=>void selectWordVersion(resume,version)}>
             <FileText size={16}/><span className="hhba-ai-saved-picker-option-text"><strong>{version.jobLabel}</strong><small>来源：{resume.name} · 第 {version.revision} 版</small></span>
            </button>)}</div>}
           {wordVersionBusy&&<p role="status">正在读取岗位专属 Word…</p>}
           {wordVersionNotice&&<p role="status">{wordVersionNotice}</p>}
           <button type="button" className="hhba-ai-saved-picker-clear" disabled={working}
            onClick={()=>selectSavedResume('')}>不使用已保存简历，改为上传新文件</button>
          </div>
        </div>}
        {user&&privateResumeAvailable&&vaultError&&<p className="hhba-ai-vault-error" role="status">{vaultError}</p>}
        {!getRealAuthToken()&&<p className="hhba-ai-service-check">AI 简历匹配需要先 <Link to="/candidate/login?next=%2Fcandidate%2Fmatch">登录 HHBA 求职账号</Link>。</p>}
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes} disabled={working||saveBusy}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>{choose(e.target.files?.[0]||null);e.target.value='';}}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{file?file.name:savedId?'或上传一份新简历，替换当前选择':'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB':'PDF 或 DOCX'}</span>
        </label>
        {(file||savedId)&&<div className="hhba-ai-review-tools">
         {previewBusy&&<p role="status">正在读取简历文字…</p>}
         {ocrBusy&&<p role="status"><LoaderCircle className="spin" size={15}/> 正在识别文档文字…</p>}
         {ocrFile&&!ocrBusy&&<div className="hhba-ai-text-review">
          <strong>{previewText?'部分页面需要进一步识别':'改用 AI 读取文档'}</strong>
          <p>点击下方按钮即同意将这份原文件（可能含联系方式等个人信息）发送给当前配置的第三方 AI 中转服务识别文字。识别完成后，你可以核对和修改结果。</p>
          <button type="button" disabled={working||saveBusy||!getRealAuthToken()} onClick={()=>void runOcr()}>
           {previewError?'同意并重试识别':'同意并识别'}
          </button>
         </div>}
         {previewLoaded&&<div className="hhba-ai-text-review">
          <label htmlFor="hhba-ai-text-preview">用于匹配的简历文字</label>
          {!previewError&&identifiedCharacters>0&&<small role="status">已识别 {identifiedCharacters} 个非空白字符，请核对工作经历、技能和求职方向。</small>}
          {previewNote&&<small role="status">{previewNote}</small>}
          {previewError&&<p className="hhba-ai-error" role="alert">{previewError} 你可以在下方粘贴或补全简历文字。</p>}
          <textarea id="hhba-ai-text-preview" rows={6} maxLength={250000} value={previewText}
           disabled={working||saveBusy||ocrBusy} onChange={e=>{setPreviewText(e.target.value);setConsent(false);}}/>
          <small>{identifiedCharacters<30?'请输入至少 30 个非空白字符。':'可直接修改，最多 250,000 字，超过时建议分段处理。'}</small>
         </div>}
         {!previewBusy&&!ocrBusy&&!ocrFile&&(!previewLoaded||previewError)&&<button type="button" disabled={working||saveBusy}
          onClick={()=>{const source=file||savedFiles.find(item=>item.id===savedId);if(source)void preview(source);}}>
           重新读取简历
         </button>}
        </div>}
        {file&&!savedId&&<fieldset className="hhba-ai-storage-choice" disabled={working||saveBusy}>
         <legend>这份简历，是否保存到「我的简历」？</legend>
         <label className={storageChoice==='save'?'is-selected':''}>
          <input type="radio" name="hhba-resume-storage" value="save"
           checked={storageChoice==='save'} disabled={file.size>3*1024*1024} onChange={()=>setStorageChoice('save')}/>
          <span><strong>保存到我的简历</strong><small>匹配前私有保存原 PDF/DOCX（目前单份 3 MB、最多 3 份），今后可直接选择复用。</small></span>
         </label>
         <label className={storageChoice==='once'?'is-selected':''}>
          <input type="radio" name="hhba-resume-storage" value="once"
           checked={storageChoice==='once'} onChange={()=>setStorageChoice('once')}/>
          <span><strong>仅用于本次匹配</strong><small>不保存原文件；匹配结果仍可保留在账户历史中。</small></span>
         </label>
         <p>请先选择一种方式。保存文件和 AI 分析是两项独立授权；预览文字的编辑不会覆盖原文件。</p>
        </fieldset>}
        {saveNotice&&<p className="hhba-ai-storage-status" role="status">{saveNotice}</p>}
        <header className="hhba-ai-section-title"><h2>2. 选择工作方向</h2>
          <p>可选填目标方向；不填写时，AI 会根据简历为你推荐。</p></header>
        <div className="hhba-ai-mainland-only"><span>工作区域</span><strong>中国大陆</strong><small>不推荐港澳台或境外岗位</small></div>
        <div className="hhba-ai-fields hhba-ai-fields-one">
         <label>目标岗位方向<input value={options.role_hint} placeholder="例如：软件开发、数据分析、销售、视觉设计"
          onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/></label>
        </div>
        <p className="hhba-ai-notice" role="status">
         <ShieldCheck size={15}/>AI 将根据简历检索国内企业职位，打开招聘详情并核对实际工作地点和任职要求。结果不足时会说明哪个环节缺少证据。
        </p>
        <header className="hhba-ai-section-title"><h2>3. 确认 AI 分析与隐私</h2></header>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我已阅读并同意 <a href={import.meta.env.BASE_URL+'privacy'} target="_blank" rel="noopener noreferrer" aria-label="隐私政策（新标签页打开）">《隐私政策》</a>，授权进行 AI 简历分析与岗位匹配。</span>
        </label>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={(!file&&!savedId)||!consent||working||saveBusy||checkingTask||wordVersionBusy||taskOpen.current||previewBusy||ocrBusy||!previewLoaded||
           (file&&!savedId&&storageChoice==='undecided')||
           identifiedCharacters<30||availability!=='ready'||!getRealAuthToken()}>
          {working?<><LoaderCircle className="spin" size={18}/> {saveBusy?'正在保存简历…':'正在匹配岗位…'}</>:
           <><BriefcaseBusiness size={17}/> 开始智能匹配 <ArrowRight size={17}/></>}
        </button>
        {checkingTask&&<p role="status">正在检查是否存在需要恢复的原研究任务…</p>}
        {!working&&taskOpen.current&&<p role="status">本次研究结果仍在任务窗口中，请通过悬浮入口查看或关闭后再开始新匹配。</p>}
        {working&&<p className="hhba-ai-processing" role="status">智能研究正在进行。可通过研究窗口或右下角任务入口查看进度；收起窗口或切换站内页面不会取消搜索。</p>}
      </section>
      <aside className="hhba-ai-aside">
        <div className="hhba-ai-aside-card"><h3>只需三步</h3>
           <ol><li>上传简历</li><li>智能匹配为你寻找岗位</li>
             <li>查看岗位链接和匹配依据</li></ol>
         </div>
         <p className="hhba-ai-aside-footnote">工作地点仅限中国大陆；招聘状态请以岗位原始网页为准。</p>
      </aside>
    </div>
    {((result||partialJobs.length>0)||working||researchJobs.length>0||taskFailure)&&<CandidateMatchNativeDialog
      hostRoute={hostRoute} taskStartedAt={sessionTask.current?.started_at} taskFailed={taskFailure} initialMinimized={restoringTask||!!hostRoute&&!/\/candidate\/(?:account\/)?match$/.test(hostRoute)}
      result={result||{matches:partialJobs,profile:researchReport?.profile}}
      researchReport={result?.research_report||researchReport} researchJobs={[...researchJobs,...(result?.research_leads||[])]}
      pending={working&&!result} progressStage={stage} progressActivity={activity} execution={execution}
      onContinue={result?.can_continue?()=>void continueSearch():undefined}
      onRetryFailedTask={taskFailure?()=>void retryFailedTask():undefined}
      notice={working?'':error}
      sourceText={optimizationSource||undefined}
      sourceResume={savedId?savedFiles.find(item=>item.id===savedId&&/\.docx$/i.test(item.name)):undefined}
      accountScope={String(user?.id||'')}
      resumeStorage={result&&file&&!savedId&&/\.docx$/i.test(file.name)?{
        available:true,saved:false,consent:saveConsent,saving:saveBusy,
        notice:saveNotice,onConsent:setSaveConsent,onSave:()=>void saveResume()
       }:result&&savedId?{available:false,saved:true,consent:false,saving:false,
        notice:saveNotice,onConsent:()=>{},onSave:()=>{}}:undefined}
      onClose={()=>void closeMatch()}
       onTerminate={()=>void closeMatch(true)}/>}
     <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
