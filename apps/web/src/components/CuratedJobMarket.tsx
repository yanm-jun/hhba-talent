import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,BriefcaseBusiness,UsersRound,ExternalLink,Globe2,MapPin,Search,ShieldCheck} from 'lucide-react';
import {Shell} from './Shell';
import {HomeCompanyMarquee} from './HomeCompanyMarquee';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import '../styles/curated-offline.css';

export type CuratedJob={
 id:string;company:string;companyZh:string;titleEn:string;titleZh:string;titleTranslation:'machine_unreviewed';
 locationEn:string;locationZh:string;countryCode:string|null;cityKey:string|null;
 education:string|null;experienceMinYears:number|null;skillSignals:string[];jobCategory:string;
 jobType:string|null;originalPlatform:string;originalSource:string;originalUrl:string;
 officialDescriptionPreviouslyObserved:boolean;fullJdReprintPermissionVerified:false;
 originalDescriptionStored:false;snapshotObservedAt:string;sourceCheckedAt:string|null;
 status:'historical_public_posting';currentApplicationVerified:false;
 responsibilitiesZh:null;requirementsFullZh:null;notices:{zh:string;en:string};
};
type Feed={kind:'HHBA_CURATED_JOBS_V1';jobs:CuratedJob[]};
type Manifest={kind:'HHBA_CURATED_OFFLINE_V1';numberOfCompanies:number;numberOfJobs:number;originalSnapshotAt:string;externalApiAtRuntime:false};
type Catalog={kind:'HHBA_CURATED_COMPANIES_V1';companies:{id:string;name:string;nameZh:string;jobsCount:number}[]};
type Pack={jobs:CuratedJob[];manifest:Manifest;companies:Catalog['companies']};
const BASE=import.meta.env.BASE_URL+'curated/v1/';
let memo:Promise<Pack>|null=null;
export function loadCuratedOffline():Promise<Pack>{
 if(!memo)memo=Promise.all(['jobs.json','manifest.json','companies.json'].map(async name=>{
  const response=await fetch(BASE+name,{method:'GET',cache:'force-cache',credentials:'omit'});
  if(!response.ok)throw Error('OFFLINE_CURATED_DATA_MISSING '+name);
  return response.json();
 })).then(raw=>{
  const [feed,manifest,catalog]=raw as [Feed,Manifest,Catalog];
  if(feed.kind!=='HHBA_CURATED_JOBS_V1'||manifest.kind!=='HHBA_CURATED_OFFLINE_V1'||
   catalog.kind!=='HHBA_CURATED_COMPANIES_V1'||
   manifest.externalApiAtRuntime!==false||
   !Array.isArray(feed.jobs)||feed.jobs.length!==manifest.numberOfJobs||
   catalog.companies.length!==manifest.numberOfCompanies||
   new Set(feed.jobs.map(j=>j.id)).size!==feed.jobs.length||
   feed.jobs.some(j=>j.status!=='historical_public_posting'||j.currentApplicationVerified!==false))
    throw Error('OFFLINE_CURATED_CONTRACT_FAILED');
  return {jobs:feed.jobs,manifest,companies:catalog.companies};
 }).catch(error=>{memo=null;throw error});
 return memo;
}
const textOf=(j:CuratedJob)=>[j.company,j.companyZh,j.titleZh,j.titleEn,j.locationZh,j.locationEn,j.countryCode,j.cityKey,...j.skillSignals].join(' ').toLowerCase();
const norm=(v:string)=>v.trim().toLocaleLowerCase();
export function selectCurated(jobs:CuratedJob[],query:string,company:string,country:string){
 const parts=norm(query).split(/\s+/).filter(Boolean);
 return jobs.filter(j=>(!company||j.company===company)&&(!country||j.countryCode===country)&&
 parts.every(q=>textOf(j).includes(q)));
}
const education:Record<string,string>={
 BACHELOR:'本科（历史信息提取）',MASTER:'硕士（历史信息提取）',
 PHD:'博士（历史信息提取）',ASSOCIATE:'专科（历史信息提取）',
 HIGH_SCHOOL:'高中（历史信息提取）'
};
const category:Record<string,string>={
 engineering:'工程与技术',commercial:'商业与市场',product:'产品',
 operations:'运营与职能',design:'设计',other:'其他'
};
function AgeTag(){return <span className="curated-age-tag">历史公开岗位 · 当前状态未核验</span>;}
function JobCard({job}:{job:CuratedJob}){
 return <article className="curated-job-card">
  <div className="curated-card-top"><strong>{job.companyZh}</strong><AgeTag/></div>
  <h3><Link to={'/candidate/jobs/'+job.id}>{job.titleZh}</Link></h3>
  <p className="curated-original-title">{job.titleEn}</p>
  <div className="curated-job-place"><MapPin size={15}/>{job.locationZh||job.locationEn}</div>
  <div className="curated-skills">
   {job.skillSignals.slice(0,4).map(s=><span key={s}>{s}</span>)}
   {!job.skillSignals.length&&<span>技能信息待补充</span>}
  </div>
  <div className="curated-card-foot"><small>标题为机器译文 · 可站内阅读</small><Link to={'/candidate/jobs/'+job.id}>查看岗位资料 <ArrowRight size={15}/></Link></div>
 </article>
}
export function CuratedHomePage({user}:{user:User|null}){
 return <Shell user={user}>
  <section className="home-hero"><h1>让机会与人才，找到彼此。</h1><p>你来到这里，是为了什么？</p></section>
  <section className="entry-grid" aria-label="选择使用入口">
   <button className="entry-card" onClick={()=>navigate('/candidate/jobs')}>
    <span className="entry-icon"><BriefcaseBusiness size={23}/></span>
    <strong>我要应聘</strong><small>直接检索精选全球企业职业资料，中文阅读，无需连接国外招聘系统。</small>
    <span className="entry-footer">进入精选岗位市场 <ArrowRight size={15}/></span>
   </button>
   <button className="entry-card" onClick={()=>navigate('/recruiter/register')}>
    <span className="entry-icon"><UsersRound size={23}/></span>
    <strong>我要招人</strong><small>保留现有招聘方入口，待后续接入独立的国内服务。</small>
    <span className="entry-footer">进入招聘方入口 <ArrowRight size={15}/></span>
   </button>
  </section>
  <CuratedJobMarket compact/>
  <HomeCompanyMarquee/>
 </Shell>;
}

export function CuratedJobMarket({user,compact=false}:{user?:User|null;compact?:boolean}){
 const [pack,setPack]=useState<Pack|null>(null),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[company,setCompany]=useState(''),[country,setCountry]=useState('');
 const [visibleCount,setVisibleCount]=useState(60);
 useEffect(()=>{setVisibleCount(60)},[query,company,country]);
 useEffect(()=>{let alive=true;loadCuratedOffline().then(p=>{if(alive)setPack(p)}).catch(e=>{if(alive)setError(e.message)});return ()=>{alive=false}},[]);
 const results=useMemo(()=>selectCurated(pack?.jobs||[],query,company,country),[pack,query,company,country]);
 const countries=useMemo(()=>[...new Set((pack?.jobs||[]).map(j=>j.countryCode).filter((x):x is string=>!!x))].sort(),[pack]);
 const body=<section className={'curated-market '+(compact?'curated-compact':'')} aria-label="精选全球企业职业资料">
  <div className="curated-heading"><div><small>HHBA / GLOBAL CAREER LIBRARY</small><h2>全球知名企业 · 精选岗位资料</h2>
  <p>中文优先、预先收录、无需连接海外招聘 API。岗位是历史公开资料，不承诺仍在招聘。</p></div>
  <span className="curated-total">{pack?pack.jobs.length+' 条精选资料':'正在载入本地资料'}</span></div>
  {error&&<p className="curated-error" role="alert">精选岗位数据文件未能加载：{error}。本页面不会切换到海外实时接口。</p>}
  {pack&&<>
   <div className="curated-search-panel">
    <label className="curated-search"><Search size={17}/><input aria-label="搜索精选岗位" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索企业、岗位、国家、技能，例如：新加坡 产品"/></label>
    <select aria-label="筛选企业" value={company} onChange={e=>setCompany(e.target.value)}><option value="">全部企业</option>{pack.companies.map(c=><option key={c.id} value={c.name}>{c.nameZh}</option>)}</select>
    <select aria-label="筛选国家" value={country} onChange={e=>setCountry(e.target.value)}><option value="">全部国家地区</option>{countries.map(c=><option value={c} key={c}>{c}</option>)}</select>
   </div>
   <div className="curated-result-label">符合条件 {results.length} 条 · 收录快照 {pack.manifest.originalSnapshotAt.slice(0,10)}</div>
   {results.length?<div className="curated-cards">{(compact?results.slice(0,6):results.slice(0,visibleCount)).map(job=><JobCard job={job} key={job.id}/>)}</div>:
    <div className="curated-empty">没有找到匹配的岗位资料，试试其他关键词或企业。</div>}
   {!compact&&results.length>visibleCount&&<div className="curated-explore"><button type="button" className="curated-load-more" onClick={()=>setVisibleCount(n=>Math.min(n+60,results.length))}>继续显示更多岗位（已显示 {Math.min(visibleCount,results.length)} / {results.length} 条） <ArrowRight size={16}/></button></div>}
   {compact&&<div className="curated-explore"><Link to="/candidate/jobs">查看全部 {pack.jobs.length} 条精选资料 <ArrowRight size={16}/></Link></div>}
   <p className="curated-notice"><ShieldCheck size={15}/> 本站提供职业资料研究，不代表与企业合作或确认岗位仍在开放投递；学历、经验和技能线索可能不完整。</p>
  </>}
 </section>;
 return compact?body:<Shell user={user||null}>{body}</Shell>;
}
export function CuratedJobDetail({user,jobId}:{user:User|null;jobId:string}){
 const [pack,setPack]=useState<Pack|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;loadCuratedOffline().then(p=>{if(alive)setPack(p)}).catch(e=>{if(alive)setError(e.message)});return ()=>{alive=false}},[]);
 const job=pack?.jobs.find(j=>j.id===jobId);
 return <Shell user={user}><article className="curated-detail">
  <button className="curated-back" onClick={()=>navigate('/candidate/jobs')}><ArrowLeft size={17}/> 返回精选岗位</button>
  {error&&<p role="alert">本地资料不可用：{error}</p>}
  {!pack&&!error&&<p>正在读取本地岗位资料…</p>}
  {pack&&!job&&<p>未找到这条岗位资料，可能已被管理员撤下。</p>}
  {job&&<>
   <header className="curated-detail-heading"><div><p className="curated-overline">{job.companyZh} / {category[job.jobCategory]||'岗位资料'}</p>
     <h1>{job.titleZh}</h1><p>{job.titleEn}</p><AgeTag/>
     <p className="curated-detail-location"><MapPin size={17}/>{job.locationZh||job.locationEn}</p>
    </div><div className="curated-detail-snapshot"><Globe2 size={19}/><strong>本地岗位档案</strong><small>无需实时连接海外官网</small></div></header>
   <div className="curated-detail-layout"><div className="curated-detail-main">
     <section className="curated-detail-section"><h2><BookOpen size={19}/> 职位基本资料</h2>
      <dl className="curated-facts">
       <div><dt>所属企业</dt><dd>{job.companyZh}</dd></div>
       <div><dt>工作地点</dt><dd>{job.locationZh} <small>{job.locationEn}</small></dd></div>
       <div><dt>学历线索</dt><dd>{job.education?(education[job.education]||job.education):'官方公开信息未明确识别'}</dd></div>
       <div><dt>经验线索</dt><dd>{job.experienceMinYears!==null?'原始资料提及 '+job.experienceMinYears+' 年及以上':'未明确识别'}</dd></div>
       <div><dt>岗位方向</dt><dd>{category[job.jobCategory]||'其他'}</dd></div>
      </dl>
     </section>
     <section className="curated-detail-section"><h2><BriefcaseBusiness size={19}/> 技能与任职线索</h2>
      {job.skillSignals.length?<div className="curated-skills">{job.skillSignals.map(s=><span key={s}>{s}</span>)}</div>:<p>尚无可核实的技能关键词。</p>}
      <p className="curated-caveat">以上是从曾公开的官方岗位资料保守提取的关键词，不构成完整任职要求。我们未保存或转载原始完整 JD。</p>
     </section>
     <section className="curated-detail-section"><h2>岗位职责与详细要求</h2>
      <p>岗位职责原文未收录。这份档案目前仅收录已经核验的结构化事实。官方完整职责和要求尚未取得可公开转载的使用依据，不能以猜测或 AI 编造填充。</p>
      <p>后续经合法授权或人工核实的岗位说明，才会作为正式编辑内容补充。</p>
     </section>
   </div><aside className="curated-detail-aside">
    <h3>资料状态</h3><AgeTag/>
    <dl><div><dt>原始资料来源</dt><dd>{job.originalPlatform}</dd></div>
      <div><dt>资料快照</dt><dd>{job.snapshotObservedAt.slice(0,10)}</dd></div>
      <div><dt>招聘状态</dt><dd>未经实时核验</dd></div>
      <div><dt>中文标题</dt><dd>机器翻译，待人工审校</dd></div></dl>
    <p>海外官方网页可能无法在中国大陆直接访问。这里保留原始来源供核对，不要求用户访问才能阅读本页。</p>
    <a data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" href={job.originalUrl}>访问原始职位页面 <ExternalLink size={15}/></a>
    <p className="curated-caveat">该链接可能失效，并不表示职位仍在招聘。</p>
   </aside></div>
  </>}
 </article></Shell>;
}