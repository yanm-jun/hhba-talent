import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, RefreshCcw, ShieldCheck } from 'lucide-react';
import { EmployerBrandLogo } from '../components/EmployerBrandLogo';
import { CompanyVisualStory } from '../components/CompanyVisualStory';
import { Link, getCompanyReturnTarget } from '../router';
import { Shell } from '../components/Shell';
import { decodeEmployerIdentity, discoverEmployerJobs,
 approvedEmployerJobIds, type EmployerIdentity } from '../services/companyDirectory';
import { reviewedEditorialForEmployer } from '../services/reviewedCompanyEditorial';
import { featuredTitle, featuredLocation } from '../services/featuredOfficialJobs';
import { loadOfficialPublicSnapshot, localizedLocation, safeOfficialJobUrl,
 type Language, type LiveJob } from '../services/liveRecruitment';
import { loadPublicJobAudit } from '../services/jobSyncStatus';
import type { User } from '../services/api';
import '../styles/company-profiles.css';

const NO_PROFILE_ZH='HHBA 尚未完成这家企业的背景、成立时间、主营业务和产品介绍审核。';
const NO_PROFILE_EN='HHBA has not yet reviewed this employer’s background, founding year, main business or products.';
const platformLabels:Record<string,string>={
 greenhouse:'Greenhouse',ashby:'Ashby',lever:'Lever'
};

export function IndexedCompanyPage({encodedId,user}:{encodedId:string;user:User|null}){
 const identity=useMemo(()=>decodeEmployerIdentity(encodedId),[encodedId]);
 const [lang,setLang]=useState<Language>(()=>{
  try{return sessionStorage.getItem('hhba.jobs.language')==='en'?'en':'zh'}
  catch{return 'zh'}
 });
 const [jobs,setJobs]=useState<LiveJob[]>([]);
 const [updated,setUpdated]=useState('');
 const [status,setStatus]=useState<'loading'|'ready'|'missing'|'error'>('loading');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [shown,setShown]=useState(8);
 const editorial=identity?reviewedEditorialForEmployer(identity):null;
 const back=getCompanyReturnTarget();
 useEffect(()=>{setShown(8)},[encodedId]);
 useEffect(()=>{
  if(!identity){setStatus('missing');return}
  const controller=new AbortController();
  setStatus('loading');setJobs([]);setError('');setUpdated('');
  Promise.all([loadOfficialPublicSnapshot(controller.signal),loadPublicJobAudit()])
   .then(([snapshot,audit])=>{
    if(controller.signal.aborted)return;
    const approved=approvedEmployerJobIds(audit,snapshot.updated);
    if(!approved)throw new Error('招聘索引与官方岗位审核版本不一致');
    const found=discoverEmployerJobs(snapshot,approved,identity);
    if(!found.length){setStatus('missing');return}
    found.sort((a,b)=>a.id.localeCompare(b.id));
    setJobs(found);setUpdated(snapshot.updated);setStatus('ready');
   }).catch(reason=>{
    if(controller.signal.aborted)return;
    setError(reason instanceof Error?reason.message:'无法读取岗位目录');
    setStatus('error');
   });
  return()=>controller.abort();
 },[encodedId,identity?.platform,identity?.source,identity?.company,retry]);
 const change=(value:Language)=>{
  setLang(value);
  try{sessionStorage.setItem('hhba.jobs.language',value)}catch{}
 };
 if(!identity||(status==='missing'&&!editorial))return <Shell user={user}>
  <section className="company-profile unknown-company">
   <h1>{lang==='zh'?'企业资料尚未建立或来源已变更':'Company source not found'}</h1>
   <p>{lang==='zh'?'没有可与此企业身份对应的近期已核验职位，不能创建没有来源支撑的企业档案。':
      'No recently verified jobs establish this employer identity.'}</p>
   <Link to="/candidate/jobs">{lang==='zh'?'返回招聘市场':'Return to job market'} <ArrowRight size={15}/></Link>
  </section>
 </Shell>;
 const referenceJob=jobs.find(j=>safeOfficialJobUrl(j))||null;
 const sourceUrl=referenceJob?safeOfficialJobUrl(referenceJob):null;
 const sourceLabel=platformLabels[identity.platform]||identity.platform;
 const websiteFromReview=editorial?.sources.find(s=>s.url);
 return <Shell user={user}><article className="company-profile" data-company-directory="verified-source">
  <nav className="company-profile-top" aria-label={lang==='zh'?'企业导航':'Company navigation'}>
   <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}>
    <ArrowLeft size={15}/>{lang==='zh'?'返回上一页':'Back to previous page'}
   </Link>
   <div className="unified-lang">
    <button type="button" aria-pressed={lang==='zh'} onClick={()=>change('zh')}>中文</button>
    <button type="button" aria-pressed={lang==='en'} onClick={()=>change('en')}>English</button>
   </div>
  </nav>
  <header className="company-profile-header">
   <EmployerBrandLogo identity={identity} variant="profile"/>
   <div className="company-profile-identity">
    <div className="company-profile-eyebrow">HHBA · COMPANY PROFILE</div>
    <h1>{status==='ready'||editorial?identity.company:(lang==='zh'?'正在核验企业身份…':'Verifying employer identity…')}</h1>
    <p>{editorial?.tagline[lang]||(lang==='zh'?'企业介绍 · 资料待完善':'Company profile · Editorial pending')}</p>
   </div>
   {sourceUrl&&<a className="company-profile-website" href={sourceUrl}
     target="_blank" rel="noopener noreferrer">
    {lang==='zh'?'官方职位来源':'Original job source'} <ExternalLink size={15}/>
   </a>}
  </header>
  <div className="company-profile-meta">
   <span>{lang==='zh'?'招聘来源：':'Recruitment source: '}{sourceLabel}</span>
   <span>{lang==='zh'?'企业资料：':'Editorial status: '}
    {editorial?(lang==='zh'?'已审核':'Reviewed'):(lang==='zh'?'待审核':'Pending review')}</span>
   {editorial&&<><span>{editorial.industry[lang]}</span>
    <span>{editorial.country[lang]}</span>
    {editorial.founded!=='—'&&<span>{lang==='zh'?'成立于':'Founded'} {editorial.founded}</span>}</>}
  </div>
  <p className="company-profile-editorial"><ShieldCheck size={16}/>
   {lang==='zh'
    ?'HHBA 根据公开招聘来源建立企业索引，独立编写介绍；企业身份与岗位来源核验不代表企业对 HHBA 的合作或背书。'
    :'HHBA independently indexes public job sources and authors profiles. Source validation does not imply employer partnership or endorsement.'}
  </p>
  <section className="company-profile-section">
   <h2>{lang==='zh'?'关于企业':'About the company'}</h2>
   {editorial?editorial.overview.map((part,i)=><p key={i}>{part[lang]}</p>):
    <div className="company-profile-pending" role="note">
     <strong>{lang==='zh'?'企业资料待补充':'Editorial research pending'}</strong>
     <p>{lang==='zh'?NO_PROFILE_ZH:NO_PROFILE_EN}</p>
     <p>{lang==='zh'?'目前能够确认的是：HHBA 在此招聘系统及其公开招聘板中发现了该企业对应的真实招聘记录。具体经营范围、企业规模和母子公司关系尚未核实。':
       'HHBA has observed source-matched official job postings. Industry, size and legal-entity relationships have not yet been independently verified.'}</p>
    </div>}
  </section>
  <CompanyVisualStory identity={identity} lang={lang}/>
  <section className="company-profile-section">
   <h2>{lang==='zh'?'主要业务与代表产品':'Business and products'}</h2>
   {editorial?<div className="company-profile-focus-grid">{editorial.focus.map((item,i)=>
    <div className="company-profile-focus" key={i}>
     <h3>{item.name[lang]}</h3><p>{item.description[lang]}</p>
    </div>)}</div>:
    <p className="company-profile-pending-text">
     {lang==='zh'?'尚未找到并通过核验的官方业务与产品资料，不推测主营业务。':
       'Products and business lines have not yet passed source review.'}</p>}
  </section>
  <section className="company-profile-section">
   <h2>{lang==='zh'?'发展与重要节点':'Selected milestones'}</h2>
   {editorial?<div className="company-profile-milestones">{editorial.milestones.map((item,i)=>
    <div className="company-profile-milestone" key={i}>
     <strong>{item.date}</strong><p>{item.description[lang]}</p>
    </div>)}</div>:
    <p className="company-profile-pending-text">
     {lang==='zh'?'成立时间、重大事件尚未完成公开来源核实。':
       'Founding dates and milestones have not yet been independently sourced.'}</p>}
  </section>
  <section className="company-profile-section company-profile-openings">
   <div className="company-profile-section-heading">
    <div>
     <h2>{lang==='zh'?'该企业的真实招聘岗位':'Official job listings'}</h2>
     <p>{lang==='zh'?'基于企业招聘板标识、岗位链接与同版本 JD 审核的结果。申请状态以企业官网为准。':
       'Matched to the employer job board and current JD audit. Check status with the employer.'}</p>
    </div>
    <Link to="/candidate/jobs">{lang==='zh'?'返回招聘市场':'Job market'} <ArrowRight size={15}/></Link>
   </div>
   {status==='missing'?<p role="status" className="company-profile-jobs-state">{lang==='zh'?'目前没有可展示的近期已核验职位；企业资料仍可独立阅读。':'No recently verified openings can be displayed; the company profile remains available.'}</p>:status==='loading'?<p role="status" className="company-profile-jobs-state">
    {lang==='zh'?'正在核验该企业招聘岗位…':'Verifying employer job listings…'}</p>:
    status==='error'?<div className="company-profile-jobs-state" role="alert">
     <span>{lang==='zh'?error:'The job index is temporarily unavailable.'}</span>
     <button type="button" onClick={()=>setRetry(i=>i+1)}><RefreshCcw size={14}/>
      {lang==='zh'?'重试':'Retry'}</button>
    </div>:
    <><p className="company-profile-job-count">
     {lang==='zh'?'当前来源已核验岗位：':'Verified source listings: '}{jobs.length.toLocaleString()}
     {updated?' · '+updated.slice(0,10):''}</p>
     <div className="company-profile-job-grid">
      {jobs.slice(0,shown).map(job=><Link key={job.id}
        className="company-profile-job-card" to={'/candidate/jobs/'+encodeURIComponent(job.id)}>
        <strong>{featuredTitle(job,lang)}</strong>
        <span><MapPin size={13}/>{featuredLocation(job,lang)||localizedLocation(job,lang)}</span>
        <em>{lang==='zh'?'查看岗位说明':'View job details'} <ArrowRight size={14}/></em>
      </Link>)}
     </div>
     {jobs.length>shown&&<button type="button" className="company-profile-load-more"
       onClick={()=>setShown(n=>n+8)}>
       {lang==='zh'?'查看更多岗位':'Show more roles'} <ArrowRight size={14}/>
     </button>}</>}
  </section>
  <section className="company-profile-section company-profile-sources">
   <h2>{lang==='zh'?'信息来源与状态':'Sources and review status'}</h2>
   {editorial?editorial.sources.map((source,i)=><a key={i}
     href={source.url} target="_blank" rel="noopener noreferrer">
     {source.label[lang]} <ExternalLink size={14}/></a>):
    <p>{lang==='zh'?'目前仅核实招聘来源，尚未发布独立核实的企业经营介绍。':
       'Only the recruitment source has been validated; no independently reviewed corporate background has been published.'}</p>}
   {sourceUrl&&<a data-hhba-recruitment-outbound="true" href={sourceUrl} target="_blank" rel="noopener noreferrer">
    {lang==='zh'?'查看该来源的一条官方职位记录':'Open a source-verified job posting'} <ExternalLink size={14}/>
   </a>}
   <small>{editorial
    ?(lang==='zh'?'资料核验：':'Editorial verified: ')+editorial.lastReviewed
    :(lang==='zh'?'最后同步：':'Last indexed: ')+(updated?updated.slice(0,10):'—')}</small>
  </section>
  <footer className="company-profile-footer">
   <span>{lang==='zh'?'本页由 HHBA 独立整理，不代表官方招聘合作；品牌图标未核实时不会冒充官方 Logo。':
    'Independently maintained by HHBA; no recruiting affiliation is implied. Unverified logos are not reproduced.'}</span>
   <Link to="/candidate/jobs">{lang==='zh'?'招聘市场':'Job market'} <ArrowRight size={14}/></Link>
  </footer>
 </article></Shell>;
}
