import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Building2,ExternalLink,Search,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,ApiError,employerApiReady,type EmployerPosting,type User} from '../services/api';
import '../styles/employer-public-jobs.css';

const typeNames:Record<string,string>={SOCIAL:'社会招聘',CAMPUS:'校园招聘',INTERNSHIP:'实习招聘'};
const modeNames:Record<string,string>={onsite:'线下办公',hybrid:'混合办公',remote:'远程办公'};
function safeLink(value:string){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.'))return null;
  return url.href;
 }catch{return null}
}
function errorText(e:unknown){
 if(e instanceof ApiError){
  if(e.status===503||e.status===0)return '企业自发布职位尚未连接公开业务服务器。请先使用官方 ATS 岗位搜索。';
  if(e.status===404)return '该职位已关闭、过期或企业认证已失效，不能继续访问。';
  return e.message;
 }
 return '加载企业岗位失败，请稍后重试。';
}
export function EmployerPublicJobsPage({user}:{user:User|null}){
 const [query,setQuery]=useState('');
 const [submitted,setSubmitted]=useState('');
 const [page,setPage]=useState(0);
 const [jobs,setJobs]=useState<EmployerPosting[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [total,setTotal]=useState(0);
 const take=20;
 useEffect(()=>{
  if(!employerApiReady)return;
  let alive=true;setBusy(true);
  api.publicEmployerPostings(submitted,take,page*take)
   .then(r=>{if(alive){setJobs(r.items);setTotal(r.total);setError('')}})
   .catch(e=>{if(alive){setJobs([]);setError(errorText(e))}})
   .finally(()=>{if(alive)setBusy(false)});
  return()=>{alive=false};
 },[submitted,page]);
 function submit(e:FormEvent){e.preventDefault();if(!employerApiReady)return;setPage(0);setSubmitted(query.trim())}
 const disabled=!employerApiReady;
 return <Shell user={user}><main className="employer-public-page">
  <div className="employer-public-back"><Link to="/candidate/jobs"><ArrowLeft size={15}/> 返回官方招聘市场</Link></div>
  <div className="employer-public-head"><span className="page-kicker">HHBA · 企业直发招聘</span>
   <h1>企业自行发布的招聘岗位</h1>
   <p>这里仅展示经企业认证及平台岗位审核的有效职位，区别于现有 Greenhouse、Ashby、Lever 官方 API 同步职位。企业主体或经办人认证失效、招聘权限撤销、职位关闭或到期时，岗位会停止展示。</p></div>
  {!employerApiReady&&<div className="employer-public-offline" role="status"><ShieldCheck size={20}/><div><b>公开职位接口尚未上线</b><p>当前是页面预览，不会展示虚构企业或招聘信息。你仍可查阅<Link to="/candidate/jobs">全球官方真实招聘岗位</Link>。</p></div></div>}
  <form className="employer-public-search" onSubmit={submit}><Search size={17}/><input value={query} maxLength={100} disabled={disabled||busy} onChange={e=>setQuery(e.target.value)} placeholder="搜索已审核企业、岗位或地区"/><button disabled={disabled||busy}>{busy?'搜索中…':'搜索岗位'}</button></form>
  {error&&<p className="employer-public-error" role="alert">{error}</p>}
  {employerApiReady&&<><p className="employer-public-count">当前检索到约 {total} 个符合条件的企业自发布岗位 · 与官方 ATS 岗位分别展示</p>
   <div className="employer-public-list">
   {!busy&&jobs.length===0&&!error&&<p className="employer-public-empty">目前没有处于有效审核与公开状态的企业招聘岗位。</p>}
   {jobs.map(job=>{
    const url=safeLink(job.apply_url);
    return <article className="employer-public-job" key={job.id}>
     <div className="employer-public-company"><Building2 size={16}/>{job.company}<small>HHBA 企业直发 · 已审核</small></div>
     <h2>{job.title}</h2>
     <p>{job.location} · {typeNames[job.recruitment_type]||'招聘'} · {modeNames[job.work_mode]||'工作方式待确认'}</p>
     <div className="employer-public-section"><b>岗位职责</b><p>{job.description}</p></div>
     <div className="employer-public-section"><b>任职要求</b><p>{job.requirements}</p></div>
     <div className="employer-public-actions">
      {url?<a href={url} target="_blank" rel="noopener noreferrer">前往企业投递页面 <ExternalLink size={14}/></a>:<span>投递链接尚未通过安全校验，暂不能跳转</span>}
     </div>
     <small className="employer-public-disclaimer">企业自行发布的岗位，非 HHBA 官方 ATS 自动同步数据。投递前请再次核实企业与招聘信息。</small>
    </article>
   })}
   </div>
   <div className="employer-public-pagination"><button disabled={busy||page===0} onClick={()=>{setPage(p=>Math.max(0,p-1));window.scrollTo({top:0,behavior:'smooth'})}}>上一页</button><span>第 {page+1} 页</span><button disabled={busy||jobs.length<take||(page+1)*take>=total} onClick={()=>{setPage(p=>p+1);window.scrollTo({top:0,behavior:'smooth'})}}>下一页 <ArrowRight size={13}/></button></div>
  </>}
 </main></Shell>
}
