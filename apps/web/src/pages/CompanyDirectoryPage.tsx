import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Search, ShieldCheck } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Link } from '../router';
import { approvedEmployerJobIds, companyDirectoryFromSnapshot,
 type EmployerDirectoryRecord } from '../services/companyDirectory';
import { loadOfficialPublicSnapshot } from '../services/liveRecruitment';
import { loadPublicJobAudit } from '../services/jobSyncStatus';
import type { User } from '../services/api';
import '../styles/company-profiles.css';

const knownIds=new Map([['OpenAI','openai'],['Anthropic','anthropic'],['SpaceX','spacex']]);
export function CompanyDirectoryPage({user}:{user:User|null}){
 const [records,setRecords]=useState<EmployerDirectoryRecord[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [limit,setLimit]=useState(30);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');
  Promise.all([loadOfficialPublicSnapshot(controller.signal),loadPublicJobAudit()])
   .then(([snapshot,audit])=>{
    if(controller.signal.aborted)return;
    const approved=approvedEmployerJobIds(audit,snapshot.updated);
    if(!approved)throw Error('公司目录与岗位审核数据尚未同步');
    setRecords(companyDirectoryFromSnapshot(snapshot,approved));
   }).catch(e=>{
    if(!controller.signal.aborted)setError(e instanceof Error?e.message:'目录不可用');
   }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[retry]);
 const matching=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return q?records.filter(x=>x.identity.company.toLocaleLowerCase().includes(q)):records;
 },[records,query]);
 return <Shell user={user}><section className="company-profile company-directory">
  <nav className="company-profile-top">
   <Link to="/candidate/jobs"><ArrowLeft size={15}/>返回招聘市场</Link>
   <span className="company-directory-counter">HHBA · COMPANIES</span>
  </nav>
  <header className="company-directory-header">
   <h1>企业资料库</h1>
   <p>通过真实招聘来源识别企业、关联招聘职位。企业背景介绍须经过独立核实后发布。</p>
  </header>
  <p className="company-profile-editorial"><ShieldCheck size={16}/>
   同一家公司出现在不同招聘系统时，可能暂时形成不同来源记录，尚未核实的主体关系不会自动合并。</p>
  <label className="company-directory-search"><Search size={17}/>
   <input value={query} maxLength={120} onChange={e=>{setQuery(e.target.value);setLimit(30)}}
    placeholder="搜索企业名称" aria-label="搜索企业资料库"/>
  </label>
  {loading?<p className="company-profile-jobs-state" role="status">正在读取真实企业目录…</p>:
   error?<div className="company-profile-jobs-state" role="alert">
    {error}<button type="button" onClick={()=>setRetry(x=>x+1)}>重试</button>
   </div>:<>
    <p className="company-profile-job-count">
     当前可识别的企业来源：{records.length.toLocaleString()} ·
     符合搜索：{matching.length.toLocaleString()}
    </p>
    <div className="company-directory-grid">
     {matching.slice(0,limit).map(item=><Link className="company-directory-card" key={item.id}
        to={knownIds.get(item.identity.company)&&
            ((item.identity.company==='OpenAI'&&item.identity.platform==='ashby'&&item.identity.source==='openai')||
            (item.identity.company==='Anthropic'&&item.identity.platform==='greenhouse'&&item.identity.source==='anthropic')||
            (item.identity.company==='SpaceX'&&item.identity.platform==='greenhouse'&&item.identity.source==='spacex'))
         ?'/companies/'+knownIds.get(item.identity.company):'/companies/id/'+item.id}>
       <span className="company-directory-icon"><Building2 size={21}/></span>
       <span className="company-directory-card-text">
        <strong>{item.identity.company}</strong>
        <small>{item.identity.platform} · {item.jobCount} 条已核验招聘记录</small>
        <em>{knownIds.has(item.identity.company)?'企业信息与岗位':'企业介绍待完善 · 查看岗位'}</em>
       </span><ArrowRight size={17}/>
     </Link>)}
    </div>
    {matching.length>limit&&<button type="button" className="company-profile-load-more"
      onClick={()=>setLimit(n=>n+30)}>加载更多企业 <ArrowRight size={14}/></button>}
    {matching.length===0&&<p className="company-profile-jobs-state">没有找到符合搜索条件的企业记录。</p>}
   </>}
 </section></Shell>
}
