import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,ExternalLink,Search,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,ApiError,employerApiReady,type PublicEmployerJob,type User} from '../services/api';
import '../styles/employer-public-jobs.css';
import {EmployerJobApplicationForm} from '../components/EmployerJobApplicationForm';

const jobKind:Record<string,string>={SOCIAL:'社会招聘',CAMPUS:'校园招聘',INTERNSHIP:'实习招聘'};
const workplace:Record<string,string>={onsite:'线下办公',hybrid:'混合办公',remote:'远程办公'};
function readable(e:unknown){return e instanceof ApiError&&e.status===404?
 '企业发布岗位的数据服务尚未连接，当前不展示任何模拟岗位。':
 e instanceof ApiError?e.message:'无法连接企业招聘数据服务，请稍后重试。'}
function validApply(url:string){
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)?u.href:null}catch{return null}
}

export function EmployerPublicJobsPage({user}:{user:User|null}){
 const [query,setQuery]=useState('');const [draft,setDraft]=useState('');
 const [jobs,setJobs]=useState<PublicEmployerJob[]>([]);const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);const [busy,setBusy]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{if(!employerApiReady){setBusy(false);setJobs([]);setTotal(0);return}let active=true;setBusy(true);setError('');
  api.publicEmployerJobs(query,offset).then(data=>{if(active){setJobs(data.items);setTotal(data.total)}})
   .catch(e=>{if(active){setJobs([]);setTotal(0);setError(readable(e))}})
   .finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[query,offset]);
 function go(e:FormEvent){e.preventDefault();setQuery(draft.trim());setOffset(0)}
 return <Shell user={user}><main className="employer-public-page">
  <div className="employer-public-kicker"><BriefcaseBusiness size={16}/> HHBA · 企业自主招聘</div>
  <h1>查看经认证企业自主发布的真实招聘岗位。</h1>
  <p>这里仅展示企业主动发布、通过独立人工审核且目前有效的岗位。与 Greenhouse、Ashby、Lever 等官方 ATS 同步岗位<strong>明确分开</strong>，不代表 HHBA 与企业存在合作关系。</p>
  {!employerApiReady&&<p className="employer-public-notice" role="status">企业自主招聘接口尚未上线：此处只提供真实页面预览，不展示虚构企业或职位。你可以继续使用 <Link to="/candidate/jobs">全球官方 ATS 招聘市场</Link>。</p>}
  <form className="employer-public-search" onSubmit={go}><Search size={18}/><input aria-label="搜索已审核的企业岗位" placeholder="搜索岗位、企业或工作地点" value={draft} maxLength={100} onChange={e=>setDraft(e.target.value)}/><button disabled={!employerApiReady||busy}>搜索</button></form>
  {error&&<p className="employer-public-notice" role="alert">{error}</p>}
  {busy?<p className="employer-public-notice">正在读取企业招聘岗位…</p>:
   <div className="employer-public-result-head"><span>{total} 条经过平台审核的企业岗位</span><Link to="/candidate/jobs">查看官方同步岗位 →</Link></div>}
  {!busy&&!error&&employerApiReady&&jobs.length===0&&<div className="employer-public-empty">当前没有符合条件的已审核企业岗位。可以先在<Link to="/candidate/jobs">官方岗位招聘市场</Link>查看职位。</div>}
  <div className="employer-public-list">{jobs.map(p=><article key={p.id} className="employer-public-item">
   <div className="employer-public-meta"><span>{p.company}</span><span>{p.location} · {jobKind[p.recruitment_type]||p.recruitment_type} · {workplace[p.work_mode]||p.work_mode}</span></div>
   <h2><Link to={'/candidate/employer-jobs/'+p.id.replace(/^employer-/,'')}>{p.title}</Link></h2>
   <p>{p.description.slice(0,155)}{p.description.length>155?'…':''}</p>
   <div className="employer-public-bottom"><span><ShieldCheck size={15}/> 企业主体及岗位经人工审核 · 非官方 ATS 同步</span><Link to={'/candidate/employer-jobs/'+p.id.replace(/^employer-/,'')}>查看职位与要求 <ArrowRight size={15}/></Link></div>
  </article>)}</div>
  {!busy&&!error&&employerApiReady&&total>20&&<div className="employer-public-pages"><button disabled={offset===0} onClick={()=>setOffset(x=>Math.max(0,x-20))}>上一页</button><span>{Math.floor(offset/20)+1} 页</span><button disabled={offset+20>=total} onClick={()=>setOffset(x=>x+20)}>下一页</button></div>}
  <p className="employer-public-disclaimer">HHBA 不代收投递简历；职位信息来自企业自主发布。投递前请核对企业主体、招聘地点和薪资真实性，谨防以招聘名义收费。</p>
 </main></Shell>
}
export function EmployerPublicJobDetail({user,id}:{user:User|null;id:string}){
 const [job,setJob]=useState<PublicEmployerJob|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(true);
 useEffect(()=>{if(!employerApiReady){setBusy(false);return}let active=true;api.publicEmployerJob(id).then(x=>{if(active)setJob(x)})
  .catch(e=>{if(active){setJob(null);setError(readable(e))}}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[id]);
 const link=job?validApply(job.apply_url):null;
 return <Shell user={user}><main className="employer-public-page employer-public-detail">
  <Link className="employer-public-back" to="/candidate/employer-jobs"><ArrowLeft size={15}/> 返回企业招聘</Link>
  {!employerApiReady?<p className="employer-public-notice">企业岗位公开接口尚未部署，无法展示真实岗位详情。请前往 <Link to="/candidate/jobs">官方 ATS 招聘市场</Link>。</p>:busy?<p className="employer-public-notice">正在核实岗位状态…</p>:error?<p role="alert" className="employer-public-notice">{error}</p>:
   job&&<><div className="employer-public-kicker"><ShieldCheck size={16}/> 认证企业发布 · 已审核岗位</div>
    <h1>{job.title}</h1><p className="employer-public-description">{job.company} · {job.location} · {jobKind[job.recruitment_type]||job.recruitment_type} · {workplace[job.work_mode]||job.work_mode}</p>
    <section className="employer-public-description-block"><h2>岗位职责</h2><p>{job.description}</p></section>
    <section className="employer-public-description-block"><h2>任职要求</h2><p>{job.requirements}</p></section>
    <p className="employer-public-disclaimer">本岗位由认证企业发布，经过 HHBA 独立审核，不属于第三方 ATS 官方同步；招聘条件及录用结果由发布企业负责。截止时间：{job.expires_at?.slice(0,10)||'请向企业确认'}。</p>
    <EmployerJobApplicationForm id={id} user={user}/>
        {link?<a data-hhba-recruitment-outbound="true" href={link} target="_blank" rel="noopener noreferrer" className="employer-public-apply">前往企业投递页面 <ExternalLink size={17}/></a>:<p className="employer-public-notice">企业提供的投递地址不符合 HTTPS 安全要求，暂不提供跳转。</p>}
   </>}
 </main></Shell>
}
