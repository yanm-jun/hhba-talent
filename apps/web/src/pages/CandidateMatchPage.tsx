import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,FileText,FileUp,LockKeyhole,LoaderCircle,ShieldCheck,TriangleAlert,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {countryOptions} from '../services/jobSearchFacets.mjs';
import {safeOfficialJobUrl} from '../services/liveRecruitment';
import {matchServiceReady,submitResumeForMatching,type MatchResponse,type MatchedJob,type MatchOptions,MatchError} from '../services/resumeMatch';
import '../styles/resume-match.css';

const educationNames:Record<string,string>={HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'};
const supportedTypes='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxResumeSize=3*1024*1024;

function DegreeEvidence({data}:{data:MatchResponse['profile']}){
 return <div className="hhba-ai-profile-grid">
  <div><span>识别学历</span><strong>{educationNames[data.education||'']||'未能确认'}</strong>
    {data.education_evidence&&<small>简历依据：{data.education_evidence}</small>}</div>
  <div><span>工作经验</span><strong>{data.experience_years===null?'未能确认':String(data.experience_years)+' 年'}</strong>
    {data.experience_evidence&&<small>简历依据：{data.experience_evidence}</small>}</div>
  <div><span>识别方向</span><strong>{data.target_roles.length?data.target_roles.join('、'):'待你补充'}</strong></div>
 </div>;
}
function JobReason({title,items,kind}:{title:string;items:string[];kind:'match'|'gap'|'unknown'}){
 return <section className={'hhba-ai-reason hhba-ai-reason-'+kind}>
  <h4>{kind==='match'?<CheckCircle2 size={16}/>:kind==='gap'?<TriangleAlert size={16}/>:<FileText size={16}/>} {title}</h4>
  {items.length?<ul>{items.map((text,i)=><li key={i}>{text}</li>)}</ul>:
    <p>尚无足够证据，不代表一定满足或不满足。</p>}
 </section>;
}
function MatchedJobCard({item,order}:{item:MatchedJob;order:number}){
 const official=safeOfficialJobUrl({
  id:item.id,platform:item.platform,source:item.source,company:item.company,
  title:item.title,url:item.official_url,location:item.location,remote:item.remote
 });
 return <article className="hhba-ai-job-card">
  <div className="hhba-ai-job-header">
    <div><span className="hhba-ai-job-rank">推荐 {order}</span>
      <h3>{item.title_zh||item.title}</h3>
      {item.title_zh&&<p className="hhba-ai-original-title">{item.title}</p>}
      <p className="hhba-ai-job-meta">{item.company} · {item.location||'地点未披露'}
       {item.remote?' · 官方标记远程':''}</p>
    </div>
    <div className="hhba-ai-score"><strong>{item.reference_score}</strong><small>参考相关度</small></div>
  </div>
  <p className="hhba-ai-score-disclaimer">仅为技能与岗位的搜索排序参考分，不是录用概率。</p>
  <div className="hhba-ai-reasons">
    <JobReason title="已找到符合依据" items={item.matched} kind="match"/>
    <JobReason title="简历尚未证明的条件" items={item.not_evidenced} kind="gap"/>
    <JobReason title="需进一步向官网核实" items={item.needs_verification} kind="unknown"/>
  </div>
  <div className="hhba-ai-job-actions">
    <Link to={'/candidate/jobs/'+encodeURIComponent(item.id)}>查看 HHBA 岗位详情</Link>
    {official?<a data-hhba-recruitment-outbound="true" href={official} target="_blank" rel="noopener noreferrer">打开企业官方投递页 <ArrowRight size={14}/></a>:
      <span>官方链接待重新核验</span>}
  </div>
 </article>;
}
export function CandidateMatchPage({user}:{user:User|null}){
 const [file,setFile]=useState<File|null>(null);
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({country:'',remote_only:false,role_hint:'',limit:10});
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<MatchResponse|null>(null);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  void matchServiceReady(abort.signal).then(ok=>{if(!abort.signal.aborted)setAvailability(ok?'ready':'disabled')});
  return()=>{abort.abort();controller.current?.abort()};
 },[]);
 function choose(candidate:File|null){
  setError('');setResult(null);
  if(!candidate){setFile(null);return}
  if(!/\.(pdf|docx)$/i.test(candidate.name)||!candidate.size||candidate.size>maxResumeSize){
    setFile(null);setError('请选择不超过 3 MB 的 PDF 或 DOCX 文件。');return;
  }
  setFile(candidate);
 }
 async function run(){
  if(!file||!consent||working||availability!=='ready')return;
  setWorking(true);setError('');setResult(null);
  const abort=new AbortController();
  controller.current=abort;
  try{
   const matched=await submitResumeForMatching(file,options,consent,abort.signal);
   setResult(matched);
   setFile(null);setConsent(false);
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof MatchError?e.message:'智能匹配暂时失败，请稍后再试。');
  }finally{setWorking(false);controller.current=null}
 }
 return <Shell user={user}>
  <section className="hhba-ai-page">
    <nav className="hhba-ai-breadcrumb"><Link to="/candidate"><ArrowLeft size={15}/> 我要应聘</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> HHBA · AI JOB MATCH</div>
      <h1>上传你的简历，匹配真实招聘岗位。</h1>
      <p>从学历、工作经历、专业技能出发，结合 HHBA 的 Greenhouse、Ashby、Lever 官方招聘索引，说明哪些条件匹配、哪些条件尚未证明。</p>
      <div className="hhba-ai-headline-tags"><span>全平台统一 DeepSeek</span><span>无须自备 API Key</span><span>只匹配核验过的岗位</span></div>
    </div>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>平台 DeepSeek 服务尚未启用。</strong>
       <p>这不是要求你自己输入 API Key。管理员只需在 HHBA 的 Railway 服务端配置一次，你就能使用平台提供的分析能力（受平台用量限制）。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className="hhba-ai-layout">
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 1. 上传简历</h2><p>PDF 或 DOCX，最大 3 MB。上传后自动分析，不会自动向企业投递。</p></header>
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>choose(e.target.files?.[0]||null)}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{file?file.name:'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB · 可以分析':'仅支持可提取文字的 PDF / DOCX；扫描图片暂不支持'}</span>
        </label>
        <header className="hhba-ai-section-title"><h2>2. 选择工作偏好</h2><p>可选项。不填写代表从全部官方岗位中搜索。</p></header>
        <div className="hhba-ai-fields">
          <label>目标岗位方向<input value={options.role_hint} maxLength={80} placeholder="例如：销售经理、软件工程师、产品经理"
            onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/></label>
          <label>希望工作的国家
            <select value={options.country} onChange={e=>setOptions(x=>({...x,country:e.target.value}))}>
              <option value="">不限国家</option>
              {countryOptions.map(v=><option key={v.value} value={v.value}>{v.zh}</option>)}
            </select>
          </label>
        </div>
        <label className="hhba-ai-check"><input type="checkbox" checked={options.remote_only}
          onChange={e=>setOptions(x=>({...x,remote_only:e.target.checked}))}/> 只推荐官方明确标记为远程的岗位</label>
        <header className="hhba-ai-section-title"><h2>3. 确认 AI 分析与隐私</h2></header>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我同意 HHBA 提取简历文本，尽可能隐藏邮箱、电话等直接标识信息后，将文本发送给第三方 DeepSeek 进行能力分析。自动脱敏可能不完整，我已自行检查简历是否包含不愿提供的信息。原始简历不保存到本 AI 匹配服务，也不会自动发布或投递。</span>
        </label>
        <p className="hhba-ai-notice"><ShieldCheck size={15}/> 此试用功能不与 HHBA 账号自动绑定；每次使用均需自行同意。匹配结果仅在当前页面显示，刷新后不会保留。</p>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={!file||!consent||working||availability!=='ready'}>
          {working?<><LoaderCircle className="spin" size={18}/> 正在提取简历并匹配岗位…</>:
           <><BriefcaseBusiness size={17}/> 开始智能匹配 <ArrowRight size={17}/></>}
        </button>
        {working&&<p className="hhba-ai-processing" role="status">后台正在识别简历与核验岗位要求。请保持页面打开，不会在未完成前显示虚构结果。</p>}
      </section>
      <aside className="hhba-ai-aside">
        <div className="hhba-ai-aside-card"><h3>我们会怎样匹配？</h3>
          <ol><li>解析你的学历、技能、经验和目标方向</li>
            <li>读取当前官方岗位和核验过的任职要求</li>
            <li>按真实岗位条件排序并说明依据</li>
            <li>由你自行判断和前往企业官网投递</li></ol>
        </div>
        <p className="hhba-ai-aside-footnote">相关度分数只是搜索排序参考，不是获得面试、录用或签证的概率。任何“未披露”条件都需要官网确认。</p>
      </aside>
    </div>
    {result&&<section className="hhba-ai-results" aria-live="polite">
      <div className="hhba-ai-results-head"><div><span className="hhba-ai-kicker">分析已完成 · 结果仅本次浏览可见</span>
        <h2>你的能力画像与岗位推荐</h2><p>先检查抽取信息是否准确；如果有错误，请修改简历再分析。</p>
       </div><button className="hhba-ai-clear" type="button" onClick={()=>{setResult(null);setError('')}}>清除本次结果</button></div>
      <DegreeEvidence data={result.profile}/>
      <div className="hhba-ai-skill-block"><h3>已识别的专业技能（附简历依据）</h3>
        {result.profile.skills.length?result.profile.skills.map(x=><span key={x.name} title={'简历依据：'+x.evidence}
          className="hhba-ai-skill">{x.name}</span>):<p>简历暂未提供可证实的技能，建议补充具体项目和工具。</p>}
      </div>
      <h3 className="hhba-ai-matches-title">真实招聘岗位推荐 · {result.matches.length} 条</h3>
      {result.matches.length?result.matches.map((x,i)=><MatchedJobCard key={x.id} item={x} order={i+1}/>):
       <div className="hhba-ai-no-results"><p>目前没有找到具备足够简历证据的官方职位，不代表你没有合适工作。可以补充工作经历、技能或放宽国家和远程条件。</p>
        <Link to="/candidate/jobs">先浏览全部招聘岗位 <ArrowRight size={15}/></Link></div>}
      <p className="hhba-ai-bottom-notice">岗位信息可能变化；学历、经验和技能来自官网 JD 的保守机器提取。请以企业最新原文为准。DeepSeek 并不代表企业作出录用决定。</p>
    </section>}
    <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
