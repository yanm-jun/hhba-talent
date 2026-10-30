import {useEffect,useRef,useState,type ChangeEvent,type DragEvent} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,FileUp,LoaderCircle,LockKeyhole,SearchCheck,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import {countryOptions} from '../services/jobSearchFacets.mjs';
import {matchResume,matchServiceStatus,ResumeMatchError,type ResumeMatchResponse,type ResumeMatchStatus} from '../services/resumeMatching';
import '../styles/resume-matching.css';

const MAX_UPLOAD=3*1024*1024;
const EDUCATION:Record<string,string>={HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'};
function formatExperience(value:number|null){
 return value===null?'尚未从简历证实工作年限':`${value} 年（来自简历证据）`;
}
function errorMessage(err:unknown){
 if(err instanceof ResumeMatchError)return err.message;
 return '分析暂时失败，请稍后重试。';
}
export function ResumeMatchPage({user}:{user:User|null}){
 const [file,setFile]=useState<File|null>(null);
 const [country,setCountry]=useState('');
 const [remoteOnly,setRemoteOnly]=useState(false);
 const [role,setRole]=useState('');
 const [consent,setConsent]=useState(false);
 const [enabled,setEnabled]=useState<ResumeMatchStatus|null>(null);
 const [loadingStatus,setLoadingStatus]=useState(true);
 const [analyzing,setAnalyzing]=useState(false);
 const [notice,setNotice]=useState('');
 const [result,setResult]=useState<ResumeMatchResponse|null>(null);
 const [showEvidence,setShowEvidence]=useState(false);
 const ctrl=useRef<AbortController|null>(null);
 useEffect(()=>{
  const ac=new AbortController();
  matchServiceStatus(ac.signal).then(setEnabled).finally(()=>setLoadingStatus(false));
  return()=>{ac.abort();ctrl.current?.abort()};
 },[]);
 function select(value:File|null){
  setNotice('');setResult(null);
  if(!value)return setFile(null);
  if(!/\.(pdf|docx)$/i.test(value.name)||value.size<1||value.size>MAX_UPLOAD){
   setFile(null);setNotice('请上传 PDF 或 DOCX，单个文件不超过 3 MB。');
   return;
  }
  setFile(value);
 }
 function drop(event:DragEvent<HTMLLabelElement>){
  event.preventDefault();select(event.dataTransfer.files?.[0]||null);
 }
 async function run(){
  if(!file)return setNotice('请先上传一份简历。');
  if(!consent)return setNotice('请先确认第三方 AI 处理说明。');
  if(!enabled?.enabled)return setNotice('平台 AI 分析尚未开放，无需你自己配置 API Key。');
  setNotice('');setResult(null);setAnalyzing(true);
  const controller=new AbortController();ctrl.current=controller;
  try{
   const response=await matchResume(file,{consent,country,remoteOnly,roleHint:role.trim(),limit:10},controller.signal);
   setResult(response);
  }catch(error){setNotice(errorMessage(error))}
  finally{setAnalyzing(false);ctrl.current=null}
 }
 const statusLabel=loadingStatus?'检查服务状态中…':
  enabled?.enabled?'平台 DeepSeek 服务已就绪':
  enabled?.admin_configured?'后台正在完成启用与额度保护配置':'平台正在配置 DeepSeek，暂未开放';
 const ready=Boolean(enabled?.enabled&&!loadingStatus);
 return <Shell user={user}>
  <section className="resume-match-page">
   <nav className="resume-match-breadcrumb"><Link to="/candidate"><ArrowLeft size={15}/> 我要应聘</Link><span>/</span><strong>AI 简历岗位匹配</strong></nav>
   <div className="resume-match-kicker"><SearchCheck size={17}/> HHBA · 岗位智能匹配</div>
   <h1>上传简历，找到真正适合你的官方职位。</h1>
   <p className="resume-match-intro">分析你的学历、工作经历与技能，结合 Greenhouse、Ashby、Lever 官方在招岗位，列出符合的条件、简历尚未证明的技能，以及需要向企业确认的要求。</p>
   <div className="resume-match-benefits">
    <span><CheckCircle2 size={15}/> 真实官方招聘</span>
    <span><CheckCircle2 size={15}/> 逐项解释匹配</span>
    <span><LockKeyhole size={15}/> 由 HHBA 提供 AI，无需个人 API Key</span>
   </div>
   <p className={ready?'resume-match-status ready':'resume-match-status'} role="status"><span className="resume-match-dot"/>{statusLabel}</p>
   <div className="resume-match-layout">
    <div className="resume-match-main">
     <section className="resume-match-form">
      <div className="resume-match-step">01 · 上传你的简历</div>
      <input id="ai-resume-file" type="file" className="resume-match-hidden" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e:ChangeEvent<HTMLInputElement>)=>select(e.target.files?.[0]||null)}/>
      <label htmlFor="ai-resume-file" className="resume-match-dropzone" onDragOver={e=>e.preventDefault()} onDrop={drop}>
       <FileUp size={29}/><strong>{file?file.name:'点击选择 PDF / DOCX 简历'}</strong>
       <small>{file?`${(file.size/1024/1024).toFixed(2)} MB · 可重新选择文件`:'文件不超过 3 MB · PDF 需包含可选中的文字 · 最多 15 页'}</small>
      </label>
      <div className="resume-match-step">02 · 你的求职偏好（可选）</div>
      <div className="resume-match-filters">
       <label>目标岗位或方向<input maxLength={80} placeholder="例如：销售、软件工程师、数据分析" value={role} onChange={e=>setRole(e.target.value)}/></label>
       <label>目标国家 / 地区<select value={country} onChange={e=>setCountry(e.target.value)}>
        <option value="">不限国家</option>
        {countryOptions.map(opt=><option value={opt.value} key={opt.value}>{opt.zh}</option>)}
       </select></label>
      </div>
      <label className="resume-match-check"><input type="checkbox" checked={remoteOnly} onChange={e=>setRemoteOnly(e.target.checked)}/><span>只推荐官方明确标记为远程的岗位</span></label>
      <div className="resume-match-step">03 · 数据处理授权</div>
      <label className="resume-match-consent">
       <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
       <span>我同意本次上传的简历由 HHBA 服务器临时读取，对邮箱、联系电话等常见标识做尽力脱敏后，将提取的文字发送给第三方 DeepSeek 分析。脱敏不能保证移除所有个人信息，建议上传前自行删除身份证号、住址等敏感信息。我理解结果仅供参考，简历不会自动发送给招聘企业。</span>
      </label>
      <button className="resume-match-run" disabled={!file||!consent||!ready||analyzing} onClick={run}>
       {analyzing?<><LoaderCircle className="resume-match-spinning" size={18}/> 正在分析简历并核对岗位…</>:<>开始智能匹配 <ArrowRight size={17}/></>}
      </button>
      {analyzing&&<button className="resume-match-cancel" onClick={()=>{ctrl.current?.abort();setAnalyzing(false)}}>取消本次分析</button>}
      {notice&&<p className="resume-match-error" role="alert">{notice}</p>}
      <p className="resume-match-fineprint"><ShieldCheck size={15}/> 分析由平台统一 DeepSeek 服务完成，不需要用户输入 API Key。目前为限额试用；分析结果只在当前页面展示，不会自动公开为个人名片。</p>
     </section>
    </div>
    <aside className="resume-match-guide">
     <h2>匹配结果会告诉你什么？</h2>
     <div><b>符合的条件</b><p>学历层级、工作年限和技能是否有简历证据支持。</p></div>
     <div><b>尚未证明的能力</b><p>官方职位提到但简历没有明确体现的技能，不等于你不会。</p></div>
     <div><b>仍需向企业确认</b><p>语言、签证、专业、资格证书和其他官方未能可靠提取的门槛。</p></div>
     <p>你可以随时前往 <Link to="/candidate/jobs">HHBA 招聘市场</Link> 查看最新岗位。</p>
    </aside>
   </div>
   {result&&<section className="resume-match-results" aria-live="polite">
    <div className="resume-match-result-heading"><span>匹配已完成</span><h2>你的简历能力画像与岗位推荐</h2>
     <p>这些内容由 DeepSeek 辅助提取，且需逐条核对，绝不代表企业已经审核你的简历。</p></div>
    <div className="resume-match-profile">
     <div><small>学历</small><strong>{result.profile.education?EDUCATION[result.profile.education]||'待核实':'未识别到可验证的学历'}</strong></div>
     <div><small>工作年限</small><strong>{formatExperience(result.profile.experience_years)}</strong></div>
     <div><small>检索到的技能</small><strong>{result.profile.skills.length} 项</strong></div>
    </div>
    <div className="resume-match-tags">{result.profile.skills.length?result.profile.skills.map(s=><span key={s.name}>{s.name}</span>):<p>简历中暂未找到能可靠验证的技能，请完善文件。</p>}</div>
    {result.profile.experiences?.length>0&&<div className="resume-match-experiences">
      <h3>从简历识别出的工作经历（请核对）</h3>
      {result.profile.experiences.map((item,i)=><div key={i}>
        <strong>{item.role}</strong>
        <span>{[item.organization,item.period].filter(Boolean).join(' · ')}</span>
        <small>原文依据：{item.evidence}</small>
      </div>)}
    </div>}
    <button className="resume-match-evidence-btn" onClick={()=>setShowEvidence(v=>!v)}>
     {showEvidence?'收起':'核对'}简历原文证据 <ChevronDown size={16}/></button>
    {showEvidence&&<div className="resume-match-evidence">
     {result.profile.education_evidence&&<p><b>学历证据：</b>{result.profile.education_evidence}</p>}
     {result.profile.experience_evidence&&<p><b>年限证据：</b>{result.profile.experience_evidence}</p>}
     {result.profile.skills.map(s=><p key={s.name}><b>{s.name}：</b>{s.evidence}</p>)}
     {!result.profile.skills.length&&!result.profile.education_evidence&&!result.profile.experience_evidence&&<p>没有可可靠引用的文本证据，请重新整理简历。</p>}
    </div>}
    <div className="resume-match-count"><h3>匹配到 {result.matches.length} 个官方岗位</h3><p>相关性分是检索排序参考，<strong>不是录用概率或企业打分。</strong></p></div>
    {result.matches.length===0&&<div className="resume-match-none">目前未找到具有充分证据支持的海外岗位。尝试明确填写目标方向、完善简历技能证据或放宽国家筛选；也可以继续使用<Link to="/candidate/jobs">中文岗位搜索</Link>。</div>}
    <div className="resume-match-job-list">{result.matches.map(m=><article className="resume-match-job" key={m.id}>
     <div className="resume-match-job-top"><div><span>{m.company} · {m.location||'地点待确认'}</span><h4>{m.title_zh||m.title}</h4>{m.title_zh&&<small>{m.title}</small>}</div>
      <div className="resume-match-score"><strong>{m.reference_score}</strong><span>相关性参考</span></div></div>
     {m.matched.length>0&&<div className="resume-match-reason"><h5 className="positive">匹配依据</h5>{m.matched.map((s,i)=><p key={i}>{s}</p>)}</div>}
     {m.not_evidenced.length>0&&<div className="resume-match-reason"><h5>简历尚未证明</h5>{m.not_evidenced.map((s,i)=><p key={i}>{s}</p>)}</div>}
     {m.needs_verification.length>0&&<div className="resume-match-reason"><h5>仍需核实</h5>{m.needs_verification.map((s,i)=><p key={i}>{s}</p>)}</div>}
     <div className="resume-match-job-actions">
      <Link to={'/candidate/jobs/'+encodeURIComponent(m.id)}>查看 HHBA 岗位详情</Link>
      <a data-hhba-recruitment-outbound="true" href={m.official_url} target="_blank" rel="noopener noreferrer">前往官方招聘页面 <ArrowRight size={14}/></a>
     </div>
    </article>)}</div>
    <p className="resume-match-fineprint">{result.disclaimer}</p>
   </section>}
  </section>
 </Shell>;
}
