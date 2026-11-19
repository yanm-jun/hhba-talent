import {useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Undo2,ShieldCheck,LoaderCircle,CheckCircle2} from 'lucide-react';
import type {CandidateProfile,JobMatch} from '../services/resumeMatching';
import {getRealAuthToken,realAuthReady} from '../services/realAuth';
import {getResumeOptimizationStatus,requestResumeOptimization,type ResumeOptimizationStatus} from '../services/resumeOptimizationApi';
import {applySuggestion,validateSuggestion,type ResumeBlock,type ResumeSuggestion,type ResumeVersion} from '../services/targetedResumeOptimization';
import '../styles/targeted-resume-optimization.css';

export function TargetedResumeOptimization({profile,job}:{profile:CandidateProfile;job:JobMatch}){
 const blocks=useMemo<ResumeBlock[]>(()=>[
  ...profile.experiences.filter(e=>e.evidence?.trim()).map((e,i)=>({id:'experience-'+i,section:'experience' as const,text:e.evidence.slice(0,1600)})),
  ...profile.skills.filter(s=>s.evidence?.trim()).map((s,i)=>({id:'skill-'+i,section:'skills' as const,text:s.evidence.slice(0,1600)}))
 ].slice(0,12),[profile]);
 const initial=()=>({id:'draft-'+job.id,targetJobId:job.id,blocks,acceptedSuggestionIds:[] as string[]});
 const [version,setVersion]=useState<ResumeVersion>(initial);
 const [suggestions,setSuggestions]=useState<ResumeSuggestion[]>([]);
 const [ignored,setIgnored]=useState<string[]>([]);
 const [confirmed,setConfirmed]=useState<string[]>([]);
 const [consent,setConsent]=useState(false);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState<ResumeOptimizationStatus|null>(null);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  getResumeOptimizationStatus(abort.signal).then(setStatus);
  return ()=>{abort.abort();active.current?.abort();};
 },[]);
 const requirements=useMemo(()=>[
  job.requirements_basis,...job.matched,...job.not_evidenced,...job.needs_verification
 ].filter(Boolean).join('\n').slice(0,2500),[job]);
 async function generate(){
  if(!consent||!blocks.length||busy||!status?.enabled)return;
  setBusy(true);setNotice('');setSuggestions([]);setIgnored([]);setConfirmed([]);setVersion(initial());
  const controller=new AbortController();active.current=controller;
  try{
   const incoming=await requestResumeOptimization(blocks,{
    title:(job.title_zh||job.title).slice(0,120),requirements
   },controller.signal);
   const unique=new Set<string>();
   const accepted=incoming.filter(s=>{
    if(unique.has(s.id)||!validateSuggestion(blocks,s))return false;
    unique.add(s.id);return true;
   });
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
   setVersion(applySuggestion(version,s,confirmed.includes(s.id)));
   setNotice('已填充到本次预览，原始简历文件没有被修改。');
  }catch{setNotice('原文已变化或缺乏真实证据，请重新生成建议。');}
 }
 function reset(){
  active.current?.abort();setBusy(false);setVersion(initial());setSuggestions([]);
  setIgnored([]);setConfirmed([]);setNotice('已恢复原始预览。');
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
     <small>{block.section==='experience'?'工作经历':'专业技能'}</small>
     <p>{block.text}</p>
     {s&&!applied&&!dismissed&&<div className="targeted-resume-suggestion">
      <span className="targeted-resume-ai-label"><Sparkles size={13} aria-hidden="true"/> AI 建议 · {s.action==='request_evidence'?'需要补充真实信息':'待用户核实'}</span>
      <p className="targeted-resume-gradient">{s.proposed}</p>
      <p className="targeted-resume-rationale">对应岗位要求：{s.jobRequirement}</p>
      <p className="targeted-resume-rationale">{s.rationale}</p>
      {s.action!=='request_evidence'&&<label className="targeted-resume-confirm">
       <input type="checkbox" checked={confirmed.includes(s.id)}
        onChange={e=>setConfirmed(v=>e.target.checked?[...v,s.id]:v.filter(id=>id!==s.id))}/>
       我已核实建议中的经历、能力和数据均属实
      </label>}
      <div className="targeted-resume-actions">
       {s.action!=='request_evidence'&&<button type="button" disabled={!confirmed.includes(s.id)} onClick={()=>accept(s)}>填充此建议</button>}
       <button type="button" onClick={()=>setIgnored(v=>[...v,s.id])}>保留原文</button>
      </div>
     </div>}
     {applied&&<span className="targeted-resume-applied"><CheckCircle2 size={13} aria-hidden="true"/> 已填充</span>}
    </div>;
   })}
   {!version.blocks.length&&<p>未提取到可引用的工作或技能证据，请先完善原始简历。</p>}
  </div>
  <div className="targeted-resume-footer">
   <p><ShieldCheck size={14} aria-hidden="true"/> 岗位相关性参考：{job.reference_score}/100。润色后的匹配分须通过同一评分规则重新评估；本预览不虚报分数。</p>
   <button type="button" onClick={reset}><Undo2 size={14}/> 恢复原始预览</button>
  </div>
  {notice&&<p role="status" className="targeted-resume-notice">{notice}</p>}
 </section>;
}
