import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap,MapPin} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import schneider from '../data/domesticSchneiderDetailedDossier20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import '../styles/schneider-compact-profile.css';

/**
 * Exactly the four sections accepted for KPMG.
 * This is a standalone second-company preview; never display made-up vacancies.
 * Job detail URLs come from Schneider Electric's careers.se.com system.
 */
export function SchneiderCompactProfilePage({user}:{user:User|null}){
 const [major,setMajor]=useState('不限专业');
 const [showAllJobs,setShowAllJobs]=useState(false);
 const [showAllServices,setShowAllServices]=useState(false);
 const selected=schneider.majors.find(x=>x.name===major)||schneider.majors[0];
 const filtered=selected.id==='all'||selected.id==='other'
   ?schneider.jobs
   :schneider.jobs.filter(job=>job.majorSlugs.includes(selected.id));
 const shownJobs=filtered.slice(0,showAllJobs?filtered.length:5);
 const shownServices=schneider.services.slice(0,showAllServices?schneider.services.length:4);
 const back=getCompanyReturnTarget();
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-schneider-compact" data-company-template="openai" data-employer-id="cn-autumn-002" data-company-profile-version="recruitment-first">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/domestic-autumn">所有企业 <ArrowRight size={15}/></Link>
   </nav>

   <section className="hhba-kpmg-hero" aria-label="施耐德电气 Logo 及 AI 场景图片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="施耐德电气" large/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>施耐德电气 <span>Schneider Electric</span></h1>
      <p>{schneider.industry}</p>
     </div>
     <a className="hhba-kpmg-quick-link" href={schneider.recruitmentHomepage}
      target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">
      招聘官网 <ExternalLink size={14}/>
     </a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     {schneider.imagePaths.map((path,i)=><figure key={path}>
      <img src={import.meta.env.BASE_URL+path} loading="eager"
       alt={schneider.imageLabels[i]+'，AI 独立场景示意，非施耐德电气真实办公室或厂区'}/>
      <figcaption><span>{schneider.imageLabels[i]}</span><small>AI 场景示意</small></figcaption>
     </figure>)}
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="schneider-majors">
    <div className="hhba-kpmg-section-heading"><div>
     <h2 id="schneider-majors">适合哪些专业背景？</h2>
     <p>选择专业后，下方仅展示业务相关的官方职位记录；具体报考资格以职位要求为准。</p>
    </div></div>
    <div className="hhba-kpmg-major-list" role="group" aria-label="选择所学专业">
     {schneider.majors.map(item=><button type="button" key={item.name}
      className={'hhba-kpmg-major'+(major===item.name?' is-selected':'')}
      aria-pressed={major===item.name}
      onClick={()=>{setMajor(item.name);setShowAllJobs(false)}}>
      {item.name}{major===item.name&&<CheckCircle2 size={13}/>}
     </button>)}
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="schneider-jobs">
    <div className="hhba-kpmg-section-heading">
     <div><h2 id="schneider-jobs">招聘岗位与职业机会</h2>
      <p>已收录 <strong>{schneider.jobs.length}</strong> 个官方具体职位页面 · 当前专业匹配 <strong>{filtered.length}</strong> 个</p>
     </div>
     <a className="hhba-kpmg-section-link" href={schneider.recruitmentHomepage}
      target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">招聘官网 <ExternalLink size={13}/></a>
    </div>
    <div className="hhba-kpmg-role-list" aria-live="polite">
      {shownJobs.map(job=><article className="hhba-kpmg-role" key={job.id}>
        <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
        <div className="hhba-kpmg-role-main">
         <div className="hhba-kpmg-role-top"><h3>{job.title}</h3><span>{job.type}</span></div>
         <p><MapPin size={12} className="hhba-schneider-map-icon"/>{job.city} · {job.summary}</p>
         <small>{job.experience} · 官网职位编号 {job.id}</small>
        </div>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
         data-hhba-recruitment-outbound="true" aria-label={'查看施耐德电气官方岗位'+job.title}>
         查看岗位 <ArrowRight size={14}/></a>
      </article>)}
    </div>
    {filtered.length>shownJobs.length&&<button className="hhba-kpmg-service-more" type="button" onClick={()=>setShowAllJobs(true)}>
      查看其余 {filtered.length-shownJobs.length} 个官方职位 <ChevronDown size={16}/>
    </button>}
    {showAllJobs&&filtered.length>5&&<button className="hhba-schneider-collapse" type="button" onClick={()=>setShowAllJobs(false)}>收起职位</button>}
    {selected.id==='other'&&<p className="hhba-kpmg-role-disclaimer">其他专业仅展示可探索的岗位，不代表符合招聘资格。</p>}
    <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/>{schneider.jobStatusNote}</p>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="schneider-services">
    <div className="hhba-kpmg-section-heading"><div>
     <h2 id="schneider-services">主要业务与专业服务</h2>
     <p>先看重点业务，详细内容可以按需展开。</p>
    </div></div>
    <div className="hhba-kpmg-service-grid">
     {shownServices.map((service,i)=><article className="hhba-kpmg-service" key={service.title}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务方向</span>
      <h3>{service.title}</h3><p>{service.description}</p>
      <span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary>
       <div className="hhba-kpmg-service-detail">
        <strong>典型产品与服务</strong>
        <ul>{service.deliverables.map(item=><li key={item}>{item}</li>)}</ul>
        <strong>关联职业方向</strong><p>{service.career}</p>
       </div>
      </details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setShowAllServices(v=>!v)}>
      {showAllServices?'收起其余业务':'查看更多专业服务（共 8 项）'} <ChevronDown className={showAllServices?'is-up':''} size={16}/>
    </button>
   </section>
  </article>
 </Shell>;
}
