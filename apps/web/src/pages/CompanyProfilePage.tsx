import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, ExternalLink, MapPin, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Link, getCompanyReturnTarget } from '../router';
import { Shell } from '../components/Shell';
import { CompanyVisualStory } from '../components/CompanyVisualStory';
import { verifiedBrandKey } from '../components/EmployerBrandLogo';
import { companyProfiles, profileFromSlug, type CompanySlug } from '../services/companyProfiles';
import { CURATED_JOBS, featuredTitle, featuredLocation } from '../services/featuredOfficialJobs';
import { loadOfficialPublicSnapshot, localizedLocation, officialStatus, safeOfficialJobUrl,
  type Language, type LiveJob } from '../services/liveRecruitment';
import { loadPublicJobAudit } from '../services/jobSyncStatus';
import type { User } from '../services/api';
import '../styles/company-profiles.css';

const logoName:Record<CompanySlug,string>={openai:'openai',anthropic:'claude',spacex:'spacex'};
function LanguageSwitch({lang,change}:{lang:Language;change:(value:Language)=>void}){
 return <div className="unified-lang" aria-label="Company profile language">
   <button type="button" aria-pressed={lang==='zh'} onClick={()=>change('zh')}>中文</button>
   <button type="button" aria-pressed={lang==='en'} onClick={()=>change('en')}>English</button>
 </div>;
}
export function CompanyProfilePage({slug,user}:{slug:string;user:User|null}){
 const profile=profileFromSlug(slug);
 const [lang,setLang]=useState<Language>(()=>{
   try{return sessionStorage.getItem('hhba.jobs.language')==='en'?'en':'zh'}
   catch{return 'zh'}
 });
 const [jobs,setJobs]=useState<LiveJob[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [updated,setUpdated]=useState('');
 const [shown,setShown]=useState(8);
 const [retry,setRetry]=useState(0);
 const [logoBroken,setLogoBroken]=useState(false);
 const back=getCompanyReturnTarget();
 useEffect(()=>{setLogoBroken(false);setShown(8)},[slug]);
 useEffect(()=>{
   if(!profile)return;
   const controller=new AbortController();
   setLoading(true);setError('');setJobs([]);
   // Company text loads immediately. Only independently source-verified jobs
   // are read asynchronously from the existing, shared official ATS index.
   Promise.all([loadOfficialPublicSnapshot(controller.signal),loadPublicJobAudit()])
     .then(([snapshot,audit])=>{
       if(controller.signal.aborted)return;
       if(!audit||audit.summary.indexed_as_of!==snapshot.updated)
         throw new Error('岗位索引与核验数据尚未同步');
       const valid=new Set(audit.jobs.filter(row=>
         row.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND').map(row=>row.job_id));
       const current=snapshot.jobs.filter(job=>
         verifiedBrandKey(job)===profile.slug &&
         job.company===profile.name &&
         valid.has(job.id) &&
         officialStatus(job,snapshot.updated)==='recent' &&
         !!safeOfficialJobUrl(job));
       const favorites=new Map(CURATED_JOBS.map((job,i)=>[job.id,i]));
       current.sort((a,b)=>(favorites.get(a.id)??Number.MAX_SAFE_INTEGER)-
         (favorites.get(b.id)??Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
       setJobs(current);
       setUpdated(snapshot.updated);
     }).catch(e=>{
       if(!controller.signal.aborted)setError(e instanceof Error?e.message:'当前岗位暂不可用');
     }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
   return()=>controller.abort();
 },[profile?.slug,retry]);
 const change=(value:Language)=>{
   setLang(value);
   try{sessionStorage.setItem('hhba.jobs.language',value)}catch{}
 };
 if(!profile)return <Shell user={user}><section className="company-profile unknown-company">
   <h1>未找到该企业的已核实资料</h1>
   <p>HHBA 尚未编写并核实这个企业的介绍，不会用其他企业资料替代。</p>
   <Link to="/candidate/jobs">返回招聘市场 <ArrowRight size={16}/></Link>
 </section></Shell>;
 const listingUrl='/candidate/jobs?company='+encodeURIComponent(profile.name);
 return <Shell user={user}>
   <article className="company-profile">
     <nav className="company-profile-top" aria-label={lang==='zh'?'企业导航':'Company navigation'}>
       <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}>
         <ArrowLeft size={15}/>{lang==='zh'?'返回上一页':'Back to previous page'}
       </Link>
       <LanguageSwitch lang={lang} change={change}/>
     </nav>
     <header className="company-profile-header">
       <div className={'company-profile-brand'+(slug==='spacex'?' company-profile-brand-wide':'')}>
         {logoBroken?<Building2 size={28} aria-label="Logo unavailable"/>:
           <img src={import.meta.env.BASE_URL+'brands/'+logoName[profile.slug]+'.svg'}
             alt={profile.logoAlt[lang]} loading="eager" decoding="async" onError={()=>setLogoBroken(true)}/>}
       </div>
       <div className="company-profile-identity">
         <div className="company-profile-eyebrow">HHBA · COMPANY PROFILE</div>
         <h1>{profile.name}</h1>
         <p>{profile.tagline[lang]}</p>
       </div>
       <a className="company-profile-website" href={profile.website} target="_blank" rel="noopener noreferrer">
         {lang==='zh'?'企业官网':'Official website'} <ExternalLink size={15}/>
       </a>
     </header>
     <div className="company-profile-meta">
       <span>{profile.industry[lang]}</span><span>{profile.country[lang]}</span>
       <span>{lang==='zh'?'成立于':'Founded'} {profile.founded}</span>
     </div>
     <p className="company-profile-editorial">
       <ShieldCheck size={16}/>
       {lang==='zh'
         ?'由 HHBA 根据企业公开资料独立整理，并非企业官方主页或招聘合作声明。'
         :'Independently written by HHBA using public company sources; not an official profile or recruiting partnership.'}
     </p>

     <section className="company-profile-section">
       <h2>{lang==='zh'?'关于企业':'About the company'}</h2>
       {profile.overview.map((paragraph,i)=><p key={i}>{paragraph[lang]}</p>)}
     </section>
     <CompanyVisualStory identity={{company:profile.name,platform:slug==='openai'?'ashby':'greenhouse',source:slug}} lang={lang}/>
     <section className="company-profile-section">
       <h2>{lang==='zh'?'主要业务与代表产品':'Business and products'}</h2>
       <div className="company-profile-focus-grid">
         {profile.focus.map((focus,i)=><div className="company-profile-focus" key={i}>
           <h3>{focus.name[lang]}</h3><p>{focus.description[lang]}</p>
         </div>)}
       </div>
     </section>
     <section className="company-profile-section">
       <h2>{lang==='zh'?'发展与重要节点':'Selected milestones'}</h2>
       <div className="company-profile-milestones">
         {profile.milestones.map((item,i)=><div key={i} className="company-profile-milestone">
           <strong>{item.date}</strong><p>{item.description[lang]}</p>
         </div>)}
       </div>
     </section>
     <section className="company-profile-section company-profile-openings" aria-labelledby="company-openings-title">
       <div className="company-profile-section-heading">
         <div>
           <h2 id="company-openings-title">{lang==='zh'?'该企业的真实招聘岗位':'Official job listings'}</h2>
           <p>{lang==='zh'?'仅展示通过当前来源核验的岗位，是否仍可投递以企业官网为准。':
             'Recently validated source listings only; verify application availability with the employer.'}</p>
         </div>
         <Link to={listingUrl}>{lang==='zh'?'查看全部':'All roles'} <ArrowRight size={15}/></Link>
       </div>
       {loading?<p className="company-profile-jobs-state" role="status">
         {lang==='zh'?'正在读取该企业已核验岗位…':'Loading verified openings…'}</p>:
        error?<div className="company-profile-jobs-state" role="alert">
          <span>{lang==='zh'?error:'Job index temporarily unavailable.'}</span>
          <button type="button" onClick={()=>setRetry(n=>n+1)}><RefreshCcw size={14}/>
            {lang==='zh'?'重新加载':'Retry'}</button>
        </div>:
        jobs.length===0?<p className="company-profile-jobs-state">
           {lang==='zh'?'目前没有通过近期来源核验的在招岗位。':'No recently verified listings available.'}</p>:
        <>
          <p className="company-profile-job-count">{lang==='zh'
            ?'当前索引中符合核验条件的岗位：'+jobs.length.toLocaleString()+' 条'
            :jobs.length.toLocaleString()+' recently source-verified listings in the index'}
            {updated?' · '+updated.slice(0,10):''}</p>
          <div className="company-profile-job-grid">
            {jobs.slice(0,shown).map(job=><Link key={job.id}
              to={'/candidate/jobs/'+encodeURIComponent(job.id)} className="company-profile-job-card">
              <strong>{featuredTitle(job,lang)}</strong>
              <span><MapPin size={13}/>{featuredLocation(job,lang)||localizedLocation(job,lang)}
                {job.remote===true?' · '+(lang==='zh'?'远程':'Remote'):''}</span>
              <em>{lang==='zh'?'查看岗位说明':'View job details'} <ArrowRight size={14}/></em>
            </Link>)}
          </div>
          {jobs.length>shown&&<button className="company-profile-load-more" type="button"
            onClick={()=>setShown(n=>n+8)}>
            {lang==='zh'?'查看更多岗位':'Show more roles'} <ArrowRight size={14}/>
          </button>}
        </>}
     </section>
     <section className="company-profile-section company-profile-sources">
       <h2>{lang==='zh'?'信息来源':'Sources'}</h2>
       <p>{lang==='zh'?'以下为企业公开资料，供核实企业介绍；招聘信息来自独立岗位索引。':
         'Public company references for this HHBA editorial. Listings use a separate official jobs index.'}</p>
       {profile.sources.map((source,i)=><a href={source.url} target="_blank"
         rel="noopener noreferrer" key={i}>{source.label[lang]} <ExternalLink size={14}/></a>)}
       <small>{lang==='zh'?'资料核对日期：':'Editorial review: '}{profile.lastReviewed}</small>
     </section>
     <footer className="company-profile-footer">
       <span>{lang==='zh'?'企业名称、产品和商标归各自权利人所有。HHBA 独立整理，不代表授权或合作。':
         'Names and marks belong to their owners. HHBA is independent and does not claim endorsement.'}</span>
       <a data-hhba-recruitment-outbound="true" href={profile.careers} target="_blank" rel="noopener noreferrer">
         {lang==='zh'?'企业官方招聘网站':'Employer careers site'} <ExternalLink size={14}/>
       </a>
     </footer>
   </article>
 </Shell>;
}
