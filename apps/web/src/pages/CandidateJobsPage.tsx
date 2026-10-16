
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Link } from '../router';
import type { User } from '../services/api';
import '../styles/candidate-jobs.css';

type Channel = '' | 'CAMPUS' | 'SOCIAL' | 'INTERNSHIP';
type Job = {
 job_id: string; record_kind?: string;
 job_title?: string | null; company_display_name?: string | null;
 work_city?: string | null; primary_recruitment_type?: string | null;
 education_min?: string | null; job_status?: string | null;
 status_checked_at?: string | null; last_verified_at?: string | null;
 application_access_status?: string | null;
 official_detail_url?: string | null; source_platform?: string | null; source_id?: string | null;
};
type SearchResult = { items: Job[]; total: number };
const API = '/recruitment/api/v1';
const size = 12;
const names: Record<string, string> = {CAMPUS:'校园招聘', SOCIAL:'社会招聘', INTERNSHIP:'实习招聘'};
const states: Record<string, string> = {OPEN:'历史标记开放',CLOSED:'历史标记关闭',EXPIRED:'历史标记过期',UNKNOWN:'待核验',ACCESS_RESTRICTED:'历史访问受限'};
const label=(v?: string | null, fallback='未披露') => typeof v === 'string' && v.trim() ? v.trim() : fallback;
const day=(v?: string | null) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0,10) : '未记录';
function officialLink(v?: string | null) {
 if(!v)return null;
 try {const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname?u.href:null;}catch{return null;}
}
async function readJSON<T>(url: string, signal: AbortSignal): Promise<T> {
 const r=await fetch(url,{method:'GET',credentials:'omit',signal,headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('Recruitment API unavailable');
 return await r.json() as T;
}
function Trail({detail=false}:{detail?:boolean}) {
 return <nav className="hhba-job-trail" aria-label="应聘路径"><Link to="/">首页</Link><span>/</span><Link to="/candidate">我要应聘</Link><span>/</span>{detail?<Link to="/candidate/jobs">招聘岗位</Link>:<strong>招聘岗位</strong>}{detail&&<><span>/</span><strong>职位详情</strong></>}</nav>;
}
function Position({job}:{job:Job}) {
 const valid=/^[A-Za-z0-9_-]{1,64}$/.test(job.job_id||'');
 return <article className="hhba-position-card">
   <span className="hhba-position-company">{label(job.company_display_name,'企业名称待确认')}</span>
   <h3>{valid?<Link to={'/candidate/jobs/'+encodeURIComponent(job.job_id)}>{label(job.job_title,'未命名历史岗位')}</Link>:label(job.job_title,'未命名历史岗位')}</h3>
   <div className="hhba-position-tags"><span>{names[job.primary_recruitment_type||'']||'待分类'}</span><span>{label(job.work_city,'地点未披露')}</span><span>{states[job.job_status||'']||'历史状态未知'}</span></div>
   <div className="hhba-position-footer"><small>历史核验：{day(job.status_checked_at||job.last_verified_at)}</small>{valid&&<Link to={'/candidate/jobs/'+encodeURIComponent(job.job_id)}>查看详情 <ArrowRight size={14}/></Link>}</div>
 </article>;
}
export function CandidateJobsPage({user}:{user:User|null}) {
 const [q,setQ]=useState(''),[city,setCity]=useState('');
 const [filters,setFilters]=useState<{q:string;city:string;kind:Channel}>({q:'',city:'',kind:''});
 const [page,setPage]=useState(0),[response,setResponse]=useState<SearchResult|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
   const ctrl=new AbortController();
   const p=new URLSearchParams({limit:String(size),offset:String(page*size)});
   if(filters.q)p.set('q',filters.q);if(filters.city)p.set('city',filters.city);if(filters.kind)p.set('recruitment_type',filters.kind);
   setLoading(true);setError(false);
   readJSON<SearchResult>(API+'/jobs?'+p.toString(),ctrl.signal).then(result=>{
     if(!Array.isArray(result.items)||!Number.isInteger(result.total)||result.total<0)throw Error('invalid data');
     setResponse(result);
   }).catch(()=>{if(!ctrl.signal.aborted){setError(true);setResponse(null);}})
     .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
   return ()=>ctrl.abort();
 },[filters,page,retry]);
 const submit=(e:FormEvent)=>{e.preventDefault();setPage(0);setFilters(current=>({...current,q:q.trim(),city:city.trim()}));};
 const choose=(kind:Channel)=>{setPage(0);setFilters(current=>({...current,kind}));};
 const total=response?.total||0;
 return <Shell user={user}><section className="hhba-jobs-page">
   <Trail/>
   <header className="hhba-jobs-hero"><span className="page-kicker">HHBA · 我要应聘</span><h1>搜索企业官方招聘记录</h1><p>校园招聘、社会招聘、实习独立筛选。岗位状态是历史记录，并非实时可投递承诺。</p>
   <form className="hhba-jobs-form" onSubmit={submit}>
     <label>岗位或企业关键词<input maxLength={120} value={q} onChange={e=>setQ(e.target.value)} placeholder="如：销售、运营、产品"/></label>
     <label>工作城市<input maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="如：杭州"/></label>
     <button className="primary-button" type="submit"><Search size={17}/> 搜索岗位</button>
   </form></header>
   <div className="hhba-jobs-channels" aria-label="招聘类型">
     {([['','全部'],['CAMPUS','校园招聘'],['SOCIAL','社会招聘'],['INTERNSHIP','实习招聘']] as const).map(([kind,name])=><button key={kind} type="button" aria-pressed={filters.kind===kind} className={filters.kind===kind?'active':''} onClick={()=>choose(kind)}>{name}</button>)}
   </div>
   <div className="hhba-jobs-count"><h2>历史岗位搜索</h2><span>{loading?'读取中…':error?'连接不可用':total+' 条历史记录'}</span></div>
   <p className="hhba-jobs-warning"><ShieldCheck size={17}/> 历史 OPEN 不等于当前仍在招聘；所有岗位请以企业官网为准。未经核验的列表候选不会进入正式岗位库。</p>
   {error?<div className="hhba-jobs-empty" role="alert"><p>招聘引擎暂不可用，请检查本地服务配置。</p><button className="secondary-button" onClick={()=>setRetry(x=>x+1)}>重新连接</button></div>:
   loading?<div className="hhba-jobs-empty" role="status">正在查询历史记录…</div>:
   !response?.items.length?<div className="hhba-jobs-empty">没有符合条件的岗位记录。</div>:
   <div className="hhba-position-grid">{response.items.map(job=><Position key={job.job_id} job={job}/>)}</div>}
   {!loading&&!error&&total>0&&<div className="hhba-jobs-pager"><button disabled={page===0} onClick={()=>setPage(Math.max(0,page-1))}>上一页</button><span>第 {page+1} / {Math.max(1,Math.ceil(total/size))} 页</span><button disabled={(page+1)*size>=total} onClick={()=>setPage(page+1)}>下一页</button></div>}
   <p className="hhba-jobs-privacy">此搜索不会上传简历或自动向企业投递。<Link to="/candidate">返回应聘端</Link></p>
 </section></Shell>;
}
export function CandidateJobDetailPage({user,jobId}:{user:User|null;jobId:string}) {
 const [job,setJob]=useState<Job|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{
   const ctrl=new AbortController();setJob(null);setError(false);setLoading(true);
   if(!/^[A-Za-z0-9_-]{1,64}$/.test(jobId)){setError(true);setLoading(false);return;}
   readJSON<Job>(API+'/jobs/'+encodeURIComponent(jobId),ctrl.signal).then(result=>{
     if(result.job_id!==jobId||result.record_kind!=='HISTORICAL_MASTER')throw Error('untrusted record');
     setJob(result);
   }).catch(()=>{if(!ctrl.signal.aborted)setError(true);})
     .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
   return ()=>ctrl.abort();
 },[jobId]);
 const link=officialLink(job?.official_detail_url);
 return <Shell user={user}><section className="hhba-jobs-page"><Trail detail/>
   {loading?<div className="hhba-jobs-empty" role="status">正在读取历史职位详情…</div>:
   error||!job?<div className="hhba-jobs-empty" role="alert">无法获取这条历史职位。<p><Link to="/candidate/jobs">返回岗位搜索</Link></p></div>:
   <><header className="hhba-jobs-hero"><span className="page-kicker">HISTORICAL RECORD · 历史记录</span><h1>{label(job.job_title,'岗位未命名')}</h1><p>{label(job.company_display_name,'企业未披露')} · {label(job.work_city,'城市未披露')}</p><div className="hhba-position-tags"><span>{names[job.primary_recruitment_type||'']||'类型待确认'}</span><span>{states[job.job_status||'']||'历史状态待确认'}</span></div>
     {link?<a className="primary-button hhba-official" href={link} target="_blank" rel="noopener noreferrer">前往企业官网核对 <ArrowRight size={16}/></a>:<p>官方详情链接尚未核实，暂不提供投递入口。</p>}
   </header><div className="hhba-job-detail-grid"><article className="hhba-position-card"><h2>职位基本信息</h2><dl className="hhba-detail-facts">
     <dt>工作地点</dt><dd>{label(job.work_city)}</dd><dt>最低学历</dt><dd>{label(job.education_min)}</dd><dt>最近检查</dt><dd>{day(job.status_checked_at||job.last_verified_at)}</dd>
     <dt>申请状态</dt><dd>{job.application_access_status==='APPLICATION_CONFIRMED_OPEN'?'历史曾观察到入口 · 今天未确认':'申请入口未核验'}</dd></dl><div className="hhba-detail-note">尚无允许公开的职位描述正文。请以官方实际页面为准，不推测职责和要求。</div></article>
     <aside className="hhba-position-card"><h2>历史记录来源</h2><dl className="hhba-detail-facts"><dt>来源平台</dt><dd>{label(job.source_platform)}</dd><dt>企业来源 ID</dt><dd>{label(job.source_id)}</dd><dt>HHBA 记录 ID</dt><dd>{job.job_id}</dd></dl><p className="hhba-detail-note">此处仅有历史事实，不代表当前在招。</p></aside></div></>}
 </section></Shell>;
}
